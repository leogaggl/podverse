import type { Server } from 'http';
import type { EntityManager } from 'typeorm';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

import { fadeTasteScore, MediumEnum, POPULARITY_TASTE_HALF_LIFE_DAYS } from '@podverse/helpers';
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

type MergeApi = {
  verifyAndApplyDuplicateMerges: typeof import('@podverse/orm').verifyAndApplyDuplicateMerges;
  revertChannelMerge: typeof import('@podverse/orm').revertChannelMerge;
  ChannelMerge: typeof import('@podverse/orm').ChannelMerge;
  ChannelMergeStatus: typeof import('@podverse/orm').ChannelMergeStatus;
  ChannelMergeMode: typeof import('@podverse/orm').ChannelMergeMode;
};

type SeededShow = {
  feedId: number;
  channelId: number;
  podcastIndexId: number;
  itemIdByGuid: Map<string, number>;
};

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

function asId(value: unknown): number {
  if (typeof value === 'number' && Number.isInteger(value)) {
    return value;
  }
  if (typeof value === 'string' && value !== '') {
    const parsed = Number(value);
    if (Number.isInteger(parsed)) {
      return parsed;
    }
  }
  throw new Error('expected an integer id');
}

const STATS_TRACK_EVENT_RETENTION_DAYS = 90;

const DAY_MS = 86_400_000;

/** The current UTC date minus `daysAgo` days, as `YYYY-MM-DD`. */
function utcDayAgo(daysAgo: number): string {
  return new Date(Date.now() - daysAgo * DAY_MS).toISOString().slice(0, 10);
}

type DailyCounts = Record<string, [number, number]>;

async function dailyCounts(
  manager: EntityManager,
  table: 'stats_daily_channel' | 'stats_daily_item',
  key: 'channel_id' | 'item_id',
  id: number
): Promise<DailyCounts> {
  const rows = rowsOf(
    await manager.query(
      `SELECT day::text AS day, listener_count, completion_count FROM ${table} WHERE ${key} = $1`,
      [id]
    )
  );
  const counts: DailyCounts = {};
  for (const row of rows) {
    if (typeof row.day === 'string') {
      counts[row.day] = [asId(row.listener_count), asId(row.completion_count)];
    }
  }
  return counts;
}

async function insertDaily(
  manager: EntityManager,
  table: 'stats_daily_channel' | 'stats_daily_item',
  key: 'channel_id' | 'item_id',
  id: number,
  counts: DailyCounts
): Promise<void> {
  for (const [day, [listeners, completions]] of Object.entries(counts)) {
    await manager.query(
      `INSERT INTO ${table} (${key}, day, listener_count, completion_count) VALUES ($1, $2::date, $3, $4)`,
      [id, day, listeners, completions]
    );
  }
}

async function rangeCounts(
  manager: EntityManager,
  table: 'stats_popularity_channel' | 'stats_popularity_item',
  key: 'channel_id' | 'item_id',
  id: number
): Promise<number[] | null> {
  const row = rowsOf(
    await manager.query(
      `SELECT day_count, week_count, month_count, all_time_count FROM ${table} WHERE ${key} = $1`,
      [id]
    )
  )[0];
  if (row === undefined) {
    return null;
  }
  return [row.day_count, row.week_count, row.month_count, row.all_time_count].map(asId);
}

async function insertRange(
  manager: EntityManager,
  table: 'stats_popularity_channel' | 'stats_popularity_item',
  key: 'channel_id' | 'item_id',
  id: number,
  counts: readonly [number, number, number, number]
): Promise<void> {
  await manager.query(
    `INSERT INTO ${table} (${key}, day_count, week_count, month_count, all_time_count)
     VALUES ($1, $2, $3, $4, $5)`,
    [id, ...counts]
  );
}

let seed = 0;

function nextRunId(): number {
  seed += 1;
  return Date.now() + seed;
}

function podcastIndexId(runId: number, slot: number): number {
  return 700_000_000 + (runId % 400_000_000) + slot;
}

async function following(manager: EntityManager, accountId: number): Promise<number[]> {
  const result: unknown = await manager.query(
    `SELECT channel_id FROM account_following_channel WHERE account_id = $1 ORDER BY channel_id`,
    [accountId]
  );
  return rowsOf(result).map((row) => asId(row.channel_id));
}

