'use client';

import { useTranslations } from 'next-intl';

import type { ChipRowItem, MenuChipOption } from '@podverse/ui';
import { ChipRow, MenuChip } from '@podverse/ui';

import type { MediaListChipsConfig } from '../../components/MediaListChips/MediaListChips';
import { MediaListChips } from '../../components/MediaListChips/MediaListChips';
import { MediaListTrailingChips } from '../../components/MediaListChips/MediaListTrailingChips';
import { usePlaylistsPageContext } from './PlaylistsPageContext';
import { getPlaylistsPageSortOptions } from './PlaylistsPageDropdownConfig';

import chipRowStyles from '../../styles/components/MediaListChips/MediaListChips.module.scss';

type PlaylistsTypeKey = 'private' | 'private_followed' | 'public';

export function PlaylistsPageChipRow({ chipsConfig }: { chipsConfig?: MediaListChipsConfig }) {
  const { filterParams, setFilterParams } = usePlaylistsPageContext();
  const tFeatures = useTranslations('features');
  const tFilters = useTranslations('filters');
  const tMedia = useTranslations('media');

  function handleTypeChange(type: PlaylistsTypeKey) {
    if (type === filterParams.type) {
      return;
    }
    if (type === 'public') {
      setFilterParams({ ...filterParams, type, sort: 'top', range: 'week', page: 1 });
      return;
    }
    setFilterParams({ ...filterParams, type, sort: 'a_z', range: null, page: 1 });
  }

  const medium = filterParams.medium === 'music' ? 'music' : 'av';
  const mediumLabel = medium === 'music' ? tMedia('music.music') : tMedia('podcast.podcasts');
  const mediumOptions: MenuChipOption<'av' | 'music'>[] = [
    { value: 'av', label: tMedia('podcast.podcasts') },
    { value: 'music', label: tMedia('music.music') },
  ];
  const typeItems: ChipRowItem<PlaylistsTypeKey>[] = [
    { key: 'private', label: tFeatures('playlist.my_playlists') },
    { key: 'private_followed', label: tFilters('type.subscribed') },
    { key: 'public', label: tFilters('type.global') },
  ];

  const trailing = (
    <>
      <MenuChip
        faceLabel={mediumLabel}
        label={tFilters('screen.filter_heading')}
        onSelect={(nextMedium) => setFilterParams({ ...filterParams, medium: nextMedium, page: 1 })}
        options={mediumOptions}
        selected
        testId="playlists-medium"
        value={medium}
      />
      <MediaListTrailingChips
        filterParams={filterParams}
        setFilterParams={setFilterParams}
        showViewSelector={false}
        sortOptions={getPlaylistsPageSortOptions({ type: filterParams.type, tFilters })}
      />
    </>
  );

  if (chipsConfig !== undefined) {
    return <MediaListChips {...chipsConfig} trailing={trailing} />;
  }

  return (
    <ChipRow
      className={chipRowStyles.chipRow}
      items={typeItems}
      onSelect={handleTypeChange}
      selectedKey={filterParams.type}
      testId="playlists-type-chips"
      trailing={trailing}
    />
  );
}
