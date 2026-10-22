'use client';

import type { ReactNode } from 'react';
import { createContext, useContext, useEffect, useState } from 'react';

import type { DTOChannel } from '@podverse/helpers';
import { getTotalPages } from '@podverse/helpers';
import type { QueryParamsGetMany } from '@podverse/helpers-requests';

import { useAccount } from '../../../contexts/Account';
import { getApiRequestService } from '../../../factories/apiRequestService';
import { useFilterDefaults } from '../../../hooks/useFilterDefaults';
import { useListPageCache } from '../../../hooks/useListPageCache';
import { useSkipInitialEffect } from '../../../hooks/useSkipInitialEffect';
import type { MediaListScope } from '../../../utils/mediaListChips';
import { MEDIA_LIST_CHIP_BASE_PATHS } from '../../../utils/mediaListChips';
import { buildPodcastsPagePath, clampFilterTerm } from './podcastsFilter';
import { getPodcastsPageFilterParams } from './PodcastsPageDropdownConfig';

/** Long enough that a term stops changing before the address bar is rewritten. */
const URL_SYNC_DELAY_MS = 250;

interface PodcastsPageContextType {
  scope: MediaListScope;
  filterParams: QueryParamsGetMany;
  setFilterParams: (params: QueryParamsGetMany) => void;
  filterTerm: string;
  setFilterTerm: (term: string) => void;
  channels: DTOChannel[];
  setChannels: (channels: DTOChannel[]) => void;
  totalPages: number;
  setTotalPages: (totalPages: number) => void;
  isLoading: boolean;
  setIsLoading: (isLoading: boolean) => void;
  showSubscribeMessage: boolean;
  setShowSubscribeMessage: (show: boolean) => void;
  showCategoriesModal: boolean;
  setShowCategoriesModal: (show: boolean) => void;
}

const PodcastsPageContext = createContext<PodcastsPageContextType | undefined>(undefined);

interface PodcastsPageContextProviderProps {
  children: ReactNode;
  initialFilterTerm: string;
  initialQueryParams: QueryParamsGetMany;
  scope: MediaListScope;
  ssrChannels: DTOChannel[];
  ssrTotalPages: number;
}

export const PodcastsPageContextProvider = ({
  children,
  initialFilterTerm,
  initialQueryParams,
  scope,
  ssrChannels,
  ssrTotalPages,
}: PodcastsPageContextProviderProps) => {
  const {
    filterParams,
    setFilterParams,
    data: channels,
    setData: setChannels,
    totalPages,
    setTotalPages,
    shouldSkipFetch,
  } = useListPageCache<QueryParamsGetMany, DTOChannel[]>({
    routeKey: `${scope}-podcasts`,
    initialParams: initialQueryParams,
    ssrData: ssrChannels ?? [],
    ssrTotalPages,
  });

  const { loggedInAccount } = useAccount();
  const [filterTerm, setFilterTerm] = useState<string>(() => clampFilterTerm(initialFilterTerm));
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [showSubscribeMessage, setShowSubscribeMessage] = useState<boolean>(
    scope === 'subscribed' && loggedInAccount === null
  );
  const [showCategoriesModal, setShowCategoriesModal] = useState<boolean>(false);
  const medium = 'av';

  useFilterDefaults(scope === 'subscribed' ? 'subscribed-podcasts' : 'podcasts', filterParams);

  const trimmedFilterTerm = filterTerm.trim();
  const { category, range, sort, type } = filterParams;

  // The filter belongs to the subscribed list. Leaving a term behind when the user switches to a
  // global or category list would carry a hidden narrowing onto results it was never applied to.
  useEffect(() => {
    if (type !== 'subscribed' && filterTerm !== '') {
      setFilterTerm('');
    }
  }, [filterTerm, type]);

  /**
   * Keep the address bar describing what is on screen, so a filtered list can be linked and
   * survives a reload.
   *
   * `history.replaceState` rather than the router: this only needs the URL to say what the page is
   * already showing, and routing to it would send the server another request for a list the client
   * has in hand. The term is deliberately absent from the preference store — a filter restored on a
   * later visit hides most of a list for a reason the user cannot see.
   *
   * The URL a visit arrives on is left exactly as it was found. Rewriting on mount would edit a
   * hand-written or shared link before the user had done anything with it.
   */
  useSkipInitialEffect(() => {
    const timeout = setTimeout(() => {
      const path = buildPodcastsPagePath({
        basePath: MEDIA_LIST_CHIP_BASE_PATHS[scope === 'subscribed' ? 'subscribed' : 'browse'],
        category,
        filterTerm: trimmedFilterTerm,
        range,
        sort,
        type,
      });
      if (`${window.location.pathname}${window.location.search}` !== path) {
        window.history.replaceState(null, '', path);
      }
    }, URL_SYNC_DELAY_MS);

    return () => {
      clearTimeout(timeout);
    };
  }, [category, range, scope, sort, trimmedFilterTerm, type]);

  useSkipInitialEffect(() => {
    // Skip the fetch when the list was just restored from cache. That data is already current.
    if (shouldSkipFetch.current) {
      shouldSkipFetch.current = false;
      return;
    }

    async function fetchChannels() {
      if (filterParams.type === 'subscribed') {
        if (!loggedInAccount) {
          setChannels([]);
          setShowSubscribeMessage(true);
          return;
        }
      }

      setIsLoading(true);

      const { currentSort, currentRange, currentType, currentCategory } =
        getPodcastsPageFilterParams(
        {
          page: filterParams.page,
          type: filterParams.type,
          sort: filterParams.sort,
          range: filterParams.range,
          category: filterParams.category,
        },
        !!loggedInAccount,
        scope
      );

      const response = await getApiRequestService().reqChannelGetMany({
        page: filterParams.page,
        medium,
        type: currentType,
        sort: currentSort,
        range: currentRange,
        category: currentCategory,
      });

      const totalPages = getTotalPages(
        response.meta.count,
        response.meta.limit,
        response.data.length,
        filterParams.page
      );
      setTotalPages(totalPages);
      setChannels(response.data);
      setShowSubscribeMessage(false);
      setIsLoading(false);
    }
    fetchChannels();
  }, [filterParams, loggedInAccount, scope]);

  return (
    <PodcastsPageContext.Provider
      value={{
        scope,
        filterParams,
        setFilterParams,
        filterTerm,
        setFilterTerm,
        channels,
        setChannels,
        totalPages,
        setTotalPages,
        isLoading,
        setIsLoading,
        showSubscribeMessage,
        setShowSubscribeMessage,
        showCategoriesModal,
        setShowCategoriesModal,
      }}
    >
      {children}
    </PodcastsPageContext.Provider>
  );
};

export const usePodcastsPageContext = () => {
  const ctx = useContext(PodcastsPageContext);
  if (!ctx) {
    throw new Error('usePodcastsPageContext must be used within a PodcastsPageContextProvider');
  }
  return ctx;
};
