'use client';

import type { DTOItem } from '@podverse/helpers';
import { MainColumnStack, MainSidebarLayout } from '@podverse/ui';

import { MainWrapper } from '../../../components/Main/MainWrapper';
import type { MediaListChipsConfig } from '../../../components/MediaListChips/MediaListChips';
import { MediaListChips } from '../../../components/MediaListChips/MediaListChips';
import type { MediaListScope } from '../../../utils/mediaListChips';
import { MediaListPageHeader } from '../MediaListPageHeader';
import { LivestreamsPageContextProvider } from './LivestreamsPageContext';
import { LivestreamsPageList } from './LivestreamsPageList';

type LivestreamsPageClientProps = {
  scope: MediaListScope;
  chipsConfig: MediaListChipsConfig;
  initialPage: number;
  ssrItems: DTOItem[];
  ssrTotalPages: number;
};

export type LivestreamsListProps = Omit<LivestreamsPageClientProps, 'chipsConfig'>;

export function LivestreamsPageClient(props: LivestreamsPageClientProps) {
  const { chipsConfig, initialPage, scope, ssrItems, ssrTotalPages } = props;

  return (
    <LivestreamsPageContextProvider
      initialPage={initialPage}
      scope={scope}
      ssrItems={ssrItems}
      ssrTotalPages={ssrTotalPages}
    >
      <MediaListPageHeader scope={scope} />
      <MainWrapper>
        <MainSidebarLayout>
          <MainColumnStack>
            <MediaListChips {...chipsConfig} />
            <LivestreamsPageList />
          </MainColumnStack>
        </MainSidebarLayout>
      </MainWrapper>
    </LivestreamsPageContextProvider>
  );
}
