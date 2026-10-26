import { useCallback, useRef } from 'react';

/**
 * Stable `onEndReached` handler. FlatList can fire again before the screen's loading flag
 * commits; the in-flight ref drops that second call. The screen's `loadMore` reports its own
 * failure.
 */
export function useLoadMoreOnEndReached(options: {
  canLoadMore: boolean;
  loadMore: () => Promise<void> | void;
}): () => void {
  const canLoadMoreRef = useRef(options.canLoadMore);
  const loadMoreRef = useRef(options.loadMore);
  const inFlightRef = useRef(false);

  canLoadMoreRef.current = options.canLoadMore;
  loadMoreRef.current = options.loadMore;

  return useCallback(() => {
    if (!canLoadMoreRef.current || inFlightRef.current) {
      return;
    }

    inFlightRef.current = true;
    let result: Promise<void> | void;
    try {
      result = loadMoreRef.current();
    } catch (error) {
      inFlightRef.current = false;
      throw error;
    }

    // The screen's loadMore reports its own failure. This chain only releases the guard.
    void Promise.resolve(result)
      .finally(() => {
        inFlightRef.current = false;
      })
      .catch(() => undefined);
  }, []);
}
