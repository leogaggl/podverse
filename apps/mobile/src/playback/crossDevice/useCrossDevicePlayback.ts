import type { RefObject } from 'react';
import { useCallback, useEffect, useMemo, useRef, useSyncExternalStore } from 'react';
import { AppState } from 'react-native';

import type { DTOPlaybackCommand } from '@podverse/helpers/accountPlaybackStream';
import { ACCOUNT_PLAYBACK_STREAM_EVENT } from '@podverse/helpers/accountPlaybackStream';
import type { DTOAccount } from '@podverse/helpers/dto';
import { parseMembershipGateError, parsePlaybackApiError } from '@podverse/helpers-requests';
import type { PlaybackTarget } from '@podverse/playback-core';

import type { PlaybackErrorEvent } from '../../../modules/podverse-media-engine';
import type { AuthStatus } from '../../auth/AuthProvider';
import { useAuth } from '../../auth/AuthProvider';
import type { MobileAuthRequestContext } from '../../data/repositories';
import { crossDevicePlaybackRepository } from '../../data/repositories';
import { useAccessTier } from '../../membership/useAccessTier';
import {
  getNotificationStreamConnection,
  subscribeNotificationStreamConnection,
  subscribeNotificationStreamPlaybackEvents,
} from '../../notifications/notificationStreamStore';
import { useOfflineMode } from '../../prefs/offlineMode';
import { subscribeTermsBlocksAccountSync, termsBlocksAccountSync } from '../../terms/termsSyncGate';
import { subscribePlaybackProgress } from '../playbackProgressStore';
import type { PlaybackNowPlaying } from '../PlaybackProvider';
import type { PlaybackTransportState } from '../playbackTransport';
import type {
  CrossDevicePlaybackCommandRunner,
  CrossDevicePlaybackLocalPort,
} from './crossDevicePlaybackCommandRunner';
import { createCrossDevicePlaybackCommandRunner } from './crossDevicePlaybackCommandRunner';
import type {
  LocalPlaybackPublishSnapshot,
  PlaybackHandoffGate,
} from './crossDevicePlaybackPolicy';
import {
  resolvePlaybackHandoffGate,
  resolvePlaybackIdleAdoption,
  resolvePlaybackSupersedeAction,
  resolvePlaybackTakeOverStart,
  resolveRemoteJumpSeekSeconds,
} from './crossDevicePlaybackPolicy';
import type {
  CrossDevicePlaybackPublisher,
  LocalPlaybackChangeKind,
} from './crossDevicePlaybackPublisher';
import { createCrossDevicePlaybackPublisher } from './crossDevicePlaybackPublisher';
import type {
  CrossDevicePlaybackRemoteControl,
  RemoteControlOutcome,
} from './crossDevicePlaybackRemoteControl';
import { createCrossDevicePlaybackRemoteControl } from './crossDevicePlaybackRemoteControl';
import {
  getCrossDevicePlaybackView,
  recordCrossDevicePlaybackPublish,
  subscribeCrossDevicePlaybackView,
} from './crossDevicePlaybackStore';
import type { CrossDevicePresenceController } from './crossDevicePresenceController';
import { createCrossDevicePresenceController } from './crossDevicePresenceController';

type CrossDevicePlaybackAuth = MobileAuthRequestContext & {
  account: DTOAccount | null;
  status: AuthStatus;
};

export type UseCrossDevicePlaybackParams = {
  activeTarget: PlaybackTarget | null;
  nowPlaying: PlaybackNowPlaying | null;
  isPlaying: boolean;
  transportState: PlaybackTransportState;
  playbackRate: number;
  isPlayingRef: RefObject<boolean>;
  readPositionSeconds: () => number;
  readDurationSeconds: () => number;
  readEffectiveRate: () => number;
  /** The provider calls `current` from `seekTo` and `setRate`; the hook assigns it. */
  localChangeSignalRef: RefObject<(kind: LocalPlaybackChangeKind) => void>;
  /** Pause local audio without writing any playback event. */
  stopForOtherDevice: () => void;
  /** The local playback paths another device's commands run through. */
  localPort: CrossDevicePlaybackLocalPort;
  /** The provider's current playback error; null when there is none. */
  lastPlaybackError: PlaybackErrorEvent | null;
  /** While true, controls stay on this phone even when another device plays. */
  isAuthoringHold: boolean;
};

