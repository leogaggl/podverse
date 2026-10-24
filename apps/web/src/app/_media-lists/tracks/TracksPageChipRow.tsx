'use client';

import { useTranslations } from 'next-intl';

import type { MediaListChipsConfig } from '../../../components/MediaListChips/MediaListChips';
import { MediaListChips } from '../../../components/MediaListChips/MediaListChips';
import { MediaListTrailingChips } from '../../../components/MediaListChips/MediaListTrailingChips';
import { useTracksPageContext } from './TracksPageContext';
import { getTracksPageSortOptions } from './TracksPageDropdownConfig';

type TracksPageChipRowProps = { chipsConfig: MediaListChipsConfig };

export function TracksPageChipRow({ chipsConfig }: TracksPageChipRowProps) {
  const { filterParams, setFilterParams } = useTracksPageContext();
  const tFilters = useTranslations('filters');

  return (
    <MediaListChips
      {...chipsConfig}
      trailing={
        <MediaListTrailingChips
          filterParams={filterParams}
          setFilterParams={setFilterParams}
          showViewSelector
          sortOptions={getTracksPageSortOptions(tFilters)}
        />
      }
    />
  );
}
