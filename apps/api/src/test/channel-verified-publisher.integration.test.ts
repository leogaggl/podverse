import type { Server } from 'http';
import type { EntityManager } from 'typeorm';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

import { MediumEnum } from '@podverse/helpers';
import type { ChannelVerifiedPublisherService, ORMContext } from '@podverse/orm';

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

type SeededChannel = {
  feedId: number;
  channelId: number;
  podcastGuid: string;
  feedUrl: string;
};

type SeededPair = {
  album: SeededChannel;
  artist: SeededChannel;
  claimId: number;
  remoteItemId: number;
};

type StoredLink = {
  publisherChannelId: number;
  itemId: number | null;
  claimPosition: number;
};

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

function asNullableId(value: unknown): number | null {
  return value === null || value === undefined ? null : asId(value);
}

let seed = 0;

function nextRunId(): number {
  seed += 1;
  return Date.now() + seed;
}

function podcastIndexId(runId: number, slot: number): number {
  return 1_200_000_000 + (runId % 400_000_000) * 2 + slot;
}

async function returnedId(manager: EntityManager, sql: string, params: unknown[]): Promise<number> {
  const row = rowsOf(await manager.query(sql, params))[0];
  if (row === undefined) {
    throw new Error('expected a returned row');
  }
  return asId(row.id);
}

async function storedLinks(manager: EntityManager, channelId: number): Promise<StoredLink[]> {
  const result: unknown = await manager.query(
    `SELECT publisher_channel_id, item_id, claim_position
     FROM channel_verified_publisher
     WHERE channel_id = $1
     ORDER BY claim_position, publisher_channel_id`,
    [channelId]
  );
  return rowsOf(result).map((row) => ({
    publisherChannelId: asId(row.publisher_channel_id),
    itemId: asNullableId(row.item_id),
    claimPosition: asId(row.claim_position),
  }));
}

