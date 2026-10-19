import { describe, expect, it, vi } from 'vitest';

import { captureRemovedReferences } from './removedReferences.js';

describe('captureRemovedReferences', () => {
  it('does nothing when there are no item ids', async () => {
    const query = vi.fn();
    const manager = { query };

    await expect(captureRemovedReferences([], manager)).resolves.toEqual({
      clips: 0,
      playlistEntries: 0,
    });
    expect(query).not.toHaveBeenCalled();
  });

  it('writes item and soundbite snapshots and skips rows already captured', async () => {
    const query = vi
      .fn()
      .mockResolvedValueOnce([{ id: 1 }])
      .mockResolvedValueOnce([{ id: 2 }, { id: 3 }])
      .mockResolvedValueOnce([{ id: 4 }]);
    const manager = { query };

    await expect(captureRemovedReferences([11, 12], manager)).resolves.toEqual({
      clips: 1,
      playlistEntries: 3,
    });

    expect(query).toHaveBeenCalledTimes(3);
    const clipSql = String(query.mock.calls[0]?.[0]);
    const playlistItemSql = String(query.mock.calls[1]?.[0]);
    const soundbiteSql = String(query.mock.calls[2]?.[0]);

    expect(clipSql).toContain('UPDATE clip AS c');
    expect(clipSql).toContain("'kind', 'item'");
    expect(clipSql).toContain('c.source_removed_at IS NULL');
    expect(playlistItemSql).toContain('UPDATE playlist_resource AS pr');
    expect(playlistItemSql).toContain("'kind', 'item'");
    expect(playlistItemSql).toContain('pr.source_removed_at IS NULL');
    expect(soundbiteSql).toContain('FROM item_soundbite AS sb');
    expect(soundbiteSql).toContain("'kind', 'soundbite'");
    expect(soundbiteSql).toContain('sb.title');
    expect(soundbiteSql).toContain('pr.source_removed_at IS NULL');
    expect(query.mock.calls[0]?.[1]).toEqual([[11, 12]]);
    expect(query.mock.calls[1]?.[1]).toEqual([[11, 12]]);
    expect(query.mock.calls[2]?.[1]).toEqual([[11, 12]]);
  });
});
