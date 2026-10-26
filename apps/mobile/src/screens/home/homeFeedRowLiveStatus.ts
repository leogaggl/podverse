import type { LiveItemStatusEnum } from '@podverse/helpers/dto';

import { liveStatusWordKey } from '../../lib/rows/liveItemRows';

/** The status badge an item row shows in its duration slot. */
export type ItemRowLiveStatus = {
  labelKey: 'media.livestream.ended' | 'media.livestream.live' | 'media.livestream.pending';
  testIDPrefix: 'home-feed-row-live' | 'home-feed-row-live-status';
  tone: 'danger' | 'neutral';
};

/**
 * Which status badge an item row shows, or null for none.
 *
 * Channel rows return null: their Live badge stays on the artwork. A stated Scheduled or Ended
 * status wins over live metadata, so a row shows one badge.
 */
export const resolveItemRowLiveStatus = (
  isChannelList: boolean,
  isLive: boolean,
  liveStatusId: LiveItemStatusEnum | null | undefined
): ItemRowLiveStatus | null => {
  if (isChannelList) {
    return null;
  }
  const wordKey = liveStatusWordKey(liveStatusId);
  if (wordKey !== null) {
    return { labelKey: wordKey, testIDPrefix: 'home-feed-row-live-status', tone: 'neutral' };
  }
  if (isLive) {
    return {
      labelKey: 'media.livestream.live',
      testIDPrefix: 'home-feed-row-live',
      tone: 'danger',
    };
  }
  return null;
};

/**
 * Share is the only More action on a livestream row.
 *
 * The livestreams list already works this way. A livestream inside a podcast or album list
 * carries liveStatusId and uses the episode row, so the same rule follows that field.
 */
export const isShareOnlyLivestreamRow = (
  mediaType: string,
  liveStatusId: LiveItemStatusEnum | null | undefined
): boolean => {
  return mediaType === 'livestreams' || liveStatusId !== undefined;
};
