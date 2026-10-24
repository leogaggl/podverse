import { createHash } from 'node:crypto';

import type { Server } from 'http';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import type { ORMContext } from '@podverse/orm';

import { authHeaders, getBaseApiUrl, startTestApp, stopTestApp } from './helpers/index.js';
import { createDefaultAccountGet } from './helpers/mockAccount.js';

/**
 * Locks the Add by RSS artist fixture: parsing the artist links the seeded directory album and
 * writes a parsed entry for the Add by RSS album. Sets `PODVERSE_E2E_FIXTURES=1` before
 * `startTestApp` so the re-imported config has `e2e.fixturesEnabled`.
 *
 * The artist and album URLs are fixed, and parse enqueue dedupes a URL for one minute, so each
 * case clears those keys first.
 */

const TEST_USER_ID = 1;
const ARTIST_FEED_URL = 'https://e2e-seed-addbyrss.example/artist.xml';
const ALBUM_FEED_URL = 'https://e2e-seed-addbyrss.example/album.xml';
const ALBUM_TRACK_GUID = 'https://e2e-seed-addbyrss.example/item-guid/track';
const ALBUM_PODCAST_GUID = 'e2e0a1b0-0000-4000-8000-0000000000b1';
const DIRECTORY_CHANNEL_ID_TEXT = 'e2eMusicAlbm01';

const parseDedupeKey = (feedUrl: string): string => {
  const feedHash = createHash('sha256').update(feedUrl).digest('hex');
  return `addByRSS:parseDedupe:${TEST_USER_ID}:${feedHash}`;
};

vi.mock('@podverse/orm', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@podverse/orm')>();

  class MockCategoryService {
    async setCategoryCache(): Promise<void> {}
  }

  class MockAccountService {
    get = createDefaultAccountGet();
  }

  class MockChannelAddByRSSDirectoryMatchService {
    async getForListedFeeds(): Promise<
      Map<string, { channelIdText: string; title: string; mediumId: number }>
    > {
      return new Map([
        [
          '11111111-2222-4333-8444-555555555501',
          { channelIdText: DIRECTORY_CHANNEL_ID_TEXT, title: 'E2E Music Album', mediumId: 3 },
        ],
      ]);
    }
  }

  return {
    ...actual,
    CategoryService: MockCategoryService,
    AccountService: MockAccountService,
    ChannelAddByRSSDirectoryMatchService: MockChannelAddByRSSDirectoryMatchService,
  };
});

describe('Add by RSS artist fixture parse', () => {
  let app: import('express').Express;
  let server: Server | undefined;
  let ormContext: ORMContext | undefined;
  let previousFixturesEnv: string | undefined;
  let accountBase = '';

  beforeAll(async () => {
    previousFixturesEnv = process.env.PODVERSE_E2E_FIXTURES;
    process.env.PODVERSE_E2E_FIXTURES = '1';
    const started = await startTestApp();
    app = started.app;
    server = started.server;
    ormContext = started.ormContext;
    accountBase = `${await getBaseApiUrl()}/account`;
  });

  afterAll(async () => {
    if (previousFixturesEnv === undefined) {
      delete process.env.PODVERSE_E2E_FIXTURES;
    } else {
      process.env.PODVERSE_E2E_FIXTURES = previousFixturesEnv;
    }
    await stopTestApp(server, ormContext);
  });

  beforeEach(async () => {
    const { addByRssParseEnqueueRateLimit } =
      await import('../controllers/account/accountAddByRSSParse.js');
    addByRssParseEnqueueRateLimit.resetForUser(TEST_USER_ID);
    const { keyvaldb } = await import('../lib/keyvaldb/keyvaldb.js');
    await keyvaldb.del(parseDedupeKey(ARTIST_FEED_URL), parseDedupeKey(ALBUM_FEED_URL));
  });

  const enqueueParse = (feedUrl: string) =>
    request(app).post(`${accountBase}/add-by-rss/parse`).set(authHeaders(TEST_USER_ID)).send({
      feed_url: feedUrl,
    });

  const parseStatus = (requestId: string) =>
    request(app)
      .get(`${accountBase}/add-by-rss/parse/status/${requestId}`)
      .set(authHeaders(TEST_USER_ID));

  it('parses the artist into an Add by RSS album and the seeded directory album', async () => {
    const enqueued = await enqueueParse(ARTIST_FEED_URL);
    expect(enqueued.status).toBe(201);

    const status = await parseStatus(enqueued.body.request_id);
    expect(status.status).toBe(200);
    expect(status.body.status).toBe('parsed');
    expect(status.body.publisherListedFeeds).toHaveLength(2);

    const [album, directory] = status.body.publisherListedFeeds;
    expect(album).toMatchObject({
      kind: 'add_by_rss',
      feedUrl: ALBUM_FEED_URL,
      listedAtChannelLevel: true,
      itemGuids: [ALBUM_TRACK_GUID],
    });
    expect(directory).toMatchObject({
      kind: 'directory',
      channelIdText: DIRECTORY_CHANNEL_ID_TEXT,
    });
  });

  it('writes the listed album as parsed under the artist request id', async () => {
    const enqueued = await enqueueParse(ARTIST_FEED_URL);
    expect(enqueued.status).toBe(201);
    const artist = await parseStatus(enqueued.body.request_id);
    expect(artist.status).toBe(200);
    const albumRequestId = artist.body.publisherListedFeeds[0].requestId;

    const album = await parseStatus(albumRequestId);
    expect(album.status).toBe(200);
    expect(album.body.status).toBe('parsed');
    expect(album.body.payload.title).toBe('E2E Add-by-RSS Album');
    expect(album.body.publisherRequestId).toBe(enqueued.body.request_id);
  });

  it('parses the album directly with its guid and no listed feeds', async () => {
    const enqueued = await enqueueParse(ALBUM_FEED_URL);
    expect(enqueued.status).toBe(201);

    const status = await parseStatus(enqueued.body.request_id);
    expect(status.status).toBe(200);
    expect(status.body.status).toBe('parsed');
    expect(status.body.publisherListedFeeds).toBeUndefined();
    expect(status.body.payload.guid).toBe(ALBUM_PODCAST_GUID);
  });
});
