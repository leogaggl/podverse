import type { AddByRSSResourceData, DTOChannel, DTOItem } from '@podverse/helpers';
import { primaryChannelListArtworkUrl, primaryListArtworkUrl } from '@podverse/helpers';
import type { DTOPlaybackResourceSummary } from '@podverse/helpers/accountPlaybackStream';
import { isAlbumMediumId, isArtistMediumId, isMusicMediumId } from '@podverse/helpers/medium';
import type { PlaybackTarget } from '@podverse/playback-core';

import { isAddByRssLivestreamResourceData } from '../../lib/addByRss/resourceData';
import { isMusicPlaybackTarget } from '../../lib/playback/engineAudioProfile';
import type { LineArtist } from '../../lib/playback/lineArtist';
import { lineArtistTitle } from '../../lib/playback/lineArtist';

export type FullPlayerContentTarget = {
  idText: string;
  imageUrl: string | null;
  /**
   * Set on an Add by RSS item: the item guid, or the index when the item has none.
   * For `add-by-rss-livestream` it is the live item key.
   */
  itemKey?: string;
  kind:
    | 'add-by-rss'
    | 'add-by-rss-episode'
    | 'add-by-rss-livestream'
    | 'add-by-rss-track'
    | 'album'
    | 'artist'
    | 'clip'
    | 'episode'
    | 'podcast'
    | 'track';
  name: string;
};

/** Home holds follows. Browse holds directory content this device does not follow. */
export type PlayerContentStack = 'Browse' | 'Home';

export type FullPlayerOpenRequest = FullPlayerContentTarget & {
  stack: PlayerContentStack;
};

/** Channel page and item page opened together from the item title. */
export type FullPlayerItemOpenRequest = {
  channel: FullPlayerContentTarget;
  item: FullPlayerContentTarget;
  stack: PlayerContentStack;
};

