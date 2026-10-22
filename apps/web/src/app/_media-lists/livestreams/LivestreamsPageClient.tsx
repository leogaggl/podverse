'use client';

import type { ReactNode } from 'react';

import type { DTOItem } from '@podverse/helpers';
import { MainColumnStack, MainSidebarLayout } from '@podverse/ui';

import { MainWrapper } from '../../../components/Main/MainWrapper';
import type { MediaListScope } from '../../../utils/mediaListChips';
import { LivestreamsPageContextProvider } from './LivestreamsPageContext';
import { LivestreamsPageHeader } from './LivestreamsPageHeader';
import { LivestreamsPageList } from './LivestreamsPageList';

type LivestreamsPageClientProps = {
  scope: MediaListScope;
  chipsNode: ReactNode;
  initialPage: number;
  ssrItems: DTOItem[];
  ssrTotalPages: number;
};

export type LivestreamsListProps = Omit<LivestreamsPageClientProps, 'chipsNode'>;

export function LivestreamsPageClient(props: LivestreamsPageClientProps) {
  const { chipsNode, initialPage, scope, ssrItems, ssrTotalPages } = props;

  return (
    <LivestreamsPageContextProvider
      initialPage={initialPage}
      scope={scope}
      ssrItems={ssrItems}
      ssrTotalPages={ssrTotalPages}
    >
      <LivestreamsPageHeader />
      <MainWrapper>
        <MainSidebarLayout>
          <MainColumnStack>
            {chipsNode}
            <LivestreamsPageList />
          </MainColumnStack>
        </MainSidebarLayout>
      </MainWrapper>
    </LivestreamsPageContextProvider>
  );
}
