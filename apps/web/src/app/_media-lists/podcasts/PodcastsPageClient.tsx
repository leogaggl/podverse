'use client';

import type { ReactNode } from 'react';

import type { DTOChannel } from '@podverse/helpers';
import type { QueryParamsGetMany } from '@podverse/helpers-requests';
import { MainColumnStack, MainSidebarLayout } from '@podverse/ui';

import { MainWrapper } from '../../../components/Main/MainWrapper';
import type { MediaListScope } from '../../../utils/mediaListChips';
import { PodcastsPageContextProvider } from './PodcastsPageContext';
import { PodcastsPageHeader } from './PodcastsPageHeader';
import { PodcastsPageList } from './PodcastsPageList';

type PodcastsPageClientProps = {
  chipsNode: ReactNode;
  initialFilterTerm: string;
  initialQueryParams: QueryParamsGetMany;
  scope: MediaListScope;
  ssrChannels: DTOChannel[];
  ssrTotalPages: number;
};

export type PodcastsListProps = Omit<PodcastsPageClientProps, 'chipsNode'>;

export function PodcastsPageClient(props: PodcastsPageClientProps) {
  const { chipsNode, initialFilterTerm, initialQueryParams, scope, ssrChannels, ssrTotalPages } =
    props;

  return (
    <PodcastsPageContextProvider
      initialFilterTerm={initialFilterTerm}
      initialQueryParams={initialQueryParams}
      scope={scope}
      ssrChannels={ssrChannels}
      ssrTotalPages={ssrTotalPages}
    >
      <PodcastsPageHeader />
      <MainWrapper>
        <MainSidebarLayout>
          <MainColumnStack>
            {chipsNode}
            <PodcastsPageList />
          </MainColumnStack>
        </MainSidebarLayout>
      </MainWrapper>
    </PodcastsPageContextProvider>
  );
}
