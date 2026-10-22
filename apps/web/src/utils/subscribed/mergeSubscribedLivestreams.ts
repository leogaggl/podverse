import type { DTOItem, UpcomingLiveItemSortKey } from '@podverse/helpers';
import { compareUpcomingLiveItems, isUpcomingLiveItemStatus } from '@podverse/helpers';

import type { AddByRSSLivestreamIndexItem } from '../addByRSS/types';
import { toEpochMsOrNull } from './mergeSubscribedChannels';

export type SubscribedLivestreamEntry =
  | { source: 'server'; item: DTOItem }
  | { source: 'add-by-rss'; item: AddByRSSLivestreamIndexItem };

/** A start time of 0 or less is missing and sorts last in its group. */
const addByRSSUpcomingSortKey = (item: AddByRSSLivestreamIndexItem): UpcomingLiveItemSortKey => ({
  statusId: item.liveItem.live_item_status,
  startTimeMs: item.startTimeMs > 0 ? item.startTimeMs : null,
});

const serverUpcomingSortKey = (item: DTOItem): UpcomingLiveItemSortKey => ({
  statusId: item.live_item?.live_item_status_id,
  startTimeMs: toEpochMsOrNull(item.live_item?.start_time),
});

/**
 * Upcoming live items of the flagged feeds: on the air first, then scheduled.
 * An item from an unflagged feed, and an ended item, are left out.
 */
export const selectUpcomingAddByRSSLivestreams = (
  items: readonly AddByRSSLivestreamIndexItem[],
  flaggedFeedIdTexts: ReadonlySet<string>
): AddByRSSLivestreamIndexItem[] => {
  const upcoming = items.filter(
    (item) =>
      flaggedFeedIdTexts.has(item.channelIdText) &&
      isUpcomingLiveItemStatus(item.liveItem.live_item_status)
  );
  upcoming.sort((a, b) =>
    compareUpcomingLiveItems(addByRSSUpcomingSortKey(a), addByRSSUpcomingSortKey(b))
  );
  return upcoming;
};

/**
 * Page 1 mixes server livestreams with Add by RSS livestreams in the upcoming order.
 * Equal sort keys keep the server row, because server rows are listed first and the sort is
 * stable. Any later page, and a page with no Add by RSS items, is the server rows in the order
 * they were given.
 */
export const mergeSubscribedLivestreamEntries = (params: {
  serverItems: readonly DTOItem[];
  addByRSSItems: readonly AddByRSSLivestreamIndexItem[];
  page: number;
}): SubscribedLivestreamEntry[] => {
  const serverEntries = params.serverItems.map(
    (item): SubscribedLivestreamEntry => ({ source: 'server', item })
  );
  if (params.page !== 1 || params.addByRSSItems.length === 0) {
    return serverEntries;
  }

  const addByRSSEntries = params.addByRSSItems.map(
    (item): SubscribedLivestreamEntry => ({ source: 'add-by-rss', item })
  );
  const merged = [...serverEntries, ...addByRSSEntries];
  merged.sort((a, b) =>
    compareUpcomingLiveItems(
      a.source === 'server' ? serverUpcomingSortKey(a.item) : addByRSSUpcomingSortKey(a.item),
      b.source === 'server' ? serverUpcomingSortKey(b.item) : addByRSSUpcomingSortKey(b.item)
    )
  );
  return merged;
};
