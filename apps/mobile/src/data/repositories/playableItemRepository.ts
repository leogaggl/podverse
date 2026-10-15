import { and, eq } from 'drizzle-orm';

import type { DTOItem } from '@podverse/helpers/dto';

import { getDb, initializeDatabase, safeJsonParse, schema } from '../db';

export type PlayableItemSource = 'live' | 'download';

/** SQLite binds one parameter per column, so a bulk insert has to arrive in pieces. */
const INSERT_CHUNK_SIZE = 100;

const isStoredItem = (value: unknown): value is DTOItem => {
  return (
    typeof value === 'object' &&
    value !== null &&
    'id_text' in value &&
    typeof value.id_text === 'string' &&
    value.id_text.length > 0
  );
};

const parseItem = (payloadJson: string): DTOItem | null => {
  const parsed = safeJsonParse<unknown>(payloadJson);
  return isStoredItem(parsed) ? parsed : null;
};

/**
 * Whole items the car can start that no other store keeps whole (live items and downloads).
 *
 * Writes are best-effort from their callers: a missing row only means the phone adopts a
 * car-started item from the car's metadata and fills it in once online.
 */
export const playableItemRepository = {
  getByIdText: async (itemIdText: string): Promise<DTOItem | null> => {
    await initializeDatabase();
    const rows = await getDb()
      .select({ payloadJson: schema.playableItem.payloadJson })
      .from(schema.playableItem)
      .where(eq(schema.playableItem.itemIdText, itemIdText))
      .limit(1);
    const row = rows[0];
    return row === undefined ? null : parseItem(row.payloadJson);
  },

  listBySource: async (source: PlayableItemSource): Promise<DTOItem[]> => {
    await initializeDatabase();
    const rows = await getDb()
      .select({ payloadJson: schema.playableItem.payloadJson })
      .from(schema.playableItem)
      .where(eq(schema.playableItem.source, source));
    return rows.flatMap((row) => {
      const item = parseItem(row.payloadJson);
      return item === null ? [] : [item];
    });
  },

  put: async (source: PlayableItemSource, item: DTOItem): Promise<void> => {
    await initializeDatabase();
    const values = {
      itemIdText: item.id_text,
      payloadJson: JSON.stringify(item),
      source,
      updatedAt: Date.now(),
    };
    await getDb()
      .insert(schema.playableItem)
      .values(values)
      .onConflictDoUpdate({
        target: [schema.playableItem.itemIdText, schema.playableItem.source],
        set: { payloadJson: values.payloadJson, updatedAt: values.updatedAt },
      });
  },

  /**
   * Replace every row of one source. Replacement rather than merge is what drops a broadcast that
   * ended: the live refresh answers "these are live", so anything absent is gone.
   */
  replaceSource: async (source: PlayableItemSource, items: readonly DTOItem[]): Promise<void> => {
    await initializeDatabase();
    const updatedAt = Date.now();
    const byIdText = new Map<string, DTOItem>();
    for (const item of items) {
      if (isStoredItem(item)) {
        byIdText.set(item.id_text, item);
      }
    }
    const values = [...byIdText.values()].map((item) => ({
      itemIdText: item.id_text,
      payloadJson: JSON.stringify(item),
      source,
      updatedAt,
    }));
    await getDb().transaction(async (transaction) => {
      await transaction.delete(schema.playableItem).where(eq(schema.playableItem.source, source));
      for (let index = 0; index < values.length; index += INSERT_CHUNK_SIZE) {
        await transaction
          .insert(schema.playableItem)
          .values(values.slice(index, index + INSERT_CHUNK_SIZE));
      }
    });
  },

  remove: async (source: PlayableItemSource, itemIdText: string): Promise<void> => {
    await initializeDatabase();
    await getDb()
      .delete(schema.playableItem)
      .where(
        and(eq(schema.playableItem.source, source), eq(schema.playableItem.itemIdText, itemIdText))
      );
  },

  clearSource: async (source: PlayableItemSource): Promise<void> => {
    await initializeDatabase();
    await getDb().delete(schema.playableItem).where(eq(schema.playableItem.source, source));
  },
};
