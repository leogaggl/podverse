'use client';

import { useCallback, useEffect, useRef, useSyncExternalStore } from 'react';

import { isPlaybackCommandAllowed, PLAYBACK_COMMAND_TTL_MS } from '@podverse/helpers';

import { useMediaPlayer } from '../contexts/MediaPlayer';
import { useMediaPlayerControls } from '../contexts/MediaPlayerControls';
import { applyCommandSeekToLoadedFile } from '../lib/crossDevicePlayback/commandStartSeek';
import type { CrossDevicePlaybackSnapshot } from '../lib/crossDevicePlayback/crossDevicePlaybackStore';
import { crossDevicePlaybackStore } from '../lib/crossDevicePlayback/crossDevicePlaybackStore';
import { createPlaybackCommandInbox } from '../lib/crossDevicePlayback/playbackCommandInbox';
import {
  buildPlaybackResourceRefFromPlayer,
  isPlayerResourceLive,
  nearestPlaybackSpeedValue,
} from '../lib/crossDevicePlayback/playbackResource';
import { reportPlaybackStartFailed } from '../lib/crossDevicePlayback/reportPlaybackStartFailed';
import {
  setBoundPlaybackCurrentTime,
  usePlaybackResourceLoader,
} from './usePlaybackResourceLoader';

/** How long a commanded start stays open for a blocked or failed play. */
const PENDING_COMMAND_START_MS = 15_000;
/** A tap-to-play prompt older than this is dismissed. */
const TAP_TO_PLAY_MAX_AGE_MS = 60_000;
const TAP_TO_PLAY_DISMISS_INTERVAL_MS = 1_000;

function readTapToPlay(): CrossDevicePlaybackSnapshot['tapToPlay'] {
  return crossDevicePlaybackStore.getSnapshot().tapToPlay;
}

function readServerTapToPlay(): CrossDevicePlaybackSnapshot['tapToPlay'] {
  return null;
}

