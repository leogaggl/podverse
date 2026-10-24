import { describe, expect, it } from 'vitest';

import { ONE_DAY_MS, subtractDays } from '@podverse/helpers';

import {
  getStatsEventPartitionMonthStarts,
  getStatsEventRetentionCutoff,
  getUtcDateString,
  getUtcMonthStart,
} from './statsUtcDates.js';

describe('getStatsEventRetentionCutoff', () => {
  it('returns the first of the month containing now minus the retention window', () => {
    expect(getStatsEventRetentionCutoff(new Date('2026-10-21T03:30:00Z'), 90)).toBe('2026-07-01');
  });

  it('crosses a year boundary at a month edge', () => {
    expect(getStatsEventRetentionCutoff(new Date('2026-03-01T00:30:00Z'), 90)).toBe('2025-12-01');
  });

  it('keeps the current month with a one-day window', () => {
    expect(getStatsEventRetentionCutoff(new Date('2026-10-15T12:00:00Z'), 1)).toBe('2026-10-01');
  });

  it('never places the cutoff after now minus the retention window', () => {
    const start = Date.UTC(2026, 0, 1);
    const end = Date.UTC(2027, 0, 1);
    for (let dayStart = start; dayStart < end; dayStart += ONE_DAY_MS) {
      for (const now of [new Date(dayStart), new Date(dayStart + (23 * 60 + 59) * 60 * 1000)]) {
        for (const retentionDays of [1, 30, 31, 90, 365]) {
          const cutoff = getStatsEventRetentionCutoff(now, retentionDays);
          expect(cutoff).toMatch(/^\d{4}-\d{2}-01$/);
          expect(Date.parse(`${cutoff}T00:00:00Z`)).toBeLessThanOrEqual(
            subtractDays(now, retentionDays).getTime()
          );
        }
      }
    }
  });
});

describe('getStatsEventPartitionMonthStarts', () => {
  it('rolls December into January of the next year', () => {
    expect(getStatsEventPartitionMonthStarts(new Date('2026-11-30T23:59:00Z'), 2)).toEqual([
      '2026-11-01',
      '2026-12-01',
      '2027-01-01',
    ]);
  });
});

describe('UTC calendar strings', () => {
  it('uses the UTC day and month, not the local one', () => {
    const instant = new Date('2026-10-31T23:30:00-05:00');
    expect(getUtcMonthStart(instant)).toBe('2026-11-01');
    expect(getUtcDateString(instant)).toBe('2026-11-01');
  });
});
