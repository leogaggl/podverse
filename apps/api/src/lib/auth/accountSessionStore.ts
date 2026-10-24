import { config } from '@api/config/index.js';

import type {
  AccountSessionClientType,
  AccountSessionRevokeReason,
  AuthSessionEndedNotice,
} from '@podverse/helpers';
import {
  ACCOUNT_SESSION_RENEW_INTERVAL_MS,
  getAuthSessionEndedNotice,
  MS_PER_SECOND,
} from '@podverse/helpers';
import type { AccountSessionRow } from '@podverse/orm';
import {
  createAccountSession,
  getAccountSessionStatus,
  listActiveAccountSessions,
  revokeAccountSession,
  revokeAccountSessions,
  rotateAccountSessionRefreshToken,
  touchAccountSession,
} from '@podverse/orm';

/**
 * Every API path that starts, checks, renews, or ends an account session goes through this
 * module. It owns the clock, the idle limit from config, and the mapping from a revoke reason to
 * the notice the signed-out device shows, so those rules live in one place.
 */

export type AccountSessionCheck =
  | { kind: 'active'; session: AccountSessionRow; renewDue: boolean }
  | { kind: 'ended'; notice: AuthSessionEndedNotice | null };

export type MobileRefreshRotation =
  | { kind: 'rotated'; refreshTokenId: string; session: AccountSessionRow }
  | { kind: 'ended'; notice: AuthSessionEndedNotice | null };

function idleExpiresAtFrom(now: Date): Date {
  return new Date(now.getTime() + config.auth.sessionIdleExpiration * MS_PER_SECOND);
}

export async function startAccountSession(input: {
  accountId: number;
  clientType: AccountSessionClientType;
  deviceLabel: string | null;
  withRefreshToken: boolean;
}): Promise<{ sessionIdText: string; refreshTokenId: string | null }> {
  const { session, refreshTokenId } = await createAccountSession({
    accountId: input.accountId,
    clientType: input.clientType,
    deviceLabel: input.deviceLabel,
    idleExpiresAt: idleExpiresAtFrom(new Date()),
    withRefreshToken: input.withRefreshToken,
  });
  return { sessionIdText: session.id_text, refreshTokenId };
}

/** `renewDue` once a renew interval has passed since the row was last renewed. */
export async function checkAccountSession(input: {
  accountId: number;
  sessionIdText: string;
}): Promise<AccountSessionCheck> {
  const now = new Date();
  const status = await getAccountSessionStatus({
    accountId: input.accountId,
    sessionIdText: input.sessionIdText,
    now,
  });
  switch (status.status) {
    case 'active':
      return {
        kind: 'active',
        session: status.session,
        renewDue:
          now.getTime() - status.session.last_seen_at.getTime() >=
          ACCOUNT_SESSION_RENEW_INTERVAL_MS,
      };
    case 'revoked':
      return { kind: 'ended', notice: getAuthSessionEndedNotice(status.reason) };
    case 'expired':
    case 'missing':
      return { kind: 'ended', notice: null };
  }
}

/** False when the row ended between the check and the renewal. */
export async function renewAccountSession(session: AccountSessionRow): Promise<boolean> {
  const now = new Date();
  return touchAccountSession({
    sessionId: session.id,
    lastSeenAt: now,
    idleExpiresAt: idleExpiresAtFrom(now),
  });
}

/** A reused refresh token ends the session as suspected theft; the device shows `security`. */
export async function rotateMobileRefreshToken(input: {
  accountId: number;
  sessionIdText: string;
  presentedTokenId: string;
}): Promise<MobileRefreshRotation> {
  const now = new Date();
  const result = await rotateAccountSessionRefreshToken({
    accountId: input.accountId,
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

export async function endAccountSession(input: {
  accountId: number;
  sessionIdText: string;
  reason: AccountSessionRevokeReason;
}): Promise<boolean> {
  return revokeAccountSession({
    accountId: input.accountId,
    sessionIdText: input.sessionIdText,
    reason: input.reason,
    now: new Date(),
  });
}

/** `exceptSessionIdText` keeps the caller's own session; null ends every session. */
export async function endAccountSessions(input: {
  accountId: number;
  reason: AccountSessionRevokeReason;
  exceptSessionIdText: string | null;
}): Promise<number> {
  return revokeAccountSessions({
    accountId: input.accountId,
    reason: input.reason,
    exceptSessionIdText: input.exceptSessionIdText,
    now: new Date(),
  });
}

export async function listAccountSessions(accountId: number): Promise<AccountSessionRow[]> {
  return listActiveAccountSessions({ accountId, now: new Date() });
}
