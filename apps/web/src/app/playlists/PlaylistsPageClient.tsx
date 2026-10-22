'use client';

import type { ReactNode } from 'react';

import type { DTOPlaylist } from '@podverse/helpers';
import type { QueryParamsPlaylists } from '@podverse/helpers-requests';
import { MainColumnStack, MainSidebarLayout } from '@podverse/ui';

import { MainWrapper } from '../../components/Main/MainWrapper';
import { PlaylistsPageContextProvider } from './PlaylistsPageContext';
import { PlaylistsPageHeader } from './PlaylistsPageHeader';
import { PlaylistsPageList } from './PlaylistsPageList';
import { PlaylistsPageListHeader } from './PlaylistsPageListHeader';

interface PlaylistsPageClientProps {
  chipsNode?: ReactNode;
  initialQueryParams: QueryParamsPlaylists;
  listScope?: 'page' | 'browse';
  ssrPlaylists: DTOPlaylist[];
  ssrTotalPages: number;
}

export type PlaylistsListProps = Omit<PlaylistsPageClientProps, 'chipsNode'>;

export function PlaylistsPageClient(props: PlaylistsPageClientProps) {
  const {
    chipsNode = null,
    initialQueryParams,
    listScope = 'page',
    ssrPlaylists,
    ssrTotalPages,
  } = props;

  return (
    <PlaylistsPageContextProvider
      initialQueryParams={initialQueryParams}
      listScope={listScope}
      ssrPlaylists={ssrPlaylists}
      ssrTotalPages={ssrTotalPages}
    >
      <PlaylistsPageHeader />
      <MainWrapper>
        <MainSidebarLayout>
          <MainColumnStack>
            {chipsNode}
            <PlaylistsPageListHeader />
            <PlaylistsPageList />
          </MainColumnStack>
        </MainSidebarLayout>
      </MainWrapper>
    </PlaylistsPageContextProvider>
  );
}
