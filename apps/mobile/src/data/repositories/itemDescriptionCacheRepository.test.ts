import { describe, expect, it, vi } from 'vitest';

import {
  selectItemDescriptionEvictions,
  toItemDescriptionCacheEntry,
} from './itemDescriptionCacheRepository';

vi.mock('../db', () => ({
  getDb: vi.fn(),
  initializeDatabase: vi.fn(),
  schema: {},
}));
vi.mock('../../auth/authRequestWithRefresh', () => ({
  requestWithoutMobileAuth: vi.fn(),
}));

describe('toItemDescriptionCacheEntry', () => {
  it('maps integer flags to booleans and keeps a null value', () => {
    expect(
      toItemDescriptionCacheEntry({
        fetchedAt: 5,
        isTruncated: 1,
        itemIdText: 'a',
        linkUrl: null,
        pinned: 0,
        preview: 'p',
        value: null,
      })
    ).toEqual({
      fetchedAt: 5,
      isTruncated: true,
      itemIdText: 'a',
      linkUrl: null,
      pinned: false,
      preview: 'p',
      value: null,
    });
  });
});

describe('selectItemDescriptionEvictions', () => {
  it('evicts the oldest unpinned rows beyond the keep count and never a pinned row', () => {
    const rows = [
      { fetchedAt: 1, itemIdText: 'oldest-pinned', pinned: true },
      { fetchedAt: 2, itemIdText: 'old', pinned: false },
      { fetchedAt: 3, itemIdText: 'middle', pinned: false },
      { fetchedAt: 4, itemIdText: 'new', pinned: false },
    ];
    expect(selectItemDescriptionEvictions(rows, 2)).toEqual(['old']);
    expect(selectItemDescriptionEvictions(rows, 0)).toEqual(['new', 'middle', 'old']);
    expect(selectItemDescriptionEvictions(rows, 10)).toEqual([]);
  });
});
