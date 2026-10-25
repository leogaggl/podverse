'use client';

import { useCallback, useEffect, useRef } from 'react';

import type {
  AddByRSSResourceData,
  DTOPlaybackCommandEnvelope,
  PlaybackCommandSendResponse,
} from '@podverse/helpers';
import {
  PLAYBACK_COMMAND_TTL_MS,
  PLAYBACK_ERROR_CODES,
  PLAYBACK_TAKE_OVER_RESULT_TIMEOUT_MS,
} from '@podverse/helpers';
import { parseMembershipGateError, parsePlaybackApiError } from '@podverse/helpers-requests';

import { useMediaPlayer } from '../contexts/MediaPlayer';
import { useQueues } from '../contexts/Queue';
import { getApiRequestService } from '../factories/apiRequestService';
import { findAddByRSSResourceDataForHash } from '../lib/crossDevicePlayback/addByRSSResourceDataForHash';
import type { CrossDevicePlaybackSnapshot } from '../lib/crossDevicePlayback/crossDevicePlaybackStore';
import { crossDevicePlaybackStore } from '../lib/crossDevicePlayback/crossDevicePlaybackStore';
import { createPlaybackCommandInbox } from '../lib/crossDevicePlayback/playbackCommandInbox';
import { reportPlaybackStartFailed } from '../lib/crossDevicePlayback/reportPlaybackStartFailed';
import type { TakeOverStart } from '../lib/crossDevicePlayback/resolveTakeOverStart';
import { resolveTakeOverStart } from '../lib/crossDevicePlayback/resolveTakeOverStart';
import { shouldThisTabHandleTakeOver } from '../lib/crossDevicePlayback/takeOverTabChoice';
import { usePlaybackResourceLoader } from './usePlaybackResourceLoader';

/** How long a take-over's start stays open for a blocked or failed play. */
const TAKE_OVER_START_WINDOW_MS = 15_000;

function isReceiptFresh(receivedAtMs: number): boolean {
  return Date.now() - receivedAtMs <= PLAYBACK_COMMAND_TTL_MS;
}

function isClaimHeld(): boolean {
  const snapshot = crossDevicePlaybackStore.getSnapshot();
  return snapshot.claimPending || snapshot.thisTabHoldsAudio;
}

function isCommandStartOpen(pending: CrossDevicePlaybackSnapshot['pendingCommandStart']): boolean {
  return pending !== null && Date.now() - pending.atMs <= TAKE_OVER_START_WINDOW_MS;
}

/**
 * Moves playback between devices. `transferTo` another session sends one `take_over` command and
 * tracks its result; `transferTo` this session, or `takeOverHere`, takes over in this tab. When this
 * session receives a take-over, one tab loads the shared item where the other device was, starts
 * it, and claims; the previous device stops when the claim lands.
 */
