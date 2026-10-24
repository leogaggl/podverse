import { loggerService } from '@parser/factories/loggerService.js';

import type { Channel } from '@podverse/orm';
import { ChannelVerifiedPublisherService } from '@podverse/orm';

/**
 * Recomputes verified publisher links for the channel as a content feed and for every content
 * feed that names it as publisher. Runs after the channel tables commit, so it reads both feeds'
 * stored references. A failure is logged and parsing continues; the links are derived data, and
 * the next parse or the backfill command recomputes them.
 */
export const handleParsedChannelVerifiedPublisher = async (channel: Channel): Promise<void> => {
  try {
    const service = new ChannelVerifiedPublisherService();
    await service.recomputeForChannel(channel.id);
  } catch (error) {
    loggerService.logError(`handleParsedChannelVerifiedPublisher channel_id=${channel.id}`, error);
  }
};
