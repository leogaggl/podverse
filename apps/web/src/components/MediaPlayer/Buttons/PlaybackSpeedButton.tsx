'use client';

import { useTranslations } from 'next-intl';

import { getPlaybackTranslationKey } from '@podverse/helpers';

import { usePlayerTransport } from '../../../hooks/usePlayerTransport';

import styles from '../../../styles/components/MediaPlayer/Buttons/PlaybackSpeedButton.module.scss';

export const PlaybackSpeedButton = () => {
  const tMediaPlayer = useTranslations('media_player');
  const { playbackSpeed, cyclePlaybackSpeed } = usePlayerTransport();
  const speedLabel = tMediaPlayer(
    `playback_speed.speeds.${getPlaybackTranslationKey(playbackSpeed)}`
  );

  const onClick = () => {
    cyclePlaybackSpeed();
  };

  return (
    <button
      className={styles.playbackSpeedButton}
      aria-label={tMediaPlayer('playback_speed.playback_speed_with_value', { speed: speedLabel })}
      onClick={onClick}
      type="button"
    >
      {speedLabel}
    </button>
  );
};
