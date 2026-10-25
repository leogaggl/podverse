'use client';

import { useCallback, useSyncExternalStore } from 'react';

import type { DTOItemChapter } from '@podverse/helpers';

import {
  getRemotePlaybackWholeSeconds,
  subscribeRemotePlaybackClock,
} from '../lib/crossDevicePlayback/remotePlaybackClock';
import { selectItemChapterForTime } from '../lib/playback';

function subscribeNothing(): () => void {
  return () => {};
}

function getNull(): null {
  return null;
}

/**
 * Whole-second estimate of the remote position, advancing while it plays; null when disabled,
 * live, or unknown.
 */
export function useRemotePlaybackPositionSeconds(enabled: boolean): number | null {
  return useSyncExternalStore(
    enabled ? subscribeRemotePlaybackClock : subscribeNothing,
    enabled ? getRemotePlaybackWholeSeconds : getNull,
    getNull
  );
}

/**
 * `id_text` of the chapter the playing device is in, by the same rule the local player uses to
 * follow chapters (`selectItemChapterForTime`); null when disabled, without chapters, or between
 * chapters. Re-renders only when that id changes.
 */
export function useRemoteActiveChapterIdText(
  chapters: DTOItemChapter[] | null,
  enabled: boolean
): string | null {
  const getSnapshot = useCallback((): string | null => {
    if (!enabled || chapters === null) {
      return null;
    }
    const positionSeconds = getRemotePlaybackWholeSeconds();
    if (positionSeconds === null) {
      return null;
    }
    return selectItemChapterForTime(chapters, positionSeconds)?.id_text ?? null;
  }, [enabled, chapters]);

  return useSyncExternalStore(
    enabled ? subscribeRemotePlaybackClock : subscribeNothing,
    getSnapshot,
    getNull
  );
}
