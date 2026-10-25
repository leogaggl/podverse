import { APP_ROUTES, buildAppRoutePath } from '@podverse/helpers';
import type { DTOPlaybackResourceSummary } from '@podverse/helpers/accountPlaybackStream';
import { getItemTypeFromMedium, isMusicMediumId } from '@podverse/helpers/medium';
import type { PlaybackTarget } from '@podverse/playback-core';

export type ShareResource =
  | 'album'
  | 'artist'
  | 'clip'
  | 'episode'
  | 'music-livestream'
  | 'official-clip'
  | 'playlist'
  | 'podcast'
  | 'podcast-livestream'
  | 'profile'
  | 'track';

const SHARE_RESOURCE_ROUTES: Record<ShareResource, (typeof APP_ROUTES)[keyof typeof APP_ROUTES]> = {
  album: APP_ROUTES.ALBUM,
  artist: APP_ROUTES.ARTIST,
  clip: APP_ROUTES.CLIP,
  episode: APP_ROUTES.EPISODE,
  'music-livestream': APP_ROUTES.MUSIC_LIVESTREAM,
  'official-clip': APP_ROUTES.OFFICIAL_CLIP,
  playlist: APP_ROUTES.PLAYLIST,
  podcast: APP_ROUTES.PODCAST,
  'podcast-livestream': APP_ROUTES.PODCAST_LIVESTREAM,
  profile: APP_ROUTES.PROFILE,
  track: APP_ROUTES.TRACK,
};

const trimTrailingSlashes = (value: string): string => {
  return value.replace(/\/+$/, '');
};

export const buildPublicShareUrl = (
  webBaseUrl: string | null,
  resource: ShareResource,
  idText: string
): string | null => {
  if (webBaseUrl === null || webBaseUrl.trim() === '') {
    return null;
  }
  return `${trimTrailingSlashes(webBaseUrl)}${buildAppRoutePath(SHARE_RESOURCE_ROUTES[resource], idText)}`;
};

export function buildNowPlayingShareUrl(
  webBaseUrl: string | null,
  target: PlaybackTarget
): string | null {
  switch (target.kind) {
    case 'clip':
      return buildPublicShareUrl(webBaseUrl, 'clip', target.clip.id_text);
    case 'soundbite':
    case 'chapter':
    case 'item-podcast':
    case 'item-video':
    case 'item-music':
      return buildPublicShareUrl(webBaseUrl, 'episode', target.item.id_text);
    case 'livestream':
      return buildPublicShareUrl(webBaseUrl, 'podcast', target.channel.id_text);
    case 'add-by-rss':
      return null;
  }
}

/** Public page for another device's item. Add by RSS has none. */
export function buildRemotePlaybackShareUrl(
  webBaseUrl: string | null,
  resource: DTOPlaybackResourceSummary,
  isLive: boolean
): string | null {
  switch (resource.ref.kind) {
    case 'item': {
      const shareResource = isLive
        ? isMusicMediumId(resource.medium)
          ? 'music-livestream'
          : 'podcast-livestream'
        : getItemTypeFromMedium(resource.medium);
      return buildPublicShareUrl(webBaseUrl, shareResource, resource.ref.item_id_text);
    }
    case 'clip':
      return buildPublicShareUrl(webBaseUrl, 'clip', resource.ref.clip_id_text);
    case 'soundbite':
      return buildPublicShareUrl(webBaseUrl, 'official-clip', resource.ref.item_soundbite_id_text);
    case 'add_by_rss':
      return null;
  }
}
