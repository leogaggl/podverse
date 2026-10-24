import type { PopularityFlagReason, StatsPopularityRange } from '@podverse/helpers';

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

export type StatsFlaggedListenerStatus = 'active' | 'cleared' | 'all';

export type StatsFlaggedListenerRow = {
  id: number;
  listener_id: string;
  reason: PopularityFlagReason;
  /** ISO 8601 */
  flagged_at: string;
  times_flagged: number;
  /** ISO 8601, or null while the flag is active */
  cleared_at: string | null;
  cleared_by_admin_id: number | null;
  /** Stored listen events in the last 7 days, popularity-counted or not. */
  listens_last_7_days: number;
  /** Stored open events in the last 7 days. */
  opens_last_7_days: number;
};

export type StatsFlaggedListenersResponse = {
  rows: StatsFlaggedListenerRow[];
  total: number;
  page: number;
  pageSize: number;
};

export async function reqStatsFlaggedListeners(
  status: StatsFlaggedListenerStatus,
  page: number = 1,
  limit: number = 25
): Promise<StatsFlaggedListenersResponse> {
  const service = new ManagementApiRequestService();
  const params = new URLSearchParams({
    status,
    page: String(page),
    limit: String(limit),
  });
  return service.apiRequest<StatsFlaggedListenersResponse>({
    path: `/stats/flagged-listeners?${params.toString()}`,
    method: 'GET',
  });
}

export async function reqStatsFlaggedListenerClear(
  id: number
): Promise<{ row: StatsFlaggedListenerRow }> {
  const service = new ManagementApiRequestService();
  return service.apiRequest<{ row: StatsFlaggedListenerRow }>({
    path: `/stats/flagged-listeners/${id}/clear`,
    method: 'POST',
  });
}
