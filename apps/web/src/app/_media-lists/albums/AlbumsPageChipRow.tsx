'use client';

import { useTranslations } from 'next-intl';

import type { MediaListChipsConfig } from '../../../components/MediaListChips/MediaListChips';
import { MediaListChips } from '../../../components/MediaListChips/MediaListChips';
import { MediaListTrailingChips } from '../../../components/MediaListChips/MediaListTrailingChips';
import { useAlbumsPageContext } from './AlbumsPageContext';
import { albumsListViewModeScope, getAlbumsPageSortOptions } from './AlbumsPageDropdownConfig';

type AlbumsPageChipRowProps = { chipsConfig: MediaListChipsConfig };

export function AlbumsPageChipRow({ chipsConfig }: AlbumsPageChipRowProps) {
  const { filterParams, scope, setFilterParams } = useAlbumsPageContext();
  const tFilters = useTranslations('filters');

  return (
    <MediaListChips
      {...chipsConfig}
      trailing={
        <MediaListTrailingChips
          filterParams={filterParams}
          setFilterParams={setFilterParams}
          showViewSelector
          sortOptions={getAlbumsPageSortOptions({ type: filterParams.type, tFilters })}
          viewModeScope={albumsListViewModeScope(scope)}
        />
      }
    />
  );
}
