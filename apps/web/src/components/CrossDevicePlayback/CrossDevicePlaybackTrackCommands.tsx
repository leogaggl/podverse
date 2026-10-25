'use client';

import { useEffect, useRef } from 'react';

import { isPlaybackCommandAllowed, PLAYBACK_COMMAND_TTL_MS } from '@podverse/helpers';

import { useMediaPlayer } from '../../contexts/MediaPlayer';
import { useBindPlaybackResourceLoader } from '../../hooks/usePlaybackResourceLoader';
import { useTrackNextButtonActions } from '../../hooks/useTrackNextButtonActions';
import { useTrackPreviousButtonActions } from '../../hooks/useTrackPreviousButtonActions';
import { crossDevicePlaybackStore } from '../../lib/crossDevicePlayback/crossDevicePlaybackStore';
import { createPlaybackCommandInbox } from '../../lib/crossDevicePlayback/playbackCommandInbox';
import { isPlayerResourceLive } from '../../lib/crossDevicePlayback/playbackResource';

/** Runs cross-device `next` and `previous` commands through this tab's own Next and Previous click handlers. Renders nothing. */
export function CrossDevicePlaybackTrackCommands(): null {
  useBindPlaybackResourceLoader();
  const mediaPlayer = useMediaPlayer();
  const { runLocalClick: runNextClick } = useTrackNextButtonActions();
  const { runLocalClick: runPreviousClick } = useTrackPreviousButtonActions();

  const mediaPlayerRef = useRef(mediaPlayer);
  mediaPlayerRef.current = mediaPlayer;
  const runNextClickRef = useRef(runNextClick);
  runNextClickRef.current = runNextClick;
  const runPreviousClickRef = useRef(runPreviousClick);
  runPreviousClickRef.current = runPreviousClick;
  const inboxRef = useRef(createPlaybackCommandInbox());

  useEffect(() => {
    const inbox = inboxRef.current;
    return crossDevicePlaybackStore.subscribeToSignals((signal) => {
      if (signal.kind !== 'command') {
        return;
      }
      const { envelope, receivedAtMs } = signal;
      const commandType = envelope.command.type;
      if (commandType !== 'next' && commandType !== 'previous') {
        return;
      }
      if (!inbox.accept(envelope.command_id)) {
        return;
      }
      const snapshot = crossDevicePlaybackStore.getSnapshot();
      if (envelope.target_session_id_text !== snapshot.thisSessionIdText) {
        return;
      }
      if (!snapshot.thisTabHoldsAudio) {
        return;
      }
      if (Date.now() - receivedAtMs > PLAYBACK_COMMAND_TTL_MS) {
        return;
      }
      if (
        !isPlaybackCommandAllowed(commandType, {
          isLive: isPlayerResourceLive(mediaPlayerRef.current),
        })
      ) {
        return;
      }
      if (commandType === 'next') {
        void runNextClickRef.current().catch(() => {});
        return;
      }
      void runPreviousClickRef.current().catch(() => {});
    });
  }, []);

  return null;
}
