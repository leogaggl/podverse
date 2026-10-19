import type { AddByRSSResourceData, DTOChannel, DTOItem } from '@podverse/helpers';
import { primaryChannelListArtworkUrl, primaryListArtworkUrl } from '@podverse/helpers';
import { isArtistMediumId } from '@podverse/helpers/medium';
import type { PlaybackTarget } from '@podverse/playback-core';

export type FullPlayerContentTarget = {
  idText: string;
  imageUrl: string | null;
  kind: 'add-by-rss' | 'album' | 'artist' | 'clip' | 'episode' | 'podcast' | 'track';
  name: string;
};

/** Home holds follows. Browse holds directory content this device does not follow. */
export type PlayerContentStack = 'Browse' | 'Home';

export type FullPlayerOpenRequest = FullPlayerContentTarget & {
  stack: PlayerContentStack;
};

const nonEmpty = (value: string | null | undefined): string | null => {
  if (value === null || value === undefined) {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length === 0 ? null : trimmed;
};

const readResourceString = (data: AddByRSSResourceData, key: string): string | null => {
  const value = data[key];
  if (typeof value !== 'string') {
    return null;
  }
  return nonEmpty(value);
};

const episodeRequest = (
  item: DTOItem,
  channel: DTOChannel,
  name: string
): FullPlayerContentTarget | null => {
  const idText = nonEmpty(item.id_text);
  if (idText === null) {
    return null;
  }
  return {
    idText,
    imageUrl: primaryListArtworkUrl(item.item_images, channel.channel_images),
    kind: 'episode',
    name,
  };
};

const channelRequest = (
  channel: DTOChannel,
  name: string,
  kind: 'album' | 'artist' | 'podcast'
): FullPlayerContentTarget | null => {
  const idText = nonEmpty(channel.id_text);
  if (idText === null) {
    return null;
  }
  return {
    idText,
    imageUrl: primaryChannelListArtworkUrl(channel.channel_images),
    kind,
    name,
  };
};

const musicChannelKind = (channel: DTOChannel): 'album' | 'artist' => {
  return isArtistMediumId(channel.medium_id) ? 'artist' : 'album';
};

/**
 * Where the visible item title opens. Add by RSS has no item screen. A livestream without an
 * item has no title link.
 */
export const resolveFullPlayerTitleLink = (
  target: PlaybackTarget | null,
  visibleTitle: string | null
): FullPlayerContentTarget | null => {
  const name = nonEmpty(visibleTitle);
  if (target === null || name === null) {
    return null;
  }

  switch (target.kind) {
    case 'add-by-rss':
      return null;
    case 'livestream':
      return target.item === null ? null : episodeRequest(target.item, target.channel, name);
    case 'clip': {
      const idText = nonEmpty(target.clip.id_text);
      if (idText === null) {
        return null;
      }
      return { idText, imageUrl: null, kind: 'clip', name };
    }
    case 'soundbite':
    case 'chapter':
    case 'item-podcast':
    case 'item-video':
      return episodeRequest(target.item, target.channel, name);
    case 'item-music': {
      const idText = nonEmpty(target.item.id_text);
      if (idText === null) {
        return null;
      }
      return {
        idText,
        imageUrl: primaryListArtworkUrl(target.item.item_images, target.channel.channel_images),
        kind: 'track',
        name,
      };
    }
  }
};

/**
 * Where the visible channel name opens. Add by RSS opens only when this device has the feed.
 */
export const resolveFullPlayerChannelLink = (
  target: PlaybackTarget | null,
  visibleChannelTitle: string | null,
  addByRssFeedIdText: string | null
): FullPlayerContentTarget | null => {
  const name = nonEmpty(visibleChannelTitle);
  if (target === null || name === null) {
    return null;
  }

  switch (target.kind) {
    case 'add-by-rss': {
      const idText = nonEmpty(addByRssFeedIdText);
      if (idText === null) {
        return null;
      }
      return { idText, imageUrl: null, kind: 'add-by-rss', name };
    }
    case 'item-music':
      return channelRequest(target.channel, name, musicChannelKind(target.channel));
    case 'clip':
    case 'soundbite':
    case 'chapter':
    case 'item-podcast':
    case 'item-video':
    case 'livestream':
      return channelRequest(target.channel, name, 'podcast');
  }
};

export const fullPlayerOpenScreenLabelKey = (kind: FullPlayerContentTarget['kind']): string => {
  switch (kind) {
    case 'episode':
      return 'media.podcast.episode';
    case 'clip':
      return 'features.clip.clip';
    case 'track':
      return 'media.music.track';
    case 'podcast':
      return 'media.podcast.podcast';
    case 'album':
      return 'media.music.album';
    case 'artist':
      return 'media.music.artist';
    case 'add-by-rss':
      return 'features.add_by_rss.label';
  }
};

export type AddByRssFeedLookup = {
  getFeedByIdText: (idText: string) => Promise<{ idText: string } | null>;
  getFeedByUrl: (feedUrl: string) => Promise<{ idText: string } | null>;
};

/**
 * The feed id on this device. A synced queue row can carry another device's id, so the URL is
 * the fallback when that id is not stored here.
 */
export const resolveLocalAddByRssFeedIdText = async (
  resourceData: AddByRSSResourceData,
  lookup: AddByRssFeedLookup
): Promise<string | null> => {
  const channelIdText = readResourceString(resourceData, 'channel_id_text');
  if (channelIdText !== null) {
    const byId = await lookup.getFeedByIdText(channelIdText);
    if (byId !== null) {
      return byId.idText;
    }
  }

  const feedUrl = readResourceString(resourceData, 'feed_url');
  if (feedUrl === null) {
    return null;
  }
  const byUrl = await lookup.getFeedByUrl(feedUrl);
  return byUrl === null ? null : byUrl.idText;
};

/**
 * A directory follow opens on Home, where that channel's episodes live. Anything this device
 * does not follow opens on Browse. Add by RSS is a follow, so it opens on Home too.
 */
export const playerContentStack = (params: {
  isSubscribed: boolean;
  kind: FullPlayerContentTarget['kind'];
}): PlayerContentStack => {
  if (params.kind === 'add-by-rss' || params.isSubscribed) {
    return 'Home';
  }
  return 'Browse';
};
