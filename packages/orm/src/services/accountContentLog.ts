import { AppDataSourceReadWrite } from '@orm/db/index.js';
import { loggerService } from '@orm/factories/loggerService.js';

import type {
  AccountContentLogFollowOutcome,
  AccountContentLogReason,
  DTOAccountContentLog,
} from '@podverse/helpers';

/** Raw SQL. Call sites narrow the rows; the signature does not invent a row type. */
type ContentLogQuery = {
  query: (sql: string, parameters?: readonly unknown[]) => Promise<unknown>;
};

export const ACCOUNT_CONTENT_LOG_MAX_ROWS = 100;
export const ACCOUNT_CONTENT_LOG_MAX_NEW_PER_SHOW = 5000;
export const ACCOUNT_CONTENT_LOG_WRITE_CHUNK = 500;

export type AccountContentLogWrite = {
  accountId: number;
  channelIdText: string;
  channelTitle: string | null;
  reason: 'left_directory' | 'taken_down';
  followOutcome: 'ended' | 'moved_to_add_by_rss' | null;
  clipCount: number;
  playlistEntryCount: number;
};

const UPSERT_SQL = `INSERT INTO account_content_log (
  account_id,
  log_type,
  channel_id_text,
  channel_title,
  reason,
  follow_outcome,
  clip_count,
  playlist_entry_count,
  updated_at
)
SELECT
  incoming.account_id,
  'removed_content',
  incoming.channel_id_text,
  incoming.channel_title,
  incoming.reason,
  incoming.follow_outcome,
  incoming.clip_count,
  incoming.playlist_entry_count,
  now()
FROM unnest(
  $1::int[],
  $2::varchar[],
  $3::varchar[],
  $4::varchar[],
  $5::varchar[],
  $6::int[],
  $7::int[]
) AS incoming(
  account_id,
  channel_id_text,
  channel_title,
  reason,
  follow_outcome,
  clip_count,
  playlist_entry_count
)
ON CONFLICT (account_id, log_type, channel_id_text) DO UPDATE SET
  reason = CASE
    WHEN account_content_log.reason = 'taken_down'
      OR EXCLUDED.reason = 'taken_down' THEN 'taken_down'
    ELSE EXCLUDED.reason
  END,
  follow_outcome = CASE
    WHEN account_content_log.follow_outcome = 'moved_to_add_by_rss'
      OR EXCLUDED.follow_outcome = 'moved_to_add_by_rss' THEN 'moved_to_add_by_rss'
    WHEN EXCLUDED.follow_outcome IS NOT NULL THEN EXCLUDED.follow_outcome
    ELSE account_content_log.follow_outcome
  END,
  clip_count = GREATEST(account_content_log.clip_count, EXCLUDED.clip_count),
  playlist_entry_count = GREATEST(
    account_content_log.playlist_entry_count,
    EXCLUDED.playlist_entry_count
  ),
  channel_title = COALESCE(EXCLUDED.channel_title, account_content_log.channel_title),
  updated_at = now()`;

/**
 * One row per account per show. A later write for that pair updates the row:
 * taken_down stays once either write says so, moved_to_add_by_rss stays over ended,
 * a new follow outcome fills a null and does not clear one already stored, counts keep
 * the greater value, and a null title leaves the stored title.
 * created_at stays on the original insert.
 */
export async function upsertAccountContentLogs(
  rows: AccountContentLogWrite[],
  manager?: ContentLogQuery
): Promise<{ written: number; trimmed: number }> {
  if (rows.length === 0) {
    return { written: 0, trimmed: 0 };
  }

  if (manager) {
    return writeAccountContentLogs(rows, manager);
  }

  return AppDataSourceReadWrite.transaction((transactionManager) =>
    writeAccountContentLogs(rows, transactionManager)
  );
}

async function writeAccountContentLogs(
  rows: AccountContentLogWrite[],
  manager: ContentLogQuery
): Promise<{ written: number; trimmed: number }> {
  const ordered = [...rows].sort((left, right) => left.accountId - right.accountId);
  const omitted = Math.max(0, ordered.length - ACCOUNT_CONTENT_LOG_MAX_NEW_PER_SHOW);
  const limited = omitted > 0 ? ordered.slice(0, ACCOUNT_CONTENT_LOG_MAX_NEW_PER_SHOW) : ordered;

  if (omitted > 0) {
    const channelIdText = [
      ...new Set(
        ordered.slice(ACCOUNT_CONTENT_LOG_MAX_NEW_PER_SHOW).map((row) => row.channelIdText)
      ),
    ].join(',');
    loggerService.warn(
      `account_content_log write cut channel_id_text=${channelIdText} omitted=${omitted}`
    );
  }

  let written = 0;

  for (let offset = 0; offset < limited.length; offset += ACCOUNT_CONTENT_LOG_WRITE_CHUNK) {
    const chunk = limited.slice(offset, offset + ACCOUNT_CONTENT_LOG_WRITE_CHUNK);
    await manager.query(UPSERT_SQL, [
      chunk.map((row) => row.accountId),
      chunk.map((row) => row.channelIdText),
      chunk.map((row) => row.channelTitle),
      chunk.map((row) => row.reason),
      chunk.map((row) => row.followOutcome),
      chunk.map((row) => row.clipCount),
      chunk.map((row) => row.playlistEntryCount),
    ]);
    written += chunk.length;
  }

  const accountIds = [...new Set(limited.map((row) => row.accountId))];
  const trimmed = await trimAccountContentLogs(manager, accountIds);
  return { written, trimmed };
}

