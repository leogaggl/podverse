import { describe, expect, it } from 'vitest';

import { readQueryResultRows } from './queryResultRows.js';

describe('readQueryResultRows', () => {
  it('returns a plain row array as is', () => {
    const rows = [{ id: 1 }, { id: 2 }];

    expect(readQueryResultRows(rows)).toBe(rows);
  });

  it('reads the rows from a [rows, affectedCount] tuple', () => {
    const rows = [{ id: 1 }, { id: 2 }];

    expect(readQueryResultRows([rows, 2])).toBe(rows);
  });

  it('returns null for non-array values', () => {
    expect(readQueryResultRows({ id: 1 })).toBeNull();
  });
});
