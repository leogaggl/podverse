import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { LineArtist } from '../playback/lineArtist';
import { lineArtistTitle } from '../playback/lineArtist';
import type { AddByRssArtistIndexFeed, AddByRssArtistIndexListing } from './addByRssArtistIndex';
import {
  addByRssAlbumArtists,
  addByRssAlbumsNamingDirectoryArtist,
  addByRssArtistsListingDirectoryAlbum,
  getAddByRssArtistIndexVersion,
  hydrateAddByRssArtistIndex,
  resetAddByRssArtistIndexForTests,
  subscribeAddByRssArtistIndex,
} from './addByRssArtistIndex';

const ARTIST_MEDIUM_ID = 22;
const ALBUM_MEDIUM_ID = 3;

const ALBUM_URL = 'https://example.com/album.xml';
const ALBUM_GUID = 'album-guid';

const feed = (
  overrides: Partial<AddByRssArtistIndexFeed> &
    Pick<AddByRssArtistIndexFeed, 'feedUrl' | 'feedIdText' | 'title'>
): AddByRssArtistIndexFeed => ({
  resourceType: 'artists',
  followed: true,
  podcastGuid: null,
  publisherGuids: [],
  directoryMatches: [],
  ...overrides,
});

const artist = (name: string, title: string): AddByRssArtistIndexFeed =>
  feed({
    feedUrl: `https://example.com/${name}.xml`,
    feedIdText: `${name}-id`,
    title,
    podcastGuid: `${name}-guid`,
  });

const album = (overrides: Partial<AddByRssArtistIndexFeed> = {}): AddByRssArtistIndexFeed =>
  feed({
    feedUrl: ALBUM_URL,
    feedIdText: 'album-id',
    title: 'Album',
    resourceType: 'albums',
    podcastGuid: ALBUM_GUID,
    ...overrides,
  });

const listing = (
  overrides: Partial<AddByRssArtistIndexListing> &
    Pick<AddByRssArtistIndexListing, 'publisherFeedUrl'>
): AddByRssArtistIndexListing => ({
  feedGuid: ALBUM_GUID,
  feedUrl: null,
  kind: 'add_by_rss',
  channelIdText: null,
  mediumId: null,
  listedAtChannelLevel: true,
  ...overrides,
});

const artistA = artist('artist-a', 'Artist A');
const artistB = artist('artist-b', 'Artist B');

const titles = (artists: readonly LineArtist[]): string[] => artists.map(lineArtistTitle);

beforeEach(() => {
  resetAddByRssArtistIndexForTests();
});

describe('addByRssAlbumArtists', () => {
  it('returns nothing before the index is hydrated', () => {
    expect(addByRssAlbumArtists(ALBUM_URL)).toEqual([]);
  });

  it('lists the named artist first, then a listing artist, each once', () => {
    hydrateAddByRssArtistIndex({
      feeds: [artistB, artistA, album({ publisherGuids: ['artist-a-guid'] })],
      listings: [listing({ publisherFeedUrl: artistB.feedUrl })],
    });
    expect(addByRssAlbumArtists(ALBUM_URL)).toEqual([
      {
        kind: 'add-by-rss',
        feedIdText: 'artist-a-id',
        feedUrl: artistA.feedUrl,
        title: 'Artist A',
      },
      {
        kind: 'add-by-rss',
        feedIdText: 'artist-b-id',
        feedUrl: artistB.feedUrl,
        title: 'Artist B',
      },
    ]);

    hydrateAddByRssArtistIndex({
      feeds: [artistB, artistA, album({ publisherGuids: ['artist-a-guid'] })],
      listings: [
        listing({ publisherFeedUrl: artistB.feedUrl }),
        listing({ publisherFeedUrl: artistA.feedUrl }),
      ],
    });
    expect(titles(addByRssAlbumArtists(ALBUM_URL))).toEqual(['Artist A', 'Artist B']);
  });

  it('resolves an album two artists list, one by URL host case and one by guid, by title', () => {
    const zed = artist('zed', 'Zed');
    const alpha = artist('alpha', 'Alpha');
    hydrateAddByRssArtistIndex({
      feeds: [zed, alpha, album()],
      listings: [
        listing({
          publisherFeedUrl: zed.feedUrl,
          feedGuid: 'some-other-guid',
          feedUrl: 'https://EXAMPLE.com/album.xml',
        }),
        listing({ publisherFeedUrl: alpha.feedUrl }),
      ],
    });
    expect(titles(addByRssAlbumArtists(ALBUM_URL))).toEqual(['Alpha', 'Zed']);
  });

  it('falls back to a stored directory artist match only when no Add by RSS artist applies', () => {
    hydrateAddByRssArtistIndex({
      feeds: [
        album({
          directoryMatches: [
            {
              feedGuid: 'dir-guid',
              channelIdText: 'dir-artist',
              channelTitle: 'Directory Artist',
              mediumId: ARTIST_MEDIUM_ID,
            },
            {
              feedGuid: 'dir-guid-again',
              channelIdText: 'dir-artist',
              channelTitle: 'Directory Artist',
              mediumId: ARTIST_MEDIUM_ID,
            },
          ],
        }),
      ],
      listings: [],
    });
    expect(addByRssAlbumArtists(ALBUM_URL)).toEqual([
      {
        kind: 'directory',
        publisher: {
          id_text: 'dir-artist',
          title: 'Directory Artist',
          medium_id: ARTIST_MEDIUM_ID,
        },
      },
    ]);

    hydrateAddByRssArtistIndex({
      feeds: [
        album({
          directoryMatches: [
            {
              feedGuid: 'dir-guid',
              channelIdText: 'dir-album',
              channelTitle: 'Directory Album',
              mediumId: ALBUM_MEDIUM_ID,
            },
          ],
        }),
      ],
      listings: [],
    });
    expect(addByRssAlbumArtists(ALBUM_URL)).toEqual([]);
  });

  it('returns nothing on a podcast-only device', () => {
    hydrateAddByRssArtistIndex({
      feeds: [
        feed({
          feedUrl: 'https://example.com/podcast.xml',
          feedIdText: 'podcast-id',
          title: 'Podcast',
          resourceType: 'podcasts',
        }),
      ],
      listings: [],
    });
    expect(addByRssAlbumArtists('https://example.com/podcast.xml')).toEqual([]);
    expect(addByRssAlbumArtists(ALBUM_URL)).toEqual([]);
  });
});

