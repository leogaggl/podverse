import type { Server } from 'http';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

import { getAddByRSSHashId, getMd5Hash, MediumEnum } from '@podverse/helpers';
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

type IdentityAccount = {
  accountId: number;
  accountIdText: string;
  playlistIdText: string;
  queueId: number;
  queueIdText: string;
};

type HashRow = { hash: string | null };

type QueueRow = {
  add_by_rss_hash_id: string;
  feed_url: string | null;
  list_position: string;
};

const FEED_URL = 'https://feeds.example.com/identity.xml';

const parityCases: Array<{
  label: string;
  feedUrl: string;
  guid: string | null;
  enclosure: string | null;
}> = [
  { label: 'plain values', feedUrl: FEED_URL, guid: 'ep-1', enclosure: null },
  { label: 'quote and backslash in the guid', feedUrl: FEED_URL, guid: 'a"b\\c', enclosure: null },
  {
    label: 'non-ASCII',
    feedUrl: 'https://例え.jp/フィード.xml',
    guid: 'épisode-🎧',
    enclosure: null,
  },
  {
    label: 'leading and trailing spaces, tabs, and newlines',
    feedUrl: ` \t${FEED_URL}\n `,
    guid: '\r\n ep-1\t\u00a0',
    enclosure: null,
  },
  {
    label: 'control characters inside',
    feedUrl: FEED_URL,
    guid: 'a\u0001b\u001fc\u007fd\be\ff',
    enclosure: null,
  },
  {
    label: 'line and paragraph separators',
    feedUrl: FEED_URL,
    guid: '\u2028ep\u2029x\u2028',
    enclosure: null,
  },
  {
    label: 'no guid with an enclosure',
    feedUrl: FEED_URL,
    guid: '  ',
    enclosure: ' https://cdn.example.com/ep 1.mp3 ',
  },
  { label: 'neither guid nor enclosure', feedUrl: FEED_URL, guid: null, enclosure: null },
];

async function seedAccount(label: string, runId: number): Promise<IdentityAccount> {
  const { AccountService, PlaylistService, QueueService } = await import('@podverse/orm');
  const accountService = new AccountService();
  const email = `add-by-rss-identity-${label}-${runId}@example.com`;
  await accountService.create({
    email,
    password: 'IntegrationTest1!',
    locale: 'en-US',
    terms_version: '2026-10-15',
  });
  const account = await accountService.getByEmail(email);
  if (!account) {
    throw new Error(`Failed to load account after create: ${label}`);
  }
  const queues = await new QueueService().getAllPrivate(account.id);
  const avQueue = queues.find((queue) => queue.medium_id === MediumEnum.AV);
  if (!avQueue) {
    throw new Error(`Expected AV queue for account: ${label}`);
  }
  const playlist = await new PlaylistService().getOrCreateDefaultLikesPlaylist(
    account.id,
    MediumEnum.AV
  );
  return {
    accountId: account.id,
    accountIdText: account.id_text,
    playlistIdText: playlist.id_text,
    queueId: avQueue.id,
    queueIdText: avQueue.id_text,
  };
}

