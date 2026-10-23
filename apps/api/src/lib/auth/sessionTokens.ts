import { config } from '@api/config/index.js';
import jwt from 'jsonwebtoken';

import type { SessionAccessJwtPayload, SessionRefreshJwtPayload } from '@podverse/helpers';
import {
  AuthCookieName,
  isSessionAccessJwtPayload,
  isSessionRefreshJwtPayload,
} from '@podverse/helpers';
import { isValidNanoIdV2IdText } from '@podverse/orm';

const MOBILE_TOKEN_SCOPE = 'podverse_app_mobile';
const BEARER_HEADER_PATTERN = /^Bearer\s+(\S+)$/i;

export type RequestToken = { token: string; source: 'cookie' | 'bearer' };

export type MobileTokenPair = {
  token_type: 'Bearer';
  access_token: string;
  access_token_expires_in: number;
  refresh_token: string;
  refresh_token_expires_in: number;
};

export type AccessJwtClassification =
  { kind: 'session'; claims: SessionAccessJwtPayload } | { kind: 'rejected' };

export type RefreshJwtClassification =
  { kind: 'session'; claims: SessionRefreshJwtPayload } | { kind: 'rejected' };

type SessionTokenIdentity = {
  accountId: number;
  accountIdText: string;
  sessionIdText: string;
};

/** The web token lives as long as the idle limit; renewal re-signs it. */
export function signWebSessionToken(identity: SessionTokenIdentity): string {
  return jwt.sign(
    {
      id: identity.accountId,
      id_text: identity.accountIdText,
      sid: identity.sessionIdText,
      token_use: 'web',
    },
    config.auth.jwtSecret,
    { expiresIn: config.auth.sessionIdleExpiration }
  );
}

/**
 * A short access token for every request and a refresh token that lives as long as the idle
 * limit. Each refresh issues a new pair, so the refresh token's expiry moves with use.
 */
export function signMobileTokenPair(
  identity: SessionTokenIdentity & { refreshTokenId: string }
): MobileTokenPair {
  const accessExpiresIn = config.auth.accessTokenExpiration;
  const refreshExpiresIn = config.auth.sessionIdleExpiration;

  const accessToken = jwt.sign(
    {
      id: identity.accountId,
      id_text: identity.accountIdText,
      sid: identity.sessionIdText,
      scope: MOBILE_TOKEN_SCOPE,
      token_use: 'access',
    },
    config.auth.jwtSecret,
    { expiresIn: accessExpiresIn }
  );

  const refreshToken = jwt.sign(
    {
      id: identity.accountId,
      id_text: identity.accountIdText,
      sid: identity.sessionIdText,
      rid: identity.refreshTokenId,
      scope: MOBILE_TOKEN_SCOPE,
      token_use: 'refresh',
    },
    config.auth.jwtSecret,
    { expiresIn: refreshExpiresIn }
  );

  return {
    token_type: 'Bearer',
    access_token: accessToken,
    access_token_expires_in: accessExpiresIn,
    refresh_token: refreshToken,
    refresh_token_expires_in: refreshExpiresIn,
  };
}

/** The auth cookie wins over an `Authorization: Bearer` header when a request carries both. */
export function readRequestToken(req: {
  cookies?: unknown;
  headers: { authorization?: string };
}): RequestToken | null {
  const cookies = req.cookies;
  if (typeof cookies === 'object' && cookies !== null) {
    const cookieToken: unknown = Reflect.get(cookies, AuthCookieName);
    if (typeof cookieToken === 'string' && cookieToken !== '') {
      return { token: cookieToken, source: 'cookie' };
    }
  }
  const header = req.headers.authorization;
  if (typeof header !== 'string') {
    return null;
  }
  const bearerToken = BEARER_HEADER_PATTERN.exec(header.trim())?.[1];
  if (bearerToken === undefined) {
    return null;
  }
  return { token: bearerToken, source: 'bearer' };
}

/** The decoded payload when the signature and expiry check out; null otherwise. */
export function verifySessionJwt(token: string): unknown {
  try {
    return jwt.verify(token, config.auth.jwtSecret);
  } catch {
    return null;
  }
}

function hasValidSessionIdentity(claims: { id_text: string; sid: string }): boolean {
  return isValidNanoIdV2IdText(claims.id_text) && isValidNanoIdV2IdText(claims.sid);
}

/** A web or mobile access token that names a session. Anything else is rejected. */
export function classifyAccessJwt(decoded: unknown): AccessJwtClassification {
  if (!isSessionAccessJwtPayload(decoded) || !hasValidSessionIdentity(decoded)) {
    return { kind: 'rejected' };
  }
  return { kind: 'session', claims: decoded };
}

/** A mobile refresh token that names a session and a refresh token id. Anything else is rejected. */
export function classifyRefreshJwt(decoded: unknown): RefreshJwtClassification {
  if (!isSessionRefreshJwtPayload(decoded) || !hasValidSessionIdentity(decoded)) {
    return { kind: 'rejected' };
  }
  return { kind: 'session', claims: decoded };
}
