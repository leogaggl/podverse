import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  getAuthSessionGeneration,
  requestWithMobileAuthRefresh,
} from '../../auth/authRequestWithRefresh';
import { getDb, safeJsonParse } from '../db';
import type { HomeClipsCacheWindow } from './homeClipsCacheRepository';
import {
  appendHomeClipsPage,
  homeClipsCacheRepository,
  parseHomeClipsCache,
} from './homeClipsCacheRepository';
import type { MobileAuthRequestContext } from './types';

vi.mock('../db', () => ({
  getDb: vi.fn(),
  initializeDatabase: vi.fn(),
  safeJsonParse: vi.fn(),
  schema: { kvMeta: { key: 'kvMeta.key', value: 'kvMeta.value' } },
}));
vi.mock('../../auth/authRequestWithRefresh', () => ({
  getAuthSessionGeneration: vi.fn(),
  requestWithMobileAuthRefresh: vi.fn(),
}));
vi.mock('drizzle-orm', () => ({
  eq: (_column: unknown, value: unknown) => ({ value }),
}));

const CLIPS_CACHE_KEY = 'home.clips.subscribed';

type EqPredicate = { value: unknown };

const kvRows = new Map<string, string>();

const predicateKey = (predicate: EqPredicate): string | null =>
  typeof predicate.value === 'string' ? predicate.value : null;

const fakeDb = {
  delete: () => ({
    where: async (predicate: EqPredicate) => {
      const key = predicateKey(predicate);
      if (key !== null) {
        kvRows.delete(key);
      }
    },
  }),
  insert: () => ({
    values: (row: { key: string; value: string }) => ({
      onConflictDoUpdate: async () => {
        kvRows.set(row.key, row.value);
      },
    }),
  }),
  select: () => ({
    from: () => ({
      where: (predicate: EqPredicate) => ({
        limit: async () => {
          const key = predicateKey(predicate);
          if (key === null) {
            return [];
          }
          const stored = kvRows.get(key);
          return stored === undefined ? [] : [{ value: stored }];
        },
      }),
    }),
  }),
};

const parseStoredJson = (raw: string): unknown => {
  try {
    const parsed: unknown = JSON.parse(raw);
    return parsed;
  } catch {
    return null;
  }
};

const seedClipsSnapshot = (snapshot: {
  items: { id_text: string }[];
  window: HomeClipsCacheWindow | null;
}) => {
  kvRows.set(CLIPS_CACHE_KEY, JSON.stringify(snapshot));
};

const topWeekWindow: HomeClipsCacheWindow = {
  hasMore: true,
  pageCount: 1,
  range: 'week',
  sort: 'top',
};

describe('parseHomeClipsCache', () => {
  it('reads the items and the window of a full payload', () => {
    expect(parseHomeClipsCache({ items: [{ id_text: 'a' }], window: topWeekWindow })).toEqual({
      items: [{ id_text: 'a' }],
      window: topWeekWindow,
    });
  });

  it('keeps the items and offers no next page for a payload with no window or a malformed one', () => {
    expect(parseHomeClipsCache({ items: [{ id_text: 'a' }] })).toEqual({
      items: [{ id_text: 'a' }],
      window: null,
    });
    expect(
      parseHomeClipsCache({
        items: [{ id_text: 'a' }],
        window: { hasMore: true, pageCount: 1, range: 'week', sort: 'alphabetical' },
      })
    ).toEqual({ items: [{ id_text: 'a' }], window: null });
    expect(
      parseHomeClipsCache({
        items: [],
        window: { hasMore: 'yes', pageCount: 0, range: 'forever', sort: 'top' },
      })
    ).toEqual({ items: [], window: null });
  });

  it('reads anything that is not a payload as empty', () => {
    expect(parseHomeClipsCache(null)).toEqual({ items: [], window: null });
    expect(parseHomeClipsCache('items')).toEqual({ items: [], window: null });
    expect(parseHomeClipsCache({ items: 'a' })).toEqual({ items: [], window: null });
  });
});

describe('appendHomeClipsPage', () => {
  it('appends in order, keeps the first position of a repeated clip, and advances the page', () => {
    const next = appendHomeClipsPage(
      { items: [{ id_text: 'a' }, { id_text: 'b' }], window: topWeekWindow },
      {
        data: [{ id_text: 'b' }, { id_text: 'c' }],
        meta: { count: null, limit: 2, page: 2 },
      }
    );

    expect(next.items).toEqual([{ id_text: 'a' }, { id_text: 'b' }, { id_text: 'c' }]);
    expect(next.window).toEqual({ ...topWeekWindow, hasMore: true, pageCount: 2 });
  });

  it('ends the window on a short page and keeps the sort and range that built it', () => {
    const next = appendHomeClipsPage(
      { items: [{ id_text: 'a' }], window: { ...topWeekWindow, range: 'month' } },
      { data: [{ id_text: 'b' }], meta: { count: null, limit: 60, page: 2 } }
    );

    expect(next.window).toEqual({ hasMore: false, pageCount: 2, range: 'month', sort: 'top' });
  });
});

type ClipsPage = {
  data: { id_text: string }[];
  meta: { count: number | null; limit: number; page: number };
};

const deferredPage = () => {
  let resolve: (page: ClipsPage) => void = () => undefined;
  const promise = new Promise<ClipsPage>((settle) => {
    resolve = settle;
  });
  return { promise, resolve };
};

