'use client';

import { useTranslations } from 'next-intl';
import { useRef } from 'react';
import { FaCirclePlus } from 'react-icons/fa6';

import { useMediaPlayer } from '../../../contexts/MediaPlayer';
import { useModals } from '../../../contexts/Modals';
import { useRemotePlayerDisplay } from '../../../hooks/useRemotePlayerDisplay';
import { useRemotePlayerResource } from '../../../hooks/useRemotePlayerResource';
import { crossDevicePlaybackStore } from '../../../lib/crossDevicePlayback/crossDevicePlaybackStore';
import {
  playbackResourceRefKey,
  remotePlayerResourceStore,
} from '../../../lib/crossDevicePlayback/remotePlayerResourceStore';
import { showToast } from '../../Toast/Toast';

import styles from '../../../styles/components/MediaPlayer/Buttons/PlaylistAddToButton.module.scss';

function currentRemoteRefKey(): string | null {
  const snapshot = crossDevicePlaybackStore.getSnapshot();
  if (snapshot.role !== 'remote') {
    return null;
  }
  const ref = snapshot.displayState?.resource?.ref ?? null;
  return ref === null ? null : playbackResourceRefKey(ref);
}

export const PlaylistAddToButton = () => {
  const { mpChannel, mpClip, mpItem, mpItemSoundbite } = useMediaPlayer();
  const { setModalPlaylistAddTo } = useModals();
  const remote = useRemotePlayerDisplay();
  const remoteResource = useRemotePlayerResource();
  const tFeatures = useTranslations('features');
  const remoteClickInFlightRef = useRef(false);
  const isRemoteAddByRSSUnavailable =
    remote !== null &&
    remote.resource.ref.kind === 'add_by_rss' &&
    remoteResource.status !== 'ready';

  const openRemotePlaylist = async () => {
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
      const resource = settled.resource;
      switch (resource.kind) {
        case 'database':
          setModalPlaylistAddTo({
            channel: resource.channel,
            item: resource.item,
            clip: resource.clip,
            item_soundbite: resource.itemSoundbite,
            addByRSSResourceData: null,
            addByRSSHashId: null,
          });
          return;
        case 'add_by_rss':
          setModalPlaylistAddTo({
            channel: null,
            item: null,
            clip: null,
            item_soundbite: null,
            addByRSSResourceData: resource.resourceData,
            addByRSSHashId: resource.hashId,
          });
          return;
        default: {
          const _unhandled: never = resource;
          void _unhandled;
        }
      }
    } finally {
      remoteClickInFlightRef.current = false;
    }
  };

  const onClick = () => {
    if (remote === null) {
      setModalPlaylistAddTo({
        channel: mpChannel,
        item: mpItem,
        clip: mpClip,
        item_soundbite: mpItemSoundbite,
      });
      return;
    }
    void openRemotePlaylist();
  };

  return (
    <button
      aria-label={tFeatures('playlist.add_to_playlist')}
      className={styles.playlistAddToButton}
      disabled={isRemoteAddByRSSUnavailable}
      onClick={onClick}
      type="button"
    >
      <FaCirclePlus aria-hidden />
    </button>
  );
};
