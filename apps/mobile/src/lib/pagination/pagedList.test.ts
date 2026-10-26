import { describe, expect, it } from 'vitest';

import { PAGINATION } from '@podverse/helpers/pagination';

import { appendUniqueBy, canLoadNextPage, fullPageHasMore, listResponseHasMore } from './pagedList';

const ready = {
  hasError: false,
  hasMore: true,
  isLoading: false,
  isLoadingMore: false,
};

describe('listResponseHasMore', () => {
  it('treats a full page with an unknown count as another page', () => {
    expect(listResponseHasMore({ count: null, limit: 60, page: 1 }, 60)).toBe(true);
  });

  it('treats a short page with an unknown count as the end', () => {
    expect(listResponseHasMore({ count: null, limit: 60, page: 1 }, 59)).toBe(false);
  });

  it('has more when a known count continues past the current page', () => {
    expect(listResponseHasMore({ count: 120, limit: 60, page: 1 }, 60)).toBe(true);
  });

  it('ends when a known count is on the last page', () => {
    expect(listResponseHasMore({ count: 120, limit: 60, page: 2 }, 60)).toBe(false);
  });
});

describe('fullPageHasMore', () => {
  it('has more at the default page size and not one row under it', () => {
    expect(fullPageHasMore(PAGINATION.DEFAULT_LIMIT)).toBe(true);
    expect(fullPageHasMore(PAGINATION.DEFAULT_LIMIT - 1)).toBe(false);
  });

  it('honors a custom limit', () => {
    expect(fullPageHasMore(10, 10)).toBe(true);
    expect(fullPageHasMore(9, 10)).toBe(false);
  });
});

describe('appendUniqueBy', () => {
  const keyOf = (row: { id: string; label: string }) => row.id;

  it('appends new keys in order', () => {
    expect(
      appendUniqueBy(
        [
          { id: 'a', label: 'A1' },
          { id: 'b', label: 'B1' },
        ],
        [{ id: 'c', label: 'C1' }],
        keyOf
      )
    ).toEqual([
      { id: 'a', label: 'A1' },
      { id: 'b', label: 'B1' },
      { id: 'c', label: 'C1' },
    ]);
  });

  it('keeps the first position and takes the later value for a repeated key', () => {
    expect(
      appendUniqueBy(
        [
          { id: 'a', label: 'A1' },
          { id: 'b', label: 'B1' },
        ],
        [
          { id: 'b', label: 'B2' },
          { id: 'c', label: 'C1' },
        ],
        keyOf
      )
    ).toEqual([
      { id: 'a', label: 'A1' },
      { id: 'b', label: 'B2' },
      { id: 'c', label: 'C1' },
    ]);
  });
});

describe('canLoadNextPage', () => {
  it('is true only when another page exists and nothing is loading or failed', () => {
    expect(canLoadNextPage(ready)).toBe(true);
    expect(canLoadNextPage({ ...ready, hasMore: false })).toBe(false);
    expect(canLoadNextPage({ ...ready, isLoading: true })).toBe(false);
    expect(canLoadNextPage({ ...ready, isLoadingMore: true })).toBe(false);
    expect(canLoadNextPage({ ...ready, hasError: true })).toBe(false);
  });
});
