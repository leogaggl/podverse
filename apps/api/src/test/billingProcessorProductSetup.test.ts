import type { Server } from 'http';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import {
  AppStoreServerClient,
  createAppleAdapter,
} from '@podverse/external-services-apple-app-store';
import type { ORMContext } from '@podverse/orm';

import { startTestApp, stopTestApp } from './helpers/index.js';

const APPLE_PRODUCT_ID = 'com.podverse.test.billing-setup.monthly';
const GOOGLE_PRODUCT_ID = 'com.podverse.test.billing-setup.google';
const GOOGLE_BASE_PLAN_ID = 'prepaid-setup';

describe('billing setup without management', () => {
  let server: Server | undefined;
  let ormContext: ORMContext | undefined;

  beforeAll(async () => {
    const started = await startTestApp();
    server = started.server;
    ormContext = started.ormContext;
  }, 30000);

  afterAll(async () => {
    if (ormContext !== undefined) {
      await ormContext.dataSourceReadWrite.query(
        `DELETE FROM billing_processor_product WHERE external_product_id = ANY($1)`,
        [[APPLE_PRODUCT_ID, GOOGLE_PRODUCT_ID]]
      );
    }
    await stopTestApp(server, ormContext);
  });

  const query = async (sql: string, params: unknown[] = []): Promise<unknown> => {
    if (ormContext === undefined) {
      throw new Error('ORM context is not initialized');
    }
    return ormContext.dataSourceReadWrite.query(sql, params);
  };

  it('adds a processor product once and does not reactivate or edit it', async () => {
    const { BillingProcessorProductService } = await import('@podverse/orm');
    const service = new BillingProcessorProductService();
    const created = await service.addPremiumProcessorProductIfMissing({
      processorId: 'google_play',
      externalProductId: GOOGLE_PRODUCT_ID,
      externalBasePlanId: GOOGLE_BASE_PLAN_ID,
      cadence: 'monthly',
    });
    expect(created.created).toBe(true);
    expect(created.row.is_active).toBe(true);

    await query(
      `UPDATE billing_processor_product
       SET is_active = FALSE, billing_cadence = 'annual'
       WHERE id = $1`,
      [created.row.id]
    );

    const again = await service.addPremiumProcessorProductIfMissing({
      processorId: 'google_play',
      externalProductId: GOOGLE_PRODUCT_ID,
      externalBasePlanId: GOOGLE_BASE_PLAN_ID,
      cadence: 'monthly',
    });
    expect(again.created).toBe(false);
    expect(again.row.id).toBe(created.row.id);
    expect(again.row.is_active).toBe(false);
    expect(again.row.billing_cadence).toBe('annual');
  });

  it('enables a checkout channel without turning it off again', async () => {
    const { BillingCheckoutChannelService } = await import('@podverse/orm');
    const service = new BillingCheckoutChannelService();
    const existing = await service.getChannel('apple', 'ios');
    expect(existing).not.toBeNull();
    if (existing === null) {
      return;
    }
    const originalEnabled = existing.enabled;
    try {
      await service.updateById(existing.id, { enabled: false });
      const enabled = await service.enableIfDisabled('apple', 'ios');
      expect(enabled?.changed).toBe(true);
      expect(enabled?.channel.enabled).toBe(true);

      const second = await service.enableIfDisabled('apple', 'ios');
      expect(second?.changed).toBe(false);
      expect(second?.channel.enabled).toBe(true);
    } finally {
      await service.updateById(existing.id, { enabled: originalEnabled });
    }
  });

  it('accepts an Apple purchase mapped only in the database', async () => {
    const { BillingProcessorProductService } = await import('@podverse/orm');
    const { isMappedBillingProduct } = await import('@podverse/billing');
    const service = new BillingProcessorProductService();
    await service.addPremiumProcessorProductIfMissing({
      processorId: 'apple',
      externalProductId: APPLE_PRODUCT_ID,
      externalBasePlanId: null,
      cadence: 'monthly',
    });

    const client = new AppStoreServerClient({
      issuerId: 'issuer-id',
      keyId: 'ABC123DEF4',
      privateKey: 'private-key',
      bundleId: 'com.podverse.app.next',
      runtimeEnvironment: 'sandbox',
      sandboxClient: {
        getTransactionInfo: async () => ({ signedTransactionInfo: 'signed-transaction' }),
        requestTestNotification: async () => ({ testNotificationToken: 'token' }),
      },
      sandboxVerifier: {
        verifyAndDecodeNotification: async () => ({
          notificationType: 'ONE_TIME_CHARGE',
          notificationUUID: 'notification-setup-1',
          signedDate: 1_727_100_000_000,
          data: { signedTransactionInfo: 'signed-transaction' },
        }),
        verifyAndDecodeTransaction: async () => ({
          productId: APPLE_PRODUCT_ID,
          transactionId: '1000000999999001',
          type: 'Non-Renewing Subscription',
          purchaseDate: 1_727_100_000_000,
        }),
      },
    });
    const adapter = createAppleAdapter({
      issuerId: 'issuer-id',
      keyId: 'ABC123DEF4',
      privateKeyPath: '/tmp/example.p8',
      bundleId: 'com.podverse.app.next',
      client,
      isMappedProduct: isMappedBillingProduct,
    });

    const sold = await adapter.verifyAndParseWebhook({
      rawBody: JSON.stringify({ signedPayload: 'header.payload.signature' }),
      headers: {},
    });
    expect(sold.events).toHaveLength(1);
    expect(sold.events[0]?.type).toBe('payment_settled');
    const settled = sold.events[0];
    if (settled?.type === 'payment_settled') {
      expect(settled.externalProductId).toBe(APPLE_PRODUCT_ID);
    }

    const unmappedClient = new AppStoreServerClient({
      issuerId: 'issuer-id',
      keyId: 'ABC123DEF4',
      privateKey: 'private-key',
      bundleId: 'com.podverse.app.next',
      runtimeEnvironment: 'sandbox',
      sandboxClient: {
        getTransactionInfo: async () => ({ signedTransactionInfo: 'signed-transaction' }),
        requestTestNotification: async () => ({ testNotificationToken: 'token' }),
      },
      sandboxVerifier: {
        verifyAndDecodeNotification: async () => ({
          notificationType: 'ONE_TIME_CHARGE',
          notificationUUID: 'notification-setup-2',
          signedDate: 1_727_100_000_000,
          data: { signedTransactionInfo: 'signed-transaction' },
        }),
        verifyAndDecodeTransaction: async () => ({
          productId: 'com.podverse.test.billing-setup.unknown',
          transactionId: '1000000999999002',
          type: 'Non-Renewing Subscription',
          purchaseDate: 1_727_100_000_000,
        }),
      },
    });
    const unmapped = await createAppleAdapter({
      issuerId: 'issuer-id',
      keyId: 'ABC123DEF4',
      privateKeyPath: '/tmp/example.p8',
      bundleId: 'com.podverse.app.next',
      client: unmappedClient,
      isMappedProduct: isMappedBillingProduct,
    }).verifyAndParseWebhook({
      rawBody: JSON.stringify({ signedPayload: 'header.payload.signature' }),
      headers: {},
    });
    expect(unmapped.events).toEqual([]);

    await query(
      `UPDATE billing_processor_product SET is_active = FALSE WHERE external_product_id = $1`,
      [APPLE_PRODUCT_ID]
    );
    const retired = await adapter.verifyAndParseWebhook({
      rawBody: JSON.stringify({ signedPayload: 'header.payload.signature' }),
      headers: {},
    });
    expect(retired.events).toHaveLength(1);
  });
});
