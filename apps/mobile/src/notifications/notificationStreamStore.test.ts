import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  getNotificationStreamConnection,
  getNotificationUnreadCount,
  isNotificationsInboxFocused,
  markNotificationsInboxFocused,
  publishNotificationStreamEvent,
  resetNotificationStreamStore,
  setNotificationStreamConnection,
  setNotificationUnreadCount,
  subscribeNotificationsInboxFocus,
  subscribeNotificationStreamEvents,
  subscribeNotificationUnreadCount,
} from './notificationStreamStore';

describe('notificationStreamStore', () => {
  beforeEach(() => {
    resetNotificationStreamStore();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('clamps the unread count to a non-negative integer and notifies only on change', () => {
    const listener = vi.fn();
    const unsubscribe = subscribeNotificationUnreadCount(listener);

    setNotificationUnreadCount(3);
    setNotificationUnreadCount(3);
    expect(getNotificationUnreadCount()).toBe(3);
    expect(listener).toHaveBeenCalledTimes(1);

    setNotificationUnreadCount(-2);
    expect(getNotificationUnreadCount()).toBe(0);
    expect(listener).toHaveBeenCalledTimes(2);

    setNotificationUnreadCount(-5);
    expect(getNotificationUnreadCount()).toBe(0);
    expect(listener).toHaveBeenCalledTimes(2);

    unsubscribe();
    setNotificationUnreadCount(4);
    expect(listener).toHaveBeenCalledTimes(2);
  });

  it('delivers events to every subscriber when one listener throws', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const throwing = vi.fn(() => {
      throw new Error('listener failed');
    });
    const healthy = vi.fn();
    const unsubscribeThrowing = subscribeNotificationStreamEvents(throwing);
    const unsubscribeHealthy = subscribeNotificationStreamEvents(healthy);

    publishNotificationStreamEvent({ type: 'resync' });

    expect(throwing).toHaveBeenCalledWith({ type: 'resync' });
    expect(healthy).toHaveBeenCalledWith({ type: 'resync' });
    expect(warn).toHaveBeenCalledTimes(1);

    unsubscribeThrowing();
    unsubscribeHealthy();
  });

  it('notifies inbox focus listeners on the first hold and the last release only', () => {
    const listener = vi.fn();
    const unsubscribe = subscribeNotificationsInboxFocus(listener);

    const releaseFirst = markNotificationsInboxFocused();
    const releaseSecond = markNotificationsInboxFocused();
    expect(listener).toHaveBeenCalledTimes(1);
    expect(isNotificationsInboxFocused()).toBe(true);

    releaseFirst();
    expect(listener).toHaveBeenCalledTimes(1);
    expect(isNotificationsInboxFocused()).toBe(true);

    releaseSecond();
    expect(listener).toHaveBeenCalledTimes(2);
    expect(isNotificationsInboxFocused()).toBe(false);

    releaseSecond();
    expect(listener).toHaveBeenCalledTimes(2);

    unsubscribe();
  });

  it('counts two nested inbox focus holds, and a double release is harmless', () => {
    expect(isNotificationsInboxFocused()).toBe(false);

    const releaseFirst = markNotificationsInboxFocused();
    const releaseSecond = markNotificationsInboxFocused();
    expect(isNotificationsInboxFocused()).toBe(true);

    releaseFirst();
    releaseFirst();
    expect(isNotificationsInboxFocused()).toBe(true);

    releaseSecond();
    expect(isNotificationsInboxFocused()).toBe(false);

    releaseSecond();
    expect(isNotificationsInboxFocused()).toBe(false);
  });

  it('reset zeroes the count, sets the connection idle, and leaves inbox focus alone', () => {
    setNotificationUnreadCount(4);
    setNotificationStreamConnection('open');
    const release = markNotificationsInboxFocused();

    resetNotificationStreamStore();

    expect(getNotificationUnreadCount()).toBe(0);
    expect(getNotificationStreamConnection()).toBe('idle');
    expect(isNotificationsInboxFocused()).toBe(true);

    release();
  });
});
