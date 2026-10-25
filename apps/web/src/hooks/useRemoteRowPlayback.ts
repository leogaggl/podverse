'use client';

import { useMemo, useSyncExternalStore } from 'react';

import type { DTOItemChapter } from '@podverse/helpers';

import type { PlaybackRowIdentity } from '../lib/crossDevicePlayback/remotePlaybackRowMatch';
import { matchesRemotePlaybackResource } from '../lib/crossDevicePlayback/remotePlaybackRowMatch';
import type { RemotePlayerDisplay } from '../lib/crossDevicePlayback/remotePlayerDisplay';
import type { RemotePlayerResourceState } from '../lib/crossDevicePlayback/remotePlayerResourceStore';
import {
  playbackResourceRefKey,
  remotePlayerResourceStore,
} from '../lib/crossDevicePlayback/remotePlayerResourceStore';
import { useRemoteActiveChapterIdText } from './useRemotePlaybackPositionSeconds';
import { useRemotePlayerDisplay } from './useRemotePlayerDisplay';

const SERVER_RESOURCE_STATE: RemotePlayerResourceState = { status: 'none', key: null };

function getServerResourceState(): RemotePlayerResourceState {
  return SERVER_RESOURCE_STATE;
}

/**
 * Chapters of the remote item, and only for a chapter row of that item. Other rows pass null so
 * they do not follow the position clock. This does not start a load; the player does.
 */
function remoteItemChaptersForChapterRow(
  chapterIdText: string | null,
  remote: RemotePlayerDisplay | null,
  resourceState: RemotePlayerResourceState
): DTOItemChapter[] | null {
  if (chapterIdText === null || remote === null || resourceState.status !== 'ready') {
    return null;
  }
  if (resourceState.key !== playbackResourceRefKey(remote.resource.ref)) {
    return null;
  }
  if (resourceState.resource.kind !== 'database') {
    return null;
  }
  return resourceState.resource.itemChapters;
}

export type RemoteRowPlayback = {
  isCurrent: boolean;
  isPlaying: boolean;
  showsProgress: boolean;
};

export function useRemoteRowPlayback(identity: PlaybackRowIdentity): RemoteRowPlayback {
  const { itemIdText, chapterIdText, clipIdText, soundbiteIdText, addByRSSHashIds } = identity;
  const remote = useRemotePlayerDisplay();
  const resourceState = useSyncExternalStore(
    remotePlayerResourceStore.subscribe,
    remotePlayerResourceStore.getState,
    getServerResourceState
  );
  const chapters = remoteItemChaptersForChapterRow(chapterIdText, remote, resourceState);
  const activeChapterIdText = useRemoteActiveChapterIdText(chapters, chapters !== null);

  return useMemo(() => {
    const rowIdentity: PlaybackRowIdentity = {
      itemIdText,
      chapterIdText,
      clipIdText,
      soundbiteIdText,
      addByRSSHashIds,
    };
    if (remote === null) {
      return { isCurrent: false, isPlaying: false, showsProgress: false };
    }
    const isCurrent = matchesRemotePlaybackResource(
      remote.resource.ref,
      rowIdentity,
      activeChapterIdText
    );
    return {
      isCurrent,
      isPlaying: isCurrent && remote.state.status !== 'paused',
      showsProgress: isCurrent && remote.controls.showsProgress,
    };
  }, [
    remote,
    activeChapterIdText,
    itemIdText,
    chapterIdText,
    clipIdText,
    soundbiteIdText,
    addByRSSHashIds,
  ]);
}
