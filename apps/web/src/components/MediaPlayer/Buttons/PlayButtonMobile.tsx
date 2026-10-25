'use client';

import { useTranslations } from 'next-intl';
import { FaPause, FaPlay } from 'react-icons/fa6';

import { useMediaPlayer } from '../../../contexts/MediaPlayer';
import { usePlayerTransport } from '../../../hooks/usePlayerTransport';
import { playbackErrorIdentity } from '../../../utils/media/playbackErrorCopy';
import { PlaybackErrorButton } from './PlaybackErrorButton';

import styles from '../../../styles/components/MediaPlayer/Buttons/PlayButtonMobile.module.scss';

export const PlayButtonMobile = () => {
  const { mpAddByRSS, mpClip, mpItem, mpItemSoundbite, mpPlaybackError } = useMediaPlayer();
  const { isPlaying, togglePlayPause } = usePlayerTransport();
  const tMediaPlayer = useTranslations('media_player');
  const loadedIdentity = playbackErrorIdentity({
    addByRssResourceData: mpAddByRSS?.resourceData ?? null,
    itemIdText: mpItem?.id_text ?? null,
    clipIdText: mpClip?.id_text ?? null,
    soundbiteIdText: mpItemSoundbite?.id_text ?? null,
  });
  if (
    mpPlaybackError !== null &&
    loadedIdentity !== null &&
    mpPlaybackError.identity === loadedIdentity
  ) {
    return <PlaybackErrorButton className={styles.playButtonMobile} />;
  }
  const icon = isPlaying ? <FaPause aria-hidden /> : <FaPlay aria-hidden />;

  return (
    <button
      className={styles.playButtonMobile}
      aria-label={isPlaying ? tMediaPlayer('pause') : tMediaPlayer('play')}
      data-media-player-playing={isPlaying ? 'true' : undefined}
      onClick={togglePlayPause}
      type="button"
    >
      {icon}
    </button>
  );
};
