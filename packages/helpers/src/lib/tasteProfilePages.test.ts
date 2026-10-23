import { describe, expect, it } from 'vitest';

import type { TasteProfilePage } from './tasteProfilePages.js';
import { appendTasteProfilePage, fetchTasteProfilePages } from './tasteProfilePages.js';

type ShowRow = {
  channel: { id_text: string };
};

function showRow(idText: string): ShowRow {
  return { channel: { id_text: idText } };
}

function pagesOfTwo(
  rows: readonly ShowRow[]
): (page: number) => Promise<TasteProfilePage<ShowRow>> {
  const pageSize = 2;
  const totalCount = rows.length;
  const totalPages = totalCount === 0 ? 0 : Math.ceil(totalCount / pageSize);
  return async (page: number) => {
    const start = (page - 1) * pageSize;
    return {
      items: rows.slice(start, start + pageSize),
      pagination: {
        page,
        total_count: totalCount,
        total_pages: totalPages,
      },
    };
  };
}

function ids(rows: readonly ShowRow[]): string[] {
  return rows.map((row) => row.channel.id_text);
}

const FIVE_ROWS = [showRow('a'), showRow('b'), showRow('c'), showRow('d'), showRow('e')];

describe('fetchTasteProfilePages', () => {
  it('returns the first page when one page is requested', async () => {
    const result = await fetchTasteProfilePages(pagesOfTwo(FIVE_ROWS), 1);
    expect(ids(result.rows)).toEqual(['a', 'b']);
    expect(result.loadedPages).toBe(1);
    expect(result.hasMore).toBe(true);
    expect(result.totalCount).toBe(5);
  });

  it('loads each requested page in order and no page past the request', async () => {
    const calls: number[] = [];
    const fetchPage = pagesOfTwo(FIVE_ROWS);
    const result = await fetchTasteProfilePages(async (page) => {
      calls.push(page);
      return fetchPage(page);
    }, 3);
    expect(ids(result.rows)).toEqual(['a', 'b', 'c', 'd', 'e']);
    expect(result.loadedPages).toBe(3);
    expect(result.hasMore).toBe(false);
    expect(calls).toEqual([1, 2, 3]);
  });

  it('stops after the last page the response reports', async () => {
    const calls: number[] = [];
    const fetchPage = pagesOfTwo([showRow('a'), showRow('b'), showRow('c')]);
    const result = await fetchTasteProfilePages(async (page) => {
      calls.push(page);
      return fetchPage(page);
    }, 4);
    expect(result.loadedPages).toBe(2);
    expect(result.hasMore).toBe(false);
    expect(calls).toEqual([1, 2]);
  });

  it('returns no rows for an empty list and still counts one loaded page', async () => {
    const result = await fetchTasteProfilePages(pagesOfTwo([]), 1);
    expect(result.rows).toEqual([]);
    expect(result.loadedPages).toBe(1);
    expect(result.hasMore).toBe(false);
    expect(result.totalCount).toBe(0);
  });

  it('keeps the first copy when the same show arrives on a later page', async () => {
    const rows = [showRow('a'), showRow('b'), showRow('a'), showRow('c')];
    const result = await fetchTasteProfilePages(pagesOfTwo(rows), 2);
    expect(ids(result.rows)).toEqual(['a', 'b', 'c']);
  });

  it('rejects when a later page fails', async () => {
    const fetchPage = pagesOfTwo(FIVE_ROWS);
    await expect(
      fetchTasteProfilePages(async (page) => {
        if (page === 2) {
          throw new Error('page failed');
        }
        return fetchPage(page);
      }, 3)
    ).rejects.toThrow('page failed');
  });
});

describe('appendTasteProfilePage', () => {
  it('adds the next page, records that page as loaded, and recomputes whether more remain', async () => {
    const fetchPage = pagesOfTwo([showRow('a'), showRow('b'), showRow('c')]);
    const current = await fetchTasteProfilePages(fetchPage, 1);
    const next = appendTasteProfilePage(current, await fetchPage(2), 2);
    expect(ids(next.rows)).toEqual(['a', 'b', 'c']);
    expect(next.loadedPages).toBe(2);
    expect(next.hasMore).toBe(false);
    expect(next.totalCount).toBe(3);
  });
});
