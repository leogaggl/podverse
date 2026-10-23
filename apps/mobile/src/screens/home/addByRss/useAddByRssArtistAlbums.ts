import { useCallback, useEffect, useRef, useState } from 'react';

import type { AddByRssNeedsCredentialsItem } from '../../../components/content/AddByRssNeedsCredentialsSection';
import { addByRssCredentialStore, addByRssRepository } from '../../../data';
import { useAddByRssArtistIndexVersion } from '../../../hooks/useAddByRssArtistIndexVersion';
import { partitionAddByRssFeedsByCredentials } from '../../../lib/addByRss/credentials';
import type { MobileAddByRSSFeedRecord } from '../../../prefs/addByRSSFeeds';
import type { AddByRssHomeDetailData } from '../addByRssHomeDetailData';
import { buildAddByRssHomeDetailData } from '../addByRssHomeDetailData';
import type { AddByRssArtistAlbumEntry, AddByRssArtistTrackSource } from './addByRssArtistAlbums';
import { buildAddByRssArtistAlbums, buildAddByRssArtistTrackSources } from './addByRssArtistAlbums';

type ArtistAlbumsState = {
  albums: AddByRssArtistAlbumEntry[];
  hasPending: boolean;
  /** The artist URL this state was read for; anything else is still loading. */
  loadedFor: string | null;
  needsCredentials: AddByRssNeedsCredentialsItem[];
  trackDetails: AddByRssHomeDetailData[];
};

const EMPTY_STATE: ArtistAlbumsState = {
  albums: [],
  hasPending: false,
  loadedFor: null,
  needsCredentials: [],
  trackDetails: [],
};

const loadTrackDetails = async (
  sources: readonly AddByRssArtistTrackSource[],
  isCurrent: () => boolean
): Promise<AddByRssHomeDetailData[] | null> => {
  const details: AddByRssHomeDetailData[] = [];
  for (const source of sources) {
    const mappedFeed = await addByRssRepository.getMappedFeedByUrl(source.feed.feedUrl);
    if (!isCurrent()) {
      return null;
    }
    if (mappedFeed === null) {
      continue;
    }
    const detail = buildAddByRssHomeDetailData(source.feed, mappedFeed);
    const { itemGuids } = source;
    details.push(
      itemGuids === null
        ? detail
        : {
            ...detail,
            episodeRows: detail.episodeRows.filter((row) => {
              const guid = row.itemBundle.item.guid?.trim() ?? '';
              return guid.length > 0 && itemGuids.has(guid);
            }),
          }
    );
  }
  return details;
};

/**
 * The albums and tracks an Add by RSS artist shows, read from the device. Albums waiting on a
 * username and password leave the album rows for `needsCredentials` and give no tracks. Track
 * bundles are read only when `includeTracks` is set. Reloads when the artist index changes and
 * when `reload` is called.
 */
export function useAddByRssArtistAlbums(
  artistFeedUrl: string,
  { includeTracks }: { includeTracks: boolean }
): {
  albums: AddByRssArtistAlbumEntry[];
  hasPending: boolean;
  isLoading: boolean;
  needsCredentials: AddByRssNeedsCredentialsItem[];
  reload: () => Promise<void>;
  trackDetails: AddByRssHomeDetailData[];
} {
  const indexVersion = useAddByRssArtistIndexVersion();
  const [state, setState] = useState<ArtistAlbumsState>(EMPTY_STATE);
  const generationRef = useRef(0);

  const reload = useCallback(async () => {
    const generation = ++generationRef.current;
    const isCurrent = () => generation === generationRef.current;
    try {
      const [listings, feeds, feedUrlsWithCredentials] = await Promise.all([
        addByRssRepository.listListedFeeds(artistFeedUrl),
        addByRssRepository.listFeedsWithRefs(),
        addByRssCredentialStore.listFeedUrlsForCurrentAccount(),
      ]);
      if (!isCurrent()) {
        return;
      }
      const artist = feeds.find((entry) => entry.feed.feedUrl === artistFeedUrl);
      if (artist === undefined) {
        setState({ ...EMPTY_STATE, loadedFor: artistFeedUrl });
        return;
      }

      const { albums, hasPending } = buildAddByRssArtistAlbums({ artist, feeds, listings });
      const split = partitionAddByRssFeedsByCredentials(
        feeds.filter((entry) => entry !== artist).map((entry) => entry.feed),
        feedUrlsWithCredentials
      );
      const needByFeed = new Map<MobileAddByRSSFeedRecord, AddByRssNeedsCredentialsItem>(
        split.needsCredentials.map((item) => [item.feed, item])
      );
      const shownAlbums: AddByRssArtistAlbumEntry[] = [];
      const needsCredentials: AddByRssNeedsCredentialsItem[] = [];
      for (const album of albums) {
        const need = album.kind === 'add-by-rss' ? needByFeed.get(album.feed) : undefined;
        if (need === undefined) {
          shownAlbums.push(album);
        } else {
          needsCredentials.push(need);
        }
      }

      let trackDetails: AddByRssHomeDetailData[] = [];
      if (includeTracks) {
        const sources = buildAddByRssArtistTrackSources({
          albums: shownAlbums,
          artist,
          feeds: feeds.filter((entry) => !needByFeed.has(entry.feed)),
          listings,
        });
        const loaded = await loadTrackDetails(sources, isCurrent);
        if (loaded === null) {
          return;
        }
        trackDetails = loaded;
      }

      setState({
        albums: shownAlbums,
        hasPending,
        loadedFor: artistFeedUrl,
        needsCredentials,
        trackDetails,
      });
    } catch {
      if (isCurrent()) {
        setState((previous) =>
          previous.loadedFor === artistFeedUrl
            ? previous
            : { ...EMPTY_STATE, loadedFor: artistFeedUrl }
        );
      }
    }
  }, [artistFeedUrl, includeTracks]);

  useEffect(() => {
    void reload();
  }, [indexVersion, reload]);

  const isCurrentArtist = state.loadedFor === artistFeedUrl;
  return {
    albums: isCurrentArtist ? state.albums : EMPTY_STATE.albums,
    hasPending: isCurrentArtist && state.hasPending,
    isLoading: !isCurrentArtist,
    needsCredentials: isCurrentArtist ? state.needsCredentials : EMPTY_STATE.needsCredentials,
    reload,
    trackDetails: isCurrentArtist ? state.trackDetails : EMPTY_STATE.trackDetails,
  };
}
