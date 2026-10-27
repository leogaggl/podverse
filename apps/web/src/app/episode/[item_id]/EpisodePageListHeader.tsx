'use client';

import { useTranslations } from 'next-intl';
import React from 'react';

import type { QueryParamsItemSort, QueryParamsItemType } from '@podverse/helpers-requests';
import type { ChipRowItem } from '@podverse/ui';

import { CommonDetailListHeader } from '../../../components/Common/List/CommonDetailListHeader';
import { ListSortChip } from '../../../components/ListSortChip/ListSortChip';
import { useEpisodePageContext } from './EpisodePageContext';

type EpisodePageListHeaderProps = {
  ssrHasChapters: boolean;
  ssrHasPeople: boolean;
  ssrHasSoundbites: boolean;
  ssrHasTranscripts: boolean;
  ssrCanShowBoosts?: boolean;
};

type EpisodeClipSort = 'recent' | 'oldest';

export const EpisodePageListHeader: React.FC<EpisodePageListHeaderProps> = ({
  ssrHasChapters,
  ssrHasPeople,
  ssrHasSoundbites,
  ssrHasTranscripts,
  ssrCanShowBoosts,
}) => {
  const { filterParams, setFilterParams } = useEpisodePageContext();
  const { type, sort, range } = filterParams;
  const tFilters = useTranslations('filters');
  const tInfo = useTranslations('info');
  const tFeatures = useTranslations('features');
  const tValue = useTranslations('value');

  const items: ChipRowItem<QueryParamsItemType>[] = [
    {
      key: 'summary',
      label: tInfo('summary.summary'),
    },
  ];

  if (ssrHasChapters) {
    items.push({
      key: 'chapters',
      label: tInfo('chapter.chapters'),
    });
  }

  if (ssrHasSoundbites) {
    items.push({
      key: 'soundbites',
      label: tInfo('soundbite.official_clips'),
    });
  }

  items.push({
    key: 'clips',
    label: tFeatures('clip.clips'),
  });

  if (ssrCanShowBoosts) {
    items.push({
      key: 'boosts',
      label: tValue('boost'),
    });
  }

  if (ssrHasTranscripts) {
    items.push({
      key: 'transcript',
      label: tInfo('transcript.transcript'),
    });
  }

  if (ssrHasPeople) {
    items.push({
      key: 'people',
      label: tInfo('people.people'),
    });
  }

  const clipSortOptions: { value: QueryParamsItemSort; label: string }[] = [
    { value: 'recent', label: tFilters('sort.recent') },
    { value: 'oldest', label: tFilters('sort.oldest') },
    { value: 'top', label: tFilters('sort.top') },
  ];
  const soundbiteSortOptions: { value: EpisodeClipSort; label: string }[] = [
    { value: 'recent', label: tFilters('sort.recent') },
    { value: 'oldest', label: tFilters('sort.oldest') },
  ];
  const soundbiteSort: EpisodeClipSort = sort === 'oldest' ? 'oldest' : 'recent';

  let trailing: React.ReactNode = null;
  if (type === 'clips') {
    trailing = (
      <ListSortChip
        onChange={(nextSort, nextRange) => {
          setFilterParams({ ...filterParams, page: 1, range: nextRange, sort: nextSort });
        }}
        options={clipSortOptions}
        position="right"
        range={sort === 'top' ? range : null}
        rangeSort="top"
        testId="episode-detail-sort"
        value={sort}
      />
    );
  } else if (type === 'soundbites') {
    trailing = (
      <ListSortChip
        onChange={(nextSort) => {
          setFilterParams({ ...filterParams, page: 1, sort: nextSort });
        }}
        options={soundbiteSortOptions}
        position="right"
        range={null}
        testId="episode-detail-sort"
        value={soundbiteSort}
      />
    );
  }

  return (
    <CommonDetailListHeader
      items={items}
      onSelect={(nextType) => {
        setFilterParams({ ...filterParams, type: nextType, page: 1 });
      }}
      selectedKey={type}
      testId="episode-detail-chips"
      trailing={trailing}
    />
  );
};
