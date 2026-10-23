import { AppDataSourceReadWrite } from '@orm/db/index.js';
import type { EntityManager } from 'typeorm';

import { STATS_POPULARITY_RANGE_LOOKBACK_DAYS } from '@podverse/helpers';

import type { StatsEntityType } from './statsEntityTables.js';
import { STATS_ENTITY_TABLES, STATS_ENTITY_TYPES } from './statsEntityTables.js';

/*
 * Range totals (`stats_popularity_*`) are derived from the anonymous daily totals
 * (`stats_daily_*`); nothing else writes their counts. Recent mode refreshes the day, week, and
 * month windows of every entity with a daily row in the month window, and recomputes all-time
 * totals only where they can have changed. Full mode recomputes all four counts for every entity.
 * Contracts and schedules: docs/features/POPULARITY-TRACKING.md.
 */

export type StatsPopularityRefreshMode = 'recent' | 'full';

export type StatsPopularityRefreshTypeResult = {
  entityType: StatsEntityType;
  rowsWritten: number;
  rowsZeroed: number;
};

const UTC_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Days before `today` whose daily rows can still grow. The write path only adds to the current
 * UTC date, and one extra day covers a run that starts just after midnight.
 */
const ALL_TIME_RECHECK_DAYS = 1;

type EntityTables = (typeof STATS_ENTITY_TABLES)[StatsEntityType];

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

/** TypeORM answers INSERT with its row list only, so each upsert selects its own count. */
function rowsWrittenFrom(result: unknown): number {
  if (!Array.isArray(result) || result.length !== 1) {
    throw new Error('stats popularity refresh: unexpected upsert result');
  }
  const row: unknown = result[0];
  const count = typeof row === 'object' && row !== null ? Reflect.get(row, 'rows_written') : null;
  if (typeof count !== 'number' || !Number.isInteger(count)) {
    throw new Error('stats popularity refresh: unexpected upsert result');
  }
  return count;
}

/**
 * `sourceSql` defines CTEs ending in `refreshed (entity_id, day_count, week_count, month_count,
 * all_time_count)`. A row is written only when one of its four counts changes.
 */
function upsertChangedRowsSql(tables: EntityTables, sourceSql: string): string {
  const { key, popularity } = tables;
  return `WITH ${sourceSql},
written AS (
  INSERT INTO ${popularity} AS p (${key}, day_count, week_count, month_count, all_time_count)
  SELECT entity_id, day_count, week_count, month_count, all_time_count FROM refreshed
  ON CONFLICT (${key}) DO UPDATE
     SET day_count = EXCLUDED.day_count,
         week_count = EXCLUDED.week_count,
         month_count = EXCLUDED.month_count,
         all_time_count = EXCLUDED.all_time_count
   WHERE (p.day_count, p.week_count, p.month_count, p.all_time_count)
         IS DISTINCT FROM
         (EXCLUDED.day_count, EXCLUDED.week_count, EXCLUDED.month_count, EXCLUDED.all_time_count)
  RETURNING 1
)
SELECT count(*)::int AS rows_written FROM written`;
}

/**
 * `$1` today, `$2`–`$4` day, week, and month lookbacks, `$5` all-time recheck days. All-time is
 * recomputed for entities listened to on today or yesterday, for new rows, and where the stored
 * value is below the new month total; any other entity's all-time total cannot have changed.
 */
function recentUpsertSql(tables: EntityTables): string {
  const { key, daily, popularity } = tables;
  return upsertChangedRowsSql(
    tables,
    `window_totals AS (
  SELECT d.${key} AS entity_id,
         COALESCE(SUM(d.listener_count) FILTER (WHERE d.day >= $1::date - $2::int), 0)::int
           AS day_count,
         COALESCE(SUM(d.listener_count) FILTER (WHERE d.day >= $1::date - $3::int), 0)::int
           AS week_count,
         SUM(d.listener_count)::int AS month_count,
         bool_or(d.day >= $1::date - $5::int) AS listened_recently
    FROM ${daily} d
   WHERE d.day >= $1::date - $4::int
     AND d.day <= $1::date
   GROUP BY d.${key}
),
targets AS (
  SELECT w.entity_id, w.day_count, w.week_count, w.month_count,
         stored.all_time_count AS stored_all_time_count,
         (w.listened_recently
           OR stored.${key} IS NULL
           OR stored.all_time_count < w.month_count) AS needs_all_time
    FROM window_totals w
    LEFT JOIN ${popularity} stored ON stored.${key} = w.entity_id
),
all_time_totals AS (
  SELECT d.${key} AS entity_id, SUM(d.listener_count)::int AS all_time_count
    FROM ${daily} d
   WHERE d.${key} IN (SELECT t.entity_id FROM targets t WHERE t.needs_all_time)
   GROUP BY d.${key}
),
refreshed AS (
  SELECT t.entity_id, t.day_count, t.week_count, t.month_count,
         COALESCE(a.all_time_count, t.stored_all_time_count) AS all_time_count
    FROM targets t
    LEFT JOIN all_time_totals a ON a.entity_id = t.entity_id
)`
  );
}

