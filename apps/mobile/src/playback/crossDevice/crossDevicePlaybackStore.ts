/**
 * The phone's read model of account-wide playback: which devices are connected, what the active
 * device plays, and this device's own claims, transfers, and remote-control failures.
 *
 * Display only. Another device's playback lives here and nowhere else on this phone: nothing in
 * this store writes the outbox, the journal, history, a queue row, the device-local last-playback
 * snapshot, or `playbackProgressStore`, and no repository reads it. Leaf UI reads it through
 * `useSyncExternalStore`, and each change builds a new view object, so identity changes only when
 * something changed.
 */
import type {
  DTOPlaybackDevices,
  DTOPlaybackSnapshot,
  DTOPlaybackState,
  PlaybackCommandType,
  PlaybackPresenceResponse,
  PlaybackStartFailedReason,
  PlaybackStatePublishResponse,
} from '@podverse/helpers/accountPlaybackStream';
import type { PlaybackRole } from '@podverse/helpers/crossDevicePlayback';
import {
  estimatePlaybackPositionSeconds,
  isNewerPlaybackRevision,
  resolvePlaybackRole,
} from '@podverse/helpers/crossDevicePlayback';

/**
 * - `off`: the feature is not running for this account (signed out, no membership, Offline Mode,
 *   terms block sync, server refusal), or the account stream is not running.
 * - `pending`: running, but this device does not yet know its own session id and a view.
 * - `ready`: running with a view; stays `ready` across a healthy reconnect.
 * - `unavailable`: the stream is failing (retrying or stopped).
 *
 * The view is kept on `off` and `unavailable`: it goes stale and the next snapshot replaces it.
 */
export type CrossDevicePlaybackAvailability = 'off' | 'pending' | 'ready' | 'unavailable';

export type CrossDevicePlaybackTransfer = {
  commandIdText: string;
  targetSessionIdText: string;
  startedAtMs: number;
};

export type CrossDevicePlaybackTransferFailureReason =
  | PlaybackStartFailedReason
  | 'timeout'
  /** `playback_device_not_connected`: the target left before the command reached it. */
  | 'not_connected'
  | 'send_failed';

export type CrossDevicePlaybackTransferFailure = {
  targetSessionIdText: string;
  reason: CrossDevicePlaybackTransferFailureReason;
  atMs: number;
};

/** A remote control (play, pause, seek, rate, play item) that did not reach the active device. */
export type CrossDevicePlaybackCommandFailure = {
  commandType: PlaybackCommandType;
  atMs: number;
};

export type CrossDevicePlaybackLocalClaim = {
  revision: number;
  activeSessionIdText: string | null;
};

export type CrossDevicePlaybackView = {
  availability: CrossDevicePlaybackAvailability;
  /** This login session, from the presence response. Null until the first check-in succeeds. */
  thisSessionIdText: string | null;
  devices: DTOPlaybackDevices | null;
  state: DTOPlaybackState | null;
  /** Client clock when `state` arrived; the input to `estimatePlaybackPositionSeconds`. */
  stateReceivedAtMs: number | null;
  /** This device's newest accepted claim while it is newer than `state`. */
  localClaim: CrossDevicePlaybackLocalClaim | null;
  /** `localClaim`'s active id when it is newer than `state`, else `state?.active_session_id_text ?? null`. */
  activeSessionIdText: string | null;
  /**
   * Over the effective active id, whatever the availability. Callers that route controls or gate
   * the handoff prompt also check `availability === 'ready'`.
   */
  role: PlaybackRole;
  /** A take-over this device sent and is waiting on. */
  transfer: CrossDevicePlaybackTransfer | null;
  /** The last take-over this device sent that did not start; the player shows it, then clears it. */
  transferFailure: CrossDevicePlaybackTransferFailure | null;
  /** The last remote control that failed to send; the player shows it, then clears it. */
  commandFailure: CrossDevicePlaybackCommandFailure | null;
};

type CrossDevicePlaybackViewPatch = Partial<
  Omit<CrossDevicePlaybackView, 'activeSessionIdText' | 'role'>
>;

type Listener = () => void;

const POSITION_CLOCK_TICK_MS = 1000;

const INITIAL_VIEW: CrossDevicePlaybackView = {
  availability: 'off',
  thisSessionIdText: null,
  devices: null,
  state: null,
  stateReceivedAtMs: null,
  localClaim: null,
  activeSessionIdText: null,
  role: 'idle',
  transfer: null,
  transferFailure: null,
  commandFailure: null,
};

