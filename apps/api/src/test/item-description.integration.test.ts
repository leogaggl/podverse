import type { Server } from 'http';
import request from 'supertest';
import type { EntityManager } from 'typeorm';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

import { MediumEnum } from '@podverse/helpers';
import type { ORMContext } from '@podverse/orm';

import { getBaseApiUrl, startTestApp, stopTestApp } from './helpers/index.js';

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

const LONG_NOTES_VALUE =
  '<h2>About This Episode</h2><p>Long notes kept up to the feed tier.</p>' +
  '<ul><li><a href="https://example.com/notes/1">Link One</a></li></ul>';
const LONG_NOTES_PREVIEW = 'About This Episode Long notes kept up to the feed tier. Link One';
const LONG_NOTES_LINK_URL = 'https://example.com/item-description-test';
const LONG_NOTES_SOURCE_LENGTH = 18000;
const CHANNEL_DESCRIPTION_VALUE = '<p>Channel description for detail response coverage.</p>';
const CHANNEL_DESCRIPTION_PREVIEW = 'Channel description for detail response coverage.';

type SeededChannel = {
  channelIdText: string;
  longNotesIdText: string;
  noNotesIdText: string;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

let seed = 0;

function nextRunId(): number {
  seed += 1;
  return Date.now() + seed;
}

async function seedChannel(manager: EntityManager, runId: number): Promise<SeededChannel> {
  const { Channel, Feed, Item } = await import('@podverse/orm');
  const feedRepo = manager.getRepository(Feed);
  const feed = await feedRepo.save(
    feedRepo.create({
      url: `https://item-description-${runId}.example.com/feed.xml`,
      podcast_index_id: 300_000_000 + (runId % 100_000_000),
    })
  );
  const channelRepo = manager.getRepository(Channel);
  const channel = await channelRepo.save(
    channelRepo.create({
      feed_id: feed.id,
      medium_id: MediumEnum.Podcast,
      title: `Item description ${runId}`,
    })
  );
  await manager.query(`INSERT INTO channel_about (channel_id) VALUES ($1)`, [channel.id]);
  await manager.query(
    `INSERT INTO channel_description (channel_id, value, preview, is_truncated, source_length)
     VALUES ($1, $2, $3, false, $4)`,
    [channel.id, CHANNEL_DESCRIPTION_VALUE, CHANNEL_DESCRIPTION_PREVIEW, 75]
  );

  const itemRepo = manager.getRepository(Item);
  const longNotes = await itemRepo.save(
    itemRepo.create({
      channel_id: String(channel.id),
      title: 'Long Notes',
      item_flag_status: { id: 1 },
      guid: `https://item-description-${runId}.example.com/long`,
      pub_date: new Date(),
    })
  );
  await manager.query(
    `INSERT INTO item_description (item_id, value, preview, is_truncated, source_length)
     VALUES ($1, $2, $3, true, $4)`,
    [longNotes.id, LONG_NOTES_VALUE, LONG_NOTES_PREVIEW, LONG_NOTES_SOURCE_LENGTH]
  );
  await manager.query(`INSERT INTO item_about (item_id, website_link_url) VALUES ($1, $2)`, [
    longNotes.id,
    LONG_NOTES_LINK_URL,
  ]);

  const noNotes = await itemRepo.save(
    itemRepo.create({
      channel_id: String(channel.id),
      title: 'No Notes',
      item_flag_status: { id: 1 },
      guid: `https://item-description-${runId}.example.com/none`,
      pub_date: new Date(Date.now() - 60_000),
    })
  );

  return {
    channelIdText: channel.id_text,
    longNotesIdText: longNotes.id_text,
    noNotesIdText: noNotes.id_text,
  };
}

describe('item description', () => {
  let server: Server | undefined;
  let ormContext: ORMContext | undefined;
  let app: import('express').Express | undefined;
  let base = '';
  let seeded: SeededChannel | undefined;

  function requireApp(): import('express').Express {
    if (!app) {
      throw new Error('test app required');
    }
    return app;
  }

  function requireSeeded(): SeededChannel {
    if (!seeded) {
      throw new Error('seeded channel required');
    }
    return seeded;
  }

  beforeAll(async () => {
    const started = await startTestApp();
    server = started.server;
    ormContext = started.ormContext;
    app = started.app;
    if (!ormContext) {
      throw new Error('ORM context required for item description test');
    }
    base = await getBaseApiUrl();
    seeded = await seedChannel(ormContext.dataSourceReadWrite.manager, nextRunId());
  }, 120000);

  afterAll(async () => {
    await stopTestApp(server, ormContext);
  });

  it('returns shortened notes with the item link', async () => {
    const { longNotesIdText } = requireSeeded();
    const res = await request(requireApp()).get(`${base}/item/${longNotesIdText}/description`);
    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      item_id_text: longNotesIdText,
      value: LONG_NOTES_VALUE,
      preview: LONG_NOTES_PREVIEW,
      is_truncated: true,
      source_length: LONG_NOTES_SOURCE_LENGTH,
      link_url: LONG_NOTES_LINK_URL,
    });
  });

  it('answers 200 with null notes when the item has no description row', async () => {
    const { noNotesIdText } = requireSeeded();
    const res = await request(requireApp()).get(`${base}/item/${noNotesIdText}/description`);
    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      item_id_text: noNotesIdText,
      value: null,
      preview: null,
      is_truncated: false,
      source_length: null,
      link_url: null,
    });
  });

  it('returns 404 for an unknown item', async () => {
    const res = await request(requireApp()).get(`${base}/item/missingItem404/description`);
    expect(res.status).toBe(404);
  });

  it('includes preview and is_truncated on item_description in channel lists', async () => {
    const { channelIdText, longNotesIdText } = requireSeeded();
    const res = await request(requireApp())
      .get(`${base}/item/channel/recent/${channelIdText}`)
      .query({ page: 1 });
    expect(res.status).toBe(200);
    const rows: unknown[] = isRecord(res.body) && Array.isArray(res.body.data) ? res.body.data : [];
    const longNotesRow = rows.find((row) => isRecord(row) && row.id_text === longNotesIdText);
    expect(isRecord(longNotesRow) && isRecord(longNotesRow.item_description)).toBe(true);
    if (isRecord(longNotesRow) && isRecord(longNotesRow.item_description)) {
      expect(longNotesRow.item_description).not.toHaveProperty('value');
      expect(longNotesRow.item_description).toEqual(
        expect.objectContaining({
          preview: LONG_NOTES_PREVIEW,
          is_truncated: true,
          source_length: LONG_NOTES_SOURCE_LENGTH,
        })
      );
    }
  });

  it('returns full notes on item detail', async () => {
    const { longNotesIdText } = requireSeeded();
    const res = await request(requireApp()).get(`${base}/item/${longNotesIdText}`);
    expect(res.status).toBe(200);
    expect(isRecord(res.body) && isRecord(res.body.item_description)).toBe(true);
    if (isRecord(res.body) && isRecord(res.body.item_description)) {
      expect(res.body.item_description.value).toBe(LONG_NOTES_VALUE);
    }
  });

  it('returns full notes on channel detail', async () => {
    const { channelIdText } = requireSeeded();
    const res = await request(requireApp()).get(`${base}/channel/${channelIdText}`);
    expect(res.status).toBe(200);
    expect(isRecord(res.body) && isRecord(res.body.channel_description)).toBe(true);
    if (isRecord(res.body) && isRecord(res.body.channel_description)) {
      expect(res.body.channel_description.value).toBe(CHANNEL_DESCRIPTION_VALUE);
      expect(res.body.channel_description.preview).toBe(CHANNEL_DESCRIPTION_PREVIEW);
    }
  });
});