export type CrossDevicePlaybackBindings = {
  /** Read at call time, never captured: true when controls go to another device. */
  isRemote: () => boolean;
  sendControl: (command: DTOPlaybackCommand) => Promise<RemoteControlOutcome>;
  seekRemote: (positionSeconds: number) => void;
  jumpRemote: (deltaSeconds: number) => void;
  /** Move playback to another device in the list. */
  transferTo: (targetSessionIdText: string) => Promise<void>;
  /** Play the shared state here, at its estimated position or the live point, and claim. */
  takeOverHere: () => Promise<void>;
  /** Whether the different-item handoff prompt may open now. */
  handoffGate: PlaybackHandoffGate;
};

type CrossDevicePlaybackControls = Omit<CrossDevicePlaybackBindings, 'handoffGate'>;

type LocalPlaybackChangeInputs = Pick<
  UseCrossDevicePlaybackParams,
  'activeTarget' | 'isPlaying' | 'playbackRate' | 'transportState'
>;

const toRequestContext = (auth: CrossDevicePlaybackAuth): MobileAuthRequestContext => ({
  accessToken: auth.accessToken,
  clearSession: auth.clearSession,
  refreshToken: auth.refreshToken,
  setTokens: auth.setTokens,
});

const readLocalPlaybackSnapshot = (
  params: UseCrossDevicePlaybackParams
): LocalPlaybackPublishSnapshot => {
  const { nowPlaying } = params;
  return {
    target: params.activeTarget,
    title: nowPlaying?.title ?? null,
    channelTitle: nowPlaying?.channelTitle ?? null,
    imageUrl: nowPlaying === null ? null : (nowPlaying.viewerImageUrl ?? nowPlaying.imageUrl),
    isPlaying: params.isPlayingRef.current,
    transportState: params.transportState,
    positionSeconds: params.readPositionSeconds(),
    durationSeconds: params.readDurationSeconds(),
    rate: params.readEffectiveRate(),
  };
};

const readHandoffGate = (): PlaybackHandoffGate =>
  resolvePlaybackHandoffGate(getCrossDevicePlaybackView());

const localPlaybackChangeKind = (
  previous: LocalPlaybackChangeInputs,
  next: LocalPlaybackChangeInputs
): LocalPlaybackChangeKind | null => {
  if (previous.isPlaying !== next.isPlaying) {
    return 'playing';
  }
  if (previous.activeTarget !== next.activeTarget) {
    return 'target';
  }
  if (previous.transportState !== next.transportState) {
    return 'transport';
  }
  if (previous.playbackRate !== next.playbackRate) {
    return 'rate';
  }
  return null;
};

/**
 * This phone's side of cross-device playback for the signed-in account. It rides the account
 * event stream `NotificationsRuntime` holds and never opens a connection of its own. While the
 * phone plays it publishes its state, claims the active role whenever its audio starts, and stops
 * its own audio, writing nothing, when another device claims. Playback commands other devices send
 * it run through `localPort`, the same paths a tap uses. While another device plays, the returned
 * bindings send this phone's controls to that device. When that device stops being active, the
 * phone loads what it played, paused at the shared position, and writes nothing. Call it once,
 * from `PlaybackProvider`. The bindings' functions are stable for the provider's lifetime; the
 * object changes only when `handoffGate` does.
 */
