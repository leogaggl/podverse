import { useCallback, useLayoutEffect, useMemo, useRef, useState } from 'react';

import type { ApiRequestService } from '@podverse/helpers-requests';

import { requestWithMobileAuthRefresh } from '../../../auth';
import { useAuth } from '../../../auth/AuthProvider';
import { emptyIfNotFound } from '../../../lib/apiErrorStatus';

/** One page of a remote section, in the row shape the pane renders. */
export type PodcastSectionPage<TRow> = {
  hasMore: boolean;
  rows: TRow[];
};

export type PodcastSectionFetchPage<TRow> = (
  api: ApiRequestService,
  page: number
) => Promise<PodcastSectionPage<TRow>>;

export type PodcastSectionRows<TRow> = {
  errorKey: string | null;
  hasMore: boolean;
  isInitialLoading: boolean;
  isLoadingMore: boolean;
  isRefreshing: boolean;
  loadMore: () => Promise<void>;
  refresh: () => void;
  retry: () => void;
  rows: TRow[];
};

/**
 * The message a section shows when it could not reach the server.
 *
 * These sections have no stored copy to fall back on, so a failed request is a statement about the
 * connection rather than about the podcast — and it must not read like an empty list.
 */
export const PODCAST_SECTION_OFFLINE_MESSAGE_KEY = 'features.channel.section_requires_connection';

/**
 * Rows for a podcast section that only exists on the server.
 *
 * Clips, official clips, and podroll entries are not written to the device: they are made by other
 * people and change without this podcast changing, so there is nothing here to reconcile and nothing
 * worth keeping stale. A connection is therefore part of the contract, and losing it is reported as
 * that rather than as a podcast with nothing in it.
 *
 * `fetchPage` must be memoized by the caller — its identity is the reload trigger. When the channel
 * or the sort changes the closure changes with it, and the section starts again at the first page.
 */
export function usePodcastSectionRows<TRow>(
  fetchPage: PodcastSectionFetchPage<TRow>
): PodcastSectionRows<TRow> {
  const { accessToken, clearSession, refreshToken, setTokens } = useAuth();
  const [rows, setRows] = useState<TRow[]>([]);
  const [hasMore, setHasMore] = useState<boolean>(false);
  const [errorKey, setErrorKey] = useState<string | null>(null);
  const [isInitialLoading, setIsInitialLoading] = useState<boolean>(true);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [isLoadingMore, setIsLoadingMore] = useState<boolean>(false);
  const loadedPageRef = useRef<number>(0);
  /** Bumps when the section starts again at page 1, so an older page cannot write over that restart. */
  const generationRef = useRef<number>(0);
  /** Set for the duration of a next-page read, including one whose result is dropped. */
  const isLoadingMoreRef = useRef<boolean>(false);
  /** Which read failed, so Retry repeats that read instead of always restarting at page 1. */
  const failedLoadRef = useRef<'first' | 'more' | null>(null);

  const authContext = useMemo(
    () => ({ accessToken, clearSession, refreshToken, setTokens }),
    [accessToken, clearSession, refreshToken, setTokens]
  );

  const loadFirstPage = useCallback(
    async (isPullToRefresh: boolean) => {
      generationRef.current += 1;
      const generation = generationRef.current;
      if (isPullToRefresh) {
        setIsRefreshing(true);
      } else {
        setIsInitialLoading(true);
      }
      setErrorKey(null);

      try {
        const page = await emptyIfNotFound(
          async () => requestWithMobileAuthRefresh(authContext, async (api) => fetchPage(api, 1)),
          { hasMore: false, rows: [] }
        );
        if (generationRef.current !== generation) {
          return;
        }
        loadedPageRef.current = 1;
        setRows(page.rows);
        setHasMore(page.hasMore);
        failedLoadRef.current = null;
      } catch {
        if (generationRef.current !== generation) {
          return;
        }
        failedLoadRef.current = 'first';
        setErrorKey(PODCAST_SECTION_OFFLINE_MESSAGE_KEY);
      } finally {
        if (generationRef.current === generation) {
          setIsInitialLoading(false);
          setIsRefreshing(false);
        }
      }
    },
    [authContext, fetchPage]
  );

  /**
   * Append the next page, leaving what is already on screen alone.
   *
   * The page number is held in a ref rather than in state so reaching further cannot look like a new
   * request to the effect below, which would send the section back to the first page. A second call
   * while one page is in flight returns at once. A page that belongs to an earlier channel or sort
   * is dropped, so it cannot land after the section has started again at the first page. The footer
   * spinner is cleared either way, so a dropped page does not leave it on.
   */
  const loadMore = useCallback(async () => {
    if (isLoadingMoreRef.current) {
      return;
    }

    isLoadingMoreRef.current = true;
    const generation = generationRef.current;
    const nextPage = loadedPageRef.current + 1;
    setIsLoadingMore(true);
    try {
      const page = await emptyIfNotFound(
        async () =>
          requestWithMobileAuthRefresh(authContext, async (api) => fetchPage(api, nextPage)),
        { hasMore: false, rows: [] }
      );
      if (generationRef.current !== generation) {
        return;
      }
      loadedPageRef.current = nextPage;
      setRows((current) => [...current, ...page.rows]);
      setHasMore(page.hasMore);
      setErrorKey(null);
      failedLoadRef.current = null;
    } catch {
      if (generationRef.current !== generation) {
        return;
      }
      failedLoadRef.current = 'more';
      setErrorKey(PODCAST_SECTION_OFFLINE_MESSAGE_KEY);
    } finally {
      isLoadingMoreRef.current = false;
      setIsLoadingMore(false);
    }
  }, [authContext, fetchPage]);

  useLayoutEffect(() => {
    setIsInitialLoading(true);
    void loadFirstPage(false);
  }, [loadFirstPage]);

  return {
    errorKey,
    hasMore,
    isInitialLoading,
    isLoadingMore,
    isRefreshing,
    loadMore,
    refresh: () => {
      void loadFirstPage(true);
    },
    retry: () => {
      if (failedLoadRef.current === 'more') {
        setErrorKey(null);
        void loadMore();
        return;
      }
      void loadFirstPage(false);
    },
    rows,
  };
}
