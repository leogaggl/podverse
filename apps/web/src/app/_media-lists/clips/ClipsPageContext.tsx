'use client';

import { useRouter } from 'next/navigation';
import type { ReactNode } from 'react';
import { createContext, useContext, useState } from 'react';

import type { DTOClip } from '@podverse/helpers';
import { getTotalPages, removeQueryParamByPattern } from '@podverse/helpers';
import type { QueryParamsGetManyPartial } from '@podverse/helpers-requests';

import { useAccount } from '../../../contexts/Account';
import { getApiRequestService } from '../../../factories/apiRequestService';
import { useFilterDefaults } from '../../../hooks/useFilterDefaults';
import { useListPageCache } from '../../../hooks/useListPageCache';
import { useSkipInitialEffect } from '../../../hooks/useSkipInitialEffect';
import type { MediaListScope } from '../../../utils/mediaListChips';
import { getEpisodesPageFilterParams } from '../episodes/EpisodesPageDropdownConfig';

interface ClipsPageContextType {
  scope: MediaListScope;
  filterParams: QueryParamsGetManyPartial;
  setFilterParams: (params: QueryParamsGetManyPartial) => void;
  clips: DTOClip[];
  setClips: (clips: DTOClip[]) => void;
  totalPages: number;
  setTotalPages: (totalPages: number) => void;
  isLoading: boolean;
  setIsLoading: (isLoading: boolean) => void;
  showSubscribeMessage: boolean;
  setShowSubscribeMessage: (show: boolean) => void;
  isCategoryListOpen: boolean;
  setIsCategoryListOpen: (open: boolean) => void;
}

const ClipsPageContext = createContext<ClipsPageContextType | undefined>(undefined);

interface ClipsPageContextProviderProps {
  children: ReactNode;
  initialQueryParams: QueryParamsGetManyPartial;
  scope: MediaListScope;
  ssrClips: DTOClip[];
  ssrTotalPages: number;
}

export const ClipsPageContextProvider = ({
  children,
  initialQueryParams,
  scope,
  ssrClips,
  ssrTotalPages,
}: ClipsPageContextProviderProps) => {
  const router = useRouter();

  const {
    filterParams,
    setFilterParams,
    data: clips,
    setData: setClips,
    totalPages,
    setTotalPages,
    shouldSkipFetch,
  } = useListPageCache<QueryParamsGetManyPartial, DTOClip[]>({
    routeKey: `${scope}-clips`,
    initialParams: initialQueryParams,
    ssrData: ssrClips ?? [],
    ssrTotalPages,
  });

  const { loggedInAccount } = useAccount();
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [showSubscribeMessage, setShowSubscribeMessage] = useState<boolean>(
    scope === 'subscribed' && loggedInAccount === null
  );
  const [isCategoryListOpen, setIsCategoryListOpen] = useState<boolean>(false);

  useFilterDefaults(scope === 'subscribed' ? 'subscribed-clips' : 'clips', filterParams);

  useSkipInitialEffect(() => {
    // Skip the fetch when the list was just restored from cache. That data is already current.
    if (shouldSkipFetch.current) {
      shouldSkipFetch.current = false;
      return;
    }

    async function fetchItems() {
      if (filterParams.type === 'subscribed') {
        if (!loggedInAccount) {
          setClips([]);
          setShowSubscribeMessage(true);
          return;
        }
      }

      setIsLoading(true);

      const { currentSort, currentRange, currentType } = getEpisodesPageFilterParams(
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

      const response = await getApiRequestService().reqClipGetManyPublic({
        page: filterParams.page,
        medium: 'av',
        type: currentType,
        sort: currentSort,
        range: currentRange,
        category: filterParams.category,
      });

      if (!filterParams.category && new URLSearchParams(window.location.search).has('category')) {
        router.replace(
          removeQueryParamByPattern(
            `${window.location.pathname}${window.location.search}`,
            'category'
          )
        );
      }

      const totalPages = getTotalPages(
        response.meta.count,
        response.meta.limit,
        response.data.length,
        filterParams.page
      );
      setTotalPages(totalPages);
      setClips(response.data);
      setShowSubscribeMessage(false);
      setIsLoading(false);
    }
    fetchItems();
  }, [filterParams, loggedInAccount, scope]);

  return (
    <ClipsPageContext.Provider
      value={{
        scope,
        filterParams,
        setFilterParams,
        clips,
        setClips,
        totalPages,
        setTotalPages,
        isLoading,
        setIsLoading,
        showSubscribeMessage,
        setShowSubscribeMessage,
        isCategoryListOpen,
        setIsCategoryListOpen,
      }}
    >
      {children}
    </ClipsPageContext.Provider>
  );
};

export const useClipsPageContext = () => {
  const ctx = useContext(ClipsPageContext);
  if (!ctx) {
    throw new Error('useClipsPageContext must be used within a ClipsPageContextProvider');
  }
  return ctx;
};
