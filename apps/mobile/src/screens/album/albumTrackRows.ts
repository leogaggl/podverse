import type { DTOItem } from '@podverse/helpers';

import { toChannelLiveRow } from '../../lib/rows/liveItemRows';
import type { HomeFeedRowData } from '../home/homeFeedData';
import { mapItemToHomeFeedRow } from '../home/homeFeedData';

/**
 * Rows for an album's track list.
 *
 * A livestream gets the full item row a podcast's livestream gets, with its date, description,
 * and status, never the compact track row. Ordinary tracks stay compact and carry the album as
 * their channel, so More can open it.
 */
export const toAlbumTrackRows = (
  items: readonly DTOItem[],
  albumId: string,
  albumTitle: string | null
): HomeFeedRowData[] => {
  return items
    .map((item) => {
      if (item.live_item) {
        return toChannelLiveRow(
          mapItemToHomeFeedRow(item),
          item.live_item.live_item_status_id,
          item.live_item.start_time
        );
      }
      const compact = mapItemToHomeFeedRow(item, { compact: true });
      return {
        ...compact,
        channelId: compact.channelId ?? albumId,
        channelKind: compact.channelKind ?? 'albums',
        subtitle: albumTitle,
      };
    })
    .filter((row) => row.id.length > 0);
};

/** True for a row `toAlbumTrackRows` built from a livestream. */
export const isAlbumLivestreamRow = (row: HomeFeedRowData): boolean => {
  return row.liveStatusId !== undefined;
};
