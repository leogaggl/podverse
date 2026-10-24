import {
  buildDailyListenerSeries,
  utcTodayDateString,
} from '@management-api/lib/stats/dailyListenerSeries.js';
import { describe, expect, it } from 'vitest';

describe('utcTodayDateString', () => {
  it('returns the UTC calendar date', () => {
    expect(utcTodayDateString(new Date('2026-10-21T00:00:00.000Z'))).toBe('2026-10-21');
    expect(utcTodayDateString(new Date('2026-10-20T23:59:59.999Z'))).toBe('2026-10-20');
  });
});

describe('buildDailyListenerSeries', () => {
  it('fills each day in the window and ignores a day outside it', () => {
    const series = buildDailyListenerSeries(
      [
        { day: '2026-10-20', listener_count: 4 },
        { day: '2026-01-01', listener_count: 9 },
      ],
      '2026-10-21',
      2
    );

    expect(series).toEqual([
      { day: '2026-10-19', listener_count: 0 },
      { day: '2026-10-20', listener_count: 4 },
      { day: '2026-10-21', listener_count: 0 },
    ]);
  });

  it('keeps the later count when two rows share a day', () => {
    const series = buildDailyListenerSeries(
      [
        { day: '2026-10-21', listener_count: 1 },
        { day: '2026-10-21', listener_count: 6 },
      ],
      '2026-10-21',
      2
    );

    expect(series[2]).toEqual({ day: '2026-10-21', listener_count: 6 });
  });
});
