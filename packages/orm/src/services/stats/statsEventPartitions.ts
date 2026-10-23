import { AppDataSourceReadWrite } from '@orm/db/index.js';

export const STATS_EVENT_PARENT_TABLES = ['stats_listen_event', 'stats_open_event'] as const;
export type StatsEventParentTable = (typeof STATS_EVENT_PARENT_TABLES)[number];

const UNEXPECTED_RESULT_MESSAGE = 'stats event partitions: unexpected function result';

function firstRowValue(result: unknown, column: string): unknown {
  if (!Array.isArray(result) || result.length !== 1) {
    throw new Error(UNEXPECTED_RESULT_MESSAGE);
  }
  const row: unknown = result[0];
  if (typeof row !== 'object' || row === null) {
    throw new Error(UNEXPECTED_RESULT_MESSAGE);
  }
  return Reflect.get(row, column);
}

/** Creates the month partition when missing; true when it created one. */
export async function ensureStatsEventMonthPartition(
  parentTable: StatsEventParentTable,
  monthStart: string
): Promise<boolean> {
  const result: unknown = await AppDataSourceReadWrite.manager.query(
    'SELECT public.stats_event_ensure_month_partition($1, $2::date) AS created',
    [parentTable, monthStart]
  );
  const created = firstRowValue(result, 'created');
  if (typeof created !== 'boolean') {
    throw new Error(UNEXPECTED_RESULT_MESSAGE);
  }
  return created;
}

/** Drops month partitions that end on or before `cutoff`; returns how many it dropped. */
export async function dropStatsEventMonthPartitionsBefore(
  parentTable: StatsEventParentTable,
  cutoff: string
): Promise<number> {
  const result: unknown = await AppDataSourceReadWrite.manager.query(
    'SELECT public.stats_event_drop_month_partitions_before($1, $2::date) AS dropped',
    [parentTable, cutoff]
  );
  const dropped = firstRowValue(result, 'dropped');
  const count = typeof dropped === 'string' && dropped !== '' ? Number(dropped) : dropped;
  if (typeof count !== 'number' || !Number.isInteger(count)) {
    throw new Error(UNEXPECTED_RESULT_MESSAGE);
  }
  return count;
}
