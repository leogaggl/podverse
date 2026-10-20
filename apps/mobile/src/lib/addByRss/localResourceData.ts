import { getAddByRSSHashId } from '@podverse/helpers';
import type { AddByRSSResourceData } from '@podverse/helpers/dto';
import { toNonEmptyTrimmedString } from '@podverse/helpers/guards';
import type { AddByRSSMappedFeed } from '@podverse/parser-mapping';

import type { MobileAddByRSSFeedRecord } from '../../prefs/addByRSSFeeds';
import { toAddByRssItemPlaybackResourceData } from './domain';
import { isAddByRssLivestreamResourceData, withCanonicalAddByRssFeedUrl } from './resourceData';

export type LocalAddByRssFeedLookup = {
  getFeedByUrl: (feedUrl: string) => Promise<MobileAddByRSSFeedRecord | null>;
  getMappedFeedByUrl: (feedUrl: string) => Promise<AddByRSSMappedFeed | null>;
};

const findLocalItemIndex = (
  mappedFeed: AddByRSSMappedFeed,
  guid: string | null,
  enclosureUrl: string | null
): number => {
  if (guid !== null) {
    const byGuid = mappedFeed.items.findIndex((bundle) => bundle.item.guid === guid);
    if (byGuid >= 0) {
      return byGuid;
    }
  }
  if (enclosureUrl === null) {
    return -1;
  }
  return mappedFeed.items.findIndex((bundle) =>
    bundle.enclosures.some((enclosure) =>
      enclosure.item_enclosure_sources.some((source) => source.uri === enclosureUrl)
    )
  );
};

/**
 * Resource data for playing a server Add by RSS row on this device. When this device has parsed the
 * same feed, its own copy of the episode plays (matched by canonical feed URL, then guid or
 * enclosure, and confirmed by id). Otherwise the row's resource data plays as stored, so an episode
 * started on another device resumes here before this device has parsed that feed.
 */
export async function resolveLocalAddByRssResourceData(
  resourceData: AddByRSSResourceData,
  lookup: LocalAddByRssFeedLookup
): Promise<AddByRSSResourceData> {
  const rowData = withCanonicalAddByRssFeedUrl(resourceData);
  if (isAddByRssLivestreamResourceData(rowData)) {
    return rowData;
  }
  const feedUrl = toNonEmptyTrimmedString(rowData.feed_url);
  if (feedUrl === null) {
    return rowData;
  }

  let record: MobileAddByRSSFeedRecord | null;
  let mappedFeed: AddByRSSMappedFeed | null;
  try {
    [record, mappedFeed] = await Promise.all([
      lookup.getFeedByUrl(feedUrl),
      lookup.getMappedFeedByUrl(feedUrl),
    ]);
  } catch {
    return rowData;
  }
  if (record === null || mappedFeed === null) {
    return rowData;
  }

  const itemIndex = findLocalItemIndex(
    mappedFeed,
    toNonEmptyTrimmedString(rowData.guid),
    toNonEmptyTrimmedString(rowData.enclosure_url)
  );
  const itemBundle = mappedFeed.items[itemIndex];
  if (itemBundle === undefined) {
    return rowData;
  }

  const localData = toAddByRssItemPlaybackResourceData(record, mappedFeed, itemBundle, itemIndex);
  return getAddByRSSHashId(localData) === getAddByRSSHashId(rowData) ? localData : rowData;
}
