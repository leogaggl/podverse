import { describe, expect, it } from 'vitest';

import { getAddByRSSHashId } from '@podverse/helpers';
import type { AddByRSSMappedFeed } from '@podverse/parser-mapping';
import { convertParsedRSSFeedToCompat } from '@podverse/parser-mapping';

import type { MobileAddByRSSFeedRecord } from '../../prefs/addByRSSFeeds';
import type { LocalAddByRssFeedLookup } from './localResourceData';
import { resolveLocalAddByRssResourceData } from './localResourceData';

const FEED_URL = 'https://example.com/feed.xml';
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
