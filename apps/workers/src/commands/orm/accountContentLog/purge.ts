import type { CommandLineArgs } from '@workers/commands/index.js';
import { getAccountContentLogRetentionConfig } from '@workers/config/index.js';
import { getLogger } from '@workers/factories/logger.js';

import { subtractDays } from '@podverse/helpers';
import { deleteAccountContentLogsUpdatedBefore } from '@podverse/orm';

/**
 * Deletes Removed Content rows whose updated_at is older than the retention window.
 * A row that was just updated for a later takedown stays. A re-run removes whatever is left.
 */
export const accountContentLogPurge = async (_args: CommandLineArgs) => {
  const logger = getLogger();
  const { retentionDays } = getAccountContentLogRetentionConfig();
  const retentionCutoff = subtractDays(new Date(), retentionDays);

  logger.info(
    `accountContentLogPurge starting with retention_days=${retentionDays} ` +
      `retention_cutoff=${retentionCutoff.toISOString()}`
  );

  const deleted = await deleteAccountContentLogsUpdatedBefore(retentionCutoff);

  logger.info(`accountContentLogPurge completed rows_deleted=${deleted}`);
};
