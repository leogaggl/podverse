/**
 * Enqueue Add-by-RSS sync jobs from code that cannot call `useSync`: the refresh of every followed
 * feed, and the album sync that fetches what an Add by RSS artist lists. `SyncProvider` registers
 * both callbacks. Until it does, a request is a no-op.
 */
type RequestAddByRssSync = () => void;

let request: RequestAddByRssSync | null = null;
let listedFeedsRequest: RequestAddByRssSync | null = null;

export const registerAddByRssRefreshRequest = (next: RequestAddByRssSync | null): void => {
  request = next;
};

export const requestAddByRssRefresh = (): void => {
  request?.();
};

export const registerAddByRssListedFeedsRequest = (next: RequestAddByRssSync | null): void => {
  listedFeedsRequest = next;
};

export const requestAddByRssListedFeedsSync = (): void => {
  listedFeedsRequest?.();
};
