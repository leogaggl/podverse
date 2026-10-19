export const CHANNEL_GONE_ARCHIVED_MESSAGE = 'Show is no longer in the directory';

export type DTOChannelGone = {
  message: string;
  gone: {
    reason: 'archived';
    add_by_rss_feed_url: string | null;
  };
};
