import { describe, expect, it } from 'vitest';

import type { DTOQueueResource } from '@podverse/helpers/dto';
import { PAGINATION } from '@podverse/helpers/pagination';

import { safeJsonParse } from '../../data/db/serialization';
import { readHistoryPages } from './historyPages';

const buildResource = (id: number): DTOQueueResource => {
  const parsed = safeJsonParse<DTOQueueResource>(
    JSON.stringify({
      clip_id: null,
      completed: false,
      id,
      item: {},
      item_id: id,
      item_soundbite_id: null,
      list_position: String(id),
      media_file_duration: '120',
      playback_position: '0',
      playlist_id: 1,
    })
  );
  if (parsed === null) {
    throw new Error('Failed to build DTOQueueResource fixture');
  }
  return parsed;
};

const buildPage = (firstId: number, length: number): DTOQueueResource[] =>
  Array.from({ length }, (_, index) => buildResource(firstId + index));

const fullPage = (pageNumber: number): DTOQueueResource[] =>
  buildPage((pageNumber - 1) * PAGINATION.DEFAULT_LIMIT + 1, PAGINATION.DEFAULT_LIMIT);

const createFetchPage = (pages: Record<number, DTOQueueResource[] | Error>) => {
  const requestedPages: number[] = [];
  const fetchPage = async (page: number): Promise<DTOQueueResource[]> => {
    requestedPages.push(page);
    const result = pages[page];
    if (result instanceof Error) {
      throw result;
    }
    return result ?? [];
  };
  return { fetchPage, requestedPages };
};

const idsOf = (resources: DTOQueueResource[]): number[] => resources.map((resource) => resource.id);

describe('readHistoryPages', () => {
  it('reads only page 1 for a page count of 1 and reports more when that page is full', async () => {
    const { fetchPage, requestedPages } = createFetchPage({ 1: fullPage(1), 2: fullPage(2) });

    const read = await readHistoryPages(fetchPage, 1);

    expect(requestedPages).toEqual([1]);
    expect(read.pagesRead).toBe(1);
    expect(read.hasMore).toBe(true);
    expect(read.resources).toHaveLength(PAGINATION.DEFAULT_LIMIT);
  });

  it('reads three full pages in order and joins them', async () => {
    const { fetchPage, requestedPages } = createFetchPage({
      1: fullPage(1),
      2: fullPage(2),
      3: fullPage(3),
    });

    const read = await readHistoryPages(fetchPage, 3);

    expect(requestedPages).toEqual([1, 2, 3]);
    expect(read.pagesRead).toBe(3);
    expect(read.hasMore).toBe(true);
    expect(idsOf(read.resources)).toEqual(idsOf([...fullPage(1), ...fullPage(2), ...fullPage(3)]));
  });

  it('stops after a short page and reports no more', async () => {
    const shortPage = buildPage(PAGINATION.DEFAULT_LIMIT + 1, 5);
    const { fetchPage, requestedPages } = createFetchPage({
      1: fullPage(1),
      2: shortPage,
      3: fullPage(3),
    });

    const read = await readHistoryPages(fetchPage, 3);

    expect(requestedPages).toEqual([1, 2]);
    expect(read.pagesRead).toBe(2);
    expect(read.hasMore).toBe(false);
    expect(read.resources).toHaveLength(PAGINATION.DEFAULT_LIMIT + 5);
  });

  it('still reads page 1 when the page count is 0', async () => {
    const { fetchPage, requestedPages } = createFetchPage({ 1: buildPage(1, 3) });

    const read = await readHistoryPages(fetchPage, 0);

    expect(requestedPages).toEqual([1]);
    expect(read.pagesRead).toBe(1);
    expect(read.hasMore).toBe(false);
    expect(idsOf(read.resources)).toEqual([1, 2, 3]);
  });

  it('keeps a resource repeated across pages once, at its first position', async () => {
    const pageOne = fullPage(1);
    const repeated = buildResource(11);
    const pageTwo = [repeated, ...buildPage(PAGINATION.DEFAULT_LIMIT + 1, 2)];
    const { fetchPage } = createFetchPage({ 1: pageOne, 2: pageTwo });

    const read = await readHistoryPages(fetchPage, 2);

    const ids = idsOf(read.resources);
    expect(ids.filter((id) => id === repeated.id)).toHaveLength(1);
    expect(ids.indexOf(repeated.id)).toBe(10);
    expect(ids).toHaveLength(PAGINATION.DEFAULT_LIMIT + 2);
  });

  it('rejects the whole read when a page rejects', async () => {
    const { fetchPage, requestedPages } = createFetchPage({
      1: fullPage(1),
      2: new Error('page failed'),
      3: fullPage(3),
    });

    await expect(readHistoryPages(fetchPage, 3)).rejects.toThrow('page failed');
    expect(requestedPages).toEqual([1, 2]);
  });
});
