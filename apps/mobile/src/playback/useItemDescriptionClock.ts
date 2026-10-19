import { useCallback } from 'react';

import type { DTOChannel, DTOItem } from '@podverse/helpers/dto';
import type { PlaybackTarget } from '@podverse/playback-core';

import { usePlaybackSession } from './PlaybackProvider';

const isUnboundedLoadedItem = (target: PlaybackTarget, itemIdText: string): boolean => {
  if (
    target.kind === 'item-podcast' ||
    target.kind === 'item-video' ||
    target.kind === 'item-music'
  ) {
    return target.item.id_text === itemIdText;
  }

  if (target.kind === 'livestream') {
    return target.item?.id_text === itemIdText;
  }

  return false;
};

/**
 * Seek when this item is already the unbounded now-playing item. Otherwise load it and start at
 * the clock. A clip, chapter, or soundbite of the same item loads the item so the jump is not
 * cut off at that segment's end.
 */
export function useItemDescriptionClock(
  item: DTOItem | null,
  channel: DTOChannel | null
): ((seconds: number) => void) | undefined {
  const { activeTarget, clearPauseBoundary, isPlaying, playItem, resume, seekTo } =
    usePlaybackSession();

  const playAt = useCallback(
    (seconds: number) => {
      if (item === null || channel === null) {
        return;
      }

      const start = Math.max(0, seconds);
      if (activeTarget !== null && isUnboundedLoadedItem(activeTarget, item.id_text)) {
        clearPauseBoundary();
        seekTo(start);
        if (!isPlaying) {
          void resume();
        }
        return;
      }

      void playItem(item, channel, { explicitPlaybackSeconds: start });
    },
    [activeTarget, channel, clearPauseBoundary, isPlaying, item, playItem, resume, seekTo]
  );

  if (item === null || channel === null) {
    return undefined;
  }

  return playAt;
}
