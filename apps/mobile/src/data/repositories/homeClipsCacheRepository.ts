import { eq } from 'drizzle-orm';

import { isObjectLike } from '@podverse/helpers/guards';
import type { QueryParamsStatsRange } from '@podverse/helpers-requests';
import { QUERY_PARAMS_STATS_RANGE_VALUES } from '@podverse/helpers-requests';

import {
  getAuthSessionGeneration,
  requestWithMobileAuthRefresh,
} from '../../auth/authRequestWithRefresh';
import { appendUniqueBy, listResponseHasMore } from '../../lib/pagination/pagedList';
import { getDb, initializeDatabase, safeJsonParse, schema } from '../db';
import type { MobileAuthRequestContext } from './types';

/**
 * Subscribed-clips pages Home can paint without waiting on the network.
 *
 * Clips have no per-channel item table. The queue writes page 1 of this snapshot; scrolling near
 * the bottom of Home appends later pages. Home only reads it. It is account data: sign-out
 * drops the key so the next account on this phone does not see the previous account's clips.
 */
const HOME_CLIPS_CACHE_KEY = 'home.clips.subscribed';
const HOME_CLIPS_PAGE = 1;

/** The query that built the stored pages, so the next page continues the same order. */
export type HomeClipsCacheWindow = {
  hasMore: boolean;
  pageCount: number;
  range: QueryParamsStatsRange | null;
  sort: 'recent' | 'top';
};

/** `window: null` means there is no next page until a sync writes one. */
export type HomeClipsCacheSnapshot = { items: unknown[]; window: HomeClipsCacheWindow | null };

type HomeClipsPageResponse = {
  data: readonly unknown[];
  meta: { count: number | null; limit: number; page: number };
};

const emptyHomeClipsSnapshot = (): HomeClipsCacheSnapshot => ({ items: [], window: null });

/**
 * Advanced by every write and by `clear`, so an extend that read an older snapshot, or started
 * before sign-out, does not write.
 */
let homeClipsCacheWriteGeneration = 0;

/** Advanced by every page-1 refresh as it starts, so only the newest one writes. */
let homeClipsRefreshGeneration = 0;

const isHomeClipsSort = (value: unknown): value is HomeClipsCacheWindow['sort'] =>
  value === 'recent' || value === 'top';

const isStatsRange = (value: unknown): value is QueryParamsStatsRange =>
  QUERY_PARAMS_STATS_RANGE_VALUES.some((range) => range === value);

const isHomeClipsCacheWindow = (value: unknown): value is HomeClipsCacheWindow =>
  isObjectLike(value) &&
  typeof value.hasMore === 'boolean' &&
  typeof value.pageCount === 'number' &&
  Number.isInteger(value.pageCount) &&
  value.pageCount >= 1 &&
  (value.range === null || isStatsRange(value.range)) &&
  isHomeClipsSort(value.sort);

const clipCacheKey = (item: unknown): string =>
  isObjectLike(item) && typeof item.id_text === 'string' ? item.id_text : '';

/**
 * Read a stored payload. A payload without a usable `window` keeps its items and offers no next
 * page; anything that is not a payload reads as empty.
 */
export const parseHomeClipsCache = (value: unknown): HomeClipsCacheSnapshot => {
  if (!isObjectLike(value) || !Array.isArray(value.items)) {
    return emptyHomeClipsSnapshot();
  }
  const window = isHomeClipsCacheWindow(value.window)
    ? {
        hasMore: value.window.hasMore,
        pageCount: value.window.pageCount,
        range: value.window.range,
        sort: value.window.sort,
      }
    : null;
  return { items: value.items, window };
};

/**
 * Append the next page to the stored window. A clip already stored keeps its first position, and
 * the window keeps the sort and range that built it.
 */
export const appendHomeClipsPage = (
  snapshot: HomeClipsCacheSnapshot & { window: HomeClipsCacheWindow },
  response: HomeClipsPageResponse
): HomeClipsCacheSnapshot => ({
  items: appendUniqueBy(snapshot.items, response.data, clipCacheKey),
  window: {
    ...snapshot.window,
    hasMore: listResponseHasMore(response.meta, response.data.length),
    pageCount: response.meta.page,
  },
});

const writeSnapshot = async (snapshot: HomeClipsCacheSnapshot): Promise<void> => {
  homeClipsCacheWriteGeneration += 1;
  await initializeDatabase();
  const updatedAt = Date.now();
  const value = JSON.stringify(snapshot);
  await getDb()
    .insert(schema.kvMeta)
    .values({ key: HOME_CLIPS_CACHE_KEY, value, updatedAt })
    .onConflictDoUpdate({
      target: schema.kvMeta.key,
      set: { updatedAt, value },
    });
};

