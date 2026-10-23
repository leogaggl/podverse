import { ONE_DAY_MS, ONE_YEAR_SECONDS, SECONDS_PER_MINUTE } from './timeConstants.js';

export const AuthCookieName = 'jwt';

/**
 * Fallback when `AUTH_ACCESS_TOKEN_EXPIRATION` is unset — 15 minutes.
 *
 * The access token of the access/refresh pair issued to token clients (the mobile app today, any
 * non-browser client later). Clients refresh it silently, so this never decides how long anyone
 * stays signed in; `AUTH_SESSION_IDLE_EXPIRATION` does, for every client.
 *
 * Short because an access token travels in a header rather than a cookie the browser will scope
 * for us. A leaked access token stops working within this window unless the holder also has the
 * refresh token, which rotates and is never sent on ordinary requests.
 *
 * Shared by both APIs so listener and admin token clients follow one policy.
 */
export const DEFAULT_AUTH_ACCESS_TOKEN_EXPIRATION = 15 * SECONDS_PER_MINUTE;

/**
 * Fallback when `AUTH_SESSION_IDLE_EXPIRATION` is unset — 365 days.
 *
 * One idle limit for every client. Each use renews it: the session row's idle expiry, the web
 * cookie and the web JWT it carries, and the mobile refresh JWT issued on each refresh all move
 * forward by this much, so a session survives as long as it is used at least once per interval.
 */
export const DEFAULT_AUTH_SESSION_IDLE_EXPIRATION = ONE_YEAR_SECONDS;

/**
 * A session is renewed (row touched, web cookie re-signed) at most once per this interval of use.
 * The API decides renewal from the row; the web middleware uses the same interval to decide when
 * a server-rendered visit should ask for one.
 */
export const ACCOUNT_SESSION_RENEW_INTERVAL_MS = ONE_DAY_MS;

/** Claims of a token sent on authenticated requests: the web cookie JWT or a mobile access JWT. */
export type SessionAccessJwtPayload = {
  id: number;
  id_text: string;
  sid: string;
  token_use: 'web' | 'access';
};

/** Claims of a mobile refresh JWT. `rid` is the raw refresh token id the session row hashes. */
export type SessionRefreshJwtPayload = {
  id: number;
  id_text: string;
  sid: string;
  rid: string;
  token_use: 'refresh';
};

function hasSessionIdentityClaims(
  value: object
): value is { id: number; id_text: string; sid: string } {
  if (
    !('id' in value) ||
    typeof value.id !== 'number' ||
    !Number.isInteger(value.id) ||
    value.id <= 0
  ) {
    return false;
  }
  if (!('id_text' in value) || typeof value.id_text !== 'string' || value.id_text === '') {
    return false;
  }
  return 'sid' in value && typeof value.sid === 'string' && value.sid !== '';
}

export function isSessionAccessJwtPayload(value: unknown): value is SessionAccessJwtPayload {
  if (value === null || typeof value !== 'object') {
    return false;
  }
  if (!('token_use' in value) || (value.token_use !== 'web' && value.token_use !== 'access')) {
    return false;
  }
  return hasSessionIdentityClaims(value);
}

export function isSessionRefreshJwtPayload(value: unknown): value is SessionRefreshJwtPayload {
  if (value === null || typeof value !== 'object') {
    return false;
  }
  if (!('token_use' in value) || value.token_use !== 'refresh') {
    return false;
  }
  if (!('rid' in value) || typeof value.rid !== 'string' || value.rid === '') {
    return false;
  }
  return hasSessionIdentityClaims(value);
}