describe('addByRssArtistsListingDirectoryAlbum', () => {
  it('matches a directory listing by channel id and, separately, any listing by guid', () => {
    hydrateAddByRssArtistIndex({
      feeds: [artistA, artistB],
      listings: [
        listing({
          publisherFeedUrl: artistA.feedUrl,
          kind: 'directory',
          feedGuid: 'unrelated-guid',
          channelIdText: 'dir-album',
          mediumId: ALBUM_MEDIUM_ID,
        }),
        listing({ publisherFeedUrl: artistB.feedUrl, feedGuid: 'dir-album-guid' }),
      ],
    });
    expect(
      titles(
        addByRssArtistsListingDirectoryAlbum({ channelIdText: 'dir-album', podcastGuid: null })
      )
    ).toEqual(['Artist A']);
    expect(
      titles(
        addByRssArtistsListingDirectoryAlbum({
          channelIdText: 'other',
          podcastGuid: ' DIR-ALBUM-GUID ',
        })
      )
    ).toEqual(['Artist B']);
  });

  it('ignores a listing made only at item level', () => {
    hydrateAddByRssArtistIndex({
      feeds: [artistA],
      listings: [
        listing({
          publisherFeedUrl: artistA.feedUrl,
          kind: 'directory',
          channelIdText: 'dir-album',
          listedAtChannelLevel: false,
        }),
      ],
    });
    expect(
      addByRssArtistsListingDirectoryAlbum({ channelIdText: 'dir-album', podcastGuid: ALBUM_GUID })
    ).toEqual([]);
  });
});

describe('addByRssAlbumsNamingDirectoryArtist', () => {
  it('returns followed and listed-only albums naming the artist, by title', () => {
    const match = (channelIdText: string) => ({
      feedGuid: `${channelIdText}-guid`,
      channelIdText,
      channelTitle: null,
      mediumId: ARTIST_MEDIUM_ID,
    });
    hydrateAddByRssArtistIndex({
      feeds: [
        album({
          feedUrl: 'https://example.com/z.xml',
          feedIdText: 'z',
          title: 'Zebra',
          directoryMatches: [match('dir-artist')],
        }),
        album({
          feedUrl: 'https://example.com/a.xml',
          feedIdText: 'a',
          title: 'Aardvark',
          followed: false,
          directoryMatches: [match('dir-artist')],
        }),
        album({
          feedUrl: 'https://example.com/o.xml',
          feedIdText: 'o',
          title: 'Other',
          directoryMatches: [match('another-artist')],
        }),
        feed({
          feedUrl: 'https://example.com/p.xml',
          feedIdText: 'p',
          title: 'Podcast',
          resourceType: 'podcasts',
          directoryMatches: [match('dir-artist')],
        }),
      ],
      listings: [],
    });
    expect(addByRssAlbumsNamingDirectoryArtist('dir-artist').map((entry) => entry.title)).toEqual([
      'Aardvark',
      'Zebra',
    ]);
  });
});

describe('subscribeAddByRssArtistIndex', () => {
  it('bumps the version and notifies a listener until it unsubscribes', () => {
    const listener = vi.fn();
    const unsubscribe = subscribeAddByRssArtistIndex(listener);
    expect(getAddByRssArtistIndexVersion()).toBe(0);

    hydrateAddByRssArtistIndex({ feeds: [], listings: [] });
    expect(getAddByRssArtistIndexVersion()).toBe(1);
    expect(listener).toHaveBeenCalledTimes(1);

    unsubscribe();
    hydrateAddByRssArtistIndex({ feeds: [], listings: [] });
    expect(getAddByRssArtistIndexVersion()).toBe(2);
    expect(listener).toHaveBeenCalledTimes(1);
  });
});
