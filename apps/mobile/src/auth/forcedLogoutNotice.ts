import type { AuthSessionEndedNotice } from '@podverse/helpers/authSessionNotice';

import { clearPref, getPref, setPref } from '../prefs/prefsStore';

/**
 * Why a session ended. Only the server can produce `session_expired`, and only that value shows the
 * user a notice.
 *
 * The distinction exists because a silent sign-out is dangerous: subscriptions made on a signed-out
 * device are local-only, and signing back into an existing account replaces the local list with the
 * account's. A user who keeps subscribing without realising they were signed out loses that
 * work at the next login, so they have to be told.
 */
export type SessionEndReason =
  /** The user chose to sign out. */
  | 'user_logout'
  /**
   * The API rejected this device's credentials with a 401. The response may name why: another
   * device, a password change, an administrator, or security. Without a notice, the session
   * expired. Never inferred from a timeout, a network error, or a 5xx: those leave the session
   * intact so an offline device stays signed in.
   */
  | 'session_expired'
  /** A fixture or test harness wiped the session. Not a real sign-out; the user sees nothing. */
  | 'reset';

/** Ends the session. `notice` is the server's reason, when the 401 carried one. */
export type ClearSession = (
  reason: SessionEndReason,
  notice?: AuthSessionEndedNotice | null
) => Promise<void>;

/**
 * Record that the server ended this session, so the notice survives to the next launch.
 *
 * The notice is written before the timestamp. The timestamp is the presence marker, so a marker
 * that exists always has its notice beside it.
 *
 * Persisted rather than held in memory because the rejecting 401 usually lands on a background sync
 * with the app closed or backgrounded, where there is no one to show a modal to.
 */
export const markForcedLogout = async ({
  notice,
  occurredAt = new Date(),
}: {
  notice: AuthSessionEndedNotice | null;
  occurredAt?: Date;
}): Promise<void> => {
  if (notice === null) {
    await clearPref('auth.forced_logout_notice');
  } else {
    await setPref('auth.forced_logout_notice', notice);
  }
  await setPref('auth.forced_logout_at', occurredAt.toISOString());
};

export type PendingForcedLogoutNotice = { notice: AuthSessionEndedNotice | null };

/** The notice owed to the user, or null when none is pending. */
export const readPendingForcedLogoutNotice =
  async (): Promise<PendingForcedLogoutNotice | null> => {
    const markedAt = await getPref('auth.forced_logout_at');
    if (markedAt === null || markedAt === '') {
      return null;
    }
    const notice = await getPref('auth.forced_logout_notice');
    return { notice };
  };

/**
 * Consume the notice. Called when the user acknowledges it and when a login succeeds — a user who
 * signed back in before seeing it does not need telling.
 */
export const clearForcedLogoutNotice = async (): Promise<void> => {
  await clearPref('auth.forced_logout_at');
  await clearPref('auth.forced_logout_notice');
};

/** Whether ending a session for this reason owes the user a notice. */
export const shouldNotifyForcedLogout = (reason: SessionEndReason): boolean => {
  return reason === 'session_expired';
};
