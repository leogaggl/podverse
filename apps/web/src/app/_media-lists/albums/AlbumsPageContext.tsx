'use client';

import type { ReactNode } from 'react';
import { createContext, useContext, useState } from 'react';

import type { DTOChannel } from '@podverse/helpers';
import { getTotalPages } from '@podverse/helpers';
import type { QueryParamsGetManyMusic } from '@podverse/helpers-requests';

import { useAccount } from '../../../contexts/Account';
import { getApiRequestService } from '../../../factories/apiRequestService';
import { useFilterDefaults } from '../../../hooks/useFilterDefaults';
import { useListPageCache } from '../../../hooks/useListPageCache';
import { useSkipInitialEffect } from '../../../hooks/useSkipInitialEffect';
import type { MediaListScope } from '../../../utils/mediaListChips';
import { getAlbumsPageFilterParams } from './AlbumsPageDropdownConfig';

interface AlbumsPageContextType {
  scope: MediaListScope;
  filterParams: QueryParamsGetManyMusic;
  setFilterParams: (params: QueryParamsGetManyMusic) => void;
  channels: DTOChannel[];
  setChannels: (channels: DTOChannel[]) => void;
  totalPages: number;
  setTotalPages: (totalPages: number) => void;
  isLoading: boolean;
  setIsLoading: (isLoading: boolean) => void;
  showSubscribeMessage: boolean;
  setShowSubscribeMessage: (show: boolean) => void;
}

const AlbumsPageContext = createContext<AlbumsPageContextType | undefined>(undefined);

interface AlbumsPageContextProviderProps {
  children: ReactNode;
  initialQueryParams: QueryParamsGetManyMusic;
  scope: MediaListScope;
  ssrChannels: DTOChannel[];
  ssrTotalPages: number;
}

export const AlbumsPageContextProvider = ({
  children,
  initialQueryParams,
  scope,
  ssrChannels,
  ssrTotalPages,
}: AlbumsPageContextProviderProps) => {
  const {
    filterParams,
    setFilterParams,
    data: channels,
    setData: setChannels,
    totalPages,
    setTotalPages,
    shouldSkipFetch,
  } = useListPageCache<QueryParamsGetManyMusic, DTOChannel[]>({
    routeKey: `${scope}-albums`,
    initialParams: initialQueryParams,
    ssrData: ssrChannels ?? [],
    ssrTotalPages,
  });

  const { loggedInAccount } = useAccount();
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [showSubscribeMessage, setShowSubscribeMessage] = useState<boolean>(
    scope === 'subscribed' && loggedInAccount === null
  );

  useFilterDefaults(scope === 'subscribed' ? 'subscribed-albums' : 'albums', filterParams);

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

      const { currentSort, currentRange, currentType } = getAlbumsPageFilterParams(
        {
          page: filterParams.page,
          type: filterParams.type,
          sort: filterParams.sort,
          range: filterParams.range,
        },
        !!loggedInAccount,
        scope
      );

      const response = await getApiRequestService().reqChannelGetMany({
        page: filterParams.page,
        medium: 'music',
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
      setChannels(response.data);
      setShowSubscribeMessage(false);
      setIsLoading(false);
    }
    fetchChannels();
  }, [filterParams, loggedInAccount, scope]);

  return (
    <AlbumsPageContext.Provider
      value={{
        scope,
        filterParams,
        setFilterParams,
        channels,
        setChannels,
        totalPages,
        setTotalPages,
        isLoading,
        setIsLoading,
        showSubscribeMessage,
        setShowSubscribeMessage,
      }}
    >
      {children}
    </AlbumsPageContext.Provider>
  );
};

export const useAlbumsPageContext = () => {
  const ctx = useContext(AlbumsPageContext);
  if (!ctx) {
    throw new Error('useAlbumsPageContext must be used within a AlbumsPageContextProvider');
  }
  return ctx;
};
