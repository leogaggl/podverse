import { app } from '@management-api/app.js';
import { config } from '@management-api/config/index.js';
import { initManagementBillingContext } from '@management-api/lib/billing/billingContext.js';
import jwt from 'jsonwebtoken';
import request from 'supertest';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import { createORMContext } from '@podverse/orm';

const JWT_SECRET = process.env.AUTH_JWT_SECRET ?? '';
const basePath = `${config.api.prefix}${config.api.version}/billing`;

const superuser = {
  id: 1,
  id_text: 'pvMgtSu001',
  admin_account_role_id: 1,
  admin_account_role: { role: 'superuser' },
  admin_account_credentials: { email: 'super@example.com' },
  permissions: null,
  created_at: new Date('2020-01-01T00:00:00.000Z'),
};

const noChannelRead = {
  id: 3,
  id_text: 'pvMgtAd003',
  admin_account_role_id: 2,
  admin_account_role: { role: 'admin' },
  admin_account_credentials: { email: 'no-channels@example.com' },
  permissions: {
    feedsCrud: 0,
    feedTakedownReasonsCrud: 0,
    adminsCrud: 0,
    statsCrud: 0,
    billingPricesCrud: 0,
    bucketCrud: 0,
    embedDemoCrud: 0,
    notificationsCrud: 0,
    billingChannelsCrud: 0,
    billingProcessorProductsCrud: 0,
    billingAccountCrud: 0,
    billingWebhookEventsCrud: 0,
  },
  created_at: new Date('2020-01-01T00:00:00.000Z'),
};

const reader = {
  id: 2,
  id_text: 'pvMgtAd002',
  admin_account_role_id: 2,
  admin_account_role: { role: 'admin' },
  admin_account_credentials: { email: 'reader@example.com' },
  permissions: {
    feedsCrud: 0,
    feedTakedownReasonsCrud: 0,
    adminsCrud: 0,
    statsCrud: 0,
    billingPricesCrud: 0,
    bucketCrud: 0,
    embedDemoCrud: 0,
    notificationsCrud: 0,
    billingChannelsCrud: 2,
    billingProcessorProductsCrud: 0,
    billingAccountCrud: 0,
    billingWebhookEventsCrud: 0,
  },
  created_at: new Date('2020-01-01T00:00:00.000Z'),
};

const channel = {
  id: 7,
  processor_id: 'paypal',
  platform: 'ios',
  storefront_allowlist: [] as string[],
  enabled: true,
  min_client_version: null as string | null,
  updated_at: new Date('2026-01-01T00:00:00.000Z'),
};

const {
  getWithRoleAndPermissionsMock,
  listChannelsMock,
  getChannelMock,
  updateChannelMock,
  auditRecordMock,
} = vi.hoisted(() => ({
  getWithRoleAndPermissionsMock: vi.fn(async (id: number) => {
    if (id === 1) {
      return superuser;
    }
    if (id === 2) {
      return reader;
    }
    if (id === 3) {
      return noChannelRead;
    }
    return null;
  }),
  listChannelsMock: vi.fn(async () => [channel]),
  getChannelMock: vi.fn(async (id: number) => (id === channel.id ? { ...channel } : null)),
  updateChannelMock: vi.fn(
    async (
      id: number,
      params: {
        enabled?: boolean;
        minClientVersion?: string | null;
        storefrontAllowlist?: string[];
      }
    ) => ({
      ...channel,
      id,
      enabled: params.enabled ?? channel.enabled,
      min_client_version:
        params.minClientVersion === undefined
          ? channel.min_client_version
          : params.minClientVersion,
      storefront_allowlist: params.storefrontAllowlist ?? channel.storefront_allowlist,
    })
  ),
  auditRecordMock: vi.fn(async () => undefined),
}));

vi.mock('@management-api/orm/services/adminAccount.js', () => {
  class AdminAccountService {
    async getWithRoleAndPermissions(id: number) {
      return getWithRoleAndPermissionsMock(id);
    }
  }
  return { AdminAccountService };
});

