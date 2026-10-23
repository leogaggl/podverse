import { config } from '@management-api/config/index.js';
import type { AdminSessionRow } from '@management-api/orm/services/adminSession.js';
import {
  createAdminSession,
  getAdminSessionStatus,
  listActiveAdminSessions,
  revokeAdminSession,
  revokeAdminSessions,
  rotateAdminSessionRefreshToken,
  touchAdminSession,
} from '@management-api/orm/services/adminSession.js';

import type {
  AccountSessionClientType,
  AccountSessionRevokeReason,
  AuthSessionEndedNotice,
} from '@podverse/helpers';
import { getAuthSessionEndedNotice, MS_PER_SECOND, ONE_DAY_MS } from '@podverse/helpers';

/**
 * Every management API path that starts, checks, renews, or ends an admin session goes through
 * this module. It owns the clock, the idle limit from config, and the mapping from a revoke reason
 * to the notice the signed-out client shows, so those rules live in one place.
 */

/** A session is renewed (row touched, web cookie re-signed) at most once per this interval. */
const ADMIN_SESSION_RENEW_INTERVAL_MS = ONE_DAY_MS;

export type AdminSessionCheck =
  | { kind: 'active'; session: AdminSessionRow; renewDue: boolean }
  | { kind: 'ended'; notice: AuthSessionEndedNotice | null };

export type AdminRefreshRotation =
  | { kind: 'rotated'; refreshTokenId: string; session: AdminSessionRow }
  | { kind: 'ended'; notice: AuthSessionEndedNotice | null };

function idleExpiresAtFrom(now: Date): Date {
  return new Date(now.getTime() + config.auth.sessionIdleExpiration * MS_PER_SECOND);
}

export async function startAdminSession(input: {
  adminAccountId: number;
  clientType: AccountSessionClientType;
  deviceLabel: string | null;
  withRefreshToken: boolean;
}): Promise<{ sessionIdText: string; refreshTokenId: string | null }> {
  const { session, refreshTokenId } = await createAdminSession({
    adminAccountId: input.adminAccountId,
    clientType: input.clientType,
    deviceLabel: input.deviceLabel,
    idleExpiresAt: idleExpiresAtFrom(new Date()),
    withRefreshToken: input.withRefreshToken,
  });
  return { sessionIdText: session.id_text, refreshTokenId };
}

/** `renewDue` once a renew interval has passed since the row was last renewed. */
export async function checkAdminSession(input: {
  adminAccountId: number;
  sessionIdText: string;
}): Promise<AdminSessionCheck> {
  const now = new Date();
  const status = await getAdminSessionStatus({
    adminAccountId: input.adminAccountId,
    sessionIdText: input.sessionIdText,
    now,
  });
  switch (status.status) {
    case 'active':
      return {
        kind: 'active',
        session: status.session,
        renewDue:
          now.getTime() - status.session.last_seen_at.getTime() >= ADMIN_SESSION_RENEW_INTERVAL_MS,
      };
    case 'revoked':
      return { kind: 'ended', notice: getAuthSessionEndedNotice(status.reason) };
    case 'expired':
    case 'missing':
      return { kind: 'ended', notice: null };
  }
}

/** False when the row ended between the check and the renewal. */
export async function renewAdminSession(session: AdminSessionRow): Promise<boolean> {
  const now = new Date();
  return touchAdminSession({
    sessionId: session.id,
    lastSeenAt: now,
    idleExpiresAt: idleExpiresAtFrom(now),
  });
}

/** A reused refresh token ends the session as suspected theft; the client shows `security`. */
export async function rotateAdminRefreshToken(input: {
  adminAccountId: number;
  sessionIdText: string;
  presentedTokenId: string;
}): Promise<AdminRefreshRotation> {
  const now = new Date();
  const result = await rotateAdminSessionRefreshToken({
    adminAccountId: input.adminAccountId,
    sessionIdText: input.sessionIdText,
    presentedTokenId: input.presentedTokenId,
    lastSeenAt: now,
    idleExpiresAt: idleExpiresAtFrom(now),
    now,
  });
  switch (result.outcome) {
    case 'rotated':
      return { kind: 'rotated', refreshTokenId: result.refreshTokenId, session: result.session };
    case 'reused':
      return { kind: 'ended', notice: getAuthSessionEndedNotice('refresh_reuse') };
    case 'revoked':
      return { kind: 'ended', notice: getAuthSessionEndedNotice(result.reason) };
    case 'expired':
    case 'missing':
      return { kind: 'ended', notice: null };
  }
}

export async function endAdminSession(input: {
  adminAccountId: number;
  sessionIdText: string;
  reason: AccountSessionRevokeReason;
}): Promise<boolean> {
  return revokeAdminSession({
    adminAccountId: input.adminAccountId,
    sessionIdText: input.sessionIdText,
    reason: input.reason,
    now: new Date(),
  });
}

/** `exceptSessionIdText` keeps the caller's own session; null ends every session. */
export async function endAdminSessions(input: {
  adminAccountId: number;
  reason: AccountSessionRevokeReason;
  exceptSessionIdText: string | null;
}): Promise<number> {
  return revokeAdminSessions({
    adminAccountId: input.adminAccountId,
    reason: input.reason,
    exceptSessionIdText: input.exceptSessionIdText,
    now: new Date(),
  });
}

export async function listAdminSessions(adminAccountId: number): Promise<AdminSessionRow[]> {
  return listActiveAdminSessions({ adminAccountId, now: new Date() });
}
