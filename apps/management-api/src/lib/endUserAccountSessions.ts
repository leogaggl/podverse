import { revokeAccountSessions } from '@podverse/orm';

type AdminEndUserSessionsReason = 'admin_force_logout' | 'admin_password_set';

export async function endUserAccountSessions(
  accountId: number,
  reason: AdminEndUserSessionsReason
): Promise<number> {
  return revokeAccountSessions({
    accountId,
    reason,
    exceptSessionIdText: null,
    now: new Date(),
  });
}
