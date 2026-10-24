import type { MutableRefObject } from 'react';
import { useCallback, useEffect, useRef, useState } from 'react';

import type {
  DTOAccountTasteProfileHiddenRow,
  DTOAccountTasteProfileRow,
  TasteProfilePage,
  TasteProfileRows,
} from '@podverse/helpers';
import {
  appendTasteProfilePage,
  fetchTasteProfilePages,
  TASTE_PROFILE_PAGE_LIMIT,
} from '@podverse/helpers';

import { useAuth } from '../auth/AuthProvider';
import type { AuthRequestDeps } from '../auth/authRequestWithRefresh';
import { requestWithMobileAuthRefresh } from '../auth/authRequestWithRefresh';

export type TasteProfileListState<Row> =
  | { status: 'loading' }
  | { status: 'error' }
  | { status: 'ready'; data: TasteProfileRows<Row>; loadingMore: boolean; loadMoreFailed: boolean };

export type UseTasteProfileListsResult = {
  profile: TasteProfileListState<DTOAccountTasteProfileRow>;
  hidden: TasteProfileListState<DTOAccountTasteProfileHiddenRow>;
  /** `channel.id_text` values with a hide or unhide in flight. */
  pendingChannelIds: ReadonlySet<string>;
  actionFailed: boolean;
  retry: () => void;
  loadMoreProfile: () => void;
  loadMoreHidden: () => void;
  hideShow: (channelIdText: string) => Promise<void>;
  unhideShow: (channelIdText: string, addToTasteProfile: boolean) => Promise<void>;
};

type KeyedRow = { channel: { id_text: string } };

/**
 * One paged list. A response applies only while both the shared generation and this list's
 * request sequence still match the values taken when the request started, so a slow response
 * never overwrites a newer one.
 */
function useTasteProfileList<Row extends KeyedRow>(
  fetchPage: (page: number) => Promise<TasteProfilePage<Row>>,
  generationRef: MutableRefObject<number>
) {
  const [state, setState] = useState<TasteProfileListState<Row>>({ status: 'loading' });
  const stateRef = useRef<TasteProfileListState<Row>>(state);
  const requestSeqRef = useRef(0);

  const applyState = useCallback((next: TasteProfileListState<Row>) => {
    stateRef.current = next;
    setState(next);
  }, []);

  const startRequest = useCallback(() => {
    requestSeqRef.current += 1;
    const generation = generationRef.current;
    const seq = requestSeqRef.current;
    return () => generation === generationRef.current && seq === requestSeqRef.current;
  }, [generationRef]);

  const fetchPages = useCallback(
    async (pageCount: number) => {
      const isCurrent = startRequest();
      try {
        const data = await fetchTasteProfilePages(fetchPage, pageCount);
        if (isCurrent()) {
          applyState({ status: 'ready', data, loadingMore: false, loadMoreFailed: false });
        }
      } catch (error) {
        console.warn('[useTasteProfileLists] load failed', error);
        if (isCurrent()) {
          applyState({ status: 'error' });
        }
      }
    },
    [applyState, fetchPage, startRequest]
  );

  const reset = useCallback(() => {
    requestSeqRef.current += 1;
    applyState({ status: 'loading' });
  }, [applyState]);

  const reload = useCallback(() => {
    reset();
    void fetchPages(1);
  }, [fetchPages, reset]);

  /** Reloads every page already shown, keeping the current rows on screen until it lands. */
  const refetch = useCallback(() => {
    const current = stateRef.current;
    void fetchPages(current.status === 'ready' ? current.data.loadedPages : 1);
  }, [fetchPages]);

  const loadMore = useCallback(() => {
    const current = stateRef.current;
    if (current.status !== 'ready' || !current.data.hasMore || current.loadingMore) {
      return;
    }
    const pageNumber = current.data.loadedPages + 1;
    const isCurrent = startRequest();
    applyState({ ...current, loadingMore: true, loadMoreFailed: false });
    void (async () => {
      try {
        const page = await fetchPage(pageNumber);
        const latest = stateRef.current;
        if (isCurrent() && latest.status === 'ready') {
          applyState({
            status: 'ready',
            data: appendTasteProfilePage(latest.data, page, pageNumber),
            loadingMore: false,
            loadMoreFailed: false,
          });
        }
      } catch (error) {
        console.warn('[useTasteProfileLists] load more failed', error);
        const latest = stateRef.current;
        if (isCurrent() && latest.status === 'ready') {
          applyState({ ...latest, loadingMore: false, loadMoreFailed: true });
        }
      }
    })();
  }, [applyState, fetchPage, startRequest]);

  return { state, reset, reload, refetch, loadMore };
}

/**
 * The signed-in listener's Taste Profile and Hidden From Taste Profile lists. State lives only in
 * this hook and reloads whenever the account or its Taste Profile consent changes, so a
 * sign-out or account switch never shows the previous account's rows. A token refresh does not
 * reload: requests read the latest auth values through a ref.
 */
