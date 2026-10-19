import { Readable } from 'node:stream';

import { describe, expect, it } from 'vitest';

import type { DeadFeedCsvRow } from './deadFeedDuplicateChains.js';
import {
  deadFeedPairsWeHold,
  deadFeedTargetMap,
  extractDeadFeedCsvRow,
  forEachDeadFeedCsvRow,
  resolveDeadFeedDuplicateChains,
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
});
