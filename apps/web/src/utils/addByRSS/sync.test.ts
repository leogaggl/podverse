import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  bulkRemoveAddByRSSFeedsMock,
  clearAddByRSSItemsIndexMock,
  emitAddByRSSFeedChangedMock,
  getAllAddByRSSFeedsMock,
  getFollowedAddByRSSChannelsMock,
  insertMissingAddByRSSFeedsMock,
  patchAddByRSSFollowMetadataMock,
  pruneAddByRSSPublisherDataMock,
} = vi.hoisted(() => ({
  bulkRemoveAddByRSSFeedsMock: vi.fn(),
  clearAddByRSSItemsIndexMock: vi.fn(),
  emitAddByRSSFeedChangedMock: vi.fn(),
  getAllAddByRSSFeedsMock: vi.fn(),
  getFollowedAddByRSSChannelsMock: vi.fn(),
  insertMissingAddByRSSFeedsMock: vi.fn(),
  patchAddByRSSFollowMetadataMock: vi.fn(),
  pruneAddByRSSPublisherDataMock: vi.fn(),
}));

vi.mock('./api', () => ({
  getFollowedAddByRSSChannels: getFollowedAddByRSSChannelsMock,
}));
vi.mock('./storage', () => ({
  bulkRemoveAddByRSSFeeds: bulkRemoveAddByRSSFeedsMock,
  clearAddByRSSItemsIndex: clearAddByRSSItemsIndexMock,
  getAllAddByRSSFeeds: getAllAddByRSSFeedsMock,
  insertMissingAddByRSSFeeds: insertMissingAddByRSSFeedsMock,
  patchAddByRSSFollowMetadata: patchAddByRSSFollowMetadataMock,
}));
vi.mock('./feedChangedEvent', () => ({
  emitAddByRSSFeedChanged: emitAddByRSSFeedChangedMock,
}));
vi.mock('./listedFeeds', () => ({
  pruneAddByRSSPublisherData: pruneAddByRSSPublisherDataMock,
}));

import type { DTOAccountFollowingAddByRSSChannel } from '@podverse/helpers';

import { syncAddByRSSFollowStubs } from './sync';
import type { AddByRSSFeedRecord } from './types';

const ACCOUNT_ID = 'account-1';
const FEED_URL = 'https://a.example/feed.xml';

const follow = (
  overrides: Partial<DTOAccountFollowingAddByRSSChannel> = {}
): DTOAccountFollowingAddByRSSChannel => ({
  account_id: 1,
  feed_url: FEED_URL,
  title: 'A',
  image_url: null,
  requires_credentials: false,
  ...overrides,
});

const storedFeed = (feedUrl: string, idText: string): AddByRSSFeedRecord => ({
  id: 1,
  idText,
  resourceType: 'podcasts',
  feedUrl,
  title: 'Stored',
  imageUrl: null,
  updatedAt: '2026-01-01T00:00:00.000Z',
});

describe('syncAddByRSSFollowStubs', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getFollowedAddByRSSChannelsMock.mockResolvedValue([]);
    getAllAddByRSSFeedsMock.mockResolvedValue([]);
    bulkRemoveAddByRSSFeedsMock.mockResolvedValue(undefined);
    clearAddByRSSItemsIndexMock.mockResolvedValue(undefined);
    patchAddByRSSFollowMetadataMock.mockResolvedValue([]);
    insertMissingAddByRSSFeedsMock.mockResolvedValue(undefined);
    pruneAddByRSSPublisherDataMock.mockResolvedValue([]);
  });

  it('stores one stub when the account follows a feed this browser has not stored', async () => {
    getFollowedAddByRSSChannelsMock.mockResolvedValue([follow()]);

    await syncAddByRSSFollowStubs(ACCOUNT_ID);

    expect(insertMissingAddByRSSFeedsMock).toHaveBeenCalledTimes(1);
    expect(insertMissingAddByRSSFeedsMock).toHaveBeenCalledWith([
      expect.objectContaining({
        feedUrl: FEED_URL,
        title: 'A',
        resourceType: 'podcasts',
        requiresCredentials: false,
      }),
    ]);
    expect(patchAddByRSSFollowMetadataMock).toHaveBeenCalledWith([]);
    expect(pruneAddByRSSPublisherDataMock).not.toHaveBeenCalled();
  });

  it('patches a stored feed for that URL and inserts nothing', async () => {
    getFollowedAddByRSSChannelsMock.mockResolvedValue([follow()]);
    getAllAddByRSSFeedsMock.mockResolvedValue([storedFeed(FEED_URL, 'stored-a')]);

    await syncAddByRSSFollowStubs(ACCOUNT_ID);

    expect(insertMissingAddByRSSFeedsMock).toHaveBeenCalledWith([]);
    expect(patchAddByRSSFollowMetadataMock).toHaveBeenCalledWith([
      {
        feedUrl: FEED_URL,
        title: 'A',
        imageUrl: null,
        requiresCredentials: false,
      },
    ]);
  });

  it('removes a stored feed the account no longer follows, clears the items index, and prunes artist albums', async () => {
    getAllAddByRSSFeedsMock.mockResolvedValue([
      storedFeed('https://gone.example/feed.xml', 'gone-feed'),
    ]);

    await syncAddByRSSFollowStubs(ACCOUNT_ID);

    expect(bulkRemoveAddByRSSFeedsMock).toHaveBeenCalledWith(['gone-feed']);
    expect(clearAddByRSSItemsIndexMock).toHaveBeenCalled();
    expect(pruneAddByRSSPublisherDataMock).toHaveBeenCalledTimes(1);
  });
});
