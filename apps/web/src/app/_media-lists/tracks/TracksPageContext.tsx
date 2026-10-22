'use client';

import type { ReactNode } from 'react';
import { createContext, useContext, useState } from 'react';

import type { DTOItem } from '@podverse/helpers';
import { getTotalPages } from '@podverse/helpers';
import type { QueryParamsGetManyPartialMusic } from '@podverse/helpers-requests';

import { useAccount } from '../../../contexts/Account';
import { getApiRequestService } from '../../../factories/apiRequestService';
import { useFilterDefaults } from '../../../hooks/useFilterDefaults';
import { useListPageCache } from '../../../hooks/useListPageCache';
import { useSkipInitialEffect } from '../../../hooks/useSkipInitialEffect';
import type { MediaListScope } from '../../../utils/mediaListChips';
import { getTracksPageFilterParams } from './TracksPageDropdownConfig';

interface TracksPageContextType {
  scope: MediaListScope;
  filterParams: QueryParamsGetManyPartialMusic;
  setFilterParams: (params: QueryParamsGetManyPartialMusic) => void;
  items: DTOItem[];
  setItems: (items: DTOItem[]) => void;
  totalPages: number;
  setTotalPages: (totalPages: number) => void;
  isLoading: boolean;
  setIsLoading: (isLoading: boolean) => void;
  showSubscribeMessage: boolean;
  setShowSubscribeMessage: (show: boolean) => void;
}

const TracksPageContext = createContext<TracksPageContextType | undefined>(undefined);

interface TracksPageContextProviderProps {
  children: ReactNode;
  initialQueryParams: QueryParamsGetManyPartialMusic;
  scope: MediaListScope;
  ssrItems: DTOItem[];
  ssrTotalPages: number;
}

export const TracksPageContextProvider = ({
  children,
  initialQueryParams,
  scope,
  ssrItems,
  ssrTotalPages,
}: TracksPageContextProviderProps) => {
  const {
    filterParams,
    setFilterParams,
    data: items,
    setData: setItems,
    totalPages,
    setTotalPages,
    shouldSkipFetch,
  } = useListPageCache<QueryParamsGetManyPartialMusic, DTOItem[]>({
    routeKey: `${scope}-tracks`,
    initialParams: initialQueryParams,
    ssrData: ssrItems ?? [],
    ssrTotalPages,
  });

  const { loggedInAccount } = useAccount();
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [showSubscribeMessage, setShowSubscribeMessage] = useState<boolean>(
    scope === 'subscribed' && loggedInAccount === null
  );
  const apiRequestService = getApiRequestService();
  const medium = 'music';

  useFilterDefaults(scope === 'subscribed' ? 'subscribed-tracks' : 'tracks', filterParams);

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

      const { currentSort, currentRange, currentType } = getTracksPageFilterParams(
        {
          page: filterParams.page,
          type: filterParams.type,
          sort: filterParams.sort,
          range: filterParams.range,
        },
        !!loggedInAccount,
        scope
      );

      const response = await apiRequestService.reqItemGetMany({
        page: filterParams.page,
        medium,
        type: currentType,
        sort: currentSort,
        range: currentRange,
        category: null,
      });

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
    <TracksPageContext.Provider
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
      }}
    >
      {children}
    </TracksPageContext.Provider>
  );
};

export const useTracksPageContext = () => {
  const ctx = useContext(TracksPageContext);
  if (!ctx) {
    throw new Error('useTracksPageContext must be used within a TracksPageContextProvider');
  }
  return ctx;
};
