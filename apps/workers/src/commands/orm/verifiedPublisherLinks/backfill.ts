import type { CommandLineArgs } from '@workers/commands/index.js';
import { getLogger } from '@workers/factories/logger.js';

import { getErrorMessage } from '@podverse/helpers';
import { AppDataSourceReadWrite, ChannelVerifiedPublisherService } from '@podverse/orm';

const DEFAULT_BATCH_LIMIT = 500;

// Link rows belong to a content channel. The union also visits a channel whose claims were
// removed while rows remain, so those rows are cleared.
const SELECT_CONTENT_CHANNEL_IDS_SQL = `
  SELECT ids.channel_id
  FROM (
    SELECT channel_id FROM channel_publisher
    UNION
    SELECT channel_id FROM channel_verified_publisher
  ) ids
  WHERE ids.channel_id > $1
  ORDER BY ids.channel_id ASC
  LIMIT $2`;

const channelIdsFromRows = (rows: unknown): number[] => {
  if (!Array.isArray(rows)) {
    return [];
  }
  const ids: number[] = [];
  for (const row of rows) {
    if (typeof row !== 'object' || row === null) {
      continue;
    }
    const raw: unknown = Reflect.get(row, 'channel_id');
    if (typeof raw === 'number' && Number.isInteger(raw) && raw > 0) {
      ids.push(raw);
    }
  }
  return ids;
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

/**
 * Recomputes verified publisher links for every content channel that has publisher claims or
 * stored links, from the stored references of both feeds. A rerun converges: a channel whose
 * stored rows already match is left unchanged. Use it when a parse failed to recompute links or
 * the stored links look stale. `-afterId` resumes after the last channel id of a finished batch.
 */
export const ormVerifiedPublisherLinksBackfill = async (args: CommandLineArgs) => {
  const logger = getLogger();
  const limit = parsePositiveIntArg(args, 'limit', DEFAULT_BATCH_LIMIT);
  const dryRun = isDryRun(args);
  const prefix = dryRun ? '[dry-run] ' : '';
  const service = new ChannelVerifiedPublisherService();

  let afterId = parsePositiveIntArg(args, 'afterId', 0);
  let channelsScanned = 0;
  let linksStored = 0;
  let linksFound = 0;
  let channelsFailed = 0;

  for (;;) {
    const channelIds = channelIdsFromRows(
      await AppDataSourceReadWrite.manager.query(SELECT_CONTENT_CHANNEL_IDS_SQL, [afterId, limit])
    );
    const lastChannelId = channelIds[channelIds.length - 1];
    if (lastChannelId === undefined || lastChannelId <= afterId) {
      break;
    }

    for (const channelId of channelIds) {
      channelsScanned += 1;
      try {
        if (dryRun) {
          const found = await service.computeForContentChannel(channelId);
          linksFound += found.length;
        } else {
          linksStored += await service.recomputeForContentChannel(channelId);
        }
      } catch (error) {
        channelsFailed += 1;
        logger.error(
          `${prefix}ormVerifiedPublisherLinksBackfill failed channel_id=${channelId} error="${getErrorMessage(error, 'Unknown error')}"`
        );
      }
    }

    logger.info(
      `${prefix}ormVerifiedPublisherLinksBackfill batch last_channel_id=${lastChannelId} channels=${channelIds.length}`
    );
    afterId = lastChannelId;
  }

  if (dryRun) {
    logger.info(
      `${prefix}ormVerifiedPublisherLinksBackfill channels_scanned=${channelsScanned} links_found=${linksFound} channels_failed=${channelsFailed}`
    );
    return;
  }

  logger.info(
    `${prefix}ormVerifiedPublisherLinksBackfill channels_scanned=${channelsScanned} links_stored=${linksStored} channels_failed=${channelsFailed}`
  );
};
