import { describe, expect, it } from 'vitest';

import type { DTOItem, DTOItemQueueItem, DTOPlaylistResource } from '@podverse/helpers';
import type { ApiListResponse } from '@podverse/helpers-requests';

import { createWebAutoQueueSourceFetchers } from './webAutoQueueSourceFetchers';

/** Row fixtures only need a stable identity. The adapter forwards the arrays unchanged. */
function row<T extends { id: number }>(id: number): T {
  return { id } as T;
}

function listBody<T>(rows: T[]): ApiListResponse<T> {
  return {
    data: rows,
    meta: {
      page: 1,
      count: rows.length,
      limit: rows.length,
    },
  };
}

type RecordedCall = {
  method: string;
  args: unknown[];
};

describe('createWebAutoQueueSourceFetchers', () => {
  it('forwards each source request and returns its row array', async () => {
    const calls: RecordedCall[] = [];
    const playlistListRows = [row<DTOPlaylistResource>(1)];
    const playlistShuffleRows = [row<DTOPlaylistResource>(2)];
    const playlistFirstRows = [row<DTOPlaylistResource>(3)];
    const channelShuffleRows = [row<DTOItem>(4)];
    const seasonQueueRows = [row<DTOItemQueueItem>(5)];
    const seasonFirstRows = [row<DTOItem>(6)];
    const pubDateQueueRows = [row<DTOItemQueueItem>(7)];
    const recentRows = [row<DTOItem>(8)];
    const cursor = {
      item_id_text: 'item-1',
      clip_id_text: 'clip-1',
      item_soundbite_id_text: 'soundbite-1',
    };

    const fetchers = createWebAutoQueueSourceFetchers({
      reqPlaylistResourceGetManyForQueueByListPosition: (id, listCursor, direction) => {
        calls.push({
          method: 'reqPlaylistResourceGetManyForQueueByListPosition',
          args: [id, listCursor, direction],
        });
        return Promise.resolve(listBody(playlistListRows));
      },
      reqPlaylistResourceGetManyByShuffle: (id, shuffleHash, page) => {
        calls.push({
          method: 'reqPlaylistResourceGetManyByShuffle',
          args: [id, shuffleHash, page],
        });
        return Promise.resolve(listBody(playlistShuffleRows));
      },
      reqPlaylistResourceGetManyByPlaylistIdText: (id, params) => {
        calls.push({
          method: 'reqPlaylistResourceGetManyByPlaylistIdText',
          args: [id, params],
        });
        return Promise.resolve(listBody(playlistFirstRows));
      },
      reqItemGetManyByChannelShuffle: (id, params) => {
        calls.push({
          method: 'reqItemGetManyByChannelShuffle',
          args: [id, params],
        });
        return Promise.resolve(listBody(channelShuffleRows));
      },
      reqItemGetManyForQueueBySeason: (itemId, direction) => {
        calls.push({
          method: 'reqItemGetManyForQueueBySeason',
          args: [itemId, direction],
        });
        return Promise.resolve(seasonQueueRows);
      },
      reqItemGetManyByChannelBySeason: (params) => {
        calls.push({
          method: 'reqItemGetManyByChannelBySeason',
          args: [params],
        });
        return Promise.resolve(listBody(seasonFirstRows));
      },
      reqItemGetManyForQueueByPubDate: (itemId, direction) => {
        calls.push({
          method: 'reqItemGetManyForQueueByPubDate',
          args: [itemId, direction],
        });
        return Promise.resolve(pubDateQueueRows);
      },
      reqItemGetManyByChannel: (params) => {
        calls.push({
          method: 'reqItemGetManyByChannel',
          args: [params],
        });
        return Promise.resolve(listBody(recentRows));
      },
    });

    await expect(
      fetchers.fetchPlaylistResourcesByListPosition('playlist-1', cursor, 'forward')
    ).resolves.toBe(playlistListRows);
    await expect(
      fetchers.fetchPlaylistResourcesByListPosition('playlist-1', cursor, 'backward')
    ).resolves.toBe(playlistListRows);
    await expect(
      fetchers.fetchPlaylistResourcesByShuffle('playlist-2', { page: 3, shuffleHash: 'hash-a' })
    ).resolves.toBe(playlistShuffleRows);
    await expect(fetchers.fetchPlaylistResourcesFirstPage('playlist-3')).resolves.toBe(
      playlistFirstRows
    );
    await expect(
      fetchers.fetchChannelItemsByShuffle('channel-1', { page: 4, shuffleHash: 'hash-b' })
    ).resolves.toBe(channelShuffleRows);
    await expect(fetchers.fetchItemsBySeason('item-1', 'forward')).resolves.toBe(seasonQueueRows);
    await expect(fetchers.fetchItemsBySeason('item-1', 'backward')).resolves.toBe(seasonQueueRows);
    await expect(fetchers.fetchChannelItemsBySeasonFirstPage('channel-2')).resolves.toBe(
      seasonFirstRows
    );
    await expect(fetchers.fetchItemsByPubDate('item-2', 'forward')).resolves.toBe(pubDateQueueRows);
    await expect(fetchers.fetchItemsByPubDate('item-2', 'backward')).resolves.toBe(
      pubDateQueueRows
    );
    await expect(fetchers.fetchChannelItemsRecentFirstPage('channel-3')).resolves.toBe(recentRows);

    expect(calls).toEqual([
      {
        method: 'reqPlaylistResourceGetManyForQueueByListPosition',
        args: ['playlist-1', cursor, 'forward'],
      },
      {
        method: 'reqPlaylistResourceGetManyForQueueByListPosition',
        args: ['playlist-1', cursor, 'backward'],
      },
      {
        method: 'reqPlaylistResourceGetManyByShuffle',
        args: ['playlist-2', 'hash-a', 3],
      },
      {
        method: 'reqPlaylistResourceGetManyByPlaylistIdText',
        args: ['playlist-3', { page: 1 }],
      },
      {
        method: 'reqItemGetManyByChannelShuffle',
        args: ['channel-1', { page: 4, shuffleHash: 'hash-b' }],
      },
      {
        method: 'reqItemGetManyForQueueBySeason',
        args: ['item-1', 'forward'],
      },
      {
        method: 'reqItemGetManyForQueueBySeason',
        args: ['item-1', 'backward'],
      },
      {
        method: 'reqItemGetManyByChannelBySeason',
        args: [{ idOrIdText: 'channel-2', page: 1, sort: 'forward', range: null }],
      },
      {
        method: 'reqItemGetManyForQueueByPubDate',
        args: ['item-2', 'forward'],
      },
      {
        method: 'reqItemGetManyForQueueByPubDate',
        args: ['item-2', 'backward'],
      },
      {
        method: 'reqItemGetManyByChannel',
        args: [{ idOrIdText: 'channel-3', page: 1, sort: 'recent', range: null }],
      },
    ]);
  });
});
