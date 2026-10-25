/**
 * Reads the cross-device store for the mini player, the full player, the device menu, and list
 * rows. Row answers are primitives, so a row re-renders only when its own answer changes.
 */
import { useCallback, useMemo, useSyncExternalStore } from 'react';
import { useTranslation } from 'react-i18next';

import type { PlaybackDeviceListEntry } from '@podverse/helpers/crossDevicePlayback';

import { playbackTargetRowMediaId } from '../../lib/playback/buildPlaybackTarget';
import { usePlaybackIsPlaying, usePlaybackRow, usePlaybackSession } from '../PlaybackProvider';
import type { CrossDevicePlaybackView } from './crossDevicePlaybackStore';
import {
  getCrossDevicePlaybackPositionSeconds,
  getCrossDevicePlaybackView,
  subscribeCrossDevicePlaybackPositionClock,
  subscribeCrossDevicePlaybackView,
} from './crossDevicePlaybackStore';
import type { CrossDevicePlayerDisplay } from './crossDevicePlayerDisplay';
import {
  formatPlaybackDeviceLabel,
  playerStatusLineKey,
  resolveCrossDevicePlayerDisplay,
  resolvePlayerStatusLine,
  selectPlaybackDeviceSwitchVisible,
  selectRemoteRowIsPlaying,
  selectRemoteRowMediaId,
} from './crossDevicePlayerDisplay';

const wholeSeconds = (positionSeconds: number | null): number | null => {
  if (positionSeconds === null) {
    return null;
  }
  return Math.floor(positionSeconds);
};

const readRemotePlaybackPositionSeconds = (): number | null => {
  return wholeSeconds(getCrossDevicePlaybackPositionSeconds(Date.now()));
};

const readPlaybackDeviceSwitchVisible = (): boolean => {
  return selectPlaybackDeviceSwitchVisible(getCrossDevicePlaybackView());
};

const readRemoteRowMediaId = (): string | null => {
  return selectRemoteRowMediaId(getCrossDevicePlaybackView());
};

const readRemoteRowIsPlaying = (): boolean => {
  return selectRemoteRowIsPlaying(getCrossDevicePlaybackView());
};

export function useCrossDevicePlaybackView(): CrossDevicePlaybackView {
  return useSyncExternalStore(
    subscribeCrossDevicePlaybackView,
    getCrossDevicePlaybackView,
    getCrossDevicePlaybackView
  );
}

/** Mini player and full player. Reads `isAuthoringHold` from `usePlaybackSession()`. */
export function useCrossDevicePlayerDisplay(): CrossDevicePlayerDisplay {
  const view = useCrossDevicePlaybackView();
  const { isAuthoringHold } = usePlaybackSession();
  return useMemo(
    () => resolveCrossDevicePlayerDisplay({ view, isAuthoringHold }),
    [view, isAuthoringHold]
  );
}

/** Whole-second estimate of the remote position; null when live or unknown. */
export function useRemotePlaybackPositionSeconds(): number | null {
  return useSyncExternalStore(
    subscribeCrossDevicePlaybackPositionClock,
    readRemotePlaybackPositionSeconds,
    readRemotePlaybackPositionSeconds
  );
}

export function usePlaybackDeviceSwitchVisible(): boolean {
  return useSyncExternalStore(
    subscribeCrossDevicePlaybackView,
    readPlaybackDeviceSwitchVisible,
    readPlaybackDeviceSwitchVisible
  );
}

/** Rows: the active media id and whether it plays, from the other device when it is active. */
export function usePlaybackRowDisplay(): {
  activeMediaId: string | null;
  isPlaying: boolean;
  isRemote: boolean;
} {
  const { activeTarget } = usePlaybackRow();
  const isPlaying = usePlaybackIsPlaying();
  const remoteId = useSyncExternalStore(
    subscribeCrossDevicePlaybackView,
    readRemoteRowMediaId,
    readRemoteRowMediaId
  );
  const remoteIsPlaying = useSyncExternalStore(
    subscribeCrossDevicePlaybackView,
    readRemoteRowIsPlaying,
    readRemoteRowIsPlaying
  );

  return useMemo(() => {
    if (remoteId !== null) {
      return { activeMediaId: remoteId, isPlaying: remoteIsPlaying, isRemote: true };
    }
    return {
      activeMediaId: activeTarget === null ? null : playbackTargetRowMediaId(activeTarget),
      isPlaying,
      isRemote: false,
    };
  }, [activeTarget, isPlaying, remoteId, remoteIsPlaying]);
}

/** Binds `formatPlaybackDeviceLabel` to `useTranslation().t`. */
export function usePlaybackDeviceLabel(): (entry: PlaybackDeviceListEntry | null) => string {
  const { t } = useTranslation();
  return useCallback(
    (entry: PlaybackDeviceListEntry | null) =>
      formatPlaybackDeviceLabel(entry, (key, values) =>
        values === undefined ? t(key) : t(key, values)
      ),
    [t]
  );
}

/** The translated status line for the mini player and the remote full player; null for none. */
export function usePlayerStatusText(display: CrossDevicePlayerDisplay): string | null {
  const view = useCrossDevicePlaybackView();
  const label = usePlaybackDeviceLabel();
  const { t } = useTranslation();
  return useMemo(() => {
    const line = resolvePlayerStatusLine({ view, display });
    if (line === null) {
      return null;
    }
    return t(playerStatusLineKey(line), { device: label(line.device) });
  }, [view, display, t, label]);
}
