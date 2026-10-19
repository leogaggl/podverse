import type { Server } from 'http';
import request from 'supertest';
import type { EntityManager } from 'typeorm';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

import { MediumEnum } from '@podverse/helpers';
import type { ORMContext } from '@podverse/orm';

import { authHeaders, getBaseApiUrl, startTestApp, stopTestApp } from './helpers/index.js';

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

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function rowsOf(value: unknown): Record<string, unknown>[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.filter(isRecord);
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

async function insertReturningId(
  manager: EntityManager,
  sql: string,
  params: unknown[]
): Promise<number> {
  const result: unknown = await manager.query(sql, params);
  return asId(rowsOf(result)[0]?.id);
}

async function queryRows(
  manager: EntityManager,
  sql: string,
  params: unknown[]
): Promise<Record<string, unknown>[]> {
  const result: unknown = await manager.query(sql, params);
  return rowsOf(result);
}

type Fixture = {
  ownerId: number;
  ownerIdText: string;
  otherId: number;
  otherIdText: string;
  itemId: number;
  clipId: number;
  clipIdText: string;
  playlistId: number;
  playlistIdText: string;
  queueId: number;
  episodeTitle: string;
  showTitle: string;
};

const SHARABLE_STATUS_PUBLIC = 1;

async function createAccount(email: string): Promise<{ id: number; id_text: string }> {
  const { AccountService } = await import('@podverse/orm');
  const accountService = new AccountService();
  await accountService.create({
    email,
    password: 'IntegrationTest1!',
    locale: 'en-US',
    terms_version: '2026-10-15',
  });
  const account = await accountService.getByEmail(email);
  if (!account) {
    throw new Error('expected the seeded account');
  }
  return { id: account.id, id_text: account.id_text };
}

async function seedFixture(ormContext: ORMContext): Promise<Fixture> {
  const { Channel, Feed, Item, QueueService } = await import('@podverse/orm');
  const manager = ormContext.dataSourceReadWrite.manager;
  const runId = Date.now();
  const suffix = String(runId).slice(-8);

  const owner = await createAccount(`removed-content-a-${runId}@example.com`);
  const other = await createAccount(`removed-content-b-${runId}@example.com`);

  const feedRepo = manager.getRepository(Feed);
  const feed = await feedRepo.save(
    feedRepo.create({
      url: `https://removed-content-${runId}.example.com/feed.xml`,
      podcast_index_id: 820_000_000 + (runId % 90_000_000),
    })
  );

  const showTitle = `Removed content show ${runId}`;
  const channelRepo = manager.getRepository(Channel);
  const channel = await channelRepo.save(
    channelRepo.create({ feed_id: feed.id, medium_id: MediumEnum.AV, title: showTitle })
  );

  const episodeTitle = `Removed content episode ${runId}`;
  const itemRepo = manager.getRepository(Item);
  const item = await itemRepo.save(
    itemRepo.create({
      channel_id: String(channel.id),
      title: episodeTitle,
      item_flag_status: { id: 1 },
      guid: `removed-content-${runId}@example.com`,
    })
  );

  const soundbiteId = await insertReturningId(
    manager,
    `INSERT INTO item_soundbite (id_text, item_id, start_time, duration, title)
     VALUES ($1, $2, 10, 20, $3) RETURNING id`,
    [`rcsb${suffix}`, item.id, 'Removed content soundbite']
  );

  const clipIdText = `rccl${suffix}`;
  const clipId = await insertReturningId(
    manager,
    `INSERT INTO clip (id_text, account_id, item_id, start_time, created_at, sharable_status_id)
     VALUES ($1, $2, $3, 0, now(), $4) RETURNING id`,
    [clipIdText, owner.id, item.id, SHARABLE_STATUS_PUBLIC]
  );

  const playlistIdText = `rcpl${suffix}`;
  const playlistId = await insertReturningId(
    manager,
    `INSERT INTO playlist (id_text, account_id, sharable_status_id, title, medium_id)
     VALUES ($1, $2, $3, $4, $5) RETURNING id`,
    [playlistIdText, owner.id, SHARABLE_STATUS_PUBLIC, 'Removed content playlist', MediumEnum.AV]
  );
  await manager.query(
    `INSERT INTO playlist_resource (playlist_id, list_position, item_id) VALUES ($1, '1', $2)`,
    [playlistId, item.id]
  );
  await manager.query(
    `INSERT INTO playlist_resource (playlist_id, list_position, item_soundbite_id)
     VALUES ($1, '2', $2)`,
    [playlistId, soundbiteId]
  );
  await manager.query(
    `INSERT INTO playlist_resource (playlist_id, list_position, clip_id) VALUES ($1, '3', $2)`,
    [playlistId, clipId]
  );

  const channelMergeId = await insertReturningId(
    manager,
    `INSERT INTO channel_merge (from_podcast_index_id, to_podcast_index_id, status)
     VALUES ($1, $2, 'detected') RETURNING id`,
    [830_000_000 + (runId % 90_000_000), 840_000_000 + (runId % 90_000_000)]
  );
  await manager.query(
    `INSERT INTO item_merge_map (channel_merge_id, from_item_id, to_item_id) VALUES ($1, $2, NULL)`,
    [channelMergeId, item.id]
  );

  const queues = await new QueueService().getAllPrivate(owner.id);
  const avQueue = queues.find((queue) => queue.medium_id === MediumEnum.AV);
  if (!avQueue) {
    throw new Error('expected an AV queue for the owner');
  }
  await manager.query(
    `INSERT INTO queue_resource (queue_id, list_position, clip_id) VALUES ($1, '1', $2)`,
    [avQueue.id, clipId]
  );

  return {
    ownerId: owner.id,
    ownerIdText: owner.id_text,
    otherId: other.id,
    otherIdText: other.id_text,
    itemId: item.id,
    clipId,
    clipIdText,
    playlistId,
    playlistIdText,
    queueId: avQueue.id,
    episodeTitle,
    showTitle,
  };
}

async function takeDownFeedOfItem(itemId: number, manager: EntityManager): Promise<void> {
  const {
    ArchiverService,
    FeedLifecycleStateKeyEnum,
    FeedLifecycleUpdateSourceEnum,
    FeedService,
  } = await import('@podverse/orm');
  const rows = await queryRows(
    manager,
    `SELECT ch.feed_id FROM item i INNER JOIN channel ch ON ch.id = i.channel_id WHERE i.id = $1`,
    [itemId]
  );
  const feedId = asId(rows[0]?.feed_id);
  await new FeedService().setFeedLifecycleState(feedId, {
    toStateKey: FeedLifecycleStateKeyEnum.Takedown,
    source: FeedLifecycleUpdateSourceEnum.Admin,
  });
  await new ArchiverService().removeAllItemsForTakedownFeeds();
}

describe('clips and playlist entries survive a takedown', () => {
  let server: Server | undefined;
  let ormContext: ORMContext | undefined;
  let app: import('express').Express;
  let base: string;
  let fixture: Fixture;
  let manager: EntityManager;

  beforeAll(async () => {
    const started = await startTestApp();
    app = started.app;
    server = started.server;
    ormContext = started.ormContext;
    if (!ormContext) {
      throw new Error('ORM context required for removed content integration test');
    }
    manager = ormContext.dataSourceReadWrite.manager;
    fixture = await seedFixture(ormContext);
    await takeDownFeedOfItem(fixture.itemId, manager);
    base = `${await getBaseApiUrl()}`;
  }, 120000);

  afterAll(async () => {
    await stopTestApp(server, ormContext);
  });

  it('removes the episode and its merge map rows', async () => {
    expect(await queryRows(manager, `SELECT id FROM item WHERE id = $1`, [fixture.itemId])).toEqual(
      []
    );
    expect(
      await queryRows(
        manager,
        `SELECT id FROM item_merge_map WHERE from_item_id = $1 OR to_item_id = $1`,
        [fixture.itemId]
      )
    ).toEqual([]);
  });

  it('keeps the clip with a snapshot naming the episode and show', async () => {
    const rows = await queryRows(
      manager,
      `SELECT item_id, removed_source, source_removed_at FROM clip WHERE id = $1`,
      [fixture.clipId]
    );
    const clip = rows[0];
    expect(clip).toBeDefined();
    expect(clip?.item_id).toBeNull();
    expect(clip?.source_removed_at).not.toBeNull();
    expect(clip?.removed_source).toMatchObject({
      kind: 'item',
      item_title: fixture.episodeTitle,
      channel_title: fixture.showTitle,
      soundbite_title: null,
    });
  });

  it('keeps all three playlist entries in order', async () => {
    const rows = await queryRows(
      manager,
      `SELECT list_position, item_id, item_soundbite_id, clip_id, removed_source, source_removed_at
       FROM playlist_resource WHERE playlist_id = $1 ORDER BY list_position ASC`,
      [fixture.playlistId]
    );
    expect(rows).toHaveLength(3);

    const [episodeEntry, soundbiteEntry, clipEntry] = rows;
    expect(episodeEntry?.item_id).toBeNull();
    expect(episodeEntry?.removed_source).toMatchObject({
      kind: 'item',
      item_title: fixture.episodeTitle,
      channel_title: fixture.showTitle,
    });
    expect(soundbiteEntry?.item_soundbite_id).toBeNull();
    expect(soundbiteEntry?.removed_source).toMatchObject({
      kind: 'soundbite',
      item_title: fixture.episodeTitle,
      soundbite_title: 'Removed content soundbite',
    });
    expect(asId(clipEntry?.clip_id)).toBe(fixture.clipId);
    expect(clipEntry?.removed_source).toBeNull();
    expect(clipEntry?.source_removed_at).toBeNull();
  });

  it('prunes the removed clip from the queue', async () => {
    const { pruneNonActiveItemBackedQueueResourceRows } = await import('@podverse/orm');
    await pruneNonActiveItemBackedQueueResourceRows();
    expect(
      await queryRows(manager, `SELECT id FROM queue_resource WHERE queue_id = $1 AND clip_id = $2`, [
        fixture.queueId,
        fixture.clipId,
      ])
    ).toEqual([]);
  });

  it('returns the snapshot to the clip owner only', async () => {
    const ownerRes = await request(app)
      .get(`${base}/clip/${fixture.clipIdText}`)
      .set(authHeaders(fixture.ownerId, fixture.ownerIdText));
    expect(ownerRes.status).toBe(200);
    expect(ownerRes.body.item).toBeNull();
    expect(ownerRes.body.source_removed_at).toEqual(expect.any(String));
    expect(ownerRes.body.removed_source).toMatchObject({
      item_title: fixture.episodeTitle,
      channel_title: fixture.showTitle,
    });

    const otherRes = await request(app)
      .get(`${base}/clip/${fixture.clipIdText}`)
      .set(authHeaders(fixture.otherId, fixture.otherIdText));
    expect(otherRes.status).toBe(410);
    expect(otherRes.body).toEqual({ message: 'Clip source was removed', removed: true });

    const anonymousRes = await request(app).get(`${base}/clip/${fixture.clipIdText}`);
    expect(anonymousRes.status).toBe(410);
    expect(anonymousRes.body).toEqual({ message: 'Clip source was removed', removed: true });
  });

  it("hides the playlist owner's snapshots from other accounts", async () => {
    const res = await request(app)
      .get(`${base}/playlist/${fixture.playlistIdText}/resources?page=1`)
      .set(authHeaders(fixture.otherId, fixture.otherIdText));
    expect(res.status).toBe(200);

    const entries: unknown = res.body.data;
    const rows = rowsOf(entries);
    expect(rows).toHaveLength(3);
    for (const row of rows) {
      expect(row.removed_source).toBeNull();
      const clip = row.clip;
      if (isRecord(clip)) {
        expect(clip.removed_source).toBeNull();
      }
    }
    expect(rows.filter((row) => typeof row.source_removed_at === 'string')).toHaveLength(2);

    const ownerRes = await request(app)
      .get(`${base}/playlist/${fixture.playlistIdText}/resources?page=1`)
      .set(authHeaders(fixture.ownerId, fixture.ownerIdText));
    expect(ownerRes.status).toBe(200);
    const ownerRows = rowsOf(ownerRes.body.data);
    expect(ownerRows.filter((row) => isRecord(row.removed_source))).toHaveLength(2);
  });

  it('accepts title edits and rejects time edits on a removed clip', async () => {
    const timeRes = await request(app)
      .patch(`${base}/clip/${fixture.clipIdText}`)
      .set(authHeaders(fixture.ownerId, fixture.ownerIdText))
      .send({ start_time: 5, sharable_status_id: SHARABLE_STATUS_PUBLIC });
    expect(timeRes.status).toBe(400);

    const titleRes = await request(app)
      .patch(`${base}/clip/${fixture.clipIdText}`)
      .set(authHeaders(fixture.ownerId, fixture.ownerIdText))
      .send({ start_time: 0, sharable_status_id: SHARABLE_STATUS_PUBLIC, title: 'Renamed clip' });
    expect(titleRes.status).toBe(200);

    const rows = await queryRows(manager, `SELECT title, start_time FROM clip WHERE id = $1`, [
      fixture.clipId,
    ]);
    expect(rows[0]?.title).toBe('Renamed clip');
    expect(Number(rows[0]?.start_time)).toBe(0);
  });

  it("lists the removed clip in the owner's list and not in public lists", async () => {
    const publicRes = await request(app).get(`${base}/clip/public/recent?medium=all&page=1`);
    expect(publicRes.status).toBe(200);
    const publicIds = rowsOf(publicRes.body.data).map((clip) => clip.id_text);
    expect(publicIds).not.toContain(fixture.clipIdText);

    const ownerRes = await request(app)
      .get(`${base}/clip/private`)
      .set(authHeaders(fixture.ownerId, fixture.ownerIdText));
    expect(ownerRes.status).toBe(200);
    const ownerIds = rowsOf(ownerRes.body).map((clip) => clip.id_text);
    expect(ownerIds).toContain(fixture.clipIdText);
  });

  it('rejects a playlist entry with no reference and no removal time', async () => {
    await expect(
      manager.query(`INSERT INTO playlist_resource (playlist_id, list_position) VALUES ($1, '9')`, [
        fixture.playlistId,
      ])
    ).rejects.toThrow();
  });
});
