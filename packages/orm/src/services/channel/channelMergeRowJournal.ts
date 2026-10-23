import { ChannelMergeJournalAction } from '@orm/entities/channel/channelMergeJournal.js';
import { ChannelMergeJournal } from '@orm/entities/channel/channelMergeJournal.js';
import type { EntityManager } from 'typeorm';

/**
 * Journal of row images for one merge. Revert walks these entries backward:
 * an update writes `before_json` back, an insert deletes the inserted row,
 * and a delete inserts `before_json` again. Every image comes from `row_to_json`, so a `date`
 * column stays `YYYY-MM-DD` text and matches its row again whatever the process time zone.
 */

const JOURNAL_TABLES = new Set([
  'account_device_auto_download_channel',
  'account_following_channel',
  'account_notification_channel',
  'account_notification_channel_type',
  'account_pending_following_channel',
  'channel',
  'channel_verified_publisher',
  'clip',
  'feed',
  'item',
  'playlist_resource',
  'queue_resource',
  'stats_daily_channel',
  'stats_daily_item',
  'stats_popularity_channel',
  'stats_popularity_item',
]);

const PRIMARY_KEYS: Record<string, readonly string[]> = {
  account_device_auto_download_channel: ['id'],
  account_following_channel: ['account_id', 'channel_id'],
  account_notification_channel: ['id'],
  account_notification_channel_type: ['id'],
  account_pending_following_channel: ['id'],
  channel: ['id'],
  channel_verified_publisher: ['id'],
  clip: ['id'],
  feed: ['id'],
  item: ['id'],
  playlist_resource: ['id'],
  queue_resource: ['id'],
  stats_daily_channel: ['channel_id', 'day'],
  stats_daily_item: ['item_id', 'day'],
  stats_popularity_channel: ['channel_id'],
  stats_popularity_item: ['item_id'],
};

/**
 * Tables whose deleted rows a revert writes over a row recreated since the merge: a later listen
 * can recreate an old daily row, and the range-totals refresh can recreate an old range row. The
 * restored row equals the pre-merge image.
 */
const RESTORE_OVER_EXISTING_TABLES: ReadonlySet<string> = new Set([
  'stats_daily_channel',
  'stats_daily_item',
  'stats_popularity_channel',
  'stats_popularity_item',
]);

const COLUMN_NAME = /^[a-z][a-z0-9_]*$/;

export type SqlKey = string | number;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function quoteTable(table: string): string {
  if (!JOURNAL_TABLES.has(table)) {
    throw new Error(`channel merge journal: unknown table ${table}`);
  }
  return `"${table}"`;
}

function quoteColumn(column: string): string {
  if (!COLUMN_NAME.test(column)) {
    throw new Error(`channel merge journal: unknown column ${column}`);
  }
  return `"${column}"`;
}

function copyRow(value: unknown): Record<string, unknown> | null {
  let record = value;
  if (typeof record === 'string') {
    try {
      const parsed: unknown = JSON.parse(record);
      record = parsed;
    } catch {
      return null;
    }
  }
  if (!isRecord(record)) {
    return null;
  }
  const copy: Record<string, unknown> = {};
  for (const [key, entry] of Object.entries(record)) {
    copy[key] = entry instanceof Date ? entry.toISOString() : entry;
  }
  return copy;
}

function pkColumns(table: string): readonly string[] {
  const columns = PRIMARY_KEYS[table];
  if (columns === undefined) {
    throw new Error(`channel merge journal: no primary key for ${table}`);
  }
  return columns;
}

function pkWhere(table: string, row: Record<string, unknown>): Record<string, SqlKey> {
  const where: Record<string, SqlKey> = {};
  for (const column of pkColumns(table)) {
    const value = row[column];
    if (typeof value !== 'string' && typeof value !== 'number') {
      throw new Error(`channel merge journal: missing primary key ${table}.${column}`);
    }
    where[column] = value;
  }
  return where;
}

