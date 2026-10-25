'use client';

import { useMemo } from 'react';

import type { RemotePlayerInfo } from '../lib/crossDevicePlayback/remotePlayerInfo';
import { resolveRemotePlayerInfo } from '../lib/crossDevicePlayback/remotePlayerInfo';
import { useRemotePlaybackPositionSeconds } from './useRemotePlaybackPositionSeconds';
import { useRemotePlayerDisplay } from './useRemotePlayerDisplay';
import { useRemotePlayerResource } from './useRemotePlayerResource';

export function useRemotePlayerInfo(): RemotePlayerInfo | null {
  const display = useRemotePlayerDisplay();
  const resourceState = useRemotePlayerResource();
  const position = useRemotePlaybackPositionSeconds(
    display !== null && display.controls.showsProgress
  );
  return useMemo(
    () =>
      display === null
        ? null
        : resolveRemotePlayerInfo({
            display,
            resource: resourceState.status === 'ready' ? resourceState.resource : null,
            positionSeconds: position,
          }),
    [display, resourceState, position]
  );
}
