import type { CommandLineArgs } from '@workers/commands/index.js';
import { getLogger } from '@workers/factories/logger.js';

import { resolveDescriptionLengthTier } from '@podverse/helpers';
import {
  AppDataSourceReadWrite,
  buildFeedForceReparseDedupeKey,
  FEED_FORCE_REPARSE_JOB_TYPE,
  FeedLifecycleStateKeyEnum,
  FeedService,
  scheduleFeedForceReparse,
  shouldAttemptFeedParseFromLifecycleAndPolicy,
} from '@podverse/orm';

import { planDescriptionBackfill } from './planDescriptionBackfill.js';

const DEFAULT_BATCH_LIMIT = 500;
const DEFAULT_MAX_FEEDS = 200;
const DEFAULT_STAGGER_SECONDS = 60;

type DescriptionTable = 'item_description' | 'channel_description';

const DESCRIPTION_TABLES: readonly DescriptionTable[] = ['item_description', 'channel_description'];

const SELECT_BATCH_SQL: Record<DescriptionTable, string> = {
  item_description: `
    SELECT d.id, d.value, f.description_length_tier_override AS tier_override
    FROM item_description d
    LEFT JOIN item i ON i.id = d.item_id
    LEFT JOIN channel c ON c.id = i.channel_id
    LEFT JOIN feed f ON f.id = c.feed_id
    WHERE d.preview IS NULL AND d.id > $1
    ORDER BY d.id ASC
    LIMIT $2`,
  channel_description: `
    SELECT d.id, d.value, f.description_length_tier_override AS tier_override
    FROM channel_description d
    LEFT JOIN channel c ON c.id = d.channel_id
    LEFT JOIN feed f ON f.id = c.feed_id
    WHERE d.preview IS NULL AND d.id > $1
    ORDER BY d.id ASC
    LIMIT $2`,
};

const UPDATE_ROW_SQL: Record<DescriptionTable, string> = {
  item_description: `
    UPDATE item_description
    SET value = $1, preview = $2, is_truncated = $3, source_length = $4
    WHERE id = $5`,
  channel_description: `
    UPDATE channel_description
    SET value = $1, preview = $2, is_truncated = $3, source_length = $4
    WHERE id = $5`,
};

const SELECT_UNKNOWN_SOURCE_FEED_IDS_SQL = `
  SELECT DISTINCT candidates.feed_id
  FROM (
    SELECT c.feed_id
    FROM item_description d
    JOIN item i ON i.id = d.item_id
    JOIN channel c ON c.id = i.channel_id
    WHERE d.is_truncated AND d.source_length IS NULL
    UNION
    SELECT c.feed_id
    FROM channel_description d
    JOIN channel c ON c.id = d.channel_id
    WHERE d.is_truncated AND d.source_length IS NULL
  ) candidates
  ORDER BY candidates.feed_id ASC`;

const SELECT_REPARSE_DEDUPE_KEYS_SQL = `
  SELECT dedupe_key FROM scheduled_job WHERE job_type = $1`;

type BackfillRow = { id: number; value: string; tierOverride: string | null };

const toBackfillRows = (rows: unknown): BackfillRow[] => {
  if (!Array.isArray(rows)) {
    return [];
  }
  const result: BackfillRow[] = [];
  for (const row of rows) {
    if (typeof row !== 'object' || row === null) continue;
    if (!('id' in row) || !('value' in row) || !('tier_override' in row)) continue;
    const { id, value, tier_override } = row;
    if (typeof id !== 'number' || typeof value !== 'string') continue;
    result.push({
      id,
      value,
      tierOverride: typeof tier_override === 'string' ? tier_override : null,
    });
  }
  return result;
};

const toNumberColumn = (rows: unknown, column: string): number[] => {
  if (!Array.isArray(rows)) {
    return [];
  }
  const result: number[] = [];
  for (const row of rows) {
    if (typeof row !== 'object' || row === null || !(column in row)) continue;
    const raw: unknown = Reflect.get(row, column);
    const parsed = typeof raw === 'number' ? raw : Number(raw);
    if (Number.isInteger(parsed) && parsed > 0) {
      result.push(parsed);
    }
  }
  return result;
};

const toStringColumn = (rows: unknown, column: string): string[] => {
  if (!Array.isArray(rows)) {
    return [];
  }
  const result: string[] = [];
  for (const row of rows) {
    if (typeof row !== 'object' || row === null || !(column in row)) continue;
    const raw: unknown = Reflect.get(row, column);
    if (typeof raw === 'string') {
      result.push(raw);
    }
  }
  return result;
};

function parsePositiveIntArg(args: CommandLineArgs, key: string, fallback: number): number {
  const raw = args[key];
  if (typeof raw !== 'string') {
    return fallback;
  }
  const parsed = Number.parseInt(raw, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return fallback;
  }
  return parsed;
}

function hasFlag(args: CommandLineArgs, key: string): boolean {
  return args[key] !== undefined;
}

function isDryRun(args: CommandLineArgs): boolean {
  return hasFlag(args, 'dry-run') || hasFlag(args, 'dryRun') || hasFlag(args, 'dry_run');
}

type RepairTotals = { scanned: number; rewritten: number; legacyCuts: number };

