import { describe, expect, it } from 'vitest';

import {
  LIVE_ITEM_ENDED_VISIBILITY_MAX_AGE_MS,
  LIVE_ITEM_PENDING_VISIBILITY_MAX_AGE_MS,
  LiveItemStatusEnum,
} from '@podverse/helpers';

import { selectChannelOrderedLiveItems } from './channelLiveItems';

const NOW = new Date('2026-06-13T12:00:00.000Z');
const MINUTE_MS = 60 * 1000;
const HOUR_MS = 60 * MINUTE_MS;
const DAY_MS = 24 * HOUR_MS;

type LiveTimes = {
  live_item_status?: LiveItemStatusEnum | null;
  start_time?: string | Date | null;
  end_time?: string | Date | null;
};

type Row = {
  id: string;
  liveItem?: LiveTimes | null;
};

const iso = (offsetMs: number): string => new Date(NOW.getTime() + offsetMs).toISOString();

const row = (id: string, liveItem: Row['liveItem']): Row => ({ id, liveItem });

const ids = (items: readonly Row[]): string[] => items.map((item) => item.id);

describe('selectChannelOrderedLiveItems', () => {
  it('lists live, then scheduled, then ended, ahead of a newest-start order', () => {
    const ended = row('ended', {
      live_item_status: LiveItemStatusEnum.Ended,
      start_time: iso(-10 * MINUTE_MS),
      end_time: iso(-5 * MINUTE_MS),
    });
    const pending = row('pending', {
      live_item_status: LiveItemStatusEnum.Pending,
      start_time: iso(-30 * MINUTE_MS),
    });
    const live = row('live', {
      live_item_status: LiveItemStatusEnum.Live,
      start_time: iso(-2 * HOUR_MS),
    });

    expect(ids(selectChannelOrderedLiveItems([ended, pending, live], NOW))).toEqual([
      'live',
      'pending',
      'ended',
    ]);
  });

  it('lists two ended items by the later end first, even when that item started earlier', () => {
    const laterEnd = row('later-end', {
      live_item_status: LiveItemStatusEnum.Ended,
      start_time: iso(-20 * HOUR_MS),
      end_time: iso(-2 * HOUR_MS),
    });
    const earlierEnd = row('earlier-end', {
      live_item_status: LiveItemStatusEnum.Ended,
      start_time: iso(-3 * HOUR_MS),
      end_time: iso(-10 * HOUR_MS),
    });

    expect(ids(selectChannelOrderedLiveItems([earlierEnd, laterEnd], NOW))).toEqual([
      'later-end',
      'earlier-end',
    ]);
  });

  it('drops an ended item one millisecond before the cutoff and keeps the cutoff and an old live item, and drops a scheduled item that started ten days ago', () => {
    const cutoffMs = NOW.getTime() - LIVE_ITEM_ENDED_VISIBILITY_MAX_AGE_MS;
    const beforeCutoff = row('before-cutoff', {
      live_item_status: LiveItemStatusEnum.Ended,
      start_time: new Date(cutoffMs - MINUTE_MS).toISOString(),
      end_time: new Date(cutoffMs - 1).toISOString(),
    });
    const atCutoff = row('at-cutoff', {
      live_item_status: LiveItemStatusEnum.Ended,
      start_time: new Date(cutoffMs - MINUTE_MS).toISOString(),
      end_time: new Date(cutoffMs).toISOString(),
    });
    const oldLive = row('old-live', {
      live_item_status: LiveItemStatusEnum.Live,
      start_time: iso(-10 * DAY_MS),
      end_time: iso(-10 * DAY_MS),
    });
    const oldPending = row('old-pending', {
      live_item_status: LiveItemStatusEnum.Pending,
      start_time: iso(-10 * DAY_MS),
      end_time: iso(-10 * DAY_MS),
    });

    expect(
      ids(selectChannelOrderedLiveItems([beforeCutoff, atCutoff, oldLive, oldPending], NOW))
    ).toEqual(['old-live', 'at-cutoff']);
  });

  it('lists two scheduled items soonest start first when the later one is given first', () => {
    const inFiveHours = row('in-five-hours', {
      live_item_status: LiveItemStatusEnum.Pending,
      start_time: iso(5 * HOUR_MS),
    });
    const inOneHour = row('in-one-hour', {
      live_item_status: LiveItemStatusEnum.Pending,
      start_time: iso(HOUR_MS),
    });

    expect(ids(selectChannelOrderedLiveItems([inFiveHours, inOneHour], NOW))).toEqual([
      'in-one-hour',
      'in-five-hours',
    ]);
  });

  it('drops a scheduled item one millisecond before the pending cutoff, keeps one at the cutoff, and keeps a scheduled item with no start', () => {
    const cutoffMs = NOW.getTime() - LIVE_ITEM_PENDING_VISIBILITY_MAX_AGE_MS;
    const beforeCutoff = row('before-cutoff', {
      live_item_status: LiveItemStatusEnum.Pending,
      start_time: new Date(cutoffMs - 1).toISOString(),
    });
    const atCutoff = row('at-cutoff', {
      live_item_status: LiveItemStatusEnum.Pending,
      start_time: new Date(cutoffMs).toISOString(),
    });
    const noStart = row('no-start', {
      live_item_status: LiveItemStatusEnum.Pending,
      start_time: null,
    });

    expect(ids(selectChannelOrderedLiveItems([beforeCutoff, atCutoff, noStart], NOW))).toEqual([
      'at-cutoff',
      'no-start',
    ]);
  });

  it('drops an ended item with no end time when its start is two days old, and keeps one that started within the hour', () => {
    const stale = row('stale', {
      live_item_status: LiveItemStatusEnum.Ended,
      start_time: iso(-2 * DAY_MS),
      end_time: null,
    });
    const fresh = row('fresh', {
      live_item_status: LiveItemStatusEnum.Ended,
      start_time: iso(-HOUR_MS),
      end_time: null,
    });

    expect(ids(selectChannelOrderedLiveItems([stale, fresh], NOW))).toEqual(['fresh']);
  });

  it('drops a missing live item and a live item with no status', () => {
    const missing = row('missing', null);
    const noStatus = row('no-status', {
      start_time: iso(-HOUR_MS),
    });
    const live = row('live', {
      live_item_status: LiveItemStatusEnum.Live,
      start_time: iso(-HOUR_MS),
    });

    expect(ids(selectChannelOrderedLiveItems([missing, noStatus, live], NOW))).toEqual(['live']);
  });

  it('lists a dated live item before one with no start, and leaves the input array in place', () => {
    const undated = row('undated', {
      live_item_status: LiveItemStatusEnum.Live,
      start_time: null,
      end_time: null,
    });
    const dated = row('dated', {
      live_item_status: LiveItemStatusEnum.Live,
      start_time: iso(-HOUR_MS),
    });
    const input = [undated, dated];
    const before = ids(input);

    expect(ids(selectChannelOrderedLiveItems(input, NOW))).toEqual(['dated', 'undated']);
    expect(ids(input)).toEqual(before);
  });

  it('lists the later start first when one start is a Date and the other is an ISO string', () => {
    const earlierIso = iso(-3 * HOUR_MS);
    const laterIso = iso(-HOUR_MS);
    const asDate = row('as-date', {
      live_item_status: LiveItemStatusEnum.Live,
      start_time: new Date(earlierIso),
    });
    const asIso = row('as-iso', {
      live_item_status: LiveItemStatusEnum.Live,
      start_time: laterIso,
    });

    expect(ids(selectChannelOrderedLiveItems([asDate, asIso], NOW))).toEqual(['as-iso', 'as-date']);
  });
});
