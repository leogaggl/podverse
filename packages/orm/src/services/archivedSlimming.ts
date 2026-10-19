import { AppDataSourceRead, AppDataSourceReadWrite } from '@orm/db/index.js';
import { FeedLifecycleStateKeyEnum } from '@orm/entities/feed/feedLifecycleStateType.js';
import { ItemFlagStatusStatusEnum } from '@orm/entities/item/itemFlagStatus.js';
import type { EntityManager } from 'typeorm';

import {
  buildArchivedDescriptionValue,
  DESCRIPTION_PREVIEW_MAX_LENGTH,
  getDescriptionPreviewText,
} from '@podverse/helpers';

import { CHANNEL_DETAIL_DELETE_QUERIES } from './archiver.js';

export const ARCHIVED_SLIM_ITEM_BATCH_SIZE = 500;
export const ARCHIVED_SLIM_MAX_ITEMS_PER_RUN = 20_000;
export const ARCHIVED_SLIM_MAX_CHANNELS_PER_RUN = 200;

/** Related item rows removed from an archived episode. Soundbites are handled separately. */
export const ARCHIVED_ITEM_DETAIL_DELETE_TABLES = [
  'item_chapters_feed',
  'item_chat',
  'item_content_link',
  'item_funding',
  'item_license',
  'item_location',
  'item_person',
  'item_season_episode',
  'item_season',
  'item_social_interact',
  'item_transcript',
  'item_txt',
  'item_value',
] as const;

type ArchivedItemDetailTable = (typeof ARCHIVED_ITEM_DETAIL_DELETE_TABLES)[number];

type DescriptionTable = 'item_description' | 'channel_description';
type DescriptionOwnerColumn = 'item_id' | 'channel_id';

type StoredDescription = {
  id: number;
  value: string;
  preview: string | null;
  source_length: number | null;
};

const SELECT_UNSLIMMED_ITEMS_SQL = `
SELECT id
FROM item
WHERE item_flag_status_id = $1
  AND archived_slimmed_at IS NULL
ORDER BY id
LIMIT $2
FOR UPDATE SKIP LOCKED`;

const SELECT_UNSLIMMED_CHANNEL_SQL = `
SELECT c.id
FROM channel c
INNER JOIN feed f ON f.id = c.feed_id
INNER JOIN feed_lifecycle_state fls ON fls.feed_id = f.id
INNER JOIN feed_lifecycle_state_type flst ON flst.id = fls.feed_lifecycle_state_type_id
WHERE flst.state_key = $1
  AND c.archived_slimmed_at IS NULL
ORDER BY c.id
LIMIT 1
FOR UPDATE OF c SKIP LOCKED`;

const DELETE_UNREFERENCED_SOUNDBITES_SQL = `
DELETE FROM item_soundbite
WHERE item_id = ANY($1::int[])
  AND NOT EXISTS (
    SELECT 1 FROM playlist_resource pr
    WHERE pr.item_soundbite_id = item_soundbite.id
  )`;

const ARCHIVED_CHANNEL_SCOPE_SQL = `
INNER JOIN feed f ON f.id = c.feed_id
INNER JOIN feed_lifecycle_state fls ON fls.feed_id = f.id
INNER JOIN feed_lifecycle_state_type flst ON flst.id = fls.feed_lifecycle_state_type_id
WHERE flst.state_key = $1 AND c.archived_slimmed_at IS NULL`;

function readIds(rows: unknown): number[] {
  if (!Array.isArray(rows)) {
    return [];
  }
  const ids: number[] = [];
  for (const row of rows) {
    if (typeof row !== 'object' || row === null || !('id' in row)) {
      continue;
    }
    const id = row.id;
    if (typeof id === 'number' && Number.isInteger(id)) {
      ids.push(id);
      continue;
    }
    if (typeof id === 'string' && /^\d+$/.test(id)) {
      ids.push(Number(id));
    }
  }
  return ids;
}

function readInteger(value: unknown): number | null {
  if (typeof value === 'number' && Number.isInteger(value)) {
    return value;
  }
  if (typeof value === 'string' && /^-?\d+$/.test(value)) {
    return Number(value);
  }
  return null;
}

function readStoredDescription(row: unknown): StoredDescription | null {
  if (typeof row !== 'object' || row === null) {
    return null;
  }
  if (!('id' in row) || !('value' in row) || !('preview' in row) || !('source_length' in row)) {
    return null;
  }
  const id = readInteger(row.id);
  if (id === null || typeof row.value !== 'string') {
    return null;
  }
  if (row.preview !== null && typeof row.preview !== 'string') {
    return null;
  }
  const sourceLength = row.source_length === null ? null : readInteger(row.source_length);
  if (row.source_length !== null && sourceLength === null) {
    return null;
  }
  return {
    id,
    value: row.value,
    preview: row.preview,
    source_length: sourceLength,
  };
}

