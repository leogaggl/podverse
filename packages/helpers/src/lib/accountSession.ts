/** Clients that hold an account session. A new client also widens the `account_session` CHECK. */
export const ACCOUNT_SESSION_CLIENT_TYPES = ['web', 'mobile'] as const;
export type AccountSessionClientType = (typeof ACCOUNT_SESSION_CLIENT_TYPES)[number];

/** Why a session ended. The signed-out device maps each value to the copy it shows. */
export const ACCOUNT_SESSION_REVOKE_REASONS = [
  'signed_out',
  'signed_out_elsewhere',
  'password_changed',
  'admin_password_set',
  'admin_force_logout',
  'refresh_reuse',
] as const;
export type AccountSessionRevokeReason = (typeof ACCOUNT_SESSION_REVOKE_REASONS)[number];

export function isAccountSessionClientType(value: unknown): value is AccountSessionClientType {
  return ACCOUNT_SESSION_CLIENT_TYPES.some((clientType) => clientType === value);
}

export function isAccountSessionRevokeReason(value: unknown): value is AccountSessionRevokeReason {
  return ACCOUNT_SESSION_REVOKE_REASONS.some((reason) => reason === value);
}
