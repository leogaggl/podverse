import { describe, expect, it } from 'vitest';

import type { AddByRSSMappedFeed } from '@podverse/parser-mapping';
import { convertParsedRSSFeedToCompat, Phase4LiveStatus } from '@podverse/parser-mapping';
import type { AddByRSSAdjacentDirection } from '@podverse/playback-core/addByRSSListWalk';
import { resolveAddByRSSAdjacentStep } from '@podverse/playback-core/addByRSSListWalk';

import type { MobileAddByRSSFeedRecord } from '../../prefs/addByRSSFeeds';
import {
  toAddByRssItemPlaybackResourceData,
  toAddByRssLiveItemPlaybackResourceData,
} from './domain';
import type { AddByRssFeedWalk } from './feedWalk';
import {
  addByRssEpisodePlayEntry,
  buildAddByRssFeedWalk,
  findAddByRssEpisodePlayEntry,
} from './feedWalk';
import { addByRssPlaybackMediaId } from './resourceData';

const FEED_URL = 'https://example.com/feed.xml';

const record: MobileAddByRSSFeedRecord = {
  enclosureUrl: null,
  feedUrl: FEED_URL,
  id: 7,
  idText: 'phone-channel-7',
  imageUrl: null,
  latestItemPubDateMs: null,
  playbackPosition: null,
  resourceType: 'podcasts',
  title: 'Show Name',
  updatedAt: '2026-01-01T00:00:00.000Z',
};

const episode = (guid: string, title: string, pubDate?: string) => ({
  duration: 60,
  enclosure: { length: 100, type: 'audio/mpeg', url: `https://cdn.example.com/${guid}.mp3` },
  explicit: false,
  guid,
  ...(pubDate !== undefined ? { pubDate: new Date(pubDate) } : {}),
  title,
});

/** Feed order is not publish order: middle, newest, oldest. */
const mappedFeed: AddByRSSMappedFeed = convertParsedRSSFeedToCompat({
  explicit: false,
  items: [
    episode('ep-2', 'Episode Two', '2026-01-02T00:00:00.000Z'),
    episode('ep-3', 'Episode Three', '2026-01-03T00:00:00.000Z'),
    episode('ep-1', 'Episode One', '2026-01-01T00:00:00.000Z'),
  ],
  link: FEED_URL,
  title: 'Show Name',
});

const itemResource = (feed: AddByRSSMappedFeed, guid: string) => {
  const itemIndex = feed.items.findIndex((bundle) => bundle.item.guid === guid);
  const itemBundle = feed.items[itemIndex];
  if (itemBundle === undefined) {
    throw new Error(`fixture has no item ${guid}`);
  }
  return toAddByRssItemPlaybackResourceData(record, feed, itemBundle, itemIndex);
};

const stepTitle = (walk: AddByRssFeedWalk, direction: AddByRSSAdjacentDirection) => {
  const step = resolveAddByRSSAdjacentStep(walk.context, direction);
  if (step.kind !== 'step') {
    return null;
  }
  return walk.entries.get(step.idText)?.resourceData.title ?? null;
};

const orderedTitles = (walk: AddByRssFeedWalk) =>
  (walk.context?.itemIdTexts ?? []).map((idText) => walk.entries.get(idText)?.resourceData.title);

