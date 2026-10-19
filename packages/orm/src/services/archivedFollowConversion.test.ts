import { beforeEach, describe, expect, it, vi } from 'vitest';

const { queryMock, upsertMock } = vi.hoisted(() => ({
  queryMock: vi.fn(),
  upsertMock: vi.fn(async (_rows: unknown) => ({ written: 0, trimmed: 0 })),
}));

vi.mock('@orm/db/index.js', () => ({
  AppDataSourceReadWrite: {
    query: queryMock,
    transaction: async (work: (manager: { query: typeof queryMock }) => Promise<unknown>) =>
      work({ query: queryMock }),
  },
}));

vi.mock('./accountContentLog.js', () => ({
  upsertAccountContentLogs: upsertMock,
}));

import {
  convertArchivedShowFollows,
  endSettledDirectoryFollows,
} from './archivedFollowConversion.js';

function accountIdsFrom(value: unknown): number[] {
  if (!Array.isArray(value)) {
    return [];
  }
  const ids: number[] = [];
  for (const row of value) {
    if (typeof row !== 'object' || row === null) {
      continue;
    }
    const accountId = Reflect.get(row, 'accountId');
    if (typeof accountId === 'number') {
      ids.push(accountId);
    }
  }
  return ids;
}

describe('convertArchivedShowFollows', () => {
  beforeEach(() => {
    queryMock.mockReset();
    upsertMock.mockReset();
    upsertMock.mockResolvedValue({ written: 1, trimmed: 0 });
  });

  it('writes left_directory moved_to_add_by_rss in the same transaction as the follow move', async () => {
    queryMock.mockImplementation(async (sql: string) => {
      if (sql.includes('follow_conversion_status IS NULL')) {
        return [
          {
            id: 9,
            id_text: 'showtext',
            title: 'Show Title',
            feed_url: 'https://example.com/feed.xml',
          },
        ];
      }
      if (sql.includes('channel_merge')) {
        return [];
      }
      if (sql.includes('account_membership_status')) {
        return [
          {
            account_id: 42,
            account_membership_id: 2,
            membership_expires_at: '2099-01-01T00:00:00.000Z',
          },
        ];
      }
      return [];
    });

    const result = await convertArchivedShowFollows(async () => true);

    expect(result.followsMoved).toBe(1);
    const sqls = queryMock.mock.calls.map((call) => String(call[0]));
    const insertAt = sqls.findIndex((sql) => sql.includes('account_following_add_by_rss_channel'));
    const deleteAt = sqls.findIndex((sql) => sql.includes('DELETE FROM account_following_channel'));
    expect(insertAt).toBeGreaterThanOrEqual(0);
    expect(deleteAt).toBeGreaterThan(insertAt);
    expect(upsertMock).toHaveBeenCalledTimes(1);
    expect(upsertMock.mock.invocationCallOrder[0]).toBeGreaterThan(
      queryMock.mock.invocationCallOrder[deleteAt] ?? 0
    );
    expect(upsertMock).toHaveBeenCalledWith(
      [
        {
          accountId: 42,
          channelIdText: 'showtext',
          channelTitle: 'Show Title',
          reason: 'left_directory',
          followOutcome: 'moved_to_add_by_rss',
          clipCount: 0,
          playlistEntryCount: 0,
        },
      ],
      expect.objectContaining({ query: queryMock })
    );
  });
});

describe('endSettledDirectoryFollows', () => {
  beforeEach(() => {
    queryMock.mockReset();
    upsertMock.mockReset();
    upsertMock.mockResolvedValue({ written: 0, trimmed: 0 });
  });

  it('ends every remaining follow, including accounts past the log-row cut', async () => {
    const followers = Array.from({ length: 5001 }, (_, index) => ({ account_id: index + 1 }));
    queryMock.mockImplementation(async (sql: string) => {
      if (sql.includes('follow_conversion_status IN')) {
        return [{ id: 9, id_text: 'showtext', title: 'Show Title' }];
      }
      if (sql.includes('SELECT account_id FROM account_following_channel')) {
        return followers;
      }
      if (sql.includes('DELETE FROM account_following_channel')) {
        return [[], followers.length];
      }
      return [];
    });

    const result = await endSettledDirectoryFollows();

    expect(result.ended).toBe(5001);
    const deleteCall = queryMock.mock.calls.find((call) =>
      String(call[0]).includes('DELETE FROM account_following_channel')
    );
    expect(String(deleteCall?.[0])).not.toContain('LIMIT');
    expect(deleteCall?.[1]).toEqual([9]);
    const writes = accountIdsFrom(upsertMock.mock.calls[0]?.[0]);
    expect(writes).toHaveLength(5001);
    expect(writes[0]).toBe(1);
    expect(writes[5000]).toBe(5001);
    expect(upsertMock.mock.calls[0]?.[0]).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          reason: 'left_directory',
          followOutcome: 'ended',
          clipCount: 0,
          playlistEntryCount: 0,
        }),
      ])
    );
  });

  it('does nothing for a settled show that has no remaining follows', async () => {
    queryMock.mockImplementation(async (sql: string) => {
      if (sql.includes('follow_conversion_status IN')) {
        return [{ id: 9, id_text: 'showtext', title: null }];
      }
      return [];
    });

    const result = await endSettledDirectoryFollows();

    expect(result.ended).toBe(0);
    expect(upsertMock).not.toHaveBeenCalled();
    expect(
      queryMock.mock.calls.some((call) =>
        String(call[0]).includes('DELETE FROM account_following_channel')
      )
    ).toBe(false);
  });
});
