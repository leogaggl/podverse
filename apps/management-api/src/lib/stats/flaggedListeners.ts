import { AppDbDataSourceRead, AppDbDataSourceReadWrite } from '@management-api/orm/db/appDb.js';
import type { StatsFlaggedListenerListQueryValidated } from '@management-api/schemas/statsFlaggedListeners.js';

import type { PopularityFlagReason } from '@podverse/helpers';
import { isPopularityFlagReason } from '@podverse/helpers';

export type StatsFlaggedListenerRow = {
  id: number;
  listener_id: string;
  reason: PopularityFlagReason;
  /** ISO 8601 */
  flagged_at: string;
  times_flagged: number;
  /** ISO 8601, or null while the flag is active */
  cleared_at: string | null;
  cleared_by_admin_id: number | null;
  /** Stored listen events in the last 7 days, popularity-counted or not. */
  listens_last_7_days: number;
  /** Stored open events in the last 7 days. */
  opens_last_7_days: number;
};

export type ClearFlaggedListenerResult =
  | { kind: 'not_found' }
  | { kind: 'already_cleared' }
  | { kind: 'cleared'; before: StatsFlaggedListenerRow; row: StatsFlaggedListenerRow };

type Queryable = {
  query: (sql: string, parameters?: unknown[]) => Promise<unknown>;
};

/**
 * WHERE and ORDER BY for a validated status. The status string is never copied into SQL.
 */
const LIST_CLAUSE_BY_STATUS = {
  active: {
    whereSql: 'WHERE f.cleared_at IS NULL',
    orderBySql: 'ORDER BY f.flagged_at DESC, f.id DESC',
  },
  cleared: {
    whereSql: 'WHERE f.cleared_at IS NOT NULL',
    orderBySql: 'ORDER BY f.cleared_at DESC, f.id DESC',
  },
  all: {
    whereSql: '',
    orderBySql: 'ORDER BY f.flagged_at DESC, f.id DESC',
  },
} as const satisfies Record<
  StatsFlaggedListenerListQueryValidated['status'],
  { whereSql: string; orderBySql: string }
>;

const FLAG_ROW_SELECT_SQL = `SELECT f.id, f.listener_id::text AS listener_id, f.reason, f.flagged_at, f.times_flagged,
       f.cleared_at, f.cleared_by_admin_id,
       (SELECT count(*)::int FROM stats_listen_event e
         WHERE e.listener_id = f.listener_id AND e.created_at >= now() - interval '7 days')
         AS listens_last_7_days,
       (SELECT count(*)::int FROM stats_open_event o
         WHERE o.listener_id = f.listener_id AND o.created_at >= now() - interval '7 days')
         AS opens_last_7_days
  FROM stats_flagged_listener f`;

const FLAG_ROW_LOCK_SQL = `${FLAG_ROW_SELECT_SQL}
WHERE f.id = $1 FOR UPDATE OF f`;

const FLAG_ROW_BY_ID_SQL = `${FLAG_ROW_SELECT_SQL}
WHERE f.id = $1`;

const CLEAR_FLAG_SQL = `UPDATE stats_flagged_listener
SET cleared_at = now(), cleared_by_admin_id = $2
WHERE id = $1`;

const EXPECTED_ROW = 'Expected a flagged listener row';

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function readPositiveInt(value: unknown): number {
  if (typeof value !== 'number' || !Number.isInteger(value) || value < 1) {
    throw new Error(EXPECTED_ROW);
  }
  return value;
}

function readNonNegativeInt(value: unknown): number {
  if (typeof value !== 'number' || !Number.isInteger(value) || value < 0) {
    throw new Error(EXPECTED_ROW);
  }
  return value;
}

function readTimestamp(value: unknown): string {
  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) {
      throw new Error(EXPECTED_ROW);
    }
    return value.toISOString();
  }
  if (typeof value === 'string' && value.length > 0) {
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) {
      throw new Error(EXPECTED_ROW);
    }
    return parsed.toISOString();
  }
  throw new Error(EXPECTED_ROW);
}

function readOptionalTimestamp(value: unknown): string | null {
  if (value === null) {
    return null;
  }
  return readTimestamp(value);
}

