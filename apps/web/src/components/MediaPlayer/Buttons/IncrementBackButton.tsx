'use client';

import { useTranslations } from 'next-intl';
import { FaChevronLeft } from 'react-icons/fa6';

import { MEDIA_JUMP_INCREMENT_SECONDS } from '@podverse/helpers';

import { usePlayerTransport } from '../../../hooks/usePlayerTransport';

import styles from '../../../styles/components/MediaPlayer/Buttons/IncrementBackButton.module.scss';

export const IncrementBackButton = () => {
  const { jumpBy } = usePlayerTransport();
  const tMediaPlayer = useTranslations('media_player');

  const handleClick = () => {
    jumpBy(-MEDIA_JUMP_INCREMENT_SECONDS);
  };

  return (
    <button
      className={styles.incrementBackButton}
      aria-label={tMediaPlayer('step_back')}
      onClick={handleClick}
      type="button"
    >
      <FaChevronLeft aria-hidden />
    </button>
  );
};
