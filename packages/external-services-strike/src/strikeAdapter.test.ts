import { createHmac } from 'node:crypto';

import { describe, expect, it, vi } from 'vitest';

import type { StrikeClientLike } from './strikeAdapter.js';
import { createStrikeAdapter } from './strikeAdapter.js';
import type { StrikeReceive } from './StrikeClient.js';

const WEBHOOK_SECRET = 'secret-1234567890';
const RECEIVE_REQUEST_ID = '602cc206-6b4a-42dd-bc89-9a534bb04034';
const WEBHOOK_EVENT_ID = '245e40d8-f197-411c-8f20-a326d08da402';

function createWebhookBody() {
  return JSON.stringify({
    id: WEBHOOK_EVENT_ID,
    eventType: 'receive-request.receive-completed',
    webhookVersion: 'v1',
    data: {
      entityId: RECEIVE_REQUEST_ID,
      receiveId: 'fb6e95ce-1305-4efe-bf50-ff3115b8e0af',
    },
    created: '2026-10-11T23:00:00.000Z',
  });
}

function sign(body: string): string {
  return createHmac('sha256', WEBHOOK_SECRET).update(body, 'utf8').digest('hex');
}

function createClient(params?: { receives?: StrikeReceive[] }) {
  const receives = params?.receives ?? [
    {
      receiveId: 'fb6e95ce-1305-4efe-bf50-ff3115b8e0af',
      receiveRequestId: RECEIVE_REQUEST_ID,
      state: 'COMPLETED',
      amountReceived: { amount: '0.00009771', currency: 'BTC' },
      amountCredited: { amount: '3.00', currency: 'USD' },
      created: '2026-10-11T23:01:00.000Z',
      completed: '2026-10-11T23:01:15.000Z',
    },
  ];

  const client: StrikeClientLike = {
    createReceiveRequest: vi.fn(async () => ({
      receiveRequestId: RECEIVE_REQUEST_ID,
      bolt11: 'lnbc10u1pnexampleinvoice',
      expiresAt: '2026-10-11T23:15:00.000Z',
    })),
    listReceives: vi.fn(async () => receives),
  };

  return client;
}

describe('createStrikeAdapter', () => {
  it('maps a receive-completed webhook to one payment_settled event', async () => {
    const client = createClient();
    const adapter = createStrikeAdapter({
      client,
      webhookSecret: WEBHOOK_SECRET,
      environment: 'sandbox',
      findCheckoutSession: async () => ({
        accountId: 55,
        externalProductId: 'podverse-premium-monthly',
        amount: '3.00',
        currencyCode: 'USD',
      }),
    });
    const rawBody = createWebhookBody();

    const result = await adapter.verifyAndParseWebhook({
      rawBody,
      headers: {
        'x-webhook-signature': sign(rawBody),
      },
    });

    expect(result.events).toEqual([
      {
        type: 'payment_settled',
        processor: 'strike',
        processorEventId: WEBHOOK_EVENT_ID,
        accountBillingCustomerRef: null,
        accountId: 55,
        occurredAt: '2026-10-11T23:01:15.000Z',
        isSandbox: true,
        externalTransactionId: RECEIVE_REQUEST_ID,
        externalProductId: 'podverse-premium-monthly',
        externalBasePlanId: null,
        periodStart: null,
        periodEnd: null,
        amount: {
          value: '3.00',
          currencyCode: 'USD',
        },
      },
    ]);
  });

  it('uses the same processor event id when the same webhook is delivered twice', async () => {
    const client = createClient();
    const adapter = createStrikeAdapter({
      client,
      webhookSecret: WEBHOOK_SECRET,
      environment: 'sandbox',
      findCheckoutSession: async () => ({
        accountId: 55,
        externalProductId: 'podverse-premium-monthly',
        amount: '3.00',
        currencyCode: 'USD',
      }),
    });
    const rawBody = createWebhookBody();
    const request = {
      rawBody,
      headers: {
        'x-webhook-signature': sign(rawBody),
      },
    };

    const first = await adapter.verifyAndParseWebhook(request);
    const second = await adapter.verifyAndParseWebhook(request);

    expect(first.events[0]?.processorEventId).toBe(WEBHOOK_EVENT_ID);
    expect(second.events[0]?.processorEventId).toBe(WEBHOOK_EVENT_ID);
  });

  it('returns no settlement event when receives are still pending', async () => {
    const client = createClient({
      receives: [
        {
          receiveId: 'fb6e95ce-1305-4efe-bf50-ff3115b8e0af',
          receiveRequestId: RECEIVE_REQUEST_ID,
          state: 'PENDING',
          amountReceived: { amount: '0.00009771', currency: 'BTC' },
          amountCredited: null,
          created: '2026-10-11T23:01:00.000Z',
          completed: null,
        },
      ],
    });
    const adapter = createStrikeAdapter({
      client,
      webhookSecret: WEBHOOK_SECRET,
      environment: 'sandbox',
      findCheckoutSession: async () => ({
        accountId: 55,
        externalProductId: 'podverse-premium-monthly',
        amount: '3.00',
        currencyCode: 'USD',
      }),
    });
    const rawBody = createWebhookBody();

    const result = await adapter.verifyAndParseWebhook({
      rawBody,
      headers: {
        'x-webhook-signature': sign(rawBody),
      },
    });

    expect(result.events).toEqual([]);
    await expect(adapter.readCheckoutState(RECEIVE_REQUEST_ID)).resolves.toBe('pending');
  });

  it('returns no events when no checkout session matches the receive request id', async () => {
    const client = createClient();
    const adapter = createStrikeAdapter({
      client,
      webhookSecret: WEBHOOK_SECRET,
      environment: 'sandbox',
      findCheckoutSession: async () => null,
    });
    const rawBody = createWebhookBody();

    const result = await adapter.verifyAndParseWebhook({
      rawBody,
      headers: {
        'x-webhook-signature': sign(rawBody),
      },
    });

    expect(result.events).toEqual([]);
  });
});
