import { AppDataSourceReadWrite } from '@orm/db/index.js';

import { STATS_POPULARITY_RANGE_LOOKBACK_DAYS } from '@podverse/helpers';

import type { StatsEntityType } from './statsEntityTables.js';
import { STATS_ENTITY_TABLES } from './statsEntityTables.js';

export type { StatsEntityType };

export type StatsDailyDevSeedRow = {
  id: number;
  day: string;
  listenerCount: number;
  completionCount: number;
};

const BATCH_SIZE = 1000;

type PreparedRow = {
  id: number;
  day: string;
  listenerCount: number;
  completionCount: number;
};

function rowsToSend(rows: StatsDailyDevSeedRow[]): PreparedRow[] {
  const prepared: PreparedRow[] = [];
  for (const row of rows) {
    if (!Number.isFinite(row.listenerCount) || row.listenerCount <= 0) {
      continue;
    }
    const listenerCount = Math.round(row.listenerCount);
    if (listenerCount <= 0) {
      continue;
    }
    const rawCompletion = Number.isFinite(row.completionCount)
      ? Math.round(row.completionCount)
      : 0;
    prepared.push({
      id: row.id,
      day: row.day,
      listenerCount,
      completionCount: Math.min(listenerCount, Math.max(0, rawCompletion)),
    });
  }
  return prepared;
}

function upsertSql(daily: string, key: string, hasCompletions: boolean): string {
  if (hasCompletions) {
    return (
      `INSERT INTO ${daily} (${key}, day, listener_count, completion_count, ` +
      'all_time_listener_count) ' +
      'SELECT * FROM unnest($1::int[], $2::date[], $3::int[], $4::int[], $5::int[]) ' +
      `ON CONFLICT (${key}, day) DO UPDATE SET ` +
      'listener_count = EXCLUDED.listener_count, completion_count = EXCLUDED.completion_count, ' +
      'all_time_listener_count = EXCLUDED.all_time_listener_count'
    );
  }
  return (
    `INSERT INTO ${daily} (${key}, day, listener_count, all_time_listener_count) ` +
    'SELECT * FROM unnest($1::int[], $2::date[], $3::int[], $4::int[]) ' +
    `ON CONFLICT (${key}, day) DO UPDATE SET listener_count = EXCLUDED.listener_count, ` +
    'all_time_listener_count = EXCLUDED.all_time_listener_count'
  );
}

/**
 * Dev seeding only. Writes daily totals directly, replacing any value already stored for that
 * entity and day. Bypasses the listen write path. Only `devStatsSeedSimulatedPopularity` calls this.
 */
export async function devUpsertStatsDailyRows(
  entityType: StatsEntityType,
  rows: StatsDailyDevSeedRow[]
): Promise<number> {
  const tables = STATS_ENTITY_TABLES[entityType];
  const pending = rowsToSend(rows);
  if (pending.length === 0) {
    return 0;
  }

  const sql = upsertSql(tables.daily, tables.key, tables.hasCompletions);
  for (let offset = 0; offset < pending.length; offset += BATCH_SIZE) {
    const batch = pending.slice(offset, offset + BATCH_SIZE);
    const ids = batch.map((row) => row.id);
    const days = batch.map((row) => row.day);
    const listenerCounts = batch.map((row) => row.listenerCount);
    if (tables.hasCompletions) {
      const completionCounts = batch.map((row) => row.completionCount);
      await AppDataSourceReadWrite.manager.query(sql, [
        ids,
        days,
        listenerCounts,
        completionCounts,
        listenerCounts,
      ]);
    } else {
      await AppDataSourceReadWrite.manager.query(sql, [ids, days, listenerCounts, listenerCounts]);
    }
  }
  return pending.length;
}

function updatedRowCount(result: unknown): number {
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

/**
 * Dev seeding only. Sets the day, week, and month counts of existing range rows to sums of the
 * seeded daily rows, since dev seeding writes no events. A later refresh replaces them with event
 * counts. Only `devStatsSeedSimulatedPopularity` calls this.
 */
export async function devWriteStatsPopularityWindowsFromDailyRows(
  entityType: StatsEntityType,
  today: string
): Promise<number> {
  const { key, daily, popularity } = STATS_ENTITY_TABLES[entityType];
  const { day, week, month } = STATS_POPULARITY_RANGE_LOOKBACK_DAYS;
  const result: unknown = await AppDataSourceReadWrite.manager.query(
    `UPDATE ${popularity} AS p
        SET day_count = w.day_count, week_count = w.week_count, month_count = w.month_count
       FROM (
         SELECT d.${key} AS entity_id,
                (COALESCE(SUM(d.listener_count) FILTER (WHERE d.day >= $1::date - $2::int), 0))::int
                  AS day_count,
                (COALESCE(SUM(d.listener_count) FILTER (WHERE d.day >= $1::date - $3::int), 0))::int
                  AS week_count,
                SUM(d.listener_count)::int AS month_count
           FROM ${daily} d
          WHERE d.day >= $1::date - $4::int AND d.day <= $1::date
          GROUP BY d.${key}
       ) w
      WHERE p.${key} = w.entity_id`,
    [today, day, week, month]
  );
  return updatedRowCount(result);
}
