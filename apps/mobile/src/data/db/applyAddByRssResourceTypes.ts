import { eq, isNotNull } from 'drizzle-orm';

import {
  ADD_BY_RSS_RESOURCE_TYPE_PASS_KEY,
  resourceTypeUpdatesFromStoredRows,
} from '../../lib/addByRss/storedResourceType';
import { getDb } from './client';
import * as schema from './schema';

/**
 * Applies the medium on each stored Add by RSS bundle to `resource_type` once, when the database
 * opens. Later opens find the marker and return. A later parse sets the type in `upsertFeed`.
 * A throw before the marker is written leaves it unset, so the next open retries. No network
 * request is made.
 */
export const applyAddByRssResourceTypes = async (): Promise<void> => {
  const markerRows = await getDb()
    .select({ key: schema.kvMeta.key })
    .from(schema.kvMeta)
    .where(eq(schema.kvMeta.key, ADD_BY_RSS_RESOURCE_TYPE_PASS_KEY))
    .limit(1);
  if (markerRows.length > 0) {
    return;
  }

  const rows = await getDb()
    .select({
      feedUrl: schema.addByRssFeed.feedUrl,
      mappedFeedJson: schema.addByRssFeed.mappedFeedJson,
      resourceType: schema.addByRssFeed.resourceType,
    })
    .from(schema.addByRssFeed)
    .where(isNotNull(schema.addByRssFeed.mappedFeedJson));

  const updates = resourceTypeUpdatesFromStoredRows(rows);
  for (const update of updates) {
    await getDb()
      .update(schema.addByRssFeed)
      .set({ resourceType: update.resourceType })
      .where(eq(schema.addByRssFeed.feedUrl, update.feedUrl));
  }

  const updatedAt = Date.now();
  await getDb()
    .insert(schema.kvMeta)
    .values({ key: ADD_BY_RSS_RESOURCE_TYPE_PASS_KEY, updatedAt, value: '1' })
    .onConflictDoUpdate({
      target: schema.kvMeta.key,
      set: { updatedAt, value: '1' },
    });
};
