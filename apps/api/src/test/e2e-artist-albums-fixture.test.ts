import type { Server } from 'http';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

import type { RemoteItemGeneric } from '@podverse/helpers';
import type { ORMContext } from '@podverse/orm';

import {
  buildE2eArtistNotYetAddedAlbumByIdResponse,
  buildE2eArtistNotYetAddedAlbumFeed,
  E2E_ARTIST_NOT_YET_ADDED_ALBUM_FEED_URL,
  E2E_ARTIST_NOT_YET_ADDED_ALBUM_PODCAST_GUID,
  E2E_ARTIST_NOT_YET_ADDED_ALBUM_PODCAST_INDEX_ID,
} from '../lib/e2eArtistAlbumsFixture.js';
import { getBaseApiUrl, startTestApp, stopTestApp } from './helpers/index.js';

/**
 * Locks the fixtures contract for the seeded artist page:
 * the Not Yet Added preview id returns the synthetic feed, and remote-item
 * resolution never calls live Podcast Index.
 *
 * Sets `PODVERSE_E2E_FIXTURES=1` before `startTestApp` so the re-imported config
 * has `e2e.fixturesEnabled` (see helpers/startTestApp `vi.resetModules`).
 */

const E2E_ARTIST_UNKNOWN_ALBUM_PODCAST_GUID = '11111111-2222-4333-8444-555555555505';

const podcastIndexMocks = vi.hoisted(() => {
  const live = async (): Promise<never> => {
    throw new Error('live Podcast Index must not run when fixturesEnabled');
  };
  return {
    podcastIndexAPIRequest: vi.fn(live),
    deadFeedsDownloadAndExtractCSV: vi.fn(live),
    podcastGetById: vi.fn(live),
    podcastGetByGuid: vi.fn(live),
    podcastGetByFeedUrl: vi.fn(live),
    podcastsByMedium: vi.fn(live),
    podcastsBatchByFeedGuid: vi.fn(live),
    recentGetData: vi.fn(live),
    searchPodcasts: vi.fn(live),
    searchMusicByTerm: vi.fn(live),
    trendingGetPodcasts: vi.fn(live),
    episodeGetByGuid: vi.fn(live),
    valueGetByPodcastIds: vi.fn(live),
    valueGetByPodcastIdsRecursively: vi.fn(live),
  };
});

vi.mock('../factories/podcastIndexService.js', () => ({
  podcastIndexService: podcastIndexMocks,
}));

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

describe('e2e artist album fixtures', () => {
  let app: import('express').Express;
  let server: Server | undefined;
  let ormContext: ORMContext | undefined;
  let previousFixturesEnv: string | undefined;
  let externalServicesBase = '';

  beforeAll(async () => {
    previousFixturesEnv = process.env.PODVERSE_E2E_FIXTURES;
    process.env.PODVERSE_E2E_FIXTURES = '1';
    const started = await startTestApp();
    app = started.app;
    server = started.server;
    ormContext = started.ormContext;
    const apiBase = await getBaseApiUrl();
    externalServicesBase = `${apiBase}/external-services`;
  });

  afterAll(async () => {
    if (previousFixturesEnv === undefined) {
      delete process.env.PODVERSE_E2E_FIXTURES;
    } else {
      process.env.PODVERSE_E2E_FIXTURES = previousFixturesEnv;
    }
    await stopTestApp(server, ormContext);
  });

  it('GET /external-services/podcast-index/feed/2147483631 returns the fixture feed', async () => {
    const res = await request(app).get(
      `${externalServicesBase}/podcast-index/feed/${E2E_ARTIST_NOT_YET_ADDED_ALBUM_PODCAST_INDEX_ID}`
    );

    expect(res.status).toBe(200);
    expect(res.body).toEqual(buildE2eArtistNotYetAddedAlbumByIdResponse());
    expect(res.body.feed.title).toBe('E2E Not Yet Added Album');
    expect(res.body.feed.podcastGuid).toBe(E2E_ARTIST_NOT_YET_ADDED_ALBUM_PODCAST_GUID);
    expect(res.body.feed.medium).toBe('music');
    for (const mockFn of Object.values(podcastIndexMocks)) {
      expect(mockFn).not.toHaveBeenCalled();
    }
  });

  it('resolves only the fixture album and never calls live Podcast Index', async () => {
    const notYetAddedRef: RemoteItemGeneric = {
      feed_guid: E2E_ARTIST_NOT_YET_ADDED_ALBUM_PODCAST_GUID,
      feed_url: E2E_ARTIST_NOT_YET_ADDED_ALBUM_FEED_URL,
      item_guid: null,
    };
    const unknownRef: RemoteItemGeneric = {
      feed_guid: E2E_ARTIST_UNKNOWN_ALBUM_PODCAST_GUID,
      feed_url: null,
      item_guid: null,
    };

    const { buildRemoteItemsFinalResult } = await import('../lib/remoteItems.js');
    const result = await buildRemoteItemsFinalResult([], [notYetAddedRef, unknownRef], [], [], {
      enrichUnaddedChannelsByFeedUrl: true,
    });

    expect(result.channelsUnadded).toEqual([buildE2eArtistNotYetAddedAlbumFeed()]);
    expect(result.itemsUnadded).toEqual([]);
    for (const mockFn of Object.values(podcastIndexMocks)) {
      expect(mockFn).not.toHaveBeenCalled();
    }
  });
});