const shortPage = (idText: string): ClipsPage => ({
  data: [{ id_text: idText }],
  meta: { count: null, limit: 60, page: 1 },
});

const authContext: MobileAuthRequestContext = {
  accessToken: 'access',
  clearSession: vi.fn(),
  refreshToken: 'refresh',
  setTokens: vi.fn(),
};

describe('homeClipsCacheRepository.refreshFromAccount', () => {
  let sessionGeneration = 0;

  beforeEach(() => {
    sessionGeneration = 0;
    vi.mocked(getAuthSessionGeneration).mockImplementation(() => sessionGeneration);
    vi.spyOn(homeClipsCacheRepository, 'replacePayload').mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.mocked(requestWithMobileAuthRefresh).mockReset();
    vi.restoreAllMocks();
  });

  it('writes only the newest of two overlapping refreshes when the first finishes last', async () => {
    const first = deferredPage();
    const second = deferredPage();
    vi.mocked(requestWithMobileAuthRefresh)
      .mockReturnValueOnce(first.promise)
      .mockReturnValueOnce(second.promise);

    const firstRefresh = homeClipsCacheRepository.refreshFromAccount(authContext, {
      range: null,
      sort: 'recent',
    });
    const secondRefresh = homeClipsCacheRepository.refreshFromAccount(authContext, {
      range: 'week',
      sort: 'top',
    });

    second.resolve(shortPage('top-week'));
    await expect(secondRefresh).resolves.toBe('replaced');
    first.resolve(shortPage('recent'));
    await expect(firstRefresh).resolves.toBe('stale');

    expect(homeClipsCacheRepository.replacePayload).toHaveBeenCalledTimes(1);
    expect(homeClipsCacheRepository.replacePayload).toHaveBeenCalledWith(
      [{ id_text: 'top-week' }],
      {
        hasMore: false,
        pageCount: 1,
        range: 'week',
        sort: 'top',
      }
    );
  });

  it('does not write when the session ends while the request is out', async () => {
    const page = deferredPage();
    vi.mocked(requestWithMobileAuthRefresh).mockReturnValueOnce(page.promise);

    const refresh = homeClipsCacheRepository.refreshFromAccount(authContext, {
      range: null,
      sort: 'recent',
    });
    sessionGeneration += 1;
    page.resolve(shortPage('recent'));

    await expect(refresh).resolves.toBe('stale');
    expect(homeClipsCacheRepository.replacePayload).not.toHaveBeenCalled();
  });

  it('writes page 1 and its query for a refresh nothing overtook', async () => {
    vi.mocked(requestWithMobileAuthRefresh).mockResolvedValueOnce(shortPage('recent'));

    await expect(
      homeClipsCacheRepository.refreshFromAccount(authContext, { range: null, sort: 'recent' })
    ).resolves.toBe('replaced');
    expect(homeClipsCacheRepository.replacePayload).toHaveBeenCalledWith([{ id_text: 'recent' }], {
      hasMore: false,
      pageCount: 1,
      range: null,
      sort: 'recent',
    });
  });
});

const openWindow: HomeClipsCacheWindow = {
  hasMore: true,
  pageCount: 1,
  range: null,
  sort: 'recent',
};

describe('homeClipsCacheRepository.clear', () => {
  beforeEach(() => {
    kvRows.clear();
    vi.mocked(getAuthSessionGeneration).mockReturnValue(1);
    vi.mocked(safeJsonParse).mockImplementation(parseStoredJson);
    vi.mocked(requestWithMobileAuthRefresh).mockReset();
    // The stand-in implements only the select, insert, and delete chains this repository
    // calls, so it cannot be assigned to the Drizzle database type in one step.
    vi.mocked(getDb).mockReturnValue(fakeDb as unknown as ReturnType<typeof getDb>);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('removes the snapshot', async () => {
    seedClipsSnapshot({ items: [{ id_text: 'clip-1' }], window: null });

    await homeClipsCacheRepository.clear();

    expect(kvRows.has(CLIPS_CACHE_KEY)).toBe(false);
    await expect(homeClipsCacheRepository.readSnapshot()).resolves.toEqual({
      items: [],
      window: null,
    });
  });

  it('drops an extend that already started', async () => {
    seedClipsSnapshot({ items: [{ id_text: 'clip-1' }], window: openWindow });
    const page = deferredPage();
    vi.mocked(requestWithMobileAuthRefresh).mockReturnValueOnce(page.promise);
    const replacePayload = vi.spyOn(homeClipsCacheRepository, 'replacePayload');

    const extend = homeClipsCacheRepository.extendFromAccount(authContext);
    await vi.waitFor(() => {
      expect(requestWithMobileAuthRefresh).toHaveBeenCalledTimes(1);
    });
    await homeClipsCacheRepository.clear();
    page.resolve({
      data: [{ id_text: 'second-page' }],
      meta: { count: null, limit: 60, page: 2 },
    });

    await expect(extend).resolves.toBe('stale');
    expect(kvRows.has(CLIPS_CACHE_KEY)).toBe(false);
    await expect(homeClipsCacheRepository.readSnapshot()).resolves.toEqual({
      items: [],
      window: null,
    });
    expect(replacePayload).not.toHaveBeenCalled();
  });
});
