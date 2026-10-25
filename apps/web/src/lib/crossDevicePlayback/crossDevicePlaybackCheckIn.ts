import type { PlaybackPresenceResponse } from '@podverse/helpers';
import { PLAYBACK_PRESENCE_CHECK_IN_INTERVAL_MS } from '@podverse/helpers';
import { parseMembershipGateError } from '@podverse/helpers-requests';

import type { CrossDevicePlaybackStore } from './crossDevicePlaybackStore';

/** Availability still `pending` this long after it became pending counts as `unavailable`. */
export const PLAYBACK_AVAILABILITY_PENDING_TIMEOUT_MS = 5_000;

type PlaybackTimerOptions = {
  now?: () => number;
  setTimer?: (callback: () => void, ms: number) => number;
  clearTimer?: (id: number) => void;
};

function resolvePlaybackTimers(options: PlaybackTimerOptions) {
  const now = options.now ?? (() => Date.now());
  const setTimer = options.setTimer ?? ((callback, ms) => window.setTimeout(callback, ms));
  const clearTimer = options.clearTimer ?? ((id) => window.clearTimeout(id));
  return { now, setTimer, clearTimer };
}

/**
 * Marks availability `unavailable` when it is still `pending`
 * `PLAYBACK_AVAILABILITY_PENDING_TIMEOUT_MS` after `pendingSinceMs`, so nothing waits on a stream
 * that is disabled or down. Returns the cancel function.
 */
export function startPendingAvailabilityTimeout(
  options: { store: CrossDevicePlaybackStore } & PlaybackTimerOptions
): () => void {
  const { store } = options;
  const { now, setTimer, clearTimer } = resolvePlaybackTimers(options);
  const { pendingSinceMs } = store.getSnapshot();
  if (pendingSinceMs === null) {
    return () => undefined;
  }

  let timerId: number | null = setTimer(
    () => {
      timerId = null;
      if (store.getSnapshot().availability === 'pending') {
        store.markUnavailable();
      }
    },
    Math.max(0, pendingSinceMs + PLAYBACK_AVAILABILITY_PENDING_TIMEOUT_MS - now())
  );

  return () => {
    if (timerId !== null) {
      clearTimer(timerId);
      timerId = null;
    }
  };
}

/**
 * Checks this tab in while the account stream is open: once at start, then every
 * `PLAYBACK_PRESENCE_CHECK_IN_INTERVAL_MS` while this tab leads the stream. A follower checks in
 * on the interval only until one check-in succeeds. At most one check-in is in flight.
 *
 * A membership 403 marks availability `unavailable`, calls `onMembershipBlocked`, and stops
 * check-ins for the life of the loop. Any other failure marks it `unavailable` only before
 * availability is `ready`, and is retried on the interval.
 */
export function startPlaybackCheckInLoop(
  options: {
    store: CrossDevicePlaybackStore;
    checkIn: () => Promise<PlaybackPresenceResponse>;
    isLeader: () => boolean;
    onMembershipBlocked?: () => void;
  } & PlaybackTimerOptions
): { stop(): void; checkInNow(): void } {
  const { store, checkIn, isLeader, onMembershipBlocked } = options;
  const timers = resolvePlaybackTimers(options);

  let stopped = false;
  let blocked = false;
  let inFlight = false;
  let succeeded = false;
  let timerId: number | null = null;

  const cancelPendingTimeout = startPendingAvailabilityTimeout({ store, ...timers });

  const cancelTimer = () => {
    if (timerId !== null) {
      timers.clearTimer(timerId);
      timerId = null;
    }
  };

  const scheduleNext = () => {
    cancelTimer();
    if (stopped || blocked) {
      return;
    }
    timerId = timers.setTimer(() => {
      timerId = null;
      if (succeeded && !isLeader()) {
        scheduleNext();
        return;
      }
      runCheckIn();
    }, PLAYBACK_PRESENCE_CHECK_IN_INTERVAL_MS);
  };

  const handleSuccess = (response: PlaybackPresenceResponse) => {
    if (stopped) {
      return;
    }
    succeeded = true;
    cancelPendingTimeout();
    store.applyPresenceResponse(response, timers.now());
  };

  const handleFailure = (error: unknown) => {
    if (stopped) {
      return;
    }
    if (parseMembershipGateError(error) !== null) {
      blocked = true;
      cancelPendingTimeout();
      store.markUnavailable();
      onMembershipBlocked?.();
      return;
    }
    if (store.getSnapshot().availability !== 'ready') {
      cancelPendingTimeout();
      store.markUnavailable();
    }
  };

  function runCheckIn() {
    if (stopped || blocked || inFlight) {
      return;
    }
    cancelTimer();
    inFlight = true;
    let request: Promise<PlaybackPresenceResponse>;
    try {
      request = checkIn();
    } catch (error: unknown) {
      request = Promise.reject(error);
    }
    void request.then(handleSuccess, handleFailure).finally(() => {
      inFlight = false;
      scheduleNext();
    });
  }

  runCheckIn();

  return {
    stop: () => {
      if (stopped) {
        return;
      }
      stopped = true;
      cancelTimer();
      cancelPendingTimeout();
    },
    checkInNow: () => {
      runCheckIn();
    },
  };
}