async function lifecycleKey(manager: EntityManager, feedId: number): Promise<string | null> {
  const result: unknown = await manager.query(
    `SELECT t.state_key
     FROM feed_lifecycle_state s
     JOIN feed_lifecycle_state_type t ON t.id = s.feed_lifecycle_state_type_id
     WHERE s.feed_id = $1`,
    [feedId]
  );
  const row = rowsOf(result)[0];
  return row !== undefined && typeof row.state_key === 'string' ? row.state_key : null;
}

async function seedShow(
  manager: EntityManager,
  runId: number,
  slot: number,
  guids: readonly string[]
): Promise<SeededShow> {
  const { Channel, Feed, Item } = await import('@podverse/orm');
  const podcastId = podcastIndexId(runId, slot);
  const feedRepo = manager.getRepository(Feed);
  const feed = await feedRepo.save(
    feedRepo.create({
      url: `https://channel-merge-${runId}-${slot}.example.com/feed.xml`,
      podcast_index_id: podcastId,
    })
  );
  const channelRepo = manager.getRepository(Channel);
  const channel = await channelRepo.save(
    channelRepo.create({
      feed_id: feed.id,
      medium_id: MediumEnum.AV,
      title: `Channel merge ${runId} ${slot}`,
    })
  );
  const itemRepo = manager.getRepository(Item);
  const itemIdByGuid = new Map<string, number>();
  for (const [index, guid] of guids.entries()) {
    const item = await itemRepo.save(
      itemRepo.create({
        channel_id: String(channel.id),
        title: `Episode ${index}`,
        item_flag_status: { id: 1 },
        guid,
      })
    );
    itemIdByGuid.set(guid, item.id);
  }
  return {
    feedId: feed.id,
    channelId: channel.id,
    podcastIndexId: podcastId,
    itemIdByGuid,
  };
}

async function seedAccount(
  manager: EntityManager,
  label: string,
  runId: number
): Promise<{ accountId: number; queueId: number }> {
  const { AccountService, QueueService } = await import('@podverse/orm');
  const email = `channel-merge-${label}-${runId}@example.com`;
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
  const queues = await new QueueService().getAllPrivate(account.id);
  const avQueue = queues.find((queue) => queue.medium_id === MediumEnum.AV);
  if (!avQueue) {
    throw new Error(`Expected AV queue for ${label}`);
  }
  const result: unknown = await manager.query(`SELECT id FROM queue WHERE id_text = $1`, [
    avQueue.id_text,
  ]);
  const row = rowsOf(result)[0];
  if (row === undefined) {
    throw new Error(`Expected queue row for ${label}`);
  }
  return { accountId: account.id, queueId: asId(row.id) };
}

