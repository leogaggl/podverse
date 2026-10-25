import { useCallback, useMemo, useSyncExternalStore } from 'react';

import type { DTOItemChapter } from '@podverse/helpers/dto';

import {
  getCrossDevicePlaybackPositionSeconds,
  getCrossDevicePlaybackView,
  subscribeCrossDevicePlaybackPositionClock,
  subscribeCrossDevicePlaybackView,
} from './crossDevice/crossDevicePlaybackStore';
import { selectRemoteRowMediaId } from './crossDevice/crossDevicePlayerDisplay';
import {
  getPlaybackPositionClockSeconds,
  subscribePlaybackPositionClock,
} from './playbackProgressStore';
import { usePlaybackRow } from './PlaybackProvider';
import type { PlayingChapterSource } from './playingChapter';
import { playingChapterSourceFromTarget, selectPlayingChapterIdText } from './playingChapter';

const readRemoteRowMediaId = (): string | null => {
  return selectRemoteRowMediaId(getCrossDevicePlaybackView());
};

const floorPositionSeconds = (positionSeconds: number | null): number | null => {
  if (positionSeconds === null) {
    return null;
  }
  return Math.floor(positionSeconds);
};

const unsubscribeNoop = (): void => undefined;

/**
 * The `id_text` of the chapter playing in this list's item, or null.
 *
 * The screen subscribes once. While another device plays, the position is that device's
 * estimate; otherwise it is this phone's playhead. A scrubber preview does not move the mark.
 * Rows receive a boolean and do not subscribe to the clock.
 */
export function usePlayingChapterIdText(params: {
  chapters: readonly DTOItemChapter[];
  itemMediaId: string | null;
}): string | null {
  const { chapters, itemMediaId } = params;
  const { activeTarget } = usePlaybackRow();
  const remoteMediaId = useSyncExternalStore(
    subscribeCrossDevicePlaybackView,
    readRemoteRowMediaId,
    readRemoteRowMediaId
  );
  const localSource = useMemo(() => playingChapterSourceFromTarget(activeTarget), [activeTarget]);
  const source = useMemo((): PlayingChapterSource | null => {
    if (remoteMediaId !== null) {
      return { mediaId: remoteMediaId, chapterIdText: null };
    }
    return localSource;
  }, [localSource, remoteMediaId]);

  const subscribe = useCallback(
    (onStoreChange: () => void): (() => void) => {
      if (itemMediaId === null) {
        return unsubscribeNoop;
      }
      if (remoteMediaId !== null) {
        return subscribeCrossDevicePlaybackPositionClock(onStoreChange);
      }
      return subscribePlaybackPositionClock(onStoreChange);
    },
    [itemMediaId, remoteMediaId]
  );

  const getSnapshot = useCallback((): string | null => {
    if (itemMediaId === null) {
      return null;
    }
    const positionSeconds =
      remoteMediaId !== null
        ? floorPositionSeconds(getCrossDevicePlaybackPositionSeconds(Date.now()))
        : getPlaybackPositionClockSeconds();
    return selectPlayingChapterIdText({
      chapters,
      itemMediaId,
      positionSeconds,
      source,
    });
  }, [chapters, itemMediaId, remoteMediaId, source]);

  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}