vi.mock('@podverse/orm', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@podverse/orm')>();

  class BillingCheckoutChannelService {
    async listAll() {
      return listChannelsMock();
    }
    async getById(id: number) {
      return getChannelMock(id);
    }
    async updateById(
      id: number,
      params: {
        enabled?: boolean;
        minClientVersion?: string | null;
        storefrontAllowlist?: string[];
      }
    ) {
      return updateChannelMock(id, params);
    }
  }

  return { ...actual, BillingCheckoutChannelService };
});

vi.mock('@management-api/lib/database/auditLog.js', () => {
  class AuditLogService {
    async record(entry: unknown) {
      return auditRecordMock(entry);
    }
  }
  return { AuditLogService };
});

function bearerFor(id: number, idText: string): { Authorization: string } {
  return {
    Authorization: `Bearer ${jwt.sign({ id, id_text: idText }, JWT_SECRET, { expiresIn: '1h' })}`,
  };
}

const superuserAuthHeaders = (): { Authorization: string } => bearerFor(1, 'pvMgtSu001');

const readerAuthHeaders = (): { Authorization: string } => bearerFor(2, 'pvMgtAd002');

const noChannelReadAuthHeaders = (): { Authorization: string } => bearerFor(3, 'pvMgtAd003');

describe('/billing/checkout-channels', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    channel.processor_id = 'paypal';
    channel.platform = 'ios';
    channel.enabled = true;
    channel.storefront_allowlist = [];
    channel.min_client_version = null;
  });

  it('returns 401 without authentication', async () => {
    const res = await request(app).get(`${basePath}/checkout-channels`).expect(401);
    expect(res.body.message).toBe('Unauthorized');
  });

  it('returns 403 for an admin without channel read', async () => {
    const res = await request(app)
      .get(`${basePath}/checkout-channels`)
      .set(readerAuthHeaders())
      .expect(200);
    expect(res.body.data).toHaveLength(1);

    const denied = await request(app)
      .patch(`${basePath}/checkout-channels/7`)
      .set(readerAuthHeaders())
      .send({ enabled: false })
      .expect(403);
    expect(denied.body.message).toBe('Insufficient permissions');
  });

  it('disables a channel for a superuser', async () => {
    const res = await request(app)
      .patch(`${basePath}/checkout-channels/7`)
      .set(superuserAuthHeaders())
      .send({ enabled: false, min_client_version: '5.6.0' })
      .expect(200);

    expect(updateChannelMock).toHaveBeenCalledWith(7, {
      enabled: false,
      minClientVersion: '5.6.0',
    });
    expect(res.body.data.enabled).toBe(false);
    expect(res.body.data.min_client_version).toBe('5.6.0');
    expect(auditRecordMock).toHaveBeenCalledTimes(1);
  });

  it('returns 400 for a min version that is not a dotted version', async () => {
    const res = await request(app)
      .patch(`${basePath}/checkout-channels/7`)
      .set(superuserAuthHeaders())
      .send({ min_client_version: 'latest' })
      .expect(400);
    expect(typeof res.body.message).toBe('string');
    expect(updateChannelMock).not.toHaveBeenCalled();
  });

  it('rejects an enabled Strike iOS channel with an empty storefront list', async () => {
    channel.processor_id = 'strike';
    channel.platform = 'ios';
    channel.enabled = false;
    channel.storefront_allowlist = [];

    const res = await request(app)
      .patch(`${basePath}/checkout-channels/7`)
      .set(superuserAuthHeaders())
      .send({ enabled: true })
      .expect(422);
    expect(res.body.message).toBe('A store link needs at least one storefront country.');
    expect(updateChannelMock).not.toHaveBeenCalled();
  });

  it('rejects clearing the storefront list on an enabled Strike iOS channel', async () => {
    channel.processor_id = 'strike';
    channel.platform = 'ios';
    channel.enabled = true;
    channel.storefront_allowlist = ['US'];

    const res = await request(app)
      .patch(`${basePath}/checkout-channels/7`)
      .set(superuserAuthHeaders())
      .send({ storefront_allowlist: [] })
      .expect(422);
    expect(res.body.message).toBe('A store link needs at least one storefront country.');
    expect(updateChannelMock).not.toHaveBeenCalled();
  });

  it('enables Strike on iOS when a storefront country is set', async () => {
    channel.processor_id = 'strike';
    channel.platform = 'ios';
    channel.enabled = false;

    const res = await request(app)
      .patch(`${basePath}/checkout-channels/7`)
      .set(superuserAuthHeaders())
      .send({ enabled: true, storefront_allowlist: ['US'] })
      .expect(200);
    expect(res.body.data.storefront_allowlist).toEqual(['US']);
    expect(res.body.data.enabled).toBe(true);
  });

  it('enables Strike on web with an empty storefront list', async () => {
    channel.processor_id = 'strike';
    channel.platform = 'web';
    channel.enabled = false;
    channel.storefront_allowlist = [];

    const res = await request(app)
      .patch(`${basePath}/checkout-channels/7`)
      .set(superuserAuthHeaders())
      .send({ enabled: true })
      .expect(200);
    expect(res.body.data.enabled).toBe(true);
    expect(res.body.data.storefront_allowlist).toEqual([]);
  });

  it('rejects an enabled PayPal Android channel with an empty storefront list', async () => {
    channel.processor_id = 'paypal';
    channel.platform = 'android';
    channel.enabled = false;
    channel.storefront_allowlist = [];

    const res = await request(app)
      .patch(`${basePath}/checkout-channels/7`)
      .set(superuserAuthHeaders())
      .send({ enabled: true })
      .expect(422);
    expect(res.body.message).toBe('A store link needs at least one storefront country.');
    expect(updateChannelMock).not.toHaveBeenCalled();
  });

  it('disables a Strike iOS channel that has an empty storefront list', async () => {
    channel.processor_id = 'strike';
    channel.platform = 'ios';
    channel.enabled = true;
    channel.storefront_allowlist = [];

    const res = await request(app)
      .patch(`${basePath}/checkout-channels/7`)
      .set(superuserAuthHeaders())
      .send({ enabled: false })
      .expect(200);
    expect(res.body.data.enabled).toBe(false);
  });

  it('enables Apple on iOS with an empty storefront list', async () => {
    channel.processor_id = 'apple';
    channel.platform = 'ios';
    channel.enabled = false;
    channel.storefront_allowlist = [];

    const res = await request(app)
      .patch(`${basePath}/checkout-channels/7`)
      .set(superuserAuthHeaders())
      .send({ enabled: true })
      .expect(200);
    expect(res.body.data.enabled).toBe(true);
    expect(res.body.data.storefront_allowlist).toEqual([]);
  });
});

describe('/billing/processors', () => {
  beforeAll(() => {
    createORMContext({
      nodeEnv: config.nodeEnv,
      database: config.appDatabase,
      log: config.log,
      defaults: {
        account: {
          settings: {
            locale: 'en-US',
          },
        },
      },
    });
    initManagementBillingContext({
      nodeEnv: config.nodeEnv,
      allowTestAdapter: config.billing.allowTestAdapter,
      processors: config.billing.processors,
      sandboxAllowedAccountIds: config.billing.sandboxAllowedAccountIds,
    });
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns four processors, each disabled, for a superuser', async () => {
    const res = await request(app)
      .get(`${basePath}/processors`)
      .set(superuserAuthHeaders())
      .expect(200);
    expect(res.body.data).toEqual([
      { processor_id: 'paypal', enabled: false },
      { processor_id: 'apple', enabled: false },
      { processor_id: 'google_play', enabled: false },
      { processor_id: 'strike', enabled: false },
    ]);
  });

  it('returns 403 for an admin without billing channel read', async () => {
    const res = await request(app)
      .get(`${basePath}/processors`)
      .set(noChannelReadAuthHeaders())
      .expect(403);
    expect(res.body.message).toBe('Insufficient permissions');
  });
});