function readBytes(rows: unknown): number {
  if (!Array.isArray(rows) || rows.length === 0) {
    return 0;
  }
  const row = rows[0];
  if (typeof row !== 'object' || row === null || !('bytes' in row)) {
    return 0;
  }
  const bytes = readInteger(row.bytes);
  return bytes === null ? 0 : bytes;
}

function readCount(rows: unknown): { total: number; slimmed: number; unslimmed: number } {
  const empty = { total: 0, slimmed: 0, unslimmed: 0 };
  if (!Array.isArray(rows) || rows.length === 0) {
    return empty;
  }
  const row = rows[0];
  if (typeof row !== 'object' || row === null) {
    return empty;
  }
  if (!('total' in row) || !('slimmed' in row) || !('unslimmed' in row)) {
    return empty;
  }
  return {
    total: readInteger(row.total) ?? 0,
    slimmed: readInteger(row.slimmed) ?? 0,
    unslimmed: readInteger(row.unslimmed) ?? 0,
  };
}

async function deleteItemDetailRows(manager: EntityManager, ids: number[]): Promise<void> {
  for (const table of ARCHIVED_ITEM_DETAIL_DELETE_TABLES) {
    await deleteItemDetailTable(manager, table, ids);
  }
}

async function deleteItemDetailTable(
  manager: EntityManager,
  table: ArchivedItemDetailTable,
  ids: number[]
): Promise<void> {
  await manager.query(`DELETE FROM ${table} WHERE item_id = ANY($1::int[])`, [ids]);
}

function fitPreviewColumn(text: string): string {
  if (text.length <= DESCRIPTION_PREVIEW_MAX_LENGTH) {
    return text;
  }
  const bounded = text.slice(0, DESCRIPTION_PREVIEW_MAX_LENGTH);
  const lastWhitespace = bounded.search(/\s+\S*$/);
  if (lastWhitespace === -1) {
    return bounded;
  }
  return bounded.slice(0, lastWhitespace);
}

async function reduceDescriptions(
  manager: EntityManager,
  table: DescriptionTable,
  ownerColumn: DescriptionOwnerColumn,
  ownerIds: number[]
): Promise<void> {
  if (ownerIds.length === 0) {
    return;
  }
  const rows: unknown = await manager.query(
    `SELECT id, value, preview, source_length FROM ${table} WHERE ${ownerColumn} = ANY($1::int[])`,
    [ownerIds]
  );
  if (!Array.isArray(rows)) {
    return;
  }
  for (const row of rows) {
    const stored = readStoredDescription(row);
    if (stored === null) {
      continue;
    }
    const previewText = fitPreviewColumn(
      stored.preview ?? getDescriptionPreviewText({ value: stored.value })
    );
    const nextValue = buildArchivedDescriptionValue(previewText);
    if (stored.value === nextValue) {
      continue;
    }
    await manager.query(
      `UPDATE ${table}
       SET value = $2,
           preview = $3,
           is_truncated = true,
           source_length = COALESCE(source_length, char_length(value))
       WHERE id = $1`,
      [stored.id, nextValue, previewText]
    );
  }
}

export async function slimArchivedItems(): Promise<{ slimmed: number }> {
  let slimmed = 0;
  while (slimmed < ARCHIVED_SLIM_MAX_ITEMS_PER_RUN) {
    const remaining = ARCHIVED_SLIM_MAX_ITEMS_PER_RUN - slimmed;
    const limit = Math.min(ARCHIVED_SLIM_ITEM_BATCH_SIZE, remaining);
    const count = await AppDataSourceReadWrite.transaction(async (manager) => {
      const ids = readIds(
        await manager.query(SELECT_UNSLIMMED_ITEMS_SQL, [ItemFlagStatusStatusEnum.Archived, limit])
      );
      if (ids.length === 0) {
        return 0;
      }
      await deleteItemDetailRows(manager, ids);
      await manager.query(DELETE_UNREFERENCED_SOUNDBITES_SQL, [ids]);
      await reduceDescriptions(manager, 'item_description', 'item_id', ids);
      await manager.query(`UPDATE item SET archived_slimmed_at = now() WHERE id = ANY($1::int[])`, [
        ids,
      ]);
      return ids.length;
    });
    slimmed += count;
    if (count < limit) {
      break;
    }
  }
  return { slimmed };
}

