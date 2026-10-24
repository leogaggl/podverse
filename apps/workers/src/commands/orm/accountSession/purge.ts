import type { CommandLineArgs } from '@workers/commands/index.js';
import { getAccountSessionRetentionConfig } from '@workers/config/index.js';
import { getLogger } from '@workers/factories/logger.js';

import { subtractDays } from '@podverse/helpers';
import { deleteAccountSessionsIdleExpiredBefore } from '@podverse/orm';

/**
 * Deletes account_session rows whose idle expiry is older than the retention window.
 * A revoked row keeps its idle expiry. A re-run removes whatever is left.
 */
export const accountSessionPurge = async (_args: CommandLineArgs) => {
  const logger = getLogger();
  const { retentionDays } = getAccountSessionRetentionConfig();
  const retentionCutoff = subtractDays(new Date(), retentionDays);

  logger.info(
    `accountSessionPurge starting with retention_days=${retentionDays} ` +
      `retention_cutoff=${retentionCutoff.toISOString()}`
  );

  const deleted = await deleteAccountSessionsIdleExpiredBefore(retentionCutoff);

  logger.info(`accountSessionPurge completed rows_deleted=${deleted}`);
};
