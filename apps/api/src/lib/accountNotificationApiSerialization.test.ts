import { describe, expect, it } from 'vitest';

import { NotificationCategoryEnum } from '@podverse/helpers';
import type { AccountNotification } from '@podverse/orm';

import { accountNotificationToJson } from './accountNotificationApiSerialization.js';

const expiresAt = new Date('2026-09-02T00:00:00.000Z');
const cutoff = new Date('2026-08-01T00:00:00.000Z');
const afterCutoff = new Date('2026-08-02T00:00:00.000Z');
const readAt = new Date('2026-08-03T00:00:00.000Z');

type NotificationColumns = Omit<AccountNotification, 'account'>;

const baseRow: NotificationColumns = {
  id: 11,
  account_id: 41,
  category: NotificationCategoryEnum.General,
  title: 'Inbox row',
  body: null,
  link_path: null,
  payload: null,
  created_at: afterCutoff,
  expires_at: expiresAt,
  read_at: null,
};

const hasNotificationColumns = (row: NotificationColumns): row is AccountNotification =>
  row.created_at instanceof Date && typeof row.id === 'number';

const notificationRow = (
  overrides: Partial<Pick<AccountNotification, 'created_at' | 'read_at'>>
): AccountNotification => {
  const row: NotificationColumns = {
    ...baseRow,
    created_at: overrides.created_at ?? baseRow.created_at,
    read_at: overrides.read_at === undefined ? baseRow.read_at : overrides.read_at,
  };
  if (!hasNotificationColumns(row)) {
    throw new Error('Notification row is missing the columns the serializer reads.');
  }
  return row;
};

describe('accountNotificationToJson', () => {
  it.each([
    {
      name: 'no cutoff and read_at null is unread',
      lastReadAt: null,
      createdAt: afterCutoff,
      readAt: null,
      isUnread: true,
    },
    {
      name: 'no cutoff and read_at set is read',
      lastReadAt: null,
      createdAt: afterCutoff,
      readAt,
      isUnread: false,
    },
    {
      name: 'created after the cutoff and read_at null is unread',
      lastReadAt: cutoff,
      createdAt: afterCutoff,
      readAt: null,
      isUnread: true,
    },
    {
      name: 'created after the cutoff and read_at set is read',
      lastReadAt: cutoff,
      createdAt: afterCutoff,
      readAt,
      isUnread: false,
    },
    {
      name: 'created at the cutoff and read_at null is read',
      lastReadAt: cutoff,
      createdAt: cutoff,
      readAt: null,
      isUnread: false,
    },
  ])('$name', ({ lastReadAt, createdAt, readAt: rowReadAt, isUnread }) => {
    const json = accountNotificationToJson(
      notificationRow({ created_at: createdAt, read_at: rowReadAt }),
      lastReadAt
    );

    expect(json.is_unread).toBe(isUnread);
  });
});
