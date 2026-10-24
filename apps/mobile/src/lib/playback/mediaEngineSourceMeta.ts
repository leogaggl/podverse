import { primaryListArtworkUrl } from '@podverse/helpers';
import type { PlaybackTarget } from '@podverse/playback-core';

import type { MediaEngineSourceMeta } from '../../../modules/podverse-media-engine';
import { addByRssPlaybackMediaId } from '../addByRss/resourceData';
import { resolveEngineAudioProfile } from './engineAudioProfile';
import { nowPlayingArtistFields, playbackTargetArtists } from './verifiedArtists';

const queueMediumFromTarget = (target: PlaybackTarget): 'av' | 'music' => {
  return resolveEngineAudioProfile(target) === 'music' ? 'music' : 'av';
};

const metaKindFromTarget = (target: PlaybackTarget): MediaEngineSourceMeta['kind'] => {
  switch (target.kind) {
    case 'clip':
      return 'clip';
    case 'soundbite':
      return 'item_soundbite';
    case 'add-by-rss':
      return 'add_by_rss';
    case 'livestream':
      return 'livestream';
    default:
      return 'item';
  }
};

/**
 * Engine source id for this target. It must return what `playbackTargetRowMediaId` returns,
 * because the provider compares the engine's `meta.idText` with it.
 */
const idTextFromTarget = (target: PlaybackTarget): string | null => {
  switch (target.kind) {
    case 'clip':
      return target.clip.id_text;
    case 'soundbite':
      return target.soundbite.id_text;
    case 'chapter':
      return target.item.id_text;
    case 'item-podcast':
    case 'item-video':
    case 'item-music':
      return target.item.id_text;
    case 'add-by-rss':
      return addByRssPlaybackMediaId(target.resourceData);
    case 'livestream':
      return target.item?.id_text ?? target.channel.id_text;
    default:
      return null;
  }
};

const titleFromTarget = (target: PlaybackTarget): string => {
  switch (target.kind) {
    case 'clip':
      return target.clip.title ?? target.item.title ?? 'Podverse';
    case 'soundbite':
      return target.soundbite.title ?? target.item.title ?? 'Podverse';
    case 'chapter':
      return target.chapter.title ?? target.item.title ?? 'Podverse';
    case 'item-podcast':
    case 'item-video':
    case 'item-music':
      return target.item.title ?? 'Podverse';
    case 'add-by-rss': {
      const title = target.resourceData.title;
      return typeof title === 'string' && title.length > 0 ? title : 'Podverse';
    }
    case 'livestream':
      return target.item?.title ?? target.channel.title ?? 'Live';
    default:
      return 'Podverse';
  }
};

const subtitleFromTarget = (target: PlaybackTarget): string | null => {
  switch (target.kind) {
    case 'add-by-rss': {
      const channelTitle = target.resourceData.channel_title;
      return typeof channelTitle === 'string' && channelTitle.length > 0 ? channelTitle : null;
    }
    case 'livestream':
      return target.channel.title ?? null;
    default:
      return target.channel.title ?? null;
  }
};

const artworkFromTarget = (target: PlaybackTarget): string | null => {
  switch (target.kind) {
    case 'add-by-rss':
      return (
        primaryListArtworkUrl(
          target.resourceData.item_images ?? [],
          target.resourceData.channel_images ?? []
        ) ?? null
      );
    case 'livestream':
      return primaryListArtworkUrl(target.item?.item_images, target.channel.channel_images) ?? null;
    case 'clip':
    case 'soundbite':
    case 'chapter':
    case 'item-podcast':
    case 'item-video':
    case 'item-music':
      return primaryListArtworkUrl(target.item.item_images, target.channel.channel_images) ?? null;
    default:
      return null;
  }
};

const secondsFromDto = (value: string | number | null | undefined): number | null => {
  if (value === null || value === undefined) {
    return null;
  }
  const parsed = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const clipBoundsFromTarget = (
  target: PlaybackTarget
): { start: number | null; end: number | null } => {
  if (target.kind === 'clip') {
    return {
      start: secondsFromDto(target.clip.start_time),
      end: secondsFromDto(target.clip.end_time),
    };
  }
  if (target.kind === 'soundbite') {
    const start = secondsFromDto(target.soundbite.start_time);
    const duration = secondsFromDto(target.soundbite.duration);
    return {
      start,
      end: start !== null && duration !== null && duration > 0 ? start + duration : null,
    };
  }
  if (target.kind === 'chapter') {
    return {
      start: secondsFromDto(target.chapter.start_time),
      end: secondsFromDto(target.chapter.end_time),
    };
  }
  return { start: null, end: null };
};

/**
 * Build engine source meta for a phone-initiated load. Returns null when the target has no usable
 * id (rare); callers then omit meta.
 */
export const mediaEngineSourceMetaFromTarget = (
  target: PlaybackTarget,
  origin: MediaEngineSourceMeta['origin'] = 'js'
): MediaEngineSourceMeta | null => {
  const idText = idTextFromTarget(target);
  if (idText === null || idText.length === 0) {
    return null;
  }
  const bounds = clipBoundsFromTarget(target);
  const artistFields = nowPlayingArtistFields(
    playbackTargetArtists(target),
    subtitleFromTarget(target)
  );
  return {
    albumTitle: artistFields.albumTitle,
    artworkUrl: artworkFromTarget(target),
    clipEndSeconds: bounds.end,
    clipStartSeconds: bounds.start,
    idText,
    isLive: target.kind === 'livestream',
    kind: metaKindFromTarget(target),
    origin,
    queueMedium: queueMediumFromTarget(target),
    subtitle: artistFields.artist,
    title: titleFromTarget(target),
  };
};
