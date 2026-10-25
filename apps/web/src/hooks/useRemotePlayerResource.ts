'use client';

import { useEffect, useMemo, useRef, useSyncExternalStore } from 'react';

import { useCrossDevicePlaybackSnapshot } from '../contexts/CrossDevicePlayback';
import { useQueues } from '../contexts/Queue';
import type { RemotePlayerResourceState } from '../lib/crossDevicePlayback/remotePlayerResourceStore';
import {
  playbackResourceRefKey,
  remotePlayerResourceStore,
} from '../lib/crossDevicePlayback/remotePlayerResourceStore';

const SERVER_STATE: RemotePlayerResourceState = { status: 'none', key: null };

function getServerState(): RemotePlayerResourceState {
  return SERVER_STATE;
}

/** The remote item's records; `none` when this tab is not showing another device's item. */
export function useRemotePlayerResource(): RemotePlayerResourceState {
  const role = useCrossDevicePlaybackSnapshot((snapshot) => snapshot.role);
  const resource = useCrossDevicePlaybackSnapshot(
    (snapshot) => snapshot.displayState?.resource ?? null
  );
  const isLive = useCrossDevicePlaybackSnapshot(
    (snapshot) => snapshot.displayState?.is_live ?? false
  );
  const ref = role === 'remote' ? (resource?.ref ?? null) : null;
  const key = ref === null ? null : playbackResourceRefKey(ref);

  const { queues } = useQueues();
  const queuesRef = useRef(queues);
  queuesRef.current = queues;
  const playbackRef = useRef(ref);
  playbackRef.current = ref;

  // One load per ref. The latest ref and queue ids are read here so a snapshot or queue render
  // does not start another load for the same item.
  useEffect(() => {
    remotePlayerResourceStore.ensure({
      ref: playbackRef.current,
      isLive,
      queueIdTexts: queuesRef.current.map((queue) => queue.id_text),
    });
  }, [key, isLive]);

  const state = useSyncExternalStore(
    remotePlayerResourceStore.subscribe,
    remotePlayerResourceStore.getState,
    getServerState
  );

  const fallback = useMemo((): RemotePlayerResourceState => {
    if (key === null) {
      return { status: 'none', key: null };
    }
    return { status: 'loading', key };
  }, [key]);

  if (state.key === key) {
    return state;
  }
  return fallback;
}
