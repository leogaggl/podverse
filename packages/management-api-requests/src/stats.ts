import type { StatsPopularityRange } from '@podverse/helpers';

import { ManagementApiRequestService } from './apiRequestService.js';

export type StatsRange = StatsPopularityRange;

export type EntityType = 'channel' | 'item' | 'clip' | 'playlist' | 'account';

export type StatsDailyPoint = { day: string; listener_count: number };

export type StatsCounts = {
  id: number;
  title: string | null;
  day_count: number;
  week_count: number;
  month_count: number;
  all_time_count: number;
};

export type StatsRow = StatsCounts & { range_count: number };

export type StatsDetail = StatsCounts & { daily: StatsDailyPoint[] };

export type StatsTopResponse = {
  rows: StatsRow[];
  total: number;
  page: number;
  pageSize: number;
};

export async function reqStatsTop(
  entityType: EntityType,
  range: StatsRange,
  page: number = 1,
  limit: number = 25
): Promise<StatsTopResponse> {
  const service = new ManagementApiRequestService();
  const params = new URLSearchParams({
    range,
    page: String(page),
    limit: String(limit),
  });
  return service.apiRequest<StatsTopResponse>({
    path: `/stats/${entityType}/top?${params.toString()}`,
    method: 'GET',
  });
}

export async function reqStatsDetail(entityType: EntityType, id: number): Promise<StatsDetail> {
  const service = new ManagementApiRequestService();
  return service.apiRequest<StatsDetail>({
    path: `/stats/${entityType}/${id}`,
    method: 'GET',
  });
}

export async function reqStatsSearch(
  entityType: EntityType,
  query: string,
  range: StatsRange,
  page: number = 1,
  limit: number = 25
): Promise<StatsTopResponse> {
  const service = new ManagementApiRequestService();
  const params = new URLSearchParams({
    q: query,
    range,
    page: String(page),
    limit: String(limit),
  });
  return service.apiRequest<StatsTopResponse>({
    path: `/stats/${entityType}/search?${params.toString()}`,
    method: 'GET',
  });
}
