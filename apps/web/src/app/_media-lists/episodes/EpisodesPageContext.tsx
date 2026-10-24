'use client';

import { useRouter } from 'next/navigation';
import type { ReactNode } from 'react';
import { createContext, useContext, useState } from 'react';

import type { DTOItem } from '@podverse/helpers';
import { getTotalPages, removeQueryParamByPattern } from '@podverse/helpers';
import type { QueryParamsGetManyPartial } from '@podverse/helpers-requests';

import { useAccount } from '../../../contexts/Account';
import { getApiRequestService } from '../../../factories/apiRequestService';
import { useFilterDefaults } from '../../../hooks/useFilterDefaults';
import { useListPageCache } from '../../../hooks/useListPageCache';
import { useSkipInitialEffect } from '../../../hooks/useSkipInitialEffect';
import type { MediaListScope } from '../../../utils/mediaListChips';
import { getEpisodesPageFilterParams } from './EpisodesPageDropdownConfig';

interface EpisodesPageContextType {
  scope: MediaListScope;
  filterParams: QueryParamsGetManyPartial;
  setFilterParams: (params: QueryParamsGetManyPartial) => void;
  items: DTOItem[];
  setItems: (items: DTOItem[]) => void;
  totalPages: number;
  setTotalPages: (totalPages: number) => void;
  isLoading: boolean;
  setIsLoading: (isLoading: boolean) => void;
  showSubscribeMessage: boolean;
  setShowSubscribeMessage: (show: boolean) => void;
  isCategoryListOpen: boolean;
  setIsCategoryListOpen: (open: boolean) => void;
}

const EpisodesPageContext = createContext<EpisodesPageContextType | undefined>(undefined);

interface EpisodesPageContextProviderProps {
  children: ReactNode;
  initialQueryParams: QueryParamsGetManyPartial;
  scope: MediaListScope;
  ssrItems: DTOItem[];
  ssrTotalPages: number;
}

export const EpisodesPageContextProvider = ({
  children,
  initialQueryParams,
  scope,
  ssrItems,
  ssrTotalPages,
}: EpisodesPageContextProviderProps) => {
  const router = useRouter();

  const {
    filterParams,
    setFilterParams,
    data: items,
    setData: setItems,
    totalPages,
    setTotalPages,
    shouldSkipFetch,
  } = useListPageCache<QueryParamsGetManyPartial, DTOItem[]>({
    routeKey: `${scope}-episodes`,
    initialParams: initialQueryParams,
    ssrData: ssrItems ?? [],
    ssrTotalPages,
  });

  const { loggedInAccount } = useAccount();
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [showSubscribeMessage, setShowSubscribeMessage] = useState<boolean>(
    scope === 'subscribed' && loggedInAccount === null
  );
  const [isCategoryListOpen, setIsCategoryListOpen] = useState<boolean>(false);
  const medium = 'av';

  useFilterDefaults(scope === 'subscribed' ? 'subscribed-episodes' : 'episodes', filterParams);

  useSkipInitialEffect(() => {
    // Skip the fetch when the list was just restored from cache. That data is already current.
    if (shouldSkipFetch.current) {
      shouldSkipFetch.current = false;
      return;
    }

    async function fetchItems() {
      if (filterParams.type === 'subscribed') {
        if (!loggedInAccount) {
          setItems([]);
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

      const response = await getApiRequestService().reqItemGetMany({
        page: filterParams.page,
        medium,
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
      setItems(response.data);
      setShowSubscribeMessage(false);
      setIsLoading(false);
    }
    fetchItems();
  }, [filterParams, loggedInAccount, scope]);

  return (
    <EpisodesPageContext.Provider
      value={{
        scope,
        filterParams,
        setFilterParams,
        items,
        setItems,
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
    </EpisodesPageContext.Provider>
  );
};

export const useEpisodesPageContext = () => {
  const ctx = useContext(EpisodesPageContext);
  if (!ctx) {
    throw new Error('useEpisodesPageContext must be used within a EpisodesPageContextProvider');
  }
  return ctx;
};
