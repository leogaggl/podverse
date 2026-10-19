/**
 * Enqueue the existing Add-by-RSS refresh job from code that cannot call `useSync`.
 * `SyncProvider` registers the callback. Until it does, a request is a no-op.
 */
type RequestAddByRssRefresh = () => void;

let request: RequestAddByRssRefresh | null = null;

export const registerAddByRssRefreshRequest = (next: RequestAddByRssRefresh | null): void => {
  request = next;
};

export const requestAddByRssRefresh = (): void => {
  request?.();
};
