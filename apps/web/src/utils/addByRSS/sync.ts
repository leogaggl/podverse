import { createAddByRSSId, createAddByRSSIdText } from '@podverse/helpers';

import { trackBackgroundActivity } from '../backgroundActivity/backgroundActivityStore';
import { getFollowedAddByRSSChannels } from './api';
import { emitAddByRSSFeedChanged } from './feedChangedEvent';
import { pruneAddByRSSPublisherData } from './listedFeeds';
import {
  bulkRemoveAddByRSSFeeds,
  clearAddByRSSItemsIndex,
  getAllAddByRSSFeeds,
  insertMissingAddByRSSFeeds,
  patchAddByRSSFollowMetadata,
} from './storage';
import type { AddByRSSFeedRecord } from './types';

/**
 * Syncs the Add by RSS IndexedDB cache with the server: removes feeds that are not
 * followed by the account, and clears the items index when a feed is removed so
 * stale items are not shown. An unfollowed artist's link goes too, with the listed albums
 * no remaining artist lists.
 */
export async function syncAddByRSSCacheWithServer(accountIdText: string): Promise<void> {
  await trackBackgroundActivity('add_by_rss_refresh', { counted: false }, async () => {
    const remote = await getFollowedAddByRSSChannels(accountIdText);
    const existing = await getAllAddByRSSFeeds();
    const remoteUrls = new Set(remote.map((c) => c.feed_url));
    const toRemove = existing
      .filter((feed) => !remoteUrls.has(feed.feedUrl))
      .map((feed) => feed.idText);

    if (toRemove.length > 0) {
      await bulkRemoveAddByRSSFeeds(toRemove);
      await clearAddByRSSItemsIndex();
      await pruneAddByRSSPublisherData();
    }
  });
}

/**
 * Makes this browser's stored feeds match the account's follows: drops unfollowed feeds and adds a
 * stub for each follow it has not seen. A stub that has not been parsed takes the follow row's
 * title and artwork, which the server fills in after any device parses the feed. A parsed feed
 * keeps the title and artwork from its own parse. A stub is stored only when no row has its URL,
 * so syncs that overlap, in this tab or another, never collide on the feed URL index. An
 * unfollowed artist's link goes too, with the listed albums no remaining artist lists.
 */
export async function syncAddByRSSFollowStubs(accountIdText: string): Promise<void> {
  await trackBackgroundActivity('add_by_rss_refresh', { counted: false }, async () => {
    const remote = await getFollowedAddByRSSChannels(accountIdText);
    const existing = await getAllAddByRSSFeeds();
    const remoteUrls = new Set(remote.map((channel) => channel.feed_url));
    const toRemove = existing
      .filter((feed) => !remoteUrls.has(feed.feedUrl))
      .map((feed) => feed.idText);
    const existingByUrl = new Map(existing.map((feed) => [feed.feedUrl, feed]));
    const now = new Date().toISOString();
    const inserts: AddByRSSFeedRecord[] = [];
    const patches: {
      feedUrl: string;
      title: string | null;
      imageUrl: string | null;
      requiresCredentials: boolean;
    }[] = [];

    for (const channel of remote) {
      if (!existingByUrl.has(channel.feed_url)) {
        const idText = createAddByRSSIdText();
        inserts.push({
          id: createAddByRSSId(idText),
          idText,
          resourceType: 'podcasts',
          feedUrl: channel.feed_url,
          title: channel.title ?? channel.feed_url,
          imageUrl: channel.image_url ?? null,
          updatedAt: now,
          requiresCredentials: channel.requires_credentials === true,
        });
        continue;
      }
      patches.push({
        feedUrl: channel.feed_url,
        title: channel.title ?? null,
        imageUrl: channel.image_url ?? null,
        requiresCredentials: channel.requires_credentials === true,
      });
    }

    if (toRemove.length > 0) {
      await bulkRemoveAddByRSSFeeds(toRemove);
      await clearAddByRSSItemsIndex();
      await pruneAddByRSSPublisherData();
    }

    const changedFeedUrls = await patchAddByRSSFollowMetadata(patches);
    await insertMissingAddByRSSFeeds(inserts);

    for (const feedUrl of changedFeedUrls) {
      emitAddByRSSFeedChanged(feedUrl);
    }
  });
}
