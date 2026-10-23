import { createAddByRSSIdText } from '@podverse/helpers';
import { canonicalAddByRSSFeedUrl } from '@podverse/helpers-validation/client';

import { emitAddByRSSFeedChanged } from './feedChangedEvent';
import { toAddByRSSItemIndexItem, toAddByRSSLivestreamIndexItem } from './itemIndex';
import {
  bulkRemoveListedAddByRSSFeeds,
  getAllAddByRSSFeeds,
  getAllAddByRSSPublisherLinks,
  getAllListedAddByRSSFeeds,
  removeAddByRSSPublisherLinks,
} from './storage';
import type {
  AddByRSSFeedRecord,
  AddByRSSItemIndexItem,
  AddByRSSListedFeedRecord,
  AddByRSSLivestreamIndexItem,
  AddByRSSMappedFeed,
  AddByRSSPublisherLinkRecord,
} from './types';

/** How long an artist's stored list is used before its artist is parsed again to refresh it. */
export const ADD_BY_RSS_PUBLISHER_LINKS_REFRESH_MS = 24 * 60 * 60 * 1000;

/** Trimmed, lowercased guid; null when empty. Feed guids compare case-insensitively. */
export const normalizeAddByRSSGuid = (value: string | null | undefined): string | null => {
  const normalized = value?.trim().toLowerCase() ?? '';
  return normalized === '' ? null : normalized;
};

/** Canonical form for comparing feed URLs across stores and server rows. */
export const toAddByRSSComparableFeedUrl = (feedUrl: string): string =>
  canonicalAddByRSSFeedUrl(feedUrl) ?? feedUrl.trim();

/** The guid key an item has in the index: its guid, else `${feed.idText}-${index}`. */
export const getAddByRSSItemGuidKey = (
  feed: Pick<AddByRSSFeedRecord, 'idText'>,
  bundle: AddByRSSMappedFeed['items'][number],
  index: number
): string => bundle.item.guid ?? `${feed.idText}-${index}`;

/** Keeps every existing track idText and creates one for each new item guid. */
export const assignListedTrackIdTexts = (
  record: AddByRSSListedFeedRecord
): AddByRSSListedFeedRecord => {
  const itemIdTextsByGuid: Record<string, string> = { ...record.itemIdTextsByGuid };
  (record.mappedFeed?.items ?? []).forEach((bundle, index) => {
    const key = getAddByRSSItemGuidKey(record, bundle, index);
    if (itemIdTextsByGuid[key] === undefined) {
      itemIdTextsByGuid[key] = createAddByRSSIdText();
    }
  });
  return { ...record, itemIdTextsByGuid };
};

/** Index-shaped items for a listed album, built in memory with its stored idTexts. */
export const listedAddByRSSTrackIndexItems = (
  record: AddByRSSListedFeedRecord
): AddByRSSItemIndexItem[] =>
  (record.mappedFeed?.items ?? []).map((bundle, index) =>
    toAddByRSSItemIndexItem(
      record,
      bundle,
      index,
      record.itemIdTextsByGuid[getAddByRSSItemGuidKey(record, bundle, index)]
    )
  );

/** True for a record from the listed store; followed records carry no track idText map. */
export const isListedFeedRecord = (
  record: AddByRSSFeedRecord | null | undefined
): record is AddByRSSListedFeedRecord =>
  record !== null && record !== undefined && 'itemIdTextsByGuid' in record;

/** A listed album's track by its idText, built in memory. Null when no listed album has it. */
export const findListedAddByRSSTrack = async (
  itemIdText: string
): Promise<{ feed: AddByRSSListedFeedRecord; item: AddByRSSItemIndexItem } | null> => {
  const records = await getAllListedAddByRSSFeeds();
  const feed = records.find((record) =>
    Object.values(record.itemIdTextsByGuid).includes(itemIdText)
  );
  if (feed === undefined) {
    return null;
  }
  const item = listedAddByRSSTrackIndexItems(feed).find((entry) => entry.idText === itemIdText);
  return item === undefined ? null : { feed, item };
};

/** The guid key a livestream has in the index: its item guid, else `${feed.idText}-${index}`. */
export const getAddByRSSLiveItemGuidKey = (
  feed: Pick<AddByRSSFeedRecord, 'idText'>,
  liveBundle: AddByRSSMappedFeed['liveItems'][number],
  index: number
): string => liveBundle.item.guid ?? `${feed.idText}-${index}`;

