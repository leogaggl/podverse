import type { AddByRSSResourceType } from '@podverse/helpers';
import type { AddByRSSMappedFeed } from '@podverse/parser-mapping';
import { getAddByRSSResourceTypeFromMappedFeed } from '@podverse/parser-mapping';

import { safeJsonParse } from '../../data/db/serialization';

/** `kv_meta` key set after stored Add by RSS feeds take their type from the saved bundle. */
export const ADD_BY_RSS_RESOURCE_TYPE_PASS_KEY = 'add_by_rss.resource_type_from_bundle';

export type StoredAddByRssResourceTypeRow = {
  feedUrl: string;
  mappedFeedJson: string | null;
  resourceType: string;
};

export type AddByRssResourceTypeUpdate = {
  feedUrl: string;
  resourceType: AddByRSSResourceType;
};

/**
 * Feeds whose stored bundle's medium maps to a different resource type.
 * A missing or unreadable bundle is left as stored. The result is only `artists`, `albums`,
 * or `podcasts` — the values `getAddByRSSResourceTypeFromMappedFeed` returns.
 */
export const resourceTypeUpdatesFromStoredRows = (
  rows: readonly StoredAddByRssResourceTypeRow[]
): AddByRssResourceTypeUpdate[] => {
  const updates: AddByRssResourceTypeUpdate[] = [];
  for (const row of rows) {
    if (row.mappedFeedJson === null) {
      continue;
    }
    const mappedFeed = safeJsonParse<AddByRSSMappedFeed>(row.mappedFeedJson);
    if (mappedFeed === null) {
      continue;
    }
    const resourceType = getAddByRSSResourceTypeFromMappedFeed(mappedFeed);
    if (resourceType === row.resourceType) {
      continue;
    }
    updates.push({ feedUrl: row.feedUrl, resourceType });
  }
  return updates;
};
