import { describe, expect, it } from 'vitest';

import { getAddByRSSHashId } from '@podverse/helpers';
import { convertParsedRSSFeedToCompat, Phase4LiveStatus } from '@podverse/parser-mapping';

import type { MobileAddByRSSFeedRecord } from '../../prefs/addByRSSFeeds';
import {
  buildAddByRssFeedRecord,
  extractPreviewFromParsePayload,
  localFeedForServerFollow,
  mapParsedFeedToPreview,
  mergeLocalAndRemoteAddByRssFeeds,
  toAddByRssLiveItemPlaybackResourceData,
} from './domain';
import { addByRssPlaybackMediaId } from './resourceData';

const localFeed = (
  overrides: Partial<MobileAddByRSSFeedRecord> = {}
): MobileAddByRSSFeedRecord => ({
  enclosureUrl: null,
  feedUrl: 'https://e2e-seed-addbyrss.example/podcast.xml',
  id: 1,
  idText: 'rss-1',
  imageUrl: null,
  latestItemPubDateMs: null,
  playbackPosition: null,
  resourceType: 'podcasts',
  title: 'E2E Add-by-RSS Channel',
  updatedAt: '2026-01-01T00:00:00.000Z',
  ...overrides,
});

describe('localFeedForServerFollow', () => {
  const follow = {
    feed_url: 'https://example.com/moved.xml',
    image_url: 'https://example.com/art.jpg',
    title: 'Moved Show',
  };

  it('creates one local row from the follow and leaves an existing row alone', () => {
    const created = localFeedForServerFollow(follow, null);

    expect(created).not.toBeNull();
    expect(created?.feedUrl).toBe(follow.feed_url);
    expect(created?.title).toBe('Moved Show');
    expect(created?.imageUrl).toBe('https://example.com/art.jpg');
    if (created === null) {
      return;
    }
    expect(localFeedForServerFollow(follow, created)).toBeNull();
  });
});

describe('mergeLocalAndRemoteAddByRssFeeds', () => {
  it('keeps a parsed local title when the followed list still has the feed URL', () => {
    const feedUrl = 'https://e2e-seed-addbyrss.example/podcast.xml';
    const merged = mergeLocalAndRemoteAddByRssFeeds(
      [localFeed({ feedUrl })],
      [{ feed_url: feedUrl, image_url: null, title: feedUrl }]
    );

    expect(merged).toHaveLength(1);
    expect(merged[0]?.title).toBe('E2E Add-by-RSS Channel');
  });

  it('uses the followed title when this device has not parsed the feed yet', () => {
    const merged = mergeLocalAndRemoteAddByRssFeeds(
      [],
      [
        {
          feed_url: 'https://example.com/feed.xml',
          image_url: null,
          title: 'Remote Title',
        },
      ]
    );

    expect(merged).toHaveLength(1);
    expect(merged[0]?.title).toBe('Remote Title');
  });

  it('takes the credential flag from the account and keeps this device’s last auth failure', () => {
    const feedUrl = 'https://example.com/private.xml';
    const [flaggedElsewhere] = mergeLocalAndRemoteAddByRssFeeds(
      [],
      [{ feed_url: feedUrl, image_url: null, requires_credentials: true, title: null }]
    );
    expect(flaggedElsewhere?.requiresCredentials).toBe(true);
    expect(flaggedElsewhere?.lastAuthFailure).toBeNull();

    const [rejectedHere] = mergeLocalAndRemoteAddByRssFeeds(
      [localFeed({ feedUrl, lastAuthFailure: 'credentials_rejected', requiresCredentials: true })],
      [{ feed_url: feedUrl, image_url: null, title: null }]
    );
    expect(rejectedHere?.requiresCredentials).toBe(true);
    expect(rejectedHere?.lastAuthFailure).toBe('credentials_rejected');
  });

  it('keeps a stored album type and treats an unparsed follow as a podcast', () => {
    const feedUrl = 'https://example.com/album.xml';
    const [kept] = mergeLocalAndRemoteAddByRssFeeds(
      [localFeed({ feedUrl, resourceType: 'albums' })],
      [{ feed_url: feedUrl, image_url: null, title: 'Album' }]
    );
    expect(kept?.resourceType).toBe('albums');

    const [remoteOnly] = mergeLocalAndRemoteAddByRssFeeds(
      [],
      [{ feed_url: 'https://example.com/new.xml', image_url: null, title: 'New' }]
    );
    expect(remoteOnly?.resourceType).toBe('podcasts');
  });
});

