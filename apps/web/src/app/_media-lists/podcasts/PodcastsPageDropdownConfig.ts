import type { CategoryMappingKeys, SortPrefScope } from '@podverse/helpers';
import {
  BROWSE_LIST_VIEW_MODE_SCOPE_PODCASTS,
  HOME_LIST_VIEW_MODE_SCOPE_PODCASTS,
} from '@podverse/helpers';
import type {
  QueryParamsStatsRange,
  QueryParamsSubscribedFullSort,
  QueryParamsSubscribedType,
} from '@podverse/helpers-requests';
import {
  QUERY_PARAMS_GLOBAL_SORT_VALUES,
  QUERY_PARAMS_SUBSCRIBED_FULL_SORT,
} from '@podverse/helpers-requests';

import {
  buildSubscribedListDropdownConfig,
  buildSubscribedListFilterParams,
} from '../../../utils/dropdownMenuItems';
import type { MediaListScope } from '../../../utils/mediaListChips';

export function podcastsListViewModeScope(scope: MediaListScope): SortPrefScope {
  return scope === 'subscribed'
    ? HOME_LIST_VIEW_MODE_SCOPE_PODCASTS
    : BROWSE_LIST_VIEW_MODE_SCOPE_PODCASTS;
}

export function getPodcastsPageDropdownConfig({
  scope,
  type,
  sort,
  tFilters,
}: {
  scope: MediaListScope;
  sort: QueryParamsSubscribedFullSort;
  type: QueryParamsSubscribedType;
  tFilters: (key: string) => string;
}) {
  const typeOptions: { label: string; value: QueryParamsSubscribedType }[] =
    scope === 'browse'
      ? [
          { label: tFilters('type.global'), value: 'global' },
          { label: tFilters('type.category'), value: 'category' },
        ]
      : [];

  return buildSubscribedListDropdownConfig({
    categorySorts: [
      { label: tFilters('sort.recent'), value: 'recent' },
      { label: tFilters('sort.top'), value: 'top' },
    ],
    globalSorts: [
      { label: tFilters('sort.recent'), value: 'recent' },
      { label: tFilters('sort.top'), value: 'top' },
    ],
    showRangeWhenSort: 'top',
    sort,
    subscribedSorts: [
      { label: tFilters('sort.a_z'), value: 'a_z' },
      { label: tFilters('sort.recent'), value: 'recent' },
      { label: tFilters('sort.top'), value: 'top' },
    ],
    tFilters,
    type,
    typeOptions,
  });
}

type PodcastsPageDropdownConfigParams = {
  type: QueryParamsSubscribedType | null;
  sort: QueryParamsSubscribedFullSort | null;
  range: QueryParamsStatsRange | null;
  category: CategoryMappingKeys | null;
  page: number;
};

export type PodcastsPageDropdownConfigCurrentParams = {
  currentType: QueryParamsSubscribedType;
  currentSort: QueryParamsSubscribedFullSort;
  currentRange: QueryParamsStatsRange | null;
  currentCategory: CategoryMappingKeys | null;
  currentPage: number;
};

export function getPodcastsPageFilterParams(
  params: PodcastsPageDropdownConfigParams,
  isValidAuthSession: boolean,
  scope: MediaListScope
): PodcastsPageDropdownConfigCurrentParams {
  return buildSubscribedListFilterParams({
    ...params,
    defaultGlobalSort: 'recent',
    defaultSubscribedSort: 'a_z',
    globalSortValues: QUERY_PARAMS_GLOBAL_SORT_VALUES,
    isValidAuthSession,
    scope,
    subscribedSortValues: QUERY_PARAMS_SUBSCRIBED_FULL_SORT,
    supportsCategory: true,
  });
}