/** Keeps every existing livestream idText and creates one for each new live item guid. */
export const assignListedLiveItemIdTexts = (
  record: AddByRSSListedFeedRecord
): AddByRSSListedFeedRecord => {
  const liveItemIdTextsByGuid: Record<string, string> = { ...record.liveItemIdTextsByGuid };
  (record.mappedFeed?.liveItems ?? []).forEach((liveBundle, index) => {
    const key = getAddByRSSLiveItemGuidKey(record, liveBundle, index);
    if (liveItemIdTextsByGuid[key] === undefined) {
      liveItemIdTextsByGuid[key] = createAddByRSSIdText();
    }
  });
  return { ...record, liveItemIdTextsByGuid };
};

/** Index-shaped livestreams for a listed album, built in memory with its stored idTexts. */
export const listedAddByRSSLivestreamIndexItems = (
  record: AddByRSSListedFeedRecord
): AddByRSSLivestreamIndexItem[] =>
  (record.mappedFeed?.liveItems ?? []).map((liveBundle, index) =>
    toAddByRSSLivestreamIndexItem(
      record,
      liveBundle,
      index,
      record.liveItemIdTextsByGuid[getAddByRSSLiveItemGuidKey(record, liveBundle, index)]
    )
  );

/** A listed album's livestream by its idText, built in memory. Null when no listed album has it. */
export const findListedAddByRSSLivestream = async (
  itemIdText: string
): Promise<{ feed: AddByRSSListedFeedRecord; item: AddByRSSLivestreamIndexItem } | null> => {
  const records = await getAllListedAddByRSSFeeds();
  const feed = records.find((record) =>
    Object.values(record.liveItemIdTextsByGuid).includes(itemIdText)
  );
  if (feed === undefined) {
    return null;
  }
  const item = listedAddByRSSLivestreamIndexItems(feed).find(
    (entry) => entry.idText === itemIdText
  );
  return item === undefined ? null : { feed, item };
};

export const addByRSSPublisherLinksNeedRefresh = (
  link: AddByRSSPublisherLinkRecord | null,
  nowMs: number
): boolean => {
  if (link === null) {
    return true;
  }
  const updatedAtMs = Date.parse(link.updatedAt);
  return Number.isNaN(updatedAtMs) || nowMs - updatedAtMs > ADD_BY_RSS_PUBLISHER_LINKS_REFRESH_MS;
};

/**
 * Drops artist links whose artist this browser no longer follows, then listed albums no
 * remaining link lists. Returns the feed URLs it removed.
 */
export const pruneAddByRSSPublisherData = async (): Promise<string[]> => {
  const followed = await getAllAddByRSSFeeds();
  const followedUrls = new Set(followed.map((feed) => toAddByRSSComparableFeedUrl(feed.feedUrl)));

  const links = await getAllAddByRSSPublisherLinks();
  const removedLinkUrls: string[] = [];
  const remainingLinks: AddByRSSPublisherLinkRecord[] = [];
  for (const link of links) {
    if (followedUrls.has(toAddByRSSComparableFeedUrl(link.publisherFeedUrl))) {
      remainingLinks.push(link);
    } else {
      removedLinkUrls.push(link.publisherFeedUrl);
    }
  }
  await removeAddByRSSPublisherLinks(removedLinkUrls);

  const listedUrls = new Set<string>();
  for (const link of remainingLinks) {
    for (const row of link.listedFeeds) {
      if (row.kind === 'add_by_rss' && row.feedUrl !== null) {
        listedUrls.add(toAddByRSSComparableFeedUrl(row.feedUrl));
      }
    }
  }

  const listed = await getAllListedAddByRSSFeeds();
  const removedListed = listed.filter(
    (record) => !listedUrls.has(toAddByRSSComparableFeedUrl(record.feedUrl))
  );
  await bulkRemoveListedAddByRSSFeeds(removedListed.map((record) => record.idText));

  const removedUrls = [...removedLinkUrls, ...removedListed.map((record) => record.feedUrl)];
  for (const feedUrl of removedUrls) {
    emitAddByRSSFeedChanged(feedUrl);
  }
  return removedUrls;
};
