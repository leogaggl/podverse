import type { AccountSessionRevokeReason } from './accountSession.js';

/** `code` on a 401 body for a session that was ended somewhere other than the device holding it. */
export const AUTH_SESSION_ENDED_CODE = 'session_ended';

/**
 * Why the signed-out device was signed out, as the client shows it. Each value maps to one
 * sentence of copy on every client. The raw revoke reason stays inside the API.
 */
export const AUTH_SESSION_ENDED_NOTICES = [
  'signed_out_elsewhere',
  'password_changed',
  'admin_force_logout',
  'security',
] as const;
export type AuthSessionEndedNotice = (typeof AUTH_SESSION_ENDED_NOTICES)[number];

/** Exhaustive switch; `signed_out` returns null (that device signed itself out). */
export function getAuthSessionEndedNotice(
  reason: AccountSessionRevokeReason
): AuthSessionEndedNotice | null {
  switch (reason) {
    case 'signed_out':
      return null;
    case 'signed_out_elsewhere':
      return 'signed_out_elsewhere';
    case 'password_changed':
    case 'admin_password_set':
      return 'password_changed';
    case 'admin_force_logout':
      return 'admin_force_logout';
    case 'refresh_reuse':
      return 'security';
  }
}

function isAuthSessionEndedNotice(value: unknown): value is AuthSessionEndedNotice {
  return AUTH_SESSION_ENDED_NOTICES.some((notice) => notice === value);
}

/** Reads `{ code: 'session_ended', notice }` from a 401 body; null for any other body. */
export function parseAuthSessionEndedNotice(body: unknown): AuthSessionEndedNotice | null {
  if (typeof body !== 'object' || body === null) {
    return null;
  }
  if (!('code' in body) || body.code !== AUTH_SESSION_ENDED_CODE) {
    return null;
  }
  if (!('notice' in body) || !isAuthSessionEndedNotice(body.notice)) {
    return null;
  }
  return body.notice;
}
