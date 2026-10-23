import { describe, expect, it } from 'vitest';

import {
  STATS_POPULARITY_COUNT_FIELDS,
  STATS_POPULARITY_RANGE_LOOKBACK_DAYS,
} from './statsPopularityRange.js';

describe('STATS_POPULARITY_RANGE_LOOKBACK_DAYS', () => {
  it('keeps every lookback a positive integer, with day shorter than week shorter than month', () => {
    const { day, week, month } = STATS_POPULARITY_RANGE_LOOKBACK_DAYS;
    for (const lookback of Object.values(STATS_POPULARITY_RANGE_LOOKBACK_DAYS)) {
      expect(Number.isInteger(lookback)).toBe(true);
      expect(lookback).toBeGreaterThan(0);
    }
    expect(day).toBeLessThan(week);
    expect(week).toBeLessThan(month);
  });
});

describe('STATS_POPULARITY_COUNT_FIELDS', () => {
  it('maps day, week, month, and all-time to the popularity count columns', () => {
    expect(STATS_POPULARITY_COUNT_FIELDS).toEqual({
      day: 'day_count',
      week: 'week_count',
      month: 'month_count',
      'all-time': 'all_time_count',
    });
  });
});