export async function slimArchivedChannels(): Promise<{ slimmed: number }> {
  let slimmed = 0;
  while (slimmed < ARCHIVED_SLIM_MAX_CHANNELS_PER_RUN) {
    const didSlim = await AppDataSourceReadWrite.transaction(async (manager) => {
      const ids = readIds(
        await manager.query(SELECT_UNSLIMMED_CHANNEL_SQL, [FeedLifecycleStateKeyEnum.Archived])
      );
      const channelId = ids[0];
      if (channelId === undefined) {
        return false;
      }
      for (const query of CHANNEL_DETAIL_DELETE_QUERIES) {
        await manager.query(query.sql, query.params(channelId));
      }
      await reduceDescriptions(manager, 'channel_description', 'channel_id', [channelId]);
      await manager.query(`UPDATE channel SET archived_slimmed_at = now() WHERE id = $1`, [
        channelId,
      ]);
      return true;
    });
    if (!didSlim) {
      break;
    }
    slimmed += 1;
  }
  return { slimmed };
}

async function sumItemBytes(table: ArchivedItemDetailTable | 'item_description'): Promise<number> {
  const rows: unknown = await AppDataSourceRead.manager.query(
    `SELECT COALESCE(SUM(pg_column_size(t.*)), 0)::bigint AS bytes
     FROM ${table} t
     INNER JOIN item i ON i.id = t.item_id
     WHERE i.item_flag_status_id = $1 AND i.archived_slimmed_at IS NULL`,
    [ItemFlagStatusStatusEnum.Archived]
  );
  return readBytes(rows);
}

async function sumChannelBytes(byteFrom: string): Promise<number> {
  const rows: unknown = await AppDataSourceRead.manager.query(
    `SELECT COALESCE(SUM(pg_column_size(t.*)), 0)::bigint AS bytes
     FROM ${byteFrom}
     ${ARCHIVED_CHANNEL_SCOPE_SQL}`,
    [FeedLifecycleStateKeyEnum.Archived]
  );
  return readBytes(rows);
}

/** Read-only counts and removable-row bytes for archived episodes and shows. */
export async function readArchivedSlimReport(): Promise<string[]> {
  const itemCounts = readCount(
    await AppDataSourceRead.manager.query(
      `SELECT
         count(*)::int AS total,
         count(*) FILTER (WHERE archived_slimmed_at IS NOT NULL)::int AS slimmed,
         count(*) FILTER (WHERE archived_slimmed_at IS NULL)::int AS unslimmed
       FROM item
       WHERE item_flag_status_id = $1`,
      [ItemFlagStatusStatusEnum.Archived]
    )
  );
  const channelCounts = readCount(
    await AppDataSourceRead.manager.query(
      `SELECT
         count(*)::int AS total,
         count(*) FILTER (WHERE c.archived_slimmed_at IS NOT NULL)::int AS slimmed,
         count(*) FILTER (WHERE c.archived_slimmed_at IS NULL)::int AS unslimmed
       FROM channel c
       INNER JOIN feed f ON f.id = c.feed_id
       INNER JOIN feed_lifecycle_state fls ON fls.feed_id = f.id
       INNER JOIN feed_lifecycle_state_type flst ON flst.id = fls.feed_lifecycle_state_type_id
       WHERE flst.state_key = $1`,
      [FeedLifecycleStateKeyEnum.Archived]
    )
  );

  const lines = [
    [
      'Archived episodes:',
      `total=${itemCounts.total}`,
      `slimmed=${itemCounts.slimmed}`,
      `unslimmed=${itemCounts.unslimmed}`,
    ].join(' '),
    [
      'Archived shows:',
      `total=${channelCounts.total}`,
      `slimmed=${channelCounts.slimmed}`,
      `unslimmed=${channelCounts.unslimmed}`,
    ].join(' '),
  ];

  let totalBytes = 0;
  for (const table of ARCHIVED_ITEM_DETAIL_DELETE_TABLES) {
    const bytes = await sumItemBytes(table);
    totalBytes += bytes;
    lines.push(`Unslimmed archived episodes ${table}: ${bytes} bytes`);
  }
  const itemDescriptionBytes = await sumItemBytes('item_description');
  totalBytes += itemDescriptionBytes;
  lines.push(`Unslimmed archived episodes item_description: ${itemDescriptionBytes} bytes`);

  for (const query of CHANNEL_DETAIL_DELETE_QUERIES) {
    const bytes = await sumChannelBytes(query.byteFrom);
    totalBytes += bytes;
    lines.push(`Unslimmed archived shows ${query.table}: ${bytes} bytes`);
  }
  const channelDescriptionBytes = await sumChannelBytes(
    'channel_description t INNER JOIN channel c ON c.id = t.channel_id'
  );
  totalBytes += channelDescriptionBytes;
  lines.push(`Unslimmed archived shows channel_description: ${channelDescriptionBytes} bytes`);

  const megabytes = (totalBytes / (1024 * 1024)).toFixed(2);
  lines.push(`Archived slimming removable total: ${megabytes} MB`);
  return lines;
}
