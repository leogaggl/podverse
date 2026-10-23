import { addByRSSFeedListTitle } from '../subscribed/channelListItems';
import { loadAddByRSSAlbumTrackIndexItems } from './albumTracks';
import { onAddByRSSFeedChanged } from './feedChangedEvent';
import { normalizeAddByRSSGuid } from './listedFeeds';
import { addByRSSAlbumsNamingPublisher, mergeAddByRSSAlbumSources } from './publisherLinks';
import { getAllAddByRSSFeeds, getAllListedAddByRSSFeeds } from './storage';
import type { AddByRSSAlbumSource, AddByRSSItemIndexItem } from './types';

export type ArtistPageAddByRssData = {
  albums: AddByRSSAlbumSource[];
  tracks: AddByRSSItemIndexItem[];
};

const cache = new Map<string, Promise<ArtistPageAddByRssData>>();
let feedChangesClearCache = false;

const emptyArtistPageAddByRssData = (): ArtistPageAddByRssData => ({
  albums: [],
  tracks: [],
});

const registerFeedChangeClearsCache = (): void => {
  if (feedChangesClearCache || typeof window === 'undefined') {
    return;
  }
  feedChangesClearCache = true;
  onAddByRSSFeedChanged(() => {
    cache.clear();
  });
};

/** Add by RSS albums on this browser naming the artist's guid, and their tracks. */
export const loadArtistPageAddByRssData = async (
  podcastGuid: string | null | undefined
): Promise<ArtistPageAddByRssData> => {
  if (normalizeAddByRSSGuid(podcastGuid) === null) {
    return emptyArtistPageAddByRssData();
  }

  const [followed, listed] = await Promise.all([
    getAllAddByRSSFeeds(),
    getAllListedAddByRSSFeeds(),
  ]);
  const albums = addByRSSAlbumsNamingPublisher(
    mergeAddByRSSAlbumSources(followed, listed),
    podcastGuid
  ).sort((a, b) => addByRSSFeedListTitle(a.feed).localeCompare(addByRSSFeedListTitle(b.feed)));
  const tracks = (
    await loadAddByRSSAlbumTrackIndexItems(albums.map((source) => ({ source, itemGuids: null })))
  ).sort((a, b) => b.pubDateMs - a.pubDateMs);

  return { albums, tracks };
};

/** Shared per guid until the next Add by RSS feed change. */
export const getArtistPageAddByRssData = (
  podcastGuid: string | null | undefined
): Promise<ArtistPageAddByRssData> => {
  registerFeedChangeClearsCache();
  const guid = normalizeAddByRSSGuid(podcastGuid);
  if (guid === null) {
    return Promise.resolve(emptyArtistPageAddByRssData());
  }

  const cached = cache.get(guid);
  if (cached !== undefined) {
    return cached;
  }

  const pending = loadArtistPageAddByRssData(podcastGuid);
  cache.set(guid, pending);
  void pending.catch(() => {
    if (cache.get(guid) === pending) {
      cache.delete(guid);
    }
  });
  return pending;
};
