import { createHmac, timingSafeEqual } from 'node:crypto';

import type { BillingWebhookHeaders } from '@podverse/helpers';

export interface VerifiedStrikeWebhookV1 {
  created: string | null;
  entityId: string;
  eventType: string;
  id: string;
  rawPayload: Record<string, unknown>;
  receiveId: string | null;
}

interface VerifyStrikeWebhookParams {
  headers: BillingWebhookHeaders;
  rawBody: Uint8Array | string;
  secret: string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function readString(record: Record<string, unknown>, key: string): string | null {
  const value = Reflect.get(record, key);
  return typeof value === 'string' && value.length > 0 ? value : null;
}

function readHeader(headers: BillingWebhookHeaders, key: string): string | null {
  const direct = headers[key];
  if (typeof direct === 'string' && direct.length > 0) {
    return direct;
  }
  if (Array.isArray(direct)) {
    for (const value of direct) {
      if (typeof value === 'string' && value.length > 0) {
        return value;
      }
    }
  }
  return null;
}

function toBuffer(rawBody: Uint8Array | string): Buffer {
  return typeof rawBody === 'string' ? Buffer.from(rawBody, 'utf8') : Buffer.from(rawBody);
}

function isSignatureMatch(received: string, expected: string): boolean {
  const receivedBuffer = Buffer.from(received, 'utf8');
  const expectedBuffer = Buffer.from(expected, 'utf8');
  if (receivedBuffer.length !== expectedBuffer.length) {
    return false;
  }
  return timingSafeEqual(receivedBuffer, expectedBuffer);
}

export function verifyAndParseStrikeWebhook(
  params: VerifyStrikeWebhookParams
): VerifiedStrikeWebhookV1 {
  const signature = readHeader(params.headers, 'x-webhook-signature')?.trim();
  if (signature === undefined || signature === '') {
    throw new Error('Missing x-webhook-signature header');
  }

  const rawBody = toBuffer(params.rawBody);
  const expected = createHmac('sha256', params.secret).update(rawBody).digest('hex');
  if (!isSignatureMatch(signature, expected)) {
    throw new Error('Invalid Strike webhook signature');
  }

  let payload: unknown;
  try {
    payload = JSON.parse(rawBody.toString('utf8'));
  } catch {
    throw new Error('Strike webhook body is not valid JSON');
  }

  if (!isRecord(payload)) {
    throw new Error('Strike webhook payload must be a JSON object');
  }
  if (readString(payload, 'webhookVersion') !== 'v1') {
    throw new Error('Unsupported Strike webhook version');
  }

  const id = readString(payload, 'id');
  const eventType = readString(payload, 'eventType');
  const data = Reflect.get(payload, 'data');
  if (id === null || eventType === null || !isRecord(data)) {
    throw new Error('Strike webhook payload is missing required fields');
  }

  const entityId = readString(data, 'entityId');
  if (entityId === null) {
    throw new Error('Strike webhook payload is missing data.entityId');
  }

  return {
    id,
    eventType,
    entityId,
    receiveId: readString(data, 'receiveId'),
    created: readString(payload, 'created'),
    rawPayload: payload,
  };
}
