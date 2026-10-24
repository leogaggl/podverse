'use client';

import { useTranslations } from 'next-intl';

import type { ChipRowItem } from '@podverse/ui';
import { ChipRow } from '@podverse/ui';

import type { MediaListChipsConfig } from '../../components/MediaListChips/MediaListChips';
import { MediaListChips } from '../../components/MediaListChips/MediaListChips';
import { MediaListTrailingChips } from '../../components/MediaListChips/MediaListTrailingChips';
import { useProfilesPageContext } from './ProfilesPageContext';
import { getProfilesPageSortOptions } from './ProfilesPageDropdownConfig';

import chipRowStyles from '../../styles/components/MediaListChips/MediaListChips.module.scss';

type ProfilesTypeKey = 'global' | 'subscribed';

export function ProfilesPageChipRow({ chipsConfig }: { chipsConfig?: MediaListChipsConfig }) {
  const { filterParams, setFilterParams } = useProfilesPageContext();
  const tFilters = useTranslations('filters');

  function handleTypeChange(type: ProfilesTypeKey) {
    if (type === filterParams.type) {
      return;
    }
    if (type === 'global') {
      setFilterParams({ ...filterParams, page: 1, type: 'global', sort: 'recent', range: null });
      return;
    }
    setFilterParams({ ...filterParams, page: 1, type: 'subscribed', sort: 'a_z', range: null });
  }

  const typeItems: ChipRowItem<ProfilesTypeKey>[] = [
    { key: 'global', label: tFilters('type.global') },
    { key: 'subscribed', label: tFilters('type.subscribed') },
  ];

  const trailing = (
    <MediaListTrailingChips
      filterParams={filterParams}
      setFilterParams={setFilterParams}
      showViewSelector={false}
      sortOptions={getProfilesPageSortOptions({ type: filterParams.type, tFilters })}
    />
  );

  if (chipsConfig !== undefined) {
    return <MediaListChips {...chipsConfig} trailing={trailing} />;
  }

  return (
    <ChipRow
      className={chipRowStyles.chipRow}
      items={typeItems}
      onSelect={handleTypeChange}
      selectedKey={filterParams.type === 'subscribed' ? 'subscribed' : 'global'}
      testId="profiles-type-chips"
      trailing={trailing}
    />
  );
}
