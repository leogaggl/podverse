/**
 * UTC days before today that each popularity range includes, so a range of N always covers at
 * least the last N × 24 hours.
 */
export const STATS_POPULARITY_RANGE_LOOKBACK_DAYS = {
  day: 1,
  week: 7,
  month: 30,
} as const;

export type StatsPopularityLookbackRange = keyof typeof STATS_POPULARITY_RANGE_LOOKBACK_DAYS;

export const STATS_POPULARITY_COUNT_FIELDS = {
  day: 'day_count',
  week: 'week_count',
  month: 'month_count',
  'all-time': 'all_time_count',
} as const;

export type StatsPopularityRange = keyof typeof STATS_POPULARITY_COUNT_FIELDS;
export type StatsPopularityCountField =
  (typeof STATS_POPULARITY_COUNT_FIELDS)[StatsPopularityRange];
