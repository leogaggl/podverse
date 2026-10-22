import type { ChannelUnseenBadge, DTOChannel } from '@podverse/helpers';
import { buildDTOChannelImageLoadCandidates } from '@podverse/helpers';

import type { AlbumListItem } from '../../components/Common/Artist/Album/types';
import type { ArtistListItem } from '../../components/Common/Artist/types';
import type { PodcastListItem } from '../../components/Common/Podcast/types';
import { IMAGES } from '../../constants/images';
import { ROUTES } from '../../constants/routes';
import type { AddByRSSFeedRecord } from '../addByRSS/types';
import { addByRSSFeedListArtworkCandidates } from '../image/addByRSSFeedListArtworkCandidates';

/** Title a feed row already shows: parsed channel title, then the stored title, then the URL. */
export function addByRSSFeedListTitle(feed: AddByRSSFeedRecord): string {
  return feed.mappedFeed?.channel?.channel?.title ?? feed.title ?? feed.feedUrl;
}

const channelImageCandidates = (channel: DTOChannel): string[] => {
  return buildDTOChannelImageLoadCandidates(
    channel.channel_images,
    IMAGES.LIST.PODCASTS.SIZE_FIND_TARGET,
    'lesser'
  );
};

export function podcastListItemFromChannel(
  channel: DTOChannel,
  unseenBadge: ChannelUnseenBadge | null
): PodcastListItem {
  return {
    id: String(channel.id),
    title: channel.title ?? '',
    imageCandidates: channelImageCandidates(channel),
    href: `${ROUTES.PODCAST}/${channel.id_text}`,
    lastPubDate: channel.channel_about?.last_pub_date ?? null,
    unseenBadge,
  };
}

export function podcastListItemFromAddByRSSFeed(feed: AddByRSSFeedRecord): PodcastListItem {
  const rawLastPubDate = feed.mappedFeed?.channel?.about?.last_pub_date ?? null;
  const lastPubDate =
    rawLastPubDate instanceof Date ? rawLastPubDate.toISOString() : rawLastPubDate;

  return {
    id: feed.idText,
    title: addByRSSFeedListTitle(feed),
    imageCandidates: addByRSSFeedListArtworkCandidates(feed),
    href: `/add-by-rss/podcast/${feed.idText}`,
    lastPubDate,
  };
}

export function artistListItemFromChannel(channel: DTOChannel): ArtistListItem {
  return {
    id: String(channel.id),
    title: channel.title ?? '',
    imageCandidates: channelImageCandidates(channel),
    href: `${ROUTES.ARTIST}/${channel.id_text}`,
    lastPubDate: channel.channel_about?.last_pub_date ?? null,
    showSubtitle: Boolean(channel.channel_about?.last_pub_date),
  };
}

export function artistListItemFromAddByRSSFeed(feed: AddByRSSFeedRecord): ArtistListItem {
  return {
    id: feed.idText,
    title: addByRSSFeedListTitle(feed),
    imageCandidates: addByRSSFeedListArtworkCandidates(feed),
    href: `/add-by-rss/artist/${feed.idText}`,
    subtitle: feed.mappedFeed?.channel?.about?.author ?? null,
  };
}

export function albumListItemFromChannel(channel: DTOChannel): AlbumListItem {
  return {
    id: String(channel.id),
    title: channel.title ?? '',
    imageCandidates: channelImageCandidates(channel),
    href: `${ROUTES.ALBUM}/${channel.id_text}`,
    subtitle: channel.channel_about?.author ?? null,
  };
}

export function albumListItemFromAddByRSSFeed(feed: AddByRSSFeedRecord): AlbumListItem {
  return {
    id: feed.idText,
    title: addByRSSFeedListTitle(feed),
    imageCandidates: addByRSSFeedListArtworkCandidates(feed),
    href: `/add-by-rss/album/${feed.idText}`,
    subtitle: feed.mappedFeed?.channel?.about?.author ?? null,
  };
}
