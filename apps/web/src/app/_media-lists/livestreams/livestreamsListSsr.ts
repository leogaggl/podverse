import { z } from 'zod';

import type { DTOItem } from '@podverse/helpers';
import { getTotalPages } from '@podverse/helpers';
import type { ApiListResponse } from '@podverse/helpers-requests';

import { safeSsrListRequest } from '../../../utils/filters/ssrFilterGuards';
import type { MediaListScope } from '../../../utils/mediaListChips';
import type { MediaListSearchParams, MediaListSsr } from '../mediaListSsr';
import { firstMediaListSearchParam } from '../mediaListSsr';
import type { LivestreamsListProps } from './LivestreamsPageClient';

const pageSchema = z.object({
  page: z
    .string()
    .transform((value) => parseInt(value, 10))
    .optional()
    .default(1),
});

export async function loadLivestreamsListProps(
  scope: MediaListScope,
  searchParams: MediaListSearchParams,
  ssr: MediaListSsr
): Promise<LivestreamsListProps> {
  const page = parsePage(searchParams);

  // A signed-out subscribed list is account data, so the page shows the sign-in message
  // without asking the server.
  if (scope === 'subscribed' && !ssr.canLoadPrivateSsrData) {
    return { scope, initialPage: page, ssrItems: [], ssrTotalPages: 1 };
  }

  const response: ApiListResponse<DTOItem> = await safeSsrListRequest(
    () =>
      ssr.ssrApiRequestService.reqLiveItemGetManyUpcoming({
        type: scope === 'browse' ? 'global' : 'subscribed',
        medium: 'all',
        page,
      }),
    page
  );

  return {
    scope,
    initialPage: page,
    ssrItems: response.data,
    ssrTotalPages: getTotalPages(
      response.meta.count,
      response.meta.limit,
      response.data.length,
      page
    ),
  };
}

function parsePage(searchParams: MediaListSearchParams): number {
  const parsed = pageSchema.safeParse({
    page: firstMediaListSearchParam(searchParams, 'page'),
  });
  const page = parsed.success ? parsed.data.page : 1;
  return Number.isInteger(page) && page > 0 ? page : 1;
}
