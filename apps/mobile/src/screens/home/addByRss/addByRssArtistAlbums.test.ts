import { describe, expect, it } from 'vitest';

import type { AddByRSSResourceType } from '@podverse/helpers';
import { MediumEnum } from '@podverse/helpers/medium';

import type { AddByRssListedFeedRecord } from '../../../data/repositories/addByRssListedFeeds';
import type { AddByRssFeedWithRefs } from '../../../data/repositories/addByRssRepository';
import type { AddByRssArtistAlbumEntry } from './addByRssArtistAlbums';
import { buildAddByRssArtistAlbums, buildAddByRssArtistTrackSources } from './addByRssArtistAlbums';

const ARTIST_URL = 'https://example.com/artist.xml';
const OTHER_ARTIST_URL = 'https://example.com/other-artist.xml';

let nextId = 1;

const storedFeed = ({
  feedUrl,
  podcastGuid = null,
  publisherGuids = [],
  resourceType = 'albums',
  title,
}: {
  feedUrl: string;
  podcastGuid?: string | null;
  publisherGuids?: string[];
  resourceType?: AddByRSSResourceType;
  title: string;
}): AddByRssFeedWithRefs => {
  const id = nextId++;
  return {
    feed: {
      enclosureUrl: null,
      feedUrl,
      followed: false,
      id,
      idText: `feed${id}`,
      imageUrl: null,
      latestItemPubDateMs: null,
      playbackPosition: null,
      resourceType,
      title,
      updatedAt: '2026-01-01T00:00:00.000Z',
    },
    podcastGuid,
    publisherGuids,
  };
};

const listing = (
  overrides: Partial<AddByRssListedFeedRecord> & Pick<AddByRssListedFeedRecord, 'feedGuid'>
): AddByRssListedFeedRecord => ({
  publisherFeedUrl: ARTIST_URL,
  position: 0,
  kind: 'add_by_rss',
  feedUrl: null,
  title: null,
  listedAtChannelLevel: true,
  itemGuids: [],
  channelIdText: null,
  channelTitle: null,
  mediumId: null,
  imageUrl: null,
  artworkChecked: false,
  pendingRequestId: null,
  unresolvedReason: null,
  ...overrides,
});

const artist = storedFeed({
  feedUrl: ARTIST_URL,
  podcastGuid: 'artist-guid',
  resourceType: 'artists',
  title: 'The Artist',
});

const describeAlbums = (albums: readonly AddByRssArtistAlbumEntry[]): string[] =>
  albums.map((album) =>
    album.kind === 'directory' ? `directory:${album.channelIdText}` : `rss:${album.feed.feedUrl}`
  );

describe('buildAddByRssArtistAlbums', () => {
  it('keeps the artist listing order across directory and Add by RSS albums', () => {
    const albumA = storedFeed({ feedUrl: 'https://example.com/a.xml', title: 'A' });
    const result = buildAddByRssArtistAlbums({
      artist,
      feeds: [artist, albumA],
      listings: [
        listing({ feedGuid: 'a', feedUrl: albumA.feed.feedUrl, position: 0 }),
        listing({
          channelIdText: 'chan1',
          channelTitle: 'Directory Album',
          feedGuid: 'd',
          imageUrl: 'https://example.com/d.jpg',
          kind: 'directory',
          mediumId: MediumEnum.Music,
          position: 1,
        }),
      ],
    });

    expect(describeAlbums(result.albums)).toEqual([
      'rss:https://example.com/a.xml',
      'directory:chan1',
    ]);
    expect(result.albums[1]).toEqual({
      channelIdText: 'chan1',
      imageUrl: 'https://example.com/d.jpg',
      kind: 'directory',
      title: 'Directory Album',
    });
    expect(result.hasPending).toBe(false);
  });

  it('skips a directory listing whose channel is a podcast, and lists a channel once', () => {
    const result = buildAddByRssArtistAlbums({
      artist,
      feeds: [artist],
      listings: [
        listing({
          channelIdText: 'podcast1',
          feedGuid: 'p',
          kind: 'directory',
          mediumId: MediumEnum.Podcast,
        }),
        listing({ channelIdText: 'chan1', feedGuid: 'd1', kind: 'directory', title: 'Listed' }),
        listing({ channelIdText: 'chan1', feedGuid: 'd2', kind: 'directory' }),
      ],
    });

    expect(describeAlbums(result.albums)).toEqual(['directory:chan1']);
    expect(result.albums[0]).toMatchObject({ title: 'Listed' });
  });

  it('finds a stored album by guid when the listing names another URL', () => {
    const album = storedFeed({
      feedUrl: 'https://cdn.example.com/moved.xml',
      podcastGuid: 'album-guid',
      title: 'Moved',
    });
    const result = buildAddByRssArtistAlbums({
      artist,
      feeds: [artist, album],
      listings: [listing({ feedGuid: 'album-guid', feedUrl: 'https://example.com/old.xml' })],
    });

    expect(describeAlbums(result.albums)).toEqual(['rss:https://cdn.example.com/moved.xml']);
  });

  it('appends stored albums that name the artist but are not listed, by title, never the artist', () => {
    const listed = storedFeed({ feedUrl: 'https://example.com/listed.xml', title: 'Listed' });
    const zebra = storedFeed({
      feedUrl: 'https://example.com/zebra.xml',
      publisherGuids: ['artist-guid'],
      title: 'Zebra',
    });
    const apple = storedFeed({
      feedUrl: 'https://example.com/apple.xml',
      publisherGuids: ['artist-guid'],
      title: 'Apple',
    });
    const podcastNamingArtist = storedFeed({
      feedUrl: 'https://example.com/podcast.xml',
      publisherGuids: ['artist-guid'],
      resourceType: 'podcasts',
      title: 'Podcast',
    });
    const listedAndNaming = storedFeed({
      feedUrl: 'https://example.com/both.xml',
      publisherGuids: ['artist-guid'],
      title: 'Both',
    });
    const result = buildAddByRssArtistAlbums({
      artist,
      feeds: [artist, listed, zebra, apple, podcastNamingArtist, listedAndNaming],
      listings: [
        listing({ feedGuid: 'listed', feedUrl: listed.feed.feedUrl }),
        listing({ feedGuid: 'both', feedUrl: listedAndNaming.feed.feedUrl, position: 1 }),
        listing({ feedGuid: 'self', feedUrl: ARTIST_URL, position: 2 }),
      ],
    });

    expect(describeAlbums(result.albums)).toEqual([
      'rss:https://example.com/listed.xml',
      'rss:https://example.com/both.xml',
      'rss:https://example.com/apple.xml',
      'rss:https://example.com/zebra.xml',
    ]);
  });

  it('shows an album under each of two artists that list it', () => {
    const album = storedFeed({ feedUrl: 'https://example.com/shared.xml', title: 'Shared' });
    const otherArtist = storedFeed({
      feedUrl: OTHER_ARTIST_URL,
      podcastGuid: 'other-guid',
      resourceType: 'artists',
      title: 'Other',
    });
    const feeds = [artist, otherArtist, album];
    const forArtist = buildAddByRssArtistAlbums({
      artist,
      feeds,
      listings: [listing({ feedGuid: 'shared', feedUrl: album.feed.feedUrl })],
    });
    const forOtherArtist = buildAddByRssArtistAlbums({
      artist: otherArtist,
      feeds,
      listings: [
        listing({
          feedGuid: 'shared',
          feedUrl: album.feed.feedUrl,
          publisherFeedUrl: OTHER_ARTIST_URL,
        }),
      ],
    });

    expect(describeAlbums(forArtist.albums)).toEqual(['rss:https://example.com/shared.xml']);
    expect(describeAlbums(forOtherArtist.albums)).toEqual(['rss:https://example.com/shared.xml']);
  });

  it('marks a listed album still being parsed as pending without a row', () => {
    const result = buildAddByRssArtistAlbums({
      artist,
      feeds: [artist],
      listings: [
        listing({
          feedGuid: 'pending',
          feedUrl: 'https://example.com/pending.xml',
          pendingRequestId: 'r1',
        }),
        listing({ feedGuid: 'unresolved', kind: 'unresolved', position: 1 }),
      ],
    });

    expect(result.albums).toEqual([]);
    expect(result.hasPending).toBe(true);
  });
});

