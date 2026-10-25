import type { PlaybackStatePublishBody } from '@podverse/helpers';
import {
  PLAYBACK_STATE_DRIFT_TOLERANCE_SECONDS,
  PLAYBACK_STATE_MIN_PUBLISH_GAP_MS,
  PLAYBACK_STATE_PUBLISH_INTERVAL_MS,
} from '@podverse/helpers';

import { isSamePlaybackResourceRef } from './playbackResource';

export type PublishInput = {
  /** Null stops scheduling (not the audio tab, or nothing to publish). */
  body: PlaybackStatePublishBody | null;
};

export type PlaybackPublishScheduler = {
  update(input: PublishInput): void;
  /** Publish the latest body as soon as the gap allows, regardless of what changed. */
  flush(): void;
  stop(): void;
};

type PublishedBody = { body: PlaybackStatePublishBody; atMs: number };

/** A duration change within this many seconds is the same file reporting a refined length. */
const DURATION_CHANGE_TOLERANCE_SECONDS = 1;

function isPositionDrift(published: PublishedBody, body: PlaybackStatePublishBody, nowMs: number) {
  const lastPosition = published.body.position_seconds;
  const position = body.position_seconds;
  if (lastPosition === null || position === null) {
    return lastPosition !== position;
  }
  const elapsedSeconds = Math.max(0, nowMs - published.atMs) / 1000;
  const expected =
    lastPosition + (published.body.status === 'playing' ? published.body.rate * elapsedSeconds : 0);
  return Math.abs(position - expected) > PLAYBACK_STATE_DRIFT_TOLERANCE_SECONDS;
}

function isDurationChange(previous: number | null, next: number | null): boolean {
  if (previous === null || next === null) {
    return previous !== next;
  }
  return Math.abs(next - previous) > DURATION_CHANGE_TOLERANCE_SECONDS;
}

/** True when `body` differs from the last published body in a way other devices must see now. */
function isDiscretePlaybackChange(
  published: PublishedBody,
  body: PlaybackStatePublishBody,
  nowMs: number
): boolean {
  const last = published.body;
  return (
    last.claim !== body.claim ||
    !isSamePlaybackResourceRef(last.resource?.ref ?? null, body.resource?.ref ?? null) ||
    last.status !== body.status ||
    last.is_live !== body.is_live ||
    last.rate !== body.rate ||
    isDurationChange(last.duration_seconds, body.duration_seconds) ||
    isPositionDrift(published, body, nowMs)
  );
}

/**
 * Decides when the audio tab publishes its state. A discrete change publishes leading and
 * trailing, at most once per `PLAYBACK_STATE_MIN_PUBLISH_GAP_MS`. While the last published status
 * is `playing`, the newest body republishes every `PLAYBACK_STATE_PUBLISH_INTERVAL_MS`. At most one
 * request is in flight; a publish that comes due meanwhile runs after it settles.
 */
export function createPlaybackPublishScheduler(options: {
  publish: (body: PlaybackStatePublishBody) => Promise<void>;
  now?: () => number;
  setTimer?: (callback: () => void, ms: number) => number;
  clearTimer?: (id: number) => void;
}): PlaybackPublishScheduler {
  const now = options.now ?? (() => Date.now());
  const setTimer = options.setTimer ?? ((callback, ms) => window.setTimeout(callback, ms));
  const clearTimer = options.clearTimer ?? ((id) => window.clearTimeout(id));

  let stopped = false;
  let latest: PlaybackStatePublishBody | null = null;
  let lastPublished: PublishedBody | null = null;
  let discretePending = false;
  let inFlight = false;
  let timer: { id: number; dueAtMs: number } | null = null;

  const cancelTimer = () => {
    if (timer !== null) {
      clearTimer(timer.id);
      timer = null;
    }
  };

  const publishNow = (body: PlaybackStatePublishBody) => {
    cancelTimer();
    inFlight = true;
    discretePending = false;
    lastPublished = { body, atMs: now() };
    let request: Promise<void>;
    try {
      request = options.publish(body);
    } catch (error: unknown) {
      request = Promise.reject(error);
    }
    request
      .catch(() => undefined)
      .then(() => {
        inFlight = false;
        schedule();
      });
  };

  const schedule = () => {
    if (stopped || latest === null || inFlight) {
      return;
    }

    let dueAtMs: number | null = null;
    if (discretePending) {
      dueAtMs =
        lastPublished === null ? now() : lastPublished.atMs + PLAYBACK_STATE_MIN_PUBLISH_GAP_MS;
    } else if (lastPublished !== null && lastPublished.body.status === 'playing') {
      dueAtMs = lastPublished.atMs + PLAYBACK_STATE_PUBLISH_INTERVAL_MS;
    }

    if (dueAtMs === null) {
      cancelTimer();
      return;
    }

    const delayMs = dueAtMs - now();
    if (delayMs <= 0) {
      publishNow(latest);
      return;
    }
    if (timer !== null && timer.dueAtMs === dueAtMs) {
      return;
    }
    cancelTimer();
    timer = {
      id: setTimer(() => {
        timer = null;
        if (!stopped && latest !== null && !inFlight) {
          publishNow(latest);
        }
      }, delayMs),
      dueAtMs,
    };
  };

  return {
    update: ({ body }) => {
      if (stopped) {
        return;
      }
      if (body === null) {
        cancelTimer();
        latest = null;
        lastPublished = null;
        discretePending = false;
        return;
      }
      latest = body;
      if (lastPublished === null || isDiscretePlaybackChange(lastPublished, body, now())) {
        discretePending = true;
      }
      schedule();
    },
    flush: () => {
      if (stopped) {
        return;
      }
      discretePending = true;
      schedule();
    },
    stop: () => {
      if (stopped) {
        return;
      }
      stopped = true;
      cancelTimer();
      latest = null;
      lastPublished = null;
      discretePending = false;
    },
  };
}