async function repairDescriptionTable(
  table: DescriptionTable,
  limit: number,
  dryRun: boolean
): Promise<RepairTotals> {
  const totals: RepairTotals = { scanned: 0, rewritten: 0, legacyCuts: 0 };
  let lastId = 0;

  for (;;) {
    const rows = toBackfillRows(
      await AppDataSourceReadWrite.manager.query(SELECT_BATCH_SQL[table], [lastId, limit])
    );
    if (rows.length === 0) {
      return totals;
    }

    const plans = rows.map((row) => ({
      id: row.id,
      plan: planDescriptionBackfill(row.value, resolveDescriptionLengthTier(row.tierOverride)),
    }));
    totals.scanned += rows.length;
    totals.legacyCuts += plans.filter(({ plan }) => plan.legacyCut).length;

    if (!dryRun) {
      await AppDataSourceReadWrite.transaction(async (manager) => {
        for (const { id, plan } of plans) {
          await manager.query(UPDATE_ROW_SQL[table], [
            plan.value,
            plan.preview,
            plan.is_truncated,
            plan.source_length,
            id,
          ]);
        }
      });
      totals.rewritten += plans.length;
    }

    lastId = rows[rows.length - 1]?.id ?? lastId;
  }
}

type ScheduleTotals = { scheduled: number; ineligible: number; remaining: number };

/**
 * Feeds that already have a reparse row are skipped whatever its status. A finished reparse that
 * left rows unknown means those items have left the feed, so scheduling it again changes nothing
 * and the command would never converge.
 */
async function scheduleUnknownSourceReparses(
  maxFeeds: number,
  staggerSeconds: number,
  dryRun: boolean
): Promise<ScheduleTotals> {
  const logger = getLogger();
  const manager = AppDataSourceReadWrite.manager;
  const candidateFeedIds = toNumberColumn(
    await manager.query(SELECT_UNKNOWN_SOURCE_FEED_IDS_SQL),
    'feed_id'
  );
  const existingDedupeKeys = new Set(
    toStringColumn(
      await manager.query(SELECT_REPARSE_DEDUPE_KEYS_SQL, [FEED_FORCE_REPARSE_JOB_TYPE]),
      'dedupe_key'
    )
  );
  const unscheduledFeedIds = candidateFeedIds.filter(
    (feedId) => !existingDedupeKeys.has(buildFeedForceReparseDedupeKey(feedId))
  );

  const feedService = new FeedService();
  const now = Date.now();
  const totals: ScheduleTotals = { scheduled: 0, ineligible: 0, remaining: 0 };
  let checked = 0;

  for (const feedId of unscheduledFeedIds) {
    if (totals.scheduled >= maxFeeds) break;
    checked += 1;

    const feed = await feedService.get(feedId);
    const lifecycleStateKey =
      feed?.feed_lifecycle_state?.feed_lifecycle_state_type?.state_key ??
      FeedLifecycleStateKeyEnum.Active;
    if (
      feed === null ||
      !shouldAttemptFeedParseFromLifecycleAndPolicy({
        lifecycleStateKey,
        feedPolicy: feed.feed_policy,
      })
    ) {
      totals.ineligible += 1;
      continue;
    }

    const runAfter = new Date(now + totals.scheduled * staggerSeconds * 1000);
    if (dryRun) {
      logger.info(
        `[dry-run] ormDescriptionsBackfill would schedule feed_id=${feedId} run_after=${runAfter.toISOString()}`
      );
    } else {
      await scheduleFeedForceReparse(feedId, 'description_backfill', runAfter);
    }
    totals.scheduled += 1;
  }

  totals.remaining = unscheduledFeedIds.length - checked;
  return totals;
}

/**
 * Re-prepares stored descriptions that predate previews, then optionally schedules throttled
 * reparses for feeds whose descriptions were cut before their source length was recorded.
 * Rerunning converges: repaired rows have a preview and scheduled feeds have a job row.
 */
export const ormDescriptionsBackfill = async (args: CommandLineArgs) => {
  const logger = getLogger();
  const limit = parsePositiveIntArg(args, 'limit', DEFAULT_BATCH_LIMIT);
  const maxFeeds = parsePositiveIntArg(args, 'maxFeeds', DEFAULT_MAX_FEEDS);
  const staggerSeconds = parsePositiveIntArg(args, 'staggerSeconds', DEFAULT_STAGGER_SECONDS);
  const enqueueReparse = hasFlag(args, 'enqueueReparse');
  const dryRun = isDryRun(args);
  const prefix = dryRun ? '[dry-run] ' : '';

  logger.info(
    `${prefix}ormDescriptionsBackfill starting limit=${limit} enqueue_reparse=${enqueueReparse} max_feeds=${maxFeeds} stagger_seconds=${staggerSeconds}`
  );

  for (const table of DESCRIPTION_TABLES) {
    const totals = await repairDescriptionTable(table, limit, dryRun);
    logger.info(
      `${prefix}ormDescriptionsBackfill ${table} rows_scanned=${totals.scanned} rows_rewritten=${totals.rewritten} legacy_cuts_found=${totals.legacyCuts}`
    );
  }

  if (!enqueueReparse) {
    return;
  }

  const scheduleTotals = await scheduleUnknownSourceReparses(maxFeeds, staggerSeconds, dryRun);
  logger.info(
    `${prefix}ormDescriptionsBackfill feeds_scheduled=${scheduleTotals.scheduled} feeds_ineligible=${scheduleTotals.ineligible} feeds_remaining=${scheduleTotals.remaining}`
  );
};