describe('buildAddByRssArtistTrackSources', () => {
  const listedAlbum = storedFeed({ feedUrl: 'https://example.com/listed.xml', title: 'Listed' });
  const otherAlbum = storedFeed({
    feedUrl: 'https://example.com/other.xml',
    podcastGuid: 'other-album',
    title: 'Other',
  });
  const feeds = [artist, listedAlbum, otherAlbum];
  const listings = [
    listing({ feedGuid: 'listed', feedUrl: listedAlbum.feed.feedUrl }),
    listing({
      feedGuid: 'listed',
      feedUrl: listedAlbum.feed.feedUrl,
      itemGuids: ['t1'],
      listedAtChannelLevel: false,
      position: 1,
    }),
    listing({
      feedGuid: 'other-album',
      feedUrl: null,
      itemGuids: ['o1', 'o2'],
      listedAtChannelLevel: false,
      position: 2,
    }),
    listing({
      feedGuid: 'other-album',
      feedUrl: otherAlbum.feed.feedUrl,
      itemGuids: ['o2', 'o3'],
      listedAtChannelLevel: false,
      position: 3,
    }),
    listing({
      channelIdText: 'chan1',
      feedGuid: 'dir',
      itemGuids: ['d1'],
      kind: 'directory',
      listedAtChannelLevel: false,
      position: 4,
    }),
  ];
  const albums = buildAddByRssArtistAlbums({ artist, feeds, listings }).albums;

  it('lists the artist, then whole albums, then referenced tracks of other stored albums', () => {
    const sources = buildAddByRssArtistTrackSources({ albums, artist, feeds, listings });

    expect(
      sources.map((source) => [
        source.feed.feedUrl,
        source.itemGuids === null ? null : [...source.itemGuids],
      ])
    ).toEqual([
      [ARTIST_URL, null],
      ['https://example.com/listed.xml', null],
      ['https://example.com/other.xml', ['o1', 'o2', 'o3']],
    ]);
  });

  it('adds nothing for a reference into a directory album or an album not stored', () => {
    const sources = buildAddByRssArtistTrackSources({
      albums: [],
      artist,
      feeds: [artist],
      listings: [
        listing({
          channelIdText: 'chan1',
          feedGuid: 'dir',
          itemGuids: ['d1'],
          kind: 'directory',
          listedAtChannelLevel: false,
        }),
        listing({
          feedGuid: 'missing',
          feedUrl: 'https://example.com/missing.xml',
          itemGuids: ['m1'],
          listedAtChannelLevel: false,
        }),
      ],
    });

    expect(sources.map((source) => source.feed.feedUrl)).toEqual([ARTIST_URL]);
  });
});
