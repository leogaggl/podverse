import { describe, expect, it } from 'vitest';

import { LiveItemStatusEnum } from '@podverse/helpers';
import type { Phase4PodcastLiveItem } from '@podverse/parser-mapping';
import { convertParsedRSSFeedToCompat, Phase4LiveStatus } from '@podverse/parser-mapping';

import {
  addByRssLiveItemKey,
  addByRssLiveStatusLabelKey,
  findAddByRssLiveItemDetail,
  resolveAddByRssLiveItemKey,
} from './liveItemDetail';

const liveItem = (
  overrides: Partial<Phase4PodcastLiveItem> & Pick<Phase4PodcastLiveItem, 'guid'>
): Phase4PodcastLiveItem => ({
  contentLinks: [],
  enclosure: { length: 1, type: 'audio/mpeg', url: 'https://example.com/live.mp3' },
  start: new Date('2026-06-01T15:00:00.000Z'),
  status: Phase4LiveStatus.Live,
  ...overrides,
});

const mappedFeed = (items: Phase4PodcastLiveItem[]) =>
  convertParsedRSSFeedToCompat({
    explicit: false,
    items: [],
    link: 'https://example.com',
    podcastLiveItems: items,
    title: 'Show',
  });

describe('addByRssLiveItemKey', () => {
  it('uses the trimmed guid, and the index when the guid is blank', () => {
    const feed = mappedFeed([liveItem({ guid: '  studio-live  ' }), liveItem({ guid: '   ' })]);
    const first = feed.liveItems[0];
    const second = feed.liveItems[1];
    expect(first).toBeDefined();
    expect(second).toBeDefined();
    if (first === undefined || second === undefined) {
      return;
    }

    expect(addByRssLiveItemKey(first, 0)).toBe('studio-live');
    expect(addByRssLiveItemKey(second, 1)).toBe('1');
  });
});

describe('resolveAddByRssLiveItemKey', () => {
  const feedIdText = 'feed-1';
  const secondStreamUrl = 'https://example.com/scheduled.mp3';
  const feed = mappedFeed([
    liveItem({ guid: '  studio-live  ' }),
    liveItem({
      enclosure: { length: 1, type: 'audio/mpeg', url: secondStreamUrl },
      guid: '   ',
    }),
  ]);

  it('matches the first live item by its trimmed guid', () => {
    expect(
      resolveAddByRssLiveItemKey(feed, { guid: 'studio-live', liveItem: {} }, feedIdText)
    ).toBe('studio-live');
  });

  it('matches a guidless live item by the feed id and index', () => {
    expect(
      resolveAddByRssLiveItemKey(feed, { guid: `${feedIdText}-1`, liveItem: {} }, feedIdText)
    ).toBe('1');
  });

  it('matches the stream URL when the guid is not on the feed', () => {
    expect(
      resolveAddByRssLiveItemKey(
        feed,
        { enclosure_url: secondStreamUrl, guid: 'missing', liveItem: {} },
        feedIdText
      )
    ).toBe('1');
  });

  it('returns null when the guid and the stream URL are both unknown', () => {
    expect(
      resolveAddByRssLiveItemKey(
        feed,
        { enclosure_url: 'https://example.com/other.mp3', guid: 'missing', liveItem: {} },
        feedIdText
      )
    ).toBeNull();
  });

  it('returns null for an episode', () => {
    expect(
      resolveAddByRssLiveItemKey(feed, { guid: 'studio-live', title: 'Episode' }, feedIdText)
    ).toBeNull();
  });
});

describe('findAddByRssLiveItemDetail', () => {
  it('returns the second live item by key, and null for an unknown key', () => {
    const feed = mappedFeed([
      liveItem({ guid: 'first', title: 'First' }),
      liveItem({ guid: 'second', title: 'Second' }),
    ]);

    const found = findAddByRssLiveItemDetail(feed, 'second');
    expect(found?.liveIndex).toBe(1);
    expect(found?.title).toBe('Second');
    expect(found?.liveItemKey).toBe('second');
    expect(findAddByRssLiveItemDetail(feed, 'missing')).toBeNull();
  });

  it('maps title, image, description source order, and people', () => {
    const start = new Date('2026-06-01T15:00:00.000Z');
    const feed = mappedFeed([
      liveItem({
        content: '<p>From content</p>',
        description: 'From description',
        descriptionRaw: 'From raw',
        guid: 'rich',
        image: '  ',
        itunesImage: ' https://example.com/itunes.jpg ',
        podcastPeople: [
          { href: 'https://example.com/skip', name: '   ' },
          {
            href: 'not-a-url',
            img: 'https://example.com/ada.jpg',
            name: ' Ada ',
            role: ' Host ',
          },
          { href: 'https://example.com/bea', img: 'nope', name: 'Bea', role: '   ' },
        ],
        start,
        status: Phase4LiveStatus.Pending,
        summary: 'From summary',
        title: '   ',
      }),
      liveItem({
        description: '   ',
        descriptionRaw: '  ',
        guid: 'summary-only',
        image: ' https://example.com/own.jpg ',
        itunesImage: 'https://example.com/ignored.jpg',
        summary: 'Only summary',
        title: '  On air  ',
      }),
      liveItem({
        content: '   ',
        guid: 'raw-only',
        descriptionRaw: 'Raw notes',
        summary: 'Later summary',
      }),
    ]);

    const rich = findAddByRssLiveItemDetail(feed, 'rich');
    expect(rich?.title).toBeNull();
    expect(rich?.imageUrl).toBe('https://example.com/itunes.jpg');
    expect(rich?.descriptionHtml).toBe('<p>From content</p>');
    expect(rich?.people).toEqual([
      {
        href: null,
        img: 'https://example.com/ada.jpg',
        name: 'Ada',
        role: 'host',
      },
      {
        href: 'https://example.com/bea',
        img: null,
        name: 'Bea',
        role: null,
      },
    ]);
    expect(rich?.startTime).toEqual(start);
    expect(rich?.statusId).toBe(LiveItemStatusEnum.Pending);

    expect(findAddByRssLiveItemDetail(feed, 'summary-only')?.imageUrl).toBe(
      'https://example.com/own.jpg'
    );
    expect(findAddByRssLiveItemDetail(feed, 'summary-only')?.title).toBe('On air');
    expect(findAddByRssLiveItemDetail(feed, 'summary-only')?.descriptionHtml).toBe('Only summary');
    expect(findAddByRssLiveItemDetail(feed, 'raw-only')?.descriptionHtml).toBe('Raw notes');
    expect(findAddByRssLiveItemDetail(feed, 'raw-only')?.imageUrl).toBeNull();
  });
});

describe('addByRssLiveStatusLabelKey', () => {
  it('names each livestream status', () => {
    expect(addByRssLiveStatusLabelKey(LiveItemStatusEnum.Live)).toBe('media.livestream.live');
    expect(addByRssLiveStatusLabelKey(LiveItemStatusEnum.Pending)).toBe('media.livestream.pending');
    expect(addByRssLiveStatusLabelKey(LiveItemStatusEnum.Ended)).toBe('media.livestream.ended');
  });
});