export function useCrossDevicePlayback(
  params: UseCrossDevicePlaybackParams
): CrossDevicePlaybackBindings {
  const paramsRef = useRef(params);
  paramsRef.current = params;

  const { accessToken, account, clearSession, refreshToken, setTokens, status } = useAuth();
  const authRef = useRef<CrossDevicePlaybackAuth>({
    accessToken,
    account,
    clearSession,
    refreshToken,
    setTokens,
    status,
  });

  // Declared before the inputs effect, so a check-in started in the same commit reads these.
  useEffect(() => {
    authRef.current = { accessToken, account, clearSession, refreshToken, setTokens, status };
  });

  const { canUse, isTierKnown } = useAccessTier();
  const { enabled: offlineModeEnabled } = useOfflineMode();
  const termsBlocked = useSyncExternalStore(
    subscribeTermsBlocksAccountSync,
    termsBlocksAccountSync
  );
  const featureEnabled =
    status === 'authenticated' &&
    accessToken !== null &&
    isTierKnown &&
    canUse('queue_history_sync') &&
    !offlineModeEnabled &&
    !termsBlocked;
  const connection = useSyncExternalStore(
    subscribeNotificationStreamConnection,
    getNotificationStreamConnection
  );

  /** `inactive` (a system sheet, the app switcher) keeps the last value. */
  const isAppActiveRef = useRef(AppState.currentState === 'active');

  const presenceRef = useRef<CrossDevicePresenceController | null>(null);
  if (presenceRef.current === null) {
    presenceRef.current = createCrossDevicePresenceController({
      checkIn: () => crossDevicePlaybackRepository.checkIn(toRequestContext(authRef.current)),
      isMembershipRefusal: (error) => parseMembershipGateError(error) !== null,
      now: () => Date.now(),
    });
  }
  const presence = presenceRef.current;

  const publisherRef = useRef<CrossDevicePlaybackPublisher | null>(null);
  /** Another device's claim arrived while this device's own claim was in flight. */
  const supersedeCheckPendingRef = useRef(false);

  // Reads only refs, so the copy the publisher captured stays current.
  const runSupersedeCheck = useCallback((): void => {
    const publisher = publisherRef.current;
    if (publisher === null) {
      return;
    }
    const view = getCrossDevicePlaybackView();
    const action = resolvePlaybackSupersedeAction({
      thisSessionIdText: view.thisSessionIdText,
      activeSessionIdText: view.activeSessionIdText,
      isPlayingLocally: paramsRef.current.isPlayingRef.current,
      claimInFlight: publisher.isClaimInFlight(),
    });
    supersedeCheckPendingRef.current = action === 'defer';
    if (action === 'stop') {
      paramsRef.current.stopForOtherDevice();
    }
  }, []);

  if (publisherRef.current === null) {
    publisherRef.current = createCrossDevicePlaybackPublisher({
      publish: (body) =>
        crossDevicePlaybackRepository.publishState(toRequestContext(authRef.current), body),
      readLocal: () => readLocalPlaybackSnapshot(paramsRef.current),
      isRunning: () => presence.isRunning(),
      isAppActive: () => isAppActiveRef.current,
      now: () => Date.now(),
      onPublished: (response) => {
        recordCrossDevicePlaybackPublish(response);
        presence.notePresenceRefreshed();
        runSupersedeCheck();
      },
      // The server is authoritative; the stream delivers the state that names the new device.
      onSuperseded: () => {
        if (paramsRef.current.isPlayingRef.current) {
          paramsRef.current.stopForOtherDevice();
        }
      },
      onMembershipRefusal: () => {
        presence.noteMembershipRefusal();
      },
      onSettled: () => {
        if (!supersedeCheckPendingRef.current) {
          return;
        }
        supersedeCheckPendingRef.current = false;
        runSupersedeCheck();
      },
      isMembershipRefusal: (error) => parseMembershipGateError(error) !== null,
      parsePlaybackError: parsePlaybackApiError,
    });
  }
  const publisher = publisherRef.current;

  const runnerRef = useRef<CrossDevicePlaybackCommandRunner | null>(null);
  if (runnerRef.current === null) {
    // Every port call reads the latest provider callbacks.
    const readPort = (): CrossDevicePlaybackLocalPort => paramsRef.current.localPort;
    runnerRef.current = createCrossDevicePlaybackCommandRunner({
      port: {
        resume: () => readPort().resume(),
        pause: () => readPort().pause(),
        seekTo: (seconds) => readPort().seekTo(seconds),
        setRate: (rate) => readPort().setRate(rate),
        skipToNext: () => readPort().skipToNext(),
        skipToPrevious: () => readPort().skipToPrevious(),
        playResource: (resource) => readPort().playResource(resource),
        hasLoadedTarget: () => readPort().hasLoadedTarget(),
        isLoadedTargetLive: () => readPort().isLoadedTargetLive(),
      },
      reportStartFailed: (commandIdText, reason) =>
        crossDevicePlaybackRepository.reportStartFailed(toRequestContext(authRef.current), {
          commandIdText,
          reason,
        }),
      readThisSessionIdText: () => getCrossDevicePlaybackView().thisSessionIdText,
      now: () => Date.now(),
    });
  }
  const runner = runnerRef.current;

  const remoteControlRef = useRef<CrossDevicePlaybackRemoteControl | null>(null);
  if (remoteControlRef.current === null) {
    remoteControlRef.current = createCrossDevicePlaybackRemoteControl({
      send: (body) =>
        crossDevicePlaybackRepository.sendCommand(toRequestContext(authRef.current), body),
      now: () => Date.now(),
      parsePlaybackError: parsePlaybackApiError,
      isMembershipRefusal: (error) => parseMembershipGateError(error) !== null,
      onMembershipRefusal: () => {
        presence.noteMembershipRefusal();
      },
    });
  }
  const remoteControl = remoteControlRef.current;

  const controlsRef = useRef<CrossDevicePlaybackControls | null>(null);
  if (controlsRef.current === null) {
    controlsRef.current = {
      isRemote: () => {
        const view = getCrossDevicePlaybackView();
        return (
          view.availability === 'ready' &&
          view.role === 'remote' &&
          !paramsRef.current.isAuthoringHold
        );
      },
      sendControl: (command) => remoteControl.sendControl(command),
      seekRemote: (positionSeconds) => {
        if (getCrossDevicePlaybackView().state?.is_live === true) {
          return;
        }
        remoteControl.sendSeek(positionSeconds);
      },
      jumpRemote: (deltaSeconds) => {
        const { state, stateReceivedAtMs } = getCrossDevicePlaybackView();
        if (state === null || stateReceivedAtMs === null) {
          return;
        }
        const seconds = resolveRemoteJumpSeekSeconds({
          state,
          receivedAtMs: stateReceivedAtMs,
          nowMs: Date.now(),
          deltaSeconds,
        });
        if (seconds !== null) {
          remoteControl.sendSeek(seconds);
        }
      },
      transferTo: (targetSessionIdText) => remoteControl.transferTo(targetSessionIdText),
      takeOverHere: async () => {
        const { state, stateReceivedAtMs } = getCrossDevicePlaybackView();
        if (state === null || stateReceivedAtMs === null) {
          return;
        }
        const start = resolvePlaybackTakeOverStart({
          state,
          receivedAtMs: stateReceivedAtMs,
          nowMs: Date.now(),
        });
        if (start === null) {
          return;
        }
        await paramsRef.current.localPort.playResource({
          ref: start.ref,
          addByRssResourceData: null,
          startSeconds: start.startSeconds,
        });
      },
    };
  }
  const controls = controlsRef.current;

  useEffect(() => {
    return () => {
      remoteControl.dispose();
      runner.dispose();
      publisher.dispose();
      presence.dispose();
    };
  }, [presence, publisher, remoteControl, runner]);

  useEffect(() => {
    const initialView = getCrossDevicePlaybackView();
    let previousRole = initialView.role;
    let previousAvailability = initialView.availability;
    return subscribeCrossDevicePlaybackView(() => {
      remoteControl.noteViewChanged();
      const view = getCrossDevicePlaybackView();
      const { localPort } = paramsRef.current;
      const adoption = resolvePlaybackIdleAdoption({
        previousRole,
        previousAvailability,
        view,
        loadedRef: localPort.loadedRef(),
        isPlayingLocally: paramsRef.current.isPlayingRef.current,
        isAuthoringHold: paramsRef.current.isAuthoringHold,
      });
      previousRole = view.role;
      previousAvailability = view.availability;
      if (adoption.type === 'seek') {
        localPort.adoptPosition(adoption.positionSeconds);
      } else if (adoption.type === 'load_paused') {
        localPort
          .loadResourcePaused({ ref: adoption.ref, startSeconds: adoption.positionSeconds })
          .catch((error: unknown) => {
            console.warn('[cross-device] paused load of the shared item failed', error);
          });
      }
    });
  }, [remoteControl]);

  useEffect(() => {
    presence.setInputs({ featureEnabled, connection });
  }, [connection, featureEnabled, presence]);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextState) => {
      if (nextState === 'active') {
        isAppActiveRef.current = true;
      } else if (nextState === 'background') {
        isAppActiveRef.current = false;
        publisher.noteHeartbeat();
      }
    });
    return () => {
      subscription.remove();
    };
  }, [publisher]);

  useEffect(() => {
    return subscribeNotificationStreamPlaybackEvents((event) => {
      if (event.type === ACCOUNT_PLAYBACK_STREAM_EVENT.command) {
        if (presence.isRunning()) {
          runner.receive(event.data);
        }
        return;
      }
      if (event.type === ACCOUNT_PLAYBACK_STREAM_EVENT.startFailed) {
        remoteControl.noteStartFailed(event.data);
        return;
      }
      if (presence.applyStreamEvent(event) !== null) {
        runSupersedeCheck();
      }
    });
  }, [presence, remoteControl, runSupersedeCheck, runner]);

  const { lastPlaybackError } = params;
  useEffect(() => {
    if (lastPlaybackError !== null) {
      runner.notePlaybackError();
    }
  }, [lastPlaybackError, runner]);

  // Native progress samples keep arriving in the background while audio plays, when JS timers
  // may not fire. The listener only compares timestamps; it renders nothing.
  useEffect(() => {
    return subscribePlaybackProgress(() => {
      presence.noteHeartbeat();
      publisher.noteHeartbeat();
    });
  }, [presence, publisher]);

  const { activeTarget, isPlaying, localChangeSignalRef, playbackRate, transportState } = params;

  useEffect(() => {
    localChangeSignalRef.current = (kind) => {
      publisher.noteLocalChange({
        kind,
        wasPlayingLocally: paramsRef.current.isPlayingRef.current,
      });
    };
  }, [localChangeSignalRef, publisher]);

  const previousLocalRef = useRef<LocalPlaybackChangeInputs | null>(null);
  useEffect(() => {
    const next: LocalPlaybackChangeInputs = {
      activeTarget,
      isPlaying,
      playbackRate,
      transportState,
    };
    const previous = previousLocalRef.current;
    previousLocalRef.current = next;
    if (previous === null) {
      return;
    }
    const kind = localPlaybackChangeKind(previous, next);
    if (kind === null) {
      return;
    }
    publisher.noteLocalChange({ kind, wasPlayingLocally: previous.isPlaying });
  }, [activeTarget, isPlaying, playbackRate, publisher, transportState]);

  // A string snapshot, so the provider re-renders only when the gate itself changes.
  const handoffGate = useSyncExternalStore(subscribeCrossDevicePlaybackView, readHandoffGate);

  return useMemo(() => ({ ...controls, handoffGate }), [controls, handoffGate]);
}
