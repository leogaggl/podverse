'use client';

import { useTranslations } from 'next-intl';
import { useRef } from 'react';
import { FaShare } from 'react-icons/fa6';

import type { DTOItemChapter } from '@podverse/helpers';

import { useMediaPlayer } from '../../../contexts/MediaPlayer';
import { useModals } from '../../../contexts/Modals';
import { useRemotePlayerDisplay } from '../../../hooks/useRemotePlayerDisplay';
import { useRemotePlayerResource } from '../../../hooks/useRemotePlayerResource';
import { crossDevicePlaybackStore } from '../../../lib/crossDevicePlayback/crossDevicePlaybackStore';
import { getRemotePlaybackWholeSeconds } from '../../../lib/crossDevicePlayback/remotePlaybackClock';
import { resolveRemotePlayerDisplay } from '../../../lib/crossDevicePlayback/remotePlayerDisplay';
import { resolveRemotePlayerInfo } from '../../../lib/crossDevicePlayback/remotePlayerInfo';
import type { RemotePlayerResource } from '../../../lib/crossDevicePlayback/remotePlayerResourceStore';
import {
  playbackResourceRefKey,
  remotePlayerResourceStore,
} from '../../../lib/crossDevicePlayback/remotePlayerResourceStore';
import { selectItemChapterForTime } from '../../../lib/playback';
import type { MediaPlayerSegmentStripSegment } from '../../../utils/mediaPlayer/mediaPlayerSegmentStrip';
import { showToast } from '../../Toast/Toast';

import styles from '../../../styles/components/MediaPlayer/Buttons/ShareButton.module.scss';

/**
 * The chapter the strip is naming, when that chapter is in the loaded list.
 * The strip follows the same time rule as the local player.
 */
function itemChapterNamedByStrip(
  chapters: DTOItemChapter[] | null,
  segment: MediaPlayerSegmentStripSegment | null,
  positionSeconds: number
): DTOItemChapter | null {
  if (chapters === null || segment === null || segment.kind !== 'chapter') {
    return null;
  }
  const active = selectItemChapterForTime(chapters, positionSeconds);
  if (active === null) {
    return null;
  }
  const named = chapters.find((chapter) => chapter.id_text === active.id_text) ?? null;
  if (named === null) {
    return null;
  }
  const title = named.title?.trim() ?? '';
  if (title !== segment.title) {
    return null;
  }
  return named;
}

function currentRemoteRefKey(): string | null {
  const snapshot = crossDevicePlaybackStore.getSnapshot();
  if (snapshot.role !== 'remote') {
    return null;
  }
  const ref = snapshot.displayState?.resource?.ref ?? null;
  return ref === null ? null : playbackResourceRefKey(ref);
}

export const ShareButton = () => {
  const { mpChannel, mpClip, mpItem, mpItemChapter, mpItemSoundbite } = useMediaPlayer();
  const { setModalShare } = useModals();
  const remote = useRemotePlayerDisplay();
  const remoteResource = useRemotePlayerResource();
  const tFeatures = useTranslations('features');
  const remoteClickInFlightRef = useRef(false);
  const disabled =
    remote !== null
      ? remote.resource.ref.kind === 'add_by_rss'
      : mpChannel === null && mpItem === null;

  const openRemoteShare = async () => {
    if (remoteClickInFlightRef.current) {
      return;
    }
    remoteClickInFlightRef.current = true;
    try {
      const settled =
        remoteResource.status === 'loading'
          ? await remotePlayerResourceStore.whenSettled()
          : remoteResource;
      const currentKey = currentRemoteRefKey();
      if (settled.status !== 'ready' || currentKey === null || settled.key !== currentKey) {
        showToast(tFeatures('playlist.add_error'), 'error');
        return;
      }
      const resource: RemotePlayerResource = settled.resource;
      if (resource.kind === 'add_by_rss') {
        return;
      }
      const snapshot = crossDevicePlaybackStore.getSnapshot();
      const display = resolveRemotePlayerDisplay({
        role: snapshot.role,
        displayState: snapshot.displayState,
      });
      if (display === null) {
        showToast(tFeatures('playlist.add_error'), 'error');
        return;
      }
      const positionSeconds = display.controls.showsProgress
        ? getRemotePlaybackWholeSeconds()
        : null;
      const info = resolveRemotePlayerInfo({
        display,
        resource,
        positionSeconds,
      });
      const itemChapter = itemChapterNamedByStrip(
        resource.itemChapters,
        info.segment,
        positionSeconds ?? 0
      );
      setModalShare({
        channel: resource.channel,
        item: resource.item,
        clip: resource.clip,
        item_chapter: itemChapter,
        item_soundbite: resource.itemSoundbite,
        playlist: null,
        playlist_item: null,
      });
    } finally {
      remoteClickInFlightRef.current = false;
    }
  };

  const onClick = () => {
    if (remote === null) {
      setModalShare({
        channel: mpChannel,
        item: mpItem,
        clip: mpClip,
        item_chapter: mpItemChapter,
        item_soundbite: mpItemSoundbite,
        playlist: null,
        playlist_item: null,
      });
      return;
    }
    void openRemoteShare();
  };

  return (
    <button
      aria-label={tFeatures('share')}
      className={styles.shareButton}
      disabled={disabled}
      onClick={onClick}
      type="button"
    >
      <FaShare aria-hidden />
    </button>
  );
};
