import type { Server } from 'http';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

import { MediumEnum } from '@podverse/helpers';
import type {
  ORMContext,
  StatsPopularityRefreshMode,
  StatsPopularityRefreshTypeResult,
} from '@podverse/orm';

import { startTestApp, stopTestApp } from './helpers/index.js';

vi.mock('@podverse/orm', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@podverse/orm')>();

  class MockCategoryService {
    async setCategoryCache(): Promise<void> {}
  }

  return {
    ...actual,
    CategoryService: MockCategoryService,
  };
});

type EntityManager = ORMContext['dataSourceReadWrite']['manager'];

type PopularityCounts = {
  day_count: number;
  week_count: number;
  month_count: number;
  all_time_count: number;
};

const TABLES = {
  channel: {
    key: 'channel_id',
    daily: 'stats_daily_channel',
    popularity: 'stats_popularity_channel',
  },
  playlist: {
    key: 'playlist_id',
    daily: 'stats_daily_playlist',
    popularity: 'stats_popularity_playlist',
  },
  account: {
    key: 'account_id',
    daily: 'stats_daily_account',
    popularity: 'stats_popularity_account',
  },
} as const;

type TestEntityType = keyof typeof TABLES;

type DailyRow = { day: string; listeners: number };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function rowsOf(value: unknown): Record<string, unknown>[] {
  return Array.isArray(value) ? value.filter(isRecord) : [];
}

function asNumber(value: unknown): number {
  if (typeof value === 'number') {
    return value;
  }
  throw new Error('expected a number');
}