export const homeClipsCacheRepository = {
  /** Stored clip pages and the query that built them. Empty when nothing has been synced yet. */
  readSnapshot: async (): Promise<HomeClipsCacheSnapshot> => {
    await initializeDatabase();
    const rows = await getDb()
      .select({ value: schema.kvMeta.value })
      .from(schema.kvMeta)
      .where(eq(schema.kvMeta.key, HOME_CLIPS_CACHE_KEY))
      .limit(1);
    const raw = rows[0]?.value;
    if (raw === undefined || raw === null) {
      return emptyHomeClipsSnapshot();
    }
    return parseHomeClipsCache(safeJsonParse<unknown>(raw));
  },

  /** Cached clip list payload. Empty when nothing has been synced yet. */
  listPayload: async (): Promise<unknown[]> => {
    return (await homeClipsCacheRepository.readSnapshot()).items;
  },

  replacePayload: async (
    items: readonly unknown[],
    window: HomeClipsCacheWindow
  ): Promise<void> => {
    await writeSnapshot({ items: [...items], window });
  },

  /**
   * Drop the subscribed clips snapshot. Sign-out calls this before the next account can read it.
   */
  clear: async (): Promise<void> => {
    homeClipsCacheWriteGeneration += 1;
    await initializeDatabase();
    await getDb().delete(schema.kvMeta).where(eq(schema.kvMeta.key, HOME_CLIPS_CACHE_KEY));
  },

  /**
   * Pull page 1 of the subscribed clips and store it in place of every stored page. Home rereads
   * storage afterwards.
   *
   * The `home-clips` sync job and a Home Clips sort or window change both call this. A refresh
   * that finishes after a later one started returns `'stale'` and does not write, so the saved
   * list always matches the newest request; a session that ends while the request is in flight
   * is stale too. The stored window records the query the page was fetched with. `sort` is the
   * directory token the endpoint accepts, and the snapshot is shown in the order it was fetched.
   * Errors propagate.
   */
  refreshFromAccount: async (
    context: MobileAuthRequestContext,
    options: { range: QueryParamsStatsRange | null; sort: 'recent' | 'top' }
  ): Promise<'replaced' | 'stale'> => {
    homeClipsRefreshGeneration += 1;
    const refreshAtStart = homeClipsRefreshGeneration;
    const generationAtStart = getAuthSessionGeneration();
    const response = await requestWithMobileAuthRefresh(context, async (api) =>
      api.reqClipGetManyPublic({
        category: null,
        medium: 'podcasts',
        page: HOME_CLIPS_PAGE,
        range: options.range,
        sort: options.sort,
        type: 'subscribed',
      })
    );
    if (
      generationAtStart !== getAuthSessionGeneration() ||
      refreshAtStart !== homeClipsRefreshGeneration
    ) {
      return 'stale';
    }
    await homeClipsCacheRepository.replacePayload(response.data, {
      hasMore: listResponseHasMore(response.meta, response.data.length),
      pageCount: HOME_CLIPS_PAGE,
      range: options.range,
      sort: options.sort,
    });
    return 'replaced';
  },

  /**
   * Fetch the page after the stored window with the query that built it, and append it.
   *
   * `'stale'` means a sync, a sign-out, or another extend rewrote the snapshot while the request
   * was out; nothing is written and the caller rereads storage. Errors propagate.
   */
  extendFromAccount: async (
    context: MobileAuthRequestContext
  ): Promise<'end' | 'extended' | 'stale'> => {
    const sessionGenerationAtStart = getAuthSessionGeneration();
    const writeGenerationAtStart = homeClipsCacheWriteGeneration;
    const snapshot = await homeClipsCacheRepository.readSnapshot();
    const { window } = snapshot;
    if (window === null || !window.hasMore) {
      return 'end';
    }

    const response = await requestWithMobileAuthRefresh(context, async (api) =>
      api.reqClipGetManyPublic({
        category: null,
        medium: 'podcasts',
        page: window.pageCount + 1,
        range: window.range,
        sort: window.sort,
        type: 'subscribed',
      })
    );
    if (
      sessionGenerationAtStart !== getAuthSessionGeneration() ||
      writeGenerationAtStart !== homeClipsCacheWriteGeneration
    ) {
      return 'stale';
    }

    await writeSnapshot(appendHomeClipsPage({ items: snapshot.items, window }, response));
    return 'extended';
  },
};
