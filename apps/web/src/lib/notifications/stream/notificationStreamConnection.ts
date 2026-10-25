import {
  ACCOUNT_NOTIFICATION_STREAM_EVENT,
  ACCOUNT_SESSION_STREAM_EVENT,
  parseAccountSessionStreamEvent,
} from '@podverse/helpers';

import { buildNotificationStreamUrl, readSseLastEventId } from './notificationStreamUrl';

export type NotificationStreamStatus = 'off' | 'connecting' | 'open' | 'down';

/**
 * One received SSE event, before parsing. Carries every `notification.*` and `session.*` event
 * the stream sends. `lastEventId` is set only on `notification.created`.
 */
export type RawNotificationStreamEvent = {
  eventName: string;
  rawData: string;
  lastEventId: number | null;
};

export type EventSourceLike = {
  readonly readyState: number;
  onopen: ((event: Event) => void) | null;
  onerror: ((event: Event) => void) | null;
  addEventListener(type: string, listener: (event: MessageEvent<string>) => void): void;
  close(): void;
};

export type NotificationStreamConnectionOptions = {
  apiBaseUrl: string;
  initialLastEventId: number | null;
  onRawEvent: (event: RawNotificationStreamEvent) => void;
  onStatus: (status: NotificationStreamStatus) => void;
  createEventSource?: (url: string) => EventSourceLike;
  setTimer?: (callback: () => void, ms: number) => number;
  clearTimer?: (id: number) => void;
};

export type NotificationStreamConnection = {
  getLastEventId(): number | null;
  close(): void;
};

/** `EventSource.CLOSED` per the HTML spec, for environments without a global `EventSource`. */
const EVENT_SOURCE_CLOSED = 2;

/**
 * Wait before replacing an `EventSource` that gave up (HTTP error status or wrong content type).
 * Doubles per consecutive failure up to the cap; the next `open` resets it.
 */
const FATAL_RETRY_INITIAL_MS = 30_000;
const FATAL_RETRY_MAX_MS = 300_000;

function getEventSourceClosedState(): number {
  return typeof EventSource === 'undefined' ? EVENT_SOURCE_CLOSED : EventSource.CLOSED;
}

/** Cookies authenticate the stream; the API's CORS allows credentials from the web origin. */
function createBrowserEventSource(url: string): EventSourceLike {
  return new EventSource(url, { withCredentials: true });
}

/**
 * Holds one `EventSource` open. The browser reconnects by itself after a dropped connection,
 * sending `Last-Event-ID`; this module only steps in when the browser gives up for good.
 */
export function openNotificationStreamConnection(
  options: NotificationStreamConnectionOptions
): NotificationStreamConnection {
  const { apiBaseUrl, onRawEvent, onStatus } = options;
  const createEventSource = options.createEventSource ?? createBrowserEventSource;
  const setTimer =
    options.setTimer ?? ((callback: () => void, ms: number) => window.setTimeout(callback, ms));
  const clearTimer = options.clearTimer ?? ((id: number) => window.clearTimeout(id));

  let lastEventId = options.initialLastEventId;
  let source: EventSourceLike | null = null;
  let retryTimer: number | null = null;
  let retryDelayMs = FATAL_RETRY_INITIAL_MS;
  let closed = false;

  const detach = (target: EventSourceLike) => {
    target.onopen = null;
    target.onerror = null;
    target.close();
  };

  const scheduleRetry = () => {
    const delayMs = retryDelayMs;
    retryDelayMs = Math.min(retryDelayMs * 2, FATAL_RETRY_MAX_MS);
    retryTimer = setTimer(() => {
      retryTimer = null;
      connect();
    }, delayMs);
  };

  const close = () => {
    if (closed) {
      return;
    }
    closed = true;
    if (retryTimer !== null) {
      clearTimer(retryTimer);
      retryTimer = null;
    }
    if (source !== null) {
      const current = source;
      source = null;
      detach(current);
    }
    onStatus('off');
  };

  const connect = () => {
    const next = createEventSource(buildNotificationStreamUrl(apiBaseUrl, lastEventId));
    source = next;
    onStatus('connecting');

    next.onopen = () => {
      if (source !== next) {
        return;
      }
      retryDelayMs = FATAL_RETRY_INITIAL_MS;
      onStatus('open');
    };

    next.onerror = () => {
      if (source !== next) {
        return;
      }
      if (next.readyState !== getEventSourceClosedState()) {
        onStatus('connecting');
        return;
      }
      source = null;
      detach(next);
      onStatus('down');
      scheduleRetry();
    };

    for (const eventName of Object.values(ACCOUNT_NOTIFICATION_STREAM_EVENT)) {
      next.addEventListener(eventName, (event) => {
        if (source !== next) {
          return;
        }
        const eventLastId =
          eventName === ACCOUNT_NOTIFICATION_STREAM_EVENT.created
            ? readSseLastEventId(event.lastEventId)
            : null;
        if (eventLastId !== null) {
          lastEventId = eventLastId;
        }
        onRawEvent({ eventName, rawData: event.data, lastEventId: eventLastId });
      });
    }

    // A notice means this browser's session was ended elsewhere, so close before the browser
    // reconnects into a refusal. A null notice is this browser ending or replacing its own session.
    next.addEventListener(ACCOUNT_SESSION_STREAM_EVENT.ended, (event) => {
      if (source !== next) {
        return;
      }
      const eventName = ACCOUNT_SESSION_STREAM_EVENT.ended;
      onRawEvent({ eventName, rawData: event.data, lastEventId: null });
      const parsed = parseAccountSessionStreamEvent(eventName, event.data);
      if (parsed !== null && parsed.data.notice !== null) {
        close();
      }
    });
  };

  connect();

  return {
    getLastEventId: () => lastEventId,
    close,
  };
}
