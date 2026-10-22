'use client';

import { useTranslations } from 'next-intl';
import React from 'react';

import type {
  QueryParamsStatsRange,
  QueryParamsSubscribedPartialSort,
} from '@podverse/helpers-requests';
import {
  QUERY_PARAMS_STATS_RANGE_VALUES,
  QUERY_PARAMS_SUBSCRIBED_PARTIAL_SORT,
} from '@podverse/helpers-requests';
import { Dropdown, MainHeader } from '@podverse/ui';

import { ViewSelector } from '../../../components/ViewSelector/ViewSelector';
import { useLocalSettings } from '../../../contexts/LocalSettings';
import { useTracksPageContext } from './TracksPageContext';
import { getTracksPageDropdownConfig } from './TracksPageDropdownConfig';

export const TracksPageHeader: React.FC = () => {
  const { filterParams, scope, setFilterParams } = useTracksPageContext();
  const { viewSelected, setViewSelected } = useLocalSettings();
  const { sort, range } = filterParams;
  const tSubscriptions = useTranslations('subscriptions');
  const tFeatures = useTranslations('features');
  const tFilters = useTranslations('filters');
  const { sortMenuItems, rangeMenuItems, showRangeDropdown } = getTracksPageDropdownConfig({
    type: filterParams.type,
    sort,
    tFilters,
  });
  const medium = 'music';
  const pageTitle =
    scope === 'subscribed' ? tSubscriptions('subscribed') : tFeatures('browse.browse');

  function isItemSort(val: string): val is QueryParamsSubscribedPartialSort {
    return QUERY_PARAMS_SUBSCRIBED_PARTIAL_SORT.includes(val as QueryParamsSubscribedPartialSort);
  }
  function isStatsRange(val: string): val is QueryParamsStatsRange {
    return QUERY_PARAMS_STATS_RANGE_VALUES.includes(val as QueryParamsStatsRange);
  }

  const handleSortChange = (value: string) => {
    if (isItemSort(value)) {
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
