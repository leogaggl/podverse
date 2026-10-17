import { createHmac } from 'node:crypto';

import type { Server } from 'http';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  BILLING_API_ERROR_CODES,
  BillingProcessorRecordNotFoundError,
  extendMembershipPeriodByCadence,
  STRIKE_ONE_TIME_PRODUCT_IDS,
} from '@podverse/helpers';
import type { ORMContext } from '@podverse/orm';

import { authHeaders, getBaseApiUrl, startTestApp, stopTestApp } from './helpers/index.js';

const strikeFake = vi.hoisted(() => ({
  nextId: 0,
  // Checkout rows survive the next Vitest process. A counter that restarts at 1 would reuse
  // processor external ids and hit the unique key.
  runToken: `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
  completedAt: new Date(0).toISOString(),
  completedIds: new Set<string>(),
  invoices: new Map<string, { bolt11: string; expiresAt: string }>(),
  lastReceiveRequestId: '',
}));

/** Strike never leaves the process: the adapter still verifies signatures for real. */
vi.mock('@podverse/external-services-strike', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@podverse/external-services-strike')>();

  class FakeStrikeClient {
    async createReceiveRequest(): Promise<{
      bolt11: string;
      expiresAt: string;
      receiveRequestId: string;
    }> {
      strikeFake.nextId += 1;
      const receiveRequestId = `rr-vitest-${strikeFake.runToken}-${strikeFake.nextId}`;
      const expiresAt = new Date(Date.now() + 900_000).toISOString();
      const bolt11 = `lnbc1vitest${receiveRequestId}`;
      strikeFake.invoices.set(receiveRequestId, { bolt11, expiresAt });
      strikeFake.lastReceiveRequestId = receiveRequestId;
      return { receiveRequestId, bolt11, expiresAt };
    }

    async getReceiveRequest(receiveRequestId: string): Promise<{
      bolt11: { invoice: string; expires: string } | null;
      created: string;
      receiveRequestId: string;
      targetCurrency: string | null;
    }> {
      const invoice = strikeFake.invoices.get(receiveRequestId);
      if (invoice === undefined) {
        throw new BillingProcessorRecordNotFoundError('strike', receiveRequestId);
      }
      return {
        receiveRequestId,
        created: invoice.expiresAt,
        targetCurrency: 'USD',
        bolt11: { invoice: invoice.bolt11, expires: invoice.expiresAt },
      };
    }

    async listReceives(receiveRequestId: string): Promise<
      {
        receiveRequestId: string;
        state: 'COMPLETED';
        amountReceived: { amount: string; currency: string };
        amountCredited: { amount: string; currency: string };
        completed: string;
      }[]
    > {
      if (!strikeFake.completedIds.has(receiveRequestId)) {
        return [];
      }
      return [
        {
          receiveRequestId,
          state: 'COMPLETED',
          amountReceived: { amount: '0.00001000', currency: 'BTC' },
          amountCredited: { amount: '3.00', currency: 'USD' },
          completed: strikeFake.completedAt,
        },
      ];
    }
  }

  return { ...actual, StrikeClient: FakeStrikeClient };
});

vi.mock('@podverse/orm', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@podverse/orm')>();

  class MockCategoryService {
    async setCategoryCache(): Promise<void> {}
  }

  return { ...actual, CategoryService: MockCategoryService };
});

const STRIKE_ENV = {
  BILLING_STRIKE_ENABLED: 'true',
  STRIKE_API_KEY: 'vitest-strike-key',
  STRIKE_WEBHOOK_SECRET: 'vitest-webhook-secret',
  STRIKE_ENVIRONMENT: 'sandbox',
} as const;

type TestAccount = {
  id: number;
  headers: { Authorization: string };
};

function rowCount(rows: unknown): number {
  if (!Array.isArray(rows) || rows.length === 0) {
    return 0;
  }
  const first = rows[0];
  if (typeof first !== 'object' || first === null || !('count' in first)) {
    return 0;
  }
  const count = Reflect.get(first, 'count');
  return typeof count === 'number' ? count : Number(count);
}

function rowAmount(rows: unknown): number {
  if (!Array.isArray(rows) || rows.length === 0) {
    return Number.NaN;
  }
  const first = rows[0];
  if (typeof first !== 'object' || first === null || !('amount' in first)) {
    return Number.NaN;
  }
  return Number(Reflect.get(first, 'amount'));
}

describe('Strike billing routes', () => {
  let app: import('express').Express;
  let server: Server | undefined;
  let ormContext: ORMContext | undefined;
  let base = '';
  let monthlyProductId = 0;
  const runId = Date.now();
  const savedEnv: Record<string, string | undefined> = {};

  const query = async (sql: string, params: unknown[] = []): Promise<unknown> => {
    if (!ormContext) {
      throw new Error('ORM context not started');
    }
    return ormContext.dataSourceReadWrite.query(sql, params);
  };

  const clearChannelCache = async (): Promise<void> => {
    const { clearBillingChannelCache } = await import('../lib/billing/checkoutOptions.js');
    clearBillingChannelCache();
  };

  const resetPollLimit = async (accountId: number): Promise<void> => {
    const { strikeCheckoutPollRateLimit } = await import('../routes/billing.js');
    await strikeCheckoutPollRateLimit.resetForUser(accountId);
  };

  let accountCount = 0;
  const createAccount = async (): Promise<TestAccount> => {
    const { AccountService, BillingMembershipExtensionService } = await import('@podverse/orm');
    const accountService = new AccountService();
    accountCount += 1;
    const email = `billing-strike-${runId}-${accountCount}@example.com`;
    await accountService.create({
      email,
      password: 'IntegrationTest1!',
      locale: 'en-US',
      terms_version: '2026-10-15',
    });
    const account = await accountService.getByEmail(email);
    if (!account) {
      throw new Error('Failed to load account after create');
    }
    await new BillingMembershipExtensionService().endAccess({
      accountId: account.id,
      endsAt: new Date(),
    });
    return {
      id: account.id,
      headers: authHeaders(account.id, account.id_text),
    };
  };

  const createCheckout = (account: TestAccount, platform?: 'web' | 'foss' | 'ios' | 'android') => {
    const body =
      platform === undefined
        ? { processor_product_id: monthlyProductId }
        : { processor_product_id: monthlyProductId, platform };
    return request(app).post(`${base}/billing/strike/checkouts`).set(account.headers).send(body);
  };

  const signWebhook = (body: string, signature: string) =>
    request(app)
      .post(`${base}/billing/webhooks/strike`)
      .set('Content-Type', 'application/json')
      .set('X-Webhook-Signature', signature)
      .send(body);

  beforeAll(async () => {
    for (const [key, value] of Object.entries(STRIKE_ENV)) {
      savedEnv[key] = process.env[key];
      process.env[key] = value;
    }

    const started = await startTestApp();
    app = started.app;
    server = started.server;
    ormContext = started.ormContext;
    base = await getBaseApiUrl();

    await query(
      `INSERT INTO billing_processor (id, display_name, is_active, created_at, updated_at)
       VALUES ('strike', 'Strike', TRUE, NOW(), NOW())
       ON CONFLICT (id) DO NOTHING`
    );

    const { BillingProcessorProductService } = await import('@podverse/orm');
    const product = await new BillingProcessorProductService().upsertPremiumProcessorProduct({
      processorId: 'strike',
      externalProductId: STRIKE_ONE_TIME_PRODUCT_IDS.monthly,
      externalBasePlanId: null,
      cadence: 'monthly',
    });
    monthlyProductId = product.processorProduct.id;
    await query(
      `INSERT INTO billing_checkout_channel
         (processor_id, platform, storefront_allowlist, enabled, created_at, updated_at)
       VALUES
         ('strike', 'web', '{}', TRUE, NOW(), NOW()),
         ('strike', 'foss', '{}', TRUE, NOW(), NOW()),
         ('strike', 'ios', '{}', FALSE, NOW(), NOW()),
         ('strike', 'android', '{}', FALSE, NOW(), NOW())
       ON CONFLICT (processor_id, platform) DO UPDATE SET enabled = EXCLUDED.enabled`
    );
    await clearChannelCache();
  });

  beforeEach(() => {
    strikeFake.completedIds.clear();
  });

  afterAll(async () => {
    try {
      await query(
        `UPDATE billing_checkout_channel SET enabled = FALSE WHERE processor_id = 'strike'`
      );
    } finally {
      await stopTestApp(server, ormContext);
      for (const [key, value] of Object.entries(savedEnv)) {
        if (value === undefined) {
          delete process.env[key];
        } else {
          process.env[key] = value;
        }
      }
    }
  });

  it('creates a checkout and stores the catalog price', async () => {
    const { BillingPriceCatalogService } = await import('@podverse/orm');
    const account = await createAccount();
    const pricing = await new BillingPriceCatalogService().resolveProductMembership();
    const res = await createCheckout(account).expect(201);

    expect(res.body.state).toBe('unpaid');
    expect(res.body.currency_code).toBe('USD');
    expect(res.body.amount).toBe(pricing.premiumMembershipCostMonthly.toFixed(2));
    expect(typeof res.body.bolt11).toBe('string');
    expect(res.body.bolt11.length).toBeGreaterThan(0);

    const rows = await query(
      `SELECT amount::text AS amount FROM billing_checkout_session
       WHERE id = $1 AND account_id = $2 AND processor_id = 'strike'`,
      [res.body.checkout_id, account.id]
    );
    expect(rowAmount(rows)).toBe(pricing.premiumMembershipCostMonthly);
  });

  it('polls unpaid, then settles and extends membership by one month', async () => {
    const account = await createAccount();
    const created = await createCheckout(account).expect(201);
    const receiveRequestId = strikeFake.lastReceiveRequestId;
    const statusBefore = await request(app)
      .get(`${base}/billing/status`)
      .set(account.headers)
      .expect(200);

    const unpaid = await request(app)
      .get(`${base}/billing/strike/checkouts/${created.body.checkout_id}`)
      .set(account.headers)
      .expect(200);
    expect(unpaid.body.state).toBe('unpaid');
    expect(unpaid.body.checkout_id).toBe(created.body.checkout_id);

    await resetPollLimit(account.id);
    const completedAt = new Date();
    strikeFake.completedAt = completedAt.toISOString();
    strikeFake.completedIds.add(receiveRequestId);

    const settled = await request(app)
      .get(`${base}/billing/strike/checkouts/${created.body.checkout_id}`)
      .set(account.headers)
      .expect(200);
    expect(settled.body.state).toBe('settled');
    expect(settled.body.confirmed).toBe(true);

    const expected = extendMembershipPeriodByCadence({
      membershipExpiresAt:
        statusBefore.body.membership_expires_at === null
          ? null
          : new Date(statusBefore.body.membership_expires_at),
      cadence: 'monthly',
      now: completedAt,
    });
    expect(settled.body.status.membership_expires_at).toBe(expected.toISOString());
  });

  it('accepts a signed webhook for a settled checkout without adding time', async () => {
    const account = await createAccount();
    const created = await createCheckout(account).expect(201);
    const receiveRequestId = strikeFake.lastReceiveRequestId;
    strikeFake.completedAt = new Date().toISOString();
    strikeFake.completedIds.add(receiveRequestId);

    const settled = await request(app)
      .get(`${base}/billing/strike/checkouts/${created.body.checkout_id}`)
      .set(account.headers)
      .expect(200);
    expect(settled.body.state).toBe('settled');
    const expiry = settled.body.status.membership_expires_at;

    const eventId = `evt-vitest-${runId}-${account.id}`;
    const payload = JSON.stringify({
      id: eventId,
      eventType: 'receive-request.receive-completed',
      webhookVersion: 'v1',
      created: new Date().toISOString(),
      data: { entityId: receiveRequestId },
    });
    const signature = createHmac('sha256', STRIKE_ENV.STRIKE_WEBHOOK_SECRET)
      .update(payload)
      .digest('hex');
    await signWebhook(payload, signature).expect(200);

    const status = await request(app)
      .get(`${base}/billing/status`)
      .set(account.headers)
      .expect(200);
    expect(status.body.membership_expires_at).toBe(expiry);

    const grants = await query(
      `SELECT COUNT(*)::int AS count FROM billing_membership_grant g
       JOIN billing_transaction t ON t.id = g.billing_transaction_id
       WHERE t.processor_id = 'strike' AND t.external_transaction_id = $1`,
      [receiveRequestId]
    );
    expect(rowCount(grants)).toBe(1);
    const inbox = await query(
      `SELECT COUNT(*)::int AS count FROM billing_webhook_event
       WHERE processor_id = 'strike' AND external_event_id = $1`,
      [eventId]
    );
    expect(rowCount(inbox)).toBe(1);
  });

  it('answers 400 for a bad signature and stores nothing', async () => {
    const eventId = `evt-bad-${runId}`;
    const payload = JSON.stringify({
      id: eventId,
      eventType: 'receive-request.receive-completed',
      webhookVersion: 'v1',
      created: new Date().toISOString(),
      data: { entityId: `rr-missing-${runId}` },
    });
    const signature = createHmac('sha256', STRIKE_ENV.STRIKE_WEBHOOK_SECRET)
      .update(payload)
      .digest('hex');
    const badSignature = signature.startsWith('a')
      ? `b${signature.slice(1)}`
      : `a${signature.slice(1)}`;
    const res = await signWebhook(payload, badSignature).expect(400);
    expect(res.body.code).toBe(BILLING_API_ERROR_CODES.webhookVerificationFailed);

    const inbox = await query(
      `SELECT COUNT(*)::int AS count FROM billing_webhook_event
       WHERE processor_id = 'strike' AND external_event_id = $1`,
      [eventId]
    );
    expect(rowCount(inbox)).toBe(0);
  });

  it('answers 404 when another account polls the checkout', async () => {
    const owner = await createAccount();
    const other = await createAccount();
    const created = await createCheckout(owner).expect(201);
    const res = await request(app)
      .get(`${base}/billing/strike/checkouts/${created.body.checkout_id}`)
      .set(other.headers)
      .expect(404);
    expect(res.body.code).toBe(BILLING_API_ERROR_CODES.purchaseNotFound);
  });

  it('answers 404 for ios and stores no session', async () => {
    const account = await createAccount();
    const res = await createCheckout(account, 'ios').expect(404);
    expect(res.body.code).toBe(BILLING_API_ERROR_CODES.productUnavailable);
    const rows = await query(
      `SELECT COUNT(*)::int AS count FROM billing_checkout_session
       WHERE account_id = $1 AND processor_id = 'strike'`,
      [account.id]
    );
    expect(rowCount(rows)).toBe(0);
  });

  it('answers 404 while the foss channel is disabled and 201 after it is enabled', async () => {
    const account = await createAccount();
    await query(
      `UPDATE billing_checkout_channel SET enabled = FALSE
       WHERE processor_id = 'strike' AND platform = 'foss'`
    );
    await clearChannelCache();
    try {
      const disabled = await createCheckout(account, 'foss').expect(404);
      expect(disabled.body.code).toBe(BILLING_API_ERROR_CODES.productUnavailable);
      const hidden = await query(
        `SELECT COUNT(*)::int AS count FROM billing_checkout_session
         WHERE account_id = $1 AND processor_id = 'strike'`,
        [account.id]
      );
      expect(rowCount(hidden)).toBe(0);
    } finally {
      await query(
        `UPDATE billing_checkout_channel SET enabled = TRUE
         WHERE processor_id = 'strike' AND platform = 'foss'`
      );
      await clearChannelCache();
    }

    const enabled = await createCheckout(account, 'foss').expect(201);
    expect(enabled.body.state).toBe('unpaid');
  });

  it('answers 404 when Strike is disabled', async () => {
    const { initBillingContext } = await import('../lib/billing/billingContext.js');
    const { readBillingProcessorEnv } = await import('@podverse/helpers-config');
    const { config } = await import('../config/index.js');
    const savedFlag = process.env.BILLING_STRIKE_ENABLED;
    delete process.env.BILLING_STRIKE_ENABLED;
    const restore = (): void => {
      if (savedFlag === undefined) {
        delete process.env.BILLING_STRIKE_ENABLED;
      } else {
        process.env.BILLING_STRIKE_ENABLED = savedFlag;
      }
      initBillingContext({
        nodeEnv: config.nodeEnv,
        allowTestAdapter: config.billing.allowTestAdapter,
        sandboxAllowedAccountIds: config.billing.sandboxAllowedAccountIds,
        grantAllSandboxPurchases: config.billing.grantAllSandboxPurchases,
        processors: readBillingProcessorEnv(process.env),
      });
    };

    initBillingContext({
      nodeEnv: config.nodeEnv,
      allowTestAdapter: config.billing.allowTestAdapter,
      sandboxAllowedAccountIds: config.billing.sandboxAllowedAccountIds,
      grantAllSandboxPurchases: config.billing.grantAllSandboxPurchases,
      processors: readBillingProcessorEnv(process.env),
    });
    await clearChannelCache();
    try {
      const account = await createAccount();
      const res = await createCheckout(account).expect(404);
      expect(res.body.code).toBe(BILLING_API_ERROR_CODES.processorUnavailable);
    } finally {
      restore();
      await clearChannelCache();
    }
  });
});
