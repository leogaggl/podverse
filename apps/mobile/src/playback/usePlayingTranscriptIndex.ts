import { useCallback, useMemo, useSyncExternalStore } from 'react';

import type { TranscriptRow } from '@podverse/helpers';
import { findActiveTranscriptRowIndex } from '@podverse/helpers/transcript';

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
import { playingChapterSourceFromTarget } from './playingChapter';

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
 * Index of the cue that contains the playhead in `rows`, or `-1`.
 *
 * The screen subscribes once. While another device plays, the position is that device's
 * estimate; otherwise it is this phone's playhead. Rows receive a boolean and do not subscribe
 * to the clock. Returns `-1` when this list is a different item than what is playing.
 */
export function usePlayingTranscriptIndex(params: {
  itemMediaId: string | null;
  rows: readonly TranscriptRow[];
}): number {
  const { itemMediaId, rows } = params;
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

  const getSnapshot = useCallback((): number => {
    if (itemMediaId === null || source === null || source.mediaId !== itemMediaId) {
      return -1;
    }
    const positionSeconds =
      remoteMediaId !== null
        ? floorPositionSeconds(getCrossDevicePlaybackPositionSeconds(Date.now()))
        : getPlaybackPositionClockSeconds();
    if (positionSeconds === null) {
      return -1;
    }
    return findActiveTranscriptRowIndex(rows, positionSeconds);
  }, [itemMediaId, remoteMediaId, rows, source]);

  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}
