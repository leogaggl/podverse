/**
 * Publishes this phone's playback to the account while the cross-device feature runs. Publishing
 * needs the feature running, not an open stream, so exclusivity holds while the stream reconnects.
 *
 * Requests are chained: one in flight, and a change during a request marks the state dirty so the
 * newest local state goes out when it settles. In the foreground, consecutive requests also keep
 * `PLAYBACK_STATE_MIN_PUBLISH_GAP_MS` apart with a leading and trailing timer. In the background
 * the gap is skipped: Android does not fire JS timers there, so a trailing pause would wait until
 * the app returns. A request's own settle is a native callback and always runs.
 *
 * Every local start claims (`resolvePlaybackPublishClaim`). A claim that fails on the network stays
 * owed and retries on progress samples while audio plays; pausing drops it, so a paused phone never
 * becomes active. Periodic publishes also ride progress samples rather than a timer of their own.
 */
import type {
  PlaybackStatePublishBody,
  PlaybackStatePublishResponse,
} from '@podverse/helpers/accountPlaybackStream';
import {
  PLAYBACK_ERROR_CODES,
  PLAYBACK_STATE_MIN_PUBLISH_GAP_MS,
  PLAYBACK_STATE_PUBLISH_INTERVAL_MS,
} from '@podverse/helpers/accountPlaybackStream';
import type { PlaybackApiError } from '@podverse/helpers-requests';

import type { LocalPlaybackPublishSnapshot } from './crossDevicePlaybackPolicy';
import {
  buildPlaybackStatePublishBody,
  resolvePlaybackPublishClaim,
  shouldPublishPlaybackChange,
} from './crossDevicePlaybackPolicy';
import { getCrossDevicePlaybackView } from './crossDevicePlaybackStore';

/** A claim that failed on the network is retried from progress samples no sooner than this. */
const PLAYBACK_CLAIM_RETRY_MS = 2_000;

export type LocalPlaybackChangeKind = 'playing' | 'target' | 'transport' | 'seek' | 'rate';

export type CrossDevicePlaybackPublisherDeps = {
  publish: (body: PlaybackStatePublishBody) => Promise<PlaybackStatePublishResponse>;
  readLocal: () => LocalPlaybackPublishSnapshot;
  isRunning: () => boolean;
  isAppActive: () => boolean;
  now: () => number;
  /** Record the response in the store and count it as a check-in. */
  onPublished: (response: PlaybackStatePublishResponse) => void;
  /** 409 naming another active device. */
  onSuperseded: (activeSessionIdText: string) => void;
  onMembershipRefusal: () => void;
  /** Runs after any request settles; the hook re-runs a deferred supersede check here. */
  onSettled: () => void;
  isMembershipRefusal: (error: unknown) => boolean;
  parsePlaybackError: (error: unknown) => PlaybackApiError | null;
};

export type CrossDevicePlaybackPublisher = {
  noteLocalChange: (params: { kind: LocalPlaybackChangeKind; wasPlayingLocally: boolean }) => void;
  /**
   * A progress sample, or the app moving to the background: sends a periodic publish, an owed
   * claim, or a trailing publish the background would hold, when one is due.
   */
  noteHeartbeat: () => void;
  isClaimInFlight: () => boolean;
  dispose: () => void;
};

