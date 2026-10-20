import { canonicalAddByRSSFeedUrl } from '@podverse/helpers-validation';

/**
 * Canonicalizes `feed_url` in an Add by RSS payload before it is hashed or stored, so every device
 * produces the same add_by_rss_hash_id and no stored payload carries `user:pass@`. A `feed_url`
 * that is not a usable http(s) URL is dropped, which leaves the payload in the legacy hash form.
 */
export function normalizeAddByRSSResourceData(data: object): object {
  if (!('feed_url' in data)) {
    return data;
  }
  const { feed_url: feedUrl, ...rest } = data;
  const canonical = typeof feedUrl === 'string' ? canonicalAddByRSSFeedUrl(feedUrl) : null;
  return canonical === null ? rest : { ...rest, feed_url: canonical };
}
