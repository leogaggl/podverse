import { LiveItemStatusEnum } from '../dtos/liveItem/liveItem.js';
import { ONE_DAY_MS } from './timeConstants.js';

// Ended livestreams (live items) older than this are hidden from list endpoints.
// Hardcoded by product decision (no env); detail endpoints stay unfiltered.
export const LIVE_ITEM_ENDED_VISIBILITY_MAX_AGE_MS = ONE_DAY_MS;

export function getEndedLiveItemVisibilityCutoff(now: Date = new Date()): Date {
  return new Date(now.getTime() - LIVE_ITEM_ENDED_VISIBILITY_MAX_AGE_MS);
}

export interface LiveItemEndedStaleInput {
  live_item_status_id: LiveItemStatusEnum;
  start_time: string | Date;
  end_time?: string | Date | null;
}

function toTime(value: string | Date): number {
  return value instanceof Date ? value.getTime() : new Date(value).getTime();
}

export function isLiveItemEndedAndStale(
  liveItem: LiveItemEndedStaleInput,
  now: Date = new Date()
): boolean {
  if (liveItem.live_item_status_id !== LiveItemStatusEnum.Ended) {
    return false;
  }

  const cutoff = getEndedLiveItemVisibilityCutoff(now).getTime();
  const reference =
    liveItem.end_time !== null && liveItem.end_time !== undefined
      ? liveItem.end_time
      : liveItem.start_time;

  return toTime(reference) < cutoff;
}

// Scheduled livestreams (pending live items) whose start is further in the past than this are
// hidden from list endpoints. Hardcoded by product decision (no env); detail endpoints stay
// unfiltered.
export const LIVE_ITEM_PENDING_VISIBILITY_MAX_AGE_MS = ONE_DAY_MS;

export function getPendingLiveItemVisibilityCutoff(now: Date = new Date()): Date {
  return new Date(now.getTime() - LIVE_ITEM_PENDING_VISIBILITY_MAX_AGE_MS);
}

export type UpcomingLiveItemSortKey = {
  statusId: LiveItemStatusEnum | null | undefined;
  startTimeMs: number | null;
};

/**
 * True for a scheduled item whose start is before the pending visibility cutoff. The cutoff
 * instant itself is kept, and a scheduled item with no start time is never stale.
 */
export const isPendingLiveItemStale = (
  key: UpcomingLiveItemSortKey,
  now: Date = new Date()
): boolean =>
  key.statusId === LiveItemStatusEnum.Pending &&
  key.startTimeMs !== null &&
  key.startTimeMs < getPendingLiveItemVisibilityCutoff(now).getTime();

/** On the air now or scheduled; ended items are not upcoming. */
export const isUpcomingLiveItemStatus = (
  statusId: LiveItemStatusEnum | null | undefined
): boolean => statusId === LiveItemStatusEnum.Live || statusId === LiveItemStatusEnum.Pending;

function upcomingLiveItemRank(statusId: LiveItemStatusEnum | null | undefined): number {
  if (statusId === LiveItemStatusEnum.Live) {
    return 0;
  }
  if (statusId === LiveItemStatusEnum.Pending) {
    return 1;
  }
  return 2;
}

/**
 * The upcoming-livestreams order: live items first, latest start first; then scheduled items,
 * soonest start first. Within each group an item with no start time sorts after every dated one.
 * Matches `ItemService.getManyUpcomingLiveItems`.
 */
export const compareUpcomingLiveItems = (
  a: UpcomingLiveItemSortKey,
  b: UpcomingLiveItemSortKey
): number => {
  const rankDiff = upcomingLiveItemRank(a.statusId) - upcomingLiveItemRank(b.statusId);
  if (rankDiff !== 0) {
    return rankDiff;
  }
  if (a.startTimeMs === null && b.startTimeMs === null) {
    return 0;
  }
  if (a.startTimeMs === null) {
    return 1;
  }
  if (b.startTimeMs === null) {
    return -1;
  }
  if (a.statusId === LiveItemStatusEnum.Live && b.statusId === LiveItemStatusEnum.Live) {
    return b.startTimeMs - a.startTimeMs;
  }
  return a.startTimeMs - b.startTimeMs;
};

export type ChannelLiveItemSortKey = {
  statusId: LiveItemStatusEnum | null | undefined;
  startTimeMs: number | null;
  endTimeMs: number | null;
};

const channelLiveItemRank = (statusId: LiveItemStatusEnum | null | undefined): number => {
  if (statusId === LiveItemStatusEnum.Live) {
    return 0;
  }
  if (statusId === LiveItemStatusEnum.Pending) {
    return 1;
  }
  if (statusId === LiveItemStatusEnum.Ended) {
    return 2;
  }
  return 3;
};

/**
 * A channel's livestream order: live items, latest start first; then scheduled items, soonest
 * start first; then ended items, latest end first. A missing time sorts last in its group.
 */
export const compareChannelLiveItems = (
  a: ChannelLiveItemSortKey,
  b: ChannelLiveItemSortKey
): number => {
  const rankDiff = channelLiveItemRank(a.statusId) - channelLiveItemRank(b.statusId);
  if (rankDiff !== 0) {
    return rankDiff;
  }
  if (a.statusId === LiveItemStatusEnum.Ended) {
    return (b.endTimeMs ?? 0) - (a.endTimeMs ?? 0);
  }
  return compareUpcomingLiveItems(a, b);
};