describe('channel merge apply and revert', () => {
  let server: Server | undefined;
  let ormContext: ORMContext | undefined;
  let mergeApi: MergeApi;

  beforeAll(async () => {
    const started = await startTestApp();
    server = started.server;
    ormContext = started.ormContext;
    if (!ormContext) {
      throw new Error('ORM context required for channel merge integration test');
    }
    await ormContext.dataSourceReadWrite.query(`DELETE FROM channel_merge`);
    const orm = await import('@podverse/orm');
    mergeApi = {
      verifyAndApplyDuplicateMerges: orm.verifyAndApplyDuplicateMerges,
      revertChannelMerge: orm.revertChannelMerge,
      ChannelMerge: orm.ChannelMerge,
      ChannelMergeStatus: orm.ChannelMergeStatus,
      ChannelMergeMode: orm.ChannelMergeMode,
    };
  }, 120000);

  afterAll(async () => {
    await stopTestApp(server, ormContext);
  });

  it('absorbs both follows, keeps queue progress, and restores them on revert', async () => {
    if (!ormContext) {
      throw new Error('ORM context required');
    }
    const manager = ormContext.dataSourceReadWrite.manager;
    const runId = nextRunId();
    const guids = [0, 1, 2].map(
      (index) => `https://channel-merge.example.com/${runId}/episode-${index}`
    );
    const oldShow = await seedShow(manager, runId, 1, guids);
    const survivor = await seedShow(manager, runId, 2, guids);
    const onlyOld = await seedAccount(manager, 'only-old', runId);
    const both = await seedAccount(manager, 'both', runId);
    const matchedGuid = guids[0];
    if (matchedGuid === undefined) {
      throw new Error('expected a shared guid');
    }
    const oldItemId = oldShow.itemIdByGuid.get(matchedGuid);
    const survivorItemId = survivor.itemIdByGuid.get(matchedGuid);
    if (oldItemId === undefined || survivorItemId === undefined) {
      throw new Error('expected matched items on both channels');
    }

    await manager.query(
      `INSERT INTO account_following_channel (account_id, channel_id) VALUES ($1, $2), ($3, $4), ($3, $5)`,
      [onlyOld.accountId, oldShow.channelId, both.accountId, oldShow.channelId, survivor.channelId]
    );
    await manager.query(
      `INSERT INTO queue_resource (queue_id, list_position, playback_position, media_file_duration, completed, item_id)
       VALUES ($1, 1, 42.5, 100, true, $2)`,
      [onlyOld.queueId, oldItemId]
    );
    await manager.query(
      `INSERT INTO clip (id_text, account_id, item_id, start_time, created_at, sharable_status_id)
       VALUES ($1, $2, $3, 0, now(), 1)`,
      [`mc${String(runId).slice(-8)}`, onlyOld.accountId, oldItemId]
    );

    const mergeRepo = manager.getRepository(mergeApi.ChannelMerge);
    const detected = await mergeRepo.save(
      mergeRepo.create({
        from_podcast_index_id: oldShow.podcastIndexId,
        to_podcast_index_id: survivor.podcastIndexId,
        status: mergeApi.ChannelMergeStatus.Detected,
        mode: null,
        match_stats: {},
      })
    );

    await mergeApi.verifyAndApplyDuplicateMerges({
      mode: 'dry_run',
      fetchSurvivorFeed: async () => {
        throw new Error('absorb must not fetch the survivor feed');
      },
      enqueueRepointParse: async () => {
        throw new Error('dry_run must not enqueue a parse');
      },
      statsTrackEventRetentionDays: STATS_TRACK_EVENT_RETENTION_DAYS,
    });

    const assessed = await mergeRepo.findOne({ where: { id: detected.id } });
    expect(assessed?.status).toBe(mergeApi.ChannelMergeStatus.Verified);
    expect(assessed?.mode).toBe(mergeApi.ChannelMergeMode.Absorb);
    expect(assessed?.to_channel_id).toBe(survivor.channelId);
    expect(await following(manager, onlyOld.accountId)).toEqual([oldShow.channelId]);
    expect(await following(manager, both.accountId)).toEqual(
      [oldShow.channelId, survivor.channelId].sort((left, right) => left - right)
    );
    expect(await lifecycleKey(manager, oldShow.feedId)).not.toBe('merged');

    const enqueued: string[] = [];
    await mergeApi.verifyAndApplyDuplicateMerges({
      mode: 'apply',
      fetchSurvivorFeed: async () => {
        throw new Error('absorb must not fetch the survivor feed');
      },
      enqueueRepointParse: async () => {
        enqueued.push('parse');
      },
      statsTrackEventRetentionDays: STATS_TRACK_EVENT_RETENTION_DAYS,
    });

    expect(enqueued).toEqual([]);
    expect(await following(manager, onlyOld.accountId)).toEqual([survivor.channelId]);
    expect(await following(manager, both.accountId)).toEqual([survivor.channelId]);
    const queueRows = rowsOf(
      await manager.query(
        `SELECT item_id, playback_position, completed FROM queue_resource WHERE queue_id = $1`,
        [onlyOld.queueId]
      )
    );
    expect(queueRows).toHaveLength(1);
    expect(asId(queueRows[0]?.item_id)).toBe(survivorItemId);
    expect(queueRows[0]?.completed).toBe(true);
    expect(Number(queueRows[0]?.playback_position)).toBe(42.5);
    const clipRows = rowsOf(
      await manager.query(`SELECT item_id FROM clip WHERE account_id = $1`, [onlyOld.accountId])
    );
    expect(asId(clipRows[0]?.item_id)).toBe(survivorItemId);
    expect(await lifecycleKey(manager, oldShow.feedId)).toBe('merged');

    const journalBefore: unknown = await manager.query(
      `SELECT count(*)::int AS n FROM channel_merge_journal WHERE channel_merge_id = $1`,
      [detected.id]
    );
    await mergeApi.verifyAndApplyDuplicateMerges({
      mode: 'apply',
      fetchSurvivorFeed: async () => null,
      enqueueRepointParse: async () => {
        enqueued.push('parse');
      },
      statsTrackEventRetentionDays: STATS_TRACK_EVENT_RETENTION_DAYS,
    });
    const journalAfter: unknown = await manager.query(
      `SELECT count(*)::int AS n FROM channel_merge_journal WHERE channel_merge_id = $1`,
      [detected.id]
    );
    expect(asId(rowsOf(journalAfter)[0]?.n)).toBe(asId(rowsOf(journalBefore)[0]?.n));
    expect(await following(manager, onlyOld.accountId)).toEqual([survivor.channelId]);
    expect(await following(manager, both.accountId)).toEqual([survivor.channelId]);

    await mergeApi.revertChannelMerge(detected.id);
    expect(await following(manager, onlyOld.accountId)).toEqual([oldShow.channelId]);
    expect(await following(manager, both.accountId)).toEqual(
      [oldShow.channelId, survivor.channelId].sort((left, right) => left - right)
    );
    const restoredQueue = rowsOf(
      await manager.query(`SELECT item_id FROM queue_resource WHERE queue_id = $1`, [
        onlyOld.queueId,
      ])
    );
    expect(asId(restoredQueue[0]?.item_id)).toBe(oldItemId);
    const restoredClip = rowsOf(
      await manager.query(`SELECT item_id FROM clip WHERE account_id = $1`, [onlyOld.accountId])
    );
    expect(asId(restoredClip[0]?.item_id)).toBe(oldItemId);
    expect(await lifecycleKey(manager, oldShow.feedId)).toBe('active');
    const reverted = await mergeRepo.findOne({ where: { id: detected.id } });
    expect(reverted?.status).toBe(mergeApi.ChannelMergeStatus.Reverted);
  });

  it('adds daily totals without same-day overlap inside retention, moves listener rows, and restores the totals on revert', async () => {
    if (!ormContext) {
      throw new Error('ORM context required');
    }
    const manager = ormContext.dataSourceReadWrite.manager;
    const runId = nextRunId();
    const sharedGuids = [0, 1, 2].map(
      (index) => `https://channel-merge.example.com/${runId}/popularity-${index}`
    );
    const oldOnlyGuid = `https://channel-merge.example.com/${runId}/popularity-old-only`;
    const oldShow = await seedShow(manager, runId, 21, [...sharedGuids, oldOnlyGuid]);
    const survivor = await seedShow(manager, runId, 22, sharedGuids);
    const pairGuid = sharedGuids[0];
    if (pairGuid === undefined) {
      throw new Error('expected a shared guid');
    }
    const oldItem = oldShow.itemIdByGuid.get(pairGuid);
    const survivorItem = survivor.itemIdByGuid.get(pairGuid);
    const oldOnlyItem = oldShow.itemIdByGuid.get(oldOnlyGuid);
    if (oldItem === undefined || survivorItem === undefined || oldOnlyItem === undefined) {
      throw new Error('expected the matched pair and the unmatched old item');
    }
    const oldChannel = oldShow.channelId;
    const survivorChannel = survivor.channelId;

    const listenerIds: string[] = [];
    for (const label of ['pop-l1', 'pop-l2', 'pop-l3', 'pop-l4']) {
      const { accountId } = await seedAccount(manager, label, runId);
      const row = rowsOf(
        await manager.query(
          'INSERT INTO listener_identity.stats_listener (account_id) VALUES ($1) RETURNING listener_id::text AS listener_id',
          [accountId]
        )
      )[0];
      if (row === undefined || typeof row.listener_id !== 'string') {
        throw new Error(`expected a listener id for ${label}`);
      }
      listenerIds.push(row.listener_id);
    }
    const [l1, l2, l3, l4] = listenerIds;
    if (l1 === undefined || l2 === undefined || l3 === undefined || l4 === undefined) {
      throw new Error('expected four listener ids');
    }

    const t1 = utcDayAgo(2);
    const t2 = utcDayAgo(3);
    const pastRetention = utcDayAgo(120);
    const events: [string, string, number, number, boolean][] = [
      [t1, l1, oldChannel, oldItem, true],
      [t1, l1, survivorChannel, survivorItem, true],
      [t1, l2, oldChannel, oldItem, false],
      [t1, l2, survivorChannel, survivorItem, true],
      [t1, l3, oldChannel, oldOnlyItem, false],
      [t1, l3, survivorChannel, survivorItem, false],
      [t2, l4, oldChannel, oldItem, false],
      [pastRetention, l1, oldChannel, oldItem, false],
      [pastRetention, l1, survivorChannel, survivorItem, false],
    ];
    for (const [day, listenerId, channelId, itemId, completed] of events) {
      await manager.query(
        `INSERT INTO stats_listen_event (created_at, listener_id, channel_id, item_id, completed)
         VALUES ($1::timestamptz, $2::uuid, $3, $4, $5)`,
        [`${day}T12:00:00.000Z`, listenerId, channelId, itemId, completed]
      );
    }

    const seededOldChannelDaily: DailyCounts = {
      [t1]: [5, 2],
      [t2]: [1, 0],
      [pastRetention]: [1, 0],
    };
    const seededSurvivorChannelDaily: DailyCounts = { [t1]: [4, 2], [pastRetention]: [1, 0] };
    const seededOldItemDaily: DailyCounts = {
      [t1]: [2, 1],
      [t2]: [1, 0],
      [pastRetention]: [1, 0],
    };
    const seededSurvivorItemDaily: DailyCounts = { [t1]: [3, 2], [pastRetention]: [1, 0] };
    await insertDaily(
      manager,
      'stats_daily_channel',
      'channel_id',
      oldChannel,
      seededOldChannelDaily
    );
    await insertDaily(
      manager,
      'stats_daily_channel',
      'channel_id',
      survivorChannel,
      seededSurvivorChannelDaily
    );
    await insertDaily(manager, 'stats_daily_item', 'item_id', oldItem, seededOldItemDaily);
    await insertDaily(
      manager,
      'stats_daily_item',
      'item_id',
      survivorItem,
      seededSurvivorItemDaily
    );
    await insertRange(manager, 'stats_popularity_channel', 'channel_id', oldChannel, [1, 2, 3, 10]);
    await insertRange(
      manager,
      'stats_popularity_channel',
      'channel_id',
      survivorChannel,
      [4, 5, 6, 20]
    );
    await insertRange(manager, 'stats_popularity_item', 'item_id', oldItem, [1, 1, 1, 4]);
    await insertRange(manager, 'stats_popularity_item', 'item_id', survivorItem, [2, 2, 2, 8]);

    const at = (daysAgo: number): Date => new Date(Date.now() - daysAgo * DAY_MS);
    const l1Old = {
      listen_count: 2,
      completion_count: 1,
      first_listened_at: at(10),
      last_listened_at: at(2),
      recent_score: 1.5,
      long_term_score: 2.5,
      scores_updated_at: at(2),
    };
    const l1Survivor = {
      listen_count: 3,
      completion_count: 2,
      first_listened_at: at(20),
      last_listened_at: at(3),
      recent_score: 2,
      long_term_score: 4,
      scores_updated_at: at(3),
    };
    const l2Old = {
      listen_count: 1,
      completion_count: 0,
      first_listened_at: at(2),
      last_listened_at: at(2),
      recent_score: 1,
      long_term_score: 1,
      scores_updated_at: at(2),
    };
    const l3Survivor = { ...l2Old };
    const tasteRows: [string, number, typeof l1Old][] = [
      [l1, oldChannel, l1Old],
      [l1, survivorChannel, l1Survivor],
      [l2, oldChannel, l2Old],
      [l3, survivorChannel, l3Survivor],
    ];
    for (const [listenerId, channelId, row] of tasteRows) {
      await manager.query(
        `INSERT INTO stats_taste_profile
           (listener_id, channel_id, listen_count, completion_count, first_listened_at,
            last_listened_at, recent_score, long_term_score, scores_updated_at)
         VALUES ($1::uuid, $2, $3, $4, $5, $6, $7, $8, $9)`,
        [
          listenerId,
          channelId,
          row.listen_count,
          row.completion_count,
          row.first_listened_at,
          row.last_listened_at,
          row.recent_score,
          row.long_term_score,
          row.scores_updated_at,
        ]
      );
    }
    const l3HiddenAt = at(1);
    await manager.query(
      `INSERT INTO stats_taste_profile_hidden (listener_id, channel_id, hidden_at)
       VALUES ($1::uuid, $2, $3)`,
      [l3, oldChannel, l3HiddenAt]
    );

    const mergeRepo = manager.getRepository(mergeApi.ChannelMerge);
    const detected = await mergeRepo.save(
      mergeRepo.create({
        from_podcast_index_id: oldShow.podcastIndexId,
        to_podcast_index_id: survivor.podcastIndexId,
        status: mergeApi.ChannelMergeStatus.Detected,
        mode: null,
        match_stats: {},
      })
    );
    const mergeOptions = {
      fetchSurvivorFeed: async () => {
        throw new Error('absorb must not fetch the survivor feed');
      },
      enqueueRepointParse: async () => {
        throw new Error('absorb must not enqueue a parse');
      },
      statsTrackEventRetentionDays: STATS_TRACK_EVENT_RETENTION_DAYS,
    };
    await mergeApi.verifyAndApplyDuplicateMerges({ ...mergeOptions, mode: 'dry_run' });
    expect(await dailyCounts(manager, 'stats_daily_channel', 'channel_id', oldChannel)).toEqual(
      seededOldChannelDaily
    );

    await mergeApi.verifyAndApplyDuplicateMerges({ ...mergeOptions, mode: 'apply' });
    const applied = await mergeRepo.findOne({ where: { id: detected.id } });
    expect(applied?.status).toBe(mergeApi.ChannelMergeStatus.Applied);
    expect(applied?.mode).toBe(mergeApi.ChannelMergeMode.Absorb);

    // T1 channel: 5 + 4 - 3 listeners (L1, L2, L3 on both copies), 2 + 2 - 1 finishers (L1).
    // T1 item: 2 + 3 - 2 listeners (L1, L2), 1 + 2 - 1 finishers. T2 has no survivor row, and the
    // day past retention is summed although L1 listened to both copies that day.
    expect(
      await dailyCounts(manager, 'stats_daily_channel', 'channel_id', survivorChannel)
    ).toEqual({ [t1]: [6, 3], [t2]: [1, 0], [pastRetention]: [2, 0] });
    expect(await dailyCounts(manager, 'stats_daily_item', 'item_id', survivorItem)).toEqual({
      [t1]: [3, 2],
      [t2]: [1, 0],
      [pastRetention]: [2, 0],
    });
    expect(await dailyCounts(manager, 'stats_daily_channel', 'channel_id', oldChannel)).toEqual({});
    expect(await dailyCounts(manager, 'stats_daily_item', 'item_id', oldItem)).toEqual({});
    expect(
      await rangeCounts(manager, 'stats_popularity_channel', 'channel_id', oldChannel)
    ).toBeNull();
    expect(await rangeCounts(manager, 'stats_popularity_item', 'item_id', oldItem)).toBeNull();
    expect(
      await rangeCounts(manager, 'stats_popularity_channel', 'channel_id', survivorChannel)
    ).toEqual([4, 5, 6, 20]);
    expect(await rangeCounts(manager, 'stats_popularity_item', 'item_id', survivorItem)).toEqual([
      2, 2, 2, 8,
    ]);

    const eventPlacement = async (): Promise<[number, number, number][]> =>
      rowsOf(
        await manager.query(
          `SELECT item_id, channel_id, count(*)::int AS n FROM stats_listen_event
           WHERE listener_id = ANY($1::uuid[])
           GROUP BY item_id, channel_id
           ORDER BY item_id, channel_id`,
          [listenerIds]
        )
      ).map((row) => [asId(row.item_id), asId(row.channel_id), asId(row.n)]);
    const expectedEvents: [number, number, number][] = [
      [oldOnlyItem, oldChannel, 1],
      [survivorItem, survivorChannel, 8],
    ];
    expectedEvents.sort((left, right) => left[0] - right[0]);
    expect(await eventPlacement()).toEqual(expectedEvents);

    const tasteSnapshot = async (): Promise<Record<string, unknown>[]> =>
      rowsOf(
        await manager.query(
          `SELECT listener_id::text AS listener_id, channel_id, listen_count, completion_count,
                  first_listened_at, last_listened_at, recent_score, long_term_score,
                  scores_updated_at
           FROM stats_taste_profile
           WHERE listener_id = ANY($1::uuid[])
           ORDER BY listener_id, channel_id`,
          [listenerIds]
        )
      );
    const hiddenSnapshot = async (): Promise<Record<string, unknown>[]> =>
      rowsOf(
        await manager.query(
          `SELECT listener_id::text AS listener_id, channel_id, hidden_at
           FROM stats_taste_profile_hidden
           WHERE listener_id = ANY($1::uuid[])
           ORDER BY listener_id, channel_id`,
          [listenerIds]
        )
      );
    const tasteAfterApply = await tasteSnapshot();
    const tasteOf = (listenerId: string): Record<string, unknown>[] =>
      tasteAfterApply.filter((row) => row.listener_id === listenerId);
    const timeOf = (value: unknown): number => (value instanceof Date ? value.getTime() : NaN);

    const l1Rows = tasteOf(l1);
    expect(l1Rows).toHaveLength(1);
    const l1Merged = l1Rows[0];
    expect(asId(l1Merged?.channel_id)).toBe(survivorChannel);
    expect(l1Merged?.listen_count).toBe(5);
    expect(l1Merged?.completion_count).toBe(3);
    expect(timeOf(l1Merged?.first_listened_at)).toBe(l1Survivor.first_listened_at.getTime());
    expect(timeOf(l1Merged?.last_listened_at)).toBe(l1Old.last_listened_at.getTime());
    const fadedTo = l1Old.scores_updated_at;
    expect(timeOf(l1Merged?.scores_updated_at)).toBe(fadedTo.getTime());
    const expectedScore = (
      column: 'recent_score' | 'long_term_score',
      halfLifeDays: number
    ): number =>
      fadeTasteScore({
        score: l1Survivor[column],
        from: l1Survivor.scores_updated_at,
        to: fadedTo,
        halfLifeDays,
      }) +
      fadeTasteScore({
        score: l1Old[column],
        from: l1Old.scores_updated_at,
        to: fadedTo,
        halfLifeDays,
      });
    expect(Number(l1Merged?.recent_score)).toBeCloseTo(
      expectedScore('recent_score', POPULARITY_TASTE_HALF_LIFE_DAYS.recent),
      9
    );
    expect(Number(l1Merged?.long_term_score)).toBeCloseTo(
      expectedScore('long_term_score', POPULARITY_TASTE_HALF_LIFE_DAYS.longTerm),
      9
    );

    const l2Rows = tasteOf(l2);
    expect(l2Rows).toHaveLength(1);
    expect(asId(l2Rows[0]?.channel_id)).toBe(survivorChannel);
    expect(l2Rows[0]?.listen_count).toBe(l2Old.listen_count);
    expect(l2Rows[0]?.completion_count).toBe(l2Old.completion_count);
    expect(timeOf(l2Rows[0]?.first_listened_at)).toBe(l2Old.first_listened_at.getTime());
    expect(timeOf(l2Rows[0]?.last_listened_at)).toBe(l2Old.last_listened_at.getTime());
    expect(Number(l2Rows[0]?.recent_score)).toBe(l2Old.recent_score);
    expect(Number(l2Rows[0]?.long_term_score)).toBe(l2Old.long_term_score);
    expect(timeOf(l2Rows[0]?.scores_updated_at)).toBe(l2Old.scores_updated_at.getTime());

    expect(tasteOf(l3)).toEqual([]);
    const hiddenAfterApply = await hiddenSnapshot();
    expect(hiddenAfterApply).toHaveLength(1);
    expect(hiddenAfterApply[0]?.listener_id).toBe(l3);
    expect(asId(hiddenAfterApply[0]?.channel_id)).toBe(survivorChannel);
    expect(timeOf(hiddenAfterApply[0]?.hidden_at)).toBe(l3HiddenAt.getTime());

    await insertDaily(manager, 'stats_daily_channel', 'channel_id', oldChannel, { [t2]: [7, 0] });
    await insertRange(manager, 'stats_popularity_channel', 'channel_id', oldChannel, [0, 0, 0, 1]);

    await mergeApi.revertChannelMerge(detected.id);
    const reverted = await mergeRepo.findOne({ where: { id: detected.id } });
    expect(reverted?.status).toBe(mergeApi.ChannelMergeStatus.Reverted);

    expect(await dailyCounts(manager, 'stats_daily_channel', 'channel_id', oldChannel)).toEqual(
      seededOldChannelDaily
    );
    expect(
      await dailyCounts(manager, 'stats_daily_channel', 'channel_id', survivorChannel)
    ).toEqual(seededSurvivorChannelDaily);
    expect(await dailyCounts(manager, 'stats_daily_item', 'item_id', oldItem)).toEqual(
      seededOldItemDaily
    );
    expect(await dailyCounts(manager, 'stats_daily_item', 'item_id', survivorItem)).toEqual(
      seededSurvivorItemDaily
    );
    expect(
      await rangeCounts(manager, 'stats_popularity_channel', 'channel_id', oldChannel)
    ).toEqual([1, 2, 3, 10]);
    expect(
      await rangeCounts(manager, 'stats_popularity_channel', 'channel_id', survivorChannel)
    ).toEqual([4, 5, 6, 20]);
    expect(await rangeCounts(manager, 'stats_popularity_item', 'item_id', oldItem)).toEqual([
      1, 1, 1, 4,
    ]);
    expect(await rangeCounts(manager, 'stats_popularity_item', 'item_id', survivorItem)).toEqual([
      2, 2, 2, 8,
    ]);

    expect(await eventPlacement()).toEqual(expectedEvents);
    expect(await tasteSnapshot()).toEqual(tasteAfterApply);
    expect(await hiddenSnapshot()).toEqual(hiddenAfterApply);
  });

  it('re-points the feed we have when the survivor id has no channel', async () => {
    if (!ormContext) {
      throw new Error('ORM context required');
    }
    const manager = ormContext.dataSourceReadWrite.manager;
    const { Feed } = await import('@podverse/orm');
    const runId = nextRunId();
    const guids = [0, 1, 2].map(
      (index) => `https://channel-merge.example.com/${runId}/repoint-${index}`
    );
    const show = await seedShow(manager, runId, 11, guids);
    const survivorPodcastIndexId = podcastIndexId(runId, 12);
    const survivorUrl = `https://channel-merge-survivor-${runId}.example.com/feed.xml`;
    const survivorGuid = crypto.randomUUID();
    const feedRepo = manager.getRepository(Feed);
    const feed = await feedRepo.findOne({ where: { id: show.feedId } });
    if (!feed) {
      throw new Error('expected the seeded feed');
    }
    feed.last_parsed_file_hash = 'merge-repoint-hash';
    await feedRepo.save(feed);
    const itemIdsBefore = [...show.itemIdByGuid.values()].sort((left, right) => left - right);

    const mergeRepo = manager.getRepository(mergeApi.ChannelMerge);
    const detected = await mergeRepo.save(
      mergeRepo.create({
        from_podcast_index_id: show.podcastIndexId,
        to_podcast_index_id: survivorPodcastIndexId,
        status: mergeApi.ChannelMergeStatus.Detected,
        mode: null,
        match_stats: {},
      })
    );

    const enqueued: {
      feedUrl: string;
      podcastIndexId: number;
      suppressMs: number;
      forceParse: boolean;
    }[] = [];
    await mergeApi.verifyAndApplyDuplicateMerges({
      mode: 'apply',
      fetchSurvivorFeed: async (podcastIndexId) => {
        expect(podcastIndexId).toBe(survivorPodcastIndexId);
        return {
          url: survivorUrl,
          match: {
            podcastGuid: survivorGuid,
            itunesId: null,
            selfUrl: survivorUrl,
            items: guids.map((guid, index) => ({
              id: index + 1,
              guid,
              enclosureUrl: `https://survivor-${runId}.example.com/episode-${index}.mp3`,
              title: `Episode ${index}`,
              pubDateMs: null,
              durationSeconds: null,
            })),
          },
        };
      },
      enqueueRepointParse: async (request) => {
        enqueued.push({
          feedUrl: request.feedUrl,
          podcastIndexId: request.podcastIndexId,
          suppressMs: request.options.suppressNewItemSideEffectsPublishedBeforeMs,
          forceParse: request.options.forceParse,
        });
      },
      statsTrackEventRetentionDays: STATS_TRACK_EVENT_RETENTION_DAYS,
    });

    const updated = await feedRepo.findOne({ where: { id: show.feedId } });
    expect(updated?.url).toBe(survivorUrl);
    expect(updated?.podcast_index_id).toBe(survivorPodcastIndexId);
    expect(updated?.last_parsed_file_hash).toBeNull();
    const channelRows = rowsOf(
      await manager.query(`SELECT id FROM channel WHERE feed_id = $1`, [show.feedId])
    );
    expect(asId(channelRows[0]?.id)).toBe(show.channelId);
    const itemRows = rowsOf(
      await manager.query(`SELECT id FROM item WHERE channel_id = $1 ORDER BY id`, [show.channelId])
    );
    expect(itemRows.map((row) => asId(row.id))).toEqual(itemIdsBefore);
    const firstGuid = guids[0];
    const firstItemId = firstGuid === undefined ? undefined : show.itemIdByGuid.get(firstGuid);
    const enclosureRows = rowsOf(
      await manager.query(`SELECT guid_enclosure_url FROM item WHERE id = $1`, [firstItemId])
    );
    expect(enclosureRows[0]?.guid_enclosure_url).toBe(
      `https://survivor-${runId}.example.com/episode-0.mp3`
    );

    const applied = await mergeRepo.findOne({ where: { id: detected.id } });
    expect(applied?.mode).toBe(mergeApi.ChannelMergeMode.Repoint);
    expect(applied?.status).toBe(mergeApi.ChannelMergeStatus.Applied);
    expect(applied?.to_channel_id).toBeNull();
    expect(applied?.applied_at).toBeInstanceOf(Date);
    expect(enqueued).toHaveLength(1);
    if (!(applied?.applied_at instanceof Date)) {
      throw new Error('expected applied_at');
    }
    expect(enqueued[0]).toEqual({
      feedUrl: survivorUrl,
      podcastIndexId: survivorPodcastIndexId,
      suppressMs: applied.applied_at.getTime(),
      forceParse: true,
    });
  });
});
