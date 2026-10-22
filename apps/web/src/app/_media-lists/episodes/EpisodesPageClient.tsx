'use client';

import type { ReactNode } from 'react';

import type { DTOItem } from '@podverse/helpers';
import type { QueryParamsGetManyPartial } from '@podverse/helpers-requests';
import { MainColumnStack, MainSidebarLayout } from '@podverse/ui';

import { MainWrapper } from '../../../components/Main/MainWrapper';
import type { MediaListScope } from '../../../utils/mediaListChips';
import { EpisodesPageContextProvider } from './EpisodesPageContext';
import { EpisodesPageHeader } from './EpisodesPageHeader';
import { EpisodesPageList } from './EpisodesPageList';

type EpisodesPageClientProps = {
  chipsNode: ReactNode;
  initialQueryParams: QueryParamsGetManyPartial;
  scope: MediaListScope;
  ssrItems: DTOItem[];
  ssrTotalPages: number;
};

export type EpisodesListProps = Omit<EpisodesPageClientProps, 'chipsNode'>;

export function EpisodesPageClient(props: EpisodesPageClientProps) {
  const { chipsNode, initialQueryParams, scope, ssrItems, ssrTotalPages } = props;

  return (
    <EpisodesPageContextProvider
      initialQueryParams={initialQueryParams}
      scope={scope}
      ssrItems={ssrItems}
      ssrTotalPages={ssrTotalPages}
    >
      <EpisodesPageHeader />
      <MainWrapper>
        <MainSidebarLayout>
          <MainColumnStack>
            {chipsNode}
            <EpisodesPageList />
          </MainColumnStack>
        </MainSidebarLayout>
      </MainWrapper>
    </EpisodesPageContextProvider>
  );
}
