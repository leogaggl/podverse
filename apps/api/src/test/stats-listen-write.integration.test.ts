import { randomUUID } from 'node:crypto';

import type { Server } from 'http';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

import type { PopularityListenResult, PopularityOpenResult } from '@podverse/helpers';
import { fadeTasteScore, MediumEnum, POPULARITY_TASTE_HALF_LIFE_DAYS } from '@podverse/helpers';
import type { ORMContext, StatsListenTarget, StatsOpenTarget } from '@podverse/orm';

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

type SeededAccount = { id: number; idText: string };

type SeededEntity = { id: number; idText: string };

type DailyCounts = { listener_count: number; completion_count: number };

type TasteRow = {
  listen_count: number;
  completion_count: number;
  recent_score: number;
  long_term_score: number;
  first_listened_at: Date;
  last_listened_at: Date;
  scores_updated_at: Date;
};

type ListenInput = {
  accountId: number;
  target: StatsListenTarget;
  clientListenId: string;
  secondsHeard: number;
  completed?: boolean;
  dailyCap?: number;
};

const AGREEMENT_VERSION = 'stats-listen-write-test';
const DAILY_CAP = 300;
const ITEM_DURATION_SECONDS = 200;
const DAY_MS = 86_400_000;

const DAILY_TABLES = {
  item: { table: 'stats_daily_item', column: 'item_id' },
  channel: { table: 'stats_daily_channel', column: 'channel_id' },
  clip: { table: 'stats_daily_clip', column: 'clip_id' },
} as const;

const OPEN_DAILY_TABLES = {
  account: { table: 'stats_daily_account', column: 'account_id' },
  playlist: { table: 'stats_daily_playlist', column: 'playlist_id' },
} as const;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function rowsOf(value: unknown): Record<string, unknown>[] {
  return Array.isArray(value) ? value.filter(isRecord) : [];
}

function firstRow(value: unknown): Record<string, unknown> {
  const row = rowsOf(value)[0];
  if (row === undefined) {
    throw new Error('expected a row');
  }
  return row;
}

function asText(value: unknown): string {
  if (typeof value === 'string') {
    return value;
  }
  if (typeof value === 'number' || typeof value === 'bigint') {
    return String(value);
  }
  throw new Error('expected a text or numeric value');
}

function asNumber(value: unknown): number {
  if (typeof value === 'number') {
    return value;
  }
  throw new Error('expected a number');
}

function asDate(value: unknown): Date {
  if (value instanceof Date) {
    return value;
  }
  throw new Error('expected a timestamp');
}

function todayUtc(): string {
  return new Date().toISOString().slice(0, 10);
}

function itemTarget(item: SeededEntity): StatsListenTarget {
  return { kind: 'item', id_text: item.idText };
}

