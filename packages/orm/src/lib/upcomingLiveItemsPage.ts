export type UpcomingLiveItemsPageSegment = { skip: number; take: number };

/**
 * Splits one page of the upcoming list across the live group, which comes first, and the
 * scheduled group. A group the page does not reach is null.
 */
export function splitUpcomingLiveItemsPage(params: {
  skip: number;
  take: number;
  liveCount: number;
}): { live: UpcomingLiveItemsPageSegment | null; pending: UpcomingLiveItemsPageSegment | null } {
  const { skip, take, liveCount } = params;
  const live = skip < liveCount ? { skip, take: Math.min(take, liveCount - skip) } : null;
  const remaining = take - (live?.take ?? 0);
  const pending = remaining > 0 ? { skip: Math.max(0, skip - liveCount), take: remaining } : null;
  return { live, pending };
}
