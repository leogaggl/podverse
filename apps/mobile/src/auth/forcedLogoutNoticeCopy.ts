import type { AuthSessionEndedNotice } from '@podverse/helpers/authSessionNotice';

export type ForcedLogoutReasonKey =
  | 'authentication.session_ended.admin_force_logout'
  | 'authentication.session_ended.expired'
  | 'authentication.session_ended.password_changed'
  | 'authentication.session_ended.security'
  | 'authentication.session_ended.signed_out_elsewhere';

/** The sentence that opens the forced-logout dialog. Null is a session that expired. */
export const forcedLogoutReasonKey = (
  notice: AuthSessionEndedNotice | null
): ForcedLogoutReasonKey => {
  if (notice === null) {
    return 'authentication.session_ended.expired';
  }
  switch (notice) {
    case 'signed_out_elsewhere':
      return 'authentication.session_ended.signed_out_elsewhere';
    case 'password_changed':
      return 'authentication.session_ended.password_changed';
    case 'admin_force_logout':
      return 'authentication.session_ended.admin_force_logout';
    case 'security':
      return 'authentication.session_ended.security';
  }
};
