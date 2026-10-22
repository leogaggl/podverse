import { isObjectLike } from '@podverse/helpers/guards';
import { MediumEnum } from '@podverse/helpers/medium';
import type { PlaybackEventKind } from '@podverse/helpers/playbackEvents';
import type { PlaybackTarget } from '@podverse/playback-core';

import {
  addByRssPlaybackMediaId,
  isAddByRssLivestreamResourceData,
  withCanonicalAddByRssFeedUrl,
} from '../lib/addByRss/resourceData';

export type PlaybackDiscreteSignal =
  | 'complete'
  | 'pause'
  | 'play'
  | 'queue_add'
  | 'queue_remove'
  | 'queue_reorder'
  | 'seek'
  | 'skip'
  | 'sleep_timer_stop';

export type PlaybackNowPlayingResource = {
  resourceIdText: string;
  resourceKind: 'add_by_rss' | 'clip' | 'item' | 'soundbite';
};

const IMMEDIATE_NOW_PLAYING_EVENT_KINDS: readonly PlaybackEventKind[] = [
  'complete',
  'pause',
  'play',
  'seek',
  'skip',
  'sleep_timer_stop',
];

export const playbackEventFromDiscreteSignal = (
  signal: PlaybackDiscreteSignal
): PlaybackEventKind => signal;

export const playbackEventFromProgressSample = ({
  isPlaying,
}: {
  isPlaying: boolean;
}): PlaybackEventKind | null => {
  return isPlaying ? 'progress_tick' : null;
};

export const playbackEventFromBackgroundTransition = ({
  isPlaying,
}: {
  isPlaying: boolean;
}): PlaybackEventKind | null => {
  return isPlaying ? 'progress_tick' : null;
};

export const shouldPostNowPlayingImmediately = (kind: PlaybackEventKind): boolean => {
  return IMMEDIATE_NOW_PLAYING_EVENT_KINDS.some((immediateKind) => immediateKind === kind);
};

export const shouldClaimActiveQueueForPlaybackEvent = (kind: PlaybackEventKind): boolean => {
  return kind === 'play';
};

export const nowPlayingResourceFromTarget = (
  target: PlaybackTarget
): PlaybackNowPlayingResource | null => {
  switch (target.kind) {
    case 'clip':
      return { resourceIdText: target.clip.id_text, resourceKind: 'clip' };
    case 'soundbite':
      return { resourceIdText: target.soundbite.id_text, resourceKind: 'soundbite' };
    case 'chapter':
    case 'item-music':
    case 'item-podcast':
    case 'item-video':
      return { resourceIdText: target.item.id_text, resourceKind: 'item' };
    case 'add-by-rss':
      if (isAddByRssLivestreamResourceData(target.resourceData)) {
        return null;
      }
      return {
        resourceIdText: addByRssPlaybackMediaId(target.resourceData),
        resourceKind: 'add_by_rss',
      };
    case 'livestream':
      return null;
  }
};

/**
 * Payload stored with a playback event. An Add by RSS event carries its full resource data so the
 * server can create the now-playing row on replay, even when no queue row exists for it yet.
 */
export const playbackEventPayloadForTarget = (
  target: PlaybackTarget,
  payload: unknown
): unknown => {
  if (target.kind !== 'add-by-rss') {
    return payload;
  }
  const base = isObjectLike(payload) ? payload : {};
  return {
    ...base,
    add_by_rss_resource_data: withCanonicalAddByRssFeedUrl(target.resourceData),
  };
};

/**
 * The medium whose queue holds this target's playback. An Add by RSS target with no medium plays
 * on the podcast queue.
 */
export const playbackMediumIdFromTarget = (target: PlaybackTarget): number => {
  if (target.kind === 'add-by-rss') {
    const mediumId = target.resourceData.medium_id;
    return typeof mediumId === 'number' ? mediumId : MediumEnum.Podcast;
  }
  return target.channel.medium_id;
};