function readOptionalAdminId(value: unknown): number | null {
  if (value === null) {
    return null;
  }
  return readPositiveInt(value);
}

function readListenerId(value: unknown): string {
  if (typeof value !== 'string' || value.length === 0) {
    throw new Error(EXPECTED_ROW);
  }
  return value;
}

function readReason(value: unknown): PopularityFlagReason {
  if (!isPopularityFlagReason(value)) {
    throw new Error(EXPECTED_ROW);
  }
  return value;
}

export function readFlaggedListenerRow(value: unknown): StatsFlaggedListenerRow {
  if (!isRecord(value)) {
    throw new Error(EXPECTED_ROW);
  }
  return {
    id: readPositiveInt(value.id),
    listener_id: readListenerId(value.listener_id),
    reason: readReason(value.reason),
    flagged_at: readTimestamp(value.flagged_at),
    times_flagged: readPositiveInt(value.times_flagged),
    cleared_at: readOptionalTimestamp(value.cleared_at),
    cleared_by_admin_id: readOptionalAdminId(value.cleared_by_admin_id),
    listens_last_7_days: readNonNegativeInt(value.listens_last_7_days),
    opens_last_7_days: readNonNegativeInt(value.opens_last_7_days),
  };
}

function readQueryRows(result: unknown): unknown[] {
  if (!Array.isArray(result)) {
    throw new Error(EXPECTED_ROW);
  }
  return result;
}

async function queryRows(db: Queryable, sql: string, parameters?: unknown[]): Promise<unknown[]> {
  const result: unknown = await db.query(sql, parameters);
  return readQueryRows(result);
}

function readTotal(rows: unknown[]): number {
  const first = rows[0];
  if (
    !isRecord(first) ||
    typeof first.total !== 'number' ||
    !Number.isInteger(first.total) ||
    first.total < 0
  ) {
    throw new Error('Expected a flagged listener total');
  }
  return first.total;
}

function flaggedListenerCountSql(status: StatsFlaggedListenerListQueryValidated['status']): string {
  const { whereSql } = LIST_CLAUSE_BY_STATUS[status];
  if (whereSql.length === 0) {
    return 'SELECT count(*)::int AS total FROM stats_flagged_listener f';
  }
  return `SELECT count(*)::int AS total FROM stats_flagged_listener f ${whereSql}`;
}

function flaggedListenerListSql(status: StatsFlaggedListenerListQueryValidated['status']): string {
  const { whereSql, orderBySql } = LIST_CLAUSE_BY_STATUS[status];
  const whereLine = whereSql.length === 0 ? '' : `\n${whereSql}`;
  return `${FLAG_ROW_SELECT_SQL}${whereLine}
${orderBySql}
LIMIT $1 OFFSET $2`;
}

export async function listFlaggedListeners(
  query: StatsFlaggedListenerListQueryValidated
): Promise<{ rows: StatsFlaggedListenerRow[]; total: number }> {
  const offset = (query.page - 1) * query.limit;
  const countRows = await queryRows(AppDbDataSourceRead, flaggedListenerCountSql(query.status));
  const listRows = await queryRows(AppDbDataSourceRead, flaggedListenerListSql(query.status), [
    query.limit,
    offset,
  ]);
  return {
    rows: listRows.map(readFlaggedListenerRow),
    total: readTotal(countRows),
  };
}

export async function clearFlaggedListener(
  id: number,
  adminId: number
): Promise<ClearFlaggedListenerResult> {
  return AppDbDataSourceReadWrite.transaction(async (manager) => {
    const locked = await queryRows(manager, FLAG_ROW_LOCK_SQL, [id]);
    const current = locked[0];
    if (current === undefined) {
      return { kind: 'not_found' };
    }
    const before = readFlaggedListenerRow(current);
    if (before.cleared_at !== null) {
      return { kind: 'already_cleared' };
    }
    await manager.query(CLEAR_FLAG_SQL, [id, adminId]);
    const updated = await queryRows(manager, FLAG_ROW_BY_ID_SQL, [id]);
    const after = updated[0];
    if (after === undefined) {
      throw new Error(EXPECTED_ROW);
    }
    return { kind: 'cleared', before, row: readFlaggedListenerRow(after) };
  });
}
