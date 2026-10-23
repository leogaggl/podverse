import { describe, expect, it, vi } from 'vitest';

import type { AddByRSSParseCredentialsState } from '@podverse/helpers';
import type {
  AddByRSSDirectoryChannelMatch,
  FeedObject,
  Phase6RemoteItem,
} from '@podverse/parser-mapping';
import { Phase4Medium } from '@podverse/parser-mapping';

import type { FanOutAddByRSSPublisherListedFeedsDeps } from './fanOutAddByRSSPublisherListedFeeds.js';
import { fanOutAddByRSSPublisherListedFeeds } from './fanOutAddByRSSPublisherListedFeeds.js';

const ARTIST_URL = 'https://artist.example/feed.xml';
const SAME_DOMAIN_ALBUM_URL = 'https://cdn.artist.example/album-a.xml';
const OTHER_DOMAIN_ALBUM_URL = 'https://other.example/album-b.xml';
const LOOKED_UP_ALBUM_URL = 'https://hosted.example/album-c.xml';
const NO_URL_ALBUM_GUID = '1b9f2c3e-4d5a-4e6f-8a7b-9c0d1e2f3a4b';

const remote = (feedGuid: string, feedUrl?: string): Phase6RemoteItem => ({
  feedGuid,
  medium: Phase4Medium.Music,
  ...(feedUrl !== undefined ? { feedUrl } : {}),
});

const feed = (overrides: Partial<FeedObject> = {}): FeedObject => ({
  title: 'Artist',
  explicit: false,
  link: 'https://artist.example',
  items: [],
  guid: 'artist-guid',
  medium: Phase4Medium.Publisher,
  ...overrides,
});

const directoryAlbum: AddByRSSDirectoryChannelMatch = {
  channelIdText: 'dir-album-1',
  title: 'Directory Album',
  mediumId: 3,
};

type Deps = FanOutAddByRSSPublisherListedFeedsDeps;

const createDeps = (
  overrides: {
    lookUpFeedUrlsByGuid?: Deps['lookUpFeedUrlsByGuid'];
    enqueue?: Deps['enqueue'];
  } = {}
) => {
  const events: string[] = [];
  let requestCount = 0;
  const deps = {
    findDirectoryChannels: vi.fn<Deps['findDirectoryChannels']>(
      async () => new Map([['dir-album-guid', directoryAlbum]])
    ),
    lookUpFeedUrlsByGuid: vi.fn<Deps['lookUpFeedUrlsByGuid']>(
      overrides.lookUpFeedUrlsByGuid ??
        (async () => new Map([[NO_URL_ALBUM_GUID, LOOKED_UP_ALBUM_URL]]))
    ),
    setCacheEntry: vi.fn<Deps['setCacheEntry']>(async (entry) => {
      events.push(`cache:${entry.requestId}:${entry.status}`);
    }),
    enqueue: vi.fn<Deps['enqueue']>(async (options) => {
      events.push(`enqueue:${options.requestId}`);
      await overrides.enqueue?.(options);
    }),
    sealCredentials: vi.fn<Deps['sealCredentials']>(
      ({ requestId, feedUrl }) => `sealed:${requestId}:${feedUrl}`
    ),
    newRequestId: () => {
      requestCount += 1;
      return `album-req-${requestCount}`;
    },
    now: () => new Date('2026-01-01T00:00:00.000Z'),
    logWarn: vi.fn<Deps['logWarn']>(),
    logError: vi.fn<Deps['logError']>(),
  };
  return { deps, events };
};

const run = (
  parsedFeed: FeedObject,
  deps: Deps,
  credentials: { credentialsState: AddByRSSParseCredentialsState; hasCredentials: boolean } = {
    credentialsState: 'not_provided',
    hasCredentials: false,
  }
) =>
  fanOutAddByRSSPublisherListedFeeds(
    {
      accountId: 7,
      requestId: 'artist-req',
      feedUrl: ARTIST_URL,
      parsedFeed,
      allowInsecure: false,
      ...credentials,
    },
    deps
  );

