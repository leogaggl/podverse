'use client';

import { useTranslations } from 'next-intl';
import { FaRotateRight } from 'react-icons/fa6';

import { MEDIA_JUMP_FORWARD_SECONDS } from '@podverse/helpers';

import { usePlayerTransport } from '../../../hooks/usePlayerTransport';

import styles from '../../../styles/components/MediaPlayer/Buttons/JumpForwardButtonMobile.module.scss';

export const JumpForwardButtonMobile = () => {
  const { jumpBy } = usePlayerTransport();
  const tMediaPlayer = useTranslations('media_player');

  const handleClick = () => {
    jumpBy(MEDIA_JUMP_FORWARD_SECONDS);
  };

  return (
    <button
      className={styles.jumpForwardButtonMobile}
      aria-label={tMediaPlayer('jump_forward', { seconds: MEDIA_JUMP_FORWARD_SECONDS })}
      onClick={handleClick}
      type="button"
    >
      <FaRotateRight aria-hidden />
    </button>
  );
};
