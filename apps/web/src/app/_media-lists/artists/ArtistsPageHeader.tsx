'use client';

import { useTranslations } from 'next-intl';
import React from 'react';

import type {
  QueryParamsStatsRange,
  QueryParamsSubscribedFullSort,
} from '@podverse/helpers-requests';
import {
  QUERY_PARAMS_STATS_RANGE_VALUES,
  QUERY_PARAMS_SUBSCRIBED_FULL_SORT,
} from '@podverse/helpers-requests';
import { Dropdown, MainHeader } from '@podverse/ui';

import { ViewSelector } from '../../../components/ViewSelector/ViewSelector';
import { useListViewMode } from '../../../hooks/useListViewMode';
import { useArtistsPageContext } from './ArtistsPageContext';
import {
  artistsListViewModeScope,
  getArtistsPageDropdownConfig,
} from './ArtistsPageDropdownConfig';

export const ArtistsPageHeader: React.FC = () => {
  const { filterParams, scope, setFilterParams } = useArtistsPageContext();
  const { viewSelected, setViewSelected } = useListViewMode(artistsListViewModeScope(scope));
  const { type, sort, range } = filterParams;
  const tSubscriptions = useTranslations('subscriptions');
  const tFeatures = useTranslations('features');
  const tFilters = useTranslations('filters');
  const { sortMenuItems, rangeMenuItems, showRangeDropdown } = getArtistsPageDropdownConfig({
    scope,
    type,
    sort,
    tFilters,
  });

  const medium = 'publisher-music';
  const pageTitle =
    scope === 'subscribed' ? tSubscriptions('subscribed') : tFeatures('browse.browse');

  function isChannelSort(val: string): val is QueryParamsSubscribedFullSort {
    return QUERY_PARAMS_SUBSCRIBED_FULL_SORT.includes(val as QueryParamsSubscribedFullSort);
  }
  function isStatsRange(val: string): val is QueryParamsStatsRange {
    return QUERY_PARAMS_STATS_RANGE_VALUES.includes(val as QueryParamsStatsRange);
  }

  const handleSortChange = (value: string) => {
    if (isChannelSort(value)) {
      if (value === 'top') {
        setFilterParams({
          page: 1,
          medium,
          type: filterParams.type,
          sort: value,
          range: 'week',
        });
      } else {
        setFilterParams({
          page: 1,
          medium,
          type: filterParams.type,
          sort: value,
          range: filterParams.range,
        });
      }
    }
  };

  const handleRangeChange = (value: string) => {
    if (isStatsRange(value)) {
      setFilterParams({
        page: 1,
        medium,
        type: filterParams.type,
        sort: filterParams.sort,
        range: value,
      });
    }
  };

  const buttonsNode = (
    <>
      <Dropdown key="sort" value={sort} menuItems={sortMenuItems} onChange={handleSortChange} />
      {showRangeDropdown && range && (
        <Dropdown
          key="range"
          value={range}
          menuItems={rangeMenuItems}
          onChange={handleRangeChange}
        />
      )}
      <ViewSelector viewSelected={viewSelected} setViewSelected={setViewSelected} />
    </>
  );

  return <MainHeader title={pageTitle} buttonsNode={buttonsNode} />;
};
