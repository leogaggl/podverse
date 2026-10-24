import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  getAllAddByRSSFeedsMock,
  getAllListedAddByRSSFeedsMock,
  loadAddByRSSAlbumTrackIndexItemsMock,
} = vi.hoisted(() => ({
  getAllAddByRSSFeedsMock: vi.fn(),
  getAllListedAddByRSSFeedsMock: vi.fn(),
  loadAddByRSSAlbumTrackIndexItemsMock: vi.fn(),
}));

vi.mock('./storage', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./storage')>();
  return {
    ...actual,
    getAllAddByRSSFeeds: getAllAddByRSSFeedsMock,
    getAllListedAddByRSSFeeds: getAllListedAddByRSSFeedsMock,
  };
});

vi.mock('./albumTracks', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./albumTracks')>();
  return {
    ...actual,
    loadAddByRSSAlbumTrackIndexItems: loadAddByRSSAlbumTrackIndexItemsMock,
  };
});

import { MediumEnum } from '@podverse/helpers';
import type { FeedObject } from '@podverse/parser-mapping';
import { convertParsedRSSFeedToCompat, Phase4Medium } from '@podverse/parser-mapping';

import { getArtistPageAddByRssData, loadArtistPageAddByRssData } from './artistPageAddByRss';
import { emitAddByRSSFeedChanged } from './feedChangedEvent';
import type { AddByRSSFeedRecord, AddByRSSItemIndexItem, AddByRSSListedFeedRecord } from './types';

const albumRecord = (input: { idText: string; publisherGuid: string }): AddByRSSFeedRecord => {
  const feed: FeedObject = {
    title: input.idText,
    explicit: false,
    link: 'https://example.com',
    guid: `${input.idText}-guid`,
    medium: Phase4Medium.Music,
    items: [],
    podcastPublisher: [{ feedGuid: input.publisherGuid }],
  };
  return {
    id: 1,
    idText: input.idText,
    resourceType: 'albums',
    feedUrl: `https://example.com/${input.idText}.xml`,
    title: input.idText,
    imageUrl: null,
    updatedAt: '2026-01-01T00:00:00.000Z',
    mappedFeed: convertParsedRSSFeedToCompat(feed),
  };
};

const listedRecord = (input: {
  idText: string;
  publisherGuid: string;
}): AddByRSSListedFeedRecord => ({
  ...albumRecord(input),
  publisherParseRequestId: null,
  itemIdTextsByGuid: {},
  liveItemIdTextsByGuid: {},
});

const trackItem = (idText: string, pubDateMs: number): AddByRSSItemIndexItem => {
  const mapped = convertParsedRSSFeedToCompat({
    title: 'Album',
    explicit: false,
    link: 'https://example.com',
    medium: Phase4Medium.Music,
    items: [
      {
        guid: idText,
        title: idText,
        duration: 60,
        explicit: false,
        enclosure: { url: `https://example.com/${idText}.mp3`, length: 1, type: 'audio/mpeg' },
      },
    ],
  });
  const bundle = mapped.items[0];
  if (bundle === undefined) {
    throw new Error(`Fixture track ${idText} is missing.`);
  }
  return {
    id: idText,
    idText,
    itemGuid: idText,
    channelIdText: 'album',
    channelTitle: 'Album',
    mediumId: MediumEnum.Music,
    bundle,
    pubDateMs,
  };
};

describe('artist page Add by RSS data', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getAllAddByRSSFeedsMock.mockResolvedValue([]);
    getAllListedAddByRSSFeedsMock.mockResolvedValue([]);
    loadAddByRSSAlbumTrackIndexItemsMock.mockResolvedValue([]);
  });

  it('returns empty lists for a null or blank guid without reading storage', async () => {
    for (const guid of [null, undefined, '', '   ']) {
      await expect(loadArtistPageAddByRssData(guid)).resolves.toEqual({ albums: [], tracks: [] });
      await expect(getArtistPageAddByRssData(guid)).resolves.toEqual({ albums: [], tracks: [] });
    }

    expect(getAllAddByRSSFeedsMock).not.toHaveBeenCalled();
    expect(getAllListedAddByRSSFeedsMock).not.toHaveBeenCalled();
    expect(loadAddByRSSAlbumTrackIndexItemsMock).not.toHaveBeenCalled();
  });

  it('returns followed and listed albums that name the guid, newest tracks first', async () => {
    const followed = albumRecord({ idText: 'zeta', publisherGuid: 'artist-guid' });
    const listed = listedRecord({ idText: 'alpha', publisherGuid: 'ARTIST-GUID' });
    const other = albumRecord({ idText: 'other', publisherGuid: 'other-guid' });
    const older = trackItem('older', 10);
    const newest = trackItem('newest', 30);
    const middle = trackItem('middle', 20);
    getAllAddByRSSFeedsMock.mockResolvedValue([followed, other]);
    getAllListedAddByRSSFeedsMock.mockResolvedValue([listed]);
    loadAddByRSSAlbumTrackIndexItemsMock.mockResolvedValue([older, newest, middle]);

    const result = await loadArtistPageAddByRssData('  Artist-Guid  ');

    expect(result.albums.map((source) => source.feed.idText)).toEqual(['alpha', 'zeta']);
    expect(result.tracks.map((track) => track.idText)).toEqual(['newest', 'middle', 'older']);
    expect(loadAddByRSSAlbumTrackIndexItemsMock).toHaveBeenCalledWith([
      { source: { followed: false, feed: listed }, itemGuids: null },
      { source: { followed: true, feed: followed }, itemGuids: null },
    ]);
  });

  it('reads storage once per guid until an Add by RSS feed changes', async () => {
    await getArtistPageAddByRssData('  CACHE-GUID  ');
    await getArtistPageAddByRssData('cache-guid');

    expect(getAllAddByRSSFeedsMock).toHaveBeenCalledTimes(1);
    expect(getAllListedAddByRSSFeedsMock).toHaveBeenCalledTimes(1);

    emitAddByRSSFeedChanged('https://example.com/album.xml');
    await getArtistPageAddByRssData('cache-guid');

    expect(getAllAddByRSSFeedsMock).toHaveBeenCalledTimes(2);
    expect(getAllListedAddByRSSFeedsMock).toHaveBeenCalledTimes(2);
  });
});