describe('Add by RSS feed identity (real database)', () => {
  let server: Server | undefined;
  let ormContext: ORMContext | undefined;
  let app: import('express').Express;
  let queueBase: string;
  let playlistBase: string;
  const runId = Date.now();

  const query = async <T>(sql: string, params: unknown[]): Promise<T[]> => {
    if (!ormContext) {
      throw new Error('ORM context required');
    }
    return ormContext.dataSourceReadWrite.query(sql, params);
  };

  const queueAddByRSSRows = async (queueId: number): Promise<QueueRow[]> =>
    query<QueueRow>(
      `SELECT add_by_rss_hash_id, add_by_rss_resource_data->>'feed_url' AS feed_url,
              list_position::text AS list_position
         FROM public.queue_resource
        WHERE queue_id = $1 AND add_by_rss_hash_id IS NOT NULL
        ORDER BY id`,
      [queueId]
    );

  beforeAll(async () => {
    const started = await startTestApp();
    app = started.app;
    server = started.server;
    ormContext = started.ormContext;
    if (!ormContext) {
      throw new Error('ORM context required for Add by RSS identity integration test');
    }
    const base = await getBaseApiUrl();
    queueBase = `${base}/queue`;
    playlistBase = `${base}/playlist`;
  }, 60000);

  afterAll(async () => {
    await stopTestApp(server, ormContext);
  });

  describe('SQL hash matches getAddByRSSHashId', () => {
    for (const parityCase of parityCases) {
      it(`matches for ${parityCase.label}`, async () => {
        const [row] = await query<HashRow>(
          'SELECT public.add_by_rss_hash_id_from_feed($1, $2, $3) AS hash',
          [parityCase.feedUrl, parityCase.guid, parityCase.enclosure]
        );
        expect(row?.hash).toBe(
          getAddByRSSHashId({
            feed_url: parityCase.feedUrl,
            guid: parityCase.guid,
            enclosure_url: parityCase.enclosure,
          })
        );
      });
    }

    it('ignores a device-local guid the way the helper does', async () => {
      const data = {
        feed_url: FEED_URL,
        channel_id_text: 'chanAbc123',
        guid: 'chanAbc123-12',
        enclosure_url: 'https://cdn.example.com/12.mp3',
      };
      const [row] = await query<HashRow>(
        'SELECT public.add_by_rss_hash_id_from_resource_data($1::jsonb) AS hash',
        [JSON.stringify(data)]
      );
      expect(row?.hash).toBe(getAddByRSSHashId(data));
      expect(row?.hash).toBe(
        getMd5Hash({ feed_url: FEED_URL, enclosure_url: 'https://cdn.example.com/12.mp3' })
      );
    });
  });

  it('keeps one now-playing row when two devices add the same episode', async () => {
    const account = await seedAccount('two-devices', runId);
    for (const channelIdText of ['deviceAaaaa', 'deviceBbbbb']) {
      const res = await request(app)
        .post(`${queueBase}/${account.queueIdText}/item-add-by-rss/now-playing`)
        .set(authHeaders(account.accountId, account.accountIdText))
        .send({
          add_by_rss_resource_data: {
            feed_url: FEED_URL,
            channel_id_text: channelIdText,
            guid: 'shared-episode',
            title: 'Shared Episode',
          },
        });
      expect(res.status).toBe(201);
    }

    const rows = await queueAddByRSSRows(account.queueId);
    expect(rows).toHaveLength(1);
    expect(Number(rows[0]?.list_position)).toBe(0);
    expect(rows[0]?.add_by_rss_hash_id).toBe(
      getAddByRSSHashId({ feed_url: FEED_URL, guid: 'shared-episode' })
    );
  });

  it('moves a row written before feed identity instead of adding a second one', async () => {
    const account = await seedAccount('legacy-row', runId);
    const legacyData = { channel_id_text: 'legacyChan1', guid: 'legacy-episode', title: 'Legacy' };
    await query(
      `INSERT INTO public.queue_resource (queue_id, list_position, add_by_rss_resource_data, add_by_rss_hash_id)
       VALUES ($1, 1, $2::jsonb, $3)`,
      [account.queueId, JSON.stringify(legacyData), getAddByRSSHashId(legacyData)]
    );

    const res = await request(app)
      .post(`${queueBase}/${account.queueIdText}/item-add-by-rss/last`)
      .set(authHeaders(account.accountId, account.accountIdText))
      .send({ add_by_rss_resource_data: { ...legacyData, feed_url: FEED_URL } });
    expect(res.status).toBe(201);

    const rows = await queueAddByRSSRows(account.queueId);
    expect(rows).toHaveLength(1);
    expect(rows[0]?.add_by_rss_hash_id).toBe(
      getAddByRSSHashId({ feed_url: FEED_URL, guid: 'legacy-episode' })
    );
  });

  it('stores feed_url canonical, without userinfo', async () => {
    const account = await seedAccount('canonical', runId);
    const res = await request(app)
      .post(`${queueBase}/${account.queueIdText}/item-add-by-rss/last`)
      .set(authHeaders(account.accountId, account.accountIdText))
      .send({
        add_by_rss_resource_data: {
          feed_url: 'https://listener:secret@Feeds.Example.COM/identity.xml',
          channel_id_text: 'chanAbc123',
          guid: 'canonical-episode',
        },
      });
    expect(res.status).toBe(201);

    const rows = await queueAddByRSSRows(account.queueId);
    expect(rows).toHaveLength(1);
    expect(rows[0]?.feed_url).toBe(FEED_URL);
    expect(rows[0]?.add_by_rss_hash_id).toBe(
      getAddByRSSHashId({ feed_url: FEED_URL, guid: 'canonical-episode' })
    );
  });

  it('returns success when removing an Add by RSS hash the server does not have', async () => {
    const account = await seedAccount('unknown-remove', runId);
    const unknownHash = getMd5Hash({ channel_id_text: 'goneChan01', guid: 'gone' });

    const queueRes = await request(app)
      .delete(`${queueBase}/${account.queueIdText}/item-add-by-rss/${unknownHash}`)
      .set(authHeaders(account.accountId, account.accountIdText))
      .send({});
    expect(queueRes.status).toBe(204);

    const playlistRes = await request(app)
      .delete(`${playlistBase}/${account.playlistIdText}/item-add-by-rss/${unknownHash}`)
      .set(authHeaders(account.accountId, account.accountIdText));
    expect(playlistRes.status).toBe(204);
  });
});
