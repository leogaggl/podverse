'use client';

import type { ReactNode } from 'react';
import { createContext, useContext, useState } from 'react';

import type { DTOItem } from '@podverse/helpers';
import { getTotalPages } from '@podverse/helpers';

import { useAccount } from '../../../contexts/Account';
import { getApiRequestService } from '../../../factories/apiRequestService';
import { useListPageCache } from '../../../hooks/useListPageCache';
import { useSkipInitialEffect } from '../../../hooks/useSkipInitialEffect';
import type { MediaListScope } from '../../../utils/mediaListChips';

type LivestreamsListParams = { page: number };

interface LivestreamsPageContextType {
  scope: MediaListScope;
  filterParams: LivestreamsListParams;
  setFilterParams: (params: LivestreamsListParams) => void;
  items: DTOItem[];
  totalPages: number;
  isLoading: boolean;
}

const LivestreamsPageContext = createContext<LivestreamsPageContextType | undefined>(undefined);

interface LivestreamsPageContextProviderProps {
  children: ReactNode;
  initialPage: number;
  scope: MediaListScope;
  ssrItems: DTOItem[];
  ssrTotalPages: number;
}

export const LivestreamsPageContextProvider = ({
  children,
  initialPage,
  scope,
  ssrItems,
  ssrTotalPages,
}: LivestreamsPageContextProviderProps) => {
  const {
    filterParams,
    setFilterParams,
    data: items,
    setData: setItems,
    totalPages,
    setTotalPages,
    shouldSkipFetch,
  } = useListPageCache<LivestreamsListParams, DTOItem[]>({
    routeKey: `${scope}-livestreams`,
    initialParams: { page: initialPage },
    ssrData: ssrItems ?? [],
    ssrTotalPages,
  });

  const { loggedInAccount } = useAccount();
  const [isLoading, setIsLoading] = useState<boolean>(false);

  useSkipInitialEffect(() => {
    // Skip the fetch when the list was just restored from cache. That data is already current.
    if (shouldSkipFetch.current) {
      shouldSkipFetch.current = false;
      return;
    }

    async function fetchItems() {
      if (scope === 'subscribed' && !loggedInAccount) {
        setItems([]);
        setTotalPages(1);
        return;
      }

      setIsLoading(true);
      try {
        const response = await getApiRequestService().reqLiveItemGetManyUpcoming({
          type: scope === 'browse' ? 'global' : 'subscribed',
          medium: 'all',
          page: filterParams.page,
        });
        setTotalPages(
          getTotalPages(
            response.meta.count,
            response.meta.limit,
            response.data.length,
            filterParams.page
          )
        );
        setItems(response.data);
      } finally {
        setIsLoading(false);
      }
    }
    fetchItems();
  }, [filterParams, loggedInAccount, scope]);

  return (
    <LivestreamsPageContext.Provider
      value={{
        scope,
        filterParams,
        setFilterParams,
        items,
        totalPages,
        isLoading,
      }}
    >
      {children}
    </LivestreamsPageContext.Provider>
  );
};

export const useLivestreamsPageContext = () => {
  const ctx = useContext(LivestreamsPageContext);
  if (!ctx) {
    throw new Error(
      'useLivestreamsPageContext must be used within a LivestreamsPageContextProvider'
    );
  }
  return ctx;
};
