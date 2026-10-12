import { beforeEach, describe, expect, it, vi } from 'vitest';

import { BillingProcessorRecordNotFoundError } from '@podverse/helpers';

import { StrikeApiError, StrikeClient } from './StrikeClient.js';

const fetchWithTimeoutMock = vi.hoisted(() => vi.fn());

vi.mock('@podverse/helpers-backend', () => ({
  fetchWithTimeout: fetchWithTimeoutMock,
}));

describe('StrikeClient', () => {
  beforeEach(() => {
    fetchWithTimeoutMock.mockReset();
  });

  it('creates a receive request and reads bolt11 checkout fields', async () => {
    fetchWithTimeoutMock.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          receiveRequestId: 'cdb683f9-2f31-45e5-b6f8-e0f3790f38a0',
          created: '2026-10-11T23:00:00.000Z',
          targetCurrency: 'USD',
          bolt11: {
            invoice: 'lnbc10u1pnexampleinvoice',
            expires: '2026-10-11T23:15:00.000Z',
            requestedAmount: {
              amount: '10.00',
              currency: 'USD',
            },
          },
        }),
        {
          status: 201,
          headers: { 'content-type': 'application/json' },
        }
      )
    );

    const client = new StrikeClient({
      apiKey: 'strike-api-key',
      environment: 'sandbox',
      timeoutMs: 1500,
    });

    const checkout = await client.createReceiveRequest({
      amount: '10.00',
      currency: 'USD',
      description: 'Premium membership',
      expiryInSeconds: 900,
    });

    expect(checkout).toEqual({
      receiveRequestId: 'cdb683f9-2f31-45e5-b6f8-e0f3790f38a0',
      bolt11: 'lnbc10u1pnexampleinvoice',
      expiresAt: '2026-10-11T23:15:00.000Z',
    });
    expect(fetchWithTimeoutMock).toHaveBeenCalledWith(
      'https://api.dev.strike.me/v1/receive-requests',
      expect.objectContaining({
        method: 'POST',
        timeoutMs: 1500,
      })
    );
  });

  it('throws BillingProcessorRecordNotFoundError on a 404 receive request lookup', async () => {
    fetchWithTimeoutMock.mockResolvedValueOnce(
      new Response('', { status: 404, headers: { 'content-type': 'application/json' } })
    );

    const client = new StrikeClient({
      apiKey: 'strike-api-key',
      environment: 'production',
    });

    await expect(client.getReceiveRequest('missing-request')).rejects.toBeInstanceOf(
      BillingProcessorRecordNotFoundError
    );
  });

  it('throws StrikeApiError for non-2xx responses without leaking API keys', async () => {
    const apiKey = 'sk_live_super_secret';
    fetchWithTimeoutMock.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          data: {
            code: 'FORBIDDEN',
            message: 'Insufficient permissions',
            status: 403,
          },
        }),
        { status: 403, headers: { 'content-type': 'application/json' } }
      )
    );

    const client = new StrikeClient({
      apiKey,
      environment: 'production',
    });

    let thrown: unknown;
    try {
      await client.listSubscriptions();
    } catch (error) {
      thrown = error;
    }

    expect(thrown).toBeInstanceOf(StrikeApiError);
    if (!(thrown instanceof StrikeApiError)) {
      throw new Error('Expected StrikeApiError');
    }
    expect(thrown.code).toBe('FORBIDDEN');
    expect(thrown.message).toContain('status 403');
    expect(thrown.message).toContain('FORBIDDEN');
    expect(thrown.message).not.toContain(apiKey);
  });
});
