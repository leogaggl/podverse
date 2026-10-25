'use client';

import { useTranslations } from 'next-intl';
import { FaRotateLeft } from 'react-icons/fa6';

import { MEDIA_JUMP_BACK_SECONDS } from '@podverse/helpers';

import { usePlayerTransport } from '../../../hooks/usePlayerTransport';

import styles from '../../../styles/components/MediaPlayer/Buttons/JumpBackButtonMobile.module.scss';

export const JumpBackButtonMobile = () => {
  const { jumpBy } = usePlayerTransport();
  const tMediaPlayer = useTranslations('media_player');

  const handleClick = () => {
    jumpBy(-MEDIA_JUMP_BACK_SECONDS);
  };

  return (
    <button
      className={styles.jumpBackButtonMobile}
      aria-label={tMediaPlayer('jump_back', { seconds: MEDIA_JUMP_BACK_SECONDS })}
      onClick={handleClick}
      type="button"
    >
      <FaRotateLeft aria-hidden />
    </button>
  );
};