describe('fanOutAddByRSSPublisherListedFeeds', () => {
  it('returns undefined for a feed that does not list feeds and touches no dependency', async () => {
    const { deps } = createDeps();

    const result = await run(
      feed({ medium: Phase4Medium.Music, podcastRemoteItems: [remote('dir-album-guid')] }),
      deps
    );

    expect(result).toBeUndefined();
    expect(deps.findDirectoryChannels).not.toHaveBeenCalled();
    expect(deps.lookUpFeedUrlsByGuid).not.toHaveBeenCalled();
    expect(deps.setCacheEntry).not.toHaveBeenCalled();
    expect(deps.enqueue).not.toHaveBeenCalled();
  });

  it('links a directory album and queues an Add by RSS album without credentials', async () => {
    const { deps, events } = createDeps();

    const result = await run(
      feed({
        podcastRemoteItems: [
          remote('dir-album-guid', 'https://dir.example/album.xml'),
          remote('rss-album-guid', OTHER_DOMAIN_ALBUM_URL),
        ],
      }),
      deps
    );

    expect(result?.map((row) => row.kind)).toEqual(['directory', 'add_by_rss']);
    expect(result?.[0]).toMatchObject({ kind: 'directory', channelIdText: 'dir-album-1' });
    expect(result?.[1]).toMatchObject({
      kind: 'add_by_rss',
      requestId: 'album-req-1',
      feedUrl: OTHER_DOMAIN_ALBUM_URL,
    });

    expect(deps.setCacheEntry).toHaveBeenCalledTimes(1);
    expect(deps.setCacheEntry).toHaveBeenCalledWith({
      requestId: 'album-req-1',
      accountId: 7,
      feedUrl: OTHER_DOMAIN_ALBUM_URL,
      status: 'queued',
      publisherRequestId: 'artist-req',
      updatedAt: '2026-01-01T00:00:00.000Z',
    });
    expect(deps.enqueue).toHaveBeenCalledTimes(1);
    expect(deps.enqueue).toHaveBeenCalledWith({
      accountId: 7,
      feedUrl: OTHER_DOMAIN_ALBUM_URL,
      requestId: 'album-req-1',
      publisherRequestId: 'artist-req',
    });
    expect(events).toEqual(['cache:album-req-1:queued', 'enqueue:album-req-1']);
    expect(deps.sealCredentials).not.toHaveBeenCalled();
  });

  it('seals credentials only for an album on the artist feed domain', async () => {
    const { deps } = createDeps();

    await run(
      feed({
        podcastRemoteItems: [
          remote('same-domain-guid', SAME_DOMAIN_ALBUM_URL),
          remote('other-domain-guid', OTHER_DOMAIN_ALBUM_URL),
        ],
      }),
      deps,
      { credentialsState: 'sent', hasCredentials: true }
    );

    expect(deps.sealCredentials).toHaveBeenCalledTimes(1);
    expect(deps.sealCredentials).toHaveBeenCalledWith({
      accountId: 7,
      requestId: 'album-req-1',
      feedUrl: SAME_DOMAIN_ALBUM_URL,
    });
    expect(deps.enqueue).toHaveBeenNthCalledWith(1, {
      accountId: 7,
      feedUrl: SAME_DOMAIN_ALBUM_URL,
      requestId: 'album-req-1',
      publisherRequestId: 'artist-req',
      credentialsEnvelope: `sealed:album-req-1:${SAME_DOMAIN_ALBUM_URL}`,
    });
    expect(deps.enqueue).toHaveBeenNthCalledWith(2, {
      accountId: 7,
      feedUrl: OTHER_DOMAIN_ALBUM_URL,
      requestId: 'album-req-2',
      publisherRequestId: 'artist-req',
      credentialsWithheld: 'withheld_other_domain',
    });
  });

  it('looks up a missing album URL for a public artist feed', async () => {
    const { deps } = createDeps();

    const result = await run(feed({ podcastRemoteItems: [remote(NO_URL_ALBUM_GUID)] }), deps);

    expect(deps.lookUpFeedUrlsByGuid).toHaveBeenCalledWith([NO_URL_ALBUM_GUID]);
    expect(result).toEqual([
      expect.objectContaining({
        kind: 'add_by_rss',
        feedUrl: LOOKED_UP_ALBUM_URL,
        requestId: 'album-req-1',
      }),
    ]);
    expect(deps.enqueue).toHaveBeenCalledTimes(1);
  });

  it('never looks up album URLs for an artist feed fetched with credentials', async () => {
    const { deps } = createDeps();

    const result = await run(feed({ podcastRemoteItems: [remote(NO_URL_ALBUM_GUID)] }), deps, {
      credentialsState: 'sent',
      hasCredentials: true,
    });

    expect(deps.lookUpFeedUrlsByGuid).not.toHaveBeenCalled();
    expect(result).toEqual([
      expect.objectContaining({ kind: 'unresolved', reason: 'no_feed_url', feedUrl: null }),
    ]);
    expect(deps.enqueue).not.toHaveBeenCalled();
  });

  it('still returns the list when the lookup throws', async () => {
    const { deps } = createDeps({
      lookUpFeedUrlsByGuid: async () => {
        throw new Error('Podcast Index unavailable');
      },
    });

    const result = await run(feed({ podcastRemoteItems: [remote(NO_URL_ALBUM_GUID)] }), deps);

    expect(result).toEqual([
      expect.objectContaining({ kind: 'unresolved', reason: 'no_feed_url' }),
    ]);
    expect(deps.logError).toHaveBeenCalledTimes(1);
    expect(deps.enqueue).not.toHaveBeenCalled();
  });

  it('marks an album failed when its enqueue throws and keeps queueing the rest', async () => {
    const { deps, events } = createDeps({
      enqueue: async (options) => {
        if (options.requestId === 'album-req-1') {
          throw new Error('broker down');
        }
      },
    });

    const result = await run(
      feed({
        podcastRemoteItems: [
          remote('album-a-guid', SAME_DOMAIN_ALBUM_URL),
          remote('album-b-guid', OTHER_DOMAIN_ALBUM_URL),
        ],
      }),
      deps
    );

    expect(result?.map((row) => row.kind)).toEqual(['add_by_rss', 'add_by_rss']);
    expect(events).toEqual([
      'cache:album-req-1:queued',
      'enqueue:album-req-1',
      'cache:album-req-1:failed',
      'cache:album-req-2:queued',
      'enqueue:album-req-2',
    ]);
    expect(deps.setCacheEntry).toHaveBeenCalledWith(
      expect.objectContaining({
        requestId: 'album-req-1',
        status: 'failed',
        error: 'Could not queue this feed for parsing.',
        publisherRequestId: 'artist-req',
      })
    );
    expect(deps.enqueue).toHaveBeenCalledTimes(2);
    expect(deps.logError).toHaveBeenCalledTimes(1);
    expect(String(deps.logError.mock.calls[0]?.[0])).not.toContain('/album-a.xml');
  });
});
