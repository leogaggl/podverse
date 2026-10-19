import type { Server } from 'http';
import type { EntityManager } from 'typeorm';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

import {
  buildArchivedDescriptionValue,
  MediumEnum,
  readDescriptionDocument,
} from '@podverse/helpers';
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

type OrmApi = {
  slimArchivedItems: typeof import('@podverse/orm').slimArchivedItems;
  slimArchivedChannels: typeof import('@podverse/orm').slimArchivedChannels;
  ItemService: typeof import('@podverse/orm').ItemService;
  FeedService: typeof import('@podverse/orm').FeedService;
  AccountService: typeof import('@podverse/orm').AccountService;
  Channel: typeof import('@podverse/orm').Channel;
  Feed: typeof import('@podverse/orm').Feed;
  Item: typeof import('@podverse/orm').Item;
  ItemFlagStatusStatusEnum: typeof import('@podverse/orm').ItemFlagStatusStatusEnum;
  FeedLifecycleStateKeyEnum: typeof import('@podverse/orm').FeedLifecycleStateKeyEnum;
  FeedLifecycleUpdateSourceEnum: typeof import('@podverse/orm').FeedLifecycleUpdateSourceEnum;
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
  return 810_000_000 + (runId % 100_000_000) + slot;
}

const LONG_NOTES = `${'alpha beta '.repeat(80)}tail`;

async function countRows(manager: EntityManager, sql: string, params: unknown[]): Promise<number> {
  const result: unknown = await manager.query(sql, params);
  const row = rowsOf(result)[0];
  if (row === undefined) {
    throw new Error('expected a count');
  }
  return asId(row.n);
}

async function markFeedArchived(orm: OrmApi, feedId: number): Promise<void> {
  const feedService = new orm.FeedService();
  await feedService.setFeedLifecycleState(feedId, {
    toStateKey: orm.FeedLifecycleStateKeyEnum.PendingArchive,
    source: orm.FeedLifecycleUpdateSourceEnum.Archiver,
  });
  await feedService.setFeedLifecycleState(feedId, {
    toStateKey: orm.FeedLifecycleStateKeyEnum.Archived,
    source: orm.FeedLifecycleUpdateSourceEnum.Archiver,
  });
}

