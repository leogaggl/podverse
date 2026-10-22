import {
  compareUpcomingLiveItems,
  isUpcomingLiveItemStatus,
  LiveItemStatusEnum,
} from '@podverse/helpers';

import type { HomeFeedRowData } from '../../screens/home/homeFeedData';
import type { HomeRowMetadata } from '../../screens/home/homeRowMetadata';

/** What a broadcasting row claims about itself: on the air, and nothing else a subscription says. */
export const LIVE_ROW_METADATA: HomeRowMetadata = {
  downloadedCount: 0,
  isLive: true,
  latestItemPubDateMs: null,
  unseenBadge: null,
};

export type UpcomingLiveRow = HomeFeedRowData & {
  liveStatusId: LiveItemStatusEnum;
  startTimeMs: number | null;
};

/**
 * Epoch milliseconds of a livestream start.
 *
 * A finite number above zero is already milliseconds. An ISO string or a `Date` is parsed. Anything
 * else, including a missing value or a time at or before the epoch, is null.
 */
const startTimeMsFrom = (startTime: Date | string | number | null | undefined): number | null => {
  if (startTime === null || startTime === undefined) {
    return null;
  }

  if (typeof startTime === 'number') {
    return Number.isFinite(startTime) && startTime > 0 ? startTime : null;
  }

  const parsed = startTime instanceof Date ? startTime.getTime() : Date.parse(startTime);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
};

const rowHasUpdatedAt = (updatedAt: HomeFeedRowData['updatedAt']): boolean => {
  return updatedAt !== undefined && updatedAt !== null && updatedAt !== '';
};

/** Catalog key for a status a row states in words. Live has none: the Live badge says it. */
export const liveStatusWordKey = (
  statusId: LiveItemStatusEnum | null | undefined
): 'media.livestream.ended' | 'media.livestream.pending' | null => {
  if (statusId === LiveItemStatusEnum.Pending) {
    return 'media.livestream.pending';
  }
  if (statusId === LiveItemStatusEnum.Ended) {
    return 'media.livestream.ended';
  }
  return null;
};

/** A live row inside a channel: the Live badge only while on the air; the row keeps the status. */
export const toChannelLiveRow = (
  row: HomeFeedRowData,
  statusId: LiveItemStatusEnum | null | undefined
): HomeFeedRowData & { liveStatusId: LiveItemStatusEnum | null } => ({
  ...row,
  liveStatusId: statusId ?? null,
  metadata: statusId === LiveItemStatusEnum.Live ? LIVE_ROW_METADATA : row.metadata,
});

/** Marks a row live or scheduled; null when the status is not upcoming. */
export const toUpcomingLiveRow = (
  row: HomeFeedRowData,
  statusId: LiveItemStatusEnum | null | undefined,
  startTime: Date | string | number | null | undefined
): UpcomingLiveRow | null => {
  if (statusId === null || statusId === undefined || !isUpcomingLiveItemStatus(statusId)) {
    return null;
  }

  const startTimeMs = startTimeMsFrom(startTime);
  return {
    ...row,
    liveStatusId: statusId,
    metadata: statusId === LiveItemStatusEnum.Live ? LIVE_ROW_METADATA : row.metadata,
    playable: statusId === LiveItemStatusEnum.Live ? row.playable : false,
    startTimeMs,
    updatedAt:
      !rowHasUpdatedAt(row.updatedAt) && startTimeMs !== null ? startTimeMs : row.updatedAt,
  };
};

/** Live first, then scheduled, by start time (`compareUpcomingLiveItems`); stable. */
export const sortUpcomingLiveRows = <T extends UpcomingLiveRow>(rows: readonly T[]): T[] => {
  return [...rows].sort((left, right) =>
    compareUpcomingLiveItems(
      { startTimeMs: left.startTimeMs, statusId: left.liveStatusId },
      { startTimeMs: right.startTimeMs, statusId: right.liveStatusId }
    )
  );
};
