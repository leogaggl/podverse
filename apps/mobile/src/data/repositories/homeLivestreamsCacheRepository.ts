import { eq } from 'drizzle-orm';

import type { DTOItem } from '@podverse/helpers/dto';
import { isObjectLike } from '@podverse/helpers/guards';

import {
  getAuthSessionGeneration,
  requestWithMobileAuthRefresh,
} from '../../auth/authRequestWithRefresh';
import { appendUniqueBy, listResponseHasMore } from '../../lib/pagination/pagedList';
import { getDb, initializeDatabase, safeJsonParse, schema } from '../db';
import type { MobileAuthRequestContext } from './types';

/**
 * Subscribed upcoming-livestream pages Home can paint without waiting on the network.
 *
 * The queue writes page 1 of this snapshot; scrolling near the bottom of Home appends later pages.
 * Home only reads it. It is account data: sign-out drops the key so the next account on this
 * phone does not see the previous account's follows.
 */
const HOME_LIVESTREAMS_CACHE_KEY = 'home.livestreams.subscribed';
const HOME_LIVESTREAMS_PAGE = 1;

export type HomeLivestreamsCacheWindow = { hasMore: boolean; pageCount: number };

/** `window: null` means there is no next page until a sync writes one. */
export type HomeLivestreamsCacheSnapshot = {
  items: DTOItem[];
  window: HomeLivestreamsCacheWindow | null;
};

type HomeLivestreamsPageResponse = {
  data: readonly DTOItem[];
  meta: { count: number | null; limit: number; page: number };
};

/**
 * Advanced by every write and by `clear`, so an extend that read an older snapshot, or started
 * before sign-out, does not write.
 */
let homeLivestreamsCacheWriteGeneration = 0;

const emptyHomeLivestreamsSnapshot = (): HomeLivestreamsCacheSnapshot => ({
  items: [],
  window: null,
});

const isHomeLivestreamsCacheWindow = (value: unknown): value is HomeLivestreamsCacheWindow =>
  isObjectLike(value) &&
  typeof value.hasMore === 'boolean' &&
  typeof value.pageCount === 'number' &&
  Number.isInteger(value.pageCount) &&
  value.pageCount >= 1;

/**
 * Read a stored payload. A payload without a usable `window` keeps its items and offers no next
 * page; anything that is not a payload reads as empty.
 */
export const parseHomeLivestreamsCache = (value: unknown): HomeLivestreamsCacheSnapshot => {
  if (!isObjectLike(value) || !Array.isArray(value.items)) {
    return emptyHomeLivestreamsSnapshot();
  }
  const window = isHomeLivestreamsCacheWindow(value.window)
    ? { hasMore: value.window.hasMore, pageCount: value.window.pageCount }
    : null;
  return { items: value.items, window };
};

/**
 * Append the next page to the stored window. An item already stored keeps its first position.
 * Has-more reads the raw page length: stale scheduled rows are dropped on read, not here.
 */
export const appendHomeLivestreamsPage = (
  snapshot: HomeLivestreamsCacheSnapshot & { window: HomeLivestreamsCacheWindow },
  response: HomeLivestreamsPageResponse
): HomeLivestreamsCacheSnapshot => ({
  items: appendUniqueBy(snapshot.items, response.data, (item) => item.id_text),
  window: {
    hasMore: listResponseHasMore(response.meta, response.data.length),
    pageCount: response.meta.page,
  },
});

const writeSnapshot = async (snapshot: HomeLivestreamsCacheSnapshot): Promise<void> => {
  homeLivestreamsCacheWriteGeneration += 1;
  await initializeDatabase();
  const updatedAt = Date.now();
  const value = JSON.stringify(snapshot);
  await getDb()
    .insert(schema.kvMeta)
    .values({ key: HOME_LIVESTREAMS_CACHE_KEY, updatedAt, value })
    .onConflictDoUpdate({
      target: schema.kvMeta.key,
      set: { updatedAt, value },
    });
};

export const homeLivestreamsCacheRepository = {
  /** Stored pages and whether another follows. Empty when nothing has been synced yet. */
  readSnapshot: async (): Promise<HomeLivestreamsCacheSnapshot> => {
    await initializeDatabase();
    const rows = await getDb()
      .select({ value: schema.kvMeta.value })
      .from(schema.kvMeta)
      .where(eq(schema.kvMeta.key, HOME_LIVESTREAMS_CACHE_KEY))
      .limit(1);
    const raw = rows[0]?.value;
    if (raw === undefined || raw === null) {
      return emptyHomeLivestreamsSnapshot();
    }
    return parseHomeLivestreamsCache(safeJsonParse<unknown>(raw));
  },

  /** Cached upcoming livestreams. Empty when nothing has been synced yet or the payload is unusable. */
  listItems: async (): Promise<DTOItem[]> => {
    return (await homeLivestreamsCacheRepository.readSnapshot()).items;
  },

  replaceItems: async (
    items: readonly DTOItem[],
    window: HomeLivestreamsCacheWindow
  ): Promise<void> => {
    await writeSnapshot({ items: [...items], window });
  },

  /** Drop the stored pages. Sign-out calls this before the next account can read them. */
  clear: async (): Promise<void> => {
    homeLivestreamsCacheWriteGeneration += 1;
    await initializeDatabase();
    await getDb().delete(schema.kvMeta).where(eq(schema.kvMeta.key, HOME_LIVESTREAMS_CACHE_KEY));
  },

  /**
   * Pull page 1 of the subscribed upcoming livestreams and store it in place of every stored page.
   * Home rereads after the queue settles.
   *
   * A session that ends while the request is in flight does not write: the page belongs to the
   * account that asked for it.
   */
  refreshFromAccount: async (context: MobileAuthRequestContext): Promise<void> => {
    const generationAtStart = getAuthSessionGeneration();
    const response = await requestWithMobileAuthRefresh(context, async (api) =>
      api.reqLiveItemGetManyUpcoming({
        medium: 'all',
        page: HOME_LIVESTREAMS_PAGE,
        type: 'subscribed',
      })
    );
    if (generationAtStart !== getAuthSessionGeneration()) {
      return;
    }
    await homeLivestreamsCacheRepository.replaceItems(response.data, {
      hasMore: listResponseHasMore(response.meta, response.data.length),
      pageCount: HOME_LIVESTREAMS_PAGE,
    });
  },

  /**
   * Fetch the page after the stored window and append it.
   *
   * `'stale'` means a sync, a sign-out, or another extend rewrote the snapshot while the request
   * was out; nothing is written and the caller rereads storage. Errors propagate.
   */
  extendFromAccount: async (
    context: MobileAuthRequestContext
  ): Promise<'end' | 'extended' | 'stale'> => {
    const sessionGenerationAtStart = getAuthSessionGeneration();
    const writeGenerationAtStart = homeLivestreamsCacheWriteGeneration;
    const snapshot = await homeLivestreamsCacheRepository.readSnapshot();
    const { window } = snapshot;
    if (window === null || !window.hasMore) {
      return 'end';
    }

    const response = await requestWithMobileAuthRefresh(context, async (api) =>
      api.reqLiveItemGetManyUpcoming({
        medium: 'all',
        page: window.pageCount + 1,
        type: 'subscribed',
      })
    );
    if (
      sessionGenerationAtStart !== getAuthSessionGeneration() ||
      writeGenerationAtStart !== homeLivestreamsCacheWriteGeneration
    ) {
      return 'stale';
    }

    await writeSnapshot(appendHomeLivestreamsPage({ items: snapshot.items, window }, response));
    return 'extended';
  },
};
