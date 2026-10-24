'use client';

import type { DTOItem } from '@podverse/helpers';
import type { QueryParamsGetManyPartialMusic } from '@podverse/helpers-requests';
import { MainColumnStack, MainSidebarLayout } from '@podverse/ui';

import { MainWrapper } from '../../../components/Main/MainWrapper';
import type { MediaListChipsConfig } from '../../../components/MediaListChips/MediaListChips';
import type { MediaListScope } from '../../../utils/mediaListChips';
import { MediaListPageHeader } from '../MediaListPageHeader';
import { TracksPageChipRow } from './TracksPageChipRow';
import { TracksPageContextProvider } from './TracksPageContext';
import { TracksPageList } from './TracksPageList';

type TracksPageClientProps = {
  chipsConfig: MediaListChipsConfig;
  initialQueryParams: QueryParamsGetManyPartialMusic;
  scope: MediaListScope;
  ssrItems: DTOItem[];
  ssrTotalPages: number;
};

export type TracksListProps = Omit<TracksPageClientProps, 'chipsConfig'>;

export function TracksPageClient(props: TracksPageClientProps) {
  const { chipsConfig, initialQueryParams, scope, ssrItems, ssrTotalPages } = props;

  return (
    <TracksPageContextProvider
      initialQueryParams={initialQueryParams}
      scope={scope}
      ssrItems={ssrItems}
      ssrTotalPages={ssrTotalPages}
    >
      <MediaListPageHeader scope={scope} />
      <MainWrapper>
        <MainSidebarLayout>
          <MainColumnStack>
            <TracksPageChipRow chipsConfig={chipsConfig} />
            <TracksPageList />
          </MainColumnStack>
        </MainSidebarLayout>
      </MainWrapper>
    </TracksPageContextProvider>
  );
}
