import { describe, expect, it } from 'vitest';

import { getAddByRSSHashId } from '@podverse/helpers';
import type { AddByRSSMappedFeed } from '@podverse/parser-mapping';
import { convertParsedRSSFeedToCompat, Phase4LiveStatus } from '@podverse/parser-mapping';

import type { MobileAddByRSSFeedRecord } from '../../prefs/addByRSSFeeds';
import type { LocalAddByRssFeedListLookup, LocalAddByRssFeedLookup } from './localResourceData';
import {
  addByRssEpisodeItemKey,
  findLocalAddByRssResourceDataByHash,
  resolveAddByRssNowPlayingItemSource,
  resolveLocalAddByRssResourceData,
} from './localResourceData';
import { addByRssPlaybackMediaId } from './resourceData';

const FEED_URL = 'https://example.com/feed.xml';
const CHAPTERS_URL = 'https://example.com/chapters.json';
const LOCAL_ENCLOSURE = 'https://cdn.example.com/episode-2-local.mp3';

const localRecord: MobileAddByRSSFeedRecord = {
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

const mappedFeed: AddByRSSMappedFeed = convertParsedRSSFeedToCompat({
  explicit: false,
  items: [
    {
      duration: 60,
      enclosure: { length: 100, type: 'audio/mpeg', url: 'https://cdn.example.com/episode-1.mp3' },
      explicit: false,
      guid: 'episode-guid-1',
      pubDate: new Date('2026-01-01T00:00:00.000Z'),
      title: 'Episode One',
    },
    {
      duration: 60,
      enclosure: { length: 100, type: 'audio/mpeg', url: LOCAL_ENCLOSURE },
      explicit: false,
      guid: 'episode-guid-2',
      podcastChapters: { type: 'application/json+chapters', url: CHAPTERS_URL },
      pubDate: new Date('2026-01-02T00:00:00.000Z'),
      title: 'Episode Two',
    },
  ],
  link: FEED_URL,
  title: 'Show Name',
});

const lookup = (
  record: MobileAddByRSSFeedRecord | null,
  feed: AddByRSSMappedFeed | null
): LocalAddByRssFeedLookup => ({
  getFeedByUrl: async (feedUrl) => (feedUrl === FEED_URL ? record : null),
  getMappedFeedByUrl: async (feedUrl) => (feedUrl === FEED_URL ? feed : null),
});

const webRow = {
  channel_id_text: 'web-channel-3',
  enclosure_url: 'https://cdn.example.com/episode-2-from-web.mp3',
  feed_url: FEED_URL,
  guid: 'episode-guid-2',
  title: 'Episode Two',
};

describe('resolveLocalAddByRssResourceData', () => {
  it('plays this phone’s copy of the episode a server row names by feed URL and guid', async () => {
    const resolved = await resolveLocalAddByRssResourceData(
      webRow,
      lookup(localRecord, mappedFeed)
    );

    expect(resolved.channel_id_text).toBe('phone-channel-7');
    expect(resolved.enclosure_url).toBe(LOCAL_ENCLOSURE);
    expect(getAddByRSSHashId(resolved)).toBe(getAddByRSSHashId(webRow));
  });

  it('plays the row as stored when this phone has not parsed the feed', async () => {
    const resolved = await resolveLocalAddByRssResourceData(webRow, lookup(null, null));

    expect(resolved).toEqual(webRow);
  });

  it('plays the row as stored when the local feed no longer has that episode', async () => {
    const row = { ...webRow, guid: 'episode-guid-gone', enclosure_url: 'https://gone.mp3' };

    const resolved = await resolveLocalAddByRssResourceData(row, lookup(localRecord, mappedFeed));

    expect(resolved).toEqual(row);
  });

  it('removes credentials from a row feed URL before looking the feed up', async () => {
    const row = { ...webRow, feed_url: 'https://user:secret@example.com/feed.xml' };

    const resolved = await resolveLocalAddByRssResourceData(row, lookup(localRecord, mappedFeed));

    expect(resolved.feed_url).toBe(FEED_URL);
    expect(resolved.channel_id_text).toBe('phone-channel-7');
  });
});

describe('addByRssEpisodeItemKey', () => {
  const feedIdText = 'phone-channel-7';
  const guidlessFeed: AddByRSSMappedFeed = convertParsedRSSFeedToCompat({
    explicit: false,
    items: [
      {
        duration: 30,
        enclosure: {
          length: 100,
          type: 'audio/mpeg',
          url: 'https://cdn.example.com/has-guid.mp3',
        },
        explicit: false,
        guid: 'kept-guid',
        pubDate: new Date('2026-01-01T00:00:00.000Z'),
        title: 'Has Guid',
      },
      {
        duration: 60,
        enclosure: { length: 100, type: 'audio/mpeg', url: LOCAL_ENCLOSURE },
        explicit: false,
        guid: '',
        pubDate: new Date('2026-01-02T00:00:00.000Z'),
        title: 'No Guid',
      },
    ],
    link: FEED_URL,
    title: 'Show Name',
  });

  it('returns the item guid when the resource guid is that guid', () => {
    expect(addByRssEpisodeItemKey(mappedFeed, { guid: 'episode-guid-1' })).toBe('episode-guid-1');
  });

  it('returns the index when a guidless item is matched by enclosure', () => {
    expect(
      addByRssEpisodeItemKey(guidlessFeed, {
        enclosure_url: LOCAL_ENCLOSURE,
        guid: `${feedIdText}-1`,
      })
    ).toBe('1');
  });

  it('returns null for a livestream', () => {
    expect(addByRssEpisodeItemKey(mappedFeed, { liveItem: {} })).toBe(null);
  });

  it('returns null when the guid and enclosure are not in the feed', () => {
    expect(
      addByRssEpisodeItemKey(mappedFeed, {
        enclosure_url: 'https://cdn.example.com/missing.mp3',
        guid: 'not-in-the-feed',
      })
    ).toBe(null);
  });
});

describe('resolveAddByRssNowPlayingItemSource', () => {
  it('returns this device’s copy of Episode Two, including its chapters URL', async () => {
    const resolved = await resolveAddByRssNowPlayingItemSource(
      webRow,
      lookup(localRecord, mappedFeed)
    );

    expect(resolved?.feedUrl).toBe(FEED_URL);
    expect(resolved?.itemIdText).toBe('phone-channel-7-episode-guid-2');
    expect(resolved?.sectionUrls?.chaptersFeedUrl).toBe(CHAPTERS_URL);
  });

  it('returns null when this device has not parsed the feed', async () => {
    const resolved = await resolveAddByRssNowPlayingItemSource(webRow, lookup(null, null));

    expect(resolved).toBeNull();
  });

  it('returns null for a livestream', async () => {
    const resolved = await resolveAddByRssNowPlayingItemSource(
      { ...webRow, liveItem: {} },
      lookup(localRecord, mappedFeed)
    );

    expect(resolved).toBeNull();
  });

  it('returns null when the guid and enclosure are not in the feed', async () => {
    const resolved = await resolveAddByRssNowPlayingItemSource(
      {
        ...webRow,
        enclosure_url: 'https://cdn.example.com/missing.mp3',
        guid: 'not-in-the-feed',
      },
      lookup(localRecord, mappedFeed)
    );

    expect(resolved).toBeNull();
  });
});

describe('findLocalAddByRssResourceDataByHash', () => {
  const LIVE_FEED_URL = 'https://example.com/live.xml';
  const UNPARSED_FEED_URL = 'https://example.com/unparsed.xml';

  const liveRecord: MobileAddByRSSFeedRecord = {
    ...localRecord,
    feedUrl: LIVE_FEED_URL,
    id: 8,
    idText: 'phone-channel-8',
    title: 'Live Show',
  };
  const unparsedRecord: MobileAddByRSSFeedRecord = {
    ...localRecord,
    feedUrl: UNPARSED_FEED_URL,
    id: 9,
    idText: 'phone-channel-9',
    title: 'Unparsed Show',
  };

  const liveFeed: AddByRSSMappedFeed = convertParsedRSSFeedToCompat({
    explicit: false,
    items: [],
    link: LIVE_FEED_URL,
    podcastLiveItems: [
      {
        contentLinks: [],
        enclosure: { length: 1, type: 'audio/mpeg', url: 'https://example.com/live.mp3' },
        guid: 'studio-live',
        start: new Date('2026-06-01T15:00:00.000Z'),
        status: Phase4LiveStatus.Live,
      },
    ],
    title: 'Live Show',
  });

  const listLookup = (): LocalAddByRssFeedListLookup => ({
    listFeeds: async () => [unparsedRecord, localRecord, liveRecord],
    getMappedFeedByUrl: async (feedUrl) => {
      if (feedUrl === FEED_URL) {
        return mappedFeed;
      }
      if (feedUrl === LIVE_FEED_URL) {
        return liveFeed;
      }
      return null;
    },
  });

  it('finds this phone’s copy of an episode by its playback hash', async () => {
    const found = await findLocalAddByRssResourceDataByHash(
      addByRssPlaybackMediaId(webRow),
      listLookup()
    );

    expect(found?.channel_id_text).toBe('phone-channel-7');
    expect(found?.enclosure_url).toBe(LOCAL_ENCLOSURE);
  });

  it('finds a livestream by its playback hash', async () => {
    const hashId = addByRssPlaybackMediaId({ feed_url: LIVE_FEED_URL, guid: 'studio-live' });

    const found = await findLocalAddByRssResourceDataByHash(hashId, listLookup());

    expect(found).not.toBeNull();
    expect(found === null ? null : addByRssPlaybackMediaId(found)).toBe(hashId);
  });

  it('skips a followed feed this phone has not parsed', async () => {
    const found = await findLocalAddByRssResourceDataByHash(
      addByRssPlaybackMediaId({ feed_url: UNPARSED_FEED_URL, guid: 'episode-guid-1' }),
      listLookup()
    );

    expect(found).toBeNull();
  });

  it('returns null when no local feed has that hash', async () => {
    const found = await findLocalAddByRssResourceDataByHash(
      addByRssPlaybackMediaId({ feed_url: FEED_URL, guid: 'not-in-the-feed' }),
      listLookup()
    );

    expect(found).toBeNull();
  });
});