/** `$1` today, `$2` month lookback. All-time totals stay. */
function recentZeroSql(tables: EntityTables): string {
  const { key, daily, popularity } = tables;
  return `UPDATE ${popularity} AS p
   SET day_count = 0, week_count = 0, month_count = 0
 WHERE (p.day_count <> 0 OR p.week_count <> 0 OR p.month_count <> 0)
   AND NOT EXISTS (
         SELECT 1
           FROM ${daily} d
          WHERE d.${key} = p.${key}
            AND d.day >= $1::date - $2::int
            AND d.day <= $1::date
       )`;
}

/** `$1` today, `$2`–`$4` day, week, and month lookbacks. */
function fullUpsertSql(tables: EntityTables): string {
  const { key, daily } = tables;
  const windowSum = (lookbackParam: string): string =>
    `COALESCE(SUM(d.listener_count) FILTER (
             WHERE d.day >= $1::date - ${lookbackParam}::int AND d.day <= $1::date
           ), 0)::int`;
  return upsertChangedRowsSql(
    tables,
    `refreshed AS (
  SELECT d.${key} AS entity_id,
         ${windowSum('$2')} AS day_count,
         ${windowSum('$3')} AS week_count,
         ${windowSum('$4')} AS month_count,
         SUM(d.listener_count)::int AS all_time_count
    FROM ${daily} d
   GROUP BY d.${key}
)`
  );
}

function fullZeroSql(tables: EntityTables): string {
  const { key, daily, popularity } = tables;
  return `UPDATE ${popularity} AS p
   SET day_count = 0, week_count = 0, month_count = 0, all_time_count = 0
 WHERE (p.day_count <> 0 OR p.week_count <> 0 OR p.month_count <> 0 OR p.all_time_count <> 0)
   AND NOT EXISTS (SELECT 1 FROM ${daily} d WHERE d.${key} = p.${key})`;
}

/**
 * Serializes refresh runs per entity type until the transaction ends. Any other writer of range
 * totals that must not interleave with a refresh takes this lock, with this exact key.
 */
async function lockPopularityRefresh(
  manager: EntityManager,
  entityType: StatsEntityType
): Promise<void> {
  await manager.query(
    `SELECT pg_advisory_xact_lock(hashtextextended('popularity_refresh:' || $1::text, 0))`,
    [entityType]
  );
}

async function refreshEntityType(
  manager: EntityManager,
  entityType: StatsEntityType,
  today: string,
  mode: StatsPopularityRefreshMode
): Promise<StatsPopularityRefreshTypeResult> {
  const tables = STATS_ENTITY_TABLES[entityType];
  const { day, week, month } = STATS_POPULARITY_RANGE_LOOKBACK_DAYS;

  await lockPopularityRefresh(manager, entityType);

  if (mode === 'full') {
    const rowsWritten = rowsWrittenFrom(
      await manager.query(fullUpsertSql(tables), [today, day, week, month])
    );
    const rowsZeroed = statementRowCount(await manager.query(fullZeroSql(tables), []));
    return { entityType, rowsWritten, rowsZeroed };
  }

  const rowsWritten = rowsWrittenFrom(
    await manager.query(recentUpsertSql(tables), [today, day, week, month, ALL_TIME_RECHECK_DAYS])
  );
  const rowsZeroed = statementRowCount(await manager.query(recentZeroSql(tables), [today, month]));
  return { entityType, rowsWritten, rowsZeroed };
}

/**
 * Rebuilds range totals from daily totals for every entity type; `today` is the UTC date
 * `YYYY-MM-DD` the windows end on. Each type runs in its own transaction under its own lock.
 */
export async function refreshStatsPopularity(input: {
  today: string;
  mode: StatsPopularityRefreshMode;
}): Promise<StatsPopularityRefreshTypeResult[]> {
  const { today, mode } = input;
  if (!UTC_DATE_PATTERN.test(today)) {
    throw new Error(`stats popularity refresh: today must be YYYY-MM-DD, got "${today}"`);
  }

  const results: StatsPopularityRefreshTypeResult[] = [];
  for (const entityType of STATS_ENTITY_TYPES) {
    results.push(
      await AppDataSourceReadWrite.transaction((manager) =>
        refreshEntityType(manager, entityType, today, mode)
      )
    );
  }
  return results;
}
