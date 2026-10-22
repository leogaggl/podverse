import { describe, expect, it } from 'vitest';

import type { DTOItem } from '@podverse/helpers';

import type { AddByRSSItemIndexItem } from '../addByRSS/types';
import type { SubscribedItemEntry } from './mergeSubscribedItems';
import { mergeSubscribedItemEntries } from './mergeSubscribedItems';

const serverItem = (id: number, pubDateMs: number | null): DTOItem => ({
  id,
  id_text: `server-${id}`,
  channel_id: 1,
  pub_date: pubDateMs === null ? null : new Date(pubDateMs).toISOString(),
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
});

/** The merge reads `pubDateMs` only, so the rest of the index item is omitted. */
const rssItem = (id: string, pubDateMs: number): AddByRSSItemIndexItem =>
  ({ id, pubDateMs }) as AddByRSSItemIndexItem;

const labels = (entries: SubscribedItemEntry[]): string[] =>
  entries.map((entry) => `${entry.source}:${entry.item.id}`);

describe('mergeSubscribedItemEntries', () => {
  it('puts a newer Add by RSS item before an older server row, and an undated item last', () => {
    const merged = mergeSubscribedItemEntries({
      serverItems: [serverItem(1, 300), serverItem(2, 100)],
      addByRSSItems: [rssItem('undated', 0), rssItem('newer', 400)],
      sort: 'recent',
      page: 1,
      totalPages: 4,
    });

    expect(labels(merged)).toEqual([
      'add-by-rss:newer',
      'server:1',
      'server:2',
      'add-by-rss:undated',
    ]);
  });

  it('returns server rows only on a later Recent page', () => {
    const merged = mergeSubscribedItemEntries({
      serverItems: [serverItem(1, 100)],
      addByRSSItems: [rssItem('newer', 900)],
      sort: 'recent',
      page: 2,
      totalPages: 4,
    });

    expect(labels(merged)).toEqual(['server:1']);
  });

  it('keeps server rows in their order, then Add by RSS items, on the last Top page', () => {
    const merged = mergeSubscribedItemEntries({
      serverItems: [serverItem(2, 1), serverItem(1, 999)],
      addByRSSItems: [rssItem('newer', 50), rssItem('older', 10)],
      sort: 'top',
      page: 2,
      totalPages: 2,
    });

    expect(labels(merged)).toEqual([
      'server:2',
      'server:1',
      'add-by-rss:newer',
      'add-by-rss:older',
    ]);
  });

  it('returns server rows only on an earlier Top page', () => {
    const merged = mergeSubscribedItemEntries({
      serverItems: [serverItem(1, 100)],
      addByRSSItems: [rssItem('newer', 900)],
      sort: 'top',
      page: 1,
      totalPages: 3,
    });

    expect(labels(merged)).toEqual(['server:1']);
  });

  it('returns only Add by RSS items, newest first, when Top has no server rows', () => {
    const merged = mergeSubscribedItemEntries({
      serverItems: [],
      addByRSSItems: [rssItem('newer', 50), rssItem('older', 10)],
      sort: 'top',
      page: 1,
      totalPages: 1,
    });

    expect(labels(merged)).toEqual(['add-by-rss:newer', 'add-by-rss:older']);
  });

  it('puts the server row first when the dates match', () => {
    const merged = mergeSubscribedItemEntries({
      serverItems: [serverItem(1, 200)],
      addByRSSItems: [rssItem('same-date', 200)],
      sort: 'recent',
      page: 1,
      totalPages: 1,
    });

    expect(labels(merged)).toEqual(['server:1', 'add-by-rss:same-date']);
  });
});
