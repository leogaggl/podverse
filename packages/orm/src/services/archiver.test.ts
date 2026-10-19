import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  clipFindOneMock,
  feedCreateQueryBuilderMock,
  feedQbGetManyMock,
  feedReadFindMock,
  feedSaveMock,
  feedQueryMock,
  feedServiceSetLifecycleMock,
  feedServiceUpdateMock,
  itemDeleteMock,
  itemFlagStatusGetMock,
  itemQueryMock,
  itemReadFindMock,
  itemSaveMock,
  playlistFindOneMock,
  pruneQueueResourcesMock,
} = vi.hoisted(() => {
  const feedQbGetManyMock = vi.fn();
  const makeFeedQueryBuilder = () => {
    const qb = {
      distinct: vi.fn(() => qb),
      innerJoinAndSelect: vi.fn(() => qb),
      innerJoin: vi.fn(() => qb),
      where: vi.fn(() => qb),
      andWhere: vi.fn(() => qb),
      getMany: feedQbGetManyMock,
    };
    return qb;
  };

  return {
    clipFindOneMock: vi.fn(),
    feedCreateQueryBuilderMock: vi.fn(makeFeedQueryBuilder),
    feedQbGetManyMock,
    feedReadFindMock: vi.fn(),
    feedSaveMock: vi.fn(),
    feedQueryMock: vi.fn(),
    feedServiceSetLifecycleMock: vi.fn(() => Promise.resolve()),
    feedServiceUpdateMock: vi.fn(() => Promise.resolve()),
    itemDeleteMock: vi.fn(),
    itemFlagStatusGetMock: vi.fn(),
    itemQueryMock: vi.fn(),
    itemReadFindMock: vi.fn(),
    itemSaveMock: vi.fn(),
    playlistFindOneMock: vi.fn(),
    pruneQueueResourcesMock: vi.fn(),
  };
});

const { ClipEntity, FeedEntity, ItemEntity, PlaylistResourceEntity } = vi.hoisted(() => ({
  ClipEntity: class Clip {},
  FeedEntity: class Feed {},
  ItemEntity: class Item {},
  PlaylistResourceEntity: class PlaylistResource {},
}));

vi.mock('@orm/db/index.js', () => ({
  AppDataSourceRead: {
    getRepository: (entity: unknown) => {
      if (entity === ItemEntity) {
        return { find: itemReadFindMock };
      }
      if (entity === FeedEntity) {
        return { createQueryBuilder: feedCreateQueryBuilderMock, find: feedReadFindMock };
      }
      if (entity === PlaylistResourceEntity) {
        return { findOne: playlistFindOneMock };
      }
      if (entity === ClipEntity) {
        return { findOne: clipFindOneMock };
      }
      return {};
    },
  },
  AppDataSourceReadWrite: {
    getRepository: (entity: unknown) => {
      if (entity === ItemEntity) {
        return { delete: itemDeleteMock, query: itemQueryMock, save: itemSaveMock };
      }
      if (entity === FeedEntity) {
        return { query: feedQueryMock, save: feedSaveMock };
      }
      return {};
    },
  },
}));

vi.mock('@orm/entities/clip.js', () => ({ Clip: ClipEntity }));
vi.mock('@orm/entities/feed/feed.js', () => ({ Feed: FeedEntity }));
vi.mock('@orm/entities/item/item.js', () => ({ Item: ItemEntity }));
vi.mock('@orm/entities/playlist/playlistResource.js', () => ({
  PlaylistResource: PlaylistResourceEntity,
}));

vi.mock('@orm/entities/item/itemFlagStatus.js', () => ({
  ItemFlagStatusStatusEnum: {
    Active: 1,
    PendingArchive: 2,
    Archived: 3,
    PendingDelete: 4,
  },
}));

vi.mock('./item/itemFlagStatus.js', () => ({
  ItemFlagStatusService: class ItemFlagStatusService {
    get = itemFlagStatusGetMock;
  },
}));

vi.mock('./queue/queueResourceActiveItemFilter.js', () => ({
  pruneNonActiveItemBackedQueueResourceRows: pruneQueueResourcesMock,
}));

const { slimArchivedItemsMock, slimArchivedChannelsMock } = vi.hoisted(() => ({
  slimArchivedItemsMock: vi.fn(async () => ({ slimmed: 0 })),
  slimArchivedChannelsMock: vi.fn(async () => ({ slimmed: 0 })),
}));

