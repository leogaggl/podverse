import type { SortPrefScope } from '@podverse/helpers';
import {
  BROWSE_LIST_VIEW_MODE_SCOPE_ALBUMS,
  HOME_LIST_VIEW_MODE_SCOPE_ALBUMS,
} from '@podverse/helpers';
import type {
  QueryParamsStatsRange,
  QueryParamsSubscribedFullSort,
  QueryParamsSubscribedMusicType,
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

export function albumsListViewModeScope(scope: MediaListScope): SortPrefScope {
  return scope === 'subscribed'
    ? HOME_LIST_VIEW_MODE_SCOPE_ALBUMS
    : BROWSE_LIST_VIEW_MODE_SCOPE_ALBUMS;
}

export function getAlbumsPageDropdownConfig({
  type,
  sort,
  tFilters,
}: {
  /** Every channel list passes its scope. Albums have no type menu in either one. */
  scope: MediaListScope;
  sort: QueryParamsSubscribedFullSort;
  type: QueryParamsSubscribedMusicType;
  tFilters: (key: string) => string;
}) {
  const typeOptions: { label: string; value: QueryParamsSubscribedMusicType }[] = [];

  return buildSubscribedListDropdownConfig({
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

type AlbumsPageDropdownConfigParams = {
  type: QueryParamsSubscribedMusicType | null;
  sort: QueryParamsSubscribedFullSort | null;
  range: QueryParamsStatsRange | null;
  page: number;
};

export type AlbumsPageDropdownConfigCurrentParams = {
  currentType: QueryParamsSubscribedMusicType;
  currentSort: QueryParamsSubscribedFullSort;
  currentRange: QueryParamsStatsRange | null;
  currentPage: number;
};

export function getAlbumsPageFilterParams(
  params: AlbumsPageDropdownConfigParams,
  isValidAuthSession: boolean,
  scope: MediaListScope
): AlbumsPageDropdownConfigCurrentParams {
  return buildSubscribedListFilterParams({
    ...params,
    defaultGlobalSort: 'recent',
    defaultSubscribedSort: 'a_z',
    globalSortValues: QUERY_PARAMS_GLOBAL_SORT_VALUES,
    isValidAuthSession,
    scope,
    subscribedSortValues: QUERY_PARAMS_SUBSCRIBED_FULL_SORT,
    supportsCategory: false,
  });
}