function whereSql(where: Record<string, SqlKey>, offset = 0): { sql: string; params: SqlKey[] } {
  const columns = Object.keys(where);
  const params = columns.map((column) => {
    const value = where[column];
    if (value === undefined) {
      throw new Error(`channel merge journal: missing value for ${column}`);
    }
    return value;
  });
  const sql = columns
    .map((column, index) => `${quoteColumn(column)} = $${offset + index + 1}`)
    .join(' AND ');
  return { sql, params };
}

async function queryRows(
  manager: EntityManager,
  sql: string,
  params: readonly unknown[]
): Promise<unknown[]> {
  const result: unknown = await manager.query(sql, [...params]);
  return Array.isArray(result) ? result : [];
}

export async function selectMergeRows(
  manager: EntityManager,
  table: string,
  where: Record<string, SqlKey>
): Promise<Record<string, unknown>[]> {
  const filter = whereSql(where);
  const rows = await queryRows(
    manager,
    `SELECT row_to_json(t) AS row FROM ${quoteTable(table)} t WHERE ${filter.sql}`,
    filter.params
  );
  const parsed: Record<string, unknown>[] = [];
  for (const entry of rows) {
    if (!isRecord(entry)) {
      continue;
    }
    const row = copyRow(entry.row);
    if (row !== null) {
      parsed.push(row);
    }
  }
  return parsed;
}

async function writeJournal(
  manager: EntityManager,
  channelMergeId: number,
  table: string,
  action: ChannelMergeJournalAction,
  before: Record<string, unknown> | null,
  after: Record<string, unknown> | null
): Promise<void> {
  const image = after ?? before;
  if (image === null) {
    throw new Error(`channel merge journal: ${action} on ${table} has no row image`);
  }
  const where = pkWhere(table, image);
  const rowPk = pkColumns(table)
    .map((column) => String(where[column]))
    .join(':');
  const created = manager.getRepository(ChannelMergeJournal).create({
    channel_merge_id: channelMergeId,
    table_name: table,
    row_pk: rowPk,
    action,
    before_json: before,
    after_json: after,
  });
  await manager.getRepository(ChannelMergeJournal).save(created);
}

export async function journaledUpdate(
  manager: EntityManager,
  channelMergeId: number,
  table: string,
  where: Record<string, SqlKey>,
  set: Record<string, unknown>
): Promise<void> {
  const existing = await selectMergeRows(manager, table, where);
  const before = existing[0];
  if (before === undefined) {
    return;
  }
  const columns = Object.keys(set);
  if (columns.length === 0) {
    return;
  }
  const filter = whereSql(where, columns.length);
  const assignments = columns
    .map((column, index) => `${quoteColumn(column)} = $${index + 1}`)
    .join(', ');
  await manager.query(`UPDATE ${quoteTable(table)} SET ${assignments} WHERE ${filter.sql}`, [
    ...columns.map((column) => set[column] ?? null),
    ...filter.params,
  ]);
  const afterRows = await selectMergeRows(manager, table, where);
  const after = afterRows[0];
  if (after === undefined) {
    throw new Error(`channel merge journal: ${table} row missing after update`);
  }
  await writeJournal(
    manager,
    channelMergeId,
    table,
    ChannelMergeJournalAction.Update,
    before,
    after
  );
}

export async function journaledInsert(
  manager: EntityManager,
  channelMergeId: number,
  table: string,
  values: Record<string, unknown>
): Promise<Record<string, unknown>> {
  const columns = Object.keys(values);
  const assignments = columns.map((column) => quoteColumn(column)).join(', ');
  const params = columns.map((_, index) => `$${index + 1}`).join(', ');
  const inserted = await queryRows(
    manager,
    `INSERT INTO ${quoteTable(table)} AS t (${assignments}) VALUES (${params}) RETURNING row_to_json(t) AS row`,
    columns.map((column) => values[column] ?? null)
  );
  const first = inserted[0];
  const after = isRecord(first) ? copyRow(first.row) : null;
  if (after === null) {
    throw new Error(`channel merge journal: insert into ${table} returned no row`);
  }
  await writeJournal(manager, channelMergeId, table, ChannelMergeJournalAction.Insert, null, after);
  return after;
}

