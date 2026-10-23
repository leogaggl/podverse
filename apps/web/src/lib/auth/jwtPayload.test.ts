import { describe, expect, it } from 'vitest';

import { decodeJwtPayloadUnverified } from './jwtPayload';

function base64Url(value: string): string {
  return Buffer.from(value, 'utf8').toString('base64url');
}

function tokenWithPayloadSegment(payloadSegment: string): string {
  return `${base64Url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }))}.${payloadSegment}.signature`;
}

function tokenWithPayload(payload: unknown): string {
  return tokenWithPayloadSegment(base64Url(JSON.stringify(payload)));
}

describe('decodeJwtPayloadUnverified', () => {
  it('decodes the payload of a three-part token', () => {
    const payload = { id: 7, id_text: 'abcdefghi', sid: 'sessionid1', token_use: 'web', iat: 100 };
    expect(decodeJwtPayloadUnverified(tokenWithPayload(payload))).toEqual(payload);
  });

  it('decodes base64url characters and segments with no padding', () => {
    const underscorePayload = { sid: 's', v: '??~~' };
    const underscoreSegment = base64Url(JSON.stringify(underscorePayload));
    expect(underscoreSegment).toContain('_');
    expect(underscoreSegment.length % 4).not.toBe(0);
    expect(decodeJwtPayloadUnverified(tokenWithPayloadSegment(underscoreSegment))).toEqual(
      underscorePayload
    );

    const dashPayload = { sid: 's', v: '?~?~x' };
    const dashSegment = base64Url(JSON.stringify(dashPayload));
    expect(dashSegment).toContain('-');
    expect(dashSegment.length % 4).not.toBe(0);
    expect(decodeJwtPayloadUnverified(tokenWithPayloadSegment(dashSegment))).toEqual(dashPayload);
  });

  it('decodes non-ASCII claims', () => {
    const payload = { sid: 'sessionid1', name: 'Zoë ☕ Ελληνικά' };
    expect(decodeJwtPayloadUnverified(tokenWithPayload(payload))).toEqual(payload);
  });

  it('returns null for malformed tokens and non-object payloads', () => {
    const header = base64Url(JSON.stringify({ alg: 'HS256' }));
    expect(decodeJwtPayloadUnverified(`${header}.${base64Url('{"sid":"s"}')}`)).toBeNull();
    expect(decodeJwtPayloadUnverified(tokenWithPayloadSegment('%%%not-base64%%%'))).toBeNull();
    expect(decodeJwtPayloadUnverified(tokenWithPayloadSegment(base64Url('{not json')))).toBeNull();
    expect(decodeJwtPayloadUnverified(tokenWithPayload(['sid', 'value']))).toBeNull();
    expect(decodeJwtPayloadUnverified(tokenWithPayload(null))).toBeNull();
  });
});
