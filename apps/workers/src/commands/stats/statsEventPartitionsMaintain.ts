import type { CommandLineArgs } from '@workers/commands/index.js';
import { getStatsConfig } from '@workers/config/index.js';
import { getLogger } from '@workers/factories/logger.js';
import {
  getStatsEventPartitionMonthStarts,
  getStatsEventRetentionCutoff,
  STATS_EVENT_PARTITION_MONTHS_AHEAD,
} from '@workers/lib/stats/statsUtcDates.js';

import type { StatsEventParentTable } from '@podverse/orm';
import {
  dropStatsEventMonthPartitionsBefore,
  ensureStatsEventMonthPartition,
  STATS_EVENT_PARENT_TABLES,
} from '@podverse/orm';

/**
 * Keeps monthly popularity event partitions created ahead of time and drops months whose rows are
 * all older than `STATS_TRACK_EVENT_RETENTION_DAYS`. See `docs/features/POPULARITY-AND-TASTE-PROFILE.md`.
 */
export const statsEventPartitionsMaintain = async (_args: CommandLineArgs) => {
  const logger = getLogger();
  const now = new Date();
  const { trackEventRetentionDays: retentionDays } = getStatsConfig();
  const monthStarts = getStatsEventPartitionMonthStarts(now, STATS_EVENT_PARTITION_MONTHS_AHEAD);
  const cutoff = getStatsEventRetentionCutoff(now, retentionDays);

  logger.info(
    `statsEventPartitionsMaintain starting retention_days=${retentionDays} cutoff=${cutoff} ` +
      `months=${monthStarts[0]}..${monthStarts[monthStarts.length - 1]}`
  );

  const createdByParent = new Map<StatsEventParentTable, number>();
  for (const parentTable of STATS_EVENT_PARENT_TABLES) {
    let created = 0;
    for (const monthStart of monthStarts) {
      if (await ensureStatsEventMonthPartition(parentTable, monthStart)) {
        created += 1;
      }
    }
    createdByParent.set(parentTable, created);
  }

  for (const parentTable of STATS_EVENT_PARENT_TABLES) {
    const dropped = await dropStatsEventMonthPartitionsBefore(parentTable, cutoff);
    logger.info(
      `statsEventPartitionsMaintain ${parentTable} ` +
        `partitions_created=${createdByParent.get(parentTable) ?? 0} partitions_dropped=${dropped}`
    );
  }
};
