import { useEffect, useSyncExternalStore } from 'react';

import { addByRssRepository } from '../../data/repositories/addByRssRepository';
import type { AddByRssArtistIndexFeed } from '../../lib/addByRss/addByRssArtistIndex';
import type { AddByRssHomeDetailData } from '../home/addByRssHomeDetailData';
import { buildAddByRssHomeDetailData } from '../home/addByRssHomeDetailData';
import { useArtistYourAddByRssAlbums } from './ArtistYourAddByRssAlbumsSection';

const EMPTY_DETAILS: AddByRssHomeDetailData[] = [];

type TrackDetailsEntry = {
  details: AddByRssHomeDetailData[];
  status: 'loading' | 'ready';
};

/**
 * The artist screen and its tracks section both read this, and so can an artist page on another
 * tab. Each album list keeps its own entry so one page's read does not clear another's.
 */
let entries: ReadonlyMap<string, TrackDetailsEntry> = new Map();

const loadRequestIds = new Map<string, number>();

const listeners = new Set<() => void>();

const subscribeTrackDetails = (listener: () => void): (() => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

const getTrackDetailEntries = (): ReadonlyMap<string, TrackDetailsEntry> => entries;

const publishTrackDetails = (key: string, entry: TrackDetailsEntry): void => {
  const next = new Map(entries);
  next.set(key, entry);
  entries = next;
  for (const listener of listeners) {
    listener();
  }
};

const loadAlbumTrackDetails = async (
  albums: readonly AddByRssArtistIndexFeed[],
  isCurrent: () => boolean
): Promise<AddByRssHomeDetailData[] | null> => {
  const details: AddByRssHomeDetailData[] = [];
  for (const album of albums) {
    const [feed, mappedFeed] = await Promise.all([
      addByRssRepository.getFeedByUrl(album.feedUrl),
      addByRssRepository.getMappedFeedByUrl(album.feedUrl),
    ]);
    if (!isCurrent()) {
      return null;
    }
    if (feed === null || mappedFeed === null) {
      continue;
    }
    details.push(buildAddByRssHomeDetailData(feed, mappedFeed));
  }
  return details;
};

const startLoad = (key: string, albums: readonly AddByRssArtistIndexFeed[]): void => {
  const existing = entries.get(key);
  if (existing !== undefined && (existing.status === 'loading' || existing.status === 'ready')) {
    return;
  }

  const requestId = (loadRequestIds.get(key) ?? 0) + 1;
  loadRequestIds.set(key, requestId);
  const isCurrent = (): boolean => loadRequestIds.get(key) === requestId;

  if (albums.length === 0) {
    publishTrackDetails(key, { details: EMPTY_DETAILS, status: 'ready' });
    return;
  }

  publishTrackDetails(key, { details: EMPTY_DETAILS, status: 'loading' });
  void (async () => {
    try {
      const details = await loadAlbumTrackDetails(albums, isCurrent);
      if (details === null || !isCurrent()) {
        return;
      }
      publishTrackDetails(key, { details, status: 'ready' });
    } catch {
      if (isCurrent()) {
        publishTrackDetails(key, { details: EMPTY_DETAILS, status: 'ready' });
      }
    }
  })();
};

/**
 * Tracks from the Add by RSS albums on this device that name this directory artist, in that
 * album order. Empty until the device read for this album list finishes, and when an album has
 * no stored feed or no parsed bundle.
 */
export function useArtistYourAddByRssTrackDetails(artistId: string): {
  details: AddByRssHomeDetailData[];
} {
  const { albums } = useArtistYourAddByRssAlbums(artistId);
  const albumUrlsKey = albums.map((album) => album.feedUrl).join('\u0000');
  const key = `${artistId}\u0000${albumUrlsKey}`;
  const current = useSyncExternalStore(subscribeTrackDetails, getTrackDetailEntries);
  const entry = current.get(key);

  useEffect(() => {
    startLoad(key, albums);
  }, [albums, key]);

  if (entry === undefined || entry.status !== 'ready') {
    return { details: EMPTY_DETAILS };
  }
  return { details: entry.details };
}