async function trimAccountContentLogs(
  manager: ContentLogQuery,
  accountIds: number[]
): Promise<number> {
  if (accountIds.length === 0) {
    return 0;
  }

  const result: unknown = await manager.query(
    `DELETE FROM account_content_log AS target
     WHERE target.account_id = ANY($1::int[])
       AND target.id IN (
         SELECT ranked.id
         FROM (
           SELECT id,
                  ROW_NUMBER() OVER (
                    PARTITION BY account_id
                    ORDER BY updated_at DESC, id DESC
                  ) AS rn
           FROM account_content_log
           WHERE account_id = ANY($1::int[])
         ) AS ranked
         WHERE ranked.rn > $2
       )`,
    [accountIds, ACCOUNT_CONTENT_LOG_MAX_ROWS]
  );
  return statementRowCount(result);
}

const LIST_SQL = `SELECT id,
       log_type,
       channel_id_text,
       channel_title,
       reason,
       follow_outcome,
       clip_count,
       playlist_entry_count,
       updated_at
  FROM account_content_log
 WHERE account_id = $1
   AND log_type = $2
 ORDER BY updated_at DESC, id DESC
 LIMIT $3`;

/** One account's rows for one log type, newest first, capped at the account maximum. */
export async function listAccountContentLogs(
  accountId: number,
  logType: 'removed_content'
): Promise<DTOAccountContentLog[]> {
  const result: unknown = await AppDataSourceReadWrite.manager.query(LIST_SQL, [
    accountId,
    logType,
    ACCOUNT_CONTENT_LOG_MAX_ROWS,
  ]);
  if (!Array.isArray(result)) {
    return [];
  }
  return result.map(readContentLogRow);
}

export async function deleteAccountContentLogsUpdatedBefore(cutoff: Date): Promise<number> {
  const result: unknown = await AppDataSourceReadWrite.manager.query(
    `DELETE FROM account_content_log WHERE updated_at < $1`,
    [cutoff]
  );
  return statementRowCount(result);
}

/**
 * Writes one taken_down row per clip owner, playlist owner, and directory follower, then
 * deletes the directory follows. An empty union writes nothing.
 */
export async function recordTakenDownContentLog(
  manager: ContentLogQuery,
  input: {
    channelId: number;
    channelIdText: string;
    channelTitle: string | null;
    itemIds: number[];
  }
): Promise<void> {
  const clips =
    input.itemIds.length === 0
      ? []
      : await countRows(manager, CLIP_COUNT_SQL, [input.itemIds], 'clip_count');
  const playlists =
    input.itemIds.length === 0
      ? []
      : await countRows(manager, PLAYLIST_COUNT_SQL, [input.itemIds], 'playlist_entry_count');
  const followers = await accountIds(
    manager,
    `SELECT account_id FROM account_following_channel WHERE channel_id = $1 ORDER BY account_id`,
    [input.channelId]
  );

  const byAccount = new Map<number, { clips: number; playlists: number; follower: boolean }>();
  const ensure = (accountId: number) => {
    const existing = byAccount.get(accountId);
    if (existing) {
      return existing;
    }
    const created = { clips: 0, playlists: 0, follower: false };
    byAccount.set(accountId, created);
    return created;
  };

  for (const row of clips) {
    ensure(row.accountId).clips = row.count;
  }
  for (const row of playlists) {
    ensure(row.accountId).playlists = row.count;
  }
  for (const accountId of followers) {
    ensure(accountId).follower = true;
  }

  if (byAccount.size > 0 && input.channelIdText !== '') {
    const writes: AccountContentLogWrite[] = [...byAccount.entries()]
      .sort((left, right) => left[0] - right[0])
      .map(([accountId, counts]) => ({
        accountId,
        channelIdText: input.channelIdText,
        channelTitle: input.channelTitle,
        reason: 'taken_down',
        followOutcome: counts.follower ? 'ended' : null,
        clipCount: counts.clips,
        playlistEntryCount: counts.playlists,
      }));
    await upsertAccountContentLogs(writes, manager);
  }

  await manager.query(`DELETE FROM account_following_channel WHERE channel_id = $1`, [
    input.channelId,
  ]);
}

const CLIP_COUNT_SQL = `SELECT clip.account_id AS account_id, COUNT(*)::int AS clip_count
FROM clip
WHERE clip.item_id = ANY($1::int[])
GROUP BY clip.account_id`;

