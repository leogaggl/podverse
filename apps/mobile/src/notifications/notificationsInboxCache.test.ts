import { beforeEach, describe, expect, it } from 'vitest';

import type { DTOAccountNotification } from '@podverse/helpers';
import { NotificationCategoryEnum } from '@podverse/helpers';

import {
  getNotificationsInboxCache,
  prependLiveNotification,
  resetNotificationsInboxCache,
  setNotificationsInboxCache,
} from './notificationsInboxCache';

const notification = (id: number): DTOAccountNotification => ({
  account_id: 7,
  body: `Body ${id}`,
  category: NotificationCategoryEnum.NewContent,
  created_at: '2026-01-01T00:00:00.000Z',
  expires_at: '2026-02-01T00:00:00.000Z',
  id,
  is_unread: true,
  link_path: '/notifications',
  payload: null,
  title: `Title ${id}`,
});

describe('notificationsInboxCache', () => {
  beforeEach(() => {
    resetNotificationsInboxCache();
  });

  it('puts a new id first and keeps the rest in order', () => {
    const items = [notification(2), notification(3)];

    expect(prependLiveNotification(items, notification(1)).map((item) => item.id)).toEqual([
      1, 2, 3,
    ]);
    expect(items.map((item) => item.id)).toEqual([2, 3]);
  });

  it('returns the same contents when the id is already present', () => {
    const items = [notification(1), notification(2)];
    const duplicate: DTOAccountNotification = { ...notification(1), title: 'Different title' };

    expect(prependLiveNotification(items, duplicate)).toEqual(items);
  });

  it('gets, sets, and resets the session cache', () => {
    expect(getNotificationsInboxCache()).toBeNull();

    const next = {
      items: [notification(1), notification(2)],
      page: 1,
      totalPages: 3,
      unreadCount: 2,
    };
    setNotificationsInboxCache(next);

    expect(getNotificationsInboxCache()).toEqual(next);

    resetNotificationsInboxCache();

    expect(getNotificationsInboxCache()).toBeNull();
  });
});
