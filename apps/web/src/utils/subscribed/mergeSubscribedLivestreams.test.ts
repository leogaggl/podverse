import { describe, expect, it } from 'vitest';

import type { DTOItem } from '@podverse/helpers';
import { LiveItemStatusEnum } from '@podverse/helpers';

import type { AddByRSSLivestreamIndexItem } from '../addByRSS/types';
import type { SubscribedLivestreamEntry } from './mergeSubscribedLivestreams';
import {
  mergeSubscribedLivestreamEntries,
  selectUpcomingAddByRSSLivestreams,
} from './mergeSubscribedLivestreams';

const serverItem = (id: number, statusId: LiveItemStatusEnum, startTimeMs: number): DTOItem => ({
  id,
  id_text: `server-${id}`,
  channel_id: 1,
  pub_date: null,
  item_flag_status_id: 1,
  item_about: { id: 1, item_id: id },
  item_chat: { id: 1, item_id: id, server: '' },
  item_license: { id: 1, item_id: id, identifier: '', url: null },
  item_location: { id: 1, item_id: id, name: null },
  item_season: { id: 1, item_id: id, channel_season_id: 1, title: null },
  item_content_links: [],
  item_enclosures: [],
  item_fundings: [],
  item_images: [],
  item_persons: [],
  item_social_interacts: [],
  item_soundbites: [],
  item_transcripts: [],
  item_txts: [],
  item_values: [],
  live_item: {
    id: 1,
    item_id: id,
    live_item_status: { id: statusId },
    live_item_status_id: statusId,
    start_time: new Date(startTimeMs).toISOString(),
  },
});

/** The selectors read status, start time, channel, and id. The rest of the index item is omitted. */
const rssItem = (
  id: string,
  channelIdText: string,
  statusId: LiveItemStatusEnum,
  startTimeMs: number
): AddByRSSLivestreamIndexItem =>
  ({
    id,
    channelIdText,
    startTimeMs,
    liveItem: { live_item_status: statusId },
  }) as AddByRSSLivestreamIndexItem;

const labels = (entries: SubscribedLivestreamEntry[]): string[] =>
  entries.map((entry) => `${entry.source}:${entry.item.id}`);

describe('selectUpcomingAddByRSSLivestreams', () => {
  it('keeps upcoming items of flagged feeds, live before scheduled, undated scheduled last', () => {
    const selected = selectUpcomingAddByRSSLivestreams(
      [
        rssItem('ended', 'flagged', LiveItemStatusEnum.Ended, 1000),
        rssItem('other-feed', 'other', LiveItemStatusEnum.Live, 1000),
        rssItem('scheduled-negative', 'flagged', LiveItemStatusEnum.Pending, -1),
        rssItem('scheduled-zero', 'flagged', LiveItemStatusEnum.Pending, 0),
        rssItem('scheduled', 'flagged', LiveItemStatusEnum.Pending, 5000),
        rssItem('live', 'flagged', LiveItemStatusEnum.Live, 9000),
      ],
      new Set(['flagged'])
    );

    expect(selected.map((item) => item.id)).toEqual([
      'live',
      'scheduled',
      'scheduled-negative',
      'scheduled-zero',
    ]);
  });
});

describe('mergeSubscribedLivestreamEntries', () => {
  it('orders page 1 live before scheduled, and keeps the server row when the keys match', () => {
    const merged = mergeSubscribedLivestreamEntries({
      serverItems: [
        serverItem(1, LiveItemStatusEnum.Live, 3000),
        serverItem(2, LiveItemStatusEnum.Live, 2000),
      ],
      addByRSSItems: [
        rssItem('rss-live-earlier', 'flagged', LiveItemStatusEnum.Live, 1000),
        rssItem('rss-live-same', 'flagged', LiveItemStatusEnum.Live, 2000),
        rssItem('rss-scheduled', 'flagged', LiveItemStatusEnum.Pending, 100),
      ],
      page: 1,
    });

    expect(labels(merged)).toEqual([
      'add-by-rss:rss-live-earlier',
      'server:2',
      'add-by-rss:rss-live-same',
      'server:1',
      'add-by-rss:rss-scheduled',
    ]);
  });

  it('returns server rows only, in server order, on a later page', () => {
    const merged = mergeSubscribedLivestreamEntries({
      serverItems: [
        serverItem(1, LiveItemStatusEnum.Pending, 100),
        serverItem(2, LiveItemStatusEnum.Live, 50),
      ],
      addByRSSItems: [rssItem('rss-live', 'flagged', LiveItemStatusEnum.Live, 1)],
      page: 2,
    });

    expect(labels(merged)).toEqual(['server:1', 'server:2']);
  });

  it('returns server rows only when there are no Add by RSS items', () => {
    const merged = mergeSubscribedLivestreamEntries({
      serverItems: [serverItem(1, LiveItemStatusEnum.Pending, 100)],
      addByRSSItems: [],
      page: 1,
    });

    expect(labels(merged)).toEqual(['server:1']);
  });
});
