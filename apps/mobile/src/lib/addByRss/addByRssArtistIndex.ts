import type { AddByRSSResourceType } from '@podverse/helpers';
import { getChannelRouteKind } from '@podverse/helpers/medium';
import { canonicalAddByRSSFeedUrl } from '@podverse/helpers-validation/client';

import type { AddByRssListedFeedRecord } from '../../data/repositories/addByRssListedFeeds';
import type { LineArtist } from '../playback/lineArtist';
import { directoryLineArtist } from '../playback/lineArtist';
import type { AddByRssDirectoryPublisherMatch } from './publisherRefs';

/**
 * In-memory index of the Add by RSS artist relations stored on this device, so player lines and
 * artist pages can answer "which artist" synchronously. Matching is by guid with no verification.
 * Every reader returns `[]` until the first hydrate.
 */

export type AddByRssArtistIndexFeed = {
  feedUrl: string;
  feedIdText: string;
  title: string;
  resourceType: AddByRSSResourceType;
  followed: boolean;
  podcastGuid: string | null;
  publisherGuids: readonly string[];
  directoryMatches: readonly AddByRssDirectoryPublisherMatch[];
};

export type AddByRssArtistIndexListing = Pick<
  AddByRssListedFeedRecord,
  | 'publisherFeedUrl'
  | 'feedGuid'
  | 'feedUrl'
  | 'kind'
  | 'channelIdText'
  | 'mediumId'
  | 'listedAtChannelLevel'
>;

type ArtistMatch = AddByRssDirectoryPublisherMatch & { mediumId: number };

let feeds: readonly AddByRssArtistIndexFeed[] = [];
let listings: readonly AddByRssArtistIndexListing[] = [];
let feedsByUrl = new Map<string, AddByRssArtistIndexFeed>();
let artistsByGuid = new Map<string, AddByRssArtistIndexFeed>();
let version = 0;
const listeners = new Set<() => void>();

const comparableFeedUrl = (feedUrl: string): string =>
  canonicalAddByRSSFeedUrl(feedUrl) ?? feedUrl.trim();

const normalizeGuid = (guid: string | null | undefined): string => guid?.trim().toLowerCase() ?? '';

const isArtistFeed = (feed: AddByRssArtistIndexFeed): boolean => feed.resourceType === 'artists';

const byTitle = (a: AddByRssArtistIndexFeed, b: AddByRssArtistIndexFeed): number =>
  a.title.localeCompare(b.title);

const toAddByRssLineArtist = (feed: AddByRssArtistIndexFeed): LineArtist => ({
  kind: 'add-by-rss',
  feedIdText: feed.feedIdText,
  feedUrl: feed.feedUrl,
  title: feed.title,
});

const isArtistDirectoryMatch = (match: AddByRssDirectoryPublisherMatch): match is ArtistMatch =>
  match.mediumId !== null && getChannelRouteKind(match.mediumId) === 'artist';

/** The Add by RSS artists behind these listings, each once, by title. */
const artistFeedsForListings = (
  matching: readonly AddByRssArtistIndexListing[]
): AddByRssArtistIndexFeed[] => {
  const artists = new Map<string, AddByRssArtistIndexFeed>();
  for (const listing of matching) {
    const feed = feedsByUrl.get(comparableFeedUrl(listing.publisherFeedUrl));
    if (feed !== undefined && isArtistFeed(feed)) {
      artists.set(feed.feedIdText, feed);
    }
  }
  return [...artists.values()].sort(byTitle);
};

export const hydrateAddByRssArtistIndex = (input: {
  feeds: readonly AddByRssArtistIndexFeed[];
  listings: readonly AddByRssArtistIndexListing[];
}): void => {
  feeds = input.feeds;
  listings = input.listings;
  feedsByUrl = new Map();
  artistsByGuid = new Map();
  for (const feed of feeds) {
    const urlKey = comparableFeedUrl(feed.feedUrl);
    if (!feedsByUrl.has(urlKey)) {
      feedsByUrl.set(urlKey, feed);
    }
    const guid = normalizeGuid(feed.podcastGuid);
    if (guid.length > 0 && isArtistFeed(feed) && !artistsByGuid.has(guid)) {
      artistsByGuid.set(guid, feed);
    }
  }
  version += 1;
  for (const listener of listeners) {
    listener();
  }
};

