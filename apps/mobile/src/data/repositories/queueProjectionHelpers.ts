/**
 * Read-only helpers for car-cache projection. Kept separate from `queueRepository` so
 * `carCacheReproject` can import without pulling every mutation path.
 */

import { eq } from 'drizzle-orm';

import type { DTOQueueResource } from '@podverse/helpers/dto';

import { getDb, initializeDatabase, safeJsonParse, schema } from '../db';

const nowPlayingCacheKey = (queueIdText: string): string => `now-playing:${queueIdText}`;
const upcomingCacheKey = (queueIdText: string): string => `upcoming:${queueIdText}`;
const historyCacheKey = (queueIdText: string, page: number): string =>
  `history:${queueIdText}:${page}`;

const readCache = async <T>(cacheKey: string): Promise<T | null> => {
  await initializeDatabase();
  const rows = await getDb()
    .select({ payloadJson: schema.queueCache.payloadJson })
    .from(schema.queueCache)
    .where(eq(schema.queueCache.cacheKey, cacheKey))
    .limit(1);
  const row = rows[0];
  if (row === undefined) {
    return null;
  }
  return safeJsonParse<T>(row.payloadJson);
};

export const readQueueCachesForProjection = async (
  queueIdText: string
): Promise<{ nowPlaying: DTOQueueResource | null; upcoming: DTOQueueResource[] }> => {
  const nowPlaying = await readCache<DTOQueueResource>(nowPlayingCacheKey(queueIdText));
  const upcoming = (await readCache<DTOQueueResource[]>(upcomingCacheKey(queueIdText))) ?? [];
  return { nowPlaying, upcoming };
};

export const readHistoryForProjection = async (
  queueIdText: string,
  limit: number
): Promise<DTOQueueResource[]> => {
  const page = (await readCache<DTOQueueResource[]>(historyCacheKey(queueIdText, 1))) ?? [];
  return page.slice(0, limit);
};
