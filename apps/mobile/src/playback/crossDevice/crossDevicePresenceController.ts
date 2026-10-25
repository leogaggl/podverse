/**
 * This phone's presence in the account's cross-device playback: it checks in while the account
 * event stream is open, applies `playback.*` events to the read model, and decides availability.
 * It publishes no state and obeys no command.
 *
 * Check-ins run only while the stream is `open`: one at once, then on an interval. Android stops
 * JS timers in the background, so a native progress sample (`noteHeartbeat`) also checks in when
 * one is due; a phone in the background stays checked in through its samples while it plays.
 */
import type {
  AccountPlaybackStreamEvent,
  DTOPlaybackState,
  PlaybackPresenceResponse,
} from '@podverse/helpers/accountPlaybackStream';
import {
  ACCOUNT_PLAYBACK_STREAM_EVENT,
  PLAYBACK_PRESENCE_CHECK_IN_INTERVAL_MS,
} from '@podverse/helpers/accountPlaybackStream';

import type { NotificationStreamConnection } from '../../notifications/notificationStreamStore';
import type { CrossDevicePlaybackAvailability } from './crossDevicePlaybackStore';
import {
  applyCrossDevicePlaybackDevices,
  applyCrossDevicePlaybackPresence,
  applyCrossDevicePlaybackSnapshot,
  applyCrossDevicePlaybackState,
  getCrossDevicePlaybackView,
  setCrossDevicePlaybackAvailability,
} from './crossDevicePlaybackStore';

export type CrossDevicePresenceInputs = {
  /** Signed in, tier known, `queue_history_sync` allowed, Offline Mode off, terms not blocking. */
  featureEnabled: boolean;
  connection: NotificationStreamConnection;
};

export type CrossDevicePresenceControllerDeps = {
  checkIn: () => Promise<PlaybackPresenceResponse>;
  /** True for a 403 the membership gate parser recognizes. */
  isMembershipRefusal: (error: unknown) => boolean;
  now: () => number;
};

export type CrossDevicePresenceController = {
  setInputs: (inputs: CrossDevicePresenceInputs) => void;
  /** Snapshot, state, and devices events. Returns the applied state when a `playback.state` applied, else null. */
  applyStreamEvent: (event: AccountPlaybackStreamEvent) => DTOPlaybackState | null;
  /** A native progress sample: check in when one is due and the stream is open. */
  noteHeartbeat: () => void;
  /** A state publish succeeded, which refreshed presence on the server. */
  notePresenceRefreshed: () => void;
  /** A playback route answered 403 for membership. */
  noteMembershipRefusal: () => void;
  isRunning: () => boolean;
  dispose: () => void;
};

/**
 * `ready` holds across a reconnect (`connecting`). Reaching it from `pending` needs an open
 * stream, this session's id (only a presence response carries it), and a view that arrived after
 * the device last went `pending`.
 */
export function resolveCrossDevicePlaybackAvailability(params: {
  featureEnabled: boolean;
  refused: boolean;
  connection: NotificationStreamConnection;
  previous: CrossDevicePlaybackAvailability;
  hasFreshView: boolean;
  thisSessionIdText: string | null;
}): CrossDevicePlaybackAvailability {
  if (!params.featureEnabled || params.refused) {
    return 'off';
  }
  switch (params.connection) {
    case 'idle':
      return 'off';
    case 'retrying':
    case 'stopped':
      return 'unavailable';
    case 'connecting':
    case 'open':
      if (params.previous === 'ready') {
        return 'ready';
      }
      if (
        params.connection === 'open' &&
        params.thisSessionIdText !== null &&
        params.hasFreshView
      ) {
        return 'ready';
      }
      return 'pending';
  }
}

