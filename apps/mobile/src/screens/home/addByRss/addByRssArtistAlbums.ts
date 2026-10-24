import { isAlbumMediumId } from '@podverse/helpers/medium';
import { canonicalAddByRSSFeedUrl } from '@podverse/helpers-validation/client';

import type { AddByRssListedFeedRecord } from '../../../data/repositories/addByRssListedFeeds';
import type { AddByRssFeedWithRefs } from '../../../data/repositories/addByRssRepository';
import type { MobileAddByRSSFeedRecord } from '../../../prefs/addByRSSFeeds';

/** One row on an Add by RSS artist's Albums tab. */
export type AddByRssArtistAlbumEntry =
  | { kind: 'add-by-rss'; feed: MobileAddByRSSFeedRecord }
  | { kind: 'directory'; channelIdText: string; title: string; imageUrl: string | null };

/** A stored feed whose tracks the artist's Tracks tab lists. */
export type AddByRssArtistTrackSource = {
  feed: MobileAddByRSSFeedRecord;
  /** Null: every track. Otherwise only items with these guids. */
  itemGuids: ReadonlySet<string> | null;
};

const comparableFeedUrl = (feedUrl: string): string =>
  canonicalAddByRSSFeedUrl(feedUrl) ?? feedUrl.trim();

const normalizeGuid = (guid: string | null): string | null => {
  const trimmed = guid?.trim().toLowerCase() ?? '';
  return trimmed.length > 0 ? trimmed : null;
};

type StoredFeedLookup = (listing: AddByRssListedFeedRecord) => MobileAddByRSSFeedRecord | null;

/**
 * The stored feed a listing names: by canonical URL first, then by the feed's own guid. The artist
 * itself is never an answer.
 */
const createStoredFeedLookup = (
  artist: AddByRssFeedWithRefs,
  feeds: readonly AddByRssFeedWithRefs[]
): StoredFeedLookup => {
  const artistUrl = comparableFeedUrl(artist.feed.feedUrl);
  const byUrl = new Map<string, MobileAddByRSSFeedRecord>();
  const byGuid = new Map<string, MobileAddByRSSFeedRecord>();
  for (const entry of feeds) {
    const url = comparableFeedUrl(entry.feed.feedUrl);
    if (url === artistUrl) {
      continue;
    }
    if (!byUrl.has(url)) {
      byUrl.set(url, entry.feed);
    }
    const guid = normalizeGuid(entry.podcastGuid);
    if (guid !== null && !byGuid.has(guid)) {
      byGuid.set(guid, entry.feed);
    }
  }
  return (listing) => {
    if (listing.feedUrl !== null) {
      const byListingUrl = byUrl.get(comparableFeedUrl(listing.feedUrl));
      if (byListingUrl !== undefined) {
        return byListingUrl;
      }
    }
    return byGuid.get(listing.feedGuid.toLowerCase()) ?? null;
  };
};

const isAlbumMedium = (mediumId: number | null): boolean =>
  mediumId === null || isAlbumMediumId(mediumId);

const feedTitle = (feed: MobileAddByRSSFeedRecord): string => feed.title ?? feed.feedUrl;

/**
 * The albums an Add by RSS artist shows, in order: its channel-level listings in the artist's
 * order (directory albums once per channel, Add by RSS albums once stored on the device), then
 * stored Add by RSS albums whose publisher pointers name the artist's guid, by title. Each album
 * appears once and the artist never does. Unresolved listings and albums not stored yet have no
 * row; a listed Add by RSS album still waiting on its parse sets `hasPending`.
 */
