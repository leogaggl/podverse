import type { CommandLineArgs } from '@workers/commands/index.js';
import { getLogger } from '@workers/factories/logger.js';

import { readArchivedSlimReport } from '@podverse/orm';

export const ormArchivedSlimReport = async (_args: CommandLineArgs): Promise<void> => {
  const logger = getLogger();
  const lines = await readArchivedSlimReport();
  for (const line of lines) {
    logger.info(line);
  }
};