export type PlayerStackRoute = {
  name: string;
  params?: object;
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
 * Where the visible item title opens. A directory livestream opens its live item's episode page,
 * the page its rows open. Add by RSS titles open this device's episode, track, or livestream page
 * and link only when this device has the feed and finds the item. A directory livestream
 * without an item has no title link.
 */
export const resolveFullPlayerTitleLink = (
  target: PlaybackTarget | null,
  visibleTitle: string | null,
  addByRss: { feedIdText: string | null; itemKey: string | null }
): FullPlayerContentTarget | null => {
  const name = nonEmpty(visibleTitle);
  if (target === null || name === null) {
    return null;
  }

  switch (target.kind) {
    case 'add-by-rss': {
      const feedIdText = nonEmpty(addByRss.feedIdText);
      const itemKey = nonEmpty(addByRss.itemKey);
      if (feedIdText === null || itemKey === null) {
        return null;
      }
      if (isAddByRssLivestreamResourceData(target.resourceData)) {
        return {
          idText: feedIdText,
          imageUrl: null,
          itemKey,
          kind: 'add-by-rss-livestream',
          name,
        };
      }
      if (isMusicPlaybackTarget(target)) {
        return { idText: feedIdText, imageUrl: null, itemKey, kind: 'add-by-rss-track', name };
      }
      return { idText: feedIdText, imageUrl: null, itemKey, kind: 'add-by-rss-episode', name };
    }
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
 * Where the visible channel name opens. A directory livestream whose channel is an album
 * opens that album. Any other directory livestream opens the podcast. Add by RSS opens only
 * when this device has the feed.
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
    case 'livestream':
      return channelRequest(
        target.channel,
        name,
        isAlbumMediumId(target.channel.medium_id) ? 'album' : 'podcast'
      );
    case 'clip':
    case 'soundbite':
    case 'chapter':
    case 'item-podcast':
    case 'item-video':
      return channelRequest(target.channel, name, 'podcast');
  }
};

/** Where another device's item title opens, from the shared summary. */
export const resolveRemoteFullPlayerTitleLink = (
  resource: DTOPlaybackResourceSummary,
  addByRss: {
    feedIdText: string | null;
    itemKey: string | null;
    resourceData: AddByRSSResourceData | null;
  }
): FullPlayerContentTarget | null => {
  const name = nonEmpty(resource.title);
  if (name === null) {
    return null;
  }

  switch (resource.ref.kind) {
    case 'item':
      return {
        idText: resource.ref.item_id_text,
        imageUrl: resource.image_url,
        kind: isMusicMediumId(resource.medium) ? 'track' : 'episode',
        name,
      };
    case 'clip':
      return { idText: resource.ref.clip_id_text, imageUrl: null, kind: 'clip', name };
    case 'soundbite':
      return null;
    case 'add_by_rss': {
      const feedIdText = nonEmpty(addByRss.feedIdText);
      const itemKey = nonEmpty(addByRss.itemKey);
      const resourceData = addByRss.resourceData;
      if (feedIdText === null || itemKey === null || resourceData === null) {
        return null;
      }
      if (isAddByRssLivestreamResourceData(resourceData)) {
        return {
          idText: feedIdText,
          imageUrl: null,
          itemKey,
          kind: 'add-by-rss-livestream',
          name,
        };
      }
      if (isMusicMediumId(resource.medium)) {
        return { idText: feedIdText, imageUrl: null, itemKey, kind: 'add-by-rss-track', name };
      }
      return { idText: feedIdText, imageUrl: null, itemKey, kind: 'add-by-rss-episode', name };
    }
  }
};

/** Where another device's show title opens: only an Add by RSS feed on this phone. */
export const resolveRemoteFullPlayerChannelLink = (
  resource: DTOPlaybackResourceSummary,
  addByRssFeedIdText: string | null
): FullPlayerContentTarget | null => {
  const name = nonEmpty(resource.channel_title);
  if (name === null) {
    return null;
  }

  switch (resource.ref.kind) {
    case 'add_by_rss': {
      const idText = nonEmpty(addByRssFeedIdText);
      if (idText === null) {
        return null;
      }
      return { idText, imageUrl: null, kind: 'add-by-rss', name };
    }
    case 'item':
    case 'clip':
    case 'soundbite':
      return null;
  }
};

/**
 * Page for one artist on the player's artist line: the directory artist page, or this device's
 * Add by RSS page for an Add by RSS artist.
 */
export const fullPlayerArtistLink = (artist: LineArtist): FullPlayerContentTarget =>
  artist.kind === 'directory'
    ? {
        idText: artist.publisher.id_text,
        imageUrl: null,
        kind: 'artist',
        name: lineArtistTitle(artist),
      }
    : {
        idText: artist.feedIdText,
        imageUrl: null,
        kind: 'add-by-rss',
        name: lineArtistTitle(artist),
      };

export const fullPlayerOpenScreenLabelKey = (kind: FullPlayerContentTarget['kind']): string => {
  switch (kind) {
    case 'add-by-rss-episode':
      return 'media.podcast.episode';
    case 'add-by-rss-track':
      return 'media.music.track';
    case 'add-by-rss-livestream':
      return 'media.livestream.livestream';
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
 * does not follow opens on Browse. Add by RSS (`add-by-rss`, `add-by-rss-episode`,
 * `add-by-rss-livestream`, and `add-by-rss-track`) is a follow, so it opens on Home too.
 */
export const playerContentStack = (params: {
  isSubscribed: boolean;
  kind: FullPlayerContentTarget['kind'];
}): PlayerContentStack => {
  if (
    params.kind === 'add-by-rss' ||
    params.kind === 'add-by-rss-episode' ||
    params.kind === 'add-by-rss-livestream' ||
    params.kind === 'add-by-rss-track' ||
    params.isSubscribed
  ) {
    return 'Home';
  }
  return 'Browse';
};

/** Tab root, then the channel, then the item. The item is the focused route. */
export const playerItemStackRoutes = (
  rootName: string,
  channel: PlayerStackRoute,
  item: PlayerStackRoute
): PlayerStackRoute[] => {
  return [{ name: rootName }, channel, item];
};
