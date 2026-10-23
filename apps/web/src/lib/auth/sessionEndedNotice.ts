import type { AuthSessionEndedNotice } from '@podverse/helpers';
import { AUTH_SESSION_ENDED_NOTICES } from '@podverse/helpers';
import { parseAuthSessionEndedError } from '@podverse/helpers-requests';

const SESSION_ENDED_NOTICE_STORAGE_KEY = 'podverse.auth.session_ended_notice';

export type SessionEndedNoticeMessageKey =
  | 'session_ended.signed_out_elsewhere'
  | 'session_ended.password_changed'
  | 'session_ended.admin_force_logout'
  | 'session_ended.security';

function isAuthSessionEndedNotice(value: string): value is AuthSessionEndedNotice {
  return AUTH_SESSION_ENDED_NOTICES.some((notice) => notice === value);
}

/** Exhaustive: a new notice fails to compile until it has copy. Keys are under `authentication`. */
export function sessionEndedNoticeMessageKey(
  notice: AuthSessionEndedNotice
): SessionEndedNoticeMessageKey {
  switch (notice) {
    case 'signed_out_elsewhere':
      return 'session_ended.signed_out_elsewhere';
    case 'password_changed':
      return 'session_ended.password_changed';
    case 'admin_force_logout':
      return 'session_ended.admin_force_logout';
    case 'security':
      return 'session_ended.security';
  }
}

/** Saves the notice for the page load after the sign-out reload. Browser only. */
export function storePendingSessionEndedNotice(notice: AuthSessionEndedNotice): void {
  try {
    window.sessionStorage.setItem(SESSION_ENDED_NOTICE_STORAGE_KEY, notice);
  } catch {
    // sessionStorage can be disabled; a failure leaves no notice.
  }
}

/** Returns the saved notice and removes it, so it shows once. Null when none or invalid. */
export function takePendingSessionEndedNotice(): AuthSessionEndedNotice | null {
  try {
    const stored = window.sessionStorage.getItem(SESSION_ENDED_NOTICE_STORAGE_KEY);
    window.sessionStorage.removeItem(SESSION_ENDED_NOTICE_STORAGE_KEY);
    if (stored !== null && isAuthSessionEndedNotice(stored)) {
      return stored;
    }
    return null;
  } catch {
    // sessionStorage can be disabled; a failure leaves no notice.
    return null;
  }
}

export type SessionEndedHandler = (notice: AuthSessionEndedNotice) => Promise<void>;

let sessionEndedHandler: SessionEndedHandler | null = null;

/** Stays set for the life of the page, because every path reloads. */
let isHandlingSessionEnded = false;

/** The mounted app registers how to sign out; null restores the default (save notice, reload). */
export function setSessionEndedHandler(handler: SessionEndedHandler | null): void {
  sessionEndedHandler = handler;
}

async function defaultSessionEndedHandler(notice: AuthSessionEndedNotice): Promise<void> {
  storePendingSessionEndedNotice(notice);
  window.location.reload();
}

/**
 * `onRequestError` for the browser's ApiRequestService. Acts once per page: the first refused
 * request with a signed-out notice signs the page out; later ones are ignored.
 */
export function reportSessionEndedError(error: unknown): void {
  if (typeof window === 'undefined') {
    return;
  }
  const notice = parseAuthSessionEndedError(error);
  if (notice === null || isHandlingSessionEnded) {
    return;
  }
  isHandlingSessionEnded = true;
  void (sessionEndedHandler ?? defaultSessionEndedHandler)(notice);
}
