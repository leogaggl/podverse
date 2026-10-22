import { addByRssRepository, subscriptionsRepository } from '../../data/repositories';
import type { AddByRssNeedsCredentialsFeed } from '../../lib/addByRss/credentials';
import type { AddByRssLiveTarget } from '../../lib/addByRss/liveRows';
import type { MobileAddByRSSFeedRecord } from '../../prefs/addByRSSFeeds';
import type {
  AddByRssLibraryMediaType,
  AddByRssLibrarySortOption,
} from '../../prefs/addByRssListPrefs';
import { sortAddByRssHomeEpisodes } from '../home/addByRssHomeDetailData';
import type { AddByRssItemRow } from '../home/addByRssItemRows';
import { listAddByRssItemRows, toAddByRssItemHomeRow } from '../home/addByRssItemRows';
import { listAddByRssUpcomingLiveRows } from '../home/addByRssLiveRows';
import type { HomeFeedRowData } from '../home/homeFeedData';
import { attachSubscriptionMetadataOrBare } from '../home/homeFeedData';

export type AddByRssLibraryFeedResult = {
  needsCredentials: AddByRssNeedsCredentialsFeed<MobileAddByRSSFeedRecord>[];
  rows: HomeFeedRowData[];
  /** Present when the chip is episodes or tracks, keyed by row id for play. */
  itemRowsById: ReadonlyMap<string, AddByRssItemRow>;
  /** Present when the chip is livestreams, keyed by row id for play and the livestream page. */
  liveItemsById: ReadonlyMap<string, AddByRssLiveTarget>;
};

const EMPTY_LIVE_ITEMS: ReadonlyMap<string, AddByRssLiveTarget> = new Map();

const channelKindForMediaType = (
  mediaType: Extract<AddByRssLibraryMediaType, 'podcasts' | 'artists' | 'albums'>
): 'podcasts' | 'artists' | 'albums' => {
  return mediaType;
};

/**
 * Add by RSS library rows for one media-type chip. Channel chips read ready follows only; feeds
 * waiting on a username and password are returned separately for the footer section.
 */
export const fetchAddByRssLibraryFeed = async (
  mediaType: AddByRssLibraryMediaType,
  sort: AddByRssLibrarySortOption
): Promise<AddByRssLibraryFeedResult> => {
  const { needsCredentials, ready } = await addByRssRepository.listFeedsByCredentials();

  if (mediaType === 'livestreams') {
    const rows = await listAddByRssUpcomingLiveRows(ready);
    return {
      itemRowsById: new Map(),
      liveItemsById: new Map(rows.map((row) => [row.id, row.target])),
      needsCredentials: [],
      rows,
    };
  }

  if (mediaType === 'podcasts' || mediaType === 'artists' || mediaType === 'albums') {
    const kind = channelKindForMediaType(mediaType);
    const subscribed = await subscriptionsRepository.list({
      credentials: 'ready',
      filter: 'addByRss',
      kind,
      sort,
    });
    const rows = await attachSubscriptionMetadataOrBare(subscribed, mediaType);
    const filteredNeeds = needsCredentials.filter((item) => {
      const resourceKind =
        item.feed.resourceType === 'artists'
          ? 'artists'
          : item.feed.resourceType === 'albums' || item.feed.resourceType === 'tracks'
            ? 'albums'
            : 'podcasts';
      return resourceKind === kind;
    });
    return {
      itemRowsById: new Map(),
      liveItemsById: EMPTY_LIVE_ITEMS,
      needsCredentials: filteredNeeds,
      rows,
    };
  }

  const itemRows = await listAddByRssItemRows(mediaType, ready);
  const sorted = sortAddByRssHomeEpisodes(itemRows, sort);
  const itemRowsById = new Map<string, AddByRssItemRow>();
  const rows: HomeFeedRowData[] = sorted.map((row) => {
    itemRowsById.set(row.id, row);
    return toAddByRssItemHomeRow(row);
  });

  return { itemRowsById, liveItemsById: EMPTY_LIVE_ITEMS, needsCredentials: [], rows };
};
