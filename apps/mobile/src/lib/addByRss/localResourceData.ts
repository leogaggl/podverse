import { getAddByRSSHashId } from '@podverse/helpers';
import type { AddByRSSResourceData } from '@podverse/helpers/dto';
import { toNonEmptyTrimmedString } from '@podverse/helpers/guards';
import type { AddByRSSMappedFeed } from '@podverse/parser-mapping';

import type { MobileAddByRSSFeedRecord } from '../../prefs/addByRSSFeeds';
import {
  toAddByRssItemPlaybackResourceData,
  toAddByRssLiveItemPlaybackResourceData,
} from './domain';
import type { AddByRssItemSectionUrls } from './itemSections';
import { addByRssItemSectionUrls } from './itemSections';
import {
  addByRssPlaybackMediaId,
  isAddByRssLivestreamResourceData,
  withCanonicalAddByRssFeedUrl,
} from './resourceData';

export type LocalAddByRssFeedLookup = {
  getFeedByUrl: (feedUrl: string) => Promise<MobileAddByRSSFeedRecord | null>;
  getMappedFeedByUrl: (feedUrl: string) => Promise<AddByRSSMappedFeed | null>;
};

export type LocalAddByRssFeedListLookup = {
  listFeeds: () => Promise<MobileAddByRSSFeedRecord[]>;
  getMappedFeedByUrl: (feedUrl: string) => Promise<AddByRSSMappedFeed | null>;
};

export type AddByRssLocalItem = {
  itemBundle: AddByRSSMappedFeed['items'][number];
  itemIndex: number;
  itemKey: string;
};

export type AddByRssNowPlayingItemSource = {
  feedUrl: string;
  itemBundle: AddByRSSMappedFeed['items'][number];
  itemIdText: string;
  sectionUrls: AddByRssItemSectionUrls | null;
};

const findLocalItemIndex = (
  mappedFeed: AddByRSSMappedFeed,
  guid: string | null,
  enclosureUrl: string | null
): number => {
  if (guid !== null) {
    const byGuid = mappedFeed.items.findIndex((bundle) => bundle.item.guid === guid);
    if (byGuid >= 0) {
      return byGuid;
    }
  }
  if (enclosureUrl === null) {
    return -1;
  }
  return mappedFeed.items.findIndex((bundle) =>
    bundle.enclosures.some((enclosure) =>
      enclosure.item_enclosure_sources.some((source) => source.uri === enclosureUrl)
    )
  );
};

/** The parsed item a resource points at, keyed by guid or index; null for livestreams. */
export const findAddByRssLocalItem = (
  mappedFeed: AddByRSSMappedFeed,
  resourceData: AddByRSSResourceData
): AddByRssLocalItem | null => {
  if (isAddByRssLivestreamResourceData(resourceData)) {
    return null;
  }
  const itemIndex = findLocalItemIndex(
    mappedFeed,
    toNonEmptyTrimmedString(resourceData.guid),
    toNonEmptyTrimmedString(resourceData.enclosure_url)
  );
  const itemBundle = mappedFeed.items[itemIndex];
  if (itemBundle === undefined) {
    return null;
  }
  return {
    itemBundle,
    itemIndex,
    itemKey: toNonEmptyTrimmedString(itemBundle.item.guid) ?? String(itemIndex),
  };
};

/** Item key for AddByRssEpisodeDetail: the item guid, or the index when the item has none. */
export const addByRssEpisodeItemKey = (
  mappedFeed: AddByRSSMappedFeed,
  resourceData: AddByRSSResourceData
): string | null => findAddByRssLocalItem(mappedFeed, resourceData)?.itemKey ?? null;

/** This device's stored feed and parsed bundle. Null when either is missing or the read throws. */
const loadLocalFeed = async (
  lookup: LocalAddByRssFeedLookup,
  feedUrl: string
): Promise<{ mappedFeed: AddByRSSMappedFeed; record: MobileAddByRSSFeedRecord } | null> => {
  let record: MobileAddByRSSFeedRecord | null;
  let mappedFeed: AddByRSSMappedFeed | null;
  try {
    [record, mappedFeed] = await Promise.all([
      lookup.getFeedByUrl(feedUrl),
      lookup.getMappedFeedByUrl(feedUrl),
    ]);
  } catch {
    return null;
  }
  if (record === null || mappedFeed === null) {
    return null;
  }
  return { mappedFeed, record };
};

