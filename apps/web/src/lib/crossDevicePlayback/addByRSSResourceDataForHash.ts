import type { AddByRSSResourceData, DTOQueueResource } from '@podverse/helpers';

import { getApiRequestService } from '../../factories/apiRequestService';
import { addByRSSPlaybackIdentity } from '../../hooks/playbackHandoffState';

/** The first row whose Add by RSS identity equals `hash`, or null. */
export function pickAddByRSSResourceDataForHash(
  rows: readonly (DTOQueueResource | null)[],
  hash: string
): AddByRSSResourceData | null {
  for (const row of rows) {
    if (row === null) {
      continue;
    }
    const resourceData = row.add_by_rss_resource_data;
    if (resourceData === null || resourceData === undefined) {
      continue;
    }
    if (addByRSSPlaybackIdentity(resourceData) === hash) {
      return resourceData;
    }
  }
  return null;
}

/**
 * Looks in each queue's now-playing row, in the order given, for the Add by RSS item with
 * `hash`. The device that played it wrote that row.
 */
export async function findAddByRSSResourceDataForHash(params: {
  queueIdTexts: readonly string[];
  hash: string;
}): Promise<AddByRSSResourceData | null> {
  const apiRequestService = getApiRequestService();
  for (const queueIdText of params.queueIdTexts) {
    let row: DTOQueueResource | null;
    try {
      row = await apiRequestService.reqQueueResourcesGetNowPlayingByQueueIdText(queueIdText);
    } catch {
      continue;
    }
    const match = pickAddByRSSResourceDataForHash([row], params.hash);
    if (match !== null) {
      return match;
    }
  }
  return null;
}
