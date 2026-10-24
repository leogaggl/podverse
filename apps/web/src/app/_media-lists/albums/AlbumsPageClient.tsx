'use client';

import type { DTOChannel } from '@podverse/helpers';
import type { QueryParamsGetManyMusic } from '@podverse/helpers-requests';
import { MainColumnStack, MainSidebarLayout } from '@podverse/ui';

import { MainWrapper } from '../../../components/Main/MainWrapper';
import type { MediaListChipsConfig } from '../../../components/MediaListChips/MediaListChips';
import type { MediaListScope } from '../../../utils/mediaListChips';
import { MediaListPageHeader } from '../MediaListPageHeader';
import { AlbumsPageChipRow } from './AlbumsPageChipRow';
import { AlbumsPageContextProvider } from './AlbumsPageContext';
import { AlbumsPageList } from './AlbumsPageList';

type AlbumsPageClientProps = {
  chipsConfig: MediaListChipsConfig;
  initialQueryParams: QueryParamsGetManyMusic;
  scope: MediaListScope;
  ssrChannels: DTOChannel[];
  ssrTotalPages: number;
};

export type AlbumsListProps = Omit<AlbumsPageClientProps, 'chipsConfig'>;

export function AlbumsPageClient(props: AlbumsPageClientProps) {
  const { chipsConfig, initialQueryParams, scope, ssrChannels, ssrTotalPages } = props;

  return (
    <AlbumsPageContextProvider
      initialQueryParams={initialQueryParams}
      scope={scope}
      ssrChannels={ssrChannels}
      ssrTotalPages={ssrTotalPages}
    >
      <MediaListPageHeader scope={scope} />
      <MainWrapper>
        <MainSidebarLayout>
          <MainColumnStack>
            <AlbumsPageChipRow chipsConfig={chipsConfig} />
            <AlbumsPageList />
          </MainColumnStack>
        </MainSidebarLayout>
      </MainWrapper>
    </AlbumsPageContextProvider>
  );
}