export const subscribeAddByRssArtistIndex = (listener: () => void): (() => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

export const getAddByRssArtistIndexVersion = (): number => version;

/**
 * Artists for an Add by RSS album's line: Add by RSS artists the album's publisher pointers name,
 * in pointer order, then Add by RSS artists that list it at channel level, by title. Only when
 * that is empty, the directory artists its pointers resolved to.
 */
export const addByRssAlbumArtists = (albumFeedUrl: string): LineArtist[] => {
  const album = feedsByUrl.get(comparableFeedUrl(albumFeedUrl));
  if (album === undefined) {
    return [];
  }

  const named: AddByRssArtistIndexFeed[] = [];
  for (const guid of album.publisherGuids) {
    const artist = artistsByGuid.get(normalizeGuid(guid));
    if (artist !== undefined) {
      named.push(artist);
    }
  }

  const albumUrl = comparableFeedUrl(album.feedUrl);
  const albumGuid = normalizeGuid(album.podcastGuid);
  const listing = artistFeedsForListings(
    listings.filter(
      (entry) =>
        entry.listedAtChannelLevel &&
        ((entry.feedUrl !== null && comparableFeedUrl(entry.feedUrl) === albumUrl) ||
          (albumGuid.length > 0 && normalizeGuid(entry.feedGuid) === albumGuid))
    )
  );

  const seen = new Set<string>([album.feedIdText]);
  const artists: LineArtist[] = [];
  for (const feed of [...named, ...listing]) {
    if (!seen.has(feed.feedIdText)) {
      seen.add(feed.feedIdText);
      artists.push(toAddByRssLineArtist(feed));
    }
  }
  if (artists.length > 0) {
    return artists;
  }

  const seenChannels = new Set<string>();
  const directoryArtists: LineArtist[] = [];
  for (const match of album.directoryMatches) {
    if (isArtistDirectoryMatch(match) && !seenChannels.has(match.channelIdText)) {
      seenChannels.add(match.channelIdText);
      directoryArtists.push(
        directoryLineArtist({
          id_text: match.channelIdText,
          title: match.channelTitle,
          medium_id: match.mediumId,
        })
      );
    }
  }
  return directoryArtists;
};

/** Add by RSS artists on this device listing a directory album at channel level. */
export const addByRssArtistsListingDirectoryAlbum = (album: {
  channelIdText: string;
  podcastGuid: string | null | undefined;
}): LineArtist[] => {
  const albumGuid = normalizeGuid(album.podcastGuid);
  return artistFeedsForListings(
    listings.filter(
      (entry) =>
        entry.listedAtChannelLevel &&
        ((entry.kind === 'directory' && entry.channelIdText === album.channelIdText) ||
          (albumGuid.length > 0 && normalizeGuid(entry.feedGuid) === albumGuid))
    )
  ).map(toAddByRssLineArtist);
};

/**
 * Add by RSS albums on the device, followed or listed-only, whose publisher pointer resolved to
 * this directory artist, by title.
 */
export const addByRssAlbumsNamingDirectoryArtist = (
  artistIdText: string
): AddByRssArtistIndexFeed[] =>
  feeds
    .filter(
      (feed) =>
        feed.resourceType === 'albums' &&
        feed.directoryMatches.some((match) => match.channelIdText === artistIdText)
    )
    .sort(byTitle);

export const resetAddByRssArtistIndexForTests = (): void => {
  feeds = [];
  listings = [];
  feedsByUrl = new Map();
  artistsByGuid = new Map();
  version = 0;
  listeners.clear();
};