export function useCrossDevicePlaybackTransfer(params: {
  checkInNow: () => void;
  tabChannelAvailable: boolean;
}): {
  transferTo: (targetSessionIdText: string) => Promise<void>;
  takeOverHere: () => Promise<void>;
  dismissTransferFailure: () => void;
} {
  const { setMPIsPlaying, setMPPlaybackSpeed } = useMediaPlayer();
  const { queues } = useQueues();
  const loadPlaybackResource = usePlaybackResourceLoader();

  const checkInNowRef = useRef(params.checkInNow);
  checkInNowRef.current = params.checkInNow;
  const tabChannelAvailableRef = useRef(params.tabChannelAvailable);
  tabChannelAvailableRef.current = params.tabChannelAvailable;
  const setMPIsPlayingRef = useRef(setMPIsPlaying);
  setMPIsPlayingRef.current = setMPIsPlaying;
  const setMPPlaybackSpeedRef = useRef(setMPPlaybackSpeed);
  setMPPlaybackSpeedRef.current = setMPPlaybackSpeed;
  const queuesRef = useRef(queues);
  queuesRef.current = queues;
  const loadPlaybackResourceRef = useRef(loadPlaybackResource);
  loadPlaybackResourceRef.current = loadPlaybackResource;

  const inboxRef = useRef(createPlaybackCommandInbox());
  const transferGenerationRef = useRef(0);
  const transferTimerRef = useRef<number | null>(null);
  const pendingStartTimerRef = useRef<number | null>(null);
  /** When this tab last began a local take-over; a blocked play within the window shows tap-to-play. */
  const localTakeOverAtMsRef = useRef<number | null>(null);

  const clearTransferTimer = useCallback(() => {
    if (transferTimerRef.current !== null) {
      window.clearTimeout(transferTimerRef.current);
      transferTimerRef.current = null;
    }
  }, []);

  const notePendingStart = useCallback((commandIdText: string) => {
    crossDevicePlaybackStore.setPendingCommandStart(commandIdText);
    if (pendingStartTimerRef.current !== null) {
      window.clearTimeout(pendingStartTimerRef.current);
    }
    pendingStartTimerRef.current = window.setTimeout(() => {
      pendingStartTimerRef.current = null;
      const pending = crossDevicePlaybackStore.getSnapshot().pendingCommandStart;
      if (pending?.commandIdText === commandIdText) {
        crossDevicePlaybackStore.setPendingCommandStart(null);
      }
    }, TAKE_OVER_START_WINDOW_MS);
  }, []);

  const clearPendingStart = useCallback((commandIdText: string) => {
    const pending = crossDevicePlaybackStore.getSnapshot().pendingCommandStart;
    if (pending?.commandIdText !== commandIdText) {
      return;
    }
    if (pendingStartTimerRef.current !== null) {
      window.clearTimeout(pendingStartTimerRef.current);
      pendingStartTimerRef.current = null;
    }
    crossDevicePlaybackStore.setPendingCommandStart(null);
  }, []);

  /** Resolves Add by RSS data when needed, then loads and starts the item at the take-over start. */
  const runTakeOverLoad = useCallback(
    async (input: {
      start: TakeOverStart;
      isStillWanted: () => boolean;
      receivedAtMs?: number;
    }): Promise<boolean> => {
      const { start, isStillWanted, receivedAtMs } = input;
      let addByRSSResourceData: AddByRSSResourceData | null = null;
      if (start.resource.kind === 'add_by_rss') {
        addByRSSResourceData = await findAddByRSSResourceDataForHash({
          queueIdTexts: queuesRef.current.map((queue) => queue.id_text),
          hash: start.resource.add_by_rss_hash_id,
        });
        if (addByRSSResourceData === null) {
          return false;
        }
      }
      if (!isStillWanted()) {
        return false;
      }
      const loaded = await loadPlaybackResourceRef.current({
        resource: start.resource,
        addByRSSResourceData,
        startSeconds: start.startSeconds,
        ...(receivedAtMs === undefined ? {} : { receivedAtMs }),
      });
      if (loaded && start.rate !== null) {
        setMPPlaybackSpeedRef.current(start.rate);
      }
      return loaded;
    },
    []
  );

  const handleTakeOverCommand = useCallback(
    (envelope: DTOPlaybackCommandEnvelope, receivedAtMs: number) => {
      const store = crossDevicePlaybackStore;
      if (!inboxRef.current.accept(envelope.command_id)) {
        return;
      }
      const snapshot = store.getSnapshot();
      if (envelope.target_session_id_text !== snapshot.thisSessionIdText) {
        return;
      }
      if (
        !shouldThisTabHandleTakeOver({
          snapshot,
          tabChannelAvailable: tabChannelAvailableRef.current,
          isVisible: document.visibilityState === 'visible',
        })
      ) {
        return;
      }
      if (!isReceiptFresh(receivedAtMs)) {
        return;
      }

      const commandIdText = envelope.command_id;
      localTakeOverAtMsRef.current = null;
      store.beginClaim();
      notePendingStart(commandIdText);

      const fail = () => {
        reportPlaybackStartFailed(commandIdText, 'load_failed');
        store.abandonClaim();
        clearPendingStart(commandIdText);
      };

      const start =
        envelope.state === null
          ? null
          : resolveTakeOverStart({ state: envelope.state, receivedAtMs, nowMs: Date.now() });
      if (start === null) {
        fail();
        return;
      }

      void runTakeOverLoad({
        start,
        isStillWanted: () => isReceiptFresh(receivedAtMs) && isClaimHeld(),
        receivedAtMs,
      }).then(
        (loaded) => {
          if (!loaded) {
            fail();
          }
        },
        () => {
          fail();
        }
      );
    },
    [clearPendingStart, notePendingStart, runTakeOverLoad]
  );

  const takeOverHere = useCallback(async () => {
    const store = crossDevicePlaybackStore;
    const snapshot = store.getSnapshot();
    if (snapshot.role === 'active' || snapshot.displayState === null) {
      return;
    }
    const nowMs = Date.now();
    const resolved = resolveTakeOverStart({
      state: snapshot.displayState,
      receivedAtMs: snapshot.stateReceivedAtMs ?? nowMs,
      nowMs,
    });
    if (resolved === null) {
      return;
    }
    // The store's estimate also accounts for a command patch this tab applied to `displayState`.
    const start: TakeOverStart =
      resolved.startSeconds === null
        ? resolved
        : {
            ...resolved,
            startSeconds: store.getEstimatedPositionSeconds() ?? resolved.startSeconds,
          };

    store.beginClaim();
    localTakeOverAtMsRef.current = nowMs;
    const loaded = await runTakeOverLoad({ start, isStillWanted: isClaimHeld }).catch(() => false);
    if (loaded) {
      return;
    }
    if (localTakeOverAtMsRef.current === nowMs) {
      localTakeOverAtMsRef.current = null;
    }
    const after = store.getSnapshot();
    if (after.claimPending && !after.thisTabHoldsAudio) {
      store.abandonClaim();
    }
  }, [runTakeOverLoad]);

  const applyTransferRequestError = useCallback((error: unknown, targetSessionIdText: string) => {
    const store = crossDevicePlaybackStore;
    if (parseMembershipGateError(error) !== null) {
      store.markUnavailable();
      return;
    }
    const code = parsePlaybackApiError(error)?.code;
    if (code === PLAYBACK_ERROR_CODES.targetAlreadyActive) {
      return;
    }
    if (code === PLAYBACK_ERROR_CODES.deviceNotConnected) {
      store.setTransferFailure({ targetSessionIdText, reason: 'not_connected' });
      checkInNowRef.current();
      return;
    }
    store.setTransferFailure({ targetSessionIdText, reason: 'request_failed' });
  }, []);

  const transferTo = useCallback(
    async (targetSessionIdText: string) => {
      const store = crossDevicePlaybackStore;
      const generation = transferGenerationRef.current + 1;
      transferGenerationRef.current = generation;
      clearTransferTimer();
      store.setPendingTransfer(null);
      store.setTransferFailure(null);

      if (targetSessionIdText === store.getSnapshot().thisSessionIdText) {
        await takeOverHere();
        return;
      }

      const sentAtMs = Date.now();
      let response: PlaybackCommandSendResponse;
      try {
        response = await getApiRequestService().reqAccountPlaybackSendCommand({
          target_session_id_text: targetSessionIdText,
          command: { type: 'take_over' },
        });
      } catch (error: unknown) {
        if (generation === transferGenerationRef.current) {
          applyTransferRequestError(error, targetSessionIdText);
        }
        return;
      }
      if (generation !== transferGenerationRef.current) {
        return;
      }
      // The target's claim can land before the 202 does; then there is nothing left to wait for.
      if (store.getSnapshot().state?.active_session_id_text === targetSessionIdText) {
        return;
      }

      const commandIdText = response.command_id;
      store.setPendingTransfer({ commandIdText, targetSessionIdText, sentAtMs });
      transferTimerRef.current = window.setTimeout(() => {
        transferTimerRef.current = null;
        if (store.getSnapshot().pendingTransfer?.commandIdText !== commandIdText) {
          return;
        }
        store.setTransferFailure({ targetSessionIdText, reason: 'no_response' });
        store.setPendingTransfer(null);
      }, PLAYBACK_TAKE_OVER_RESULT_TIMEOUT_MS);
    },
    [applyTransferRequestError, clearTransferTimer, takeOverHere]
  );

  const dismissTransferFailure = useCallback(() => {
    crossDevicePlaybackStore.setTransferFailure(null);
  }, []);

  const handleTakeOverCommandRef = useRef(handleTakeOverCommand);
  handleTakeOverCommandRef.current = handleTakeOverCommand;
  const clearTransferTimerRef = useRef(clearTransferTimer);
  clearTransferTimerRef.current = clearTransferTimer;

  useEffect(() => {
    const store = crossDevicePlaybackStore;
    const unsubscribe = store.subscribeToSignals((signal) => {
      switch (signal.kind) {
        case 'command':
          if (signal.envelope.command.type === 'take_over') {
            handleTakeOverCommandRef.current(signal.envelope, signal.receivedAtMs);
          }
          return;
        case 'start_failed': {
          const pending = store.getSnapshot().pendingTransfer;
          if (pending === null || pending.commandIdText !== signal.report.command_id) {
            return;
          }
          clearTransferTimerRef.current();
          store.setTransferFailure({
            targetSessionIdText: pending.targetSessionIdText,
            reason: signal.report.reason,
          });
          store.setPendingTransfer(null);
          return;
        }
        case 'local_play_blocked': {
          const localTakeOverAtMs = localTakeOverAtMsRef.current;
          if (localTakeOverAtMs === null) {
            return;
          }
          if (Date.now() - localTakeOverAtMs > TAKE_OVER_START_WINDOW_MS) {
            localTakeOverAtMsRef.current = null;
            return;
          }
          // A commanded start owns a blocked play; the command executor reports it.
          const snapshot = store.getSnapshot();
          if (snapshot.tapToPlay !== null || isCommandStartOpen(snapshot.pendingCommandStart)) {
            return;
          }
          localTakeOverAtMsRef.current = null;
          setMPIsPlayingRef.current(false);
          store.setTapToPlay({ commandIdText: null });
          return;
        }
      }
    });

    return () => {
      unsubscribe();
      clearTransferTimerRef.current();
      if (pendingStartTimerRef.current !== null) {
        window.clearTimeout(pendingStartTimerRef.current);
        pendingStartTimerRef.current = null;
      }
    };
  }, []);

  return { transferTo, takeOverHere, dismissTransferFailure };
}
