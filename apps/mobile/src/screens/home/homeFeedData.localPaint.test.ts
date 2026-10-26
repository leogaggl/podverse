import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { SubscribedChannel } from '../../data/repositories';
import {
  addByRssRepository,
  channelItemsRepository,
  channelLiveStatusRepository,
  channelSeenRepository,
  downloadsRepository,
  homeClipsCacheRepository,
  subscriptionsRepository,
  syncEventLogRepository,
} from '../../data/repositories';
import { fetchHomeFeed } from './homeFeedData';
import { HOME_FEED_METADATA_TIMEOUT_CODE, HOME_FEED_METADATA_TIMEOUT_MS } from './homeFeedReadLog';

vi.mock('../../data/repositories', () => ({
  addByRssRepository: {
    listFeedsByCredentials: vi.fn(),
  },
  channelItemsRepository: {
    listSubscribed: vi.fn(),
    hasPopularityRanks: vi.fn(),
    refreshPopularityRanks: vi.fn(),
  },
  channelLiveStatusRepository: {
    listBroadcastingKeys: vi.fn(),
  },
  channelSeenRepository: {
    listUnseen: vi.fn(),
  },
  downloadsRepository: {
    countCompletedByChannel: vi.fn(),
  },
  homeClipsCacheRepository: {
    listPayload: vi.fn(),
    readSnapshot: vi.fn(),
  },
  subscriptionsRepository: {
    hasPopularityRanks: vi.fn(),
    list: vi.fn(),
    refreshPopularityRanks: vi.fn(),
  },
  syncEventLogRepository: {
    append: vi.fn(),
  },
}));

const followedShow = (): SubscribedChannel => ({
  idText: 'show-1',
  imageUrl: null,
  kind: 'podcasts',
  latestItemPubDateMs: null,
  medium: 'podcasts',
  popularityRank: null,
  source: 'directory',
  title: 'Example Show',
});

describe('fetchHomeFeed local paint', () => {
  beforeEach(() => {
    vi.mocked(addByRssRepository.listFeedsByCredentials).mockReset();
    vi.mocked(addByRssRepository.listFeedsByCredentials).mockResolvedValue({
      needsCredentials: [],
      ready: [],
    });
    vi.mocked(subscriptionsRepository.list).mockReset();
    vi.mocked(subscriptionsRepository.hasPopularityRanks).mockReset();
    vi.mocked(subscriptionsRepository.refreshPopularityRanks).mockReset();
    vi.mocked(channelItemsRepository.listSubscribed).mockReset();
    vi.mocked(channelItemsRepository.hasPopularityRanks).mockReset();
    vi.mocked(channelItemsRepository.refreshPopularityRanks).mockReset();
    vi.mocked(channelLiveStatusRepository.listBroadcastingKeys).mockReset();
    vi.mocked(channelSeenRepository.listUnseen).mockReset();
    vi.mocked(downloadsRepository.countCompletedByChannel).mockReset();
    vi.mocked(homeClipsCacheRepository.listPayload).mockReset();
    vi.mocked(homeClipsCacheRepository.readSnapshot).mockReset();
    vi.mocked(syncEventLogRepository.append).mockReset();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('paints podcasts from the follow list and never asks the directory for ranks', async () => {
    vi.mocked(subscriptionsRepository.list).mockResolvedValue([followedShow()]);
    vi.mocked(channelLiveStatusRepository.listBroadcastingKeys).mockResolvedValue(new Set());
    vi.mocked(downloadsRepository.countCompletedByChannel).mockResolvedValue(new Map());
    vi.mocked(channelSeenRepository.listUnseen).mockResolvedValue([]);

    const read = await fetchHomeFeed('podcasts', { sort: 'popularity' });

    expect(read.rows).toEqual([
      expect.objectContaining({
        id: 'show-1',
        title: 'Example Show',
      }),
    ]);
    expect(subscriptionsRepository.hasPopularityRanks).not.toHaveBeenCalled();
    expect(subscriptionsRepository.refreshPopularityRanks).not.toHaveBeenCalled();
  });

  it('returns stored episodes and does not fall back to the subscribed items API', async () => {
    vi.mocked(subscriptionsRepository.list).mockResolvedValue([followedShow()]);
    vi.mocked(channelItemsRepository.listSubscribed).mockResolvedValue([]);

    const read = await fetchHomeFeed('episodes');

    expect(read.rows).toEqual([]);
    expect(channelItemsRepository.hasPopularityRanks).not.toHaveBeenCalled();
    expect(channelItemsRepository.refreshPopularityRanks).not.toHaveBeenCalled();
  });

  it('reads clips from the local snapshot only', async () => {
    vi.mocked(homeClipsCacheRepository.readSnapshot).mockResolvedValue({
      items: [{ id_text: 'clip-1', title: 'A clip', podcast_title: 'Example Show' }],
      window: null,
    });

    const read = await fetchHomeFeed('clips');

    expect(read.rows).toEqual([
      expect.objectContaining({
        id: 'clip-1',
        subtitle: 'Example Show',
        title: 'A clip',
      }),
    ]);
    expect(read.hasMore).toBe(false);
  });

  it.each(['recent', 'popularity'] as const)(
    'offers the next stored clip page under the %s sort',
    async (sort) => {
      vi.mocked(homeClipsCacheRepository.readSnapshot).mockResolvedValue({
        items: [{ id_text: 'clip-1', title: 'A clip', podcast_title: 'Example Show' }],
        window: {
          hasMore: true,
          pageCount: 1,
          range: 'week',
          sort: sort === 'popularity' ? 'top' : 'recent',
        },
      });

      const read = await fetchHomeFeed('clips', { sort });

      expect(read.hasMore).toBe(true);
    }
  );

  it('keeps clips in the stored order even when the carried sort is A-Z', async () => {
    vi.mocked(homeClipsCacheRepository.readSnapshot).mockResolvedValue({
      items: [
        { id_text: 'clip-z', title: 'Zebra clip', podcast_title: 'Show' },
        { id_text: 'clip-a', title: 'Apple clip', podcast_title: 'Show' },
      ],
      window: null,
    });

    const read = await fetchHomeFeed('clips', { sort: 'alphabetical' });

    expect(read.rows.map((row) => row.id)).toEqual(['clip-z', 'clip-a']);
  });

  it('paints follow titles when badge queries hang and records home_feed_metadata_timeout', async () => {
    vi.useFakeTimers();
    vi.mocked(subscriptionsRepository.list).mockResolvedValue([followedShow()]);
    vi.mocked(channelLiveStatusRepository.listBroadcastingKeys).mockResolvedValue(new Set());
    vi.mocked(downloadsRepository.countCompletedByChannel).mockResolvedValue(new Map());
    vi.mocked(channelSeenRepository.listUnseen).mockReturnValue(new Promise(() => undefined));

    const pending = fetchHomeFeed('podcasts');
    await vi.advanceTimersByTimeAsync(HOME_FEED_METADATA_TIMEOUT_MS);
    const read = await pending;

    expect(read.rows).toEqual([
      expect.objectContaining({
        id: 'show-1',
        title: 'Example Show',
      }),
    ]);

    expect(syncEventLogRepository.append).toHaveBeenCalledWith(
      expect.objectContaining({
        errorCode: HOME_FEED_METADATA_TIMEOUT_CODE,
        jobKind: 'home-feed-read',
        outcome: 'failure',
      })
    );
  });
});