describe('Popularity listen and open write services (real database)', () => {
  let server: Server | undefined;
  let ormContext: ORMContext | undefined;
  let manager: EntityManager;
  const runId = Date.now();
  const suffix = String(runId).slice(-8);
  const createdAccountIds: number[] = [];
  const createdFeedIds: number[] = [];

  let listener: SeededAccount;
  let owner: SeededAccount;
  let ownerPlaylist: SeededEntity;
  let podcastChannelId: number;
  let podcastItem: SeededEntity;
  let hiddenShowItem: SeededEntity;
  let concurrencyItem: SeededEntity;
  let albumChannelId: number;
  let artistChannelId: number;
  let track: SeededEntity;
  let clip: SeededEntity;
  let removedClip: SeededEntity;
  const secondSession = randomUUID();

  const query = async (sql: string, params: unknown[] = []): Promise<unknown> =>
    manager.query(sql, params);

  const seedAccount = async (label: string, consent: boolean | null): Promise<SeededAccount> => {
    const { AccountService, AccountSettingsListenStatsService } = await import('@podverse/orm');
    const accountService = new AccountService();
    const email = `stats-listen-write-${label}-${runId}@example.com`;
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
    if (consent !== null) {
      await new AccountSettingsListenStatsService().update({
        account_id: account.id,
        accepted: consent,
        agreement_version: AGREEMENT_VERSION,
      });
    }
    return { id: account.id, idText: account.id_text };
  };

  const seedChannel = async (
    label: string,
    mediumId: MediumEnum,
    podcastGuid: string | null = null
  ): Promise<number> => {
    const { Channel, Feed } = await import('@podverse/orm');
    const feedRepo = manager.getRepository(Feed);
    const feed = await feedRepo.save(
      feedRepo.create({
        url: `https://stats-listen-write-${runId}-${label}.example.com/feed.xml`,
        podcast_index_id: 1_400_000_000 + (runId % 100_000_000) * 4 + createdFeedIds.length,
      })
    );
    createdFeedIds.push(feed.id);
    const channelRepo = manager.getRepository(Channel);
    const channel = await channelRepo.save(
      channelRepo.create({
        feed_id: feed.id,
        medium_id: mediumId,
        title: `Stats listen write ${label} ${runId}`,
        podcast_guid: podcastGuid,
      })
    );
    return channel.id;
  };

  const seedItem = async (
    channelId: number,
    label: string,
    durationSeconds: number | null
  ): Promise<SeededEntity> => {
    const { Item } = await import('@podverse/orm');
    const itemRepo = manager.getRepository(Item);
    const item = await itemRepo.save(
      itemRepo.create({
        channel_id: String(channelId),
        title: `Stats listen write ${label}`,
        item_flag_status: { id: 1 },
        guid: `https://stats-listen-write.example.com/${runId}/${label}`,
      })
    );
    if (durationSeconds !== null) {
      await query('INSERT INTO item_about (item_id, duration) VALUES ($1, $2)', [
        item.id,
        durationSeconds,
      ]);
    }
    return { id: item.id, idText: item.id_text };
  };

  const seedClip = async (idText: string, sourceRemoved: boolean): Promise<SeededEntity> => {
    const row = firstRow(
      await query(
        `INSERT INTO clip
           (id_text, account_id, item_id, start_time, end_time, created_at, sharable_status_id,
            source_removed_at)
         VALUES ($1, $2, $3, 10, 70, now(), 1, CASE WHEN $4::boolean THEN now() END)
         RETURNING id`,
        [idText, owner.id, podcastItem.id, sourceRemoved]
      )
    );
    return { id: asNumber(row.id), idText };
  };

  const listen = async (input: ListenInput): Promise<PopularityListenResult> => {
    const { StatsListenWriteService } = await import('@podverse/orm');
    return new StatsListenWriteService().recordListen({
      account_id: input.accountId,
      agreement_version: AGREEMENT_VERSION,
      daily_cap: input.dailyCap ?? DAILY_CAP,
      target: input.target,
      client_listen_id: input.clientListenId,
      seconds_heard: input.secondsHeard,
      completed: input.completed ?? false,
    });
  };

  const open = async (
    accountId: number,
    target: StatsOpenTarget
  ): Promise<PopularityOpenResult> => {
    const { StatsOpenWriteService } = await import('@podverse/orm');
    return new StatsOpenWriteService().recordOpen({
      account_id: accountId,
      agreement_version: AGREEMENT_VERSION,
      target,
    });
  };

  const listenerRowCount = async (accountId: number): Promise<number> =>
    asNumber(
      firstRow(
        await query(
          'SELECT count(*)::int AS total FROM listener_identity.stats_listener WHERE account_id = $1',
          [accountId]
        )
      ).total
    );

  const listenerIdOf = async (accountId: number): Promise<string> =>
    asText(
      firstRow(
        await query(
          'SELECT listener_id FROM listener_identity.stats_listener WHERE account_id = $1',
          [accountId]
        )
      ).listener_id
    );

  const listenEvents = async (accountId: number): Promise<Record<string, unknown>[]> =>
    rowsOf(
      await query(
        `SELECT e.id::text AS id, e.item_id, e.channel_id, e.clip_id, e.seconds_heard, e.completed,
                e.client_listen_id::text AS client_listen_id
           FROM stats_listen_event e
           JOIN listener_identity.stats_listener l ON l.listener_id = e.listener_id
          WHERE l.account_id = $1
          ORDER BY e.created_at, e.id`,
        [accountId]
      )
    );

  const dailyCounts = async (
    entity: keyof typeof DAILY_TABLES,
    entityId: number,
    day: string
  ): Promise<DailyCounts | null> => {
    const { table, column } = DAILY_TABLES[entity];
    const row = rowsOf(
      await query(
        `SELECT listener_count, completion_count FROM ${table} WHERE ${column} = $1 AND day = $2::date`,
        [entityId, day]
      )
    )[0];
    return row === undefined
      ? null
      : {
          listener_count: asNumber(row.listener_count),
          completion_count: asNumber(row.completion_count),
        };
  };

  const dailyOpenCount = async (
    kind: keyof typeof OPEN_DAILY_TABLES,
    entityId: number,
    day: string
  ): Promise<number> => {
    const { table, column } = OPEN_DAILY_TABLES[kind];
    const row = rowsOf(
      await query(`SELECT listener_count FROM ${table} WHERE ${column} = $1 AND day = $2::date`, [
        entityId,
        day,
      ])
    )[0];
    return row === undefined ? 0 : asNumber(row.listener_count);
  };

  const tasteRow = async (accountId: number, channelId: number): Promise<TasteRow | null> => {
    const row = rowsOf(
      await query(
        `SELECT t.listen_count, t.completion_count, t.recent_score, t.long_term_score,
                t.first_listened_at, t.last_listened_at, t.scores_updated_at
           FROM stats_taste_profile t
           JOIN listener_identity.stats_listener l ON l.listener_id = t.listener_id
          WHERE l.account_id = $1 AND t.channel_id = $2`,
        [accountId, channelId]
      )
    )[0];
    if (row === undefined) {
      return null;
    }
    return {
      listen_count: asNumber(row.listen_count),
      completion_count: asNumber(row.completion_count),
      recent_score: asNumber(row.recent_score),
      long_term_score: asNumber(row.long_term_score),
      first_listened_at: asDate(row.first_listened_at),
      last_listened_at: asDate(row.last_listened_at),
      scores_updated_at: asDate(row.scores_updated_at),
    };
  };

  const requireTasteRow = async (accountId: number, channelId: number): Promise<TasteRow> => {
    const row = await tasteRow(accountId, channelId);
    if (row === null) {
      throw new Error('expected a taste row');
    }
    return row;
  };

  const tasteRowCount = async (accountId: number): Promise<number> =>
    asNumber(
      firstRow(
        await query(
          `SELECT count(*)::int AS total
             FROM stats_taste_profile t
             JOIN listener_identity.stats_listener l ON l.listener_id = t.listener_id
            WHERE l.account_id = $1`,
          [accountId]
        )
      ).total
    );

  const setTasteScores = async (
    accountId: number,
    channelId: number,
    scoresUpdatedAtSql: string
  ): Promise<void> => {
    await query(
      `UPDATE stats_taste_profile t
          SET recent_score = 1, long_term_score = 1, scores_updated_at = ${scoresUpdatedAtSql}
         FROM listener_identity.stats_listener l
        WHERE l.listener_id = t.listener_id AND l.account_id = $1 AND t.channel_id = $2`,
      [accountId, channelId]
    );
  };

  beforeAll(async () => {
    const started = await startTestApp();
    server = started.server;
    ormContext = started.ormContext;
    if (!ormContext) {
      throw new Error('ORM context required for the stats listen write integration test');
    }
    manager = ormContext.dataSourceReadWrite.manager;

    listener = await seedAccount('listener', true);
    owner = await seedAccount('owner', true);
    const { PlaylistService } = await import('@podverse/orm');
    const playlist = await new PlaylistService().getOrCreateDefaultLikesPlaylist(
      owner.id,
      MediumEnum.AV
    );
    ownerPlaylist = { id: playlist.id, idText: playlist.id_text };

    podcastChannelId = await seedChannel('podcast', MediumEnum.Podcast);
    podcastItem = await seedItem(podcastChannelId, 'episode', ITEM_DURATION_SECONDS);
    hiddenShowItem = await seedItem(podcastChannelId, 'hidden-show', ITEM_DURATION_SECONDS);
    concurrencyItem = await seedItem(podcastChannelId, 'concurrency', ITEM_DURATION_SECONDS);
    clip = await seedClip(`swcl${suffix}`, false);
    removedClip = await seedClip(`swrm${suffix}`, true);

    const artistGuid = randomUUID();
    artistChannelId = await seedChannel('artist', MediumEnum.PublisherMusic, artistGuid);
    albumChannelId = await seedChannel('album', MediumEnum.Music);
    track = await seedItem(albumChannelId, 'track', null);
    const publisher = firstRow(
      await query('INSERT INTO channel_publisher (channel_id) VALUES ($1) RETURNING id', [
        albumChannelId,
      ])
    );
    await query(
      'INSERT INTO channel_publisher_remote_item (channel_publisher_id, feed_guid) VALUES ($1, $2)',
      [asNumber(publisher.id), artistGuid]
    );
  }, 60000);

  afterAll(async () => {
    if (ormContext) {
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

  it('stores a counted item listen with one listener id, daily rows, and a new taste row', async () => {
    expect(
      await listen({
        accountId: listener.id,
        target: itemTarget(podcastItem),
        clientListenId: randomUUID(),
        secondsHeard: 75,
      })
    ).toBe('counted');

    expect(await listenerRowCount(listener.id)).toBe(1);
    const events = await listenEvents(listener.id);
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({
      item_id: podcastItem.id,
      channel_id: podcastChannelId,
      clip_id: null,
      seconds_heard: 75,
      completed: false,
    });
    expect(await dailyCounts('item', podcastItem.id, todayUtc())).toEqual({
      listener_count: 1,
      completion_count: 0,
    });
    expect(await dailyCounts('channel', podcastChannelId, todayUtc())).toEqual({
      listener_count: 1,
      completion_count: 0,
    });
    expect(await tasteRow(listener.id, podcastChannelId)).toMatchObject({
      listen_count: 1,
      completion_count: 0,
      recent_score: 1,
      long_term_score: 1,
    });
  });

  it('counts a second session on the same item without a second daily listener', async () => {
    expect(
      await listen({
        accountId: listener.id,
        target: itemTarget(podcastItem),
        clientListenId: secondSession,
        secondsHeard: 90,
      })
    ).toBe('counted');

    expect(await listenEvents(listener.id)).toHaveLength(2);
    expect(await dailyCounts('item', podcastItem.id, todayUtc())).toMatchObject({
      listener_count: 1,
    });
    expect(await dailyCounts('channel', podcastChannelId, todayUtc())).toMatchObject({
      listener_count: 1,
    });
    expect(await tasteRow(listener.id, podcastChannelId)).toMatchObject({ listen_count: 2 });
    expect(await listenerRowCount(listener.id)).toBe(1);
  });

  it('answers a repeated session report with unchanged and a finished one with updated', async () => {
    const tasteBefore = await requireTasteRow(listener.id, podcastChannelId);
    const repeat: ListenInput = {
      accountId: listener.id,
      target: itemTarget(podcastItem),
      clientListenId: secondSession,
      secondsHeard: 90,
    };

    expect(await listen(repeat)).toBe('unchanged');
    expect(await listen({ ...repeat, completed: true })).toBe('updated');

    const events = await listenEvents(listener.id);
    expect(events).toHaveLength(2);
    expect(events.find((event) => event.client_listen_id === secondSession)?.completed).toBe(true);
    expect(await dailyCounts('item', podcastItem.id, todayUtc())).toEqual({
      listener_count: 1,
      completion_count: 1,
    });
    expect(await dailyCounts('channel', podcastChannelId, todayUtc())).toEqual({
      listener_count: 1,
      completion_count: 1,
    });
    const tasteAfter = await requireTasteRow(listener.id, podcastChannelId);
    expect(tasteAfter.listen_count).toBe(tasteBefore.listen_count);
    expect(tasteAfter.completion_count).toBe(tasteBefore.completion_count + 1);
    expect(tasteAfter.recent_score).toBeCloseTo(tasteBefore.recent_score + 1, 6);
    expect(tasteAfter.long_term_score).toBeCloseTo(tasteBefore.long_term_score + 1, 6);
  });

  it('stores nothing below the counted-listen rule and creates no listener id for it', async () => {
    const newcomer = await seedAccount('below-threshold', true);
    expect(
      await listen({
        accountId: newcomer.id,
        target: itemTarget(podcastItem),
        clientListenId: randomUUID(),
        secondsHeard: 49,
      })
    ).toBe('below_threshold');
    expect(await listenerRowCount(newcomer.id)).toBe(0);

    const eventsBefore = await listenEvents(listener.id);
    expect(
      await listen({
        accountId: listener.id,
        target: itemTarget(podcastItem),
        clientListenId: randomUUID(),
        secondsHeard: 49,
      })
    ).toBe('below_threshold');
    expect(await listenEvents(listener.id)).toHaveLength(eventsBefore.length);
  });

  it('writes nothing for an account that turned Popularity Tracking off', async () => {
    const declined = await seedAccount('declined', false);
    expect(
      await listen({
        accountId: declined.id,
        target: itemTarget(podcastItem),
        clientListenId: randomUUID(),
        secondsHeard: 120,
      })
    ).toBe('not_allowed');
    expect(await open(declined.id, { kind: 'account', id_text: owner.idText })).toBe('not_allowed');
    expect(await listenerRowCount(declined.id)).toBe(0);
  });

  it('stops new sessions at the daily cap and still records a finish for a stored session', async () => {
    const capped = await seedAccount('daily-cap', true);
    const firstSession = randomUUID();
    const report = (clientListenId: string, completed = false): ListenInput => ({
      accountId: capped.id,
      target: itemTarget(podcastItem),
      clientListenId,
      secondsHeard: 70,
      completed,
      dailyCap: 2,
    });

    expect(await listen(report(firstSession))).toBe('counted');
    expect(await listen(report(randomUUID()))).toBe('counted');
    expect(await listen(report(randomUUID()))).toBe('daily_cap_reached');
    expect(await listen(report(firstSession, true))).toBe('updated');
    expect(await listenEvents(capped.id)).toHaveLength(2);
  });

  it('leaves the taste row of a hidden show alone and still counts the listen daily', async () => {
    const hider = await seedAccount('hidden', true);
    expect(
      await listen({
        accountId: hider.id,
        target: itemTarget(podcastItem),
        clientListenId: randomUUID(),
        secondsHeard: 80,
      })
    ).toBe('counted');
    await query(
      'INSERT INTO stats_taste_profile_hidden (listener_id, channel_id) VALUES ($1::uuid, $2)',
      [await listenerIdOf(hider.id), podcastChannelId]
    );
    const tasteBefore = await tasteRow(hider.id, podcastChannelId);

    expect(
      await listen({
        accountId: hider.id,
        target: itemTarget(hiddenShowItem),
        clientListenId: randomUUID(),
        secondsHeard: 80,
        completed: true,
      })
    ).toBe('counted');

    expect(await dailyCounts('item', hiddenShowItem.id, todayUtc())).toEqual({
      listener_count: 1,
      completion_count: 1,
    });
    expect(await tasteRow(hider.id, podcastChannelId)).toEqual(tasteBefore);
    expect(await tasteRowCount(hider.id)).toBe(1);
  });

  it('adds a track listen to the album and artist taste rows and to track and album daily rows', async () => {
    expect(
      await listen({
        accountId: listener.id,
        target: itemTarget(track),
        clientListenId: randomUUID(),
        secondsHeard: 75,
      })
    ).toBe('counted');

    expect(await tasteRow(listener.id, albumChannelId)).toMatchObject({ listen_count: 1 });
    expect(await tasteRow(listener.id, artistChannelId)).toMatchObject({ listen_count: 1 });
    expect(await dailyCounts('item', track.id, todayUtc())).toEqual({
      listener_count: 1,
      completion_count: 0,
    });
    expect(await dailyCounts('channel', albumChannelId, todayUtc())).toEqual({
      listener_count: 1,
      completion_count: 0,
    });
    expect(
      firstRow(
        await query(
          'SELECT count(*)::int AS total FROM stats_daily_channel WHERE channel_id = $1',
          [artistChannelId]
        )
      ).total
    ).toBe(0);
  });

  it('stores a clip listen with its item and channel and refuses removed or unknown clips', async () => {
    const clipSession = randomUUID();
    expect(
      await listen({
        accountId: listener.id,
        target: { kind: 'clip', id_text: clip.idText },
        clientListenId: clipSession,
        secondsHeard: 500,
      })
    ).toBe('counted');

    const event = (await listenEvents(listener.id)).find(
      (row) => row.client_listen_id === clipSession
    );
    expect(event).toMatchObject({
      clip_id: clip.id,
      item_id: podcastItem.id,
      channel_id: podcastChannelId,
      seconds_heard: 60,
    });
    expect(await dailyCounts('clip', clip.id, todayUtc())).toEqual({
      listener_count: 1,
      completion_count: 0,
    });

    const otherClip = (idText: string): ListenInput => ({
      accountId: listener.id,
      target: { kind: 'clip', id_text: idText },
      clientListenId: randomUUID(),
      secondsHeard: 30,
    });
    expect(await listen(otherClip(removedClip.idText))).toBe('clip_source_removed');
    expect(await listen(otherClip(`swnf${suffix}`))).toBe('not_found');
  });

  it('fades stored scores across the gap before adding a counted listen', async () => {
    await setTasteScores(listener.id, podcastChannelId, `now() - interval '14 days'`);

    expect(
      await listen({
        accountId: listener.id,
        target: itemTarget(podcastItem),
        clientListenId: randomUUID(),
        secondsHeard: 75,
      })
    ).toBe('counted');

    const taste = await requireTasteRow(listener.id, podcastChannelId);
    expect(taste.recent_score).toBeCloseTo(1.5, 4);
    expect(taste.long_term_score).toBeCloseTo(
      fadeTasteScore({
        score: 1,
        from: new Date(0),
        to: new Date(14 * DAY_MS),
        halfLifeDays: POPULARITY_TASTE_HALF_LIFE_DAYS.longTerm,
      }) + 1,
      4
    );
  });

  it('counts a late finish on its event day and fades its weight to the taste row time', async () => {
    const late = await seedAccount('late-finish', true);
    const session = randomUUID();
    const report: ListenInput = {
      accountId: late.id,
      target: itemTarget(podcastItem),
      clientListenId: session,
      secondsHeard: 75,
    };
    expect(await listen(report)).toBe('counted');

    const [event] = await listenEvents(late.id);
    const eventId = asText(event?.id);
    await query(
      `UPDATE stats_listen_event SET created_at = created_at - interval '3 days' WHERE id = $1`,
      [eventId]
    );
    const earlierDay = asText(
      firstRow(
        await query(
          `SELECT (created_at AT TIME ZONE 'UTC')::date::text AS day
             FROM stats_listen_event WHERE id = $1`,
          [eventId]
        )
      ).day
    );
    await query(
      `INSERT INTO stats_daily_item (item_id, day, listener_count, completion_count)
       VALUES ($1, $2::date, 1, 0)`,
      [podcastItem.id, earlierDay]
    );
    await query(
      `INSERT INTO stats_daily_channel (channel_id, day, listener_count, completion_count)
       VALUES ($1, $2::date, 1, 0)`,
      [podcastChannelId, earlierDay]
    );
    await setTasteScores(late.id, podcastChannelId, 'now()');
    const tasteBefore = await requireTasteRow(late.id, podcastChannelId);
    const todayItemBefore = await dailyCounts('item', podcastItem.id, todayUtc());
    const todayChannelBefore = await dailyCounts('channel', podcastChannelId, todayUtc());

    expect(await listen({ ...report, completed: true })).toBe('updated');

    expect(await dailyCounts('item', podcastItem.id, earlierDay)).toEqual({
      listener_count: 1,
      completion_count: 1,
    });
    expect(await dailyCounts('channel', podcastChannelId, earlierDay)).toEqual({
      listener_count: 1,
      completion_count: 1,
    });
    expect(await dailyCounts('item', podcastItem.id, todayUtc())).toEqual(todayItemBefore);
    expect(await dailyCounts('channel', podcastChannelId, todayUtc())).toEqual(todayChannelBefore);
    const tasteAfter = await requireTasteRow(late.id, podcastChannelId);
    expect(tasteAfter.completion_count).toBe(tasteBefore.completion_count + 1);
    expect(tasteAfter.recent_score).toBeCloseTo(
      1 + 0.5 ** (3 / POPULARITY_TASTE_HALF_LIFE_DAYS.recent),
      4
    );
    expect(tasteAfter.long_term_score).toBeCloseTo(
      1 + 0.5 ** (3 / POPULARITY_TASTE_HALF_LIFE_DAYS.longTerm),
      4
    );
    expect(tasteAfter.last_listened_at).toEqual(tasteBefore.last_listened_at);
  });

  it('counts a profile or playlist open once a day, never your own, and never in taste rows', async () => {
    const tasteRowsBefore = await tasteRowCount(listener.id);
    const ownerProfile: StatsOpenTarget = { kind: 'account', id_text: owner.idText };
    const ownerPlaylistTarget: StatsOpenTarget = {
      kind: 'playlist',
      id_text: ownerPlaylist.idText,
    };

    expect(await open(listener.id, ownerProfile)).toBe('counted');
    expect(await open(listener.id, ownerProfile)).toBe('unchanged');
    expect(await dailyOpenCount('account', owner.id, todayUtc())).toBe(1);
    expect(await open(listener.id, { kind: 'account', id_text: listener.idText })).toBe(
      'own_content'
    );

    expect(await open(listener.id, ownerPlaylistTarget)).toBe('counted');
    expect(await dailyOpenCount('playlist', ownerPlaylist.id, todayUtc())).toBe(1);
    expect(await open(owner.id, ownerPlaylistTarget)).toBe('own_content');
    expect(await open(listener.id, { kind: 'playlist', id_text: `swnf${suffix}` })).toBe(
      'not_found'
    );

    expect(await tasteRowCount(listener.id)).toBe(tasteRowsBefore);
  });

  it('keeps one listener id and one daily listener when five sessions arrive at once', async () => {
    const racer = await seedAccount('concurrency', true);
    const results = await Promise.all(
      Array.from({ length: 5 }, () =>
        listen({
          accountId: racer.id,
          target: itemTarget(concurrencyItem),
          clientListenId: randomUUID(),
          secondsHeard: 75,
        })
      )
    );

    expect(results).toEqual(['counted', 'counted', 'counted', 'counted', 'counted']);
    expect(await listenerRowCount(racer.id)).toBe(1);
    expect(await listenEvents(racer.id)).toHaveLength(5);
    expect(await dailyCounts('item', concurrencyItem.id, todayUtc())).toEqual({
      listener_count: 1,
      completion_count: 0,
    });
  });
});