vi.mock('./archivedSlimming.js', () => ({
  slimArchivedItems: slimArchivedItemsMock,
  slimArchivedChannels: slimArchivedChannelsMock,
}));

vi.mock('@orm/factories/loggerService.js', () => ({
  loggerService: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

vi.mock('./feed/feed.js', () => ({
  FeedService: class FeedService {
    setFeedLifecycleState = feedServiceSetLifecycleMock;
    update = feedServiceUpdateMock;
  },
}));

import { FeedLifecycleStateKeyEnum } from '@orm/entities/feed/feedLifecycleStateType.js';
import { ItemFlagStatusStatusEnum } from '@orm/entities/item/itemFlagStatus.js';

import {
  ArchiverService,
  CHANNEL_DETAIL_DELETE_QUERIES,
  CHANNEL_IDENTITY_DELETE_QUERIES,
  FEED_RELATIONS_PENDING_OR_SPAM,
} from './archiver.js';

function resetSlimMocks(): void {
  slimArchivedItemsMock.mockReset();
  slimArchivedItemsMock.mockResolvedValue({ slimmed: 0 });
  slimArchivedChannelsMock.mockReset();
  slimArchivedChannelsMock.mockResolvedValue({ slimmed: 0 });
}

describe('ArchiverService takedown hard-delete handling', () => {
  beforeEach(() => {
    clipFindOneMock.mockReset();
    feedCreateQueryBuilderMock.mockClear();
    feedQbGetManyMock.mockReset();
    feedReadFindMock.mockReset();
    feedSaveMock.mockReset();
    feedQueryMock.mockReset();
    feedServiceSetLifecycleMock.mockReset();
    feedServiceUpdateMock.mockReset();
    itemDeleteMock.mockReset();
    itemFlagStatusGetMock.mockReset();
    itemQueryMock.mockReset();
    itemReadFindMock.mockReset();
    itemSaveMock.mockReset();
    playlistFindOneMock.mockReset();
    pruneQueueResourcesMock.mockReset();
    resetSlimMocks();
  });

  it('deletes channel_trailer before channel_season', () => {
    const trailer = CHANNEL_DETAIL_DELETE_QUERIES.findIndex(
      (query) => query.table === 'channel_trailer'
    );
    const season = CHANNEL_DETAIL_DELETE_QUERIES.findIndex(
      (query) => query.table === 'channel_season'
    );
    expect(trailer).toBeGreaterThanOrEqual(0);
    expect(season).toBeGreaterThan(trailer);
  });

  it('queries only Takedown feeds for hard-delete processing', async () => {
    feedReadFindMock.mockResolvedValue([]);

    const service = new ArchiverService();
    await service.getFeedsWithTakedownStatus();

    expect(feedReadFindMock).toHaveBeenCalledTimes(1);
    expect(feedReadFindMock).toHaveBeenCalledWith({
      where: {
        feed_lifecycle_state: {
          feed_lifecycle_state_type: {
            state_key: FeedLifecycleStateKeyEnum.Takedown,
          },
        },
      },
      relations: FEED_RELATIONS_PENDING_OR_SPAM,
    });
  });

  it('hard-deletes all item rows for Takedown feeds', async () => {
    feedReadFindMock.mockResolvedValue([
      { id: 10, channel: { id: 1001, items: [{ id: 101 }, { id: 102 }] } },
      { id: 20, channel: { id: 1002, items: [{ id: 201 }] } },
    ]);

    const service = new ArchiverService();
    await service.removeAllItemsForTakedownFeeds();

    expect(itemDeleteMock).toHaveBeenCalledTimes(2);
    expect(itemDeleteMock).toHaveBeenNthCalledWith(1, [101, 102]);
    expect(itemDeleteMock).toHaveBeenNthCalledWith(2, [201]);
    expect(feedSaveMock).not.toHaveBeenCalled();
    expect(feedQueryMock).toHaveBeenCalledTimes(44);
  });

  it('skips delete when feed channel is missing or has no items', async () => {
    feedReadFindMock.mockResolvedValue([
      { id: 10, channel: null },
      { id: 11, channel: { id: 1003, items: [] } },
      { id: 12, channel: { id: 1004, items: undefined } },
    ]);

    const service = new ArchiverService();
    await service.removeAllItemsForTakedownFeeds();

    expect(itemDeleteMock).not.toHaveBeenCalled();
    expect(feedSaveMock).not.toHaveBeenCalled();
    expect(feedQueryMock).toHaveBeenCalledTimes(44);
    expect(feedQueryMock).toHaveBeenNthCalledWith(
      1,
      expect.stringContaining('DELETE FROM channel_value_recipient'),
      [1003]
    );
    expect(feedQueryMock).toHaveBeenNthCalledWith(
      23,
      expect.stringContaining('DELETE FROM channel_value_recipient'),
      [1004]
    );
  });

  it('runs detail cleanup and then identity cleanup for a takedown channel', async () => {
    feedReadFindMock.mockResolvedValue([{ id: 10, channel: { id: 1001, items: [] } }]);

    const service = new ArchiverService();
    await service.removeAllItemsForTakedownFeeds();

    const sqls = feedQueryMock.mock.calls.map((call) => call[0]);
    expect(sqls).toEqual([
      ...CHANNEL_DETAIL_DELETE_QUERIES.map((query) => query.sql),
      ...CHANNEL_IDENTITY_DELETE_QUERIES.map((query) => query.sql),
    ]);
  });
});

describe('ArchiverService deleteArchivedItemsWithoutClipOrPlaylist', () => {
  beforeEach(() => {
    clipFindOneMock.mockReset();
    feedCreateQueryBuilderMock.mockClear();
    feedQbGetManyMock.mockReset();
    feedReadFindMock.mockReset();
    feedSaveMock.mockReset();
    feedQueryMock.mockReset();
    feedServiceSetLifecycleMock.mockReset();
    feedServiceUpdateMock.mockReset();
    itemDeleteMock.mockReset();
    itemFlagStatusGetMock.mockReset();
    itemQueryMock.mockReset();
    itemReadFindMock.mockReset();
    itemSaveMock.mockReset();
    playlistFindOneMock.mockReset();
    pruneQueueResourcesMock.mockReset();
    resetSlimMocks();
  });

  it('does nothing when no archived orphan rows match', async () => {
    itemQueryMock.mockResolvedValueOnce([]);

    const service = new ArchiverService();
    await service.deleteArchivedItemsWithoutClipOrPlaylist();

    expect(itemQueryMock).toHaveBeenCalledTimes(1);
    expect(itemQueryMock).toHaveBeenCalledWith(
      expect.stringContaining('SELECT i.id AS id FROM item i'),
      [ItemFlagStatusStatusEnum.Archived, 1000]
    );
    expect(itemDeleteMock).not.toHaveBeenCalled();
  });

  it('hard-deletes archived items returned by the orphan query', async () => {
    itemQueryMock.mockResolvedValueOnce([{ id: 501 }, { id: 502 }]);

    const service = new ArchiverService();
    await service.deleteArchivedItemsWithoutClipOrPlaylist();

    expect(itemDeleteMock).toHaveBeenCalledTimes(1);
    expect(itemDeleteMock).toHaveBeenCalledWith([501, 502]);
    expect(itemQueryMock).toHaveBeenCalledTimes(1);
  });

  it('runs another batch when the first batch is full', async () => {
    const firstBatch = Array.from({ length: 1000 }, (_, index) => ({ id: index + 1 }));
    const secondBatch = Array.from({ length: 1000 }, (_, index) => ({ id: index + 10001 }));
    itemQueryMock
      .mockResolvedValueOnce(firstBatch)
      .mockResolvedValueOnce(secondBatch)
      .mockResolvedValueOnce([]);

    const service = new ArchiverService();
    await service.deleteArchivedItemsWithoutClipOrPlaylist();

    expect(itemDeleteMock).toHaveBeenCalledTimes(2);
    expect(itemDeleteMock).toHaveBeenNthCalledWith(
      1,
      firstBatch.map((row) => row.id)
    );
    expect(itemDeleteMock).toHaveBeenNthCalledWith(
      2,
      secondBatch.map((row) => row.id)
    );
    expect(itemQueryMock).toHaveBeenCalledTimes(3);
  });
});

describe('ArchiverService spam feed item cleanup', () => {
  beforeEach(() => {
    clipFindOneMock.mockReset();
    feedCreateQueryBuilderMock.mockClear();
    feedQbGetManyMock.mockReset();
    feedQbGetManyMock.mockResolvedValue([]);
    feedReadFindMock.mockReset();
    feedSaveMock.mockReset();
    feedQueryMock.mockReset();
    feedServiceSetLifecycleMock.mockReset();
    feedServiceUpdateMock.mockReset();
    itemDeleteMock.mockReset();
    itemFlagStatusGetMock.mockReset();
    itemFlagStatusGetMock.mockResolvedValue({ id: ItemFlagStatusStatusEnum.Archived });
    itemQueryMock.mockReset();
    itemReadFindMock.mockReset();
    itemSaveMock.mockReset();
    playlistFindOneMock.mockReset();
    pruneQueueResourcesMock.mockReset();
    resetSlimMocks();
  });

  it('runs processSpamFeeds after processPendingArchiveFeeds in archiveAll', async () => {
    const order: string[] = [];
    const service = new ArchiverService();
    vi.spyOn(service, 'processPendingArchiveFeeds').mockImplementation(async () => {
      order.push('pendingArchiveFeeds');
    });
    vi.spyOn(service, 'processSpamFeeds').mockImplementation(async () => {
      order.push('spamFeeds');
    });
    vi.spyOn(service, 'processPendingArchiveItems').mockImplementation(async () => {
      order.push('pendingArchiveItems');
    });
    vi.spyOn(service, 'deleteArchivedItemsWithoutClipOrPlaylist').mockImplementation(async () => {
      order.push('deleteArchivedOrphans');
    });
    slimArchivedItemsMock.mockImplementation(async () => {
      order.push('slimItems');
      return { slimmed: 3 };
    });
    slimArchivedChannelsMock.mockImplementation(async () => {
      order.push('slimChannels');
      return { slimmed: 1 };
    });
    vi.spyOn(service, 'removeAllItemsForTakedownFeeds').mockImplementation(async () => {
      order.push('takedown');
    });
    await service.archiveAll();
    expect(order).toEqual([
      'pendingArchiveFeeds',
      'spamFeeds',
      'pendingArchiveItems',
      'deleteArchivedOrphans',
      'slimItems',
      'slimChannels',
      'takedown',
    ]);
    expect(pruneQueueResourcesMock).toHaveBeenCalledTimes(1);
  });

  it('processSpamFeeds does not load channel items when no spam feeds need cleanup', async () => {
    const service = new ArchiverService();
    await service.processSpamFeeds();
    expect(feedCreateQueryBuilderMock).toHaveBeenCalledWith('feed');
    expect(itemReadFindMock).not.toHaveBeenCalled();
    expect(feedSaveMock).not.toHaveBeenCalled();
  });

  it('processSpamFeeds hard-deletes Active items without clip or playlist and does not save feed', async () => {
    feedQbGetManyMock.mockResolvedValue([{ id: 42, channel: { id: 900 } }]);
    itemReadFindMock.mockResolvedValue([
      { id: 7001, item_flag_status: { id: ItemFlagStatusStatusEnum.Active } },
    ]);
    playlistFindOneMock.mockResolvedValue(null);
    clipFindOneMock.mockResolvedValue(null);
    const service = new ArchiverService();
    await service.processSpamFeeds();
    expect(itemDeleteMock).toHaveBeenCalledWith(7001);
    expect(itemSaveMock).not.toHaveBeenCalled();
    expect(feedSaveMock).not.toHaveBeenCalled();
  });

  it('processSpamFeeds sets Active items to Archived when a clip exists', async () => {
    feedQbGetManyMock.mockResolvedValue([{ id: 42, channel: { id: 900 } }]);
    itemReadFindMock.mockResolvedValue([
      { id: 7001, item_flag_status: { id: ItemFlagStatusStatusEnum.Active } },
    ]);
    playlistFindOneMock.mockResolvedValue(null);
    clipFindOneMock.mockResolvedValue({ id: 1 });
    const archived = { id: ItemFlagStatusStatusEnum.Archived };
    itemFlagStatusGetMock.mockResolvedValue(archived);
    const service = new ArchiverService();
    await service.processSpamFeeds();
    expect(itemSaveMock).toHaveBeenCalledTimes(1);
    expect(itemSaveMock).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 7001,
        item_flag_status: archived,
      })
    );
    expect(itemDeleteMock).not.toHaveBeenCalled();
    expect(feedSaveMock).not.toHaveBeenCalled();
  });
});
