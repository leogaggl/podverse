'use client';

import { useMemo } from 'react';

import { useCrossDevicePlaybackSnapshot } from '../contexts/CrossDevicePlayback';
import { useMediaPlayer } from '../contexts/MediaPlayer';
import type { RemotePlayerDisplay } from '../lib/crossDevicePlayback/remotePlayerDisplay';
import { resolveRemotePlayerDisplay } from '../lib/crossDevicePlayback/remotePlayerDisplay';

export function useRemotePlayerDisplay(): RemotePlayerDisplay | null {
  const role = useCrossDevicePlaybackSnapshot((snapshot) => snapshot.role);
  const displayState = useCrossDevicePlaybackSnapshot((snapshot) => snapshot.displayState);
  return useMemo(() => resolveRemotePlayerDisplay({ role, displayState }), [role, displayState]);
}

/** True when the player bar has something to show: a local item or the remote view. */
export function useMediaPlayerBarVisible(): boolean {
  const remote = useRemotePlayerDisplay();
  const { mpAddByRSS, mpChannel } = useMediaPlayer();
  return !!mpChannel || !!mpAddByRSS || remote !== null;
}
