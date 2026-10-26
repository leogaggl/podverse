import { getTotalPages, PAGINATION } from '@podverse/helpers/pagination';

/** FlatList `onEndReachedThreshold` for lists that load the next page near the bottom. */
export const LIST_END_REACHED_THRESHOLD = 0.5;

/**
 * Whether the endpoint holds another page past the one just read.
 *
 * `count` is absent from some list responses; `getTotalPages` answers that by reading a full page as
 * "there is probably more", so a short page ends the list and a full one offers to go further.
 */
export function listResponseHasMore(
  meta: { count: number | null; limit: number; page: number },
  pageRowCount: number
): boolean {
  return getTotalPages(meta.count, meta.limit, pageRowCount, meta.page) > meta.page;
}

/**
 * Whether an array-only page (no `meta`) filled its limit, so another page may exist.
 */
export function fullPageHasMore(
  pageRowCount: number,
  limit: number = PAGINATION.DEFAULT_LIMIT
): boolean {
  return pageRowCount >= limit;
}

/**
 * Append `next` after `current`. A key already present keeps its first position and takes the
 * later value.
 */
export function appendUniqueBy<T>(
  current: readonly T[],
  next: readonly T[],
  keyOf: (row: T) => string
): T[] {
  const byKey = new Map<string, T>();
  for (const row of current) {
    byKey.set(keyOf(row), row);
  }
  for (const row of next) {
    byKey.set(keyOf(row), row);
  }
  return [...byKey.values()];
}

/**
 * Whether the list may request the next page. A page-1 load, a page already in flight, or an
 * error blocks it. `isLoading` is whichever flag means a page-1 load is running.
 */
export function canLoadNextPage(state: {
  hasError: boolean;
  hasMore: boolean;
  isLoading: boolean;
  isLoadingMore: boolean;
}): boolean {
  return state.hasMore && !state.isLoading && !state.isLoadingMore && !state.hasError;
}
