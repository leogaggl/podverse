/**
 * Read-only helpers over the queue cache for car-cache projection and car-session adoption. Kept
 * separate from `queueRepository` so callers can import without pulling every mutation path.
 */

import { and, eq, like, or } from 'drizzle-orm';

import type {
  DTOItem,
  DTOQueue,
  DTOQueueResource,
  DTOQueueResourceAbridgedResponseData,
} from '@podverse/helpers/dto';
import { MediumEnum } from '@podverse/helpers/medium';

import { getDb, initializeDatabase, safeJsonParse, schema } from '../db';

const CACHE_KEY_QUEUES = 'queues';
const CACHE_KEY_ABRIDGED_INDEX = 'queue-resources-abridged';
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

/**
 * The account's podcast and Music queue ids from the last-synced queue list. Either is null when
 * the device has never synced that queue (signed out, or a fresh install).
 */
export const readCachedQueueIds = async (): Promise<{
  avQueueIdText: string | null;
  musicQueueIdText: string | null;
}> => {
  const queues = (await readCache<DTOQueue[]>(CACHE_KEY_QUEUES)) ?? [];
  const avQueue = queues.find((queue) => queue.medium_id === MediumEnum.AV) ?? null;
  const musicQueue = queues.find((queue) => queue.medium_id === MediumEnum.Music) ?? null;
  return {
    avQueueIdText: avQueue?.id_text ?? null,
    musicQueueIdText: musicQueue?.id_text ?? null,
  };
};

export type ItemPlaybackProgress = {
  positionSeconds: number;
  played: boolean;
};

export type ItemProgressLookup = (item: DTOItem) => ItemPlaybackProgress | null;

const positiveSeconds = (value: number | string | null | undefined): number => {
  const seconds = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(seconds) && seconds > 0 ? seconds : 0;
};

/**
 * Where the account left off in each item, for the car's episode lists: the account's last-synced
 * queue progress, overridden by what this device recorded since (the car's own listening
 * included). Signed out, every item reads as unplayed.
 */
export const readItemProgressForProjection = async (
  accountIdText: string | null
): Promise<ItemProgressLookup> => {
  const byItemId = new Map<number, ItemPlaybackProgress>();
  const byItemIdText = new Map<string, ItemPlaybackProgress>();
  if (accountIdText === null) {
    return () => null;
  }

  const abridged =
    (await readCache<DTOQueueResourceAbridgedResponseData[]>(CACHE_KEY_ABRIDGED_INDEX)) ?? [];
  for (const row of abridged) {
    if (typeof row.t !== 'number') {
      continue;
    }
    byItemId.set(row.t, { played: row.z === true, positionSeconds: positiveSeconds(row.p) });
  }

  const localRows = await getDb()
    .select({
      completed: schema.playbackLocalState.completed,
      playbackPosition: schema.playbackLocalState.playbackPosition,
      resourceIdText: schema.playbackLocalState.resourceIdText,
    })
    .from(schema.playbackLocalState)
    .where(
      and(
        eq(schema.playbackLocalState.accountIdText, accountIdText),
        eq(schema.playbackLocalState.resourceKind, 'item')
      )
    );
  for (const row of localRows) {
    byItemIdText.set(row.resourceIdText, {
      played: row.completed === 1,
      positionSeconds: positiveSeconds(row.playbackPosition),
    });
  }

  return (item) => byItemIdText.get(item.id_text) ?? byItemId.get(item.id) ?? null;
};

const isQueueResource = (value: unknown): value is DTOQueueResource =>
  typeof value === 'object' && value !== null && 'item' in value;

/** Now-playing is stored as one row; upcoming and history pages as arrays of the same shape. */
const resourcesFromPayload = (payload: unknown): DTOQueueResource[] => {
  const rows: unknown[] = Array.isArray(payload) ? payload : [payload];
  return rows.filter(isQueueResource);
};

/**
 * The whole item for `itemIdText` from any stored queue row (now playing, upcoming, or the first
 * history page). Every row the car lists from a queue came from one of these caches.
 */
export const findQueueCachedItem = async (itemIdText: string): Promise<DTOItem | null> => {
  await initializeDatabase();
  const rows = await getDb()
    .select({ payloadJson: schema.queueCache.payloadJson })
    .from(schema.queueCache)
    .where(
      or(
        like(schema.queueCache.cacheKey, 'now-playing:%'),
        like(schema.queueCache.cacheKey, 'upcoming:%'),
        like(schema.queueCache.cacheKey, 'history:%:1')
      )
    );
  for (const row of rows) {
    if (!row.payloadJson.includes(itemIdText)) {
      continue;
    }
    for (const resource of resourcesFromPayload(safeJsonParse<unknown>(row.payloadJson))) {
      const item = resource.item;
      if (item !== null && item !== undefined && item.id_text === itemIdText) {
        return item;
      }
    }
  }
  return null;
};