export const buildAddByRssArtistAlbums = ({
  artist,
  feeds,
  listings,
}: {
  artist: AddByRssFeedWithRefs;
  listings: readonly AddByRssListedFeedRecord[];
  feeds: readonly AddByRssFeedWithRefs[];
}): { albums: AddByRssArtistAlbumEntry[]; hasPending: boolean } => {
  const lookup = createStoredFeedLookup(artist, feeds);
  const albums: AddByRssArtistAlbumEntry[] = [];
  const seenChannelIds = new Set<string>();
  const seenFeedUrls = new Set<string>();
  let hasPending = false;

  for (const listing of listings) {
    if (!listing.listedAtChannelLevel) {
      continue;
    }
    if (listing.kind === 'directory') {
      const channelIdText = listing.channelIdText;
      if (
        channelIdText === null ||
        seenChannelIds.has(channelIdText) ||
        !isAlbumMedium(listing.mediumId)
      ) {
        continue;
      }
      seenChannelIds.add(channelIdText);
      albums.push({
        kind: 'directory',
        channelIdText,
        imageUrl: listing.imageUrl,
        title: listing.channelTitle ?? listing.title ?? channelIdText,
      });
      continue;
    }
    if (listing.kind !== 'add_by_rss') {
      continue;
    }
    const feed = lookup(listing);
    if (feed === null) {
      if (listing.pendingRequestId !== null) {
        hasPending = true;
      }
      continue;
    }
    const url = comparableFeedUrl(feed.feedUrl);
    if (seenFeedUrls.has(url)) {
      continue;
    }
    seenFeedUrls.add(url);
    albums.push({ kind: 'add-by-rss', feed });
  }

  const artistGuid = normalizeGuid(artist.podcastGuid);
  if (artistGuid !== null) {
    const artistUrl = comparableFeedUrl(artist.feed.feedUrl);
    const named = feeds
      .filter((entry) => {
        const url = comparableFeedUrl(entry.feed.feedUrl);
        return (
          entry.feed.resourceType === 'albums' &&
          url !== artistUrl &&
          !seenFeedUrls.has(url) &&
          entry.publisherGuids.includes(artistGuid)
        );
      })
      .map((entry) => entry.feed)
      .sort((a, b) => feedTitle(a).localeCompare(feedTitle(b)));
    for (const feed of named) {
      const url = comparableFeedUrl(feed.feedUrl);
      if (seenFeedUrls.has(url)) {
        continue;
      }
      seenFeedUrls.add(url);
      albums.push({ kind: 'add-by-rss', feed });
    }
  }

  return { albums, hasPending };
};

/**
 * Where an Add by RSS artist's tracks come from, in order: the artist's own items, then every
 * track of each Add by RSS album in `albums`, then the tracks item-level listings reference in
 * other stored albums (one guid set per album). Directory albums contribute nothing: their row
 * opens the directory album.
 */
export const buildAddByRssArtistTrackSources = ({
  albums,
  artist,
  feeds,
  listings,
}: {
  artist: AddByRssFeedWithRefs;
  albums: readonly AddByRssArtistAlbumEntry[];
  listings: readonly AddByRssListedFeedRecord[];
  feeds: readonly AddByRssFeedWithRefs[];
}): AddByRssArtistTrackSource[] => {
  const sources: AddByRssArtistTrackSource[] = [{ feed: artist.feed, itemGuids: null }];
  const wholeFeedUrls = new Set<string>([comparableFeedUrl(artist.feed.feedUrl)]);
  for (const album of albums) {
    if (album.kind !== 'add-by-rss') {
      continue;
    }
    const url = comparableFeedUrl(album.feed.feedUrl);
    if (wholeFeedUrls.has(url)) {
      continue;
    }
    wholeFeedUrls.add(url);
    sources.push({ feed: album.feed, itemGuids: null });
  }

  const lookup = createStoredFeedLookup(artist, feeds);
  const referenced = new Map<string, { feed: MobileAddByRSSFeedRecord; itemGuids: Set<string> }>();
  for (const listing of listings) {
    if (
      listing.listedAtChannelLevel ||
      listing.kind !== 'add_by_rss' ||
      listing.itemGuids.length === 0
    ) {
      continue;
    }
    const feed = lookup(listing);
    if (feed === null) {
      continue;
    }
    const url = comparableFeedUrl(feed.feedUrl);
    if (wholeFeedUrls.has(url)) {
      continue;
    }
    const existing = referenced.get(url);
    const itemGuids = existing?.itemGuids ?? new Set<string>();
    for (const guid of listing.itemGuids) {
      itemGuids.add(guid);
    }
    if (existing === undefined) {
      referenced.set(url, { feed, itemGuids });
    }
  }
  for (const source of referenced.values()) {
    sources.push(source);
  }
  return sources;
};
