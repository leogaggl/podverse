import { getErrorResponseStatus } from '@podverse/helpers/error';

import type { NotificationStreamConnection } from './notificationStreamStore';

export const NOTIFICATION_STREAM_RETRY_DELAYS_MS = [1_000, 2_000, 5_000, 10_000, 30_000] as const;
/** No state event this long after a connect starts: abort and retry. */
export const NOTIFICATION_STREAM_OPEN_TIMEOUT_MS = 15_000;
/**
 * No bytes this long: the connection went silent without closing. Over two missed 25 s
 * heartbeats.
 */
export const NOTIFICATION_STREAM_IDLE_TIMEOUT_MS = 60_000;
/** A connection that stayed open this long and then ended cleanly reconnects at once. */
export const NOTIFICATION_STREAM_HEALTHY_OPEN_MS = 10_000;
export const NOTIFICATION_UNREAD_POLL_INTERVAL_MS = 60_000;
/** Ids remembered per session to drop a replayed duplicate. */
export const NOTIFICATION_STREAM_SEEN_ID_LIMIT = 200;

/**
 * A non-2xx response from the account event stream. `response.status` lets
 * `getErrorResponseStatus` and `classifySyncError` read it like an axios error.
 */
export class NotificationStreamHttpError extends Error {
  readonly response: { status: number };

  constructor(status: number) {
    super(`Notification stream responded with HTTP ${status}`);
    this.name = 'NotificationStreamHttpError';
    this.response = { status };
  }
}

/**
 * - `final`: the auth gate already refreshed once or cleared the session; stop.
 * - `poll_only`: stop reconnecting for the rest of the session and keep polling.
 * - `retry`: reconnect with backoff and poll while down.
 */
export type NotificationStreamFailureKind = 'final' | 'poll_only' | 'retry';

export function classifyNotificationStreamFailure(error: unknown): NotificationStreamFailureKind {
  const status = getErrorResponseStatus(error);
  if (status === 401) {
    return 'final';
  }
  if (status === 403 || status === 404 || status === 429) {
    return 'poll_only';
  }
  return 'retry';
}

/** Delay before reconnect number `failureCount` (1-based), with a 0.8–1.2 jitter factor. */
export function notificationStreamRetryDelayMs(failureCount: number, random: () => number): number {
  const ladder = NOTIFICATION_STREAM_RETRY_DELAYS_MS;
  const index = Math.min(Math.max(failureCount, 1), ladder.length) - 1;
  const baseMs = ladder[index] ?? ladder[0];
  return Math.round(baseMs * (0.8 + random() * 0.4));
}

export type SeenNotificationIds = {
  /** False when the id was already seen; records it otherwise. */
  add: (id: number) => boolean;
  clear: () => void;
};

/** Remembers the most recent `limit` ids, evicting the oldest first. */
export function createSeenNotificationIds(limit: number): SeenNotificationIds {
  const ids = new Set<number>();
  return {
    add(id: number): boolean {
      if (ids.has(id)) {
        return false;
      }
      ids.add(id);
      while (ids.size > limit) {
        const oldest = ids.values().next();
        if (oldest.done === true) {
          break;
        }
        ids.delete(oldest.value);
      }
      return true;
    },
    clear(): void {
      ids.clear();
    },
  };
}

export type NotificationStreamRunInputs = {
  /** `status === 'authenticated'` and an access token is present. */
  signedIn: boolean;
  /** The app is in the foreground. `inactive` leaves the previous value. */
  appActive: boolean;
  /**
   * Local audio is playing. While true, the stream stays open in the background. Widening what
   * counts as background audio widens the run condition without a policy or controller change.
   */
  backgroundAudioActive: boolean;
  offlineModeEnabled: boolean;
  termsBlocksAccountSync: boolean;
};

/**
 * The stream runs while signed in, in the foreground or playing audio, with Offline Mode off and
 * terms not blocking account sync.
 */
export function shouldRunNotificationStream(inputs: NotificationStreamRunInputs): boolean {
  return (
    inputs.signedIn &&
    (inputs.appActive || inputs.backgroundAudioActive) &&
    !inputs.offlineModeEnabled &&
    !inputs.termsBlocksAccountSync
  );
}

export type NotificationStreamForegroundReturnAction = 'keep' | 'restart';

/**
 * The app returned to the foreground while the session stayed started. Keep a connection that
 * is open and was recently active; restart the session otherwise.
 */
export function notificationStreamForegroundReturnAction(params: {
  connection: NotificationStreamConnection;
  /** Wall-clock ms since the stream last sent any bytes, or null when it never has. */
  msSinceActivity: number | null;
}): NotificationStreamForegroundReturnAction {
  const { connection, msSinceActivity } = params;
  if (
    connection === 'open' &&
    msSinceActivity !== null &&
    msSinceActivity < NOTIFICATION_STREAM_IDLE_TIMEOUT_MS
  ) {
    return 'keep';
  }
  return 'restart';
}
