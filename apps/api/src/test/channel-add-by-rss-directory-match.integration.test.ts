import { randomUUID } from 'node:crypto';

import type { Server } from 'http';
import type { EntityManager } from 'typeorm';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

import { MediumEnum } from '@podverse/helpers';
import type {
  AddByRSSDirectoryChannelMatchRow,
  ChannelAddByRSSDirectoryMatchService,
  ORMContext,
} from '@podverse/orm';

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
  channelIdText: string;
  podcastGuid: string | null;
  feedUrl: string;
  title: string;
};

type SeedChannelInput = {
  podcastGuid: string | null;
  feedUrl: string;
  title: string;
  withAbout: boolean;
  publicVisible: boolean;
};

let podcastIndexSlot = 0;

function nextPodcastIndexId(): number {
  podcastIndexSlot += 1;
  const hex = randomUUID().replaceAll('-', '').slice(0, 6);
  const parsed = Number.parseInt(hex, 16) % 200_000_000;
  return 1_600_000_000 + parsed + podcastIndexSlot;
}

function httpsFeedUrl(): string {
  return `https://add-by-rss-dir-match-${randomUUID()}.example.com/feed.xml`;
}

function httpUrlFor(httpsUrl: string): string {
  return `http://${httpsUrl.slice('https://'.length)}`;
}

describe('Add by RSS directory channel match', () => {
  let server: Server | undefined;
  let ormContext: ORMContext | undefined;
  let service: ChannelAddByRSSDirectoryMatchService;
  const seededFeedIds: number[] = [];

  function requireManager(): EntityManager {
    if (!ormContext) {
      throw new Error('ORM context required');
    }
    return ormContext.dataSourceReadWrite.manager;
  }

  async function seedChannel(input: SeedChannelInput): Promise<SeededChannel> {
    const manager = requireManager();
    const { Channel, Feed } = await import('@podverse/orm');
    const feedRepo = manager.getRepository(Feed);
    const feed = await feedRepo.save(
      feedRepo.create({
        url: input.feedUrl,
        podcast_index_id: nextPodcastIndexId(),
      })
    );
    seededFeedIds.push(feed.id);
    const channelRepo = manager.getRepository(Channel);
    const channel = await channelRepo.save(
      channelRepo.create({
        feed_id: feed.id,
        medium_id: MediumEnum.Music,
        title: input.title,
        podcast_guid: input.podcastGuid,
      })
    );
    await manager.query(
      `INSERT INTO feed_policy (feed_id, parse_allowed, public_visible, add_allowed)
       VALUES ($1, true, $2, true)`,
      [feed.id, input.publicVisible]
    );
    if (input.withAbout) {
      await manager.query(`INSERT INTO channel_about (channel_id) VALUES ($1)`, [channel.id]);
    }
    return {
      feedId: feed.id,
      channelIdText: channel.id_text,
      podcastGuid: input.podcastGuid,
      feedUrl: input.feedUrl,
      title: input.title,
    };
  }

  async function setLifecycle(feedId: number, stateKey: string): Promise<void> {
    await requireManager().query(
      `UPDATE feed_lifecycle_state
       SET feed_lifecycle_state_type_id = (
         SELECT id FROM feed_lifecycle_state_type WHERE state_key = $2
       )
       WHERE feed_id = $1`,
      [feedId, stateKey]
    );
  }

  function expectRow(
    result: Map<string, AddByRSSDirectoryChannelMatchRow>,
    guidKey: string,
    channel: SeededChannel
  ): void {
    expect(result.get(guidKey)).toEqual({
      channelIdText: channel.channelIdText,
      title: channel.title,
      mediumId: MediumEnum.Music,
    });
  }

  beforeAll(async () => {
    const started = await startTestApp();
    server = started.server;
    ormContext = started.ormContext;
    if (!ormContext) {
      throw new Error('ORM context required for directory channel match integration test');
    }
    const orm = await import('@podverse/orm');
    service = new orm.ChannelAddByRSSDirectoryMatchService();
  }, 120000);

  afterAll(async () => {
    if (ormContext && seededFeedIds.length > 0) {
      await ormContext.dataSourceReadWrite.query(`DELETE FROM feed WHERE id = ANY($1::int[])`, [
        seededFeedIds,
      ]);
    }
    await stopTestApp(server, ormContext);
  });

  it('matches a visible parsed channel by guid and keys the row by the lowercased guid', async () => {
    const podcastGuid = `a${randomUUID().slice(1)}`;
    const channel = await seedChannel({
      podcastGuid,
      feedUrl: httpsFeedUrl(),
      title: 'Guid match album',
      withAbout: true,
      publicVisible: true,
    });

    const result = await service.getForListedFeeds([
      { feedGuid: podcastGuid.toUpperCase(), feedUrl: null },
    ]);

    expect(result.size).toBe(1);
    expectRow(result, podcastGuid.toLowerCase(), channel);
    expect(result.has(podcastGuid.toUpperCase())).toBe(false);
  });

  it('matches a non-UUID guid by feed URL, including an http ref against an https feed', async () => {
    const feedUrl = httpsFeedUrl();
    const channel = await seedChannel({
      podcastGuid: null,
      feedUrl,
      title: 'URL match album',
      withAbout: true,
      publicVisible: true,
    });
    const feedGuid = `album-${randomUUID()}`;

    const result = await service.getForListedFeeds([{ feedGuid, feedUrl: httpUrlFor(feedUrl) }]);

    expect(result.size).toBe(1);
    expectRow(result, feedGuid.toLowerCase(), channel);
  });

  it('refuses a URL match when the channel guid differs from the ref', async () => {
    const feedUrl = httpsFeedUrl();
    await seedChannel({
      podcastGuid: randomUUID(),
      feedUrl,
      title: 'Different guid album',
      withAbout: true,
      publicVisible: true,
    });
    const refGuid = randomUUID();

    const result = await service.getForListedFeeds([
      { feedGuid: refGuid, feedUrl: httpUrlFor(feedUrl) },
    ]);

    expect(result.size).toBe(0);
    expect(result.has(refGuid.toLowerCase())).toBe(false);
  });

  it('does not match a hidden, unparsed, or archived channel', async () => {
    const hidden = await seedChannel({
      podcastGuid: randomUUID(),
      feedUrl: httpsFeedUrl(),
      title: 'Hidden album',
      withAbout: true,
      publicVisible: false,
    });
    const unparsed = await seedChannel({
      podcastGuid: randomUUID(),
      feedUrl: httpsFeedUrl(),
      title: 'Unparsed album',
      withAbout: false,
      publicVisible: true,
    });
    const archived = await seedChannel({
      podcastGuid: randomUUID(),
      feedUrl: httpsFeedUrl(),
      title: 'Archived album',
      withAbout: true,
      publicVisible: true,
    });
    const { FeedLifecycleStateKeyEnum } = await import('@podverse/orm');
    await setLifecycle(archived.feedId, FeedLifecycleStateKeyEnum.Archived);

    const result = await service.getForListedFeeds([
      { feedGuid: hidden.podcastGuid ?? '', feedUrl: hidden.feedUrl },
      { feedGuid: unparsed.podcastGuid ?? '', feedUrl: unparsed.feedUrl },
      { feedGuid: archived.podcastGuid ?? '', feedUrl: archived.feedUrl },
    ]);

    expect(result.size).toBe(0);
  });

  it('returns an empty map for an empty input', async () => {
    const result = await service.getForListedFeeds([]);

    expect(result.size).toBe(0);
  });
});
