import type { ChannelLiveItemSortKey } from '@podverse/helpers';
import {
  compareChannelLiveItems,
  isLiveItemEndedAndStale,
  LiveItemStatusEnum,
} from '@podverse/helpers';
import { toNonEmptyTrimmedString } from '@podverse/helpers/guards';
import type { AddByRSSMappedFeed } from '@podverse/parser-mapping';
import { toLiveIndexItem } from '@podverse/parser-mapping';

import type { MobileAddByRSSFeedRecord } from '../../prefs/addByRSSFeeds';
import type { HomeFeedRowData } from '../../screens/home/homeFeedData';
import type { UpcomingLiveRow } from '../rows/liveItemRows';
import { toUpcomingLiveRow } from '../rows/liveItemRows';
import { toAddByRssLiveItemPlaybackResourceData } from './domain';
import { addByRssPlaybackMediaId } from './resourceData';

export type AddByRssLiveTarget = {
  feed: MobileAddByRSSFeedRecord;
  mappedFeed: AddByRSSMappedFeed;
  liveBundle: AddByRSSMappedFeed['liveItems'][number];
  liveIndex: number;
};

/** A livestream row for one stored feed. `liveStatusId` is live, scheduled, or ended. */
export type AddByRssLiveRow = UpcomingLiveRow & { target: AddByRssLiveTarget };

type AddByRssLiveBaseRow = HomeFeedRowData & { target: AddByRssLiveTarget };

/** Epoch milliseconds, or null when the value is missing or does not parse. */
const toFiniteTimeMs = (value: Date | string | number | null | undefined): number | null => {
  if (value === null || value === undefined) {
    return null;
  }
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : null;
  }
  const parsed = value instanceof Date ? value.getTime() : Date.parse(value);
  return Number.isFinite(parsed) ? parsed : null;
};

/** A row start: milliseconds after the epoch, or null. Non-positive times count as missing. */
const toRowStartTimeMs = (value: Date | string | number | null | undefined): number | null => {
  const ms = toFiniteTimeMs(value);
  if (ms === null || ms <= 0) {
    return null;
  }
  return ms;
};

const isListedChannelLiveStatus = (
  statusId: LiveItemStatusEnum | null | undefined
): statusId is LiveItemStatusEnum.Live | LiveItemStatusEnum.Pending | LiveItemStatusEnum.Ended =>
  statusId === LiveItemStatusEnum.Live ||
  statusId === LiveItemStatusEnum.Pending ||
  statusId === LiveItemStatusEnum.Ended;

const toAddByRssLiveBaseRow = (
  feed: MobileAddByRSSFeedRecord,
  mappedFeed: AddByRSSMappedFeed,
  liveBundle: AddByRSSMappedFeed['liveItems'][number],
  liveIndex: number
): AddByRssLiveBaseRow | null => {
  const feedForIndex = {
    feedUrl: feed.feedUrl,
    id: feed.id,
    idText: feed.idText,
    imageUrl: feed.imageUrl,
    mappedFeed,
    title: feed.title,
  };
  const indexItem = toLiveIndexItem(feedForIndex, liveBundle, liveIndex, feed.idText);
  const itemTitle = toNonEmptyTrimmedString(liveBundle.item.title);
  const feedTitle = toNonEmptyTrimmedString(feed.title);

  return {
    id: indexItem.id,
    imageUrl: indexItem.channelImageUrl ?? null,
    playbackMediaId: addByRssPlaybackMediaId(
      toAddByRssLiveItemPlaybackResourceData(feed, mappedFeed, liveBundle, liveIndex)
    ),
    source: 'addByRss',
    sourceId: feed.idText,
    subtitle: indexItem.channelTitle,
    target: { feed, liveBundle, liveIndex, mappedFeed },
    title: itemTitle ?? feedTitle ?? feed.feedUrl,
  };
};

/**
 * Upcoming live rows of one stored feed, unsorted; ended items, scheduled items more than a day
 * past, and unreadable items are skipped.
 */
export const toAddByRssLiveRows = (
  feed: MobileAddByRSSFeedRecord,
  mappedFeed: AddByRSSMappedFeed,
  now: Date = new Date()
): AddByRssLiveRow[] => {
  const rows: AddByRssLiveRow[] = [];
  for (let liveIndex = 0; liveIndex < mappedFeed.liveItems.length; liveIndex += 1) {
    const liveBundle = mappedFeed.liveItems[liveIndex];
    if (liveBundle === undefined) {
      continue;
    }

    const base = toAddByRssLiveBaseRow(feed, mappedFeed, liveBundle, liveIndex);
    if (base === null) {
      continue;
    }

    const { target, ...row } = base;
    const upcoming = toUpcomingLiveRow(
      row,
      liveBundle.liveItem.live_item_status,
      liveBundle.liveItem.start_time,
      now
    );
    if (upcoming === null) {
      continue;
    }

    rows.push({
      ...upcoming,
      target,
    });
  }

  return rows;
};

const toChannelSortKey = (
  liveItem: AddByRSSMappedFeed['liveItems'][number]['liveItem']
): ChannelLiveItemSortKey => ({
  endTimeMs: toFiniteTimeMs(liveItem.end_time),
  startTimeMs: toFiniteTimeMs(liveItem.start_time),
  statusId: liveItem.live_item_status,
});

/**
 * The feed page's live rows, in the channel order: live, scheduled, then ended within a day.
 * Older ended items, scheduled items more than a day past, and unknown statuses are skipped.
 */
export const toAddByRssFeedLiveRows = (
  feed: MobileAddByRSSFeedRecord,
  mappedFeed: AddByRSSMappedFeed,
  now: Date = new Date()
): AddByRssLiveRow[] => {
  const pairs: { key: ChannelLiveItemSortKey; row: AddByRssLiveRow }[] = [];

  for (let liveIndex = 0; liveIndex < mappedFeed.liveItems.length; liveIndex += 1) {
    const liveBundle = mappedFeed.liveItems[liveIndex];
    if (liveBundle === undefined) {
      continue;
    }

    const liveItem = liveBundle.liveItem;
    const statusId = liveItem.live_item_status;
    if (!isListedChannelLiveStatus(statusId)) {
      continue;
    }

    if (
      isLiveItemEndedAndStale(
        {
          end_time: liveItem.end_time,
          live_item_status_id: statusId,
          start_time: liveItem.start_time,
        },
        now
      )
    ) {
      continue;
    }

    const base = toAddByRssLiveBaseRow(feed, mappedFeed, liveBundle, liveIndex);
    if (base === null) {
      continue;
    }

    const key = toChannelSortKey(liveItem);
    if (statusId === LiveItemStatusEnum.Ended) {
      const startTimeMs = toRowStartTimeMs(liveItem.start_time);
      pairs.push({
        key,
        row: {
          ...base,
          liveStatusId: LiveItemStatusEnum.Ended,
          playable: false,
          startTimeMs,
          updatedAt: startTimeMs,
        },
      });
      continue;
    }

    const { target, ...row } = base;
    const upcoming = toUpcomingLiveRow(row, statusId, liveItem.start_time, now);
    if (upcoming === null) {
      continue;
    }

    pairs.push({
      key,
      row: { ...upcoming, target },
    });
  }

  pairs.sort((left, right) => compareChannelLiveItems(left.key, right.key));
  return pairs.map((pair) => pair.row);
};
