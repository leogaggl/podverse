import type { CommandLineArgs } from '@workers/commands/index.js';
import { getLogger } from '@workers/factories/logger.js';
import { getTimerManager } from '@workers/factories/timerManager.js';

import { refreshRecommendations } from '@podverse/orm';

/**
 * Rebuilds show similarity and per-listener recommendations from Taste Profile weights.
 * The daily run refreshes shows and listeners that changed. `-full` rebuilds every show
 * that still has a taste row. See `docs/features/POPULARITY-AND-TASTE-PROFILE.md`.
 */
export const statsRecommendationsRefresh = async (args: CommandLineArgs) => {
  const logger = getLogger();
  const mode = 'full' in args ? 'full' : 'incremental';
  const timerLabel = 'statsRecommendationsRefresh full run';

  logger.info(`statsRecommendationsRefresh starting mode=${mode}`);
  getTimerManager().start(timerLabel);

  const result = await refreshRecommendations({ mode });
  if (result.skipped) {
    logger.info('statsRecommendationsRefresh skipped because another run holds the lock');
  } else {
    logger.info(
      `statsRecommendationsRefresh mode=${result.mode} similarity_channels=${result.similarityChannels} listeners=${result.listeners} recommendation_rows=${result.recommendationRows}`
    );
  }

  getTimerManager().end(timerLabel);
};