let view: CrossDevicePlaybackView = INITIAL_VIEW;

const viewListeners = new Set<Listener>();
const positionClockListeners = new Set<Listener>();
let positionClockTimer: ReturnType<typeof setInterval> | null = null;
let lastPositionClockSeconds: number | null = null;

const resolveActiveSessionIdText = (
  state: DTOPlaybackState | null,
  localClaim: CrossDevicePlaybackLocalClaim | null
): string | null => {
  if (localClaim !== null && isNewerPlaybackRevision(state, localClaim)) {
    return localClaim.activeSessionIdText;
  }
  return state?.active_session_id_text ?? null;
};

/** The claim survives only while it is newer than the state it is compared with. */
const localClaimNewerThan = (
  state: DTOPlaybackState | null,
  localClaim: CrossDevicePlaybackLocalClaim | null
): CrossDevicePlaybackLocalClaim | null => {
  if (localClaim === null || !isNewerPlaybackRevision(state, localClaim)) {
    return null;
  }
  return localClaim;
};

const readPositionClockSeconds = (): number | null => {
  const positionSeconds = getCrossDevicePlaybackPositionSeconds(Date.now());
  return positionSeconds === null ? null : Math.floor(positionSeconds);
};

const emitPositionClock = (): void => {
  positionClockListeners.forEach((listener) => {
    listener();
  });
};

const notifyPositionClockIfChanged = (): void => {
  if (positionClockListeners.size === 0) {
    return;
  }
  const next = readPositionClockSeconds();
  if (next === lastPositionClockSeconds) {
    return;
  }
  lastPositionClockSeconds = next;
  emitPositionClock();
};

const shouldRunPositionClock = (): boolean => {
  return (
    positionClockListeners.size > 0 &&
    view.state !== null &&
    view.state.status === 'playing' &&
    !view.state.is_live
  );
};

const stopPositionClock = (): void => {
  if (positionClockTimer === null) {
    return;
  }
  clearInterval(positionClockTimer);
  positionClockTimer = null;
};

const syncPositionClock = (): void => {
  if (!shouldRunPositionClock()) {
    stopPositionClock();
    return;
  }
  if (positionClockTimer !== null) {
    return;
  }
  positionClockTimer = setInterval(notifyPositionClockIfChanged, POSITION_CLOCK_TICK_MS);
};

const emitView = (): void => {
  viewListeners.forEach((listener) => {
    listener();
  });
};

const publishView = (next: CrossDevicePlaybackView): void => {
  view = next;
  emitView();
  notifyPositionClockIfChanged();
  syncPositionClock();
};

const updateView = (patch: CrossDevicePlaybackViewPatch): void => {
  const merged = { ...view, ...patch };
  const activeSessionIdText = resolveActiveSessionIdText(merged.state, merged.localClaim);
  publishView({
    ...merged,
    activeSessionIdText,
    role: resolvePlaybackRole({
      thisSessionIdText: merged.thisSessionIdText,
      activeSessionIdText,
    }),
  });
};

export function getCrossDevicePlaybackView(): CrossDevicePlaybackView {
  return view;
}

export function subscribeCrossDevicePlaybackView(listener: Listener): () => void {
  viewListeners.add(listener);
  return () => {
    viewListeners.delete(listener);
  };
}

export function setCrossDevicePlaybackAvailability(next: CrossDevicePlaybackAvailability): void {
  if (next === view.availability) {
    return;
  }
  updateView({ availability: next });
}

/** `playback.snapshot`: replaces devices and state. Keeps `localClaim` only when it is newer than the snapshot's state. */
export function applyCrossDevicePlaybackSnapshot(
  snapshot: DTOPlaybackSnapshot,
  receivedAtMs: number
): void {
  updateView({
    devices: snapshot.devices,
    state: snapshot.state,
    stateReceivedAtMs: snapshot.state === null ? null : receivedAtMs,
    localClaim: localClaimNewerThan(snapshot.state, view.localClaim),
  });
}

