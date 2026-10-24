import type { AuthSessionEndedNotice } from '@podverse/helpers/authSessionNotice';

export type SessionEndedNoticeMessageKey =
  'signedOutElsewhere' | 'passwordChanged' | 'signedOutByAdministrator' | 'signedOutForSecurity';

/** True for a notice the management login page may show. */
export function isAuthSessionEndedNotice(value: string): value is AuthSessionEndedNotice {
  return (
    value === 'signed_out_elsewhere' ||
    value === 'password_changed' ||
    value === 'admin_force_logout' ||
    value === 'security'
  );
}

/** Exhaustive: a new notice fails to compile until it has copy. Keys are under `auth`. */
export function sessionEndedNoticeMessageKey(
  notice: AuthSessionEndedNotice
): SessionEndedNoticeMessageKey {
  switch (notice) {
    case 'signed_out_elsewhere':
      return 'signedOutElsewhere';
    case 'password_changed':
      return 'passwordChanged';
    case 'admin_force_logout':
      return 'signedOutByAdministrator';
    case 'security':
      return 'signedOutForSecurity';
  }
}
