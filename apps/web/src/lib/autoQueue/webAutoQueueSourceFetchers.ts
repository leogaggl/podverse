import type { ApiRequestService } from '@podverse/helpers-requests';
import type { AutoQueueSourceFetchers } from '@podverse/playback-core';

type WebAutoQueueRequestClient = Pick<
  ApiRequestService,
  | 'reqPlaylistResourceGetManyForQueueByListPosition'
  | 'reqPlaylistResourceGetManyByShuffle'
  | 'reqPlaylistResourceGetManyByPlaylistIdText'
  | 'reqItemGetManyByChannelShuffle'
  | 'reqItemGetManyForQueueBySeason'
  | 'reqItemGetManyByChannelBySeason'
  | 'reqItemGetManyForQueueByPubDate'
  | 'reqItemGetManyByChannel'
>;

export function createWebAutoQueueSourceFetchers(
  requests: WebAutoQueueRequestClient
): AutoQueueSourceFetchers {
  return {
    fetchPlaylistResourcesByListPosition: async (id, cursor, direction) => {
      const body = await requests.reqPlaylistResourceGetManyForQueueByListPosition(
        id,
        cursor,
        direction
      );
      return body.data;
    },
    fetchPlaylistResourcesByShuffle: async (id, { page, shuffleHash }) => {
      const body = await requests.reqPlaylistResourceGetManyByShuffle(id, shuffleHash, page);
      return body.data;
    },
    fetchPlaylistResourcesFirstPage: async (id) => {
      const body = await requests.reqPlaylistResourceGetManyByPlaylistIdText(id, { page: 1 });
      return body.data;
    },
    fetchChannelItemsByShuffle: async (id, { page, shuffleHash }) => {
      const body = await requests.reqItemGetManyByChannelShuffle(id, { page, shuffleHash });
      return body.data;
    },
    fetchItemsBySeason: async (itemId, direction) => {
      return requests.reqItemGetManyForQueueBySeason(itemId, direction);
    },
    fetchChannelItemsBySeasonFirstPage: async (channelId) => {
      const body = await requests.reqItemGetManyByChannelBySeason({
        idOrIdText: channelId,
        page: 1,
        sort: 'forward',
        range: null,
      });
      return body.data;
    },
    fetchItemsByPubDate: async (itemId, direction) => {
      return requests.reqItemGetManyForQueueByPubDate(itemId, direction);
    },
    fetchChannelItemsRecentFirstPage: async (channelId) => {
      const body = await requests.reqItemGetManyByChannel({
        idOrIdText: channelId,
        page: 1,
        sort: 'recent',
        range: null,
      });
      return body.data;
    },
  };
}
