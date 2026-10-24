'use client';

import { useTranslations } from 'next-intl';

import type { MediaListChipsConfig } from '../../../components/MediaListChips/MediaListChips';
import { MediaListChips } from '../../../components/MediaListChips/MediaListChips';
import { MediaListTrailingChips } from '../../../components/MediaListChips/MediaListTrailingChips';
import { useArtistsPageContext } from './ArtistsPageContext';
import { artistsListViewModeScope, getArtistsPageSortOptions } from './ArtistsPageDropdownConfig';

type ArtistsPageChipRowProps = { chipsConfig: MediaListChipsConfig };

export function ArtistsPageChipRow({ chipsConfig }: ArtistsPageChipRowProps) {
  const { filterParams, scope, setFilterParams } = useArtistsPageContext();
  const tFilters = useTranslations('filters');

  return (
    <MediaListChips
      {...chipsConfig}
      trailing={
        <MediaListTrailingChips
          filterParams={filterParams}
          setFilterParams={setFilterParams}
          showViewSelector
          sortOptions={getArtistsPageSortOptions({ type: filterParams.type, tFilters })}
          viewModeScope={artistsListViewModeScope(scope)}
        />
      }
    />
  );
}