const PLAYLIST_COUNT_SQL = `SELECT playlist.account_id AS account_id,
  COUNT(*)::int AS playlist_entry_count
FROM playlist_resource
INNER JOIN playlist ON playlist.id = playlist_resource.playlist_id
WHERE playlist_resource.item_id = ANY($1::int[])
   OR playlist_resource.item_soundbite_id IN (
     SELECT item_soundbite.id
     FROM item_soundbite
     WHERE item_soundbite.item_id = ANY($1::int[])
   )
GROUP BY playlist.account_id`;

async function countRows(
  manager: ContentLogQuery,
  sql: string,
  params: unknown[],
  countKey: string
): Promise<{ accountId: number; count: number }[]> {
  const result: unknown = await manager.query(sql, params);
  if (!Array.isArray(result)) {
    return [];
  }
  const rows: { accountId: number; count: number }[] = [];
  for (const row of result) {
    if (typeof row !== 'object' || row === null) {
      continue;
    }
    const accountId = finiteInteger(Reflect.get(row, 'account_id'));
    const count = finiteInteger(Reflect.get(row, countKey));
    if (accountId === null || count === null) {
      continue;
    }
    rows.push({ accountId, count });
  }
  return rows;
}

async function accountIds(
  manager: ContentLogQuery,
  sql: string,
  params: unknown[]
): Promise<number[]> {
  const result: unknown = await manager.query(sql, params);
  if (!Array.isArray(result)) {
    return [];
  }
  const ids: number[] = [];
  for (const row of result) {
    if (typeof row !== 'object' || row === null) {
      continue;
    }
    const accountId = finiteInteger(Reflect.get(row, 'account_id'));
    if (accountId !== null) {
      ids.push(accountId);
    }
  }
  return ids;
}

function statementRowCount(result: unknown): number {
  if (Array.isArray(result)) {
    const count = result[1];
    if (typeof count === 'number' && Number.isFinite(count)) {
      return count;
    }
  }
  if (typeof result === 'object' && result !== null) {
    const rowCount = Reflect.get(result, 'rowCount');
    if (typeof rowCount === 'number' && Number.isFinite(rowCount)) {
      return rowCount;
    }
  }
  return 0;
}

function finiteInteger(value: unknown): number | null {
  if (typeof value === 'number' && Number.isInteger(value)) {
    return value;
  }
  if (typeof value === 'string' && /^-?\d+$/.test(value)) {
    const parsed = Number(value);
    if (Number.isSafeInteger(parsed)) {
      return parsed;
    }
  }
  return null;
}

function readContentLogRow(value: unknown): DTOAccountContentLog {
  if (typeof value !== 'object' || value === null) {
    throw new Error('Content log row is not an object');
  }
  const id = contentLogId(Reflect.get(value, 'id'));
  const logType = Reflect.get(value, 'log_type');
  if (logType !== 'removed_content') {
    throw new Error('Content log type is not removed_content');
  }
  const channelIdText = Reflect.get(value, 'channel_id_text');
  if (typeof channelIdText !== 'string' || channelIdText === '') {
    throw new Error('Content log channel_id_text is missing');
  }
  return {
    id,
    log_type: logType,
    channel_id_text: channelIdText,
    channel_title: contentLogTitle(Reflect.get(value, 'channel_title')),
    reason: contentLogReason(Reflect.get(value, 'reason')),
    follow_outcome: contentLogFollowOutcome(Reflect.get(value, 'follow_outcome')),
    clip_count: contentLogCount(Reflect.get(value, 'clip_count')),
    playlist_entry_count: contentLogCount(Reflect.get(value, 'playlist_entry_count')),
    updated_at: contentLogUpdatedAt(Reflect.get(value, 'updated_at')),
  };
}

function contentLogId(value: unknown): string {
  if (typeof value === 'string' && value !== '') {
    return value;
  }
  if (typeof value === 'number' && Number.isSafeInteger(value)) {
    return String(value);
  }
  throw new Error('Content log id is missing');
}

function contentLogTitle(value: unknown): string | null {
  if (value === null) {
    return null;
  }
  if (typeof value === 'string') {
    return value;
  }
  throw new Error('Content log channel_title is not text');
}

function contentLogReason(value: unknown): AccountContentLogReason {
  if (value === 'left_directory' || value === 'taken_down') {
    return value;
  }
  throw new Error('Content log reason is not a known value');
}

function contentLogFollowOutcome(value: unknown): AccountContentLogFollowOutcome | null {
  if (value === null) {
    return null;
  }
  if (value === 'ended' || value === 'moved_to_add_by_rss') {
    return value;
  }
  throw new Error('Content log follow_outcome is not a known value');
}

function contentLogCount(value: unknown): number {
  const count = finiteInteger(value);
  if (count !== null && count >= 0) {
    return count;
  }
  throw new Error('Content log count is not a number');
}

function contentLogUpdatedAt(value: unknown): string {
  if (value instanceof Date) {
    return value.toISOString();
  }
  if (typeof value === 'string') {
    const parsed = new Date(value);
    if (!Number.isNaN(parsed.getTime())) {
      return parsed.toISOString();
    }
  }
  throw new Error('Content log updated_at is not a timestamp');
}
