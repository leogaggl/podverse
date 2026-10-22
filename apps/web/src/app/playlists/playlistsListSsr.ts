import { z } from 'zod';

import type { DTOPlaylist } from '@podverse/helpers';
import { getTotalPages, QUERY_PARAMS_QUEUE_MEDIUMS } from '@podverse/helpers';
import {
  QUERY_PARAMS_PLAYLISTS_TYPE_VALUES,
  QUERY_PARAMS_STATS_RANGE_VALUES,
  QUERY_PARAMS_SUBSCRIBED_FULL_SORT,
} from '@podverse/helpers-requests';

import { safeSsrListRequest } from '../../utils/filters/ssrFilterGuards';
import type { PlaylistsFilterDefaults } from '../../utils/localSettings/localSettings';
import { getFilterDefaultsForPage } from '../../utils/localSettings/localSettings';
import type { MediaListSearchParams, MediaListSsr } from '../_media-lists/mediaListSsr';
import { firstMediaListSearchParam } from '../_media-lists/mediaListSsr';
import type { PlaylistsListProps } from './PlaylistsPageClient';
import { getPlaylistsPageFilterParams } from './PlaylistsPageDropdownConfig';

export const searchParamsSchema = z.object({
  page: z
    .string()
    .transform((v) => parseInt(v, 10))
    .optional()
    .default(1),
  type: z.enum(QUERY_PARAMS_PLAYLISTS_TYPE_VALUES).optional().nullable().default(null),
  sort: z.enum(QUERY_PARAMS_SUBSCRIBED_FULL_SORT).optional().nullable().default(null),
  range: z.enum(QUERY_PARAMS_STATS_RANGE_VALUES).optional().nullable().default(null),
  medium: z.enum(QUERY_PARAMS_QUEUE_MEDIUMS).optional().nullable().default(null),
});

export type PlaylistsPageSearchParams = z.infer<typeof searchParamsSchema>;

/** Public playlists for the Browse chip. Type stays public; sort, range, and medium are remembered. */
export async function loadPlaylistsBrowseProps(
  searchParams: MediaListSearchParams,
  ssr: MediaListSsr
): Promise<PlaylistsListProps> {
  const cookieDefaults = getFilterDefaultsForPage(ssr.localSettings, 'browse-playlists');
  const { page, sort, range, medium } = resolveBrowseParams(searchParams, cookieDefaults);
  const { currentPage, currentSort, currentRange, currentMedium } = getPlaylistsPageFilterParams(
    {
      page,
      type: 'public',
      sort,
      range,
      medium,
    },
    ssr.canLoadPrivateSsrData
  );

  const response = await safeSsrListRequest<DTOPlaylist>(
    () =>
      ssr.ssrApiRequestService.reqPlaylistGetMany({
        page: currentPage,
        type: 'public',
        sort: currentSort,
        range: currentRange,
        medium: currentMedium,
      }),
    currentPage
  );

  return {
    listScope: 'browse',
    initialQueryParams: {
      page: currentPage,
      type: 'public',
      sort: currentSort,
      range: currentRange,
      medium: currentMedium,
    },
    ssrPlaylists: response.data,
    ssrTotalPages: getTotalPages(
      response.meta.count,
      response.meta.limit,
      response.data.length,
      currentPage
    ),
  };
}

function resolveBrowseParams(
  searchParams: MediaListSearchParams,
  cookieDefaults: PlaylistsFilterDefaults | undefined
) {
  const parsed = searchParamsSchema.safeParse({
    page: firstMediaListSearchParam(searchParams, 'page'),
    sort: firstMediaListSearchParam(searchParams, 'sort'),
    range: firstMediaListSearchParam(searchParams, 'range'),
    medium: firstMediaListSearchParam(searchParams, 'medium'),
  });

  if (!parsed.success) {
    return {
      page: 1,
      sort: cookieDefaults?.sort ?? 'top',
      range: cookieDefaults?.range ?? 'week',
      medium: cookieDefaults?.medium ?? 'av',
    };
  }

  return {
    page: parsed.data.page,
    sort: parsed.data.sort ?? cookieDefaults?.sort ?? 'top',
    range: parsed.data.range ?? cookieDefaults?.range ?? 'week',
    medium: parsed.data.medium ?? cookieDefaults?.medium ?? 'av',
  };
}
