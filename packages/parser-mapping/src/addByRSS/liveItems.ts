import type { AddByRSSMappedFeed } from './types.js';

/** True when a parsed Add by RSS feed carries at least one live item, of any status. */
export const addByRSSMappedFeedHasLiveItems = (
  mappedFeed: AddByRSSMappedFeed | null | undefined
): boolean => (mappedFeed?.liveItems ?? []).length > 0;

/**
 * Whether a feed may have livestreams: once a parse has carried a live item the answer stays
 * yes, even after the item leaves the feed. Used both to write the stored flag and to read it.
 */
export const addByRSSFeedMayHaveLivestreams = (
  storedFlag: boolean | null | undefined,
  mappedFeed: AddByRSSMappedFeed | null | undefined
): boolean => storedFlag === true || addByRSSMappedFeedHasLiveItems(mappedFeed);
