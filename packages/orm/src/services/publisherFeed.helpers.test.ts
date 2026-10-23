import { describe, expect, it } from 'vitest';

import type { PublisherAlbumRemoteRef } from './publisherFeed.helpers.js';
import {
  feedUrlsForPublisherAlbumUrlLookup,
  isPublisherAlbumRemoteRef,
  partitionPublisherAlbumRefs,
} from './publisherFeed.helpers.js';

describe('isPublisherAlbumRemoteRef', () => {
  it('is true for a feed_guid without item_guid', () => {
    expect(
      isPublisherAlbumRemoteRef({
        feed_guid: 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee',
        feed_url: null,
        item_guid: null,
      })
    ).toBe(true);
  });

  it('is true for a feed_url without item_guid even when feed_guid is empty', () => {
    expect(
      isPublisherAlbumRemoteRef({
        feed_guid: '',
        feed_url: 'https://example.com/album.xml',
        item_guid: null,
      })
    ).toBe(true);
  });

  it('is false when item_guid is set (track ref)', () => {
    expect(
      isPublisherAlbumRemoteRef({
        feed_guid: 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee',
        feed_url: 'https://example.com/album.xml',
        item_guid: 'track-1',
      })
    ).toBe(false);
  });

  it('is false when both guid and url are blank', () => {
    expect(
      isPublisherAlbumRemoteRef({
        feed_guid: '  ',
        feed_url: null,
        item_guid: null,
      })
    ).toBe(false);
  });
});

describe('feedUrlsForPublisherAlbumUrlLookup', () => {
  it('returns unique trimmed urls from unmatched album refs', () => {
    expect(
      feedUrlsForPublisherAlbumUrlLookup([
        {
          feed_guid: 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee',
          feed_url: ' https://example.com/a.xml ',
          item_guid: null,
        },
        {
          feed_guid: 'bbbbbbbb-bbbb-cccc-dddd-eeeeeeeeeeee',
          feed_url: 'https://example.com/a.xml',
          item_guid: null,
        },
        {
          feed_guid: 'cccccccc-bbbb-cccc-dddd-eeeeeeeeeeee',
          feed_url: null,
          item_guid: null,
        },
        {
          feed_guid: 'dddddddd-bbbb-cccc-dddd-eeeeeeeeeeee',
          feed_url: 'https://example.com/b.xml',
          item_guid: 'track',
        },
        {
          feed_guid: 'eeeeeeee-bbbb-cccc-dddd-eeeeeeeeeeee',
          feed_url: 'https://example.com/c.xml',
          item_guid: null,
        },
      ])
    ).toEqual(['https://example.com/a.xml', 'https://example.com/c.xml']);
  });
});

function albumRef(
  feedGuid: string | null,
  feedUrl: string | null,
  itemGuid: string | null = null
): PublisherAlbumRemoteRef {
  return { feed_guid: feedGuid, feed_url: feedUrl, item_guid: itemGuid };
}

describe('partitionPublisherAlbumRefs', () => {
  it('returns verified matches in reference order', () => {
    const result = partitionPublisherAlbumRefs({
      refs: [albumRef('GUID-B', null), albumRef('guid-a', 'https://example.com/a.xml')],
      matches: {
        parsedChannelIdByGuid: new Map([
          ['guid-a', 1],
          ['guid-b', 2],
        ]),
        parsedChannelIdByFeedUrl: new Map([['https://example.com/a.xml', 99]]),
      },
      verifiedAlbumChannelIds: new Set([1, 2]),
    });

    expect(result.verifiedChannelIds).toEqual([2, 1]);
    expect(result.notYetAddedRefs).toEqual([]);
  });

  it('drops a parsed guid match that is not verified', () => {
    const ref = albumRef('aaa', 'https://example.com/a.xml');
    const result = partitionPublisherAlbumRefs({
      refs: [ref],
      matches: {
        parsedChannelIdByGuid: new Map([['aaa', 10]]),
        parsedChannelIdByFeedUrl: new Map([['https://example.com/a.xml', 10]]),
      },
      verifiedAlbumChannelIds: new Set<number>(),
    });

    expect(result.verifiedChannelIds).toEqual([]);
    expect(result.notYetAddedRefs).toEqual([]);
  });

  it('counts a verified URL match and drops an unverified URL match', () => {
    const result = partitionPublisherAlbumRefs({
      refs: [
        albumRef(null, 'https://example.com/verified.xml'),
        albumRef('', ' https://example.com/dropped.xml '),
      ],
      matches: {
        parsedChannelIdByGuid: new Map(),
        parsedChannelIdByFeedUrl: new Map([
          ['https://example.com/verified.xml', 7],
          ['https://example.com/dropped.xml', 8],
        ]),
      },
      verifiedAlbumChannelIds: new Set([7]),
    });

    expect(result.verifiedChannelIds).toEqual([7]);
    expect(result.notYetAddedRefs).toEqual([]);
  });

  it('sends an unmatched reference to notYetAddedRefs once when it is listed twice', () => {
    const first = albumRef('Unknown-Guid', 'https://example.com/missing.xml');
    const second = albumRef(' unknown-guid ', 'https://example.com/other.xml');
    const result = partitionPublisherAlbumRefs({
      refs: [first, second],
      matches: {
        parsedChannelIdByGuid: new Map(),
        parsedChannelIdByFeedUrl: new Map(),
      },
      verifiedAlbumChannelIds: new Set<number>(),
    });

    expect(result.verifiedChannelIds).toEqual([]);
    expect(result.notYetAddedRefs).toEqual([first]);
  });

  it('ignores item-level references', () => {
    const result = partitionPublisherAlbumRefs({
      refs: [albumRef('guid-track-album', null, 'track-1'), albumRef('guid-album', null)],
      matches: {
        parsedChannelIdByGuid: new Map([
          ['guid-track-album', 2],
          ['guid-album', 1],
        ]),
        parsedChannelIdByFeedUrl: new Map(),
      },
      verifiedAlbumChannelIds: new Set([1, 2]),
    });

    expect(result.verifiedChannelIds).toEqual([1, 2]);
    expect(result.notYetAddedRefs).toEqual([]);
  });

  it('appends a verified id no reference reaches', () => {
    const result = partitionPublisherAlbumRefs({
      refs: [albumRef('guid-album', null)],
      matches: {
        parsedChannelIdByGuid: new Map([['guid-album', 4]]),
        parsedChannelIdByFeedUrl: new Map(),
      },
      verifiedAlbumChannelIds: new Set([9, 4, 2]),
    });

    expect(result.verifiedChannelIds).toEqual([4, 2, 9]);
    expect(result.notYetAddedRefs).toEqual([]);
  });
});
