import { getPodcastIndexConfig } from '@workers/config/index.js';
import { getPodcastIndexService } from '@workers/factories/podcastIndexService.js';

import {
  deadFeedPairsWeHold,
  extractDeadFeedCsvRow,
  resolveDeadFeedDuplicateChains,
} from '@podverse/external-services-podcast-index';
import {
  ChannelMergeService,
  FeedService,
  PODCAST_INDEX_DEAD_FEED_SYNC_ID,
  PodcastIndexDeadFeedSync,
  PodcastIndexDeadFeedSyncService,
  verifyAndApplyDuplicateMerges,
} from '@podverse/orm';

import { enqueueRepointParse, fetchSurvivorFeed } from './applyDuplicateMerges.js';

/**
 * Record Podcast Index duplicate pairs for feeds we already store, then assess them.
 * `off` returns before any download. `dry_run` writes `verified` or `needs_review` and
 * does not move account rows. `apply` also re-points or absorbs each verified pair.
 */
export const podcastIndexDeadFeedsFlagAndMerge = async () => {
  const mode = getPodcastIndexConfig().duplicateMergeMode;
  if (mode === 'off') {
    console.warn('PODCAST_INDEX_DUPLICATE_MERGE_MODE is off. Skipping dead-feed download.');
    return;
  }

  const syncService = new PodcastIndexDeadFeedSyncService();
  const existing = await syncService.get();
  const targets = new Map<number, number | null>();
  let rowCount = 0;

  const download = await getPodcastIndexService().deadFeedsDownloadAndExtractCSV(
    (row) => {
      rowCount += 1;
      const parsed = extractDeadFeedCsvRow(row);
      if (parsed === null) {
        return;
      }
      targets.set(parsed.id_to_archive, parsed.duplicate_id_to_keep);
      if (rowCount % 500000 === 0) {
        console.warn(`Dead-feed CSV: read ${rowCount} rows.`);
      }
    },
    {
      ifModifiedSince: existing?.last_modified,
      ifNoneMatch: existing?.etag,
    }
  );

  if (download.notModified) {
    console.warn('Dead-feed CSV was not modified.');
  } else {
    const held = new Set(await new FeedService().listPodcastIndexIds());
    const pairs = deadFeedPairsWeHold(resolveDeadFeedDuplicateChains(targets), held);
    const mergeService = new ChannelMergeService();
    for (const pair of pairs) {
      await mergeService.upsertDetected({
        fromPodcastIndexId: pair.fromPodcastIndexId,
        toPodcastIndexId: pair.toPodcastIndexId,
      });
    }

    const syncRow = new PodcastIndexDeadFeedSync();
    syncRow.id = PODCAST_INDEX_DEAD_FEED_SYNC_ID;
    syncRow.last_modified = download.lastModified;
    syncRow.etag = download.etag;
    syncRow.synced_at = new Date();
    await syncService.save(syncRow);

    console.warn(
      `Dead-feed CSV: ${rowCount} rows, ${pairs.length} pairs recorded for feeds we have (mode ${mode}).`
    );
  }

  await verifyAndApplyDuplicateMerges({
    mode,
    fetchSurvivorFeed,
    enqueueRepointParse,
  });
};
