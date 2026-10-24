/**
 * Load add-by-RSS index item from queue resource data (e.g. for "play next from queue").
 * Livestreams (`start_time` set) come from IndexedDB by id_text, then from the embedded liveItem.
 * Episodes are looked up in order: IndexedDB by id_text, this browser's parsed copy of the feed
 * (`feed_url` + guid, or + `enclosure_url` for a missing or device-local guid), the embedded
 * bundle, and last a minimal item built from the resource data alone.
 */

import type { AddByRSSResourceData } from '@podverse/helpers';
import {
  buildMinimalAddByRSSItemFromResourceData,
  reconstructAddByRSSItemFromResourceData,
  reconstructAddByRSSLivestreamFromResourceData,
} from '@podverse/parser-mapping';

import { toAddByRSSFeedChangedUrl } from './feedChangedEvent';
import { findAddByRSSItemInFeed } from './itemIndex';
import {
  getAddByRSSFeedByUrl,
  getAddByRSSItemById,
  getAddByRSSItemByIdText,
  getAddByRSSLivestreamByIdText,
  getAllAddByRSSFeeds,
} from './storage';
import type {
  AddByRSSFeedRecord,
  AddByRSSItemIndexItem,
  AddByRSSLivestreamIndexItem,
} from './types.js';

/**
 * Where a resolved item came from. `'bundle'` and `'minimal'` lack this browser's parse of the
 * feed, so their metadata can be upgraded once the feed is parsed.
 */
export type AddByRSSResolvedSource = 'local' | 'feed' | 'bundle' | 'minimal';

export type AddByRSSResolvedIndexItem = {
  indexItem: AddByRSSItemIndexItem | AddByRSSLivestreamIndexItem;
  source: AddByRSSResolvedSource;
};

const trimmedOrNull = (value: unknown): string | null => {
  if (typeof value !== 'string') {
    return null;
  }
  const trimmed = value.trim();
  return trimmed === '' ? null : trimmed;
};

/** The `feed_url` on resource data, or null when the payload has none. */
export const getAddByRSSResourceDataFeedUrl = (
  resourceData: AddByRSSResourceData | null | undefined
): string | null => trimmedOrNull(resourceData?.['feed_url']);

const findStoredFeedRecord = async (feedUrl: string): Promise<AddByRSSFeedRecord | null> => {
  const exact = await getAddByRSSFeedByUrl(feedUrl);
  if (exact) {
    return exact;
  }
  const canonical = toAddByRSSFeedChangedUrl(feedUrl);
  const feeds = await getAllAddByRSSFeeds();
  return feeds.find((feed) => toAddByRSSFeedChangedUrl(feed.feedUrl) === canonical) ?? null;
};

/**
 * The episode a row refers to in this browser's parsed copy of its feed, keeping the id_text the
 * item already has in the index. Null when the feed is not stored, not parsed, or lacks the item.
 */
export async function findAddByRSSItemInStoredFeed(
  resourceData: AddByRSSResourceData
): Promise<AddByRSSItemIndexItem | null> {
  const feedUrl = getAddByRSSResourceDataFeedUrl(resourceData);
  if (feedUrl === null) {
    return null;
  }
  const feed = await findStoredFeedRecord(feedUrl);
  if (!feed?.mappedFeed) {
    return null;
  }
  const found = findAddByRSSItemInFeed(feed, {
    guid: trimmedOrNull(resourceData.guid),
    channelIdText: trimmedOrNull(resourceData.channel_id_text),
    enclosureUrl: trimmedOrNull(resourceData['enclosure_url']),
  });
  if (!found) {
    return null;
  }
  const indexed = await getAddByRSSItemById(found.id);
  return indexed ? { ...found, idText: indexed.idText } : found;
}

/** True when this browser stores a record for the row's feed (followed and synced here). */
export async function hasStoredAddByRSSFeed(feedUrl: string): Promise<boolean> {
  return (await findStoredFeedRecord(feedUrl)) !== null;
}

/**
 * Resolve the index item for add_by_rss_resource_data (queue/playlist API) and where it came from.
 * Returns null when nothing can play.
 */
export async function resolveAddByRSSIndexItemFromResourceData(
  resourceData: AddByRSSResourceData | null | undefined
): Promise<AddByRSSResolvedIndexItem | null> {
  if (!resourceData || typeof resourceData !== 'object') {
    return null;
  }

  const idText = trimmedOrNull(resourceData.id_text);
  const hasStartTime =
    resourceData.start_time !== null &&
    resourceData.start_time !== undefined &&
    resourceData.start_time !== '';

  if (hasStartTime) {
    const livestream = idText ? await getAddByRSSLivestreamByIdText(idText) : null;
    if (livestream) {
      return { indexItem: livestream, source: 'local' };
    }
    const reconstructed = reconstructAddByRSSLivestreamFromResourceData(resourceData);
    return reconstructed ? { indexItem: reconstructed, source: 'bundle' } : null;
  }

  const local = idText ? await getAddByRSSItemByIdText(idText) : null;
  if (local) {
    return { indexItem: local, source: 'local' };
  }

  const fromFeed = await findAddByRSSItemInStoredFeed(resourceData);
  if (fromFeed) {
    return { indexItem: fromFeed, source: 'feed' };
  }

  const reconstructed = reconstructAddByRSSItemFromResourceData(resourceData);
  if (reconstructed) {
    return { indexItem: reconstructed, source: 'bundle' };
  }

  const minimal = buildMinimalAddByRSSItemFromResourceData(resourceData);
  return minimal ? { indexItem: minimal, source: 'minimal' } : null;
}

/** The index item for add_by_rss_resource_data, or null when nothing can play. */
export async function loadAddByRSSIndexItemFromResourceData(
  resourceData: AddByRSSResourceData | null | undefined
): Promise<AddByRSSItemIndexItem | AddByRSSLivestreamIndexItem | null> {
  return (await resolveAddByRSSIndexItemFromResourceData(resourceData))?.indexItem ?? null;
}
