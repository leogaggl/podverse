import type { AddByRSSResourceData } from '@podverse/helpers/dto';
import {
  reconstructAddByRSSItemFromResourceData,
  reconstructAddByRSSLivestreamFromResourceData,
} from '@podverse/parser-mapping';

import { resolveE2eMediaUrl } from '../e2e/resolveE2eMediaUrl';

export const isAddByRssResourceData = (value: unknown): value is AddByRSSResourceData => {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
};

const hasAddByRssLivestreamStartTime = (resourceData: AddByRSSResourceData): boolean => {
  const startTime = resourceData.start_time;
  return (
    (typeof startTime === 'string' && startTime.length > 0) ||
    typeof startTime === 'number' ||
    startTime instanceof Date
  );
};

/** The remote media URL the player loads for an Add by RSS episode, track, or livestream. */
export const resolveAddByRssPlaybackUrl = (resourceData: AddByRSSResourceData): string | null => {
  if (hasAddByRssLivestreamStartTime(resourceData)) {
    const reconstructedLivestream = reconstructAddByRSSLivestreamFromResourceData(resourceData);
    const liveUrl = reconstructedLivestream?.item?.enclosure?.url;
    if (typeof liveUrl === 'string' && liveUrl.trim().length > 0) {
      return resolveE2eMediaUrl(liveUrl.trim());
    }
  }

  const reconstructedItem = reconstructAddByRSSItemFromResourceData(resourceData);
  const itemUrl = reconstructedItem?.bundle?.enclosures?.[0]?.item_enclosure_sources?.[0]?.uri;
  if (typeof itemUrl === 'string' && itemUrl.trim().length > 0) {
    return resolveE2eMediaUrl(itemUrl.trim());
  }

  // A row written without the full bundle still names its enclosure.
  const enclosureUrl = resourceData.enclosure_url;
  if (typeof enclosureUrl === 'string' && enclosureUrl.trim().length > 0) {
    return resolveE2eMediaUrl(enclosureUrl.trim());
  }

  return null;
};

/** True when the URL's authority carries `user@` or `user:pass@`. */
export const hasUrlUserinfo = (url: string): boolean =>
  /^[a-z][a-z0-9+.-]*:\/\/[^/?#]*@/i.test(url);