describe('buildAddByRssFeedRecord', () => {
  const preview = {
    enclosureUrl: null,
    imageUrl: null,
    latestItemPubDateMs: null,
    playbackPosition: null,
    title: 'Artist',
  };

  it('keeps an existing artists type and defaults a new record to podcasts', () => {
    const existing = localFeed({ resourceType: 'artists' });

    expect(buildAddByRssFeedRecord(existing.feedUrl, existing, preview).resourceType).toBe(
      'artists'
    );
    expect(
      buildAddByRssFeedRecord('https://example.com/new.xml', undefined, preview).resourceType
    ).toBe('podcasts');
  });
});

const rawParsePayload = {
  items: [
    {
      enclosure: { length: 100, type: 'audio/mpeg', url: 'https://example.com/episode.mp3' },
      guid: 'episode-1',
      title: 'Episode One',
    },
  ],
  title: 'Show Name',
};

describe('add-by-RSS parse previews', () => {
  it('titles the feed record with the channel title, not its first episode', () => {
    const mappedFeed = convertParsedRSSFeedToCompat({
      explicit: false,
      items: [
        {
          duration: 60,
          enclosure: { length: 100, type: 'audio/mpeg', url: 'https://example.com/episode.mp3' },
          explicit: false,
          guid: 'episode-1',
          pubDate: new Date('2026-01-01T00:00:00.000Z'),
          title: 'Episode One',
        },
      ],
      link: 'https://example.com/feed.xml',
      title: 'Show Name',
    });

    expect(mapParsedFeedToPreview(mappedFeed).title).toBe('Show Name');
  });

  it('prefers the channel title in the raw payload fallback too', () => {
    expect(extractPreviewFromParsePayload(rawParsePayload).title).toBe('Show Name');
  });

  it('falls back to the first episode title when the feed has no channel title', () => {
    expect(extractPreviewFromParsePayload({ ...rawParsePayload, title: '  ' }).title).toBe(
      'Episode One'
    );
  });
});

describe('toAddByRssLiveItemPlaybackResourceData', () => {
  it('keeps the canonical feed url and the stored playback position, and hashes like a livestream row', () => {
    const record = localFeed({
      feedUrl: 'https://user:secret@example.com/show.xml',
      playbackPosition: '125',
    });
    const mappedFeed = convertParsedRSSFeedToCompat({
      explicit: false,
      items: [],
      link: 'https://example.com',
      podcastLiveItems: [
        {
          contentLinks: [],
          enclosure: { length: 1, type: 'audio/mpeg', url: 'https://example.com/live.mp3' },
          guid: 'studio-live',
          start: new Date('2026-06-01T15:00:00.000Z'),
          status: Phase4LiveStatus.Live,
        },
      ],
      title: 'Show',
    });
    const liveBundle = mappedFeed.liveItems[0];
    expect(liveBundle).toBeDefined();
    if (liveBundle === undefined) {
      return;
    }

    const data = toAddByRssLiveItemPlaybackResourceData(record, mappedFeed, liveBundle, 0);

    expect(data.feed_url).toBe('https://example.com/show.xml');
    expect(data.playback_position).toBe('125');
    expect(addByRssPlaybackMediaId(data)).toBe(
      getAddByRSSHashId({ feed_url: 'https://example.com/show.xml', guid: 'studio-live' })
    );
  });
});