describe('archived content slimming', () => {
  let server: Server | undefined;
  let ormContext: ORMContext | undefined;
  let orm: OrmApi;

  beforeAll(async () => {
    const started = await startTestApp();
    server = started.server;
    ormContext = started.ormContext;
    if (!ormContext) {
      throw new Error('ORM context required for archived slimming integration test');
    }
    const loaded = await import('@podverse/orm');
    orm = {
      slimArchivedItems: loaded.slimArchivedItems,
      slimArchivedChannels: loaded.slimArchivedChannels,
      ItemService: loaded.ItemService,
      FeedService: loaded.FeedService,
      AccountService: loaded.AccountService,
      Channel: loaded.Channel,
      Feed: loaded.Feed,
      Item: loaded.Item,
      ItemFlagStatusStatusEnum: loaded.ItemFlagStatusStatusEnum,
      FeedLifecycleStateKeyEnum: loaded.FeedLifecycleStateKeyEnum,
      FeedLifecycleUpdateSourceEnum: loaded.FeedLifecycleUpdateSourceEnum,
    };
  }, 120000);

  afterAll(async () => {
    await stopTestApp(server, ormContext);
  });

  it('reduces an archived episode and keeps the clip, enclosure, and image', async () => {
    if (!ormContext) {
      throw new Error('ORM context required');
    }
    const manager = ormContext.dataSourceReadWrite.manager;
    const runId = nextRunId();
    const guid = `https://archived-slim.example.com/${runId}/episode`;
    const feedRepo = manager.getRepository(orm.Feed);
    const feed = await feedRepo.save(
      feedRepo.create({
        url: `https://archived-slim-${runId}.example.com/feed.xml`,
        podcast_index_id: podcastIndexId(runId, 1),
      })
    );
    const channelRepo = manager.getRepository(orm.Channel);
    const channel = await channelRepo.save(
      channelRepo.create({
        feed_id: feed.id,
        medium_id: MediumEnum.AV,
        title: `Archived slim episode ${runId}`,
      })
    );
    const itemRepo = manager.getRepository(orm.Item);
    const item = await itemRepo.save(
      itemRepo.create({
        channel_id: String(channel.id),
        title: 'Archived episode',
        item_flag_status: { id: orm.ItemFlagStatusStatusEnum.Archived },
        guid,
      })
    );
    await manager.query(`UPDATE item SET item_flag_status_id = $2 WHERE id = $1`, [
      item.id,
      orm.ItemFlagStatusStatusEnum.Archived,
    ]);

    const accountService = new orm.AccountService();
    const email = `archived-slim-${runId}@example.com`;
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

    await manager.query(
      `INSERT INTO clip (id_text, account_id, item_id, start_time, created_at, sharable_status_id)
       VALUES ($1, $2, $3, 0, now(), 1)`,
      [`as${String(runId).slice(-8)}`, account.id, item.id]
    );
    await manager.query(`INSERT INTO item_enclosure (item_id, type) VALUES ($1, $2)`, [
      item.id,
      'audio/mpeg',
    ]);
    await manager.query(`INSERT INTO item_image (item_id, url) VALUES ($1, $2)`, [
      item.id,
      'https://archived-slim.example.com/cover.jpg',
    ]);
    await manager.query(
      `INSERT INTO item_transcript (item_id, url, type) VALUES ($1, $2, $3)`,
      [item.id, 'https://archived-slim.example.com/transcript.vtt', 'text/vtt']
    );
    await manager.query(`INSERT INTO item_person (item_id, name) VALUES ($1, $2)`, [
      item.id,
      'Host',
    ]);
    const valueRows: unknown = await manager.query(
      `INSERT INTO item_value (item_id, type, method) VALUES ($1, $2, $3) RETURNING id`,
      [item.id, 'lightning', 'keysend']
    );
    const valueId = asId(rowsOf(valueRows)[0]?.id);
    await manager.query(
      `INSERT INTO item_value_recipient (item_value_id, type, address, split)
       VALUES ($1, $2, $3, $4)`,
      [valueId, 'node', '03abc', 100]
    );
    await manager.query(
      `INSERT INTO item_chapters_feed (item_id, url, type) VALUES ($1, $2, $3)`,
      [item.id, 'https://archived-slim.example.com/chapters.json', 'application/json']
    );
    await manager.query(
      `INSERT INTO item_description (item_id, value, preview, is_truncated, source_length)
       VALUES ($1, $2, NULL, false, NULL)`,
      [item.id, LONG_NOTES]
    );

    const result = await orm.slimArchivedItems();
    expect(result.slimmed).toBeGreaterThanOrEqual(1);

    expect(
      await countRows(manager, `SELECT count(*)::int AS n FROM item WHERE id = $1`, [item.id])
    ).toBe(1);
    expect(
      await countRows(manager, `SELECT count(*)::int AS n FROM channel WHERE id = $1`, [channel.id])
    ).toBe(1);
    expect(
      await countRows(manager, `SELECT count(*)::int AS n FROM feed WHERE id = $1`, [feed.id])
    ).toBe(1);
    expect(
      await countRows(manager, `SELECT count(*)::int AS n FROM clip WHERE item_id = $1`, [item.id])
    ).toBe(1);
    expect(
      await countRows(manager, `SELECT count(*)::int AS n FROM item_enclosure WHERE item_id = $1`, [
        item.id,
      ])
    ).toBe(1);
    expect(
      await countRows(manager, `SELECT count(*)::int AS n FROM item_image WHERE item_id = $1`, [
        item.id,
      ])
    ).toBe(1);
    expect(
      await countRows(
        manager,
        `SELECT count(*)::int AS n FROM item_transcript WHERE item_id = $1`,
        [item.id]
      )
    ).toBe(0);
    expect(
      await countRows(manager, `SELECT count(*)::int AS n FROM item_person WHERE item_id = $1`, [
        item.id,
      ])
    ).toBe(0);
    expect(
      await countRows(manager, `SELECT count(*)::int AS n FROM item_value WHERE item_id = $1`, [
        item.id,
      ])
    ).toBe(0);
    expect(
      await countRows(
        manager,
        `SELECT count(*)::int AS n FROM item_chapters_feed WHERE item_id = $1`,
        [item.id]
      )
    ).toBe(0);

    const descriptionResult: unknown = await manager.query(
      `SELECT value, preview, is_truncated, source_length FROM item_description WHERE item_id = $1`,
      [item.id]
    );
    const description = rowsOf(descriptionResult)[0];
    if (
      description === undefined ||
      typeof description.value !== 'string' ||
      typeof description.preview !== 'string'
    ) {
      throw new Error('expected reduced item notes');
    }
    expect(description.preview.length).toBeGreaterThan(0);
    expect(description.preview.length).toBeLessThanOrEqual(400);
    expect(description.preview.startsWith('alpha')).toBe(true);
    expect(description.value).toBe(buildArchivedDescriptionValue(description.preview));
    expect(description.is_truncated).toBe(true);
    expect(description.source_length).toBe(LONG_NOTES.length);
    expect(readDescriptionDocument(description.value).rich).not.toBeNull();

    const markerResult: unknown = await manager.query(
      `SELECT archived_slimmed_at, item_flag_status_id FROM item WHERE id = $1`,
      [item.id]
    );
    const marker = rowsOf(markerResult)[0];
    if (marker === undefined) {
      throw new Error('expected the item row');
    }
    expect(marker.archived_slimmed_at).not.toBeNull();
    expect(asId(marker.item_flag_status_id)).toBe(orm.ItemFlagStatusStatusEnum.Archived);

    const loadedChannel = await channelRepo.findOne({ where: { id: channel.id } });
    if (loadedChannel === null) {
      throw new Error('expected the channel');
    }
    await new orm.ItemService().update(loadedChannel, orm.ItemFlagStatusStatusEnum.Active, {
      title: 'Archived episode',
      pub_date: null,
      guid,
      guid_enclosure_url: null,
    });

    const restored: unknown = await manager.query(
      `SELECT archived_slimmed_at, item_flag_status_id FROM item WHERE id = $1`,
      [item.id]
    );
    const restoredRow = rowsOf(restored)[0];
    if (restoredRow === undefined) {
      throw new Error('expected the item row after status update');
    }
    expect(restoredRow.archived_slimmed_at).toBeNull();
    expect(asId(restoredRow.item_flag_status_id)).toBe(orm.ItemFlagStatusStatusEnum.Active);
  }, 120000);

  it('slims an archived show whose trailer belongs to a season', async () => {
    if (!ormContext) {
      throw new Error('ORM context required');
    }
    const manager = ormContext.dataSourceReadWrite.manager;
    const runId = nextRunId();
    const feedRepo = manager.getRepository(orm.Feed);
    const feed = await feedRepo.save(
      feedRepo.create({
        url: `https://archived-slim-show-${runId}.example.com/feed.xml`,
        podcast_index_id: podcastIndexId(runId, 2),
      })
    );
    const channelRepo = manager.getRepository(orm.Channel);
    const channel = await channelRepo.save(
      channelRepo.create({
        feed_id: feed.id,
        medium_id: MediumEnum.AV,
        title: `Archived slim show ${runId}`,
      })
    );
    await markFeedArchived(orm, feed.id);

    const seasonRows: unknown = await manager.query(
      `INSERT INTO channel_season (channel_id, number) VALUES ($1, 1) RETURNING id`,
      [channel.id]
    );
    const seasonId = asId(rowsOf(seasonRows)[0]?.id);
    await manager.query(
      `INSERT INTO channel_trailer (channel_id, url, pub_date, channel_season_id)
       VALUES ($1, $2, now(), $3)`,
      [channel.id, 'https://archived-slim.example.com/trailer.mp3', seasonId]
    );
    await manager.query(`INSERT INTO channel_about (channel_id, author) VALUES ($1, $2)`, [
      channel.id,
      'Author',
    ]);
    await manager.query(`INSERT INTO channel_image (channel_id, url) VALUES ($1, $2)`, [
      channel.id,
      'https://archived-slim.example.com/show.jpg',
    ]);
    await manager.query(
      `INSERT INTO channel_description (channel_id, value, preview, is_truncated, source_length)
       VALUES ($1, $2, NULL, false, NULL)`,
      [channel.id, LONG_NOTES]
    );

    const result = await orm.slimArchivedChannels();
    expect(result.slimmed).toBeGreaterThanOrEqual(1);

    expect(
      await countRows(manager, `SELECT count(*)::int AS n FROM channel WHERE id = $1`, [channel.id])
    ).toBe(1);
    expect(
      await countRows(manager, `SELECT count(*)::int AS n FROM feed WHERE id = $1`, [feed.id])
    ).toBe(1);
    expect(
      await countRows(
        manager,
        `SELECT count(*)::int AS n FROM channel_season WHERE channel_id = $1`,
        [channel.id]
      )
    ).toBe(0);
    expect(
      await countRows(
        manager,
        `SELECT count(*)::int AS n FROM channel_trailer WHERE channel_id = $1`,
        [channel.id]
      )
    ).toBe(0);
    expect(
      await countRows(
        manager,
        `SELECT count(*)::int AS n FROM channel_about WHERE channel_id = $1`,
        [channel.id]
      )
    ).toBe(1);
    expect(
      await countRows(
        manager,
        `SELECT count(*)::int AS n FROM channel_image WHERE channel_id = $1`,
        [channel.id]
      )
    ).toBe(1);

    const descriptionResult: unknown = await manager.query(
      `SELECT value, preview, is_truncated, source_length
       FROM channel_description WHERE channel_id = $1`,
      [channel.id]
    );
    const description = rowsOf(descriptionResult)[0];
    if (
      description === undefined ||
      typeof description.value !== 'string' ||
      typeof description.preview !== 'string'
    ) {
      throw new Error('expected reduced show notes');
    }
    expect(description.value).toBe(buildArchivedDescriptionValue(description.preview));
    expect(description.is_truncated).toBe(true);
    expect(description.source_length).toBe(LONG_NOTES.length);
    expect(readDescriptionDocument(description.value).rich).not.toBeNull();

    const markerResult: unknown = await manager.query(
      `SELECT archived_slimmed_at FROM channel WHERE id = $1`,
      [channel.id]
    );
    const marker = rowsOf(markerResult)[0];
    if (marker === undefined) {
      throw new Error('expected the channel row');
    }
    expect(marker.archived_slimmed_at).not.toBeNull();
  }, 120000);
});
