import { describe, expect, it } from 'vitest';

import type { SubscribedChannelEntry } from './mergeSubscribedChannels';
import { mergeSubscribedChannelEntries, toEpochMsOrNull } from './mergeSubscribedChannels';

const entry = (
  item: string,
  title: string,
  lastPubDateMs: number | null
): SubscribedChannelEntry<string> => ({
  item,
  title,
  lastPubDateMs,
});

describe('mergeSubscribedChannelEntries', () => {
  it('places a feed titled "The Beta" between server rows "Alpha" and "Gamma"', () => {
    const merged = mergeSubscribedChannelEntries({
      server: [entry('alpha', 'Alpha', null), entry('gamma', 'Gamma', null)],
      addByRSS: [entry('beta', 'The Beta', null)],
      sort: 'a_z',
    });

    expect(merged).toEqual(['alpha', 'beta', 'gamma']);
  });

  it('interleaves recent rows by date and puts an undated feed after dated server rows', () => {
    const merged = mergeSubscribedChannelEntries({
      server: [entry('newer', 'Newer', 200), entry('older', 'Older', 100)],
      addByRSS: [entry('middle', 'Middle', 150), entry('undated', 'Undated', null)],
      sort: 'recent',
    });

    expect(merged).toEqual(['newer', 'middle', 'older', 'undated']);
  });

  it('puts the oldest feed first and undated rows last', () => {
    const merged = mergeSubscribedChannelEntries({
      server: [entry('later', 'Later', 300)],
      addByRSS: [entry('earliest', 'Earliest', 100), entry('undated', 'Undated', null)],
      sort: 'oldest',
    });

    expect(merged).toEqual(['earliest', 'later', 'undated']);
  });

  it('keeps every server row first under top, then feeds newest first', () => {
    const merged = mergeSubscribedChannelEntries({
      server: [entry('second-ranked', 'Zed', 1), entry('first-ranked', 'Amy', 999)],
      addByRSS: [entry('older-feed', 'Older Feed', 10), entry('newer-feed', 'Newer Feed', 50)],
      sort: 'top',
    });

    expect(merged).toEqual(['second-ranked', 'first-ranked', 'newer-feed', 'older-feed']);
  });

  it('keeps server rows in their given order when that order disagrees with the sort', () => {
    const merged = mergeSubscribedChannelEntries({
      server: [entry('gamma', 'Gamma', null), entry('alpha', 'Alpha', null)],
      addByRSS: [entry('beta', 'The Beta', null)],
      sort: 'a_z',
    });

    expect(merged).toEqual(['beta', 'gamma', 'alpha']);
  });

  it('puts the server row first when a feed has the same sort key', () => {
    const merged = mergeSubscribedChannelEntries({
      server: [entry('server', 'Alpha', null)],
      addByRSS: [entry('feed', 'Alpha', null)],
      sort: 'a_z',
    });

    expect(merged).toEqual(['server', 'feed']);
  });
});

describe('toEpochMsOrNull', () => {
  it('reads a Date, an ISO string, null, and an invalid string', () => {
    const date = new Date('2024-05-01T12:00:00.000Z');

    expect(toEpochMsOrNull(date)).toBe(date.getTime());
    expect(toEpochMsOrNull('2024-05-01T12:00:00.000Z')).toBe(date.getTime());
    expect(toEpochMsOrNull(null)).toBeNull();
    expect(toEpochMsOrNull('not-a-date')).toBeNull();
  });
});