/** Presence response: sets `thisSessionIdText`; devices and state apply by revision. */
export function applyCrossDevicePlaybackPresence(
  response: PlaybackPresenceResponse,
  receivedAtMs: number
): void {
  const patch: CrossDevicePlaybackViewPatch = {};
  if (response.session_id_text !== view.thisSessionIdText) {
    patch.thisSessionIdText = response.session_id_text;
  }
  if (isNewerPlaybackRevision(view.devices, response.devices)) {
    patch.devices = response.devices;
  }
  const state = response.state;
  if (
    state !== null &&
    isNewerPlaybackRevision(view.state, state) &&
    isNewerPlaybackRevision(view.localClaim, state)
  ) {
    patch.state = state;
    patch.stateReceivedAtMs = receivedAtMs;
    patch.localClaim = localClaimNewerThan(state, view.localClaim);
  }
  if (Object.keys(patch).length === 0) {
    return;
  }
  updateView(patch);
}

/** `playback.state`. Returns true when it was newer and applied. */
export function applyCrossDevicePlaybackState(
  state: DTOPlaybackState,
  receivedAtMs: number
): boolean {
  if (!isNewerPlaybackRevision(view.state, state)) {
    return false;
  }
  updateView({
    state,
    stateReceivedAtMs: receivedAtMs,
    localClaim: localClaimNewerThan(state, view.localClaim),
  });
  return true;
}

/** `playback.devices`. Returns true when it was newer and applied. */
export function applyCrossDevicePlaybackDevices(devices: DTOPlaybackDevices): boolean {
  if (!isNewerPlaybackRevision(view.devices, devices)) {
    return false;
  }
  updateView({ devices });
  return true;
}

/** A successful publish response from this device. */
export function recordCrossDevicePlaybackPublish(response: PlaybackStatePublishResponse): void {
  if (
    !isNewerPlaybackRevision(view.state, response) ||
    !isNewerPlaybackRevision(view.localClaim, response)
  ) {
    return;
  }
  updateView({
    localClaim: {
      revision: response.revision,
      activeSessionIdText: response.active_session_id_text,
    },
  });
}

export function beginCrossDevicePlaybackTransfer(transfer: CrossDevicePlaybackTransfer): void {
  updateView({ transfer });
}

/** Clears `transfer` when its command id matches; sets `transferFailure` when `failure` is given. */
export function settleCrossDevicePlaybackTransfer(params: {
  commandIdText: string;
  failure: CrossDevicePlaybackTransferFailure | null;
}): void {
  if (view.transfer === null || view.transfer.commandIdText !== params.commandIdText) {
    return;
  }
  updateView({
    transfer: null,
    transferFailure: params.failure ?? view.transferFailure,
  });
}

/** A take-over that failed before any command id existed (the send itself failed). */
export function recordCrossDevicePlaybackTransferFailure(
  failure: CrossDevicePlaybackTransferFailure
): void {
  updateView({ transferFailure: failure });
}

export function clearCrossDevicePlaybackTransferFailure(): void {
  if (view.transferFailure === null) {
    return;
  }
  updateView({ transferFailure: null });
}

export function recordCrossDevicePlaybackCommandFailure(
  failure: CrossDevicePlaybackCommandFailure
): void {
  updateView({ commandFailure: failure });
}

export function clearCrossDevicePlaybackCommandFailure(): void {
  if (view.commandFailure === null) {
    return;
  }
  updateView({ commandFailure: null });
}

/** Estimated position of the shared state now; null when live, unknown, or nothing is shared. */
export function getCrossDevicePlaybackPositionSeconds(nowMs: number): number | null {
  const { state, stateReceivedAtMs } = view;
  if (state === null || stateReceivedAtMs === null || state.resource === null) {
    return null;
  }
  return estimatePlaybackPositionSeconds({ state, receivedAtMs: stateReceivedAtMs, nowMs });
}

/**
 * Whole-second changes of that estimate, for the remote progress display. Runs a 1 s interval only
 * while at least one listener is subscribed and the state is `playing` and not live. A view change
 * that moves the estimate to another whole second (a remote seek, a pause, a cleared state) also
 * notifies.
 */
export function subscribeCrossDevicePlaybackPositionClock(listener: Listener): () => void {
  if (positionClockListeners.size === 0) {
    lastPositionClockSeconds = readPositionClockSeconds();
  }
  positionClockListeners.add(listener);
  syncPositionClock();
  return () => {
    positionClockListeners.delete(listener);
    syncPositionClock();
  };
}

/** Sign-out: back to `off` with every field cleared. */
export function resetCrossDevicePlaybackStore(): void {
  stopPositionClock();
  if (view === INITIAL_VIEW) {
    return;
  }
  publishView(INITIAL_VIEW);
}
