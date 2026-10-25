import type { AccountNotificationStreamEvent } from '@podverse/helpers';
import { ACCOUNT_NOTIFICATION_STREAM_EVENT } from '@podverse/helpers';
import type { AccountPlaybackStreamEvent } from '@podverse/helpers/accountPlaybackStream';

import type { NotificationStreamFailureKind } from './notificationStreamPolicy';
import {
  classifyNotificationStreamFailure,
  createSeenNotificationIds,
  NOTIFICATION_STREAM_HEALTHY_OPEN_MS,
  NOTIFICATION_STREAM_IDLE_TIMEOUT_MS,
  NOTIFICATION_STREAM_OPEN_TIMEOUT_MS,
  NOTIFICATION_STREAM_SEEN_ID_LIMIT,
  NOTIFICATION_UNREAD_POLL_INTERVAL_MS,
  notificationStreamForegroundReturnAction,
  notificationStreamRetryDelayMs,
} from './notificationStreamPolicy';
import {
  getNotificationStreamConnection,
  publishNotificationStreamEvent,
  publishNotificationStreamPlaybackEvent,
  setNotificationStreamConnection,
  setNotificationUnreadCount,
} from './notificationStreamStore';

export type NotificationStreamConnectParams = {
  lastEventId: number | null;
  signal: AbortSignal;
  onEvent: (event: AccountNotificationStreamEvent) => void;
  /** A `playback.*` event. It never opens the connection or moves the replay position. */
  onPlaybackEvent: (event: AccountPlaybackStreamEvent) => void;
  /** Any bytes: an event, a heartbeat comment, or a retry line. */
  onActivity: () => void;
};

export type NotificationStreamControllerDeps = {
  /**
   * Opens the stream and reads until the server ends it. Rejects with NotificationStreamHttpError
   * for a non-2xx status, or with the transport error.
   */
  connect: (params: NotificationStreamConnectParams) => Promise<void>;
  fetchUnreadCount: () => Promise<number>;
  now: () => number;
  random: () => number;
};

export type NotificationStreamController = {
  start: () => void;
  stop: () => void;
  /** The app returned to the foreground. Keeps a live connection; restarts the session otherwise. */
  resumeForeground: () => void;
};

/**
 * Holds the account event stream open for one session at a time and writes what it receives to
 * the notification stream store. A session runs from `start()` to `stop()`; its first connection
 * sends no `Last-Event-ID`, and reconnects inside it send the highest notification id it received.
 * The unread-count poll runs only while the session is started and no connection is open.
 *
 * Timers may not fire while the app is in the background (Android stops JS timers there), so
 * nothing that must happen in the background waits on one: `resumeForeground` reads `now()`.
 */
