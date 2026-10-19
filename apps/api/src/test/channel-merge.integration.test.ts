import type { Server } from 'http';
import type { EntityManager } from 'typeorm';
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
