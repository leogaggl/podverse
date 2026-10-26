import { describe, expect, it, vi } from 'vitest';

import type { DTOItem } from '@podverse/helpers/dto';

import {
  appendHomeLivestreamsPage,
  parseHomeLivestreamsCache,
} from './homeLivestreamsCacheRepository';

vi.mock('../db', () => ({
  getDb: vi.fn(),
  initializeDatabase: vi.fn(),
  safeJsonParse: vi.fn(),
  schema: {},
}));
vi.mock('../../auth/authRequestWithRefresh', () => ({
  getAuthSessionGeneration: vi.fn(),
  requestWithMobileAuthRefresh: vi.fn(),
}));

// Only `id_text` matters to the cache; the rest of the DTO is not read here.
const liveItem = (idText: string, title = idText): DTOItem =>
  ({ id_text: idText, title }) as DTOItem;

describe('parseHomeLivestreamsCache', () => {
  it('reads the items and the window of a full payload', () => {
    expect(
      parseHomeLivestreamsCache({
        items: [liveItem('a')],
        window: { hasMore: true, pageCount: 2 },
      })
    ).toEqual({ items: [liveItem('a')], window: { hasMore: true, pageCount: 2 } });
  });

  it('keeps the items and offers no next page for a payload with no window or a malformed one', () => {
    expect(parseHomeLivestreamsCache({ items: [liveItem('a')] })).toEqual({
      items: [liveItem('a')],
      window: null,
    });
    expect(
      parseHomeLivestreamsCache({ items: [liveItem('a')], window: { hasMore: 1, pageCount: 1 } })
    ).toEqual({ items: [liveItem('a')], window: null });
    expect(
      parseHomeLivestreamsCache({ items: [], window: { hasMore: true, pageCount: 0 } })
    ).toEqual({ items: [], window: null });
  });

  it('reads anything that is not a payload as empty', () => {
    expect(parseHomeLivestreamsCache(undefined)).toEqual({ items: [], window: null });
    expect(parseHomeLivestreamsCache(7)).toEqual({ items: [], window: null });
    expect(parseHomeLivestreamsCache({ items: null })).toEqual({ items: [], window: null });
  });
});

describe('appendHomeLivestreamsPage', () => {
  it('appends in order, keeps the first position of a repeated item, and advances the page', () => {
    const next = appendHomeLivestreamsPage(
      { items: [liveItem('a'), liveItem('b')], window: { hasMore: true, pageCount: 1 } },
      {
        data: [liveItem('b', 'b updated'), liveItem('c')],
        meta: { count: null, limit: 2, page: 2 },
      }
    );

    expect(next.items.map((item) => item.id_text)).toEqual(['a', 'b', 'c']);
    expect(next.window).toEqual({ hasMore: true, pageCount: 2 });
  });

  it('reads has-more from the raw page length', () => {
    const fullPage = Array.from({ length: 60 }, (_, index) => liveItem(`full-${index}`));
    const shortPage = fullPage.slice(0, 59);

    expect(
      appendHomeLivestreamsPage(
        { items: [], window: { hasMore: true, pageCount: 1 } },
        { data: fullPage, meta: { count: null, limit: 60, page: 2 } }
      ).window
    ).toEqual({ hasMore: true, pageCount: 2 });
    expect(
      appendHomeLivestreamsPage(
        { items: [], window: { hasMore: true, pageCount: 1 } },
        { data: shortPage, meta: { count: null, limit: 60, page: 2 } }
      ).window
    ).toEqual({ hasMore: false, pageCount: 2 });
  });
});
