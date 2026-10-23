import type { Server } from 'http';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

import { MediumEnum } from '@podverse/helpers';
import type { ORMContext } from '@podverse/orm';

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

type SeededShow = { channelId: number; itemId: number };

type SeededAccount = { accountId: number; playlistId: number };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function rowsOf(value: unknown): Record<string, unknown>[] {
  if (!Array.isArray(value)) {
    return [];
  }
  const rows: Record<string, unknown>[] = [];
  for (const entry of value) {
    if (isRecord(entry)) {
      rows.push(entry);
    }
  }
  return rows;
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

async function seedShow(manager: EntityManager, runId: number): Promise<SeededShow> {
  const { Channel, Feed, Item } = await import('@podverse/orm');
  const feedRepo = manager.getRepository(Feed);
  const feed = await feedRepo.save(
    feedRepo.create({
      url: `https://stats-foundation-${runId}.example.com/feed.xml`,
      podcast_index_id: 1_150_000_000 + (runId % 900_000_000),
    })
  );
  const channelRepo = manager.getRepository(Channel);
  const channel = await channelRepo.save(
    channelRepo.create({
      feed_id: feed.id,
      medium_id: MediumEnum.AV,
      title: `Stats foundation ${runId}`,
    })
  );
  const itemRepo = manager.getRepository(Item);
  const item = await itemRepo.save(
    itemRepo.create({
      channel_id: String(channel.id),
      title: 'Stats foundation episode',
      item_flag_status: { id: 1 },
      guid: `https://stats-foundation.example.com/${runId}/episode`,
    })
  );
  return { channelId: channel.id, itemId: item.id };
}

async function seedAccount(label: string, runId: number): Promise<SeededAccount> {
  const { AccountService, PlaylistService } = await import('@podverse/orm');
  const email = `stats-foundation-${label}-${runId}@example.com`;
  const accountService = new AccountService();
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
  const playlist = await new PlaylistService().getOrCreateDefaultLikesPlaylist(
    account.id,
    MediumEnum.AV
  );
  return { accountId: account.id, playlistId: playlist.id };
}

describe('Popularity tracking foundation schema (real database)', () => {
  let server: Server | undefined;
  let ormContext: ORMContext | undefined;
  let manager: EntityManager;
  let show: SeededShow;
  let profileOwner: SeededAccount;
  let listenerId: string;
  const runId = Date.now();

  const query = async (sql: string, params: unknown[] = []): Promise<unknown> =>
    manager.query(sql, params);

  const createListener = async (accountId: number): Promise<string> =>
    asText(
      firstRow(
        await query(
          'INSERT INTO listener_identity.stats_listener (account_id) VALUES ($1) RETURNING listener_id',
          [accountId]
        )
      ).listener_id
    );

  const insertListen = async (listener: string, createdAt: string): Promise<string> =>
    asText(
      firstRow(
        await query(
          `INSERT INTO public.stats_listen_event (created_at, listener_id, channel_id, item_id)
           VALUES ($1::timestamptz, $2::uuid, $3, $4)
           RETURNING id`,
          [createdAt, listener, show.channelId, show.itemId]
        )
      ).id
    );

  const partitionOf = async (eventId: string): Promise<string> =>
    asText(
      firstRow(
        await query(
          'SELECT tableoid::regclass::text AS partition FROM public.stats_listen_event WHERE id = $1',
          [eventId]
        )
      ).partition
    );

  const listenCount = async (listener: string): Promise<number> =>
    Number(
      firstRow(
        await query(
          'SELECT count(*)::int AS total FROM public.stats_listen_event WHERE listener_id = $1::uuid',
          [listener]
        )
      ).total
    );

  const ensurePartition = async (parentTable: string, monthStart: string): Promise<unknown> =>
    firstRow(
      await query('SELECT public.stats_event_ensure_month_partition($1, $2::date) AS created', [
        parentTable,
        monthStart,
      ])
    ).created;

  const dropPartitionsBefore = async (parentTable: string, cutoff: string): Promise<unknown> =>
    firstRow(
      await query(
        'SELECT public.stats_event_drop_month_partitions_before($1, $2::date) AS dropped',
        [parentTable, cutoff]
      )
    ).dropped;

  const relationExists = async (name: string): Promise<boolean> =>
    firstRow(await query('SELECT to_regclass($1) IS NOT NULL AS present', [`public.${name}`]))
      .present === true;

  const removeTestPartitions = async (): Promise<void> => {
    await dropPartitionsBefore('stats_listen_event', '2001-04-01');
    await dropPartitionsBefore('stats_open_event', '2001-04-01');
  };

  beforeAll(async () => {
    const started = await startTestApp();
    server = started.server;
    ormContext = started.ormContext;
    if (!ormContext) {
      throw new Error('ORM context required for the stats foundation schema integration test');
    }
    manager = ormContext.dataSourceReadWrite.manager;
    await removeTestPartitions();
    show = await seedShow(manager, runId);
    profileOwner = await seedAccount('owner', runId);
    listenerId = await createListener(profileOwner.accountId);
  }, 60000);

  afterAll(async () => {
    if (ormContext) {
      await removeTestPartitions();
      const { AccountService } = await import('@podverse/orm');
      await new AccountService().delete(profileOwner.accountId);
    }
    await stopTestApp(server, ormContext);
  });

  it('creates a month partition once and routes that month into it', async () => {
    expect(await ensurePartition('stats_listen_event', '2001-01-01')).toBe(true);
    expect(await ensurePartition('stats_listen_event', '2001-01-01')).toBe(false);

    const eventId = await insertListen(listenerId, '2001-01-15T12:00:00Z');
    expect(await partitionOf(eventId)).toBe('stats_listen_event_p200101');
  });

  it('moves rows from the default partition into a month partition created after them', async () => {
    const eventId = await insertListen(listenerId, '2001-02-10T08:00:00Z');
    expect(await partitionOf(eventId)).toBe('stats_listen_event_default');
    const countBefore = await listenCount(listenerId);

    expect(await ensurePartition('stats_listen_event', '2001-02-01')).toBe(true);

    expect(await partitionOf(eventId)).toBe('stats_listen_event_p200102');
    expect(await listenCount(listenerId)).toBe(countBefore);
    expect(await relationExists('stats_listen_event_default')).toBe(true);
    const nextEventId = await insertListen(listenerId, '2001-05-01T00:00:00Z');
    expect(await partitionOf(nextEventId)).toBe('stats_listen_event_default');
  });

  it('drops only the partitions that end on or before the cutoff', async () => {
    await ensurePartition('stats_listen_event', '2001-01-01');
    await ensurePartition('stats_listen_event', '2001-02-01');
    await ensurePartition('stats_listen_event', '2001-03-01');

    expect(await dropPartitionsBefore('stats_listen_event', '2001-03-01')).toBe(2);

    expect(await relationExists('stats_listen_event_p200101')).toBe(false);
    expect(await relationExists('stats_listen_event_p200102')).toBe(false);
    expect(await relationExists('stats_listen_event_p200103')).toBe(true);
  });

  it('rejects a table outside the allowlist and a month start that is not the first', async () => {
    await expect(ensurePartition('stats_listener', '2001-01-01')).rejects.toThrow(
      /unsupported partitioned table/
    );
    await expect(ensurePartition('account', '2001-01-01')).rejects.toThrow(
      /unsupported partitioned table/
    );
    await expect(ensurePartition('stats_listen_event', '2001-01-15')).rejects.toThrow(
      /first day of a month/
    );
    await expect(ensurePartition('stats_open_event', '2001-02-28')).rejects.toThrow(
      /first day of a month/
    );
    await expect(dropPartitionsBefore('stats_listener', '2001-01-01')).rejects.toThrow(
      /unsupported partitioned table/
    );
  });

  it('removes listener-linked rows with the account and keeps daily totals', async () => {
    const { AccountService } = await import('@podverse/orm');
    const opener = await seedAccount('opener', runId);
    const openerListenerId = await createListener(opener.accountId);

    await insertListen(openerListenerId, '2001-05-05T10:00:00Z');
    await query(
      `INSERT INTO public.stats_open_event (created_at, listener_id, account_id)
       VALUES ('2001-05-05T10:05:00Z', $1::uuid, $2)`,
      [openerListenerId, profileOwner.accountId]
    );
    await query(
      `INSERT INTO public.stats_taste_profile
         (listener_id, channel_id, listen_count, first_listened_at, last_listened_at, scores_updated_at)
       VALUES ($1::uuid, $2, 1, '2001-05-05T10:00:00Z', '2001-05-05T10:00:00Z', '2001-05-05T10:00:00Z')`,
      [openerListenerId, show.channelId]
    );
    await query(
      'INSERT INTO public.stats_taste_profile_hidden (listener_id, channel_id) VALUES ($1::uuid, $2)',
      [openerListenerId, show.channelId]
    );
    await query(
      `INSERT INTO public.stats_daily_channel (channel_id, day, listener_count) VALUES ($1, '2001-05-05', 1)`,
      [show.channelId]
    );
    await query(
      `INSERT INTO public.stats_daily_item (item_id, day, listener_count) VALUES ($1, '2001-05-05', 1)`,
      [show.itemId]
    );

    await new AccountService().delete(opener.accountId);

    const counts = firstRow(
      await query(
        `SELECT
           (SELECT count(*)::int FROM listener_identity.stats_listener WHERE listener_id = $1::uuid) AS listeners,
           (SELECT count(*)::int FROM public.stats_listen_event WHERE listener_id = $1::uuid) AS listens,
           (SELECT count(*)::int FROM public.stats_open_event WHERE listener_id = $1::uuid) AS opens,
           (SELECT count(*)::int FROM public.stats_taste_profile WHERE listener_id = $1::uuid) AS taste,
           (SELECT count(*)::int FROM public.stats_taste_profile_hidden WHERE listener_id = $1::uuid) AS hidden,
           (SELECT count(*)::int FROM public.stats_daily_channel WHERE channel_id = $2) AS daily_channel,
           (SELECT count(*)::int FROM public.stats_daily_item WHERE item_id = $3) AS daily_item`,
        [openerListenerId, show.channelId, show.itemId]
      )
    );
    expect(counts).toEqual({
      listeners: 0,
      listens: 0,
      opens: 0,
      taste: 0,
      hidden: 0,
      daily_channel: 1,
      daily_item: 1,
    });
  });

  it('keeps the listener mapping out of reach of the read-only role', async () => {
    const row = firstRow(
      await query(
        `SELECT
           has_schema_privilege('podverse_app_read', 'listener_identity', 'USAGE') AS read_usage,
           has_table_privilege('podverse_app_read', 'listener_identity.stats_listener', 'SELECT') AS read_select,
           has_schema_privilege('podverse_app_read_write', 'listener_identity', 'USAGE') AS read_write_usage`
      )
    );
    expect(row).toEqual({ read_usage: false, read_select: false, read_write_usage: true });
  });

  it('has no per-entity event, guid mapping, or rolling aggregate stats tables', async () => {
    const legacyTables = [
      'stats_track_event_account',
      'stats_track_event_channel',
      'stats_track_event_clip',
      'stats_track_event_item',
      'stats_track_event_playlist',
      'stats_track_account_guid',
      'stats_aggregated_account',
      'stats_aggregated_channel',
      'stats_aggregated_clip',
      'stats_aggregated_item',
      'stats_aggregated_playlist',
    ];
    for (const tableName of legacyTables) {
      expect(await relationExists(tableName), tableName).toBe(false);
    }
  });

  it('requires an open event to name exactly one of a profile or a playlist', async () => {
    await expect(
      query(
        `INSERT INTO public.stats_open_event (created_at, listener_id, account_id, playlist_id)
         VALUES ('2001-03-10T00:00:00Z', $1::uuid, $2, $3)`,
        [listenerId, profileOwner.accountId, profileOwner.playlistId]
      )
    ).rejects.toThrow(/stats_open_event_target_check/);
    await expect(
      query(
        `INSERT INTO public.stats_open_event (created_at, listener_id)
         VALUES ('2001-03-10T00:00:00Z', $1::uuid)`,
        [listenerId]
      )
    ).rejects.toThrow(/stats_open_event_target_check/);
  });
});
