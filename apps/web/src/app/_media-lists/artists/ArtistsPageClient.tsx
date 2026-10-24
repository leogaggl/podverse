'use client';

import type { DTOChannel } from '@podverse/helpers';
import type { QueryParamsGetManyMusic } from '@podverse/helpers-requests';
import { MainColumnStack, MainSidebarLayout } from '@podverse/ui';

import { MainWrapper } from '../../../components/Main/MainWrapper';
import type { MediaListChipsConfig } from '../../../components/MediaListChips/MediaListChips';
import type { MediaListScope } from '../../../utils/mediaListChips';
import { MediaListPageHeader } from '../MediaListPageHeader';
import { ArtistsPageChipRow } from './ArtistsPageChipRow';
import { ArtistsPageContextProvider } from './ArtistsPageContext';
import { ArtistsPageList } from './ArtistsPageList';

type ArtistsPageClientProps = {
  chipsConfig: MediaListChipsConfig;
  initialQueryParams: QueryParamsGetManyMusic;
  scope: MediaListScope;
  ssrChannels: DTOChannel[];
  ssrTotalPages: number;
};

export type ArtistsListProps = Omit<ArtistsPageClientProps, 'chipsConfig'>;

export function ArtistsPageClient(props: ArtistsPageClientProps) {
  const { chipsConfig, initialQueryParams, scope, ssrChannels, ssrTotalPages } = props;

  return (
    <ArtistsPageContextProvider
      initialQueryParams={initialQueryParams}
      scope={scope}
      ssrChannels={ssrChannels}
      ssrTotalPages={ssrTotalPages}
    >
      <MediaListPageHeader scope={scope} />
      <MainWrapper>
        <MainSidebarLayout>
          <MainColumnStack>
            <ArtistsPageChipRow chipsConfig={chipsConfig} />
            <ArtistsPageList />
          </MainColumnStack>
        </MainSidebarLayout>
      </MainWrapper>
    </ArtistsPageContextProvider>
  );
}
