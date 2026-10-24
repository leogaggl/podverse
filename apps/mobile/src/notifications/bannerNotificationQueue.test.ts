import { describe, expect, it } from 'vitest';

import type { DTOAccountNotification } from '@podverse/helpers';
import { NotificationCategoryEnum } from '@podverse/helpers';

import type { BannerNotificationQueueItem } from './bannerNotificationQueue';
import {
  clearBannerNotificationQueue,
  dismissVisibleBannerNotification,
  EMPTY_BANNER_NOTIFICATION_QUEUE,
  enqueueBannerNotification,
  removeBannerNotification,
} from './bannerNotificationQueue';

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

const item = (id: number): BannerNotificationQueueItem => ({
  body: `Body ${id}`,
  id,
  notification: notification(id),
  title: `Title ${id}`,
});

const enqueueIds = (ids: readonly number[]) => {
  let state = EMPTY_BANNER_NOTIFICATION_QUEUE;
  for (const id of ids) {
    state = enqueueBannerNotification(state, item(id));
  }
  return state;
};

describe('enqueueBannerNotification', () => {
  it('shows the first card and leaves the wait list empty', () => {
    const state = enqueueBannerNotification(EMPTY_BANNER_NOTIFICATION_QUEUE, item(1));

    expect(state.visible?.id).toBe(1);
    expect(state.waiting).toEqual([]);
  });

  it('keeps the next three waiting, in arrival order', () => {
    const state = enqueueIds([1, 2, 3, 4]);

    expect(state.visible?.id).toBe(1);
    expect(state.waiting.map((entry) => entry.id)).toEqual([2, 3, 4]);
  });

  it('drops the oldest waiting card when a fifth distinct id arrives', () => {
    const state = enqueueIds([1, 2, 3, 4, 5]);

    expect(state.visible?.id).toBe(1);
    expect(state.waiting.map((entry) => entry.id)).toEqual([3, 4, 5]);
  });

  it('returns the same state when the id is already visible or waiting', () => {
    const visible = enqueueBannerNotification(EMPTY_BANNER_NOTIFICATION_QUEUE, item(1));
    const waiting = enqueueBannerNotification(visible, item(2));

    expect(enqueueBannerNotification(visible, { ...item(1), title: 'Again' })).toBe(visible);
    expect(enqueueBannerNotification(waiting, { ...item(2), title: 'Again' })).toBe(waiting);
  });
});

describe('dismissVisibleBannerNotification', () => {
  it('promotes the first waiting card', () => {
    const state = enqueueIds([1, 2, 3]);
    const next = dismissVisibleBannerNotification(state);

    expect(next.visible?.id).toBe(2);
    expect(next.waiting.map((entry) => entry.id)).toEqual([3]);
  });

  it('returns the same state when nothing is visible', () => {
    expect(dismissVisibleBannerNotification(EMPTY_BANNER_NOTIFICATION_QUEUE)).toBe(
      EMPTY_BANNER_NOTIFICATION_QUEUE
    );
  });
});

describe('removeBannerNotification', () => {
  it('promotes the next card when the visible id is removed', () => {
    const state = enqueueIds([1, 2, 3]);
    const next = removeBannerNotification(state, 1);

    expect(next.visible?.id).toBe(2);
    expect(next.waiting.map((entry) => entry.id)).toEqual([3]);
  });

  it('keeps the other waiting cards in order', () => {
    const state = enqueueIds([1, 2, 3, 4]);
    const next = removeBannerNotification(state, 3);

    expect(next.visible?.id).toBe(1);
    expect(next.waiting.map((entry) => entry.id)).toEqual([2, 4]);
  });

  it('returns the same state for an unknown id', () => {
    const state = enqueueIds([1, 2]);

    expect(removeBannerNotification(state, 99)).toBe(state);
  });
});

describe('clearBannerNotificationQueue', () => {
  it('returns the empty queue constant', () => {
    expect(clearBannerNotificationQueue()).toBe(EMPTY_BANNER_NOTIFICATION_QUEUE);
  });
});
