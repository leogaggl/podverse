import { describe, expect, it } from 'vitest';

import type { HomeSortOption } from '../../prefs/homeListPrefs';
import type { HomeItemMergeEntry } from './homeItemMerge';
import { HOME_ADD_BY_RSS_ITEM_LIMIT, mergeHomeItemRows, readItemPubDateMs } from './homeItemMerge';

const entry = (id: string, pubDateMs: number | null, title = id): HomeItemMergeEntry => ({
  pubDateMs,
  row: {
    id,
    imageUrl: null,
    subtitle: null,
    title,
  },
});

const ids = (rows: { id: string }[]): string[] => rows.map((row) => row.id);

describe('mergeHomeItemRows', () => {
  const directory = [entry('dir-z', 1, 'Zebra'), entry('dir-a', 9, 'Apple')];
  const sorts: HomeSortOption[] = ['recent', 'alphabetical', 'popularity'];

  it('returns the directory rows unchanged when there are no Add by RSS entries', () => {
    const expected = directory.map((item) => item.row);
    for (const sort of sorts) {
      expect(mergeHomeItemRows({ addByRss: [], directory, sort })).toEqual(expected);
    }
  });

  it('keeps every directory row and only the newest Add by RSS window', () => {
    const addByRss = Array.from({ length: HOME_ADD_BY_RSS_ITEM_LIMIT + 10 }, (_, index) =>
      entry(`rss-${index + 1}`, index + 1)
    );

    const rows = mergeHomeItemRows({ addByRss, directory, sort: 'recent' });
    const rowIds = ids(rows);

    expect(rows).toHaveLength(directory.length + HOME_ADD_BY_RSS_ITEM_LIMIT);
    expect(rowIds).toEqual(expect.arrayContaining(['dir-z', 'dir-a']));
    expect(rowIds).toContain(`rss-${HOME_ADD_BY_RSS_ITEM_LIMIT + 10}`);
    for (let index = 1; index <= 10; index += 1) {
      expect(rowIds).not.toContain(`rss-${index}`);
    }
  });

  it('interleaves Recent by date and puts rows without a date last', () => {
    const rows = mergeHomeItemRows({
      addByRss: [entry('rss-dated', 200, 'Dated'), entry('rss-undated', null, 'Undated RSS')],
      directory: [
        entry('dir-newest', 300, 'Newest'),
        entry('dir-undated', null, 'Undated Directory'),
        entry('dir-older', 100, 'Older'),
      ],
      sort: 'recent',
    });

    expect(ids(rows)).toEqual([
      'dir-newest',
      'rss-dated',
      'dir-older',
      'dir-undated',
      'rss-undated',
    ]);
  });

  it('sorts A-Z without a leading article', () => {
    const rows = mergeHomeItemRows({
      addByRss: [entry('rss-apple', 1, 'The Apple')],
      directory: [entry('dir-banana', 2, 'Banana')],
      sort: 'alphabetical',
    });

    expect(ids(rows)).toEqual(['rss-apple', 'dir-banana']);
  });

  it('lists Popularity as directory order, then Add by RSS rows newest first', () => {
    const rows = mergeHomeItemRows({
      addByRss: [entry('rss-old', 1, 'Old'), entry('rss-new', 100, 'New')],
      directory,
      sort: 'popularity',
    });

    expect(ids(rows)).toEqual(['dir-z', 'dir-a', 'rss-new', 'rss-old']);
  });
});

describe('readItemPubDateMs', () => {
  it('reads a number, an ISO string, and a Date, and rejects an unreadable string', () => {
    const iso = '2026-03-04T12:00:00.000Z';
    const date = new Date(iso);

    expect(readItemPubDateMs(1_700_000_000_000)).toBe(1_700_000_000_000);
    expect(readItemPubDateMs(iso)).toBe(Date.parse(iso));
    expect(readItemPubDateMs(date)).toBe(date.getTime());
    expect(readItemPubDateMs('x')).toBeNull();
  });
});
