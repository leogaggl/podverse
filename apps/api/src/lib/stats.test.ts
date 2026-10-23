import { describe, expect, it } from 'vitest';

import { getStatsOrder } from './stats.js';

describe('getStatsOrder', () => {
  it.each([
    ['day', 'day_count'],
    ['week', 'week_count'],
    ['month', 'month_count'],
    ['all-time', 'all_time_count'],
    [undefined, 'day_count'],
  ] as const)('maps %s to %s', (range, field) => {
    expect(getStatsOrder(range)).toBe(field);
  });
});