export function useTasteProfileLists(): UseTasteProfileListsResult {
  const { accessToken, account, clearSession, refreshToken, setTokens } = useAuth();
  const authRef = useRef<AuthRequestDeps>({ accessToken, clearSession, refreshToken, setTokens });
  // Declared before the reload effect so a reload in the same commit sends the new token.
  useEffect(() => {
    authRef.current = { accessToken, clearSession, refreshToken, setTokens };
  }, [accessToken, clearSession, refreshToken, setTokens]);
  const generationRef = useRef(0);

  const fetchProfilePage = useCallback(
    (page: number): Promise<TasteProfilePage<DTOAccountTasteProfileRow>> =>
      requestWithMobileAuthRefresh(authRef.current, (api) =>
        api.reqAccountTasteProfile({ page, limit: TASTE_PROFILE_PAGE_LIMIT })
      ),
    []
  );

  const fetchHiddenPage = useCallback(
    (page: number): Promise<TasteProfilePage<DTOAccountTasteProfileHiddenRow>> =>
      requestWithMobileAuthRefresh(authRef.current, (api) =>
        api.reqAccountTasteProfileHidden({ page, limit: TASTE_PROFILE_PAGE_LIMIT })
      ),
    []
  );

  const {
    state: profile,
    reset: resetProfile,
    reload: reloadProfile,
    refetch: refetchProfile,
    loadMore: loadMoreProfile,
  } = useTasteProfileList(fetchProfilePage, generationRef);
  const {
    state: hidden,
    reset: resetHidden,
    reload: reloadHidden,
    refetch: refetchHidden,
    loadMore: loadMoreHidden,
  } = useTasteProfileList(fetchHiddenPage, generationRef);
  const [pendingChannelIds, setPendingChannelIds] = useState<ReadonlySet<string>>(
    () => new Set<string>()
  );
  const pendingRef = useRef<ReadonlySet<string>>(pendingChannelIds);
  const [actionFailed, setActionFailed] = useState(false);
  const [retryCount, setRetryCount] = useState(0);

  const updatePending = useCallback(
    (update: (current: ReadonlySet<string>) => ReadonlySet<string>) => {
      const next = update(pendingRef.current);
      pendingRef.current = next;
      setPendingChannelIds(next);
    },
    []
  );

  const settings = account?.account_settings;
  const reloadKey =
    account === null
      ? null
      : `${account.id_text}|${settings?.listen_stats_accepted}|${settings?.listen_stats_agreement_version}`;

  useEffect(() => {
    updatePending(() => new Set<string>());
    setActionFailed(false);
    if (reloadKey === null) {
      resetProfile();
      resetHidden();
    } else {
      reloadProfile();
      reloadHidden();
    }
    return () => {
      generationRef.current += 1;
    };
  }, [
    reloadKey,
    retryCount,
    reloadHidden,
    reloadProfile,
    resetHidden,
    resetProfile,
    updatePending,
  ]);

  const retry = useCallback(() => {
    setRetryCount((count) => count + 1);
  }, []);

  const runAction = useCallback(
    async (channelIdText: string, request: () => Promise<unknown>) => {
      if (pendingRef.current.has(channelIdText)) {
        return;
      }
      const generation = generationRef.current;
      updatePending((current) => new Set([...current, channelIdText]));
      setActionFailed(false);
      try {
        await request();
      } catch (error) {
        console.warn('[useTasteProfileLists] action failed', error);
        if (generation === generationRef.current) {
          setActionFailed(true);
        }
      } finally {
        if (generation === generationRef.current) {
          updatePending((current) => {
            const next = new Set(current);
            next.delete(channelIdText);
            return next;
          });
          refetchProfile();
          refetchHidden();
        }
      }
    },
    [refetchHidden, refetchProfile, updatePending]
  );

  const hideShow = useCallback(
    (channelIdText: string) =>
      runAction(channelIdText, () =>
        requestWithMobileAuthRefresh(authRef.current, (api) =>
          api.reqAccountTasteProfileHide({ channel_id_text: channelIdText })
        )
      ),
    [runAction]
  );

  const unhideShow = useCallback(
    (channelIdText: string, addToTasteProfile: boolean) =>
      runAction(channelIdText, () =>
        requestWithMobileAuthRefresh(authRef.current, (api) =>
          api.reqAccountTasteProfileUnhide({
            channel_id_text: channelIdText,
            add_to_taste_profile: addToTasteProfile,
          })
        )
      ),
    [runAction]
  );

  return {
    profile,
    hidden,
    pendingChannelIds,
    actionFailed,
    retry,
    loadMoreProfile,
    loadMoreHidden,
    hideShow,
    unhideShow,
  };
}
