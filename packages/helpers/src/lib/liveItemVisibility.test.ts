import { describe, expect, it } from 'vitest';

import { LiveItemStatusEnum } from '../dtos/liveItem/liveItem.js';
import {
  compareChannelLiveItems,
  compareUpcomingLiveItems,
  getEndedLiveItemVisibilityCutoff,
  isLiveItemEndedAndStale,
  isUpcomingLiveItemStatus,
  LIVE_ITEM_ENDED_VISIBILITY_MAX_AGE_MS,
} from './liveItemVisibility.js';

const NOW = new Date('2026-06-13T12:00:00.000Z');
const ONE_DAY_MS = 24 * 60 * 60 * 1000;

describe('LIVE_ITEM_ENDED_VISIBILITY_MAX_AGE_MS', () => {
  it('is exactly one day in milliseconds', () => {
    expect(LIVE_ITEM_ENDED_VISIBILITY_MAX_AGE_MS).toBe(ONE_DAY_MS);
  });
});

describe('getEndedLiveItemVisibilityCutoff', () => {
  it('returns now minus one day', () => {
    const cutoff = getEndedLiveItemVisibilityCutoff(NOW);
    expect(cutoff.getTime()).toBe(NOW.getTime() - ONE_DAY_MS);
  });
});

describe('isLiveItemEndedAndStale', () => {
  it('returns false for non-ended statuses regardless of age', () => {
    const longAgo = new Date(NOW.getTime() - 10 * ONE_DAY_MS).toISOString();
    expect(
      isLiveItemEndedAndStale(
        { live_item_status_id: LiveItemStatusEnum.Live, start_time: longAgo, end_time: longAgo },
        NOW
      )
    ).toBe(false);
    expect(
      isLiveItemEndedAndStale(
        { live_item_status_id: LiveItemStatusEnum.Pending, start_time: longAgo, end_time: longAgo },
        NOW
      )
    ).toBe(false);
  });

  it('returns true when an ended item ended more than a day ago', () => {
    const endTime = new Date(NOW.getTime() - ONE_DAY_MS - 1).toISOString();
    expect(
      isLiveItemEndedAndStale(
        { live_item_status_id: LiveItemStatusEnum.Ended, start_time: endTime, end_time: endTime },
        NOW
      )
    ).toBe(true);
  });

  it('returns false at exactly the one-day boundary (cutoff is inclusive of keep)', () => {
    const endTime = new Date(NOW.getTime() - ONE_DAY_MS).toISOString();
    expect(
      isLiveItemEndedAndStale(
        { live_item_status_id: LiveItemStatusEnum.Ended, start_time: endTime, end_time: endTime },
        NOW
      )
    ).toBe(false);
  });

  it('returns false when an ended item ended within the last day', () => {
    const endTime = new Date(NOW.getTime() - 60 * 1000).toISOString();
    expect(
      isLiveItemEndedAndStale(
        { live_item_status_id: LiveItemStatusEnum.Ended, start_time: endTime, end_time: endTime },
        NOW
      )
    ).toBe(false);
  });

  it('falls back to start_time when end_time is null', () => {
    const staleStart = new Date(NOW.getTime() - 2 * ONE_DAY_MS).toISOString();
    expect(
      isLiveItemEndedAndStale(
        { live_item_status_id: LiveItemStatusEnum.Ended, start_time: staleStart, end_time: null },
        NOW
      )
    ).toBe(true);
  });

  it('falls back to start_time when end_time is undefined', () => {
    const freshStart = new Date(NOW.getTime() - 60 * 1000).toISOString();
    expect(
      isLiveItemEndedAndStale(
        { live_item_status_id: LiveItemStatusEnum.Ended, start_time: freshStart },
        NOW
      )
    ).toBe(false);
  });

  it('accepts Date values for start_time and end_time', () => {
    const staleEnd = new Date(NOW.getTime() - 2 * ONE_DAY_MS);
    expect(
      isLiveItemEndedAndStale(
        { live_item_status_id: LiveItemStatusEnum.Ended, start_time: staleEnd, end_time: staleEnd },
        NOW
      )
    ).toBe(true);
  });
});

