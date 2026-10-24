import type {
  QueryParamsItemSort,
  QueryParamsItemType,
  QueryParamsStatsRange,
} from '@podverse/helpers-requests';

type EpisodePageDropdownConfigParams = {
  type: QueryParamsItemType;
  sort: QueryParamsItemSort;
  range: QueryParamsStatsRange | null;
  page: number;
};

export type EpisodePageDropdownConfigCurrentParams = {
  currentType: QueryParamsItemType;
  currentSort: QueryParamsItemSort;
  currentRange: QueryParamsStatsRange | null;
  currentPage: number;
};

export function getEpisodePageFilterParams({
  type,
  sort,
  range,
  page,
}: EpisodePageDropdownConfigParams): EpisodePageDropdownConfigCurrentParams {
  let currentSort = sort;
  const currentRange = range;
  const currentType = type;
  const currentPage = page;

  if (type === 'soundbites') {
    if (sort === 'top') {
      currentSort = 'recent';
    }
  }

  return { currentSort, currentRange, currentType, currentPage };
}
