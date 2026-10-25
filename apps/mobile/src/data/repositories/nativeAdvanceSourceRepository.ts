import { eq } from 'drizzle-orm';

import type { DTOQueueResource } from '@podverse/helpers/dto';

import type {
  AdoptedQueueCaches,
  NativeAdvanceSourceV1,
} from '../../lib/playback/nativeAdvanceSource';
import {
  findManualQueueResource,
  nativeAdvanceSourceWriteKey,
  parseNativeAdvanceSource,
} from '../../lib/playback/nativeAdvanceSource';
import { getDb, initializeDatabase, schema } from '../db';
import { readCachedQueueIds, readQueueCachesForProjection } from './queueProjectionHelpers';

/**
 * The source the native advance window was built from, kept in `kv_meta` because the process
 * that wrote it is gone once the app closes. It holds auto-queue rows (account playlist content),
 * so `queueRepository.clearAll` deletes it on sign-out.
 */
const NATIVE_ADVANCE_SOURCE_KEY = 'playback.native_advance_source';

/** Write key of the last stored value in this run; null until the first write lands. */
let lastWrittenKey: string | null = null;
/** Advanced by `clear`, so a write that started before it does not land after it. */
let generation = 0;

const deleteRow = async (): Promise<void> => {
  await getDb().delete(schema.kvMeta).where(eq(schema.kvMeta.key, NATIVE_ADVANCE_SOURCE_KEY));
};

export const nativeAdvanceSourceRepository = {
  /** The saved source. Null when none is stored, it does not parse, or the read fails. */
  read: async (): Promise<NativeAdvanceSourceV1 | null> => {
    try {
      await initializeDatabase();
      const rows = await getDb()
        .select({ value: schema.kvMeta.value })
        .from(schema.kvMeta)
        .where(eq(schema.kvMeta.key, NATIVE_ADVANCE_SOURCE_KEY))
        .limit(1);
      return parseNativeAdvanceSource(rows[0]?.value ?? null);
    } catch {
      return null;
    }
  },

  /** Store the source, or delete it for null. Skips a source equal to the last one written. */
  write: async (source: NativeAdvanceSourceV1 | null): Promise<void> => {
    const key = nativeAdvanceSourceWriteKey(source);
    if (key === lastWrittenKey) {
      return;
    }
    const startedGeneration = generation;
    await initializeDatabase();
    if (startedGeneration !== generation) {
      return;
    }
    if (source === null) {
      await deleteRow();
    } else {
      const value = JSON.stringify(source);
      const updatedAt = source.updatedAtMs;
      await getDb()
        .insert(schema.kvMeta)
        .values({ key: NATIVE_ADVANCE_SOURCE_KEY, updatedAt, value })
        .onConflictDoUpdate({
          target: schema.kvMeta.key,
          set: { updatedAt, value },
        });
    }
    if (startedGeneration === generation) {
      lastWrittenKey = key;
    }
  },

  clear: async (): Promise<void> => {
    generation += 1;
    await initializeDatabase();
    await deleteRow();
    lastWrittenKey = '';
  },

  /**
   * The account queue row (podcast queue, then Music queue; now playing, then upcoming) the
   * engine identity names, from the device's last-synced copy. Null signed out, after the queue
   * cache was cleared, or when a read fails. Both queues are read because a manual-queue load in
   * the app keeps the auto-queue buffer whatever the medium.
   */
  readManualQueueResource: async (identity: {
    kind: string;
    idText: string;
  }): Promise<DTOQueueResource | null> => {
    try {
      const { avQueueIdText, musicQueueIdText } = await readCachedQueueIds();
      const queues: AdoptedQueueCaches[] = [];
      for (const queueIdText of [avQueueIdText, musicQueueIdText]) {
        if (queueIdText !== null) {
          queues.push(await readQueueCachesForProjection(queueIdText));
        }
      }
      return findManualQueueResource(queues, identity);
    } catch {
      return null;
    }
  },
};
