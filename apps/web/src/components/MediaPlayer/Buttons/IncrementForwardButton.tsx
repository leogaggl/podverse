'use client';

import { useTranslations } from 'next-intl';
import { FaChevronRight } from 'react-icons/fa6';

import { MEDIA_JUMP_INCREMENT_SECONDS } from '@podverse/helpers';

import { usePlayerTransport } from '../../../hooks/usePlayerTransport';

import styles from '../../../styles/components/MediaPlayer/Buttons/IncrementForwardButton.module.scss';

export const IncrementForwardButton = () => {
  const { jumpBy } = usePlayerTransport();
  const tMediaPlayer = useTranslations('media_player');

  const handleClick = () => {
    jumpBy(MEDIA_JUMP_INCREMENT_SECONDS);
  };

  return (
    <button
      className={styles.incrementForwardButton}
      aria-label={tMediaPlayer('step_forward')}
      onClick={handleClick}
      type="button"
    >
      <FaChevronRight aria-hidden />
    </button>
  );
};
