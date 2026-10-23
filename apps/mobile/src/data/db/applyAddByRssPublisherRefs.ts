import { eq, isNotNull } from 'drizzle-orm';

import {
  ADD_BY_RSS_PUBLISHER_REFS_PASS_KEY,
  publisherRefUpdatesFromStoredRows,
} from '../../lib/addByRss/publisherRefs';
import { getDb } from './client';
import * as schema from './schema';

/**
 * Writes `podcast_guid` and `publisher_guids_json` from each stored Add by RSS bundle once, when
 * the database opens. Later opens find the marker and return. A later parse sets both columns in
 * `upsertFeed`. A throw before the marker is written leaves it unset, so the next open retries.
 * No network request is made.
 */
export const applyAddByRssPublisherRefs = async (): Promise<void> => {
  const markerRows = await getDb()
    .select({ key: schema.kvMeta.key })
    .from(schema.kvMeta)
    .where(eq(schema.kvMeta.key, ADD_BY_RSS_PUBLISHER_REFS_PASS_KEY))
    .limit(1);
  if (markerRows.length > 0) {
    return;
  }

  const rows = await getDb()
    .select({
      feedUrl: schema.addByRssFeed.feedUrl,
      mappedFeedJson: schema.addByRssFeed.mappedFeedJson,
    })
    .from(schema.addByRssFeed)
    .where(isNotNull(schema.addByRssFeed.mappedFeedJson));

  const updates = publisherRefUpdatesFromStoredRows(rows);
  for (const update of updates) {
    await getDb()
      .update(schema.addByRssFeed)
      .set({ podcastGuid: update.podcastGuid, publisherGuidsJson: update.publisherGuidsJson })
      .where(eq(schema.addByRssFeed.feedUrl, update.feedUrl));
  }

  const updatedAt = Date.now();
  await getDb()
    .insert(schema.kvMeta)
    .values({ key: ADD_BY_RSS_PUBLISHER_REFS_PASS_KEY, updatedAt, value: '1' })
    .onConflictDoUpdate({
      target: schema.kvMeta.key,
      set: { updatedAt, value: '1' },
    });
};
