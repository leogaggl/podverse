import { eq } from 'drizzle-orm';

import type { DTOItem } from '@podverse/helpers/dto';
import { isObjectLike } from '@podverse/helpers/guards';

import {
  getAuthSessionGeneration,
  requestWithMobileAuthRefresh,
} from '../../auth/authRequestWithRefresh';
import { getDb, initializeDatabase, safeJsonParse, schema } from '../db';
import type { MobileAuthRequestContext } from './types';

/**
 * Last subscribed upcoming-livestreams page Home can paint without waiting on the network.
 *
 * The queue writes this snapshot; Home only reads it. It is account data: sign-out drops the key
 * so the next account on this phone does not see the previous account's follows.
 */
const HOME_LIVESTREAMS_CACHE_KEY = 'home.livestreams.subscribed';
const HOME_LIVESTREAMS_PAGE = 1;

type HomeLivestreamsCachePayload = {
  items: DTOItem[];
};

const isHomeLivestreamsCachePayload = (value: unknown): value is HomeLivestreamsCachePayload => {
  return isObjectLike(value) && Array.isArray(value.items);
};

export const homeLivestreamsCacheRepository = {
  /** Cached upcoming livestreams. Empty when nothing has been synced yet or the payload is unusable. */
  listItems: async (): Promise<DTOItem[]> => {
    await initializeDatabase();
    const rows = await getDb()
      .select({ value: schema.kvMeta.value })
      .from(schema.kvMeta)
      .where(eq(schema.kvMeta.key, HOME_LIVESTREAMS_CACHE_KEY))
      .limit(1);
    const raw = rows[0]?.value;
    if (raw === undefined || raw === null) {
      return [];
    }

    const parsed = safeJsonParse<unknown>(raw);
    return isHomeLivestreamsCachePayload(parsed) ? parsed.items : [];
  },

  replaceItems: async (items: readonly DTOItem[]): Promise<void> => {
    await initializeDatabase();
    const updatedAt = Date.now();
    const value = JSON.stringify({ items });
    await getDb()
      .insert(schema.kvMeta)
      .values({ key: HOME_LIVESTREAMS_CACHE_KEY, updatedAt, value })
      .onConflictDoUpdate({
        target: schema.kvMeta.key,
        set: { updatedAt, value },
      });
  },

  /** Drop the subscribed page. Sign-out calls this before the next account can read it. */
  clear: async (): Promise<void> => {
    await initializeDatabase();
    await getDb().delete(schema.kvMeta).where(eq(schema.kvMeta.key, HOME_LIVESTREAMS_CACHE_KEY));
  },

  /**
   * Pull the subscribed upcoming page and store it. Home rereads after the queue settles.
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
    await homeLivestreamsCacheRepository.replaceItems(response.data);
  },
};
