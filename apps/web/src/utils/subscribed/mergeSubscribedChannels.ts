import { articleStrippedTitle } from '@podverse/helpers';
import type { QueryParamsSubscribedFullSort } from '@podverse/helpers-requests';

export type SubscribedChannelEntry<T> = {
  item: T;
  title: string;
  lastPubDateMs: number | null;
};

/** Epoch milliseconds, or null when the value is missing or not a real date. */
export const toEpochMsOrNull = (value: Date | string | null | undefined): number | null => {
  if (value === null || value === undefined) {
    return null;
  }
  const ms = value instanceof Date ? value.getTime() : new Date(value).getTime();
  return Number.isNaN(ms) ? null : ms;
};

const compareStrippedTitle = <T>(
  a: SubscribedChannelEntry<T>,
  b: SubscribedChannelEntry<T>
): number => {
  return articleStrippedTitle(a.title).localeCompare(articleStrippedTitle(b.title));
};

/**
 * Newest or oldest first. A missing date sorts after every dated row. Equal dates fall back to
 * the stripped title, and equal titles stay in input order.
 */
const compareByDate = <T>(
  a: SubscribedChannelEntry<T>,
  b: SubscribedChannelEntry<T>,
  newestFirst: boolean
): number => {
  const aMs = a.lastPubDateMs;
  const bMs = b.lastPubDateMs;

  if (aMs === null && bMs === null) {
    return compareStrippedTitle(a, b);
  }
  if (aMs === null) {
    return 1;
  }
  if (bMs === null) {
    return -1;
  }
  if (aMs === bMs) {
    return compareStrippedTitle(a, b);
  }
  return newestFirst ? bMs - aMs : aMs - bMs;
};

const compareForSort = <T>(
  sort: QueryParamsSubscribedFullSort,
  a: SubscribedChannelEntry<T>,
  b: SubscribedChannelEntry<T>
): number => {
  if (sort === 'recent' || sort === 'top') {
    return compareByDate(a, b, true);
  }
  if (sort === 'oldest') {
    return compareByDate(a, b, false);
  }
  return compareStrippedTitle(a, b);
};

/**
 * Server rows and this browser's Add by RSS feeds in one subscribed order.
 *
 * Server rows stay in the order they were given. Feeds are sorted, then walked in step with the
 * server list. A feed is taken only when it sorts strictly ahead of the next server row, so a tie
 * keeps the server row and two server rows never trade places.
 *
 * Under top, feeds have no listen count, so every server row comes first and the feeds follow,
 * newest first.
 */
export const mergeSubscribedChannelEntries = <T>(params: {
  server: readonly SubscribedChannelEntry<T>[];
  addByRSS: readonly SubscribedChannelEntry<T>[];
  sort: QueryParamsSubscribedFullSort;
}): T[] => {
  const { server, addByRSS, sort } = params;

  if (sort === 'top') {
    const feeds = [...addByRSS].sort((a, b) => compareByDate(a, b, true));
    return [...server.map((entry) => entry.item), ...feeds.map((entry) => entry.item)];
  }

  const feeds = [...addByRSS].sort((a, b) => compareForSort(sort, a, b));
  const merged: T[] = [];
  let serverIndex = 0;
  let feedIndex = 0;

  while (serverIndex < server.length && feedIndex < feeds.length) {
    const serverEntry = server[serverIndex];
    const feedEntry = feeds[feedIndex];
    if (serverEntry === undefined || feedEntry === undefined) {
      break;
    }
    if (compareForSort(sort, feedEntry, serverEntry) < 0) {
      merged.push(feedEntry.item);
      feedIndex += 1;
    } else {
      merged.push(serverEntry.item);
      serverIndex += 1;
    }
  }

  for (const entry of server.slice(serverIndex)) {
    merged.push(entry.item);
  }
  for (const entry of feeds.slice(feedIndex)) {
    merged.push(entry.item);
  }

  return merged;
};