export async function journaledDelete(
  manager: EntityManager,
  channelMergeId: number,
  table: string,
  where: Record<string, SqlKey>
): Promise<void> {
  const existing = await selectMergeRows(manager, table, where);
  const before = existing[0];
  if (before === undefined) {
    return;
  }
  const filter = whereSql(where);
  await manager.query(`DELETE FROM ${quoteTable(table)} WHERE ${filter.sql}`, filter.params);
  await writeJournal(
    manager,
    channelMergeId,
    table,
    ChannelMergeJournalAction.Delete,
    before,
    null
  );
}

async function updateFromImage(
  manager: EntityManager,
  table: string,
  image: Record<string, unknown>
): Promise<void> {
  const where = pkWhere(table, image);
  const columns = Object.keys(image).filter((column) => where[column] === undefined);
  if (columns.length === 0) {
    return;
  }
  const filter = whereSql(where, columns.length);
  const assignments = columns
    .map((column, index) => `${quoteColumn(column)} = $${index + 1}`)
    .join(', ');
  await manager.query(`UPDATE ${quoteTable(table)} SET ${assignments} WHERE ${filter.sql}`, [
    ...columns.map((column) => image[column] ?? null),
    ...filter.params,
  ]);
}

async function insertFromImage(
  manager: EntityManager,
  table: string,
  image: Record<string, unknown>
): Promise<void> {
  const columns = Object.keys(image);
  const assignments = columns.map((column) => quoteColumn(column)).join(', ');
  const params = columns.map((_, index) => `$${index + 1}`).join(', ');
  await manager.query(
    `INSERT INTO ${quoteTable(table)} (${assignments}) VALUES (${params})${restoreConflictSql(table, columns)}`,
    columns.map((column) => image[column] ?? null)
  );
}

function restoreConflictSql(table: string, columns: readonly string[]): string {
  if (!RESTORE_OVER_EXISTING_TABLES.has(table)) {
    return '';
  }
  const keys = pkColumns(table);
  const conflict = keys.map((column) => quoteColumn(column)).join(', ');
  const updates = columns
    .filter((column) => !keys.includes(column))
    .map((column) => `${quoteColumn(column)} = EXCLUDED.${quoteColumn(column)}`);
  if (updates.length === 0) {
    return ` ON CONFLICT (${conflict}) DO NOTHING`;
  }
  return ` ON CONFLICT (${conflict}) DO UPDATE SET ${updates.join(', ')}`;
}

async function deleteFromImage(
  manager: EntityManager,
  table: string,
  image: Record<string, unknown>
): Promise<void> {
  const filter = whereSql(pkWhere(table, image));
  await manager.query(`DELETE FROM ${quoteTable(table)} WHERE ${filter.sql}`, filter.params);
}

export async function revertChannelMergeJournal(
  manager: EntityManager,
  channelMergeId: number
): Promise<void> {
  const entries = await manager.getRepository(ChannelMergeJournal).find({
    where: { channel_merge_id: channelMergeId },
    order: { id: 'DESC' },
  });
  for (const entry of entries) {
    if (!JOURNAL_TABLES.has(entry.table_name)) {
      throw new Error(`channel merge journal: unknown table ${entry.table_name}`);
    }
    if (entry.action === ChannelMergeJournalAction.Update) {
      if (entry.before_json === null) {
        throw new Error(`channel merge journal: update ${entry.id} has no before image`);
      }
      await updateFromImage(manager, entry.table_name, entry.before_json);
    } else if (entry.action === ChannelMergeJournalAction.Insert) {
      if (entry.after_json === null) {
        throw new Error(`channel merge journal: insert ${entry.id} has no after image`);
      }
      await deleteFromImage(manager, entry.table_name, entry.after_json);
    } else if (entry.action === ChannelMergeJournalAction.Delete) {
      if (entry.before_json === null) {
        throw new Error(`channel merge journal: delete ${entry.id} has no before image`);
      }
      await insertFromImage(manager, entry.table_name, entry.before_json);
    }
  }
}
