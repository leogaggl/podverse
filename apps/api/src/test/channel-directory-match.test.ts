import type { Server } from 'http';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import { MediumEnum } from '@podverse/helpers';
import type { ORMContext } from '@podverse/orm';

import { getBaseApiUrl, startTestApp, stopTestApp } from './helpers/index.js';

const DIRECTORY_MATCH_GUID = '11111111-2222-4333-8444-555555555502';

const directoryMatchProbe: {
  listedFeedCalls: { feedGuid: string; feedUrl: string | null }[][];
  getByIdOrIdTextCallCount: number;
} = {
  listedFeedCalls: [],
  getByIdOrIdTextCallCount: 0,
};

const directoryMatchBody = {
  id_text: 'e2eMusicChnl01',
  title: 'E2E Music Artist',
  medium_id: MediumEnum.PublisherMusic,
};

vi.mock('@podverse/orm', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@podverse/orm')>();

  class MockCategoryService {
    async setCategoryCache(): Promise<void> {}
  }

  class MockChannelService extends actual.ChannelService {
    override getByIdOrIdText(
      idOrIdText: string,
      relations?: Parameters<actual.ChannelService['getByIdOrIdText']>[1]
    ) {
      directoryMatchProbe.getByIdOrIdTextCallCount += 1;
      return super.getByIdOrIdText(idOrIdText, relations);
    }
  }

  class MockChannelAddByRSSDirectoryMatchService {
    async getForListedFeeds(
      refs: readonly { feedGuid: string; feedUrl: string | null }[]
    ): Promise<
      Map<string, { channelIdText: string; title: string | null; mediumId: number | null }>
    > {
      directoryMatchProbe.listedFeedCalls.push(
        refs.map((ref) => ({ feedGuid: ref.feedGuid, feedUrl: ref.feedUrl }))
      );
      const matches = new Map<
        string,
        { channelIdText: string; title: string | null; mediumId: number | null }
      >();
      matches.set(DIRECTORY_MATCH_GUID, {
        channelIdText: directoryMatchBody.id_text,
        title: directoryMatchBody.title,
        mediumId: MediumEnum.PublisherMusic,
      });
      return matches;
    }
  }

  return {
    ...actual,
    CategoryService: MockCategoryService,
    ChannelService: MockChannelService,
    ChannelAddByRSSDirectoryMatchService: MockChannelAddByRSSDirectoryMatchService,
  };
});

describe('GET /channel/directory-match', () => {
  let app: import('express').Express;
  let server: Server | undefined;
  let ormContext: ORMContext | undefined;
  let channelBase = '';

  beforeAll(async () => {
    const started = await startTestApp();
    app = started.app;
    server = started.server;
    ormContext = started.ormContext;
    const apiBase = await getBaseApiUrl();
    channelBase = `${apiBase}/channel`;
  });

  beforeEach(() => {
    directoryMatchProbe.listedFeedCalls = [];
    directoryMatchProbe.getByIdOrIdTextCallCount = 0;
  });

  afterAll(async () => {
    await stopTestApp(server, ormContext);
  });

  it('returns the directory channel for a feed guid', async () => {
    const res = await request(app)
      .get(`${channelBase}/directory-match`)
      .query({ feed_guid: DIRECTORY_MATCH_GUID });

    expect(res.status).toBe(200);
    expect(res.body).toEqual(directoryMatchBody);
  });

  it('returns the same match when the feed guid is upper case', async () => {
    const feedGuid = DIRECTORY_MATCH_GUID.toUpperCase();
    const res = await request(app)
      .get(`${channelBase}/directory-match`)
      .query({ feed_guid: feedGuid });

    expect(res.status).toBe(200);
    expect(res.body).toEqual(directoryMatchBody);
    expect(directoryMatchProbe.listedFeedCalls.at(-1)).toEqual([{ feedGuid, feedUrl: null }]);
  });

  it('passes feed_url to the lookup and null when the query omits it', async () => {
    const feedUrl = 'https://artist.example.com/album.xml';
    const withUrl = await request(app)
      .get(`${channelBase}/directory-match`)
      .query({ feed_guid: DIRECTORY_MATCH_GUID, feed_url: feedUrl });

    expect(withUrl.status).toBe(200);
    expect(directoryMatchProbe.listedFeedCalls.at(-1)).toEqual([
      { feedGuid: DIRECTORY_MATCH_GUID, feedUrl },
    ]);

    const withoutUrl = await request(app)
      .get(`${channelBase}/directory-match`)
      .query({ feed_guid: DIRECTORY_MATCH_GUID });

    expect(withoutUrl.status).toBe(200);
    expect(directoryMatchProbe.listedFeedCalls.at(-1)).toEqual([
      { feedGuid: DIRECTORY_MATCH_GUID, feedUrl: null },
    ]);
  });

  it('returns null when the lookup has no channel for the guid', async () => {
    const res = await request(app).get(`${channelBase}/directory-match`).query({
      feed_guid: 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee',
    });

    expect(res.status).toBe(200);
    expect(res.body).toBeNull();
  });

  it('returns 400 when feed_guid is missing', async () => {
    const res = await request(app).get(`${channelBase}/directory-match`);

    expect(res.status).toBe(400);
    expect(directoryMatchProbe.listedFeedCalls).toEqual([]);
  });

  it('resolves /channel/directory-match as this route, not a channel id', async () => {
    const res = await request(app)
      .get(`${channelBase}/directory-match`)
      .query({ feed_guid: DIRECTORY_MATCH_GUID });

    expect(res.status).toBe(200);
    expect(res.body).toEqual(directoryMatchBody);
    expect(directoryMatchProbe.getByIdOrIdTextCallCount).toBe(0);
  });
});
