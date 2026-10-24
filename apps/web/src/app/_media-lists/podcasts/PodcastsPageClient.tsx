'use client';

import type { DTOChannel } from '@podverse/helpers';
import type { QueryParamsGetMany } from '@podverse/helpers-requests';
import { MainColumnStack, MainSidebarLayout } from '@podverse/ui';

import { MainWrapper } from '../../../components/Main/MainWrapper';
import type { MediaListChipsConfig } from '../../../components/MediaListChips/MediaListChips';
import type { MediaListScope } from '../../../utils/mediaListChips';
import { MediaListPageHeader } from '../MediaListPageHeader';
import { PodcastsPageChipRow } from './PodcastsPageChipRow';
import { PodcastsPageContextProvider } from './PodcastsPageContext';
import { PodcastsPageList } from './PodcastsPageList';

type PodcastsPageClientProps = {
  chipsConfig: MediaListChipsConfig;
  initialFilterTerm: string;
  initialQueryParams: QueryParamsGetMany;
  scope: MediaListScope;
  ssrChannels: DTOChannel[];
  ssrTotalPages: number;
};

export type PodcastsListProps = Omit<PodcastsPageClientProps, 'chipsConfig'>;

export function PodcastsPageClient(props: PodcastsPageClientProps) {
  const { chipsConfig, initialFilterTerm, initialQueryParams, scope, ssrChannels, ssrTotalPages } =
    props;

  return (
    <PodcastsPageContextProvider
      initialFilterTerm={initialFilterTerm}
      initialQueryParams={initialQueryParams}
      scope={scope}
      ssrChannels={ssrChannels}
      ssrTotalPages={ssrTotalPages}
    >
      <MediaListPageHeader scope={scope} />
      <MainWrapper>
        <MainSidebarLayout>
          <MainColumnStack>
            <PodcastsPageChipRow chipsConfig={chipsConfig} />
            <PodcastsPageList />
          </MainColumnStack>
        </MainSidebarLayout>
      </MainWrapper>
    </PodcastsPageContextProvider>
  );
}
