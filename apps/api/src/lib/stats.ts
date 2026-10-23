import type { StatsPopularityCountField } from '@podverse/helpers';
import { STATS_POPULARITY_COUNT_FIELDS } from '@podverse/helpers';
import type { QueryParamsStatsRange } from '@podverse/helpers-requests';

export const getStatsOrder = (range?: QueryParamsStatsRange): StatsPopularityCountField =>
  STATS_POPULARITY_COUNT_FIELDS[range ?? 'day'];
