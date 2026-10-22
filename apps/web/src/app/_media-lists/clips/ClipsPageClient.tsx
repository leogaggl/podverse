'use client';

import type { ReactNode } from 'react';

import type { DTOClip } from '@podverse/helpers';
import type { QueryParamsGetManyPartial } from '@podverse/helpers-requests';
import { MainColumnStack, MainSidebarLayout } from '@podverse/ui';

import { MainWrapper } from '../../../components/Main/MainWrapper';
import type { MediaListScope } from '../../../utils/mediaListChips';
import { ClipsPageContextProvider } from './ClipsPageContext';
import { ClipsPageHeader } from './ClipsPageHeader';
import { ClipsPageList } from './ClipsPageList';

type ClipsPageClientProps = {
  chipsNode: ReactNode;
  initialQueryParams: QueryParamsGetManyPartial;
  scope: MediaListScope;
  ssrClips: DTOClip[];
  ssrTotalPages: number;
};

export type ClipsListProps = Omit<ClipsPageClientProps, 'chipsNode'>;

export function ClipsPageClient(props: ClipsPageClientProps) {
  const { chipsNode, initialQueryParams, scope, ssrClips, ssrTotalPages } = props;

  return (
    <ClipsPageContextProvider
      initialQueryParams={initialQueryParams}
      scope={scope}
      ssrClips={ssrClips}
      ssrTotalPages={ssrTotalPages}
    >
      <ClipsPageHeader />
      <MainWrapper>
        <MainSidebarLayout>
          <MainColumnStack>
            {chipsNode}
            <ClipsPageList />
          </MainColumnStack>
        </MainSidebarLayout>
      </MainWrapper>
    </ClipsPageContextProvider>
  );
}