describe('compareUpcomingLiveItems', () => {
  it('sorts a live item before a scheduled item even when the live item starts later', () => {
    const liveLater = { statusId: LiveItemStatusEnum.Live, startTimeMs: 2_000 };
    const scheduledEarlier = { statusId: LiveItemStatusEnum.Pending, startTimeMs: 1_000 };
    expect(compareUpcomingLiveItems(liveLater, scheduledEarlier)).toBeLessThan(0);
    expect(compareUpcomingLiveItems(scheduledEarlier, liveLater)).toBeGreaterThan(0);
  });

  it('sorts scheduled items by the earliest start, with a missing start after a dated one', () => {
    const earlier = { statusId: LiveItemStatusEnum.Pending, startTimeMs: 1_000 };
    const later = { statusId: LiveItemStatusEnum.Pending, startTimeMs: 3_000 };
    const missing = { statusId: LiveItemStatusEnum.Pending, startTimeMs: null };
    expect(compareUpcomingLiveItems(earlier, later)).toBeLessThan(0);
    expect(compareUpcomingLiveItems(missing, earlier)).toBeGreaterThan(0);
    expect(
      compareUpcomingLiveItems(missing, {
        statusId: LiveItemStatusEnum.Pending,
        startTimeMs: null,
      })
    ).toBe(0);
  });
});

describe('compareChannelLiveItems', () => {
  it('keeps live before a later-starting scheduled item, then ended', () => {
    const live = { endTimeMs: null, startTimeMs: 1_000, statusId: LiveItemStatusEnum.Live };
    const scheduledLater = {
      endTimeMs: null,
      startTimeMs: 5_000,
      statusId: LiveItemStatusEnum.Pending,
    };
    const ended = { endTimeMs: 4_000, startTimeMs: 500, statusId: LiveItemStatusEnum.Ended };

    expect(compareChannelLiveItems(live, scheduledLater)).toBeLessThan(0);
    expect(compareChannelLiveItems(scheduledLater, live)).toBeGreaterThan(0);
    expect(compareChannelLiveItems(scheduledLater, ended)).toBeLessThan(0);
    expect(compareChannelLiveItems(live, ended)).toBeLessThan(0);
  });

  it('puts the later live start first, and the later end first', () => {
    const liveEarlier = { endTimeMs: null, startTimeMs: 1_000, statusId: LiveItemStatusEnum.Live };
    const liveLater = { endTimeMs: null, startTimeMs: 3_000, statusId: LiveItemStatusEnum.Live };
    expect(compareChannelLiveItems(liveLater, liveEarlier)).toBeLessThan(0);

    const endedLaterEnd = {
      endTimeMs: 8_000,
      startTimeMs: 1_000,
      statusId: LiveItemStatusEnum.Ended,
    };
    const endedEarlierEnd = {
      endTimeMs: 6_000,
      startTimeMs: 5_000,
      statusId: LiveItemStatusEnum.Ended,
    };
    expect(compareChannelLiveItems(endedLaterEnd, endedEarlierEnd)).toBeLessThan(0);
  });

  it('puts a missing start or end after a dated item of that status', () => {
    const datedLive = { endTimeMs: null, startTimeMs: 2_000, statusId: LiveItemStatusEnum.Live };
    const missingStart = { endTimeMs: null, startTimeMs: null, statusId: LiveItemStatusEnum.Live };
    expect(compareChannelLiveItems(missingStart, datedLive)).toBeGreaterThan(0);

    const datedEnded = {
      endTimeMs: 5_000,
      startTimeMs: 1_000,
      statusId: LiveItemStatusEnum.Ended,
    };
    const missingEnd = {
      endTimeMs: null,
      startTimeMs: 9_000,
      statusId: LiveItemStatusEnum.Ended,
    };
    expect(compareChannelLiveItems(missingEnd, datedEnded)).toBeGreaterThan(0);
  });
});

describe('isUpcomingLiveItemStatus', () => {
  it('is true for live and pending, and false for ended, null, and undefined', () => {
    expect(isUpcomingLiveItemStatus(LiveItemStatusEnum.Live)).toBe(true);
    expect(isUpcomingLiveItemStatus(LiveItemStatusEnum.Pending)).toBe(true);
    expect(isUpcomingLiveItemStatus(LiveItemStatusEnum.Ended)).toBe(false);
    expect(isUpcomingLiveItemStatus(null)).toBe(false);
    expect(isUpcomingLiveItemStatus(undefined)).toBe(false);
  });
});
