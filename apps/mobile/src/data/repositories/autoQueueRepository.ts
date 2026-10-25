import type {
  DTOItemQueueItem,
  DTOPlaylistResource,
  PlaylistResourceIdTextOptions,
} from '@podverse/helpers/dto';
import type {
  AutoQueueDirection,
  AutoQueueSourceFetchers,
} from '@podverse/playback-core/autoQueueWalk';

// Import from the request module (not the auth barrel) to keep the React AuthProvider out of the
// data-layer module graph.
import { requestWithMobileAuthRefresh } from '../../auth/authRequestWithRefresh';
import type { MobileAuthRequestContext } from './types';

/**
 * Auto-queue source fetches (playlist + channel) for the shared `@podverse/playback-core` walk.
 * These are live "up next" fills, so — unlike the manual queue — they are not cached in SQLite;
 * they always hit the server through the shared auth-refresh wrapper. Screens/hooks call these here
 * rather than issuing `req*` directly (mobile-data-layer discipline).
 */
export const autoQueueRepository = {
  getPlaylistResourcesByShuffle: async (
    context: MobileAuthRequestContext,
    playlistIdText: string,
    shuffleHash: string,
    page: number
  ): Promise<DTOPlaylistResource[]> => {
    const response = await requestWithMobileAuthRefresh(context, async (api) =>
      api.reqPlaylistResourceGetManyByShuffle(playlistIdText, shuffleHash, page)
    );
    return response.data;
  },

  getPlaylistResourcesForQueueByListPosition: async (
    context: MobileAuthRequestContext,
    playlistIdText: string,
    idTextOptions: PlaylistResourceIdTextOptions,
    direction: AutoQueueDirection
  ): Promise<DTOPlaylistResource[]> => {
    const response = await requestWithMobileAuthRefresh(context, async (api) =>
      api.reqPlaylistResourceGetManyForQueueByListPosition(playlistIdText, idTextOptions, direction)
    );
    return response.data;
  },

  getPlaylistResourcesByPlaylistIdTextPage1: async (
    context: MobileAuthRequestContext,
    playlistIdText: string
  ): Promise<DTOPlaylistResource[]> => {
    const response = await requestWithMobileAuthRefresh(context, async (api) =>
      api.reqPlaylistResourceGetManyByPlaylistIdText(playlistIdText, { page: 1 })
    );
    return response.data;
  },

  getChannelItemsByShuffle: async (
    context: MobileAuthRequestContext,
    channelIdText: string,
    page: number,
    shuffleHash: string
  ): Promise<DTOItemQueueItem[]> => {
    const response = await requestWithMobileAuthRefresh(context, async (api) =>
      api.reqItemGetManyByChannelShuffle(channelIdText, { page, shuffleHash })
    );
    return response.data;
  },

  getItemsForQueueBySeason: async (
    context: MobileAuthRequestContext,
    itemIdText: string,
    direction: AutoQueueDirection
  ): Promise<DTOItemQueueItem[]> => {
    return requestWithMobileAuthRefresh(context, async (api) =>
      api.reqItemGetManyForQueueBySeason(itemIdText, direction)
    );
  },

  getChannelItemsBySeasonPage1: async (
    context: MobileAuthRequestContext,
    channelIdText: string
  ): Promise<DTOItemQueueItem[]> => {
    const response = await requestWithMobileAuthRefresh(context, async (api) =>
      api.reqItemGetManyByChannelBySeason({
        idOrIdText: channelIdText,
        page: 1,
        range: null,
        sort: 'forward',
      })
    );
    return response.data;
  },

  getItemsForQueueByPubDate: async (
    context: MobileAuthRequestContext,
    itemIdText: string,
    direction: AutoQueueDirection
  ): Promise<DTOItemQueueItem[]> => {
    return requestWithMobileAuthRefresh(context, async (api) =>
      api.reqItemGetManyForQueueByPubDate(itemIdText, direction)
    );
  },

  getChannelItemsRecentPage1: async (
    context: MobileAuthRequestContext,
    channelIdText: string
  ): Promise<DTOItemQueueItem[]> => {
    const response = await requestWithMobileAuthRefresh(context, async (api) =>
      api.reqItemGetManyByChannel({
        idOrIdText: channelIdText,
        page: 1,
        range: null,
        sort: 'recent',
      })
    );
    return response.data;
  },

  /** Binds every source fetch to one auth context for a single fill or walk. */
  createSourceFetchers: (context: MobileAuthRequestContext): AutoQueueSourceFetchers => ({
    fetchChannelItemsByShuffle: (channelIdText, params) =>
      autoQueueRepository.getChannelItemsByShuffle(
        context,
        channelIdText,
        params.page,
        params.shuffleHash
      ),
    fetchChannelItemsBySeasonFirstPage: (channelIdText) =>
      autoQueueRepository.getChannelItemsBySeasonPage1(context, channelIdText),
    fetchChannelItemsRecentFirstPage: (channelIdText) =>
      autoQueueRepository.getChannelItemsRecentPage1(context, channelIdText),
    fetchItemsByPubDate: (itemIdText, direction) =>
      autoQueueRepository.getItemsForQueueByPubDate(context, itemIdText, direction),
    fetchItemsBySeason: (itemIdText, direction) =>
      autoQueueRepository.getItemsForQueueBySeason(context, itemIdText, direction),
    fetchPlaylistResourcesByListPosition: (playlistIdText, cursor, direction) =>
      autoQueueRepository.getPlaylistResourcesForQueueByListPosition(
        context,
        playlistIdText,
        cursor,
        direction
      ),
    fetchPlaylistResourcesByShuffle: (playlistIdText, params) =>
      autoQueueRepository.getPlaylistResourcesByShuffle(
        context,
        playlistIdText,
        params.shuffleHash,
        params.page
      ),
    fetchPlaylistResourcesFirstPage: (playlistIdText) =>
      autoQueueRepository.getPlaylistResourcesByPlaylistIdTextPage1(context, playlistIdText),
  }),
};
