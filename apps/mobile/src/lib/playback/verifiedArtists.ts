import { joinVerifiedPublisherTitles, resolveVerifiedPublishers } from '@podverse/helpers';
import type { DTOItem, DTOVerifiedPublisher } from '@podverse/helpers/dto';
import { getChannelRouteKind } from '@podverse/helpers/medium';
import type { PlaybackTarget } from '@podverse/playback-core';

import {
  addByRssAlbumArtists,
  addByRssArtistsListingDirectoryAlbum,
} from '../addByRss/addByRssArtistIndex';
import type { LineArtist } from './lineArtist';
import { directoryLineArtist, joinLineArtistTitles } from './lineArtist';

type VerifiedPublisherHolder = {
  verified_publishers?: DTOVerifiedPublisher[];
};

/** Verified publishers shown as artists for a channel, or for an item on that channel. */
export const resolveVerifiedArtists = (args: {
  channel?: VerifiedPublisherHolder | null;
  item?: VerifiedPublisherHolder | null;
}): DTOVerifiedPublisher[] =>
  resolveVerifiedPublishers(args).filter(
    (publisher) => getChannelRouteKind(publisher.medium_id) === 'artist'
  );

/** "A, B" for the verified artists of an item on a channel, or null when there are none. */
export const verifiedArtistNames = (args: {
  channel?: VerifiedPublisherHolder | null;
  item?: VerifiedPublisherHolder | null;
}): string | null => {
  const names = joinVerifiedPublisherTitles(resolveVerifiedArtists(args));
  return names.length > 0 ? names : null;
};

/**
 * Verified artist names for a stored or listed item: its embedded channel when present, else the
 * channel-wide publishers a by-channel item list puts on the item. Null when there are none.
 */
export const itemArtistNames = (item: DTOItem): string | null =>
  verifiedArtistNames({
    channel: item.channel ?? { verified_publishers: item.channel_wide_verified_publishers },
    item,
  });

/**
 * Artists for the item a playback target plays: verified directory artists first, else the
 * member's Add by RSS artists on this device. Reads memory only, so it never waits on the network.
 */
export const playbackTargetArtists = (target: PlaybackTarget | null): LineArtist[] => {
  if (target === null) {
    return [];
  }
  if (target.kind === 'add-by-rss') {
    const feedUrl = target.resourceData.feed_url;
    return typeof feedUrl === 'string' && feedUrl.length > 0 ? addByRssAlbumArtists(feedUrl) : [];
  }
  const verified = resolveVerifiedArtists({ channel: target.channel, item: target.item });
  if (verified.length > 0) {
    return verified.map(directoryLineArtist);
  }
  return addByRssArtistsListingDirectoryAlbum({
    channelIdText: target.channel.id_text,
    podcastGuid: target.channel.podcast_guid,
  });
};

/**
 * Second line of the mini player: "Artist · Album" when there is an artist, else the album
 * (channel) title. Null when both are empty.
 */
export const artistAlbumLine = (
  artists: readonly LineArtist[],
  albumTitle: string | null
): string | null => {
  const names = joinLineArtistTitles(artists);
  const album = albumTitle?.trim() ?? '';
  if (names !== '' && album !== '') {
    return `${names} · ${album}`;
  }
  if (names !== '') {
    return names;
  }
  if (album !== '') {
    return album;
  }
  return null;
};

export type NowPlayingArtistFields = {
  /** OS artist field. Artist names, or the channel title when there is no artist. */
  artist: string | null;
  /** OS album field. The channel title, only when `artist` holds artist names. */
  albumTitle: string | null;
};

export const nowPlayingArtistFields = (
  artists: readonly LineArtist[],
  channelTitle: string | null
): NowPlayingArtistFields => {
  const names = joinLineArtistTitles(artists);
  const channel = channelTitle?.trim() ?? '';
  if (names !== '') {
    return { artist: names, albumTitle: channel.length > 0 ? channel : null };
  }
  return { artist: channel.length > 0 ? channel : null, albumTitle: null };
};
