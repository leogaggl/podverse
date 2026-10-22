import { addByRssRepository } from '../../data/repositories';
import type { AddByRssLiveRow } from '../../lib/addByRss/liveRows';
import { toAddByRssLiveRows } from '../../lib/addByRss/liveRows';
import { sortUpcomingLiveRows } from '../../lib/rows/liveItemRows';
import type { MobileAddByRSSFeedRecord } from '../../prefs/addByRSSFeeds';

/** Upcoming live rows of ready, flagged Add by RSS feeds, live first. */
export const listAddByRssUpcomingLiveRows = async (
  readyFeeds: readonly MobileAddByRSSFeedRecord[]
): Promise<AddByRssLiveRow[]> => {
  const rows: AddByRssLiveRow[] = [];

  for (const feed of readyFeeds) {
    if (feed.mayHaveLivestreams !== true) {
      continue;
    }
    const mappedFeed = await addByRssRepository.getMappedFeedByUrl(feed.feedUrl);
    if (mappedFeed === null) {
      continue;
    }
    rows.push(...toAddByRssLiveRows(feed, mappedFeed));
  }

  return sortUpcomingLiveRows(rows);
};
