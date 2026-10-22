import { articleStrippedTitle } from '@podverse/helpers';

import type { HomeSortOption } from '../../prefs/homeListPrefs';
import type { HomeFeedRowData } from './homeFeedData';

/** How many newest Add by RSS items join Home's stored directory window. */
export const HOME_ADD_BY_RSS_ITEM_LIMIT = 60;

export type HomeItemMergeEntry = { pubDateMs: number | null; row: HomeFeedRowData };

/** Milliseconds from a number, ISO string, or Date; anything unreadable is null. */
export const readItemPubDateMs = (value: unknown): number | null => {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : null;
  }
  if (value instanceof Date) {
    const ms = value.getTime();
    return Number.isNaN(ms) ? null : ms;
  }
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (trimmed.length === 0) {
      return null;
    }
    const parsed = Date.parse(trimmed);
    return Number.isNaN(parsed) ? null : parsed;
  }
  return null;
};

/**
 * Newest publication first. A missing date sorts after every dated row. Equal dates keep input
 * order (`Array.prototype.sort` is stable).
 */
const comparePubDateNewestFirst = (a: HomeItemMergeEntry, b: HomeItemMergeEntry): number => {
  if (a.pubDateMs === null && b.pubDateMs === null) {
    return 0;
  }
  if (a.pubDateMs === null) {
    return 1;
  }
  if (b.pubDateMs === null) {
    return -1;
  }
  return b.pubDateMs - a.pubDateMs;
};

/**
 * Home Episodes and Tracks rows from a stored directory window and Add by RSS items.
 *
 * With no Add by RSS items the directory rows stay in the order they were given. Otherwise the
 * newest Add by RSS window joins them: Recent by date, A-Z by title without a leading article,
 * Popularity with directory rows first and Add by RSS rows after that, newest first.
 */
export const mergeHomeItemRows = (params: {
  addByRss: readonly HomeItemMergeEntry[];
  directory: readonly HomeItemMergeEntry[];
  sort: HomeSortOption;
}): HomeFeedRowData[] => {
  if (params.addByRss.length === 0) {
    return params.directory.map((entry) => entry.row);
  }

  const windowed = [...params.addByRss]
    .sort(comparePubDateNewestFirst)
    .slice(0, HOME_ADD_BY_RSS_ITEM_LIMIT);

  if (params.sort === 'popularity') {
    return [...params.directory.map((entry) => entry.row), ...windowed.map((entry) => entry.row)];
  }

  const combined = [...params.directory, ...windowed];
  if (params.sort === 'alphabetical') {
    return combined
      .sort((a, b) =>
        articleStrippedTitle(a.row.title).localeCompare(articleStrippedTitle(b.row.title))
      )
      .map((entry) => entry.row);
  }

  return combined.sort(comparePubDateNewestFirst).map((entry) => entry.row);
};
