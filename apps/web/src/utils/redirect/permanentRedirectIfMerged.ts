import { headers } from 'next/headers';
import { permanentRedirect } from 'next/navigation';

import type { DTOChannel } from '@podverse/helpers';

import { getSSRAuthService } from '../auth/ssrAuth';
import {
  channelPathForMedium,
  channelPathForRoute,
  itemPathForRoute,
  MERGE_REDIRECT_CHECKED_HEADER,
  type MergeChannelRouteKind,
  type MergeItemRouteKind,
  searchFromParams,
  withSearch,
} from './mergedIdentity';

function mediumIdOf(channel: DTOChannel): number | null {
  return typeof channel.medium_id === 'number' ? channel.medium_id : null;
}

/**
 * Send a merged show, episode, or Podcast Index id to the survivor before the page renders.
 * Requests that already passed through the edge redirect skip the lookup.
 */
export async function permanentRedirectIfMerged(input: {
  kind: 'channel' | 'item' | 'podcast_index';
  id: string;
  routeKind?: MergeChannelRouteKind | MergeItemRouteKind;
  searchParams?: object;
}): Promise<void> {
  const headerList = await headers();
  if (headerList.get(MERGE_REDIRECT_CHECKED_HEADER) === '1') {
    return;
  }

  const { ssrApiRequestService } = await getSSRAuthService();
  const search =
    input.kind === 'podcast_index' || input.searchParams === undefined
      ? ''
      : searchFromParams(input.searchParams);

  if (input.kind === 'item') {
    const resolved = await ssrApiRequestService.reqIdentityResolve({
      item_id_texts: [input.id],
    });
    const move = resolved.items[0];
    if (!move) {
      return;
    }
    const routeKind = input.routeKind === 'track' ? 'track' : 'episode';
    permanentRedirect(withSearch(itemPathForRoute(routeKind, move.to_id_text), search));
  }

  if (input.kind === 'podcast_index') {
    const podcastIndexId = Number(input.id);
    if (!Number.isInteger(podcastIndexId) || podcastIndexId < 1) {
      return;
    }
    const resolved = await ssrApiRequestService.reqIdentityResolve({
      podcast_index_ids: [podcastIndexId],
    });
    const move = resolved.podcast_index_ids[0];
    if (!move) {
      return;
    }
    const survivor = await ssrApiRequestService.reqChannelGetByIdOrIdText(move.to_channel_id_text);
    const mediumId = mediumIdOf(survivor);
    const path =
      mediumId === null
        ? channelPathForRoute('podcast', move.to_channel_id_text)
        : channelPathForMedium(mediumId, move.to_channel_id_text);
    permanentRedirect(path);
  }

  const resolved = await ssrApiRequestService.reqIdentityResolve({
    channel_id_texts: [input.id],
  });
  const move = resolved.channels[0];
  if (!move) {
    return;
  }
  const survivor = await ssrApiRequestService.reqChannelGetByIdOrIdText(move.to_id_text);
  const mediumId = mediumIdOf(survivor);
  const routeKind =
    input.routeKind === 'album' || input.routeKind === 'artist' || input.routeKind === 'podcast'
      ? input.routeKind
      : 'podcast';
  const path =
    mediumId === null
      ? channelPathForRoute(routeKind, move.to_id_text)
      : channelPathForMedium(mediumId, move.to_id_text);
  permanentRedirect(withSearch(path, search));
}
