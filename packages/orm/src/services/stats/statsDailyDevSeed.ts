import { AppDataSourceReadWrite } from '@orm/db/index.js';

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
      `INSERT INTO ${daily} (${key}, day, listener_count, completion_count) ` +
      'SELECT * FROM unnest($1::int[], $2::date[], $3::int[], $4::int[]) ' +
      `ON CONFLICT (${key}, day) DO UPDATE SET ` +
      'listener_count = EXCLUDED.listener_count, completion_count = EXCLUDED.completion_count'
    );
  }
  return (
    `INSERT INTO ${daily} (${key}, day, listener_count) ` +
    'SELECT * FROM unnest($1::int[], $2::date[], $3::int[]) ' +
    `ON CONFLICT (${key}, day) DO UPDATE SET listener_count = EXCLUDED.listener_count`
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
      ]);
    } else {
      await AppDataSourceReadWrite.manager.query(sql, [ids, days, listenerCounts]);
    }
  }
  return pending.length;
}
