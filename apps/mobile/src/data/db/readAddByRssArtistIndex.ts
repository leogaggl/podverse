import { toAddByRSSResourceType } from '@podverse/parser-mapping';

import { hydrateAddByRssArtistIndex } from '../../lib/addByRss/addByRssArtistIndex';
import {
  parseStoredPublisherDirectoryMatches,
  parseStoredPublisherGuids,
} from '../../lib/addByRss/publisherRefs';
import { rowToListedFeedRecord } from '../repositories/addByRssListedFeeds';
import { getDb } from './client';
import * as schema from './schema';

/**
 * Rebuilds the in-memory Add by RSS artist index from SQLite. Reads only the relation columns,
 * never the mapped bundle. Callers have already opened the database.
 */
export const reloadAddByRssArtistIndex = async (): Promise<void> => {
  const [feedRows, listedRows] = await Promise.all([
    getDb()
      .select({
        feedUrl: schema.addByRssFeed.feedUrl,
        idText: schema.addByRssFeed.idText,
        title: schema.addByRssFeed.title,
        resourceType: schema.addByRssFeed.resourceType,
        followed: schema.addByRssFeed.followed,
        podcastGuid: schema.addByRssFeed.podcastGuid,
        publisherGuidsJson: schema.addByRssFeed.publisherGuidsJson,
        publisherDirectoryJson: schema.addByRssFeed.publisherDirectoryJson,
      })
      .from(schema.addByRssFeed),
    getDb().select().from(schema.addByRssListedFeed),
  ]);

  hydrateAddByRssArtistIndex({
    feeds: feedRows.map((row) => ({
      feedUrl: row.feedUrl,
      feedIdText: row.idText,
      title: row.title ?? row.feedUrl,
      resourceType: toAddByRSSResourceType(row.resourceType),
      followed: row.followed === 1,
      podcastGuid: row.podcastGuid,
      publisherGuids: parseStoredPublisherGuids(row.publisherGuidsJson),
      directoryMatches: parseStoredPublisherDirectoryMatches(row.publisherDirectoryJson),
    })),
    listings: listedRows.map(rowToListedFeedRecord),
  });
};
