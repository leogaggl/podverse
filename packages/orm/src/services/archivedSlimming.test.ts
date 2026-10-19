import { beforeEach, describe, expect, it, vi } from 'vitest';

const { queryMock, transactionMock } = vi.hoisted(() => {
  const queryMock = vi.fn();
  const transactionMock = vi.fn(async (run: (manager: { query: typeof queryMock }) => unknown) =>
    run({ query: queryMock })
  );
  return { queryMock, transactionMock };
});

vi.mock('@orm/db/index.js', () => ({
  AppDataSourceRead: { manager: { query: queryMock } },
  AppDataSourceReadWrite: { transaction: transactionMock },
}));

vi.mock('@orm/entities/item/itemFlagStatus.js', () => ({
  ItemFlagStatusStatusEnum: {
    Active: 1,
    PendingArchive: 2,
    Archived: 3,
    PendingDelete: 4,
  },
}));

vi.mock('./archiver.js', () => ({
  CHANNEL_DETAIL_DELETE_QUERIES: [],
}));

vi.mock('@orm/entities/feed/feedLifecycleStateType.js', () => ({
  FeedLifecycleStateKeyEnum: {
    Active: 'active',
    PendingArchive: 'pending_archive',
    Archived: 'archived',
    Merged: 'merged',
    Takedown: 'takedown',
  },
}));

import { buildArchivedDescriptionValue } from '@podverse/helpers';

import {
  ARCHIVED_ITEM_DETAIL_DELETE_TABLES,
  ARCHIVED_SLIM_ITEM_BATCH_SIZE,
  ARCHIVED_SLIM_MAX_ITEMS_PER_RUN,
  slimArchivedItems,
} from './archivedSlimming.js';

function isItemSelect(sql: string): boolean {
  return sql.includes('FOR UPDATE SKIP LOCKED') && sql.includes('FROM item');
}

function isDescriptionSelect(sql: string): boolean {
  return sql.includes('FROM item_description') && sql.includes('SELECT id, value, preview');
}

describe('slimArchivedItems', () => {
  beforeEach(() => {
    queryMock.mockReset();
    transactionMock.mockClear();
  });

  it('stops when a batch is shorter than the batch size', async () => {
    queryMock.mockImplementation(async (sql: string) => {
      if (isItemSelect(sql)) {
        return [{ id: 11 }, { id: 12 }];
      }
      if (isDescriptionSelect(sql)) {
        return [];
      }
      return [];
    });

    const result = await slimArchivedItems();

    expect(result).toEqual({ slimmed: 2 });
    expect(transactionMock).toHaveBeenCalledTimes(1);
    for (const table of ARCHIVED_ITEM_DETAIL_DELETE_TABLES) {
      expect(queryMock).toHaveBeenCalledWith(expect.stringContaining(`DELETE FROM ${table}`), [
        [11, 12],
      ]);
    }
    expect(queryMock).toHaveBeenCalledWith(
      expect.stringContaining('UPDATE item SET archived_slimmed_at'),
      [[11, 12]]
    );
  });

  it('stops at the run cap when every batch is full', async () => {
    const fullBatch = Array.from({ length: ARCHIVED_SLIM_ITEM_BATCH_SIZE }, (_, index) => ({
      id: index + 1,
    }));
    queryMock.mockImplementation(async (sql: string) => {
      if (isItemSelect(sql)) {
        return fullBatch;
      }
      return [];
    });

    const result = await slimArchivedItems();

    expect(result).toEqual({ slimmed: ARCHIVED_SLIM_MAX_ITEMS_PER_RUN });
    expect(transactionMock).toHaveBeenCalledTimes(
      ARCHIVED_SLIM_MAX_ITEMS_PER_RUN / ARCHIVED_SLIM_ITEM_BATCH_SIZE
    );
  });

  it('keeps soundbites that a playlist references', async () => {
    queryMock.mockImplementation(async (sql: string) => {
      if (isItemSelect(sql)) {
        return [{ id: 4 }];
      }
      return [];
    });

    await slimArchivedItems();

    const soundbiteCall = queryMock.mock.calls.find(
      (call) => typeof call[0] === 'string' && call[0].includes('DELETE FROM item_soundbite')
    );
    expect(soundbiteCall).toBeDefined();
    expect(soundbiteCall?.[0]).toEqual(expect.stringContaining('playlist_resource'));
    expect(soundbiteCall?.[0]).toEqual(expect.stringContaining('NOT EXISTS'));
    expect(soundbiteCall?.[1]).toEqual([[4]]);
  });

  it('skips the description update when the notes are already reduced', async () => {
    const preview = 'Already short';
    const reduced = buildArchivedDescriptionValue(preview);
    queryMock.mockImplementation(async (sql: string) => {
      if (isItemSelect(sql)) {
        return [{ id: 9 }];
      }
      if (isDescriptionSelect(sql)) {
        return [{ id: 30, value: reduced, preview, source_length: 80 }];
      }
      return [];
    });

    await slimArchivedItems();

    const descriptionUpdate = queryMock.mock.calls.find(
      (call) => typeof call[0] === 'string' && call[0].includes('UPDATE item_description')
    );
    expect(descriptionUpdate).toBeUndefined();
    expect(queryMock).toHaveBeenCalledWith(
      expect.stringContaining('UPDATE item SET archived_slimmed_at'),
      [[9]]
    );
  });
});
