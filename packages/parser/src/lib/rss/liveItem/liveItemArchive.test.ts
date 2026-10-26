import { describe, expect, it } from 'vitest';

import { liveItemIdsToArchive } from './liveItemArchive.js';

describe('liveItemIdsToArchive', () => {
  it('archives a live item that this parse did not update and did not skip', () => {
    expect(liveItemIdsToArchive([{ guid: 'gone', itemId: 3 }], [], new Set<string>())).toEqual([3]);
  });

  it('keeps a live item whose guid was skipped for an invalid status', () => {
    expect(
      liveItemIdsToArchive([{ guid: 'bad-status', itemId: 1 }], [], new Set(['bad-status']))
    ).toEqual([]);
  });

  it('keeps a live item this parse updated', () => {
    expect(liveItemIdsToArchive([{ guid: 'updated', itemId: 2 }], [2], new Set<string>())).toEqual(
      []
    );
  });

  it('archives a skipped row that has no guid', () => {
    expect(liveItemIdsToArchive([{ guid: null, itemId: 4 }], [], new Set(['bad-status']))).toEqual([
      4,
    ]);
  });
});
