import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const markReadOne = vi.fn();
const markReadByItem = vi.fn();

vi.mock('../data/repositories/notificationsRepository', () => ({
  notificationsRepository: {
    markReadOne: (...args: unknown[]) => markReadOne(...args),
    markReadByItem: (...args: unknown[]) => markReadByItem(...args),
  },
}));

import type { MobileAuthRequestContext } from '../data/repositories/types';
import { OfflineModeEnabledError } from '../prefs/offlineMode';
import { markNotificationReadById, markPushNotificationRead } from './notificationReadActions';
import {
  getNotificationUnreadCount,
  resetNotificationStreamStore,
  setNotificationUnreadCount,
} from './notificationStreamStore';

const context: MobileAuthRequestContext = {
  accessToken: 'token',
  clearSession: async () => {},
  refreshToken: 'refresh',
  setTokens: async () => {},
};

const responseError = (status: number): Error =>
  Object.assign(new Error(`Request failed with status code ${status}`), {
    response: { status },
  });

describe('notificationReadActions', () => {
  beforeEach(() => {
    resetNotificationStreamStore();
    markReadOne.mockReset();
    markReadByItem.mockReset();
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('sets the unread count from a mark-one response', async () => {
    markReadOne.mockResolvedValue({ markedIds: [11], unreadCount: 4 });

    await markNotificationReadById(context, 11);

    expect(markReadOne).toHaveBeenCalledWith(context, 11);
    expect(getNotificationUnreadCount()).toBe(4);
  });

  it('sets the unread count from a push item and type', async () => {
    markReadByItem.mockResolvedValue({ markedIds: [3], unreadCount: 1 });

    await markPushNotificationRead(context, {
      itemIdText: 'abcdefghi1',
      type: 'livestream-started',
    });

    expect(markReadByItem).toHaveBeenCalledWith(context, {
      itemIdText: 'abcdefghi1',
      type: 'livestream-started',
    });
    expect(getNotificationUnreadCount()).toBe(1);
  });

  it('resolves a 404 and Offline Mode without changing the count or warning', async () => {
    setNotificationUnreadCount(6);
    markReadOne.mockRejectedValueOnce(responseError(404));

    await markNotificationReadById(context, 9);

    expect(markReadOne).toHaveBeenCalledTimes(1);
    expect(getNotificationUnreadCount()).toBe(6);
    expect(console.warn).not.toHaveBeenCalled();

    markReadOne.mockRejectedValueOnce(new OfflineModeEnabledError());
    await markNotificationReadById(context, 9);

    expect(markReadOne).toHaveBeenCalledTimes(2);
    expect(getNotificationUnreadCount()).toBe(6);
    expect(console.warn).not.toHaveBeenCalled();
  });

  it('resolves any other error and warns once', async () => {
    setNotificationUnreadCount(6);
    const error = new Error('mark read failed');
    markReadOne.mockRejectedValueOnce(error);

    await markNotificationReadById(context, 3);

    expect(getNotificationUnreadCount()).toBe(6);
    expect(console.warn).toHaveBeenCalledTimes(1);
    expect(console.warn).toHaveBeenCalledWith('[notifications] mark one read failed', { error });
  });

  it('makes one repository call when two calls share an id', async () => {
    let resolveMark: (result: { markedIds: number[]; unreadCount: number }) => void = () => {};
    const pending = new Promise<{ markedIds: number[]; unreadCount: number }>((resolve) => {
      resolveMark = resolve;
    });
    markReadOne.mockReturnValue(pending);

    const first = markNotificationReadById(context, 7);
    const second = markNotificationReadById(context, 7);
    await second;

    expect(markReadOne).toHaveBeenCalledTimes(1);

    resolveMark({ markedIds: [7], unreadCount: 2 });
    await first;
    expect(getNotificationUnreadCount()).toBe(2);
  });

  it('makes one repository call per id', async () => {
    markReadOne.mockImplementation(async (...args: unknown[]) => {
      const notificationId = args[1];
      if (typeof notificationId !== 'number') {
        throw new Error('notification id');
      }
      return { markedIds: [notificationId], unreadCount: notificationId };
    });

    await Promise.all([markNotificationReadById(context, 1), markNotificationReadById(context, 2)]);

    expect(markReadOne).toHaveBeenCalledTimes(2);
  });
});
