import { primaryListArtworkUrl } from '@podverse/helpers';
import type { DTOClip, DTOItemSoundbite } from '@podverse/helpers/dto';
import type { PlaybackTarget } from '@podverse/playback-core';

import type { MediaEngineSourceMeta } from '../../../modules/podverse-media-engine';
import { addByRssPlaybackMediaId } from '../addByRss/resourceData';
import { resolveEngineAudioProfile } from './engineAudioProfile';
import { nowPlayingArtistFields, playbackTargetArtists } from './verifiedArtists';

export const queueMediumFromTarget = (target: PlaybackTarget): 'av' | 'music' => {
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
 * Engine source id for this target: the id of the media the engine loads. A chapter plays its
 * item, so a chapter target has its item's id, not the chapter id `playbackTargetRowMediaId`
 * returns. Compare an engine id with a target through `engineSourceMatchesTarget`.
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

type ClipBounds = { start: number | null; end: number | null };

/** The range a clip plays, in seconds. */
export const clipBoundsForClip = (clip: Pick<DTOClip, 'start_time' | 'end_time'>): ClipBounds => ({
  start: secondsFromDto(clip.start_time),
  end: secondsFromDto(clip.end_time),
});

/** The range a soundbite plays, in seconds. The end is open unless the duration is positive. */
export const clipBoundsForSoundbite = (
  soundbite: Pick<DTOItemSoundbite, 'start_time' | 'duration'>
): ClipBounds => {
  const start = secondsFromDto(soundbite.start_time);
  const duration = secondsFromDto(soundbite.duration);
  return {
    start,
    end: start !== null && duration !== null && duration > 0 ? start + duration : null,
  };
};

const clipBoundsFromTarget = (target: PlaybackTarget): ClipBounds => {
  if (target.kind === 'clip') {
    return clipBoundsForClip(target.clip);
  }
  if (target.kind === 'soundbite') {
    return clipBoundsForSoundbite(target.soundbite);
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
 * The `kind` and `idText` the engine meta records for this target, which native compares with
 * cached rows. Null when the target has no usable id.
 */
export const engineSourceIdentityFromTarget = (
  target: PlaybackTarget
): { kind: MediaEngineSourceMeta['kind']; idText: string } | null => {
  const idText = idTextFromTarget(target);
  if (idText === null || idText.length === 0) {
    return null;
  }
  return { idText, kind: metaKindFromTarget(target) };
};

/**
 * Whether an engine event about `engineIdText` belongs to `target`. The engine names a source by
 * the media it loaded, so a chapter target matches its item's id and a clip target matches only
 * the clip's id. With no engine id, no target, or a target with no engine identity there is
 * nothing to tell them apart by, so it counts as a match.
 */
export const engineSourceMatchesTarget = (
  engineIdText: string | null,
  target: PlaybackTarget | null
): boolean => {
  if (engineIdText === null || target === null) {
    return true;
  }
  const identity = engineSourceIdentityFromTarget(target);
  return identity === null || identity.idText === engineIdText;
};

/**
 * Build engine source meta for a phone-initiated load. Returns null when the target has no usable
 * id (rare); callers then omit meta.
 */
export const mediaEngineSourceMetaFromTarget = (
  target: PlaybackTarget,
  origin: MediaEngineSourceMeta['origin'] = 'js'
): MediaEngineSourceMeta | null => {
  const identity = engineSourceIdentityFromTarget(target);
  if (identity === null) {
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
    idText: identity.idText,
    isLive: target.kind === 'livestream',
    kind: identity.kind,
    origin,
    queueMedium: queueMediumFromTarget(target),
    subtitle: artistFields.artist,
    title: titleFromTarget(target),
  };
};
