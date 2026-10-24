'use client';

import type { DTOItem } from '@podverse/helpers';
import type { QueryParamsGetManyPartial } from '@podverse/helpers-requests';
import { MainColumnStack, MainSidebarLayout } from '@podverse/ui';

import { MainWrapper } from '../../../components/Main/MainWrapper';
import type { MediaListChipsConfig } from '../../../components/MediaListChips/MediaListChips';
import type { MediaListScope } from '../../../utils/mediaListChips';
import { MediaListPageHeader } from '../MediaListPageHeader';
import { EpisodesPageChipRow } from './EpisodesPageChipRow';
import { EpisodesPageContextProvider } from './EpisodesPageContext';
import { EpisodesPageList } from './EpisodesPageList';

type EpisodesPageClientProps = {
  chipsConfig: MediaListChipsConfig;
  initialQueryParams: QueryParamsGetManyPartial;
  scope: MediaListScope;
  ssrItems: DTOItem[];
  ssrTotalPages: number;
};

export type EpisodesListProps = Omit<EpisodesPageClientProps, 'chipsConfig'>;

export function EpisodesPageClient(props: EpisodesPageClientProps) {
  const { chipsConfig, initialQueryParams, scope, ssrItems, ssrTotalPages } = props;

  return (
    <EpisodesPageContextProvider
      initialQueryParams={initialQueryParams}
      scope={scope}
      ssrItems={ssrItems}
      ssrTotalPages={ssrTotalPages}
    >
      <MediaListPageHeader scope={scope} />
      <MainWrapper>
        <MainSidebarLayout>
          <MainColumnStack>
            <EpisodesPageChipRow chipsConfig={chipsConfig} />
            <EpisodesPageList />
          </MainColumnStack>
        </MainSidebarLayout>
      </MainWrapper>
    </EpisodesPageContextProvider>
  );
}