export function createNotificationStreamController(
  deps: NotificationStreamControllerDeps
): NotificationStreamController {
  const seenIds = createSeenNotificationIds(NOTIFICATION_STREAM_SEEN_ID_LIMIT);

  let started = false;
  /** Every callback and settle path compares its captured attempt with this one. */
  let attempt = 0;
  /** The current attempt already failed, ended, or timed out; its late callbacks are dropped. */
  let attemptSettled = true;
  let abortController: AbortController | null = null;
  let sessionMaxId: number | null = null;
  let sessionHasOpened = false;
  let lastActivityAt: number | null = null;
  let openedAt: number | null = null;
  let failures = 0;
  let refetchedSinceOpen = false;
  /** Bumped on every count the stream writes, so an HTTP count that started earlier is dropped. */
  let streamCountVersion = 0;

  let retryTimer: ReturnType<typeof setTimeout> | null = null;
  let openTimer: ReturnType<typeof setTimeout> | null = null;
  let idleTimer: ReturnType<typeof setTimeout> | null = null;
  let pollTimer: ReturnType<typeof setInterval> | null = null;

  const isCurrentAttempt = (myAttempt: number): boolean =>
    started && myAttempt === attempt && !attemptSettled;

  const clearRetryTimer = (): void => {
    if (retryTimer !== null) {
      clearTimeout(retryTimer);
      retryTimer = null;
    }
  };

  const clearOpenTimer = (): void => {
    if (openTimer !== null) {
      clearTimeout(openTimer);
      openTimer = null;
    }
  };

  const clearIdleTimer = (): void => {
    if (idleTimer !== null) {
      clearTimeout(idleTimer);
      idleTimer = null;
    }
  };

  const clearPollTimer = (): void => {
    if (pollTimer !== null) {
      clearInterval(pollTimer);
      pollTimer = null;
    }
  };

  const setUnreadCountFromStream = (count: number): void => {
    streamCountVersion += 1;
    setNotificationUnreadCount(count);
  };

  const fetchUnreadCount = (): void => {
    const myAttempt = attempt;
    const myCountVersion = streamCountVersion;
    deps.fetchUnreadCount().then(
      (count) => {
        if (started && myAttempt === attempt && myCountVersion === streamCountVersion) {
          setNotificationUnreadCount(count);
        }
      },
      (error: unknown) => {
        console.warn('[notifications] unread count fetch failed', error);
      }
    );
  };

  const refetchOnce = (): void => {
    if (refetchedSinceOpen) {
      return;
    }
    refetchedSinceOpen = true;
    fetchUnreadCount();
  };

  const ensurePollTimer = (): void => {
    if (pollTimer !== null) {
      return;
    }
    pollTimer = setInterval(() => {
      if (started) {
        fetchUnreadCount();
      }
    }, NOTIFICATION_UNREAD_POLL_INTERVAL_MS);
  };

  const settleAttempt = (): void => {
    attemptSettled = true;
    clearOpenTimer();
    clearIdleTimer();
  };

  const handleFailure = (kind: NotificationStreamFailureKind): void => {
    if (kind === 'final') {
      setNotificationStreamConnection('stopped');
      clearPollTimer();
      return;
    }

    if (kind === 'poll_only') {
      setNotificationStreamConnection('stopped');
      refetchOnce();
      ensurePollTimer();
      return;
    }

    setNotificationStreamConnection('retrying');
    refetchOnce();
    ensurePollTimer();
    failures += 1;
    clearRetryTimer();
    retryTimer = setTimeout(
      () => {
        retryTimer = null;
        if (started) {
          connectNow();
        }
      },
      notificationStreamRetryDelayMs(failures, deps.random)
    );
  };

  const abortAndRetry = (): void => {
    settleAttempt();
    abortController?.abort();
    handleFailure('retry');
  };

  const handleEvent = (event: AccountNotificationStreamEvent): void => {
    switch (event.type) {
      case ACCOUNT_NOTIFICATION_STREAM_EVENT.state: {
        const isSessionFirstOpen = !sessionHasOpened;
        if (openedAt === null) {
          openedAt = deps.now();
          sessionHasOpened = true;
          clearOpenTimer();
          clearPollTimer();
          failures = 0;
          refetchedSinceOpen = false;
          setNotificationStreamConnection('open');
        }
        setUnreadCountFromStream(event.data.unread_count);
        if (isSessionFirstOpen) {
          publishNotificationStreamEvent({ type: 'resync' });
        }
        return;
      }

      case ACCOUNT_NOTIFICATION_STREAM_EVENT.created: {
        const { notification } = event.data;
        if (!seenIds.add(notification.id)) {
          return;
        }
        sessionMaxId =
          sessionMaxId === null ? notification.id : Math.max(sessionMaxId, notification.id);
        setUnreadCountFromStream(event.data.unread_count);
        publishNotificationStreamEvent({
          type: 'created',
          notification,
          unreadCount: event.data.unread_count,
        });
        return;
      }

      case ACCOUNT_NOTIFICATION_STREAM_EVENT.read: {
        const { data } = event;
        setUnreadCountFromStream(data.unread_count);
        if (data.scope === 'all') {
          publishNotificationStreamEvent({
            type: 'read',
            scope: 'all',
            lastReadAt: data.last_read_at,
            unreadCount: data.unread_count,
          });
        } else {
          publishNotificationStreamEvent({
            type: 'read',
            scope: 'one',
            notificationId: data.notification_id,
            unreadCount: data.unread_count,
          });
        }
        return;
      }

      case ACCOUNT_NOTIFICATION_STREAM_EVENT.resync:
        publishNotificationStreamEvent({ type: 'resync' });
        return;
    }
  };

  const connectNow = (): void => {
    clearRetryTimer();
    attempt += 1;
    const myAttempt = attempt;
    attemptSettled = false;
    openedAt = null;
    const attemptAbortController = new AbortController();
    abortController = attemptAbortController;

    setNotificationStreamConnection('connecting');
    ensurePollTimer();
    openTimer = setTimeout(() => {
      openTimer = null;
      if (isCurrentAttempt(myAttempt)) {
        abortAndRetry();
      }
    }, NOTIFICATION_STREAM_OPEN_TIMEOUT_MS);

    const onActivity = (): void => {
      if (!isCurrentAttempt(myAttempt)) {
        return;
      }
      lastActivityAt = deps.now();
      clearIdleTimer();
      idleTimer = setTimeout(() => {
        idleTimer = null;
        if (isCurrentAttempt(myAttempt)) {
          abortAndRetry();
        }
      }, NOTIFICATION_STREAM_IDLE_TIMEOUT_MS);
    };

    const onEvent = (event: AccountNotificationStreamEvent): void => {
      if (isCurrentAttempt(myAttempt)) {
        handleEvent(event);
      }
    };

    const onPlaybackEvent = (event: AccountPlaybackStreamEvent): void => {
      if (isCurrentAttempt(myAttempt)) {
        publishNotificationStreamPlaybackEvent(event);
      }
    };

    deps
      .connect({
        lastEventId: sessionMaxId,
        signal: attemptAbortController.signal,
        onEvent,
        onPlaybackEvent,
        onActivity,
      })
      .then(
        () => {
          if (!isCurrentAttempt(myAttempt)) {
            return;
          }
          const stayedOpenMs = openedAt === null ? null : deps.now() - openedAt;
          settleAttempt();
          if (stayedOpenMs !== null && stayedOpenMs >= NOTIFICATION_STREAM_HEALTHY_OPEN_MS) {
            connectNow();
            return;
          }
          handleFailure('retry');
        },
        (error: unknown) => {
          if (!isCurrentAttempt(myAttempt)) {
            return;
          }
          settleAttempt();
          handleFailure(classifyNotificationStreamFailure(error));
        }
      );
  };

  const start = (): void => {
    if (started) {
      return;
    }
    started = true;
    seenIds.clear();
    sessionMaxId = null;
    sessionHasOpened = false;
    lastActivityAt = null;
    failures = 0;
    refetchedSinceOpen = false;
    connectNow();
  };

  const stop = (): void => {
    started = false;
    attempt += 1;
    attemptSettled = true;
    abortController?.abort();
    abortController = null;
    clearRetryTimer();
    clearOpenTimer();
    clearIdleTimer();
    clearPollTimer();
    setNotificationStreamConnection('idle');
  };

  const resumeForeground = (): void => {
    if (!started) {
      return;
    }
    const action = notificationStreamForegroundReturnAction({
      connection: getNotificationStreamConnection(),
      msSinceActivity: lastActivityAt === null ? null : deps.now() - lastActivityAt,
    });
    if (action === 'restart') {
      stop();
      start();
    }
  };

  return { start, stop, resumeForeground };
}
