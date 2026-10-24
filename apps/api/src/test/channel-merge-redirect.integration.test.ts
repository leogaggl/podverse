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

type MergeApi = {
  verifyAndApplyDuplicateMerges: typeof import('@podverse/orm').verifyAndApplyDuplicateMerges;
  ChannelMerge: typeof import('@podverse/orm').ChannelMerge;
  ChannelMergeStatus: typeof import('@podverse/orm').ChannelMergeStatus;
  ChannelMergeMode: typeof import('@podverse/orm').ChannelMergeMode;
};

type SeededItem = {
  id: number;
  idText: string;
  guid: string;
};

type SeededShow = {
  channelId: number;
  channelIdText: string;
  podcastIndexId: number;
  items: SeededItem[];
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function mergedInto(body: unknown): { kind: string; id_text: string } | null {
  if (!isRecord(body) || !isRecord(body.merged_into)) {
    return null;
  }
  const kind = body.merged_into.kind;
  const idText = body.merged_into.id_text;
  if (typeof kind !== 'string' || typeof idText !== 'string') {
    return null;
  }
  return { kind, id_text: idText };
}

function textField(body: unknown, key: string): string | null {
  if (!isRecord(body)) {
    return null;
  }
  const value = body[key];
  return typeof value === 'string' ? value : null;
}

function numberField(body: unknown, key: string): number | null {
  if (!isRecord(body)) {
    return null;
  }
  const value = body[key];
  return typeof value === 'number' ? value : null;
}

let seed = 0;

function nextRunId(): number {
  seed += 1;
  return Date.now() + seed;
}

function podcastIndexId(runId: number, slot: number): number {
  return 700_000_000 + (runId % 400_000_000) + slot;
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
      url: `https://channel-merge-redirect-${runId}-${slot}.example.com/feed.xml`,
      podcast_index_id: podcastId,
    })
  );
  const channelRepo = manager.getRepository(Channel);
  const channel = await channelRepo.save(
    channelRepo.create({
      feed_id: feed.id,
      medium_id: MediumEnum.AV,
      title: `Channel merge redirect ${runId} ${slot}`,
    })
  );
  await manager.query(`INSERT INTO channel_about (channel_id) VALUES ($1)`, [channel.id]);
  const itemRepo = manager.getRepository(Item);
  const items: SeededItem[] = [];
  for (const [index, guid] of guids.entries()) {
    const item = await itemRepo.save(
      itemRepo.create({
        channel_id: String(channel.id),
        title: `Episode ${index}`,
        item_flag_status: { id: 1 },
        guid,
      })
    );
    items.push({ id: item.id, idText: item.id_text, guid });
  }
  return {
    channelId: channel.id,
    channelIdText: channel.id_text,
    podcastIndexId: podcastId,
    items,
  };
}

