import { beforeEach, describe, expect, it, vi } from 'vitest';

const { warnMock } = vi.hoisted(() => ({
  warnMock: vi.fn(),
}));

vi.mock('@orm/factories/loggerService.js', () => ({
  loggerService: {
    info: vi.fn(),
    warn: warnMock,
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

vi.mock('@orm/db/index.js', () => ({
  AppDataSourceReadWrite: {
    query: vi.fn(),
    transaction: vi.fn(),
  },
}));

import type { AccountContentLogWrite } from './accountContentLog.js';
import {
  ACCOUNT_CONTENT_LOG_MAX_NEW_PER_SHOW,
  ACCOUNT_CONTENT_LOG_MAX_ROWS,
  ACCOUNT_CONTENT_LOG_WRITE_CHUNK,
  recordTakenDownContentLog,
  upsertAccountContentLogs,
} from './accountContentLog.js';

function arrayAt(value: unknown, index: number): unknown {
  return Array.isArray(value) ? value[index] : undefined;
}

function numberList(value: unknown): number[] {
  if (!Array.isArray(value)) {
    return [];
  }
  const numbers: number[] = [];
  for (const item of value) {
    if (typeof item === 'number') {
      numbers.push(item);
    }
  }
  return numbers;
}

function write(accountId: number, channelIdText = 'show1'): AccountContentLogWrite {
  return {
    accountId,
    channelIdText,
    channelTitle: 'Show',
    reason: 'left_directory',
    followOutcome: 'ended',
    clipCount: 1,
    playlistEntryCount: 2,
  };
}

describe('upsertAccountContentLogs', () => {
  const query = vi.fn(
    async (_sql: string, _parameters?: readonly unknown[]): Promise<unknown> => [[], 0]
  );
  const manager = { query };

  beforeEach(() => {
    query.mockClear();
    query.mockResolvedValue([[], 0]);
    warnMock.mockReset();
  });

  it('upserts on account, log type, and channel, keeping taken_down and moved_to_add_by_rss', async () => {
    await upsertAccountContentLogs([write(4)], manager);

    const sql = String(query.mock.calls[0]?.[0]);
    expect(sql).toContain('ON CONFLICT (account_id, log_type, channel_id_text)');
    expect(sql).toContain("'removed_content'");
    expect(sql).toContain("account_content_log.reason = 'taken_down'");
    expect(sql).toContain("EXCLUDED.reason = 'taken_down' THEN 'taken_down'");
    expect(String(query.mock.calls[1]?.[0])).toContain('ORDER BY updated_at DESC');
    expect(sql).toContain("WHEN account_content_log.follow_outcome = 'moved_to_add_by_rss'");
    expect(sql).toContain("OR EXCLUDED.follow_outcome = 'moved_to_add_by_rss'");
    expect(sql).toContain('GREATEST(account_content_log.clip_count, EXCLUDED.clip_count)');
    expect(sql).toContain('account_content_log.playlist_entry_count');
    expect(sql).toContain('EXCLUDED.playlist_entry_count');
    expect(sql).toContain('COALESCE(EXCLUDED.channel_title, account_content_log.channel_title)');
    expect(sql).toContain('updated_at = now()');
    expect(sql).not.toContain('created_at');
    expect(query.mock.calls[1]?.[1]).toEqual([[4], ACCOUNT_CONTENT_LOG_MAX_ROWS]);
  });

  it('writes the first 5000 accounts and warns with the channel id and the omitted count', async () => {
    const rows = Array.from({ length: ACCOUNT_CONTENT_LOG_MAX_NEW_PER_SHOW + 1 }, (_, index) =>
      write(index + 1, 'chantext')
    );

    const result = await upsertAccountContentLogs(rows, manager);

    const inserts = query.mock.calls.filter((call) => String(call[0]).includes('INSERT INTO'));
    const writtenIds = inserts.flatMap((call) => numberList(arrayAt(call[1], 0)));
    expect(writtenIds).toHaveLength(ACCOUNT_CONTENT_LOG_MAX_NEW_PER_SHOW);
    expect(writtenIds[0]).toBe(1);
    expect(writtenIds[writtenIds.length - 1]).toBe(ACCOUNT_CONTENT_LOG_MAX_NEW_PER_SHOW);
    expect(result.written).toBe(ACCOUNT_CONTENT_LOG_MAX_NEW_PER_SHOW);
    expect(warnMock).toHaveBeenCalledWith(
      'account_content_log write cut channel_id_text=chantext omitted=1'
    );
    expect(inserts).toHaveLength(
      Math.ceil(ACCOUNT_CONTENT_LOG_MAX_NEW_PER_SHOW / ACCOUNT_CONTENT_LOG_WRITE_CHUNK)
    );
  });
});

describe('recordTakenDownContentLog', () => {
  const query = vi.fn(
    async (_sql: string, _parameters?: readonly unknown[]): Promise<unknown> => [[], 0]
  );
  const manager = { query };

  beforeEach(() => {
    query.mockReset();
  });

  it('writes one taken_down row per account in the union, then deletes the follows', async () => {
    query.mockImplementation(async (sql: string) => {
      if (sql.includes('FROM clip')) {
        return [
          { account_id: 3, clip_count: 1 },
          { account_id: 1, clip_count: 2 },
        ];
      }
      if (sql.includes('playlist_resource')) {
        return [
          { account_id: 1, playlist_entry_count: 4 },
          { account_id: 5, playlist_entry_count: 1 },
        ];
      }
      if (sql.includes('SELECT account_id FROM account_following_channel')) {
        return [{ account_id: 1 }, { account_id: 8 }];
      }
      return [[], 0];
    });

    await recordTakenDownContentLog(manager, {
      channelId: 70,
      channelIdText: 'taken',
      channelTitle: 'Gone',
      itemIds: [11, 12],
    });

    const insert = query.mock.calls.find((call) => String(call[0]).includes('INSERT INTO'));
    const params = Array.isArray(insert?.[1]) ? insert[1] : [];
    expect(params[0]).toEqual([1, 3, 5, 8]);
    expect(params[1]).toEqual(['taken', 'taken', 'taken', 'taken']);
    expect(params[3]).toEqual(['taken_down', 'taken_down', 'taken_down', 'taken_down']);
    expect(params[4]).toEqual(['ended', null, null, 'ended']);
    expect(params[5]).toEqual([2, 1, 0, 0]);
    expect(params[6]).toEqual([4, 0, 1, 0]);

    const followDeleteIndex = query.mock.calls.findIndex((call) =>
      String(call[0]).includes('DELETE FROM account_following_channel')
    );
    const insertIndex = query.mock.calls.findIndex((call) =>
      String(call[0]).includes('INSERT INTO')
    );
    expect(insertIndex).toBeGreaterThanOrEqual(0);
    expect(followDeleteIndex).toBeGreaterThan(insertIndex);
    expect(query.mock.calls[followDeleteIndex]?.[1]).toEqual([70]);
  });

  it('skips the upsert when nobody owns a clip, a playlist entry, or a follow', async () => {
    query.mockImplementation(async (sql: string) => {
      if (sql.includes('SELECT account_id FROM account_following_channel')) {
        return [];
      }
      return [[], 0];
    });

    await recordTakenDownContentLog(manager, {
      channelId: 70,
      channelIdText: 'taken',
      channelTitle: null,
      itemIds: [],
    });

    expect(query.mock.calls.some((call) => String(call[0]).includes('INSERT INTO'))).toBe(false);
    expect(query.mock.calls.some((call) => String(call[0]).includes('FROM clip'))).toBe(false);
    expect(
      query.mock.calls.some((call) =>
        String(call[0]).includes('DELETE FROM account_following_channel')
      )
    ).toBe(true);
  });
});
