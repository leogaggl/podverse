'use client';

import { useTranslations } from 'next-intl';
import { useEffect, useRef, useState } from 'react';

import { actionErrorDetailLine } from '@podverse/helpers';
import { Button, Modal } from '@podverse/ui';

import { useConfig } from '../../../contexts/Config';
import { useMediaPlayer } from '../../../contexts/MediaPlayer';
import { useMediaPlayerControls } from '../../../contexts/MediaPlayerControls';
import { useMediaPlayerCurrentTime } from '../../../contexts/MediaPlayerCurrentTime';
import { clearBlockedHostPlaybackAttempt } from '../../../utils/media/blockedHostPlayback';
import type { MPPlaybackError } from '../../../utils/media/playbackErrorCopy';
import {
  openablePlaybackMediaUrl,
  playbackErrorMessageKeys,
} from '../../../utils/media/playbackErrorCopy';

import styles from '../../../styles/components/MediaPlayer/MediaPlayer.module.scss';

const playbackErrorBody = (
  error: MPPlaybackError,
  tActionError: ReturnType<typeof useTranslations<'action_error'>>,
  brandName: string
): string => {
  const { bodyKey } = playbackErrorMessageKeys(error.kind);
  if (bodyKey === 'playback_host_blocked') {
    return tActionError('playback_host_blocked', { brand_name: brandName });
  }
  return tActionError(bodyKey);
};

/** Announces a playback failure once, and again only when the item, kind, or code changes. */
export const PlaybackErrorAnnouncer = () => {
  const tActionError = useTranslations('action_error');
  const brandName = useConfig().public.brand.name;
  const { mpPlaybackError } = useMediaPlayer();
  const [announcement, setAnnouncement] = useState('');
  const announcedSignatureRef = useRef('');

  useEffect(() => {
    if (mpPlaybackError === null) {
      announcedSignatureRef.current = '';
      return;
    }
    const signature = `${mpPlaybackError.identity}|${mpPlaybackError.kind}|${mpPlaybackError.code}`;
    if (announcedSignatureRef.current === signature) {
      return;
    }
    announcedSignatureRef.current = signature;
    const title = tActionError('playback_title');
    const body = playbackErrorBody(mpPlaybackError, tActionError, brandName);
    setAnnouncement(`${title}. ${body}`);
  }, [mpPlaybackError, tActionError, brandName]);

  return (
    <div aria-live="polite" className={styles.playbackErrorAnnouncer}>
      {announcement}
    </div>
  );
};

/** Explains why the loaded item cannot play. Cancel leaves the error in place. */
export const PlaybackErrorModal = () => {
  const tActionError = useTranslations('action_error');
  const tMisc = useTranslations('misc');
  const brandName = useConfig().public.brand.name;
  const {
    mpPlaybackError,
    playbackErrorDialogOpen,
    setPlaybackErrorDialogOpen,
    setMPIsPlaying,
    setMPPlaybackError,
    setMPShouldPlay,
  } = useMediaPlayer();
  const { readCurrentTimeSeconds, reloadAt } = useMediaPlayerControls();
  const { mpCurrentTime } = useMediaPlayerCurrentTime();

  if (mpPlaybackError === null) {
    return null;
  }

  const error = mpPlaybackError;
  const detail = actionErrorDetailLine({
    reason: error.kind,
    code: error.code,
    httpStatus: error.httpStatus,
    message: error.message,
  });
  const mediaLink = openablePlaybackMediaUrl(error.mediaUrl);
  const closeDialog = () => {
    setPlaybackErrorDialogOpen(false);
  };
  const tryAgain = () => {
    const seconds = readCurrentTimeSeconds() ?? mpCurrentTime;
    clearBlockedHostPlaybackAttempt(error.identity);
    setMPPlaybackError(null);
    setMPIsPlaying(true);
    setMPShouldPlay(true);
    reloadAt(seconds);
  };

  return (
    <Modal
      isOpen={playbackErrorDialogOpen}
      onClose={closeDialog}
      closeButtonAriaLabel={tMisc('close_modal')}
      header={tActionError('playback_title')}
      ariaLabel={tActionError('playback_a11y')}
    >
      <Modal.Body>
        <p>{playbackErrorBody(error, tActionError, brandName)}</p>
        {detail === '' ? null : <p>{tActionError('report', { detail })}</p>}
      </Modal.Body>
      <Modal.Actions>
        <Button variant="secondary" onClick={closeDialog}>
          {tMisc('cancel')}
        </Button>
        {mediaLink === null ? null : (
          <Button href={mediaLink} rel="noopener noreferrer" target="_blank" variant="secondary">
            {tActionError('open_media_link')}
          </Button>
        )}
        <Button onClick={tryAgain}>{tMisc('try_again')}</Button>
      </Modal.Actions>
    </Modal>
  );
};
