import { describe, expect, it } from 'vitest';

import { buildMobileHomePodcastEpisodePath } from '@podverse/helpers';

import { resolveAccountNotificationOpenPath } from './accountNotificationLink';
import { HOME_FALLBACK_PATH } from './notificationTarget';

describe('resolveAccountNotificationOpenPath', () => {
  it('builds the Home podcast episode path from a new-episode payload', () => {
    expect(
      resolveAccountNotificationOpenPath({
        link_path: null,
        payload: {
          channelIdText: 'chan123456',
          itemIdText: 'item123456',
          type: 'new-episode',
        },
      })
    ).toBe(buildMobileHomePodcastEpisodePath('chan123456', 'item123456'));
  });

  it('uses link_path when the payload is null', () => {
    expect(
      resolveAccountNotificationOpenPath({
        link_path: '/notifications',
        payload: null,
      })
    ).toBe('/notifications');
  });

  it('falls back to Home when the payload and link_path name nothing', () => {
    expect(
      resolveAccountNotificationOpenPath({
        link_path: null,
        payload: {},
      })
    ).toBe(HOME_FALLBACK_PATH);
  });
});