export function useCrossDevicePlaybackCommandExecutor(): {
  confirmTapToPlay: () => void;
  dismissTapToPlay: () => void;
} {
  const mediaPlayer = useMediaPlayer();
  const controls = useMediaPlayerControls();
  const loadPlaybackResource = usePlaybackResourceLoader();
  const tapToPlay = useSyncExternalStore(
    crossDevicePlaybackStore.subscribe,
    readTapToPlay,
    readServerTapToPlay
  );

  const mediaPlayerRef = useRef(mediaPlayer);
  mediaPlayerRef.current = mediaPlayer;
  const controlsRef = useRef(controls);
  controlsRef.current = controls;
  const loadPlaybackResourceRef = useRef(loadPlaybackResource);
  loadPlaybackResourceRef.current = loadPlaybackResource;
  const pendingTimerRef = useRef<number | null>(null);
  const inboxRef = useRef(createPlaybackCommandInbox());
  const previousPlaybackErrorRef = useRef(mediaPlayer.mpPlaybackError);

  const clearPendingStart = useCallback((commandIdText: string) => {
    const pending = crossDevicePlaybackStore.getSnapshot().pendingCommandStart;
    if (pending?.commandIdText !== commandIdText) {
      return;
    }
    if (pendingTimerRef.current !== null) {
      window.clearTimeout(pendingTimerRef.current);
      pendingTimerRef.current = null;
    }
    crossDevicePlaybackStore.setPendingCommandStart(null);
  }, []);

  const notePendingStart = useCallback((commandIdText: string) => {
    crossDevicePlaybackStore.setPendingCommandStart(commandIdText);
    if (pendingTimerRef.current !== null) {
      window.clearTimeout(pendingTimerRef.current);
    }
    pendingTimerRef.current = window.setTimeout(() => {
      pendingTimerRef.current = null;
      const pending = crossDevicePlaybackStore.getSnapshot().pendingCommandStart;
      if (pending?.commandIdText === commandIdText) {
        crossDevicePlaybackStore.setPendingCommandStart(null);
      }
    }, PENDING_COMMAND_START_MS);
  }, []);

  const clearPendingStartRef = useRef(clearPendingStart);
  clearPendingStartRef.current = clearPendingStart;
  const notePendingStartRef = useRef(notePendingStart);
  notePendingStartRef.current = notePendingStart;

  const confirmTapToPlay = useCallback(() => {
    crossDevicePlaybackStore.setTapToPlay(null);
    mediaPlayerRef.current.setMPIsPlaying(true);
  }, []);

  const dismissTapToPlay = useCallback(() => {
    crossDevicePlaybackStore.setTapToPlay(null);
    const snapshot = crossDevicePlaybackStore.getSnapshot();
    if (snapshot.claimPending && !snapshot.thisTabHoldsAudio) {
      crossDevicePlaybackStore.abandonClaim();
    }
  }, []);

  const dismissTapToPlayRef = useRef(dismissTapToPlay);
  dismissTapToPlayRef.current = dismissTapToPlay;
  const tapToPlaySetAtMsRef = useRef<number | null>(null);

  useEffect(() => {
    if (tapToPlay === null) {
      tapToPlaySetAtMsRef.current = null;
      return;
    }
    tapToPlaySetAtMsRef.current = Date.now();
    const intervalId = window.setInterval(() => {
      const setAtMs = tapToPlaySetAtMsRef.current;
      if (setAtMs === null) {
        return;
      }
      if (Date.now() - setAtMs >= TAP_TO_PLAY_MAX_AGE_MS) {
        dismissTapToPlayRef.current();
      }
    }, TAP_TO_PLAY_DISMISS_INTERVAL_MS);
    return () => {
      window.clearInterval(intervalId);
    };
  }, [tapToPlay]);

  useEffect(() => {
    const previous = previousPlaybackErrorRef.current;
    previousPlaybackErrorRef.current = mediaPlayer.mpPlaybackError;
    if (previous !== null || mediaPlayer.mpPlaybackError === null) {
      return;
    }
    const pending = crossDevicePlaybackStore.getSnapshot().pendingCommandStart;
    if (pending === null) {
      return;
    }
    if (Date.now() - pending.atMs > PENDING_COMMAND_START_MS) {
      clearPendingStartRef.current(pending.commandIdText);
      return;
    }
    reportPlaybackStartFailed(pending.commandIdText, 'load_failed');
    clearPendingStartRef.current(pending.commandIdText);
  }, [mediaPlayer.mpPlaybackError]);

  useEffect(() => {
    const inbox = inboxRef.current;
    const unsubscribe = crossDevicePlaybackStore.subscribeToSignals((signal) => {
      if (signal.kind === 'local_play_blocked') {
        const pending = crossDevicePlaybackStore.getSnapshot().pendingCommandStart;
        if (pending === null) {
          return;
        }
        if (Date.now() - pending.atMs > PENDING_COMMAND_START_MS) {
          clearPendingStartRef.current(pending.commandIdText);
          return;
        }
        reportPlaybackStartFailed(pending.commandIdText, 'autoplay_blocked');
        mediaPlayerRef.current.setMPIsPlaying(false);
        crossDevicePlaybackStore.setTapToPlay({ commandIdText: pending.commandIdText });
        clearPendingStartRef.current(pending.commandIdText);
        return;
      }
      if (signal.kind !== 'command') {
        return;
      }
      const { envelope, receivedAtMs } = signal;
      const command = envelope.command;
      if (command.type === 'take_over' || command.type === 'next' || command.type === 'previous') {
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
        !isPlaybackCommandAllowed(command.type, {
          isLive: isPlayerResourceLive(mediaPlayerRef.current),
        })
      ) {
        return;
      }

      switch (command.type) {
        case 'play':
          notePendingStartRef.current(envelope.command_id);
          mediaPlayerRef.current.setMPIsPlaying(true);
          return;
        case 'pause':
          mediaPlayerRef.current.setMPIsPlaying(false);
          return;
        case 'seek':
          applyCommandSeekToLoadedFile({
            seconds: command.position_seconds,
            ref: buildPlaybackResourceRefFromPlayer(mediaPlayerRef.current),
            controls: controlsRef.current,
            setMPCurrentTime: setBoundPlaybackCurrentTime,
            nowMs: Date.now(),
          });
          return;
        case 'set_rate':
          mediaPlayerRef.current.setMPPlaybackSpeed(nearestPlaybackSpeedValue(command.rate));
          return;
        case 'play_item': {
          const commandIdText = envelope.command_id;
          const resource = command.resource;
          const addByRSSResourceData = command.add_by_rss_resource_data;
          const startSeconds = command.start_seconds;
          notePendingStartRef.current(commandIdText);
          void (async () => {
            try {
              const loaded = await loadPlaybackResourceRef.current({
                resource,
                addByRSSResourceData,
                startSeconds,
                receivedAtMs,
              });
              if (loaded) {
                return;
              }
            } catch {
              // The load threw; report it as unresolved below.
            }
            reportPlaybackStartFailed(commandIdText, 'load_failed');
            clearPendingStartRef.current(commandIdText);
          })();
          return;
        }
        default: {
          const _unhandled: never = command;
          void _unhandled;
          return;
        }
      }
    });

    return () => {
      unsubscribe();
      if (pendingTimerRef.current !== null) {
        window.clearTimeout(pendingTimerRef.current);
        pendingTimerRef.current = null;
      }
    };
  }, []);

  return { confirmTapToPlay, dismissTapToPlay };
}
