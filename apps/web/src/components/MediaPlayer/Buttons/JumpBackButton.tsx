'use client';

import { useTranslations } from 'next-intl';
import { FaRotateLeft } from 'react-icons/fa6';

import { MEDIA_JUMP_BACK_SECONDS } from '@podverse/helpers';

import { usePlayerTransport } from '../../../hooks/usePlayerTransport';

import styles from '../../../styles/components/MediaPlayer/Buttons/JumpBackButton.module.scss';

export const JumpBackButton = () => {
  const { jumpBy } = usePlayerTransport();
  const tMediaPlayer = useTranslations('media_player');

  const handleClick = () => {
    jumpBy(-MEDIA_JUMP_BACK_SECONDS);
  };

  return (
    <button
      className={styles.jumpBackButton}
      aria-label={tMediaPlayer('jump_back', { seconds: MEDIA_JUMP_BACK_SECONDS })}
      onClick={handleClick}
      type="button"
    >
      <FaRotateLeft aria-hidden />
    </button>
  );
};
