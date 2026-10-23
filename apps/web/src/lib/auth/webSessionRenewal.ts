/**
 * The API owns web session renewal: it decides when a session is due, touches the session row, and
 * issues the re-signed `jwt` cookie. Server components cannot set cookies, so during a page visit
 * the middleware asks the API and forwards the API's `Set-Cookie` values to the browser unchanged.
 */
import { ACCOUNT_SESSION_RENEW_INTERVAL_MS, AuthCookieName } from '@podverse/helpers';

import { decodeJwtPayloadUnverified } from './jwtPayload';

const RENEWAL_TIMEOUT_MS = 2000;

export type WebSessionRenewal = {
  /** Every `Set-Cookie` value from the API response, unchanged. */
  setCookies: string[];
  /** The new `jwt` value when the API issued one; null when it cleared the cookie or set none. */
  renewedToken: string | null;
};

/**
 * Due when the token names a session and its `iat` (the last renewal the browser holds) is at
 * least one renew interval old, or missing. A token with no session is never due.
 */
export function isWebSessionRenewalDue(token: string, nowMs: number): boolean {
  const payload = decodeJwtPayloadUnverified(token);
  if (payload === null) {
    return false;
  }
  const sid = payload.sid;
  if (typeof sid !== 'string' || sid.length === 0) {
    return false;
  }
  const iat = payload.iat;
  if (typeof iat !== 'number' || !Number.isFinite(iat)) {
    return true;
  }
  return nowMs - iat * 1000 >= ACCOUNT_SESSION_RENEW_INTERVAL_MS;
}

function splitCookiePair(pair: string): { name: string; value: string } | null {
  const separator = pair.indexOf('=');
  if (separator === -1) {
    return null;
  }
  return { name: pair.slice(0, separator).trim(), value: pair.slice(separator + 1).trim() };
}

/** The last value set for `name`; null when that value is empty (a clear) or the name is absent. */
export function readSetCookieValue(setCookies: string[], name: string): string | null {
  let found: string | null = null;
  for (const setCookie of setCookies) {
    const firstSegment = setCookie.split(';')[0] ?? '';
    const pair = splitCookiePair(firstSegment);
    if (pair !== null && pair.name === name) {
      found = pair.value;
    }
  }
  return found !== null && found.length > 0 ? found : null;
}

export function replaceCookieInHeader(cookieHeader: string, name: string, value: string): string {
  let replaced = false;
  const pairs: string[] = [];
  for (const segment of cookieHeader.split(';')) {
    const trimmed = segment.trim();
    if (trimmed.length === 0) {
      continue;
    }
    const pair = splitCookiePair(trimmed);
    if (pair !== null && pair.name === name) {
      pairs.push(`${name}=${value}`);
      replaced = true;
    } else {
      pairs.push(trimmed);
    }
  }
  if (!replaced) {
    pairs.push(`${name}=${value}`);
  }
  return pairs.join('; ');
}

/** Any failure returns null so the page renders without a renewal. */
export async function fetchWebSessionRenewal(params: {
  apiBase: string;
  cookieHeader: string;
}): Promise<WebSessionRenewal | null> {
  try {
    const response = await fetch(`${params.apiBase}/auth/check-session`, {
      headers: { accept: 'application/json', cookie: params.cookieHeader },
      signal: AbortSignal.timeout(RENEWAL_TIMEOUT_MS),
    });
    const setCookies = response.headers.getSetCookie();
    void response.body?.cancel().catch(() => undefined);
    if (setCookies.length === 0) {
      return null;
    }
    return { setCookies, renewedToken: readSetCookieValue(setCookies, AuthCookieName) };
  } catch {
    return null;
  }
}
