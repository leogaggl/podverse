import { describe, expect, it } from 'vitest';

import type {
  ClaimantFeed,
  PublisherClaim,
  PublisherFeedRefs,
  PublisherRemoteItemRef,
} from './verifiedPublisherMatch.js';
import { computeVerifiedPublisherLinks } from './verifiedPublisherMatch.js';

const ALBUM_GUID = '11111111-1111-4111-8111-111111111111';
const ARTIST_GUID = '22222222-2222-4222-8222-222222222222';
const SECOND_ARTIST_GUID = '33333333-3333-4333-8333-333333333333';
const ALBUM_URL = 'https://music.example.com/album/feed.xml';
const ARTIST_URL = 'https://music.example.com/artist/feed.xml';

function claim(partial: Partial<PublisherClaim> = {}): PublisherClaim {
  return {
    feedGuid: partial.feedGuid ?? ARTIST_GUID,
    feedUrl: partial.feedUrl ?? null,
    itemGuid: partial.itemGuid ?? null,
    itemId: partial.itemId ?? null,
    claimItemGuid: partial.claimItemGuid ?? null,
  };
}

function album(claims: PublisherClaim[], partial: Partial<ClaimantFeed> = {}): ClaimantFeed {
  return {
    channelId: 10,
    podcastGuid: partial.podcastGuid === undefined ? ALBUM_GUID : partial.podcastGuid,
    feedUrls: partial.feedUrls ?? [ALBUM_URL],
    claims,
  };
}

function remoteItem(partial: Partial<PublisherRemoteItemRef> = {}): PublisherRemoteItemRef {
  return {
    feedGuid: partial.feedGuid ?? ALBUM_GUID,
    feedUrl: partial.feedUrl ?? null,
    itemGuid: partial.itemGuid ?? null,
  };
}

function artist(partial: Partial<PublisherFeedRefs> = {}): PublisherFeedRefs {
  return {
    channelId: partial.channelId ?? 20,
    podcastGuid: partial.podcastGuid ?? ARTIST_GUID,
    feedUrls: partial.feedUrls ?? [ARTIST_URL],
    remoteItems: partial.remoteItems ?? [remoteItem()],
  };
}

describe('computeVerifiedPublisherLinks', () => {
  it('links at position 0 when guids match both ways and neither side carries a URL', () => {
    expect(computeVerifiedPublisherLinks(album([claim()]), [artist()])).toEqual([
      { publisherChannelId: 20, itemId: null, claimPosition: 0 },
    ]);
  });

  it('does not link when no publisher in the list has the claimed guid', () => {
    const claims = [claim({ feedGuid: SECOND_ARTIST_GUID })];
    expect(computeVerifiedPublisherLinks(album(claims), [artist()])).toEqual([]);
  });

  it('does not link when the publisher does not list the album back', () => {
    const publisher = artist({ remoteItems: [] });
    expect(computeVerifiedPublisherLinks(album([claim()]), [publisher])).toEqual([]);
  });

  it('does not link when the claim feedUrl names another host (a squatted guid)', () => {
    const claims = [claim({ feedUrl: 'https://squatter.example.net/artist/feed.xml' })];
    expect(computeVerifiedPublisherLinks(album(claims), [artist()])).toEqual([]);
  });

  it('links when the claim feedUrl differs only by scheme, a trailing slash, or host case', () => {
    for (const feedUrl of [
      'http://music.example.com/artist/feed.xml',
      'https://music.example.com/artist/feed.xml/',
      'https://MUSIC.Example.com/artist/feed.xml',
    ]) {
      const links = computeVerifiedPublisherLinks(album([claim({ feedUrl })]), [artist()]);
      expect(links).toHaveLength(1);
    }
  });

  it('links when the claim feedUrl equals a URL merged into the publisher', () => {
    const publisher = artist({
      feedUrls: [ARTIST_URL, 'https://old-host.example.org/artist.rss'],
    });
    const claims = [claim({ feedUrl: 'https://old-host.example.org/artist.rss' })];
    expect(computeVerifiedPublisherLinks(album(claims), [publisher])).toHaveLength(1);
  });

  it('does not link when the publisher remote item feedUrl names another album URL', () => {
    const publisher = artist({
      remoteItems: [remoteItem({ feedUrl: 'https://music.example.com/other-album/feed.xml' })],
    });
    expect(computeVerifiedPublisherLinks(album([claim()]), [publisher])).toEqual([]);
  });

  it('does not link when the URLs differ only by query string', () => {
    const publisher = artist({ feedUrls: ['https://music.example.com/feed.php?id=1'] });
    const claims = [claim({ feedUrl: 'https://music.example.com/feed.php?id=2' })];
    expect(computeVerifiedPublisherLinks(album(claims), [publisher])).toEqual([]);
  });

  it('links two publishers that both list the album at positions 0 and 1', () => {
    const second = artist({
      channelId: 30,
      podcastGuid: SECOND_ARTIST_GUID,
      feedUrls: ['https://music.example.com/second-artist/feed.xml'],
    });
    const claims = [claim(), claim({ feedGuid: SECOND_ARTIST_GUID })];
    expect(computeVerifiedPublisherLinks(album(claims), [second, artist()])).toEqual([
      { publisherChannelId: 20, itemId: null, claimPosition: 0 },
      { publisherChannelId: 30, itemId: null, claimPosition: 1 },
    ]);
  });

  it('keeps one link at the lower position when the same publisher is claimed twice', () => {
    const claims = [
      claim({ feedGuid: SECOND_ARTIST_GUID }),
      claim(),
      claim({ feedUrl: ARTIST_URL }),
    ];
    expect(computeVerifiedPublisherLinks(album(claims), [artist()])).toEqual([
      { publisherChannelId: 20, itemId: null, claimPosition: 1 },
    ]);
  });

  it('links an item-level claim only when the publisher lists that item guid', () => {
    const itemClaim = claim({ itemId: 501, claimItemGuid: 'track-guid-1' });
    const listsTrack = artist({
      remoteItems: [remoteItem({ itemGuid: 'track-guid-1' })],
    });
    expect(computeVerifiedPublisherLinks(album([itemClaim]), [listsTrack])).toEqual([
      { publisherChannelId: 20, itemId: 501, claimPosition: 0 },
    ]);
    expect(computeVerifiedPublisherLinks(album([itemClaim]), [artist()])).toEqual([]);
  });

  it('ignores a channel-level claim that carries its own itemGuid', () => {
    const claims = [claim({ itemGuid: 'publisher-item-guid' })];
    const publisher = artist({
      remoteItems: [remoteItem(), remoteItem({ itemGuid: 'publisher-item-guid' })],
    });
    expect(computeVerifiedPublisherLinks(album(claims), [publisher])).toEqual([]);
  });

  it('returns no links when the claimant has no guid', () => {
    expect(
      computeVerifiedPublisherLinks(album([claim()], { podcastGuid: null }), [artist()])
    ).toEqual([]);
  });
});
