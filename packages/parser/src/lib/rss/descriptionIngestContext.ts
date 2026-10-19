import type { DescriptionLengthTierEnum, PreparedDescription } from '@podverse/helpers';
import { resolveDescriptionLengthTier } from '@podverse/helpers';

/**
 * One per feed parse. The tier is resolved once from the feed, and every description handler
 * adds to the same stats so the feed row can record what this parse shortened.
 */
export type DescriptionIngestContext = {
  tier: DescriptionLengthTierEnum;
  stats: { truncatedCount: number; longestSourceLength: number };
};

export const createDescriptionIngestContext = (
  tierOverride: string | null | undefined
): DescriptionIngestContext => ({
  tier: resolveDescriptionLengthTier(tierOverride),
  stats: { truncatedCount: 0, longestSourceLength: 0 },
});

export const recordPreparedDescription = (
  context: DescriptionIngestContext,
  prepared: PreparedDescription | null
): void => {
  if (prepared === null) {
    return;
  }
  if (prepared.is_truncated) {
    context.stats.truncatedCount += 1;
  }
  context.stats.longestSourceLength = Math.max(
    context.stats.longestSourceLength,
    prepared.source_length
  );
};
