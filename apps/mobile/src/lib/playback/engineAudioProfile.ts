import { MediumEnum } from '@podverse/helpers/medium';
import type { PlaybackTarget } from '@podverse/playback-core';

import type { MediaEngineAudioProfile } from '../../../modules/podverse-media-engine';

const MUSIC_MEDIUMS: ReadonlySet<number> = new Set([
  MediumEnum.Music,
  MediumEnum.MusicL,
  MediumEnum.PublisherMusic,
]);

const VIDEO_MEDIUMS: ReadonlySet<number> = new Set([
  MediumEnum.Video,
  MediumEnum.VideoL,
  MediumEnum.Film,
  MediumEnum.FilmL,
  MediumEnum.PublisherVideo,
  MediumEnum.PublisherFilm,
]);

const profileFromMedium = (mediumId: unknown): MediaEngineAudioProfile => {
  if (typeof mediumId !== 'number') {
    return 'spoken';
  }
  if (MUSIC_MEDIUMS.has(mediumId)) {
    return 'music';
  }
  if (VIDEO_MEDIUMS.has(mediumId)) {
    return 'video';
  }
  return 'spoken';
};

/**
 * How the OS should treat this target's audio when a call, navigation prompt, or another app
 * needs the speaker. Clips, chapters, and soundbites follow their channel's medium. Add by RSS
 * follows the feed medium stored on its resource data; one with no medium is treated as spoken,
 * since that is what most feeds carry.
 */
export function resolveEngineAudioProfile(target: PlaybackTarget | null): MediaEngineAudioProfile {
  if (target === null) {
    return 'spoken';
  }
  if (target.kind === 'add-by-rss') {
    return profileFromMedium(target.resourceData.medium_id);
  }
  if (target.kind === 'item-music') {
    return 'music';
  }
  if (target.kind === 'item-video') {
    return 'video';
  }
  return profileFromMedium(target.channel.medium_id);
}

/**
 * A music item, from the directory or from Add by RSS. Music plays at 1x, has no speed control,
 * offers shuffle and repeat beside sleep and More, and cannot be clipped.
 */
export function isMusicPlaybackTarget(target: PlaybackTarget | null): boolean {
  if (target === null) {
    return false;
  }
  if (target.kind === 'item-music') {
    return true;
  }
  return target.kind === 'add-by-rss' && resolveEngineAudioProfile(target) === 'music';
}
