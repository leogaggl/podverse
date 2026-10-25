'use client';

/**
 * Behavior contract for the entire media player tree lives in
 * `apps/web/src/components/MediaPlayer/MEDIA-PLAYER-DECISION-MATRIX.md`.
 * That matrix is the regression oracle for any change inside this directory,
 * inside `Controller/`, and inside the queue/auto-queue hooks that feed it.
 * Update the matrix alongside production changes; orchestration tests under
 * `Controller/__tests__/` execute it as a contract.
 */

import { useEffect } from 'react';

import { useEmbedPlaybackGuardrails } from '../../contexts/EmbedPlaybackMode';
import { useMediaPlayerBarVisible } from '../../hooks/useRemotePlayerDisplay';
import {
  updateLayoutForMediaPlayer,
  updateLayoutForMediaPlayerSegmentStrip,
} from '../../utils/mediaPlayer/mediaPlayerLayout';
import { MediaPlayerDesktop } from './Desktop/MediaPlayerDesktop';
import { MediaPlayerMobile } from './Mobile/MediaPlayerMobile';
import { MediaPlayerModal } from './Modal/MediaPlayerModal';
import { PlaybackErrorAnnouncer, PlaybackErrorModal } from './Modal/PlaybackErrorModal';
import { useMediaPlayerSegmentStripVisible } from './SegmentStrip/mediaPlayerSegmentStripPresence';
import { SleepTimer } from './SleepTimer';

import styles from '../../styles/components/MediaPlayer/MediaPlayer.module.scss';

export const MediaPlayer = () => {
  const { skipMainAppLayoutMutations } = useEmbedPlaybackGuardrails();
  const isBarVisible = useMediaPlayerBarVisible();
  const segmentStripVisible = useMediaPlayerSegmentStripVisible();

  // The page reserves player space while the bar has a local item or another device's item.
  useEffect(() => {
    updateLayoutForMediaPlayer(isBarVisible, { skipMainAppLayoutMutations });
  }, [isBarVisible, skipMainAppLayoutMutations]);

  useEffect(() => {
    updateLayoutForMediaPlayerSegmentStrip(segmentStripVisible, { skipMainAppLayoutMutations });
    return () => {
      updateLayoutForMediaPlayerSegmentStrip(false, { skipMainAppLayoutMutations });
    };
  }, [segmentStripVisible, skipMainAppLayoutMutations]);

  return (
    <aside id="media-player" className={styles.player}>
      <SleepTimer />
      <MediaPlayerDesktop />
      <MediaPlayerMobile />
      <MediaPlayerModal />
      <PlaybackErrorAnnouncer />
      <PlaybackErrorModal />
    </aside>
  );
};
