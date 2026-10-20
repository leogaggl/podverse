import type { AddByRSSResourceData } from '@podverse/helpers/dto';
import { canonicalAddByRSSFeedUrl } from '@podverse/helpers-validation/client';

/**
 * Resource data with `feed_url` in canonical form (userinfo removed), so the server hash matches
 * every device. A `feed_url` that is not an http(s) URL is dropped rather than sent as typed.
 */
export function withCanonicalAddByRssFeedUrl<T extends object>(resourceData: T): T {
  if (!('feed_url' in resourceData) || typeof resourceData.feed_url !== 'string') {
    return resourceData;
  }
  const feedUrl = canonicalAddByRSSFeedUrl(resourceData.feed_url);
  if (feedUrl === resourceData.feed_url) {
    return resourceData;
  }
  return { ...resourceData, feed_url: feedUrl ?? undefined };
}

/** True when the resource data describes a livestream rather than an episode or track. */
export function isAddByRssLivestreamResourceData(resourceData: AddByRSSResourceData): boolean {
  return (
    (resourceData.liveItem !== undefined && resourceData.liveItem !== null) ||
    (resourceData.livestream_item !== undefined && resourceData.livestream_item !== null)
  );
}
