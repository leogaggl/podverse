import { describe, expect, it } from 'vitest';

import type { AddByRSSPublisherListedFeed } from '@podverse/helpers';
import type { AddByRSSMappedFeed } from '@podverse/parser-mapping';
import { convertParsedRSSFeedToCompat } from '@podverse/parser-mapping';

import type { AddByRssListedFeedRecord } from './addByRssListedFeeds';
import {
  decideListedAlbumStore,
  directoryLookupDue,
  groupPendingListedAlbums,
  isFeedListed,
  listedOnlyFeedUrlsToRemove,
  toListedFeedInserts,
} from './addByRssListedFeeds';

const ARTIST_A = 'https://example.com/artist-a.xml';
const ARTIST_B = 'https://example.com/artist-b.xml';
const ALBUM_URL = 'https://example.com/album.xml';

const shared = {
  feedUrl: null,
  title: null,
  listedAtChannelLevel: true,
  itemGuids: [],
};

const directoryEntry = (feedGuid: string, channelIdText: string): AddByRSSPublisherListedFeed => ({
  ...shared,
  feedGuid,
  kind: 'directory',
  channelIdText,
  channelTitle: 'Directory Album',
  mediumId: 3,
});

const storedRecord = (
  overrides: Partial<AddByRssListedFeedRecord> & Pick<AddByRssListedFeedRecord, 'feedGuid'>
): AddByRssListedFeedRecord => ({
  publisherFeedUrl: ARTIST_A,
  position: 0,
  kind: 'directory',
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

describe('toListedFeedInserts', () => {
  it('stores each entry at its list position with a lowercased guid and its own fields', () => {
    const inserts = toListedFeedInserts(
      ARTIST_A,
      [
        { ...shared, feedGuid: 'Album-1', feedUrl: ALBUM_URL, kind: 'add_by_rss', requestId: 'r1' },
        directoryEntry('album-2', 'chan2'),
        {
          ...shared,
          feedGuid: 'album-3',
          itemGuids: ['i1'],
          kind: 'unresolved',
          listedAtChannelLevel: false,
          reason: 'item_references_only',
        },
      ],
      []
    );

    expect(inserts.map((insert) => [insert.position, insert.feedGuid, insert.kind])).toEqual([
      [0, 'album-1', 'add_by_rss'],
      [1, 'album-2', 'directory'],
      [2, 'album-3', 'unresolved'],
    ]);
    expect(inserts[0]).toMatchObject({ feedUrl: ALBUM_URL, pendingRequestId: 'r1' });
    expect(inserts[1]).toMatchObject({ channelIdText: 'chan2', mediumId: 3 });
    expect(inserts[2]).toMatchObject({
      itemGuidsJson: '["i1"]',
      listedAtChannelLevel: 0,
      unresolvedReason: 'item_references_only',
    });
  });

  it('keeps directory artwork only when the guid and the channel both match', () => {
    const existing = [
      storedRecord({
        feedGuid: 'same',
        channelIdText: 'chan1',
        imageUrl: 'https://img/1.jpg',
        artworkChecked: true,
      }),
      storedRecord({
        feedGuid: 'moved',
        channelIdText: 'chan-old',
        imageUrl: 'https://img/2.jpg',
        artworkChecked: true,
      }),
    ];

    const inserts = toListedFeedInserts(
      ARTIST_A,
      [directoryEntry('SAME', 'chan1'), directoryEntry('moved', 'chan-new')],
      existing
    );

    expect(inserts[0]).toMatchObject({ imageUrl: 'https://img/1.jpg', artworkChecked: 1 });
    expect(inserts[1]).toMatchObject({ imageUrl: null, artworkChecked: 0 });
  });
});

describe('isFeedListed', () => {
  it('matches a listing by canonical URL', () => {
    expect(
      isFeedListed({ feedUrl: 'https://example.com/', podcastGuid: null }, [
        { feedGuid: 'g', feedUrl: 'HTTPS://Example.COM' },
      ])
    ).toBe(true);
  });

  it('matches a listing by guid when the URLs differ', () => {
    expect(
      isFeedListed({ feedUrl: ALBUM_URL, podcastGuid: 'Album-Guid' }, [
        { feedGuid: 'album-guid', feedUrl: 'https://mirror.example.org/album.xml' },
      ])
    ).toBe(true);
  });

  it('does not match an unrelated listing', () => {
    expect(
      isFeedListed({ feedUrl: ALBUM_URL, podcastGuid: null }, [
        { feedGuid: 'other', feedUrl: 'https://example.com/other.xml' },
      ])
    ).toBe(false);
  });
});

describe('listedOnlyFeedUrlsToRemove', () => {
  const followedAlbum = {
    feedUrl: 'https://example.com/followed.xml',
    followed: true,
    podcastGuid: null,
  };
  const sharedAlbum = { feedUrl: ALBUM_URL, followed: false, podcastGuid: 'shared' };
  const listingA = { feedGuid: 'shared', feedUrl: ALBUM_URL, publisherFeedUrl: ARTIST_A };
  const listingB = { feedGuid: 'shared', feedUrl: null, publisherFeedUrl: ARTIST_B };

  it('never removes a followed feed', () => {
    expect(listedOnlyFeedUrlsToRemove([followedAlbum], [])).toEqual([]);
  });

  it('keeps an album two artists list while one listing remains, and removes it after both go', () => {
    expect(listedOnlyFeedUrlsToRemove([followedAlbum, sharedAlbum], [listingB])).toEqual([]);
    expect(listedOnlyFeedUrlsToRemove([followedAlbum, sharedAlbum], [listingA])).toEqual([]);
    expect(listedOnlyFeedUrlsToRemove([followedAlbum, sharedAlbum], [])).toEqual([ALBUM_URL]);
  });
});

describe('groupPendingListedAlbums', () => {
  it('fetches an album two artists list once, and remembers both listings', () => {
    const albums = groupPendingListedAlbums([
      storedRecord({
        feedGuid: 'shared',
        kind: 'add_by_rss',
        feedUrl: ALBUM_URL,
        pendingRequestId: 'r-a',
      }),
      storedRecord({
        publisherFeedUrl: ARTIST_B,
        feedGuid: 'shared',
        kind: 'add_by_rss',
        feedUrl: 'HTTPS://EXAMPLE.COM/album.xml',
        pendingRequestId: 'r-b',
        title: 'Album',
      }),
      storedRecord({ feedGuid: 'done', kind: 'add_by_rss', feedUrl: 'https://example.com/d.xml' }),
    ]);

    expect(albums).toEqual([
      {
        feedUrl: ALBUM_URL,
        requestId: 'r-a',
        title: 'Album',
        listings: [
          { publisherFeedUrl: ARTIST_A, feedGuid: 'shared', pendingRequestId: 'r-a' },
          { publisherFeedUrl: ARTIST_B, feedGuid: 'shared', pendingRequestId: 'r-b' },
        ],
      },
    ]);
  });
});

describe('decideListedAlbumStore', () => {
  const mappedFeed: AddByRSSMappedFeed = convertParsedRSSFeedToCompat({
    explicit: false,
    items: [],
    link: ALBUM_URL,
    title: 'Album',
  });
  const noRows = { hasRowForGuid: false, hasRowForUrl: false };

  it('keeps a pending album pending', () => {
    expect(
      decideListedAlbumStore({ ...noRows, result: { mappedFeed: null, status: 'pending' } })
    ).toEqual({ kind: 'keep-pending' });
  });

  it('updates the stored row when a parsed album already has one at its URL', () => {
    expect(
      decideListedAlbumStore({
        hasRowForGuid: true,
        hasRowForUrl: true,
        result: { mappedFeed, status: 'parsed' },
      })
    ).toEqual({ kind: 'update-existing' });
  });

  it('skips a parsed album already stored under another URL with the same guid', () => {
    expect(
      decideListedAlbumStore({
        hasRowForGuid: true,
        hasRowForUrl: false,
        result: { mappedFeed, status: 'parsed' },
      })
    ).toEqual({ kind: 'skip-duplicate' });
  });

  it('inserts a parsed album the device does not hold', () => {
    expect(decideListedAlbumStore({ ...noRows, result: { mappedFeed, status: 'parsed' } })).toEqual(
      { kind: 'insert-parsed' }
    );
  });

  it('stores a private album as needing credentials, including a 401 behind withheld ones', () => {
    expect(
      decideListedAlbumStore({
        ...noRows,
        result: { failureReason: 'credentials_required', mappedFeed: null, status: 'failed' },
      })
    ).toEqual({ kind: 'insert-needs-credentials' });
    expect(
      decideListedAlbumStore({
        ...noRows,
        result: {
          authChallenge: 'basic',
          failureReason: 'credentials_withheld_other_domain',
          httpStatus: 401,
          mappedFeed: null,
          status: 'failed',
        },
      })
    ).toEqual({ kind: 'insert-needs-credentials' });
    expect(
      decideListedAlbumStore({
        hasRowForGuid: false,
        hasRowForUrl: true,
        result: { failureReason: 'credentials_rejected', mappedFeed: null, status: 'failed' },
      })
    ).toEqual({ kind: 'update-existing' });
  });

  it('logs any other failure', () => {
    expect(
      decideListedAlbumStore({
        ...noRows,
        result: {
          failureReason: 'credentials_withheld_other_domain',
          httpStatus: 404,
          mappedFeed: null,
          status: 'failed',
        },
      })
    ).toEqual({ kind: 'log-failure' });
    expect(
      decideListedAlbumStore({ ...noRows, result: { mappedFeed: null, status: 'failed' } })
    ).toEqual({ kind: 'log-failure' });
  });
});

describe('directoryLookupDue', () => {
  const match = { feedGuid: 'artist', channelIdText: 'chan', channelTitle: null, mediumId: 22 };

  it('is due when the feed was never looked up', () => {
    expect(directoryLookupDue(null, ['artist'])).toBe(true);
    expect(
      directoryLookupDue({ publisherGuids: ['artist'], directoryMatches: null }, ['artist'])
    ).toBe(true);
  });

  it('is not due when the same guids were already looked up', () => {
    expect(
      directoryLookupDue({ publisherGuids: ['artist'], directoryMatches: [match] }, ['artist'])
    ).toBe(false);
  });

  it('is due when the guids changed', () => {
    expect(
      directoryLookupDue({ publisherGuids: ['artist'], directoryMatches: [match] }, ['other'])
    ).toBe(true);
  });
});