/**
 * Resource data for playing a server Add by RSS row on this device. When this device has parsed the
 * same feed, its own copy of the episode plays (matched by canonical feed URL, then guid or
 * enclosure, and confirmed by id). Otherwise the row's resource data plays as stored, so an episode
 * started on another device resumes here before this device has parsed that feed.
 */
export async function resolveLocalAddByRssResourceData(
  resourceData: AddByRSSResourceData,
  lookup: LocalAddByRssFeedLookup
): Promise<AddByRSSResourceData> {
  const rowData = withCanonicalAddByRssFeedUrl(resourceData);
  if (isAddByRssLivestreamResourceData(rowData)) {
    return rowData;
  }
  const feedUrl = toNonEmptyTrimmedString(rowData.feed_url);
  if (feedUrl === null) {
    return rowData;
  }

  const loaded = await loadLocalFeed(lookup, feedUrl);
  if (loaded === null) {
    return rowData;
  }

  const local = findAddByRssLocalItem(loaded.mappedFeed, rowData);
  if (local === null) {
    return rowData;
  }

  const localData = toAddByRssItemPlaybackResourceData(
    loaded.record,
    loaded.mappedFeed,
    local.itemBundle,
    local.itemIndex
  );
  return getAddByRSSHashId(localData) === getAddByRSSHashId(rowData) ? localData : rowData;
}

/**
 * The local Add by RSS episode, track, or livestream whose playback hash is `hashId`, or null.
 * Searches every followed feed's parsed bundle; a feed with no bundle, or one whose read throws, is
 * skipped.
 */
export async function findLocalAddByRssResourceDataByHash(
  hashId: string,
  lookup: LocalAddByRssFeedListLookup
): Promise<AddByRSSResourceData | null> {
  let feeds: MobileAddByRSSFeedRecord[];
  try {
    feeds = await lookup.listFeeds();
  } catch {
    return null;
  }

  for (const record of feeds) {
    let mappedFeed: AddByRSSMappedFeed | null;
    try {
      mappedFeed = await lookup.getMappedFeedByUrl(record.feedUrl);
    } catch {
      continue;
    }
    if (mappedFeed === null) {
      continue;
    }

    for (const [itemIndex, itemBundle] of mappedFeed.items.entries()) {
      const data = toAddByRssItemPlaybackResourceData(record, mappedFeed, itemBundle, itemIndex);
      if (addByRssPlaybackMediaId(data) === hashId) {
        return data;
      }
    }
    for (const [liveIndex, liveBundle] of mappedFeed.liveItems.entries()) {
      const data = toAddByRssLiveItemPlaybackResourceData(
        record,
        mappedFeed,
        liveBundle,
        liveIndex
      );
      if (addByRssPlaybackMediaId(data) === hashId) {
        return data;
      }
    }
  }
  return null;
}

/**
 * This device's parsed copy of the Add by RSS item a resource points at, for the player's
 * chapters, transcript, Summary, and People. Null for livestreams, a feed this device has not
 * parsed, or an item the parsed feed no longer lists.
 */
export async function resolveAddByRssNowPlayingItemSource(
  resourceData: AddByRSSResourceData,
  lookup: LocalAddByRssFeedLookup
): Promise<AddByRssNowPlayingItemSource | null> {
  const rowData = withCanonicalAddByRssFeedUrl(resourceData);
  if (isAddByRssLivestreamResourceData(rowData)) {
    return null;
  }
  const feedUrl = toNonEmptyTrimmedString(rowData.feed_url);
  if (feedUrl === null) {
    return null;
  }

  const loaded = await loadLocalFeed(lookup, feedUrl);
  if (loaded === null) {
    return null;
  }

  const local = findAddByRssLocalItem(loaded.mappedFeed, rowData);
  if (local === null) {
    return null;
  }

  const localData = toAddByRssItemPlaybackResourceData(
    loaded.record,
    loaded.mappedFeed,
    local.itemBundle,
    local.itemIndex
  );
  if (getAddByRSSHashId(localData) !== getAddByRSSHashId(rowData)) {
    return null;
  }

  return {
    feedUrl: loaded.record.feedUrl,
    itemBundle: local.itemBundle,
    itemIdText: `${loaded.record.idText}-${local.itemKey}`,
    sectionUrls: addByRssItemSectionUrls(local.itemBundle),
  };
}
