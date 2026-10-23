import { describe, expect, it } from 'vitest';

import type { AccountNotificationStreamEvent, DTOAccountNotification } from '@podverse/helpers';
import { ACCOUNT_NOTIFICATION_STREAM_EVENT, NotificationCategoryEnum } from '@podverse/helpers';

import { getNotificationStreamEventUnreadCount } from './notificationStreamEventUnreadCount';

const notification: DTOAccountNotification = {
  id: 950,
  account_id: 1,
  category: NotificationCategoryEnum.ProductUpdate,
  is_unread: true,
  title: 'Playlists just got faster',
  body: 'Large playlists now load without paging.',
  link_path: null,
  payload: null,
  created_at: '2026-08-23T10:00:00.000Z',
  expires_at: '2026-09-23T10:00:00.000Z',
};

describe('getNotificationStreamEventUnreadCount', () => {
  it('returns the unread count carried by state, created, and read events', () => {
    const events: Array<{ event: AccountNotificationStreamEvent; expected: number }> = [
      {
        event: {
          type: ACCOUNT_NOTIFICATION_STREAM_EVENT.state,
          data: { unread_count: 0, last_read_at: null },
        },
        expected: 0,
      },
      {
        event: {
          type: ACCOUNT_NOTIFICATION_STREAM_EVENT.created,
          data: { notification, unread_count: 1 },
        },
        expected: 1,
      },
      {
        event: {
          type: ACCOUNT_NOTIFICATION_STREAM_EVENT.read,
          data: { scope: 'one', notification_id: 950, unread_count: 2 },
        },
        expected: 2,
      },
      {
        event: {
          type: ACCOUNT_NOTIFICATION_STREAM_EVENT.read,
          data: {
            scope: 'all',
            last_read_at: '2026-08-23T11:00:00.000Z',
            unread_count: 0,
          },
        },
        expected: 0,
      },
    ];

    for (const { event, expected } of events) {
      expect(getNotificationStreamEventUnreadCount(event)).toBe(expected);
    }
  });

  it('returns null for a resync event', () => {
    const event: AccountNotificationStreamEvent = {
      type: ACCOUNT_NOTIFICATION_STREAM_EVENT.resync,
      data: { reason: 'replay_limit' },
    };

    expect(getNotificationStreamEventUnreadCount(event)).toBeNull();
  });
});
