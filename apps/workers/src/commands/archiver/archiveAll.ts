import { getLoggerService } from '@workers/factories/loggerService.js';
import { probeFeedUrl } from '@workers/lib/archive/feedProbe.js';

import { ArchiverService } from '@podverse/orm';

export default async function archiveAll(): Promise<void> {
  const archiverService = new ArchiverService();

  try {
    getLoggerService().info('Starting archiveAll process...');
    await archiverService.archiveAll({ feedProbe: probeFeedUrl });
    getLoggerService().info('archiveAll process completed successfully.');
  } catch (error) {
    getLoggerService().error('Error occurred during archiveAll process:', error);
  }
}
