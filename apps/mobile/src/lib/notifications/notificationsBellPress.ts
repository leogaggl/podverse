import type { AccessDenialReason, FeatureAccess } from '@podverse/helpers';

import type { AuthStatus } from '../../auth/AuthProvider';

export type NotificationsBellPress =
  { kind: 'open' } | { kind: 'gate'; reason: AccessDenialReason };

/**
 * What a press on the Home notifications bell does. Signed out always gates on an account. A
 * signed-in user whose account snapshot has not arrived opens the inbox: the tier reads as
 * anonymous in that window, and a gate would ask someone who just signed in to sign in.
 */
export function resolveNotificationsBellPress({
  access,
  isTierKnown,
  status,
}: {
  access: FeatureAccess;
  isTierKnown: boolean;
  status: AuthStatus;
}): NotificationsBellPress {
  if (status !== 'authenticated') {
    return { kind: 'gate', reason: 'needs_account' };
  }
  if (!isTierKnown || access.allowed) {
    return { kind: 'open' };
  }
  return { kind: 'gate', reason: access.reason };
}
