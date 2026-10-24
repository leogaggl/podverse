'use client';

import type { DTOClip } from '@podverse/helpers';
import type { QueryParamsGetManyPartial } from '@podverse/helpers-requests';
import { MainColumnStack, MainSidebarLayout } from '@podverse/ui';

import { MainWrapper } from '../../../components/Main/MainWrapper';
import type { MediaListChipsConfig } from '../../../components/MediaListChips/MediaListChips';
import type { MediaListScope } from '../../../utils/mediaListChips';
import { MediaListPageHeader } from '../MediaListPageHeader';
import { ClipsPageChipRow } from './ClipsPageChipRow';
import { ClipsPageContextProvider } from './ClipsPageContext';
import { ClipsPageList } from './ClipsPageList';

type ClipsPageClientProps = {
  chipsConfig: MediaListChipsConfig;
  initialQueryParams: QueryParamsGetManyPartial;
  scope: MediaListScope;
  ssrClips: DTOClip[];
  ssrTotalPages: number;
};

export type ClipsListProps = Omit<ClipsPageClientProps, 'chipsConfig'>;

export function ClipsPageClient(props: ClipsPageClientProps) {
  const { chipsConfig, initialQueryParams, scope, ssrClips, ssrTotalPages } = props;

  return (
    <ClipsPageContextProvider
      initialQueryParams={initialQueryParams}
      scope={scope}
      ssrClips={ssrClips}
      ssrTotalPages={ssrTotalPages}
    >
      <MediaListPageHeader scope={scope} />
      <MainWrapper>
        <MainSidebarLayout>
          <MainColumnStack>
            <ClipsPageChipRow chipsConfig={chipsConfig} />
            <ClipsPageList />
          </MainColumnStack>
        </MainSidebarLayout>
      </MainWrapper>
    </ClipsPageContextProvider>
  );
}
