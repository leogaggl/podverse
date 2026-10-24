import { describe, expect, it } from 'vitest';

import type { AddByRSSMappedFeed, FeedObject } from '@podverse/parser-mapping';
import { convertParsedRSSFeedToCompat } from '@podverse/parser-mapping';

import {
  addByRssPublisherRefsFromMappedFeed,
  parseStoredPublisherDirectoryMatches,
  parseStoredPublisherGuids,
} from './publisherRefs';

const FEED_URL = 'https://example.com/album.xml';
const ARTIST_URL = 'https://example.com/artist.xml';

const mappedBundle = (overrides: Partial<FeedObject> = {}): AddByRSSMappedFeed => {
  const items: FeedObject['items'] = [];
  return convertParsedRSSFeedToCompat({
    explicit: false,
    items,
    link: FEED_URL,
    title: 'Album',
    ...overrides,
  });
};

/** A bundle that names several publishers, built from one mapped pointer so its shape stays real. */
const withPublisherGuids = (mapped: AddByRSSMappedFeed, guids: string[]): AddByRSSMappedFeed => {
  const [pointer] = mapped.channel.publisherRemoteItems;
  if (pointer === undefined) {
    throw new Error('fixture needs a publisher pointer');
  }
  return {
    ...mapped,
    channel: {
      ...mapped.channel,
      publisherRemoteItems: guids.map((feedGuid) => ({ ...pointer, feed_guid: feedGuid })),
    },
  };
};

describe('addByRssPublisherRefsFromMappedFeed', () => {
  it('lowercases the feed guid and the publisher pointer guid', () => {
    const mapped = mappedBundle({
      guid: ' ALBUM-Guid ',
      podcastPublisher: { feedGuid: 'ARTIST-Guid', feedUrl: ARTIST_URL },
    });

    expect(addByRssPublisherRefsFromMappedFeed(mapped)).toEqual({
      podcastGuid: 'album-guid',
      publisherPointers: [{ feedGuid: 'artist-guid', feedUrl: ARTIST_URL }],
    });
  });

  it('keeps the first pointer per guid, in feed order, and drops empty guids', () => {
    const mapped = withPublisherGuids(
      mappedBundle({ podcastPublisher: { feedGuid: 'a', feedUrl: ARTIST_URL } }),
      ['B', '  ', 'a', 'b']
    );

    expect(
      addByRssPublisherRefsFromMappedFeed(mapped).publisherPointers.map(
        (pointer) => pointer.feedGuid
      )
    ).toEqual(['b', 'a']);
  });

  it('gives no guid and no pointers for a bundle without either', () => {
    expect(addByRssPublisherRefsFromMappedFeed(mappedBundle())).toEqual({
      podcastGuid: null,
      publisherPointers: [],
    });
  });
});

describe('stored publisher parsers', () => {
  it('return an empty list for null, a bare string, and an object', () => {
    for (const json of [null, 'x', '{}']) {
      expect(parseStoredPublisherGuids(json)).toEqual([]);
      expect(parseStoredPublisherDirectoryMatches(json)).toEqual([]);
    }
  });

  it('keep strings and well-formed matches only', () => {
    expect(parseStoredPublisherGuids(JSON.stringify(['a', 1, null, 'b']))).toEqual(['a', 'b']);

    const valid = { feedGuid: 'a', channelIdText: 'chan1', channelTitle: null, mediumId: 3 };
    expect(
      parseStoredPublisherDirectoryMatches(
        JSON.stringify([
          valid,
          { feedGuid: 'b', channelIdText: 7, channelTitle: null, mediumId: null },
          { feedGuid: 'c', channelIdText: 'chan3', channelTitle: 5, mediumId: null },
          { feedGuid: 'd', channelIdText: 'chan4', channelTitle: 'T' },
          'e',
        ])
      )
    ).toEqual([valid]);
  });
});
