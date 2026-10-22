'use client';

import type { ReactNode } from 'react';

import type { DTOChannel } from '@podverse/helpers';
import type { QueryParamsGetManyMusic } from '@podverse/helpers-requests';
import { MainColumnStack, MainSidebarLayout } from '@podverse/ui';

import { MainWrapper } from '../../../components/Main/MainWrapper';
import type { MediaListScope } from '../../../utils/mediaListChips';
import { AlbumsPageContextProvider } from './AlbumsPageContext';
import { AlbumsPageHeader } from './AlbumsPageHeader';
import { AlbumsPageList } from './AlbumsPageList';

type AlbumsPageClientProps = {
  chipsNode: ReactNode;
  initialQueryParams: QueryParamsGetManyMusic;
  scope: MediaListScope;
  ssrChannels: DTOChannel[];
  ssrTotalPages: number;
};

export type AlbumsListProps = Omit<AlbumsPageClientProps, 'chipsNode'>;

export function AlbumsPageClient(props: AlbumsPageClientProps) {
  const { chipsNode, initialQueryParams, scope, ssrChannels, ssrTotalPages } = props;

  return (
    <AlbumsPageContextProvider
      initialQueryParams={initialQueryParams}
      scope={scope}
      ssrChannels={ssrChannels}
      ssrTotalPages={ssrTotalPages}
    >
      <AlbumsPageHeader />
      <MainWrapper>
        <MainSidebarLayout>
          <MainColumnStack>
            {chipsNode}
            <AlbumsPageList />
          </MainColumnStack>
        </MainSidebarLayout>
      </MainWrapper>
    </AlbumsPageContextProvider>
  );
}
