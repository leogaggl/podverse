import type { Channel, ChannelService } from '@podverse/orm';

/**
 * Records that this channel's feed carries live items. Writes only when the flag is still false;
 * the flag is never cleared.
 */
export const markChannelMayHaveLiveItems = async (
  channel: Pick<Channel, 'id' | 'may_have_live_items' | 'medium_id'>,
  parsedLiveItemCount: number,
  channelService: Pick<ChannelService, 'update'>
): Promise<boolean> => {
  if (parsedLiveItemCount === 0 || channel.may_have_live_items) {
    return false;
  }
  await channelService.update(channel.id, {
    may_have_live_items: true,
    medium_id: channel.medium_id,
  });
  return true;
};
