import { describe, expect, it } from 'vitest';

import type { AccountNotificationLineLabels } from './accountNotificationLine.js';
import {
  accountNotificationImageUrl,
  formatAccountNotificationLine,
} from './accountNotificationLine.js';
import type { NotificationLinkMessageType } from './appRoutes.js';
import { NotificationCategoryEnum } from './notificationCategory.js';

const labels: AccountNotificationLineLabels = {
  livestream: 'Livestream',
  'livestream-scheduled': 'Livestream scheduled',
  'livestream-started': 'Livestream started',
  new: 'New content',
  'new-album': 'New album',
  'new-episode': 'New episode',
  'new-podcast': 'New podcast',
  'new-track': 'New track',
  'new-video': 'New video',
  'new-video-channel': 'New video channel',
  'podcast-index-feed': 'New podcast',
  systemUpdate: 'System update',
};

describe('formatAccountNotificationLine', () => {
  it('names the medium, then the channel and the item', () => {
    expect(
      formatAccountNotificationLine(
        {
          body: 'Cool Worlds',
          category: NotificationCategoryEnum.NewContent,
          payload: {
            channelTitle: 'Cool Worlds',
            itemTitle: 'In Defense of Science',
            type: 'new-episode',
          },
          title: 'In Defense of Science',
        },
        labels
      )
    ).toBe('New episode: Cool Worlds – In Defense of Science');
  });

  it('uses livestream started and drops the stored live prefix', () => {
    expect(
      formatAccountNotificationLine(
        {
          body: 'No Agenda Show',
          category: NotificationCategoryEnum.Livestream,
          payload: { type: 'livestream-started' },
          title: 'Live: No Agenda Episode 1915 - Live',
        },
        labels
      )
    ).toBe('Livestream started: No Agenda Show – No Agenda Episode 1915 - Live');
  });

  it('uses livestream scheduled and drops the longer stored prefix first', () => {
    expect(
      formatAccountNotificationLine(
        {
          body: 'No Agenda Show',
          category: NotificationCategoryEnum.Livestream,
          payload: { type: 'livestream-scheduled' },
          title: 'Live Scheduled: Friday show',
        },
        labels
      )
    ).toBe('Livestream scheduled: No Agenda Show – Friday show');
  });

  it('names the new channel, then the publisher feed, for every publisher medium', () => {
    const notices: ReadonlyArray<{ label: string; type: NotificationLinkMessageType }> = [
      { label: 'New podcast', type: 'new-podcast' },
      { label: 'New video channel', type: 'new-video-channel' },
      { label: 'New album', type: 'new-album' },
      { label: 'New podcast', type: 'podcast-index-feed' },
    ];

    for (const notice of notices) {
      expect(
        formatAccountNotificationLine(
          {
            body: 'Middle Season',
            category: NotificationCategoryEnum.NewContent,
            payload: {
              channelTitle: 'Middle Season',
              itemTitle: 'No Longer Afraid - Single',
              type: notice.type,
            },
            title: 'No Longer Afraid - Single',
          },
          labels
        )
      ).toBe(`${notice.label}: No Longer Afraid - Single — Middle Season`);
    }
  });

  it('omits the publisher title when it matches the new channel', () => {
    expect(
      formatAccountNotificationLine(
        {
          body: 'Middle Season',
          category: NotificationCategoryEnum.NewContent,
          payload: {
            channelTitle: 'Middle Season',
            itemTitle: 'Middle Season',
            type: 'new-album',
          },
          title: 'Middle Season',
        },
        labels
      )
    ).toBe('New album: Middle Season');
  });

  it('uses New content only when the medium is unknown', () => {
    expect(
      formatAccountNotificationLine(
        {
          body: 'Cool Worlds',
          category: NotificationCategoryEnum.NewContent,
          payload: { type: 'new' },
          title: 'Untitled',
        },
        labels
      )
    ).toBe('New content: Cool Worlds – Untitled');
  });

  it('uses a generic livestream label when the status is missing', () => {
    expect(
      formatAccountNotificationLine(
        {
          body: 'No Agenda Show',
          category: NotificationCategoryEnum.Livestream,
          payload: null,
          title: 'Live: Friday show',
        },
        labels
      )
    ).toBe('Livestream: No Agenda Show – Friday show');
  });

  it('puts a product message on one system-update line', () => {
    expect(
      formatAccountNotificationLine(
        {
          body: 'Large playlists now load without paging.',
          category: NotificationCategoryEnum.ProductUpdate,
          payload: null,
          title: 'Playlists just got faster',
        },
        labels
      )
    ).toBe('System update: Playlists just got faster – Large playlists now load without paging.');
  });
});

describe('accountNotificationImageUrl', () => {
  it('returns the stored artwork url', () => {
    expect(accountNotificationImageUrl({ imageUrl: 'https://cdn.example/art.jpg' })).toBe(
      'https://cdn.example/art.jpg'
    );
  });

  it('returns null when the payload has no artwork', () => {
    expect(accountNotificationImageUrl(null)).toBeNull();
    expect(accountNotificationImageUrl({ imageUrl: '  ' })).toBeNull();
  });
});
