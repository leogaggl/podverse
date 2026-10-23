import type { DTOAccountTasteProfilePagination } from '../dtos/account/accountTasteProfile.js';

/** Rows per request for both Taste Profile lists; matches the API default. */
export const TASTE_PROFILE_PAGE_LIMIT = 20;

type TasteProfileKeyedRow = { channel: { id_text: string } };

export type TasteProfilePage<Row> = {
  items: Row[];
  pagination: DTOAccountTasteProfilePagination;
};

export type TasteProfileRows<Row> = {
  rows: Row[];
  totalCount: number;
  /** Pages 1..loadedPages are in `rows`. Always at least 1. */
  loadedPages: number;
  hasMore: boolean;
};

/**
 * Returns `existing` followed by each incoming row whose show is not already present. The first
 * copy wins: a hide or unhide between page requests shifts offsets, so the same show can arrive
 * again.
 */
export function mergeTasteProfileRows<Row extends TasteProfileKeyedRow>(
  existing: readonly Row[],
  incoming: readonly Row[]
): Row[] {
  const seen = new Set(existing.map((row) => row.channel.id_text));
  const merged = [...existing];
  for (const row of incoming) {
    if (seen.has(row.channel.id_text)) {
      continue;
    }
    seen.add(row.channel.id_text);
    merged.push(row);
  }
  return merged;
}

/**
 * Loads pages 1 through `pageCount`, one at a time, and stops early when the latest response
 * has no further page. A rejected page rejects the whole call.
 */
export async function fetchTasteProfilePages<Row extends TasteProfileKeyedRow>(
  fetchPage: (page: number) => Promise<TasteProfilePage<Row>>,
  pageCount: number
): Promise<TasteProfileRows<Row>> {
  const target = Math.max(1, Math.floor(pageCount));
  let page = await fetchPage(1);
  let rows = mergeTasteProfileRows([], page.items);
  let nextPage = 2;
  while (nextPage <= target && nextPage <= page.pagination.total_pages) {
    page = await fetchPage(nextPage);
    rows = mergeTasteProfileRows(rows, page.items);
    nextPage += 1;
  }
  const totalPages = page.pagination.total_pages;
  const loadedPages = Math.max(1, Math.min(target, totalPages));
  return {
    rows,
    totalCount: page.pagination.total_count,
    loadedPages,
    hasMore: loadedPages < totalPages,
  };
}

/** Merges one more page into rows the caller already has. */
export function appendTasteProfilePage<Row extends TasteProfileKeyedRow>(
  current: TasteProfileRows<Row>,
  page: TasteProfilePage<Row>,
  pageNumber: number
): TasteProfileRows<Row> {
  const loadedPages = pageNumber <= page.pagination.total_pages ? pageNumber : current.loadedPages;
  return {
    rows: mergeTasteProfileRows(current.rows, page.items),
    totalCount: page.pagination.total_count,
    loadedPages,
    hasMore: loadedPages < page.pagination.total_pages,
  };
}
