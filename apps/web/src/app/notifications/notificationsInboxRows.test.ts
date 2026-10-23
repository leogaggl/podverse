import { describe, expect, it } from 'vitest';

import type { DTOAccountNotification } from '@podverse/helpers';
import { NotificationCategoryEnum } from '@podverse/helpers';

import { insertLiveNotificationRow } from './notificationsInboxRows';

function row(id: number, createdAt: string): DTOAccountNotification {
  return {
    id,
    account_id: 1,
    category: NotificationCategoryEnum.ProductUpdate,
    is_unread: true,
    title: `Notification ${id}`,
    body: null,
    link_path: null,
    payload: null,
    created_at: createdAt,
    expires_at: '2026-09-23T10:00:00.000Z',
  };
}

describe('insertLiveNotificationRow', () => {
  it('places a newer row first', () => {
    const items = [row(1, '2026-08-23T10:00:00.000Z')];

    const inserted = insertLiveNotificationRow(items, row(2, '2026-08-23T11:00:00.000Z'));

    expect(inserted.map((item) => item.id)).toEqual([2, 1]);
  });

  it('places an older row after newer ones', () => {
    const items = [row(3, '2026-08-23T12:00:00.000Z'), row(2, '2026-08-23T11:00:00.000Z')];

    const inserted = insertLiveNotificationRow(items, row(1, '2026-08-23T10:00:00.000Z'));

    expect(inserted.map((item) => item.id)).toEqual([3, 2, 1]);
  });

  it('orders equal created_at by id descending', () => {
    const items = [row(5, '2026-08-23T10:00:00.000Z'), row(3, '2026-08-23T10:00:00.000Z')];

    const inserted = insertLiveNotificationRow(items, row(4, '2026-08-23T10:00:00.000Z'));

    expect(inserted.map((item) => item.id)).toEqual([5, 4, 3]);
  });

  it('orders by id descending when created_at cannot be parsed', () => {
    const items = [row(5, 'not-a-date'), row(3, '2026-08-23T10:00:00.000Z')];

    const inserted = insertLiveNotificationRow(items, row(4, 'also-not-a-date'));

    expect(inserted.map((item) => item.id)).toEqual([5, 4, 3]);
  });

  it('returns the same array when the id is already present', () => {
    const items = [row(1, '2026-08-23T10:00:00.000Z'), row(2, '2026-08-23T09:00:00.000Z')];

    expect(insertLiveNotificationRow(items, row(2, '2026-08-23T12:00:00.000Z'))).toBe(items);
  });
});
