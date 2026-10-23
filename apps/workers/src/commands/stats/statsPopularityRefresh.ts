import type { CommandLineArgs } from '@workers/commands/index.js';
import { getLogger } from '@workers/factories/logger.js';
import { getTimerManager } from '@workers/factories/timerManager.js';
import { getUtcDateString } from '@workers/lib/stats/statsUtcDates.js';

import { refreshStatsPopularity } from '@podverse/orm';

/**
 * Rebuilds popularity range totals from daily totals. Hourly runs cover entities active in the
 * month window; `-full` recomputes every entity. See `docs/features/POPULARITY-TRACKING.md`.
 */
export const statsPopularityRefresh = async (args: CommandLineArgs) => {
  const logger = getLogger();
  const mode = 'full' in args ? 'full' : 'recent';
  const today = getUtcDateString(new Date());
  const timerLabel = 'statsPopularityRefresh full run';

  logger.info(`statsPopularityRefresh starting mode=${mode} today=${today}`);
  getTimerManager().start(timerLabel);

  const results = await refreshStatsPopularity({ today, mode });
  for (const { entityType, rowsWritten, rowsZeroed } of results) {
    logger.info(
      `statsPopularityRefresh ${entityType} rows_written=${rowsWritten} rows_zeroed=${rowsZeroed}`
    );
  }

  getTimerManager().end(timerLabel);
};