describe('channel verified publisher recompute', () => {
  let server: Server | undefined;
  let ormContext: ORMContext | undefined;
  let service: ChannelVerifiedPublisherService;
  const seededFeedIds: number[] = [];

  async function seedChannel(
    manager: EntityManager,
    runId: number,
    slot: number,
    role: 'album' | 'artist'
  ): Promise<SeededChannel> {
    const { Channel, Feed } = await import('@podverse/orm');
    const feedUrl = `https://verified-publisher-${runId}.example.com/${role}.xml`;
    const podcastGuid = crypto.randomUUID();
    const feedRepo = manager.getRepository(Feed);
    const feed = await feedRepo.save(
      feedRepo.create({ url: feedUrl, podcast_index_id: podcastIndexId(runId, slot) })
    );
    seededFeedIds.push(feed.id);
    const channelRepo = manager.getRepository(Channel);
    const channel = await channelRepo.save(
      channelRepo.create({
        feed_id: feed.id,
        medium_id: role === 'album' ? MediumEnum.Music : MediumEnum.PublisherMusic,
        title: `Verified publisher ${role} ${runId}`,
        podcast_guid: podcastGuid,
      })
    );
    return { feedId: feed.id, channelId: channel.id, podcastGuid, feedUrl };
  }

  async function seedPair(manager: EntityManager): Promise<SeededPair> {
    const runId = nextRunId();
    const album = await seedChannel(manager, runId, 0, 'album');
    const artist = await seedChannel(manager, runId, 1, 'artist');
    const channelPublisherId = await returnedId(
      manager,
      `INSERT INTO channel_publisher (channel_id) VALUES ($1) RETURNING id`,
      [album.channelId]
    );
    const claimId = await returnedId(
      manager,
      `INSERT INTO channel_publisher_remote_item (channel_publisher_id, feed_guid, feed_url)
       VALUES ($1, $2, $3) RETURNING id`,
      [channelPublisherId, artist.podcastGuid, artist.feedUrl]
    );
    const remoteItemId = await returnedId(
      manager,
      `INSERT INTO channel_remote_item (channel_id, feed_guid, feed_url)
       VALUES ($1, $2, $3) RETURNING id`,
      [artist.channelId, album.podcastGuid, album.feedUrl]
    );
    return { album, artist, claimId, remoteItemId };
  }

  function requireManager(): EntityManager {
    if (!ormContext) {
      throw new Error('ORM context required');
    }
    return ormContext.dataSourceReadWrite.manager;
  }

  beforeAll(async () => {
    const started = await startTestApp();
    server = started.server;
    ormContext = started.ormContext;
    if (!ormContext) {
      throw new Error('ORM context required for verified publisher integration test');
    }
    const orm = await import('@podverse/orm');
    service = new orm.ChannelVerifiedPublisherService();
  }, 120000);

  afterAll(async () => {
    if (ormContext && seededFeedIds.length > 0) {
      await ormContext.dataSourceReadWrite.query(`DELETE FROM feed WHERE id = ANY($1::int[])`, [
        seededFeedIds,
      ]);
    }
    await stopTestApp(server, ormContext);
  });

  it('stores one link when an album and an artist reference each other, and keeps it on the artist recompute', async () => {
    const manager = requireManager();
    const pair = await seedPair(manager);
    const expected: StoredLink[] = [
      { publisherChannelId: pair.artist.channelId, itemId: null, claimPosition: 0 },
    ];

    const albumResult = await service.recomputeForChannel(pair.album.channelId);
    expect(albumResult.links).toBe(1);
    expect(await storedLinks(manager, pair.album.channelId)).toEqual(expected);

    const artistResult = await service.recomputeForChannel(pair.artist.channelId);
    expect(artistResult).toEqual({ links: 0, contentChannelsRechecked: 1 });
    expect(await storedLinks(manager, pair.album.channelId)).toEqual(expected);
  });

  it('removes the link when the artist stops listing the album', async () => {
    const manager = requireManager();
    const pair = await seedPair(manager);
    await service.recomputeForChannel(pair.album.channelId);
    expect(await storedLinks(manager, pair.album.channelId)).toHaveLength(1);

    await manager.query(`DELETE FROM channel_remote_item WHERE id = $1`, [pair.remoteItemId]);
    await service.recomputeForChannel(pair.artist.channelId);

    expect(await storedLinks(manager, pair.album.channelId)).toEqual([]);
  });

  it('stores no link when the album claim feedUrl names an unrelated feed', async () => {
    const manager = requireManager();
    const pair = await seedPair(manager);
    await manager.query(`UPDATE channel_publisher_remote_item SET feed_url = $2 WHERE id = $1`, [
      pair.claimId,
      `https://unrelated-${pair.artist.channelId}.example.net/artist.xml`,
    ]);

    const result = await service.recomputeForChannel(pair.album.channelId);

    expect(result.links).toBe(0);
    expect(await storedLinks(manager, pair.album.channelId)).toEqual([]);
  });

  it('stores no link when the artist feed is taken down', async () => {
    const manager = requireManager();
    const { FeedLifecycleStateKeyEnum } = await import('@podverse/orm');
    const pair = await seedPair(manager);
    await service.recomputeForChannel(pair.album.channelId);
    expect(await storedLinks(manager, pair.album.channelId)).toHaveLength(1);

    await manager.query(
      `UPDATE feed_lifecycle_state
       SET feed_lifecycle_state_type_id = (
         SELECT id FROM feed_lifecycle_state_type WHERE state_key = $2
       )
       WHERE feed_id = $1`,
      [pair.artist.feedId, FeedLifecycleStateKeyEnum.Takedown]
    );
    await service.recomputeForChannel(pair.album.channelId);

    expect(await storedLinks(manager, pair.album.channelId)).toEqual([]);
  });

  it('reads the stored link through isVerified, getForContentChannels, and getForPublisher', async () => {
    const manager = requireManager();
    const pair = await seedPair(manager);
    await service.recomputeForChannel(pair.album.channelId);

    expect(await service.isVerified(pair.artist.channelId, pair.album.channelId)).toBe(true);
    expect(await service.isVerified(pair.album.channelId, pair.artist.channelId)).toBe(false);

    const forContent = await service.getForContentChannels([pair.album.channelId]);
    expect(
      forContent.map((row) => ({
        channelId: row.channel_id,
        publisherChannelId: row.publisher_channel_id,
        itemId: row.item_id,
        claimPosition: row.claim_position,
      }))
    ).toEqual([
      {
        channelId: pair.album.channelId,
        publisherChannelId: pair.artist.channelId,
        itemId: null,
        claimPosition: 0,
      },
    ]);
    expect(await service.getForContentChannels([])).toEqual([]);

    const forPublisher = await service.getForPublisher(pair.artist.channelId);
    expect(forPublisher.map((row) => row.channel_id)).toEqual([pair.album.channelId]);
  });
});
