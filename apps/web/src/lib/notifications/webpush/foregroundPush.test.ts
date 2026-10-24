import { describe, expect, it } from 'vitest';

import type { ForegroundPushNotification } from './foregroundPush';
import {
  buildForegroundPushNotificationOptions,
  readForegroundPushMessage,
  shouldShowForegroundPushPopup,
} from './foregroundPush';

const fullMessage = {
  type: 'PUSH_NOTIFICATION',
  payload: {
    title: 'New Episode',
    body: 'From the show',
    icon: '/favicon/web-app-manifest-192x192.png',
    image: 'https://cdn.example/art.jpg',
    link: '/episode/abc',
    data: {
      itemIdText: 'item123456',
      channelIdText: 'channel1',
      type: 'new-episode',
      link_path: '/episode/abc',
    },
  },
};

describe('readForegroundPushMessage', () => {
  it('reads a push message and the mark-read ids', () => {
    expect(readForegroundPushMessage(fullMessage)).toEqual({
      title: 'New Episode',
      body: 'From the show',
      icon: '/favicon/web-app-manifest-192x192.png',
      image: 'https://cdn.example/art.jpg',
      link: '/episode/abc',
      markRead: { item_id_text: 'item123456', type: 'new-episode' },
    });
  });

  it('returns null for a non-push, a missing payload, or an empty title', () => {
    expect(readForegroundPushMessage({ type: 'OTHER', payload: { title: 'Hi' } })).toBeNull();
    expect(readForegroundPushMessage({ type: 'PUSH_NOTIFICATION' })).toBeNull();
    expect(
      readForegroundPushMessage({ type: 'PUSH_NOTIFICATION', payload: { title: '' } })
    ).toBeNull();
    expect(
      readForegroundPushMessage({ type: 'PUSH_NOTIFICATION', payload: { title: '   ' } })
    ).toBeNull();
  });

  it('returns markRead null when the payload data has no type', () => {
    expect(
      readForegroundPushMessage({
        type: 'PUSH_NOTIFICATION',
        payload: {
          title: 'New Episode',
          data: { itemIdText: 'item123456' },
        },
      })
    ).toEqual({
      title: 'New Episode',
      body: '',
      icon: undefined,
      image: undefined,
      link: '/',
      markRead: null,
    });
  });
});

describe('shouldShowForegroundPushPopup', () => {
  it('skips the Notifications page and shows everywhere else', () => {
    expect(shouldShowForegroundPushPopup('/notifications')).toBe(false);
    expect(shouldShowForegroundPushPopup('/')).toBe(true);
    expect(shouldShowForegroundPushPopup('/episode/abc')).toBe(true);
  });
});

describe('buildForegroundPushNotificationOptions', () => {
  const notification: ForegroundPushNotification = {
    title: 'New Episode',
    body: 'From the show',
    icon: '/favicon/web-app-manifest-192x192.png',
    image: 'https://cdn.example/art.jpg',
    link: '/episode/abc',
    markRead: { item_id_text: 'item123456', type: 'new-episode' },
  };

  it('carries the click data and a stable tag for the same item and type', () => {
    const first = buildForegroundPushNotificationOptions(notification);
    const second = buildForegroundPushNotificationOptions(notification);

    expect(first.data).toEqual({
      url: '/episode/abc',
      itemIdText: 'item123456',
      type: 'new-episode',
    });
    expect(first.tag).toBe('podverse-notification-new-episode-item123456');
    expect(second.tag).toBe(first.tag);
    expect(first.image).toBe('https://cdn.example/art.jpg');

    const withoutMark = buildForegroundPushNotificationOptions({
      ...notification,
      icon: undefined,
      image: undefined,
      markRead: null,
    });
    expect(withoutMark.data).toEqual({
      url: '/episode/abc',
      itemIdText: null,
      type: null,
    });
    expect(withoutMark.image).toBeUndefined();
  });
});
