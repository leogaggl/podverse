import { createHmac } from 'node:crypto';

import { describe, expect, it } from 'vitest';

import { verifyAndParseStrikeWebhook } from './verifyWebhook.js';

const WEBHOOK_SECRET = 'secret-1234567890';
const WEBHOOK_BODY = JSON.stringify({
  id: '245e40d8-f197-411c-8f20-a326d08da402',
  eventType: 'receive-request.receive-completed',
  webhookVersion: 'v1',
  data: {
    entityId: '602cc206-6b4a-42dd-bc89-9a534bb04034',
    receiveId: 'fb6e95ce-1305-4efe-bf50-ff3115b8e0af',
  },
  created: '2009-01-03T17:15:00+00:00',
});

function sign(rawBody: string): string {
  return createHmac('sha256', WEBHOOK_SECRET).update(rawBody, 'utf8').digest('hex');
}

describe('verifyAndParseStrikeWebhook', () => {
  it('accepts a valid signed webhook payload', () => {
    const parsed = verifyAndParseStrikeWebhook({
      rawBody: WEBHOOK_BODY,
      secret: WEBHOOK_SECRET,
      headers: {
        'x-webhook-signature': sign(WEBHOOK_BODY),
      },
    });

    expect(parsed.id).toBe('245e40d8-f197-411c-8f20-a326d08da402');
    expect(parsed.entityId).toBe('602cc206-6b4a-42dd-bc89-9a534bb04034');
    expect(parsed.receiveId).toBe('fb6e95ce-1305-4efe-bf50-ff3115b8e0af');
  });

  it('rejects a payload with one changed byte', () => {
    const tamperedBody = WEBHOOK_BODY.replace('completed', 'pending');

    expect(() =>
      verifyAndParseStrikeWebhook({
        rawBody: tamperedBody,
        secret: WEBHOOK_SECRET,
        headers: {
          'x-webhook-signature': sign(WEBHOOK_BODY),
        },
      })
    ).toThrow('Invalid Strike webhook signature');
  });

  it('rejects a wrong-length signature', () => {
    expect(() =>
      verifyAndParseStrikeWebhook({
        rawBody: WEBHOOK_BODY,
        secret: WEBHOOK_SECRET,
        headers: {
          'x-webhook-signature': 'abc',
        },
      })
    ).toThrow('Invalid Strike webhook signature');
  });
});
