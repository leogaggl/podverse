import { FeedLifecycleStateKeyEnum } from '@orm/entities/feed/feedLifecycleStateType.js';
import type { FeedPolicy } from '@orm/entities/feed/feedPolicy.js';

function isFeedPolicyParseAllowed(feedPolicy: FeedPolicy | null | undefined): boolean {
  if (!feedPolicy) {
    return true;
  }
  return feedPolicy.parse_allowed;
}

/** Pending archive, archived, merged, and takedown feeds are not parsed and are not public. */
export function lifecycleStateBlocksParseAndVisibility(
  lifecycleStateKey: FeedLifecycleStateKeyEnum
): boolean {
  return (
    lifecycleStateKey === FeedLifecycleStateKeyEnum.PendingArchive ||
    lifecycleStateKey === FeedLifecycleStateKeyEnum.Archived ||
    lifecycleStateKey === FeedLifecycleStateKeyEnum.Merged ||
    lifecycleStateKey === FeedLifecycleStateKeyEnum.Takedown
  );
}

/**
 * Parser/archiver gate: blocked lifecycle states skip parsing; otherwise `feed_policy.parse_allowed` decides.
 */
export function shouldAttemptFeedParseFromLifecycleAndPolicy(params: {
  lifecycleStateKey: FeedLifecycleStateKeyEnum;
  feedPolicy: FeedPolicy | null | undefined;
}): boolean {
  if (lifecycleStateBlocksParseAndVisibility(params.lifecycleStateKey)) {
    return false;
  }

  return isFeedPolicyParseAllowed(params.feedPolicy);
}
