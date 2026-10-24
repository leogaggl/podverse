import { AppDataSourceReadWrite } from '@orm/db/index.js';
import type { ScheduledJob } from '@orm/entities/account/scheduledJob.js';
import { Feed } from '@orm/entities/feed/feed.js';
import { ScheduledJobService } from '@orm/services/account/scheduledJob.js';

export const FEED_FORCE_REPARSE_JOB_TYPE = 'feed-force-reparse';

export type FeedForceReparseReason = 'description_tier_change';

export type FeedForceReparsePayload = {
  feedId: number;
  reason: FeedForceReparseReason;
};

const FEED_FORCE_REPARSE_REASONS: ReadonlySet<string> = new Set<FeedForceReparseReason>([
  'description_tier_change',
]);

const isFeedForceReparseReason = (value: unknown): value is FeedForceReparseReason =>
  typeof value === 'string' && FEED_FORCE_REPARSE_REASONS.has(value);

export const buildFeedForceReparseDedupeKey = (feedId: number): string =>
  `${FEED_FORCE_REPARSE_JOB_TYPE}:${feedId}`;

export const parseFeedForceReparsePayload = (
  payload: Record<string, unknown> | null | undefined
): FeedForceReparsePayload | null => {
  const feedId = payload?.feedId;
  const reason = payload?.reason;
  if (typeof feedId !== 'number' || !Number.isInteger(feedId) || feedId <= 0) {
    return null;
  }
  if (!isFeedForceReparseReason(reason)) {
    return null;
  }

  return { feedId, reason };
};

/**
 * Queue one forced reparse per feed, deduped by feed id, and clear the feed's file hash. The job
 * parses with force, so the cleared hash only matters when the job fails: the next ordinary parse
 * of that feed still runs in full instead of short-circuiting on an unchanged file.
 */
export const scheduleFeedForceReparse = async (
  feedId: number,
  reason: FeedForceReparseReason,
  runAfter: Date
): Promise<ScheduledJob> => {
  const payload: FeedForceReparsePayload = { feedId, reason };
  const job = await new ScheduledJobService().upsertByDedupeKey({
    dedupe_key: buildFeedForceReparseDedupeKey(feedId),
    job_type: FEED_FORCE_REPARSE_JOB_TYPE,
    payload,
    run_after: runAfter,
  });

  await AppDataSourceReadWrite.getRepository(Feed).update(
    { id: feedId },
    { last_parsed_file_hash: null }
  );

  return job;
};
