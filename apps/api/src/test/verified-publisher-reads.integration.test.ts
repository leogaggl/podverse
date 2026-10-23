import type { Express } from 'express';
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

type SeededChannel = {
  feedId: number;
  channelId: number;
  idText: string;
  title: string;
  mediumId: number;
};

type SeededWorld = {
  artist: SeededChannel;
  guest: SeededChannel;
  album: SeededChannel;
  plain: SeededChannel;
  itemId: number;
  itemIdText: string;
  otherItemIdText: string;
  plainItemIdText: string;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function verifiedPublishers(body: unknown): unknown[] | undefined {
  if (!isRecord(body) || !Array.isArray(body.verified_publishers)) {
    return undefined;
  }
  return body.verified_publishers;
}

function publisherOf(channel: SeededChannel): {
  id_text: string;
  title: string;
  medium_id: number;
} {
  return {
    id_text: channel.idText,
    title: channel.title,
    medium_id: channel.mediumId,
  };
}

function recordsOf(value: unknown): Record<string, unknown>[] {
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

function listRows(body: unknown): Record<string, unknown>[] {
  if (!isRecord(body)) {
    return [];
  }
  return recordsOf(body.data);
}

function rowByIdText(
  rows: readonly Record<string, unknown>[],
  idText: string
): Record<string, unknown> | undefined {
  return rows.find((row) => row.id_text === idText);
}

function embeddedChannelPublishers(row: Record<string, unknown> | undefined): unknown {
  if (row === undefined || !isRecord(row.channel)) {
    return undefined;
  }
  return row.channel.verified_publishers;
}

let seed = 0;

function nextRunId(): number {
  seed += 1;
  return Date.now() + seed;
}

function podcastIndexId(runId: number, slot: number): number {
  return 2_000_000_000 + (runId % 30_000_000) * 4 + slot;
}

describe('verified publisher channel and item reads', () => {
  let server: Server | undefined;
  let ormContext: ORMContext | undefined;
  let app: Express | undefined;
  let base = '';
  let world: SeededWorld | undefined;
  const seededFeedIds: number[] = [];

  function requireApp(): Express {
    if (!app) {
      throw new Error('test app required');
    }
    return app;
  }

  function requireManager(): EntityManager {
    if (!ormContext) {
      throw new Error('ORM context required');
    }
    return ormContext.dataSourceReadWrite.manager;
  }

  function requireWorld(): SeededWorld {
    if (!world) {
      throw new Error('seeded channels required');
    }
    return world;
  }

  async function seedChannel(
    manager: EntityManager,
    runId: number,
    slot: number,
    role: 'artist' | 'guest' | 'album' | 'plain',
    mediumId: number,
    parsed: boolean
  ): Promise<SeededChannel> {
    const { Channel, Feed } = await import('@podverse/orm');
    const title = `Verified reads ${role} ${runId}`;
    const feedRepo = manager.getRepository(Feed);
    const feed = await feedRepo.save(
      feedRepo.create({
        url: `https://verified-publisher-reads-${runId}.example.com/${role}.xml`,
        podcast_index_id: podcastIndexId(runId, slot),
      })
    );
    seededFeedIds.push(feed.id);
    const channelRepo = manager.getRepository(Channel);
    const channel = await channelRepo.save(
      channelRepo.create({
        feed_id: feed.id,
        medium_id: mediumId,
        title,
        podcast_guid: crypto.randomUUID(),
      })
    );
    if (parsed) {
      await manager.query(`INSERT INTO channel_about (channel_id) VALUES ($1)`, [channel.id]);
    }
    return {
      feedId: feed.id,
      channelId: channel.id,
      idText: channel.id_text,
      title,
      mediumId,
    };
  }

  async function seedWorld(manager: EntityManager): Promise<SeededWorld> {
    const { Item } = await import('@podverse/orm');
    const runId = nextRunId();
    const artist = await seedChannel(manager, runId, 0, 'artist', MediumEnum.PublisherMusic, true);
    const guest = await seedChannel(manager, runId, 1, 'guest', MediumEnum.PublisherMusic, false);
    const album = await seedChannel(manager, runId, 2, 'album', MediumEnum.Music, true);
    const plain = await seedChannel(manager, runId, 3, 'plain', MediumEnum.Music, true);
    const itemRepo = manager.getRepository(Item);
    const item = await itemRepo.save(
      itemRepo.create({
        channel_id: String(album.channelId),
        title: `Verified reads track ${runId}`,
        item_flag_status: { id: 1 },
        guid: `https://verified-publisher-reads-${runId}.example.com/track`,
        pub_date: new Date(),
      })
    );
    const otherItem = await itemRepo.save(
      itemRepo.create({
        channel_id: String(album.channelId),
        title: `Verified reads other track ${runId}`,
        item_flag_status: { id: 1 },
        guid: `https://verified-publisher-reads-${runId}.example.com/other-track`,
        pub_date: new Date(),
      })
    );
    const plainItem = await itemRepo.save(
      itemRepo.create({
        channel_id: String(plain.channelId),
        title: `Verified reads plain track ${runId}`,
        item_flag_status: { id: 1 },
        guid: `https://verified-publisher-reads-${runId}.example.com/plain-track`,
        pub_date: new Date(),
      })
    );
    await manager.query(
      `INSERT INTO channel_verified_publisher
         (channel_id, publisher_channel_id, item_id, claim_position)
       VALUES ($1, $2, NULL, 0), ($1, $3, $4, 0)`,
      [album.channelId, artist.channelId, guest.channelId, item.id]
    );
    return {
      artist,
      guest,
      album,
      plain,
      itemId: item.id,
      itemIdText: item.id_text,
      otherItemIdText: otherItem.id_text,
      plainItemIdText: plainItem.id_text,
    };
  }

  beforeAll(async () => {
    const started = await startTestApp();
    server = started.server;
    ormContext = started.ormContext;
    app = started.app;
    if (!ormContext) {
      throw new Error('ORM context required for verified publisher read test');
    }
    base = await getBaseApiUrl();
    world = await seedWorld(ormContext.dataSourceReadWrite.manager);
  }, 120000);

  afterAll(async () => {
    if (ormContext && seededFeedIds.length > 0) {
      await ormContext.dataSourceReadWrite.query(`DELETE FROM feed WHERE id = ANY($1::int[])`, [
        seededFeedIds,
      ]);
    }
    await stopTestApp(server, ormContext);
  });

  it('returns the channel-wide artist on the album', async () => {
    const seeded = requireWorld();
    const res = await request(requireApp()).get(`${base}/channel/${seeded.album.idText}`);
    expect(res.status).toBe(200);
    expect(verifiedPublishers(res.body)).toEqual([
      {
        id_text: seeded.artist.idText,
        title: seeded.artist.title,
        medium_id: seeded.artist.mediumId,
      },
    ]);
  });

  it('returns an empty list for a parsed channel with no links', async () => {
    const seeded = requireWorld();
    const res = await request(requireApp()).get(`${base}/channel/${seeded.plain.idText}`);
    expect(res.status).toBe(200);
    expect(verifiedPublishers(res.body)).toEqual([]);
  });

  it('returns only the item-level publisher on the album item', async () => {
    const seeded = requireWorld();
    const res = await request(requireApp()).get(`${base}/item/${seeded.itemIdText}`);
    expect(res.status).toBe(200);
    expect(verifiedPublishers(res.body)).toEqual([
      {
        id_text: seeded.guest.idText,
        title: seeded.guest.title,
        medium_id: seeded.guest.mediumId,
      },
    ]);
  });

  it('omits a publisher whose feed is taken down', async () => {
    const seeded = await seedWorld(requireManager());
    const { FeedLifecycleStateKeyEnum } = await import('@podverse/orm');
    await requireManager().query(
      `UPDATE feed_lifecycle_state
       SET feed_lifecycle_state_type_id = (
         SELECT id FROM feed_lifecycle_state_type WHERE state_key = $2
       )
       WHERE feed_id = $1`,
      [seeded.artist.feedId, FeedLifecycleStateKeyEnum.Takedown]
    );

    const res = await request(requireApp()).get(`${base}/channel/${seeded.album.idText}`);
    expect(res.status).toBe(200);
    expect(verifiedPublishers(res.body)).toEqual([]);
  });

  it('puts channel-wide publishers on each by-channel item, separate from item-only credits', async () => {
    const seeded = requireWorld();
    const res = await request(requireApp()).get(
      `${base}/item/channel/recent/${seeded.album.idText}?page=1`
    );
    expect(res.status).toBe(200);
    const credited = rowByIdText(listRows(res.body), seeded.itemIdText);
    const other = rowByIdText(listRows(res.body), seeded.otherItemIdText);
    expect(credited?.verified_publishers).toEqual([publisherOf(seeded.guest)]);
    expect(other?.verified_publishers).toEqual([]);
    expect(credited?.channel_wide_verified_publishers).toEqual([publisherOf(seeded.artist)]);
    expect(other?.channel_wide_verified_publishers).toEqual([publisherOf(seeded.artist)]);
  });

  it('returns an empty channel-wide list for a channel with no links', async () => {
    const seeded = requireWorld();
    const res = await request(requireApp()).get(
      `${base}/item/channel/recent/${seeded.plain.idText}?page=1`
    );
    expect(res.status).toBe(200);
    const rows = listRows(res.body);
    const plainItem = rowByIdText(rows, seeded.plainItemIdText);
    expect(plainItem).toBeDefined();
    for (const row of rows) {
      expect(row.channel_wide_verified_publishers).toEqual([]);
    }
  });

  it('returns the album artist on a followed album item in the subscribed list', async () => {
    // Global recent is one shared page ordered by pub date, so the seeded item is not
    // guaranteed to be on it. The subscribed list is limited to this account's followed album.
    const seeded = requireWorld();
    const manager = requireManager();
    const { AccountFollowingChannel, AccountService, FeedPolicy } = await import('@podverse/orm');
    const runId = nextRunId();
    const accountService = new AccountService();
    const email = `verified-publisher-reads-${runId}@example.com`;
    await accountService.create({
      email,
      password: 'IntegrationTest1!',
      locale: 'en-US',
      terms_version: '2026-10-15',
    });
    const account = await accountService.getByEmail(email);
    if (!account) {
      throw new Error('Failed to load account after create');
    }
    const now = new Date();
    const policyRepo = manager.getRepository(FeedPolicy);
    await policyRepo.save(
      policyRepo.create({
        feed_id: seeded.album.feedId,
        public_visible: true,
        created_at: now,
        updated_at: now,
      })
    );
    const followRepo = manager.getRepository(AccountFollowingChannel);
    await followRepo.save(
      followRepo.create({
        account_id: account.id,
        channel_id: seeded.album.channelId,
        last_seen_at: null,
      })
    );

    const res = await request(requireApp())
      .get(`${base}/item/subscribed/recent?medium=music&page=1`)
      .set(authHeaders(account.id, account.id_text));
    expect(res.status).toBe(200);
    const item = rowByIdText(listRows(res.body), seeded.itemIdText);
    expect(embeddedChannelPublishers(item)).toEqual([publisherOf(seeded.artist)]);
  });

  it('returns the album artist on a queued album item', async () => {
    const seeded = requireWorld();
    const manager = requireManager();
    const { AccountService, QueueResource, QueueService } = await import('@podverse/orm');
    const runId = nextRunId();
    const accountService = new AccountService();
    const email = `verified-publisher-queue-${runId}@example.com`;
    await accountService.create({
      email,
      password: 'IntegrationTest1!',
      locale: 'en-US',
      terms_version: '2026-10-15',
    });
    const account = await accountService.getByEmail(email);
    if (!account) {
      throw new Error('Failed to load account after create');
    }
    const queueService = new QueueService();
    const queues = await queueService.getAllPrivate(account.id);
    const musicQueue = queues.find((queue) => queue.medium_id === MediumEnum.Music);
    if (!musicQueue) {
      throw new Error('music queue required');
    }
    const queueResourceRepo = manager.getRepository(QueueResource);
    await queueResourceRepo.save(
      queueResourceRepo.create({
        queue: musicQueue,
        item_id: String(seeded.itemId),
        list_position: '1',
        playback_position: '0',
        media_file_duration: '0',
        completed: false,
      })
    );

    const res = await request(requireApp())
      .get(`${base}/queue/${musicQueue.id_text}/resources/upcoming-all`)
      .set(authHeaders(account.id, account.id_text));
    expect(res.status).toBe(200);
    const queued = recordsOf(res.body).find((row) => {
      if (!isRecord(row.item)) {
        return false;
      }
      return row.item.id_text === seeded.itemIdText;
    });
    const queuedItem = queued !== undefined && isRecord(queued.item) ? queued.item : undefined;
    expect(embeddedChannelPublishers(queuedItem)).toEqual([publisherOf(seeded.artist)]);
  });
});
