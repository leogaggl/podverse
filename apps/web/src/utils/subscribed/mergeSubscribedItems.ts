import type { DTOItem } from '@podverse/helpers';

import type { AddByRSSItemIndexItem } from '../addByRSS/types';
import { toEpochMsOrNull } from './mergeSubscribedChannels';

export type SubscribedItemEntry =
  { source: 'server'; item: DTOItem } | { source: 'add-by-rss'; item: AddByRSSItemIndexItem };

/**
 * One page of subscribed server rows plus this browser's Add by RSS items.
 *
 * Recent mixes the two on page 1, newest first. A missing date sorts after every dated row.
 * Top keeps the server rows, then the Add by RSS items, on the last server page. A shared date
 * keeps the server row, and server rows stay in the order they were given. Any other page is
 * the server rows alone.
 *
 * Add by RSS items arrive newest first. Dated items keep that order. An item with no date
 * (`pubDateMs` 0) is placed after them.
 */
export const mergeSubscribedItemEntries = (params: {
  serverItems: readonly DTOItem[];
  addByRSSItems: readonly AddByRSSItemIndexItem[];
  sort: 'recent' | 'top';
  page: number;
  totalPages: number;
}): SubscribedItemEntry[] => {
  const { serverItems, addByRSSItems, sort, page, totalPages } = params;
  const serverEntries = serverItems.map((item): SubscribedItemEntry => ({
    source: 'server',
    item,
  }));
  const includeAddByRSS =
    (sort === 'recent' && page === 1) || (sort === 'top' && page === totalPages);

  if (!includeAddByRSS) {
    return serverEntries;
  }

  const dated: AddByRSSItemIndexItem[] = [];
  const undated: AddByRSSItemIndexItem[] = [];
  for (const item of addByRSSItems) {
    if (item.pubDateMs === 0) {
      undated.push(item);
    } else {
      dated.push(item);
    }
  }

  const addByRSSEntry = (item: AddByRSSItemIndexItem): SubscribedItemEntry => ({
    source: 'add-by-rss',
    item,
  });

  if (sort === 'top') {
    return [...serverEntries, ...dated.map(addByRSSEntry), ...undated.map(addByRSSEntry)];
  }

  const merged: SubscribedItemEntry[] = [];
  let serverIndex = 0;
  let feedIndex = 0;

  while (serverIndex < serverItems.length && feedIndex < dated.length) {
    const serverItem = serverItems[serverIndex];
    const feedItem = dated[feedIndex];
    if (serverItem === undefined || feedItem === undefined) {
      break;
    }
    const serverMs = toEpochMsOrNull(serverItem.pub_date);
    if (serverMs === null || feedItem.pubDateMs > serverMs) {
      merged.push(addByRSSEntry(feedItem));
      feedIndex += 1;
    } else {
      merged.push({ source: 'server', item: serverItem });
      serverIndex += 1;
    }
  }

  for (const item of serverItems.slice(serverIndex)) {
    merged.push({ source: 'server', item });
  }
  for (const item of dated.slice(feedIndex)) {
    merged.push(addByRSSEntry(item));
  }
  for (const item of undated) {
    merged.push(addByRSSEntry(item));
  }

  return merged;
};