export function createCrossDevicePresenceController(
  deps: CrossDevicePresenceControllerDeps
): CrossDevicePresenceController {
  let inputs: CrossDevicePresenceInputs = { featureEnabled: false, connection: 'idle' };
  /** A playback route refused for membership; cleared when the feature turns on again. */
  let refused = false;
  /**
   * A snapshot or presence response arrived since availability last went `pending`, `off`, or
   * `unavailable`. Clearing it on `off` and `unavailable` too keeps a view from an earlier
   * connection from skipping `pending` when the controller sees `idle` jump straight to `open`.
   */
  let hasFreshView = false;
  let lastPresenceAtMs: number | null = null;
  let lastCheckInStartedAtMs: number | null = null;
  let checkInInFlight = false;
  let disposed = false;
  let wasRunning = false;
  /** Bumped whenever the feature stops running; a response from an older run is dropped. */
  let runGeneration = 0;
  let checkInTimer: ReturnType<typeof setInterval> | null = null;

  const isRunning = (): boolean => !disposed && inputs.featureEnabled && !refused;

  const isOpenAndRunning = (): boolean => isRunning() && inputs.connection === 'open';

  const clearCheckInTimer = (): void => {
    if (checkInTimer !== null) {
      clearInterval(checkInTimer);
      checkInTimer = null;
    }
  };

  const syncAvailability = (): void => {
    const view = getCrossDevicePlaybackView();
    const previous = view.availability;
    const next = resolveCrossDevicePlaybackAvailability({
      featureEnabled: inputs.featureEnabled,
      refused,
      connection: inputs.connection,
      previous,
      hasFreshView,
      thisSessionIdText: view.thisSessionIdText,
    });
    if (
      next === 'off' ||
      next === 'unavailable' ||
      (next === 'pending' && previous !== 'pending')
    ) {
      hasFreshView = false;
    }
    if (next !== previous) {
      setCrossDevicePlaybackAvailability(next);
    }
  };

  const syncRunning = (): void => {
    const running = isRunning();
    if (wasRunning && !running) {
      runGeneration += 1;
      checkInInFlight = false;
    }
    wasRunning = running;
  };

  const checkIn = (): void => {
    if (checkInInFlight || !isOpenAndRunning()) {
      return;
    }
    checkInInFlight = true;
    lastCheckInStartedAtMs = deps.now();
    const myGeneration = runGeneration;
    deps.checkIn().then(
      (response) => {
        if (myGeneration !== runGeneration) {
          return;
        }
        checkInInFlight = false;
        const receivedAtMs = deps.now();
        applyCrossDevicePlaybackPresence(response, receivedAtMs);
        hasFreshView = true;
        lastPresenceAtMs = receivedAtMs;
        syncAvailability();
      },
      (error: unknown) => {
        if (myGeneration !== runGeneration) {
          return;
        }
        checkInInFlight = false;
        if (deps.isMembershipRefusal(error)) {
          noteMembershipRefusal();
          return;
        }
        console.warn('[cross-device] check-in failed', error);
      }
    );
  };

  const syncCheckInTimer = (): void => {
    if (!isOpenAndRunning()) {
      clearCheckInTimer();
      return;
    }
    if (checkInTimer !== null) {
      return;
    }
    checkInTimer = setInterval(checkIn, PLAYBACK_PRESENCE_CHECK_IN_INTERVAL_MS);
    checkIn();
  };

  const sync = (): void => {
    syncRunning();
    syncAvailability();
    syncCheckInTimer();
  };

  const setInputs = (next: CrossDevicePresenceInputs): void => {
    if (disposed) {
      return;
    }
    if (!inputs.featureEnabled && next.featureEnabled) {
      refused = false;
    }
    inputs = next;
    sync();
  };

  const noteMembershipRefusal = (): void => {
    if (disposed || refused) {
      return;
    }
    refused = true;
    sync();
  };

  const applyStreamEvent = (event: AccountPlaybackStreamEvent): DTOPlaybackState | null => {
    if (!isRunning()) {
      return null;
    }
    let appliedState: DTOPlaybackState | null = null;
    switch (event.type) {
      case ACCOUNT_PLAYBACK_STREAM_EVENT.snapshot:
        applyCrossDevicePlaybackSnapshot(event.data, deps.now());
        hasFreshView = true;
        break;
      case ACCOUNT_PLAYBACK_STREAM_EVENT.devices:
        applyCrossDevicePlaybackDevices(event.data);
        break;
      case ACCOUNT_PLAYBACK_STREAM_EVENT.state:
        if (applyCrossDevicePlaybackState(event.data, deps.now())) {
          appliedState = event.data;
        }
        break;
      case ACCOUNT_PLAYBACK_STREAM_EVENT.command:
      case ACCOUNT_PLAYBACK_STREAM_EVENT.startFailed:
        break;
    }
    syncAvailability();
    return appliedState;
  };

  /**
   * Due one check-in interval after the later of the last presence refresh and the last check-in
   * attempt, so a failing check-in waits a full interval instead of retrying on every sample.
   */
  const noteHeartbeat = (): void => {
    if (checkInInFlight || !isOpenAndRunning()) {
      return;
    }
    const lastAtMs = Math.max(
      lastPresenceAtMs ?? Number.NEGATIVE_INFINITY,
      lastCheckInStartedAtMs ?? Number.NEGATIVE_INFINITY
    );
    if (deps.now() - lastAtMs < PLAYBACK_PRESENCE_CHECK_IN_INTERVAL_MS) {
      return;
    }
    checkIn();
  };

  const notePresenceRefreshed = (): void => {
    if (disposed) {
      return;
    }
    lastPresenceAtMs = deps.now();
  };

  const dispose = (): void => {
    if (disposed) {
      return;
    }
    disposed = true;
    runGeneration += 1;
    checkInInFlight = false;
    clearCheckInTimer();
  };

  return {
    setInputs,
    applyStreamEvent,
    noteHeartbeat,
    notePresenceRefreshed,
    noteMembershipRefusal,
    isRunning,
    dispose,
  };
}
