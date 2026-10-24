'use client';

import type { DTOPlaylist } from '@podverse/helpers';
import type { QueryParamsPlaylists } from '@podverse/helpers-requests';
import { MainColumnStack, MainSidebarLayout } from '@podverse/ui';

import { MainWrapper } from '../../components/Main/MainWrapper';
import type { MediaListChipsConfig } from '../../components/MediaListChips/MediaListChips';
import { PlaylistsPageChipRow } from './PlaylistsPageChipRow';
import { PlaylistsPageContextProvider } from './PlaylistsPageContext';
import { PlaylistsPageHeader } from './PlaylistsPageHeader';
import { PlaylistsPageList } from './PlaylistsPageList';

interface PlaylistsPageClientProps {
  chipsConfig?: MediaListChipsConfig;
  initialQueryParams: QueryParamsPlaylists;
  listScope?: 'page' | 'browse';
  ssrPlaylists: DTOPlaylist[];
  ssrTotalPages: number;
}

export type PlaylistsListProps = Omit<PlaylistsPageClientProps, 'chipsConfig'>;

export function PlaylistsPageClient(props: PlaylistsPageClientProps) {
  const {
    chipsConfig,
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
            <PlaylistsPageChipRow chipsConfig={chipsConfig} />
            <PlaylistsPageList />
          </MainColumnStack>
        </MainSidebarLayout>
      </MainWrapper>
    </PlaylistsPageContextProvider>
  );
}
