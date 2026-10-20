'use client';

import { useTranslations } from 'next-intl';
import { FaCircleExclamation } from 'react-icons/fa6';

import { useMediaPlayer } from '../../../contexts/MediaPlayer';

type PlaybackErrorButtonProps = {
  className?: string;
};

/** Replaces play and pause while the loaded item cannot play. Opens the explanation. */
export const PlaybackErrorButton = ({ className }: PlaybackErrorButtonProps) => {
  const tActionError = useTranslations('action_error');
  const { setPlaybackErrorDialogOpen } = useMediaPlayer();

  return (
    <button
      className={className}
      aria-label={tActionError('playback_a11y')}
      onClick={() => {
        setPlaybackErrorDialogOpen(true);
      }}
      type="button"
    >
      <FaCircleExclamation aria-hidden />
    </button>
  );
};
