import type { DTOAccountNotification, DTOAccountNotificationPreference } from '@podverse/helpers';
import type { AccountNotification, AccountNotificationPreference } from '@podverse/orm';

export const accountNotificationToJson = (
  row: AccountNotification,
  lastReadAt: Date | null
): DTOAccountNotification => {
  // Unread means created after the Mark All as Read cutoff and not read on its own. With no cutoff,
  // only read_at decides.
  const isReadOnItsOwn = row.read_at !== null && row.read_at !== undefined;
  const isAfterCutoff =
    lastReadAt === null ? true : row.created_at.getTime() > lastReadAt.getTime();
  const isUnread = !isReadOnItsOwn && isAfterCutoff;
  return {
    id: row.id,
    account_id: row.account_id,
    body: row.body ?? null,
    category: row.category,
    created_at: row.created_at.toISOString(),
    expires_at: row.expires_at.toISOString(),
    is_unread: isUnread,
    link_path: row.link_path ?? null,
    payload: row.payload ?? null,
    title: row.title,
  };
};

export const accountNotificationPreferenceToJson = (
  row: AccountNotificationPreference
): DTOAccountNotificationPreference => ({
  id: row.id,
  account_id: row.account_id,
  category: row.category,
  in_app_enabled: row.in_app_enabled,
  push_enabled: row.push_enabled,
});