export function createCrossDevicePlaybackPublisher(
  deps: CrossDevicePlaybackPublisherDeps
): CrossDevicePlaybackPublisher {
  let inFlight: { claims: boolean } | null = null;
  let dirty = false;
  let claimOwed = false;
  let lastStartedAtMs: number | null = null;
  let lastClaimFailedAtMs: number | null = null;
  let trailingTimer: ReturnType<typeof setTimeout> | null = null;
  let disposed = false;

  const isRunning = (): boolean => !disposed && deps.isRunning();

  const clearTrailingTimer = (): void => {
    if (trailingTimer !== null) {
      clearTimeout(trailingTimer);
      trailingTimer = null;
    }
  };

  const handleSuccess = (response: PlaybackStatePublishResponse, claims: boolean): void => {
    deps.onPublished(response);
    if (claims) {
      claimOwed = false;
    }
  };

  const handleFailure = (error: unknown, claims: boolean): void => {
    if (deps.isMembershipRefusal(error)) {
      claimOwed = false;
      dirty = false;
      deps.onMembershipRefusal();
      return;
    }

    const playbackError = deps.parsePlaybackError(error);
    if (playbackError?.code === PLAYBACK_ERROR_CODES.notActiveDevice) {
      const activeSessionIdText = playbackError.activeSessionIdText ?? null;
      if (activeSessionIdText !== null) {
        claimOwed = false;
        deps.onSuperseded(activeSessionIdText);
        return;
      }
      // The claim lapsed (presence expired), so nobody is active: claim again while audio plays.
      if (deps.readLocal().isPlaying) {
        claimOwed = true;
        dirty = true;
      }
      return;
    }

    console.warn('[cross-device] publish failed', error);
    if (claims) {
      lastClaimFailedAtMs = deps.now();
    }
  };

  const settle = (): void => {
    inFlight = null;
    deps.onSettled();
    if (dirty) {
      dirty = false;
      publishIfDue();
    }
  };

  const send = (): void => {
    clearTrailingTimer();
    const claims = claimOwed;
    const body = buildPlaybackStatePublishBody(deps.readLocal(), claims);
    inFlight = { claims };
    lastStartedAtMs = deps.now();
    deps.publish(body).then(
      (response) => {
        if (disposed) {
          return;
        }
        // A response that lands after sign-out or a refusal belongs to the session that ended.
        if (deps.isRunning()) {
          handleSuccess(response, claims);
        } else {
          claimOwed = false;
          dirty = false;
        }
        settle();
      },
      (error: unknown) => {
        if (disposed) {
          return;
        }
        if (deps.isRunning()) {
          handleFailure(error, claims);
        } else {
          claimOwed = false;
          dirty = false;
        }
        settle();
      }
    );
  };

  const requestPublish = (): void => {
    if (inFlight !== null) {
      dirty = true;
      return;
    }
    if (deps.isAppActive() && lastStartedAtMs !== null) {
      const waitMs = lastStartedAtMs + PLAYBACK_STATE_MIN_PUBLISH_GAP_MS - deps.now();
      if (waitMs > 0) {
        if (trailingTimer === null) {
          trailingTimer = setTimeout(() => {
            trailingTimer = null;
            publishIfDue();
          }, waitMs);
        }
        return;
      }
    }
    send();
  };

  /** An owed claim always goes out; any other change only while this device is active. */
  const publishIfDue = (): void => {
    if (!isRunning()) {
      return;
    }
    const { role } = getCrossDevicePlaybackView();
    if (claimOwed || shouldPublishPlaybackChange({ role, claim: false })) {
      requestPublish();
    }
  };

  const noteLocalChange = (params: {
    kind: LocalPlaybackChangeKind;
    wasPlayingLocally: boolean;
  }): void => {
    if (!isRunning()) {
      return;
    }
    const isPlayingLocally = deps.readLocal().isPlaying;
    const { role } = getCrossDevicePlaybackView();
    if (
      resolvePlaybackPublishClaim({
        role,
        wasPlayingLocally: params.wasPlayingLocally,
        isPlayingLocally,
      })
    ) {
      claimOwed = true;
    }
    if (!isPlayingLocally) {
      claimOwed = false;
    }
    // The request in flight may change the role (a claim makes this device active), so the
    // decision waits for its settle and is made then with the newest local state.
    if (inFlight !== null) {
      dirty = true;
      return;
    }
    publishIfDue();
  };

  const noteHeartbeat = (): void => {
    if (!isRunning() || inFlight !== null) {
      return;
    }
    // A trailing send armed in the foreground may never fire once the app is in the background,
    // so a sample there sends it now.
    if (trailingTimer !== null) {
      if (deps.isAppActive()) {
        return;
      }
      clearTrailingTimer();
      publishIfDue();
      return;
    }
    if (!deps.readLocal().isPlaying) {
      return;
    }
    const nowMs = deps.now();
    const claimRetryDue =
      claimOwed &&
      (lastClaimFailedAtMs === null || nowMs - lastClaimFailedAtMs >= PLAYBACK_CLAIM_RETRY_MS);
    const periodicDue =
      getCrossDevicePlaybackView().role === 'active' &&
      (lastStartedAtMs === null || nowMs - lastStartedAtMs >= PLAYBACK_STATE_PUBLISH_INTERVAL_MS);
    if (claimRetryDue || periodicDue) {
      send();
    }
  };

  const isClaimInFlight = (): boolean => inFlight !== null && inFlight.claims;

  const dispose = (): void => {
    disposed = true;
    clearTrailingTimer();
  };

  return {
    noteLocalChange,
    noteHeartbeat,
    isClaimInFlight,
    dispose,
  };
}