describe('buildAddByRssFeedWalk', () => {
  it('orders episodes newest first whatever the feed order', () => {
    const walk = buildAddByRssFeedWalk(record, mappedFeed, itemResource(mappedFeed, 'ep-2'));

    expect(orderedTitles(walk)).toEqual(['Episode Three', 'Episode Two', 'Episode One']);
  });

  it('steps Next to the newer episode and Previous to the older one from the middle', () => {
    const walk = buildAddByRssFeedWalk(record, mappedFeed, itemResource(mappedFeed, 'ep-2'));

    expect(stepTitle(walk, 'next')).toBe('Episode Three');
    expect(stepTitle(walk, 'previous')).toBe('Episode One');
  });

  it('gives the newest episode no Next and the oldest no Previous', () => {
    const newest = buildAddByRssFeedWalk(record, mappedFeed, itemResource(mappedFeed, 'ep-3'));
    const oldest = buildAddByRssFeedWalk(record, mappedFeed, itemResource(mappedFeed, 'ep-1'));

    expect(stepTitle(newest, 'next')).toBeNull();
    expect(stepTitle(newest, 'previous')).toBe('Episode Two');
    expect(stepTitle(oldest, 'previous')).toBeNull();
    expect(stepTitle(oldest, 'next')).toBe('Episode Two');
  });

  it('leaves out items without an enclosure', () => {
    const feed: AddByRSSMappedFeed = {
      ...mappedFeed,
      items: mappedFeed.items.map((bundle) =>
        bundle.item.guid === 'ep-2' ? { ...bundle, enclosures: [] } : bundle
      ),
    };
    const walk = buildAddByRssFeedWalk(record, feed, itemResource(feed, 'ep-1'));

    expect(orderedTitles(walk)).toEqual(['Episode Three', 'Episode One']);
    expect(stepTitle(walk, 'next')).toBe('Episode Three');
  });

  it('sorts an episode with no publish date oldest', () => {
    const feed = convertParsedRSSFeedToCompat({
      explicit: false,
      items: [
        episode('undated', 'Undated'),
        episode('ep-1', 'Episode One', '2026-01-01T00:00:00.000Z'),
      ],
      link: FEED_URL,
      title: 'Show Name',
    });
    const walk = buildAddByRssFeedWalk(record, feed, itemResource(feed, 'ep-1'));

    expect(orderedTitles(walk)).toEqual(['Episode One', 'Undated']);
    expect(stepTitle(walk, 'previous')).toBe('Undated');
  });

  it('walks a livestream through the channel live order', () => {
    const now = new Date('2026-06-13T12:00:00.000Z');
    const live = (guid: string, title: string, status: Phase4LiveStatus, start: string) => ({
      contentLinks: [],
      enclosure: { length: 1, type: 'audio/mpeg', url: `https://example.com/${guid}.mp3` },
      guid,
      start: new Date(start),
      status,
      title,
    });
    const feed = convertParsedRSSFeedToCompat({
      explicit: false,
      items: [],
      link: FEED_URL,
      podcastLiveItems: [
        live('soon', 'Soon', Phase4LiveStatus.Pending, '2026-06-14T12:00:00.000Z'),
        live('on-air', 'On Air', Phase4LiveStatus.Live, '2026-06-13T11:00:00.000Z'),
      ],
      title: 'Show Name',
    });
    const pendingBundle = feed.liveItems[0];
    if (pendingBundle === undefined) {
      throw new Error('fixture has no scheduled livestream');
    }
    const current = toAddByRssLiveItemPlaybackResourceData(record, feed, pendingBundle, 0);

    const walk = buildAddByRssFeedWalk(record, feed, current, now);

    expect(orderedTitles(walk)).toEqual(['On Air', 'Soon']);
    expect(stepTitle(walk, 'next')).toBe('On Air');
    expect(stepTitle(walk, 'previous')).toBeNull();
  });

  it('has no context when the playing resource is not in the feed', () => {
    const walk = buildAddByRssFeedWalk(record, mappedFeed, {
      enclosure_url: 'https://cdn.example.com/missing.mp3',
      feed_url: FEED_URL,
      guid: 'not-in-the-feed',
    });

    expect(walk.context).toBeNull();
    expect(stepTitle(walk, 'next')).toBeNull();
    expect(stepTitle(walk, 'previous')).toBeNull();
  });
});

describe('addByRssEpisodePlayEntry', () => {
  it('names the download id and the playback media id the row tap uses', () => {
    const itemBundle = mappedFeed.items[0];
    if (itemBundle === undefined) {
      throw new Error('fixture has no first item');
    }

    const entry = addByRssEpisodePlayEntry(record, mappedFeed, itemBundle, 0);

    expect(entry?.resourceData.title).toBe('Episode Two');
    expect(entry?.localDownloadItemIdText).toBe(`${FEED_URL}::ep-2`);
  });
});

describe('findAddByRssEpisodePlayEntry', () => {
  it('finds the entry for a media id in the feed and null for one that is not', () => {
    const mediaId = addByRssPlaybackMediaId(itemResource(mappedFeed, 'ep-3'));

    expect(findAddByRssEpisodePlayEntry(record, mappedFeed, mediaId)?.resourceData.title).toBe(
      'Episode Three'
    );
    expect(findAddByRssEpisodePlayEntry(record, mappedFeed, 'not-in-the-feed')).toBeNull();
  });
});
