'use client';

import type { ReactNode } from 'react';

import type { DTOItem } from '@podverse/helpers';
import type { QueryParamsGetManyPartialMusic } from '@podverse/helpers-requests';
import { MainColumnStack, MainSidebarLayout } from '@podverse/ui';

import { MainWrapper } from '../../../components/Main/MainWrapper';
import type { MediaListScope } from '../../../utils/mediaListChips';
import { TracksPageContextProvider } from './TracksPageContext';
import { TracksPageHeader } from './TracksPageHeader';
import { TracksPageList } from './TracksPageList';

type TracksPageClientProps = {
  chipsNode: ReactNode;
  initialQueryParams: QueryParamsGetManyPartialMusic;
  scope: MediaListScope;
  ssrItems: DTOItem[];
  ssrTotalPages: number;
};

export type TracksListProps = Omit<TracksPageClientProps, 'chipsNode'>;

export function TracksPageClient(props: TracksPageClientProps) {
  const { chipsNode, initialQueryParams, scope, ssrItems, ssrTotalPages } = props;

  return (
    <TracksPageContextProvider
      initialQueryParams={initialQueryParams}
      scope={scope}
      ssrItems={ssrItems}
      ssrTotalPages={ssrTotalPages}
    >
      <TracksPageHeader />
      <MainWrapper>
        <MainSidebarLayout>
          <MainColumnStack>
            {chipsNode}
            <TracksPageList />
          </MainColumnStack>
        </MainSidebarLayout>
      </MainWrapper>
    </TracksPageContextProvider>
  );
}
