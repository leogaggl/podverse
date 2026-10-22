'use client';

import type { ReactNode } from 'react';

import type { DTOChannel } from '@podverse/helpers';
import type { QueryParamsGetManyMusic } from '@podverse/helpers-requests';
import { MainColumnStack, MainSidebarLayout } from '@podverse/ui';

import { MainWrapper } from '../../../components/Main/MainWrapper';
import type { MediaListScope } from '../../../utils/mediaListChips';
import { ArtistsPageContextProvider } from './ArtistsPageContext';
import { ArtistsPageHeader } from './ArtistsPageHeader';
import { ArtistsPageList } from './ArtistsPageList';

type ArtistsPageClientProps = {
  chipsNode: ReactNode;
  initialQueryParams: QueryParamsGetManyMusic;
  scope: MediaListScope;
  ssrChannels: DTOChannel[];
  ssrTotalPages: number;
};

export type ArtistsListProps = Omit<ArtistsPageClientProps, 'chipsNode'>;

export function ArtistsPageClient(props: ArtistsPageClientProps) {
  const { chipsNode, initialQueryParams, scope, ssrChannels, ssrTotalPages } = props;

  return (
    <ArtistsPageContextProvider
      initialQueryParams={initialQueryParams}
      scope={scope}
      ssrChannels={ssrChannels}
      ssrTotalPages={ssrTotalPages}
    >
      <ArtistsPageHeader />
      <MainWrapper>
        <MainSidebarLayout>
          <MainColumnStack>
            {chipsNode}
            <ArtistsPageList />
          </MainColumnStack>
        </MainSidebarLayout>
      </MainWrapper>
    </ArtistsPageContextProvider>
  );
}
