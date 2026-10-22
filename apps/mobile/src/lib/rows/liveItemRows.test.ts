import { describe, expect, it } from 'vitest';

import { LiveItemStatusEnum } from '@podverse/helpers';

import type { HomeFeedRowData } from '../../screens/home/homeFeedData';
import {
  LIVE_ROW_METADATA,
  liveStatusWordKey,
  sortUpcomingLiveRows,
  toChannelLiveRow,
  toUpcomingLiveRow,
} from './liveItemRows';

const baseRow = (id: string, overrides: Partial<HomeFeedRowData> = {}): HomeFeedRowData => {
  return {
    id,
    imageUrl: null,
    playbackMediaId: `playback-${id}`,
    subtitle: 'Channel',
    title: id,
    ...overrides,
  };
};

describe('liveStatusWordKey', () => {
  it('names a scheduled or ended livestream and leaves a live one unspoken', () => {
    expect(liveStatusWordKey(LiveItemStatusEnum.Pending)).toBe('media.livestream.pending');
    expect(liveStatusWordKey(LiveItemStatusEnum.Ended)).toBe('media.livestream.ended');
    expect(liveStatusWordKey(LiveItemStatusEnum.Live)).toBeNull();
    expect(liveStatusWordKey(null)).toBeNull();
    expect(liveStatusWordKey(undefined)).toBeNull();
  });
});

describe('toChannelLiveRow', () => {
  it('sets the Live badge only while the stream is on the air', () => {
    const live = toChannelLiveRow(baseRow('live'), LiveItemStatusEnum.Live);
    expect(live.metadata).toBe(LIVE_ROW_METADATA);
    expect(live.liveStatusId).toBe(LiveItemStatusEnum.Live);

    const pending = toChannelLiveRow(baseRow('pending'), LiveItemStatusEnum.Pending);
    expect(pending.liveStatusId).toBe(LiveItemStatusEnum.Pending);
    expect(pending.metadata).toBeUndefined();

    const ended = toChannelLiveRow(baseRow('ended'), LiveItemStatusEnum.Ended);
    expect(ended.liveStatusId).toBe(LiveItemStatusEnum.Ended);
    expect(ended.metadata).toBeUndefined();

    const carried = toChannelLiveRow(
      baseRow('ended-carried', { metadata: LIVE_ROW_METADATA }),
      LiveItemStatusEnum.Ended
    );
    expect(carried.liveStatusId).toBe(LiveItemStatusEnum.Ended);
    expect(carried.metadata).toBe(LIVE_ROW_METADATA);

    const missing = toChannelLiveRow(baseRow('missing'), null);
    expect(missing.liveStatusId).toBeNull();
    expect(missing.metadata).toBeUndefined();

    const missingUndefined = toChannelLiveRow(baseRow('missing-undefined'), undefined);
    expect(missingUndefined.liveStatusId).toBeNull();
    expect(missingUndefined.metadata).toBeUndefined();
  });
});

describe('toUpcomingLiveRow', () => {
  it('drops an ended livestream', () => {
    expect(
      toUpcomingLiveRow(baseRow('ended'), LiveItemStatusEnum.Ended, '2026-01-15T18:30:00.000Z')
    ).toBeNull();
  });

  it('marks a live row and leaves play as the row set it', () => {
    const playable = toUpcomingLiveRow(
      baseRow('live', { playable: true }),
      LiveItemStatusEnum.Live,
      2_000
    );
    const unchanged = toUpcomingLiveRow(
      baseRow('live-open', { updatedAt: '2020-01-01T00:00:00.000Z' }),
      LiveItemStatusEnum.Live,
      2_000
    );

    expect(playable?.metadata?.isLive).toBe(true);
    expect(playable?.playable).toBe(true);
    expect(playable?.playbackMediaId).toBe('playback-live');
    expect(unchanged?.playable).toBeUndefined();
    expect(unchanged?.updatedAt).toBe('2020-01-01T00:00:00.000Z');
  });

  it('marks a scheduled row unplayable and reads an ISO start', () => {
    const start = '2026-01-15T18:30:00.000Z';
    const row = toUpcomingLiveRow(
      baseRow('scheduled', { playable: true }),
      LiveItemStatusEnum.Pending,
      start
    );

    expect(row?.liveStatusId).toBe(LiveItemStatusEnum.Pending);
    expect(row?.playable).toBe(false);
    expect(row?.startTimeMs).toBe(Date.parse(start));
    expect(row?.updatedAt).toBe(Date.parse(start));
    expect(row?.metadata?.isLive).toBeUndefined();
  });

  it('treats a non-positive start as missing', () => {
    expect(toUpcomingLiveRow(baseRow('zero'), LiveItemStatusEnum.Live, 0)?.startTimeMs).toBeNull();
  });
});

describe('sortUpcomingLiveRows', () => {
  const upcoming = (
    id: string,
    statusId: LiveItemStatusEnum.Live | LiveItemStatusEnum.Pending,
    startTimeMs: number
  ) => {
    const row = toUpcomingLiveRow(baseRow(id), statusId, startTimeMs);
    if (row === null) {
      throw new Error(`expected an upcoming row for ${id}`);
    }
    return row;
  };

  it('sorts a later live row before an earlier scheduled row', () => {
    const liveLater = upcoming('live-later', LiveItemStatusEnum.Live, 2_000);
    const scheduledEarlier = upcoming('scheduled-earlier', LiveItemStatusEnum.Pending, 1_000);

    expect(sortUpcomingLiveRows([scheduledEarlier, liveLater]).map((row) => row.id)).toEqual([
      'live-later',
      'scheduled-earlier',
    ]);
  });

  it('sorts scheduled rows by start time', () => {
    const later = upcoming('later', LiveItemStatusEnum.Pending, 3_000);
    const earlier = upcoming('earlier', LiveItemStatusEnum.Pending, 1_000);

    expect(sortUpcomingLiveRows([later, earlier]).map((row) => row.id)).toEqual([
      'earlier',
      'later',
    ]);
  });

  it('keeps input order when the sort keys match', () => {
    const first = upcoming('first', LiveItemStatusEnum.Pending, 1_000);
    const second = upcoming('second', LiveItemStatusEnum.Pending, 1_000);
    const input = [first, second];

    expect(sortUpcomingLiveRows(input).map((row) => row.id)).toEqual(['first', 'second']);
    expect(input.map((row) => row.id)).toEqual(['first', 'second']);
  });
});