describe('Popularity range totals refresh (real database)', () => {
  let server: Server | undefined;
  let ormContext: ORMContext | undefined;
  let manager: EntityManager;
  const runId = Date.now();
  const createdAccountIds: number[] = [];
  const createdFeedIds: number[] = [];

  let windowChannelId: number;
  let oldRowsChannelId: number;
  let staleAllTimeChannelId: number;
  let noDailyRowsChannelId: number;
  let playlistId: number;
  let profileAccountId: number;

  const query = async (sql: string, params: unknown[] = []): Promise<unknown> =>
    manager.query(sql, params);

  const refresh = async (
    today: string,
    mode: StatsPopularityRefreshMode
  ): Promise<StatsPopularityRefreshTypeResult[]> => {
    const { refreshStatsPopularity } = await import('@podverse/orm');
    return refreshStatsPopularity({ today, mode });
  };

  const resultFor = (
    results: StatsPopularityRefreshTypeResult[],
    entityType: StatsPopularityRefreshTypeResult['entityType']
  ): StatsPopularityRefreshTypeResult => {
    const result = results.find((entry) => entry.entityType === entityType);
    if (result === undefined) {
      throw new Error(`expected a refresh result for ${entityType}`);
    }
    return result;
  };

  const seedAccount = async (label: string): Promise<number> => {
    const { AccountService } = await import('@podverse/orm');
    const accountService = new AccountService();
    const email = `stats-popularity-refresh-${label}-${runId}@example.com`;
    await accountService.create({
      email,
      password: 'IntegrationTest1!',
      locale: 'en-US',
      terms_version: '2026-10-15',
    });
    const account = await accountService.getByEmail(email);
    if (!account) {
      throw new Error(`Failed to load account ${label}`);
    }
    createdAccountIds.push(account.id);
    return account.id;
  };

  const seedChannel = async (label: string): Promise<number> => {
    const { Channel, Feed } = await import('@podverse/orm');
    const feedRepo = manager.getRepository(Feed);
    const feed = await feedRepo.save(
      feedRepo.create({
        url: `https://stats-popularity-refresh-${runId}-${label}.example.com/feed.xml`,
        podcast_index_id: 2_000_000_000 + (runId % 100_000_000) + createdFeedIds.length,
      })
    );
    createdFeedIds.push(feed.id);
    const channelRepo = manager.getRepository(Channel);
    const channel = await channelRepo.save(
      channelRepo.create({
        feed_id: feed.id,
        medium_id: MediumEnum.Podcast,
        title: `Stats popularity refresh ${label} ${runId}`,
      })
    );
    return channel.id;
  };

  const insertDailyRows = async (
    entityType: TestEntityType,
    entityId: number,
    rows: DailyRow[]
  ): Promise<void> => {
    const { key, daily } = TABLES[entityType];
    for (const row of rows) {
      await query(`INSERT INTO ${daily} (${key}, day, listener_count) VALUES ($1, $2::date, $3)`, [
        entityId,
        row.day,
        row.listeners,
      ]);
    }
  };

  const setPopularityRow = async (
    entityType: TestEntityType,
    entityId: number,
    counts: PopularityCounts
  ): Promise<void> => {
    const { key, popularity } = TABLES[entityType];
    await query(
      `INSERT INTO ${popularity} (${key}, day_count, week_count, month_count, all_time_count)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (${key}) DO UPDATE
          SET day_count = EXCLUDED.day_count,
              week_count = EXCLUDED.week_count,
              month_count = EXCLUDED.month_count,
              all_time_count = EXCLUDED.all_time_count`,
      [entityId, counts.day_count, counts.week_count, counts.month_count, counts.all_time_count]
    );
  };

  const popularityRow = async (
    entityType: TestEntityType,
    entityId: number
  ): Promise<PopularityCounts | null> => {
    const { key, popularity } = TABLES[entityType];
    const row = rowsOf(
      await query(
        `SELECT day_count, week_count, month_count, all_time_count
           FROM ${popularity}
          WHERE ${key} = $1`,
        [entityId]
      )
    )[0];
    if (row === undefined) {
      return null;
    }
    return {
      day_count: asNumber(row.day_count),
      week_count: asNumber(row.week_count),
      month_count: asNumber(row.month_count),
      all_time_count: asNumber(row.all_time_count),
    };
  };

  const deleteStatsRows = async (entityType: TestEntityType, ids: number[]): Promise<void> => {
    const { key, daily, popularity } = TABLES[entityType];
    await query(`DELETE FROM ${daily} WHERE ${key} = ANY($1::int[])`, [ids]);
    await query(`DELETE FROM ${popularity} WHERE ${key} = ANY($1::int[])`, [ids]);
  };

  beforeAll(async () => {
    const started = await startTestApp();
    server = started.server;
    ormContext = started.ormContext;
    if (!ormContext) {
      throw new Error('ORM context required for the stats popularity refresh integration test');
    }
    manager = ormContext.dataSourceReadWrite.manager;

    windowChannelId = await seedChannel('window');
    oldRowsChannelId = await seedChannel('old-rows');
    staleAllTimeChannelId = await seedChannel('stale-all-time');
    noDailyRowsChannelId = await seedChannel('no-daily-rows');

    const owner = await seedAccount('owner');
    profileAccountId = await seedAccount('profile');
    const { PlaylistService } = await import('@podverse/orm');
    const playlist = await new PlaylistService().getOrCreateDefaultLikesPlaylist(
      owner,
      MediumEnum.AV
    );
    playlistId = playlist.id;

    await insertDailyRows('channel', windowChannelId, [
      { day: '2001-06-30', listeners: 5 },
      { day: '2001-06-29', listeners: 3 },
      { day: '2001-06-25', listeners: 2 },
      { day: '2001-06-05', listeners: 7 },
      { day: '2001-01-10', listeners: 11 },
    ]);
    await insertDailyRows('channel', oldRowsChannelId, [
      { day: '2001-03-01', listeners: 4 },
      { day: '2001-02-01', listeners: 6 },
    ]);
    await insertDailyRows('channel', staleAllTimeChannelId, [
      { day: '2001-06-20', listeners: 4 },
      { day: '2001-06-10', listeners: 2 },
    ]);
    await insertDailyRows('playlist', playlistId, [
      { day: '2001-06-30', listeners: 2 },
      { day: '2001-06-28', listeners: 1 },
      { day: '2001-05-01', listeners: 5 },
    ]);
    await insertDailyRows('account', profileAccountId, [
      { day: '2001-06-29', listeners: 4 },
      { day: '2001-06-15', listeners: 1 },
    ]);
  }, 60000);

  afterAll(async () => {
    if (ormContext) {
      await deleteStatsRows('channel', [
        windowChannelId,
        oldRowsChannelId,
        staleAllTimeChannelId,
        noDailyRowsChannelId,
      ]);
      await deleteStatsRows('playlist', [playlistId]);
      await deleteStatsRows('account', [profileAccountId]);
      const { AccountService } = await import('@podverse/orm');
      const accountService = new AccountService();
      for (const accountId of createdAccountIds) {
        await accountService.delete(accountId);
      }
      if (createdFeedIds.length > 0) {
        await query('DELETE FROM feed WHERE id = ANY($1::int[])', [createdFeedIds]);
      }
    }
    await stopTestApp(server, ormContext);
  });

  it('sums each window and every daily row into the range totals in recent mode', async () => {
    await refresh('2001-06-30', 'recent');

    expect(await popularityRow('channel', windowChannelId)).toEqual({
      day_count: 8,
      week_count: 10,
      month_count: 17,
      all_time_count: 28,
    });
  });

  it('writes no rows when an identical recent run follows', async () => {
    const results = await refresh('2001-06-30', 'recent');

    expect(resultFor(results, 'channel').rowsWritten).toBe(0);
  });

  it('zeroes the windows and keeps the all-time total once the month window holds no rows', async () => {
    await refresh('2001-07-31', 'recent');

    expect(await popularityRow('channel', windowChannelId)).toEqual({
      day_count: 0,
      week_count: 0,
      month_count: 0,
      all_time_count: 28,
    });
  });

  it('creates no row in recent mode for an entity with only old rows, and full mode creates it', async () => {
    expect(await popularityRow('channel', oldRowsChannelId)).toBeNull();

    await refresh('2001-06-30', 'full');

    expect(await popularityRow('channel', oldRowsChannelId)).toEqual({
      day_count: 0,
      week_count: 0,
      month_count: 0,
      all_time_count: 10,
    });
    expect(await popularityRow('channel', windowChannelId)).toEqual({
      day_count: 8,
      week_count: 10,
      month_count: 17,
      all_time_count: 28,
    });
  });

  it('keeps a stored all-time total in recent mode without a listen today or yesterday, and full mode corrects it', async () => {
    await setPopularityRow('channel', staleAllTimeChannelId, {
      day_count: 0,
      week_count: 0,
      month_count: 0,
      all_time_count: 999,
    });

    await refresh('2001-06-30', 'recent');

    expect(await popularityRow('channel', staleAllTimeChannelId)).toEqual({
      day_count: 0,
      week_count: 0,
      month_count: 6,
      all_time_count: 999,
    });

    await refresh('2001-06-30', 'full');

    expect(await popularityRow('channel', staleAllTimeChannelId)).toEqual({
      day_count: 0,
      week_count: 0,
      month_count: 6,
      all_time_count: 6,
    });
  });

  it('sets all four counts to zero in full mode on a row whose entity has no daily rows', async () => {
    await setPopularityRow('channel', noDailyRowsChannelId, {
      day_count: 1,
      week_count: 2,
      month_count: 3,
      all_time_count: 4,
    });

    const results = await refresh('2001-06-30', 'full');

    expect(resultFor(results, 'channel').rowsZeroed).toBeGreaterThanOrEqual(1);
    expect(await popularityRow('channel', noDailyRowsChannelId)).toEqual({
      day_count: 0,
      week_count: 0,
      month_count: 0,
      all_time_count: 0,
    });
  });

  it('refreshes playlist and profile range totals the same way', async () => {
    await refresh('2001-06-30', 'recent');

    expect(await popularityRow('playlist', playlistId)).toEqual({
      day_count: 2,
      week_count: 3,
      month_count: 3,
      all_time_count: 8,
    });
    expect(await popularityRow('account', profileAccountId)).toEqual({
      day_count: 4,
      week_count: 4,
      month_count: 5,
      all_time_count: 5,
    });
  });
});
