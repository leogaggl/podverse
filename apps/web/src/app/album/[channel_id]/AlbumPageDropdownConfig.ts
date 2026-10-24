import type {
  QueryParamsChannelMusicAlbumSort,
  QueryParamsChannelMusicAlbumType,
  QueryParamsStatsRange,
} from '@podverse/helpers-requests';

type AlbumPageDropdownConfigParams = {
  type: QueryParamsChannelMusicAlbumType;
  sort: QueryParamsChannelMusicAlbumSort;
  range: QueryParamsStatsRange | null;
  page: number;
};

export type AlbumPageDropdownConfigCurrentParams = {
  currentType: QueryParamsChannelMusicAlbumType;
  currentSort: QueryParamsChannelMusicAlbumSort;
  currentRange: QueryParamsStatsRange | null;
  currentPage: number;
};

export function getAlbumPageFilterParams({
  type,
  sort,
  range,
  page,
}: AlbumPageDropdownConfigParams): AlbumPageDropdownConfigCurrentParams {
  const currentType = type;
  const currentSort = sort;
  const currentRange = range;
  const currentPage = page;

  return { currentSort, currentRange, currentType, currentPage };
}
