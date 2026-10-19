import { and, desc, eq, inArray } from 'drizzle-orm';

import type { DTOItemDescriptionDetail } from '@podverse/helpers/dto';

import { requestWithoutMobileAuth } from '../../auth/authRequestWithRefresh';
import { getDb, initializeDatabase, schema } from '../db';
import type { ItemDescriptionCacheRow } from '../db/schema';

/** Unpinned rows kept after a write; pinned rows (downloaded items) never count against it. */
export const ITEM_DESCRIPTION_CACHE_KEEP_UNPINNED = 200;

export type ItemDescriptionCacheEntry = {
  itemIdText: string;
  /** Null when the item has no notes. */
  value: string | null;
  preview: string | null;
  isTruncated: boolean;
  linkUrl: string | null;
  pinned: boolean;
  fetchedAt: number;
};

export type ItemDescriptionCacheWrite = {
  itemIdText: string;
  value: string | null;
  preview: string | null;
  isTruncated: boolean;
  linkUrl: string | null;
  /** True pins the row. False or absent keeps whatever pin the row already has. */
  pinned?: boolean;
};

type EvictionCandidate = Pick<ItemDescriptionCacheEntry, 'itemIdText' | 'pinned' | 'fetchedAt'>;

export const toItemDescriptionCacheEntry = (
  row: ItemDescriptionCacheRow
): ItemDescriptionCacheEntry => ({
  fetchedAt: row.fetchedAt,
  isTruncated: row.isTruncated === 1,
  itemIdText: row.itemIdText,
  linkUrl: row.linkUrl,
  pinned: row.pinned === 1,
  preview: row.preview,
  value: row.value,
});

export const itemDescriptionCacheWriteFromDetail = (
  detail: DTOItemDescriptionDetail
): ItemDescriptionCacheWrite => ({
  isTruncated: detail.is_truncated,
  itemIdText: detail.item_id_text,
  linkUrl: detail.link_url,
  preview: detail.preview,
  value: detail.value,
});

/**
 * Ids to delete so at most `keep` unpinned rows remain: the oldest unpinned rows by `fetchedAt`.
 * Pinned rows are never chosen.
 */
export const selectItemDescriptionEvictions = (
  rows: readonly EvictionCandidate[],
  keep: number = ITEM_DESCRIPTION_CACHE_KEEP_UNPINNED
): string[] => {
  const unpinned = rows
    .filter((row) => !row.pinned)
    .sort((a, b) => b.fetchedAt - a.fetchedAt || a.itemIdText.localeCompare(b.itemIdText));
  return unpinned.slice(Math.max(0, keep)).map((row) => row.itemIdText);
};

/**
 * Full show notes per item, so the full player and offline downloads do not depend on a list
 * payload carrying the whole description.
 *
 * Device data, not account data: notes are public and the same for every account on the phone.
 */
export const itemDescriptionCacheRepository = {
  get: async (itemIdText: string): Promise<ItemDescriptionCacheEntry | null> => {
    await initializeDatabase();
    const rows = await getDb()
      .select()
      .from(schema.itemDescriptionCache)
      .where(eq(schema.itemDescriptionCache.itemIdText, itemIdText))
      .limit(1);
    const row = rows[0];
    return row === undefined ? null : toItemDescriptionCacheEntry(row);
  },

  put: async (write: ItemDescriptionCacheWrite): Promise<void> => {
    await initializeDatabase();
    const fetchedAt = Date.now();
    const content = {
      fetchedAt,
      isTruncated: write.isTruncated ? 1 : 0,
      linkUrl: write.linkUrl,
      preview: write.preview,
      value: write.value,
    };
    await getDb()
      .insert(schema.itemDescriptionCache)
      .values({ ...content, itemIdText: write.itemIdText, pinned: write.pinned === true ? 1 : 0 })
      .onConflictDoUpdate({
        set: write.pinned === true ? { ...content, pinned: 1 } : content,
        target: schema.itemDescriptionCache.itemIdText,
      });
    await itemDescriptionCacheRepository.evictUnpinned();
  },

  /** Pin an existing row. False when nothing is cached for the item yet. */
  pin: async (itemIdText: string): Promise<boolean> => {
    const existing = await itemDescriptionCacheRepository.get(itemIdText);
    if (existing === null) {
      return false;
    }
    if (!existing.pinned) {
      await getDb()
        .update(schema.itemDescriptionCache)
        .set({ pinned: 1 })
        .where(eq(schema.itemDescriptionCache.itemIdText, itemIdText));
    }
    return true;
  },

  unpin: async (itemIdText: string): Promise<void> => {
    await initializeDatabase();
    await getDb()
      .update(schema.itemDescriptionCache)
      .set({ pinned: 0 })
      .where(eq(schema.itemDescriptionCache.itemIdText, itemIdText));
  },

  unpinAll: async (): Promise<void> => {
    await initializeDatabase();
    await getDb()
      .update(schema.itemDescriptionCache)
      .set({ pinned: 0 })
      .where(eq(schema.itemDescriptionCache.pinned, 1));
  },

  evictUnpinned: async (keep: number = ITEM_DESCRIPTION_CACHE_KEEP_UNPINNED): Promise<void> => {
    await initializeDatabase();
    const rows = await getDb()
      .select({
        fetchedAt: schema.itemDescriptionCache.fetchedAt,
        itemIdText: schema.itemDescriptionCache.itemIdText,
      })
      .from(schema.itemDescriptionCache)
      .where(eq(schema.itemDescriptionCache.pinned, 0))
      .orderBy(desc(schema.itemDescriptionCache.fetchedAt));
    const evictIds = selectItemDescriptionEvictions(
      rows.map((row) => ({ ...row, pinned: false })),
      keep
    );
    if (evictIds.length === 0) {
      return;
    }
    await getDb()
      .delete(schema.itemDescriptionCache)
      .where(
        and(
          eq(schema.itemDescriptionCache.pinned, 0),
          inArray(schema.itemDescriptionCache.itemIdText, evictIds)
        )
      );
  },

  /** The endpoint is public, so this needs no session and runs from background work too. */
  fetchFromServer: async (itemIdText: string): Promise<DTOItemDescriptionDetail> => {
    return requestWithoutMobileAuth(async (api) =>
      api.reqItemDescriptionGetByIdOrIdText(itemIdText)
    );
  },
};
