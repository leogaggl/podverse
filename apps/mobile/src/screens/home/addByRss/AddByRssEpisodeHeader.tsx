import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';

import { itemDetailDateLabel, ItemDetailHeader } from '../../../components/content';
import { useAddByRssArtworkHeaders } from '../../../hooks/useAddByRssArtworkHeaders';
import { formatPlaybackDurationLabel } from '../../../lib/formatPlaybackDurationLabel';
import type { AddByRssHomeEpisode } from '../addByRssHomeDetailData';
import type { QueueActionPosition } from '../useHomeRowPlayback';
import { useAddByRssDetailMoreActions } from './useAddByRssDetailMoreActions';

type AddByRssEpisodeHeaderProps = {
  channelTitle: string;
  episode: AddByRssHomeEpisode;
  feedUrl: string;
  onAddToPlaylistPress: () => void;
  onChannelPress: () => void;
  onMarkAsPlayedPress: () => void;
  onPlayPress: () => void;
  onQueuePress: (position: QueueActionPosition) => void;
};

/**
 * Identity and play bar for one Add by RSS episode.
 *
 * Artwork is the list-row image. The More menu is Queue Next, Queue Last, Add to Playlist,
 * Mark as Played, and Download. Add by RSS pages are not shareable, so Share is not offered.
 */
export function AddByRssEpisodeHeader({
  channelTitle,
  episode,
  feedUrl,
  onAddToPlaylistPress,
  onChannelPress,
  onMarkAsPlayedPress,
  onPlayPress,
  onQueuePress,
}: AddByRssEpisodeHeaderProps) {
  const { t, i18n } = useTranslation();
  const artworkHeaders = useAddByRssArtworkHeaders(feedUrl, episode.imageUrl);

  const dateLabel = useMemo(
    () => itemDetailDateLabel(episode.itemBundle.item.pub_date, i18n.language),
    [episode.itemBundle.item.pub_date, i18n.language]
  );

  const durationLabel =
    episode.duration !== null && episode.duration !== undefined
      ? formatPlaybackDurationLabel(Number(episode.duration), t)
      : null;

  const moreActions = useAddByRssDetailMoreActions({
    downloadItem: episode.downloadItem,
    idSuffix: `-${episode.id}`,
    onAddToPlaylistPress,
    onMarkAsPlayedPress,
    onQueuePress,
  });

  return (
    <ItemDetailHeader
      artworkAddByRssFeedUrl={feedUrl}
      artworkHeaders={artworkHeaders}
      artworkUri={episode.imageUrl}
      channelTitle={channelTitle}
      dateLabel={dateLabel}
      downloadItem={episode.downloadItem}
      durationLabel={durationLabel}
      mediaIdText={episode.id}
      playbackMediaId={episode.playbackMediaId}
      moreActions={moreActions}
      onChannelPress={onChannelPress}
      onPlayPress={onPlayPress}
      testIDPrefix="add-by-rss-episode-detail"
      title={episode.title}
      viewerUri={episode.imageUrl}
    />
  );
}
