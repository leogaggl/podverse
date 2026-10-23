import { afterEach, describe, expect, it, vi } from 'vitest';

import { ACCOUNT_SESSION_RENEW_INTERVAL_MS } from '@podverse/helpers';

import {
  fetchWebSessionRenewal,
  isWebSessionRenewalDue,
  readSetCookieValue,
  replaceCookieInHeader,
} from './webSessionRenewal';

const NOW_MS = Date.UTC(2026, 9, 22, 12, 0, 0);
const API_BASE = 'http://localhost:4030/api/v2';
const CLEARED_JWT = 'jwt=; Path=/; Expires=Thu, 01 Jan 1970 00:00:00 GMT';

function tokenWithPayload(payload: Record<string, unknown>): string {
  const segment = (value: unknown) => Buffer.from(JSON.stringify(value)).toString('base64url');
  return `${segment({ alg: 'HS256', typ: 'JWT' })}.${segment(payload)}.signature`;
}

function responseWithSetCookies(setCookies: string[]): Response {
  const headers = new Headers();
  for (const setCookie of setCookies) {
    headers.append('set-cookie', setCookie);
  }
  return new Response(null, { status: 200, headers });
}

describe('isWebSessionRenewalDue', () => {
  const sessionClaims = { id: 7, id_text: 'abcdefghi', sid: 'sessionid1', token_use: 'web' };

  it('is not due for a token renewed moments ago', () => {
    const token = tokenWithPayload({ ...sessionClaims, iat: Math.floor(NOW_MS / 1000) - 60 });
    expect(isWebSessionRenewalDue(token, NOW_MS)).toBe(false);
  });

  it('is due once a full renew interval has passed since iat', () => {
    const iat = Math.floor(NOW_MS / 1000);
    const token = tokenWithPayload({ ...sessionClaims, iat });
    expect(isWebSessionRenewalDue(token, iat * 1000 + ACCOUNT_SESSION_RENEW_INTERVAL_MS)).toBe(
      true
    );
  });

  it('is due when the token carries no iat', () => {
    expect(isWebSessionRenewalDue(tokenWithPayload(sessionClaims), NOW_MS)).toBe(true);
  });

  it('is never due for a token with no session id, or one that does not decode', () => {
    const noSid = tokenWithPayload({ id: 7, id_text: 'abcdefghi', iat: 1 });
    expect(isWebSessionRenewalDue(noSid, NOW_MS)).toBe(false);
    expect(isWebSessionRenewalDue('not-a-jwt', NOW_MS)).toBe(false);
  });
});

describe('readSetCookieValue', () => {
  it('reads a renewed jwt value', () => {
    expect(
      readSetCookieValue(['jwt=new.token.value; Max-Age=31536000; Path=/; HttpOnly'], 'jwt')
    ).toBe('new.token.value');
  });

  it('returns null for a cleared cookie or a different cookie name', () => {
    expect(readSetCookieValue([CLEARED_JWT], 'jwt')).toBeNull();
    expect(readSetCookieValue(['local-settings=abc; Path=/'], 'jwt')).toBeNull();
  });

  it('returns the last value when the cookie is set twice', () => {
    expect(readSetCookieValue(['jwt=first; Path=/', 'jwt=second; Path=/'], 'jwt')).toBe('second');
  });
});

describe('replaceCookieInHeader', () => {
  it('replaces the named cookie in place and keeps the other pairs in order', () => {
    expect(replaceCookieInHeader('theme=dark; jwt=old; local-settings=x', 'jwt', 'new')).toBe(
      'theme=dark; jwt=new; local-settings=x'
    );
  });

  it('appends the cookie when the header does not carry it', () => {
    expect(replaceCookieInHeader('theme=dark', 'jwt', 'new')).toBe('theme=dark; jwt=new');
    expect(replaceCookieInHeader('', 'jwt', 'new')).toBe('jwt=new');
  });

  it('keeps other values that contain an equals sign', () => {
    expect(replaceCookieInHeader('prefs=a=b==; jwt=old', 'jwt', 'new')).toBe(
      'prefs=a=b==; jwt=new'
    );
  });
});

describe('fetchWebSessionRenewal', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns every Set-Cookie value and the renewed token, and sends the cookie header', async () => {
    const renewal = 'jwt=renewed.token.value; Max-Age=31536000; Path=/; HttpOnly; SameSite=Strict';
    const fetchSpy = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(responseWithSetCookies([renewal]));

    const result = await fetchWebSessionRenewal({
      apiBase: API_BASE,
      cookieHeader: 'theme=dark; jwt=old.token.value',
    });

    expect(result).toEqual({ setCookies: [renewal], renewedToken: 'renewed.token.value' });
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const [url, init] = fetchSpy.mock.calls[0] ?? [];
    expect(url).toBe(`${API_BASE}/auth/check-session`);
    expect(new Headers(init?.headers).get('cookie')).toBe('theme=dark; jwt=old.token.value');
  });

  it('forwards a clear with no renewed token', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(responseWithSetCookies([CLEARED_JWT]));
    await expect(
      fetchWebSessionRenewal({ apiBase: API_BASE, cookieHeader: 'jwt=old' })
    ).resolves.toEqual({ setCookies: [CLEARED_JWT], renewedToken: null });
  });

  it('returns null when the API sets no cookie', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(responseWithSetCookies([]));
    await expect(
      fetchWebSessionRenewal({ apiBase: API_BASE, cookieHeader: 'jwt=old' })
    ).resolves.toBeNull();
  });

  it('returns null when the request fails', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('network down'));
    await expect(
      fetchWebSessionRenewal({ apiBase: API_BASE, cookieHeader: 'jwt=old' })
    ).resolves.toBeNull();
  });
});
