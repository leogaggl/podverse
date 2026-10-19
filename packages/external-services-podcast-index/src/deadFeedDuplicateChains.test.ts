import { Readable } from 'node:stream';

import { describe, expect, it } from 'vitest';

import type { DeadFeedCsvRow } from './deadFeedDuplicateChains.js';
import {
  deadFeedPairsWeHold,
  deadFeedTargetMap,
  extractDeadFeedCsvRow,
  forEachDeadFeedCsvRow,
  podcastIndexIdsToRetire,
  resolveDeadFeedDuplicateChains,
  retireGrowthExceedsBrake,
} from './deadFeedDuplicateChains.js';

const FIXTURE = ['1,10', '2,1', '3,2', '4,', '5,6', '6,5', '7,8', '8,', '9,20'].join('\n');

async function rowsFromCsv(text: string): Promise<DeadFeedCsvRow[]> {
  const rows: DeadFeedCsvRow[] = [];
  await forEachDeadFeedCsvRow(Readable.from(`${text}\n`), (cells) => {
    const parsed = extractDeadFeedCsvRow(cells);
    if (parsed !== null) {
      rows.push(parsed);
    }
  });
  return rows;
}

describe('dead feed duplicate chains', () => {
  it('follows a chain and skips cycles, dead survivors, and empty duplicate columns', async () => {
    const rows = await rowsFromCsv(FIXTURE);
    const resolved = resolveDeadFeedDuplicateChains(deadFeedTargetMap(rows));

    expect(resolved.get(1)).toBe(10);
    expect(resolved.get(2)).toBe(10);
    expect(resolved.get(3)).toBe(10);
    expect(resolved.get(9)).toBe(20);
    expect(resolved.has(4)).toBe(false);
    expect(resolved.has(5)).toBe(false);
    expect(resolved.has(6)).toBe(false);
    expect(resolved.has(7)).toBe(false);
    expect(resolved.has(8)).toBe(false);
  });

  it('keeps a pair only when we already store the dead id', async () => {
    const rows = await rowsFromCsv(FIXTURE);
    const resolved = resolveDeadFeedDuplicateChains(deadFeedTargetMap(rows));
    const pairs = deadFeedPairsWeHold(resolved, new Set([3, 9, 20]));

    expect(pairs).toEqual([
      { fromPodcastIndexId: 3, toPodcastIndexId: 10 },
      { fromPodcastIndexId: 9, toPodcastIndexId: 20 },
    ]);
  });

  it('ignores a non-numeric id', () => {
    expect(extractDeadFeedCsvRow(['nope', '10'])).toBeNull();
    expect(extractDeadFeedCsvRow(['12', ''])).toEqual({
      id_to_archive: 12,
      duplicate_id_to_keep: null,
    });
  });

  it('returns held ids with an empty target or a cycle, and omits a resolved pair', () => {
    const targets = new Map<number, number | null>([
      [4, null],
      [5, 6],
      [6, 5],
      [1, 10],
    ]);

    expect(podcastIndexIdsToRetire(targets, new Set([1, 4, 5, 6, 99]))).toEqual([4, 5, 6]);
  });
});

describe('retire growth brake', () => {
  it('refuses a run when there is no stored count', () => {
    expect(
      retireGrowthExceedsBrake({
        eligibleCount: 10,
        previousEligibleCount: null,
        heldCount: 100,
      })
    ).toBe(true);
  });

  it('allows a growth of 2000 and refuses 2001 when 1% of held feeds is smaller', () => {
    expect(
      retireGrowthExceedsBrake({
        eligibleCount: 2000,
        previousEligibleCount: 0,
        heldCount: 100,
      })
    ).toBe(false);
    expect(
      retireGrowthExceedsBrake({
        eligibleCount: 2001,
        previousEligibleCount: 0,
        heldCount: 100,
      })
    ).toBe(true);
  });

  it('uses 1% of held feeds when that is above 2000', () => {
    expect(
      retireGrowthExceedsBrake({
        eligibleCount: 2500,
        previousEligibleCount: 0,
        heldCount: 250000,
      })
    ).toBe(false);
    expect(
      retireGrowthExceedsBrake({
        eligibleCount: 2501,
        previousEligibleCount: 0,
        heldCount: 250000,
      })
    ).toBe(true);
  });

  it('allows a drop in the eligible count', () => {
    expect(
      retireGrowthExceedsBrake({
        eligibleCount: 10,
        previousEligibleCount: 100,
        heldCount: 100,
      })
    ).toBe(false);
  });
});