describe('channel merge redirects', () => {
  let server: Server | undefined;
  let ormContext: ORMContext | undefined;
  let app: import('express').Express | undefined;
  let base = '';
  let mergeApi: MergeApi | undefined;

  function requireApp(): import('express').Express {
    if (!app) {
      throw new Error('test app required');
    }
    return app;
  }

  function requireMergeApi(): MergeApi {
    if (!mergeApi) {
      throw new Error('merge API required');
    }
    return mergeApi;
  }

  beforeAll(async () => {
    const started = await startTestApp();
    server = started.server;
    ormContext = started.ormContext;
    app = started.app;
    if (!ormContext) {
      throw new Error('ORM context required for channel merge redirect test');
    }
    await ormContext.dataSourceReadWrite.query(`DELETE FROM channel_merge`);
    base = await getBaseApiUrl();
    const orm = await import('@podverse/orm');
    mergeApi = {
      verifyAndApplyDuplicateMerges: orm.verifyAndApplyDuplicateMerges,
      ChannelMerge: orm.ChannelMerge,
      ChannelMergeStatus: orm.ChannelMergeStatus,
      ChannelMergeMode: orm.ChannelMergeMode,
    };
  }, 120000);

  afterAll(async () => {
    await stopTestApp(server, ormContext);
  });

  it('returns 410 for an absorbed show and matched episode, and keeps an unmatched episode', async () => {
    if (!ormContext) {
      throw new Error('ORM context required');
    }
    const manager = ormContext.dataSourceReadWrite.manager;
    const runId = nextRunId();
    const shared = [0, 1, 2].map(
      (index) => `https://channel-merge-redirect.example.com/${runId}/episode-${index}`
    );
    const unmatchedGuid = `https://channel-merge-redirect.example.com/${runId}/unmatched`;
    const oldShow = await seedShow(manager, runId, 1, [...shared, unmatchedGuid]);
    const survivor = await seedShow(manager, runId, 2, shared);
    const matched = oldShow.items[0];
    const unmatched = oldShow.items.find((item) => item.guid === unmatchedGuid);
    const survivorMatched = survivor.items[0];
    if (!matched || !unmatched || !survivorMatched) {
      throw new Error('expected seeded episodes');
    }

    const api = requireMergeApi();
    const mergeRepo = manager.getRepository(api.ChannelMerge);
    await mergeRepo.save(
      mergeRepo.create({
        from_podcast_index_id: oldShow.podcastIndexId,
        to_podcast_index_id: survivor.podcastIndexId,
        status: api.ChannelMergeStatus.Detected,
        mode: null,
        match_stats: {},
      })
    );
    await api.verifyAndApplyDuplicateMerges({
      mode: 'apply',
      fetchSurvivorFeed: async () => {
        throw new Error('absorb must not fetch the survivor feed');
      },
      enqueueRepointParse: async () => {
        throw new Error('absorb must not enqueue a parse');
      },
      statsTrackEventRetentionDays: 90,
    });

    const http = requireApp();
    const oldChannel = await request(http).get(`${base}/channel/${oldShow.channelIdText}`);
    expect(oldChannel.status).toBe(410);
    expect(mergedInto(oldChannel.body)).toEqual({
      kind: 'channel',
      id_text: survivor.channelIdText,
    });

    const oldChannelById = await request(http).get(`${base}/channel/${oldShow.channelId}`);
    expect(oldChannelById.status).toBe(410);
    expect(mergedInto(oldChannelById.body)?.id_text).toBe(survivor.channelIdText);

    const publisherFeed = await request(http).get(
      `${base}/publisher-feed/channel/${oldShow.channelIdText}`
    );
    expect(publisherFeed.status).toBe(410);
    expect(mergedInto(publisherFeed.body)).toEqual({
      kind: 'channel',
      id_text: survivor.channelIdText,
    });

    const matchedItem = await request(http).get(`${base}/item/${matched.idText}`);
    expect(matchedItem.status).toBe(410);
    expect(mergedInto(matchedItem.body)).toEqual({
      kind: 'item',
      id_text: survivorMatched.idText,
    });

    const matchedDescription = await request(http).get(
      `${base}/item/${matched.idText}/description`
    );
    expect(matchedDescription.status).toBe(410);
    expect(mergedInto(matchedDescription.body)).toEqual({
      kind: 'item',
      id_text: survivorMatched.idText,
    });

    const unmatchedItem = await request(http).get(`${base}/item/${unmatched.idText}`);
    expect(unmatchedItem.status).toBe(200);
    expect(textField(unmatchedItem.body, 'id_text')).toBe(unmatched.idText);
    expect(isRecord(unmatchedItem.body) && isRecord(unmatchedItem.body.channel)).toBe(true);
    if (isRecord(unmatchedItem.body) && isRecord(unmatchedItem.body.channel)) {
      expect(unmatchedItem.body.channel.id_text).toBe(oldShow.channelIdText);
    }

    const byPodcastIndex = await request(http).get(
      `${base}/channel/podcast-index/${oldShow.podcastIndexId}`
    );
    expect(byPodcastIndex.status).toBe(200);
    expect(textField(byPodcastIndex.body, 'id_text')).toBe(survivor.channelIdText);

    const feed = await request(http).get(`${base}/feed/${oldShow.podcastIndexId}`);
    expect(feed.status).toBe(200);
    expect(numberField(feed.body, 'podcast_index_id')).toBe(survivor.podcastIndexId);

    const resolved = await request(http)
      .post(`${base}/identity/resolve`)
      .send({
        channel_id_texts: [oldShow.channelIdText, 'missing-channel'],
        item_id_texts: [matched.idText, unmatched.idText, 'missing-item'],
        podcast_index_ids: [oldShow.podcastIndexId, 2147483646],
      });
    expect(resolved.status).toBe(200);
    expect(resolved.body).toEqual({
      channels: [{ from_id_text: oldShow.channelIdText, to_id_text: survivor.channelIdText }],
      items: [{ from_id_text: matched.idText, to_id_text: survivorMatched.idText }],
      podcast_index_ids: [
        { from: oldShow.podcastIndexId, to_channel_id_text: survivor.channelIdText },
      ],
    });
  });

  it('keeps a re-pointed show on its own id', async () => {
    if (!ormContext) {
      throw new Error('ORM context required');
    }
    const manager = ormContext.dataSourceReadWrite.manager;
    const runId = nextRunId();
    const show = await seedShow(manager, runId, 3, [
      `https://channel-merge-redirect.example.com/${runId}/repoint`,
    ]);
    const api = requireMergeApi();
    const mergeRepo = manager.getRepository(api.ChannelMerge);
    await mergeRepo.save(
      mergeRepo.create({
        from_podcast_index_id: show.podcastIndexId,
        to_podcast_index_id: show.podcastIndexId + 50,
        from_channel_id: show.channelId,
        to_channel_id: null,
        status: api.ChannelMergeStatus.Applied,
        mode: api.ChannelMergeMode.Repoint,
        match_stats: {},
      })
    );

    const http = requireApp();
    const channel = await request(http).get(`${base}/channel/${show.channelIdText}`);
    expect(channel.status).toBe(200);
    expect(textField(channel.body, 'id_text')).toBe(show.channelIdText);

    const resolved = await request(http)
      .post(`${base}/identity/resolve`)
      .send({
        channel_id_texts: [show.channelIdText],
        podcast_index_ids: [show.podcastIndexId],
      });
    expect(resolved.status).toBe(200);
    expect(resolved.body).toEqual({
      channels: [],
      items: [],
      podcast_index_ids: [],
    });
  });

  it('rejects an empty resolve body and a list past the cap', async () => {
    const http = requireApp();
    const empty = await request(http).post(`${base}/identity/resolve`).send({});
    expect(empty.status).toBe(400);

    const tooMany = await request(http)
      .post(`${base}/identity/resolve`)
      .send({
        channel_id_texts: Array.from({ length: 501 }, (_, index) => `missing-${index}`),
      });
    expect(tooMany.status).toBe(400);
  });
});
