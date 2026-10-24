import type {
  QueryParamsChannelType,
  QueryParamsGlobalSort,
  QueryParamsStatsRange,
} from '@podverse/helpers-requests';

type PodcastPageDropdownConfigParams = {
  type: QueryParamsChannelType;
  sort: QueryParamsGlobalSort;
  range: QueryParamsStatsRange | null;
  page: number;
};

export type PodcastPageDropdownConfigCurrentParams = {
  currentType: QueryParamsChannelType;
  currentSort: QueryParamsGlobalSort;
  currentRange: QueryParamsStatsRange | null;
  currentPage: number;
};

export function getPodcastPageFilterParams({
  type,
  sort,
  range,
  page,
}: PodcastPageDropdownConfigParams): PodcastPageDropdownConfigCurrentParams {
  const currentType = type;
  const currentSort = sort;
  const currentRange = range;
  const currentPage = page;

  return { currentSort, currentRange, currentType, currentPage };
}
