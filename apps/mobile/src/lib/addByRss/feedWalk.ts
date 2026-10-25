import type { AddByRSSResourceData } from '@podverse/helpers/dto';
import { toNonEmptyTrimmedString } from '@podverse/helpers/guards';
import type { AddByRSSMappedFeed } from '@podverse/parser-mapping';
import type {
  AddByRSSListContextState,
  AddByRSSListEpisode,
} from '@podverse/playback-core/addByRSSListWalk';
import {
  buildAddByRSSListContext,
  orderAddByRSSEpisodeIdTexts,
} from '@podverse/playback-core/addByRSSListWalk';

import type { MobileAddByRSSFeedRecord } from '../../prefs/addByRSSFeeds';
import {
  toAddByRssItemPlaybackResourceData,
  toAddByRssLiveItemPlaybackResourceData,
} from './domain';
import { addByRssDownloadItemIdText } from './downloadIdText';
import { toAddByRssFeedLiveRows } from './liveRows';
import { addByRssPlaybackMediaId, isAddByRssLivestreamResourceData } from './resourceData';

/** One playable feed item: what the player loads, keyed by its playback media id. */
export type AddByRssFeedPlayEntry = {
  idText: string;
  resourceData: AddByRSSResourceData;
  localDownloadItemIdText?: string;
};

/**
 * One feed's items in list order around the item playing. `context` is null when the playing item
 * is not in this device's copy of the feed, so that item has no feed Next or Previous.
 */
export type AddByRssFeedWalk = {
  entries: ReadonlyMap<string, AddByRssFeedPlayEntry>;
  context: AddByRSSListContextState | null;
};

/**
 * The play request for one parsed episode, shared by a row tap and a feed step so both load the
 * same thing. Null when the item has no enclosure URL.
 */
export function addByRssEpisodePlayEntry(
  feed: MobileAddByRSSFeedRecord,
  mappedFeed: AddByRSSMappedFeed,
  itemBundle: AddByRSSMappedFeed['items'][number],
  itemIndex: number
): AddByRssFeedPlayEntry | null {
  const enclosureUrl = itemBundle.enclosures[0]?.item_enclosure_sources[0]?.uri ?? null;
  if (enclosureUrl === null) {
    return null;
  }
  const resourceData = toAddByRssItemPlaybackResourceData(feed, mappedFeed, itemBundle, itemIndex);
  return {
    idText: addByRssPlaybackMediaId(resourceData),
    localDownloadItemIdText: addByRssDownloadItemIdText(feed.feedUrl, itemBundle.item, itemIndex),
    resourceData,
  };
}

/** The play request for the episode with this playback media id; null when the feed lacks it. */
export function findAddByRssEpisodePlayEntry(
  feed: MobileAddByRSSFeedRecord,
  mappedFeed: AddByRSSMappedFeed,
  mediaId: string
): AddByRssFeedPlayEntry | null {
  for (const [itemIndex, itemBundle] of mappedFeed.items.entries()) {
    const entry = addByRssEpisodePlayEntry(feed, mappedFeed, itemBundle, itemIndex);
    if (entry !== null && entry.idText === mediaId) {
      return entry;
    }
  }
  return null;
}

/** Missing or unparseable publish dates read as 0, so those items sort oldest. */
const pubDateMsOf = (itemBundle: AddByRSSMappedFeed['items'][number]): number => {
  const pubDate = itemBundle.item.pub_date;
  if (pubDate === null || pubDate === undefined) {
    return 0;
  }
  const ms = new Date(pubDate).getTime();
  return Number.isFinite(ms) ? ms : 0;
};

const livestreamOrder = (
  feed: MobileAddByRSSFeedRecord,
  mappedFeed: AddByRSSMappedFeed,
  now: Date | undefined
): { entries: Map<string, AddByRssFeedPlayEntry>; orderedIdTexts: string[] } => {
  const entries = new Map<string, AddByRssFeedPlayEntry>();
  const orderedIdTexts: string[] = [];
  for (const row of toAddByRssFeedLiveRows(feed, mappedFeed, now)) {
    const { liveBundle, liveIndex } = row.target;
    if (toNonEmptyTrimmedString(liveBundle.item.enclosure.url) === null) {
      continue;
    }
    const resourceData = toAddByRssLiveItemPlaybackResourceData(
      feed,
      mappedFeed,
      liveBundle,
      liveIndex
    );
    const idText = addByRssPlaybackMediaId(resourceData);
    if (entries.has(idText)) {
      continue;
    }
    entries.set(idText, { idText, resourceData });
    orderedIdTexts.push(idText);
  }
  return { entries, orderedIdTexts };
};

const episodeOrder = (
  feed: MobileAddByRSSFeedRecord,
  mappedFeed: AddByRSSMappedFeed
): { entries: Map<string, AddByRssFeedPlayEntry>; orderedIdTexts: string[] } => {
  const entries = new Map<string, AddByRssFeedPlayEntry>();
  const episodes: AddByRSSListEpisode[] = [];
  mappedFeed.items.forEach((itemBundle, itemIndex) => {
    const entry = addByRssEpisodePlayEntry(feed, mappedFeed, itemBundle, itemIndex);
    if (entry === null || entries.has(entry.idText)) {
      return;
    }
    entries.set(entry.idText, entry);
    episodes.push({ idText: entry.idText, pubDateMs: pubDateMsOf(itemBundle) });
  });
  return { entries, orderedIdTexts: orderAddByRSSEpisodeIdTexts(episodes, 'recent') };
};

/**
 * The walk for the feed `current` belongs to, built from this device's parsed copy. Episodes are
 * ordered by publish date, newest first; livestreams follow the feed page's channel order. Next is
 * the newer neighbor and Previous the older one.
 */
export function buildAddByRssFeedWalk(
  feed: MobileAddByRSSFeedRecord,
  mappedFeed: AddByRSSMappedFeed,
  current: AddByRSSResourceData,
  now?: Date
): AddByRssFeedWalk {
  const { entries, orderedIdTexts } = isAddByRssLivestreamResourceData(current)
    ? livestreamOrder(feed, mappedFeed, now)
    : episodeOrder(feed, mappedFeed);
  return {
    context: buildAddByRSSListContext({
      currentIdText: addByRssPlaybackMediaId(current),
      feedIdText: feed.feedUrl,
      orderedIdTexts,
      sortOrder: 'recent',
    }),
    entries,
  };
}
