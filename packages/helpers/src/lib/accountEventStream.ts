import type { DTOAccountNotification } from '../dtos/account/accountNotification.js';
import type { AuthSessionEndedNotice } from './authSessionNotice.js';
import { isAuthSessionEndedNotice } from './authSessionNotice.js';

/**
 * The account's one event stream, relative to the versioned API base
 * (`${API_PREFIX}${API_VERSION}`). Event names are namespaced: `notification.*` and `session.*`
 * are in use, and `playback.*` is reserved for cross-device playback state and control commands.
 * Only events that carry an SSE `id:` replay; latest-value state and one-shot commands never
 * carry one.
 */
export const ACCOUNT_EVENTS_STREAM_API_PATH = '/account/events';

/**
 * Used only when the request has no `Last-Event-ID` header, for a client that starts a new
 * connection itself and still wants replay.
 */
export const ACCOUNT_EVENTS_STREAM_LAST_EVENT_ID_QUERY_PARAM = 'last_event_id';

export const ACCOUNT_NOTIFICATION_STREAM_EVENT = {
  state: 'notification.state',
  created: 'notification.created',
  read: 'notification.read',
  resync: 'notification.resync',
} as const;

export type AccountNotificationStreamEventName =
  (typeof ACCOUNT_NOTIFICATION_STREAM_EVENT)[keyof typeof ACCOUNT_NOTIFICATION_STREAM_EVENT];

/**
 * First event on every connection, and again whenever the server recovers its own event feed.
 * Clients set the badge from it; it stands in for refetching the unread count on reconnect.
 */
export interface DTOAccountNotificationStreamState {
  unread_count: number;
  /** ISO timestamp of the account's Mark All as Read cutoff, or null if never set. */
  last_read_at: string | null;
}

/** One new notification. The SSE `id:` of this event equals `notification.id`. */
export interface DTOAccountNotificationStreamCreated {
  notification: DTOAccountNotification;
  unread_count: number;
}

/** Mark All as Read moved the cutoff. */
export interface DTOAccountNotificationStreamReadAll {
  scope: 'all';
  last_read_at: string;
  unread_count: number;
}

/** One notification was marked read on its own. */
export interface DTOAccountNotificationStreamReadOne {
  scope: 'one';
  notification_id: number;
  unread_count: number;
}

export type DTOAccountNotificationStreamRead =
  DTOAccountNotificationStreamReadAll | DTOAccountNotificationStreamReadOne;

/** Replay could not cover the gap. Clients refetch the inbox list; the badge comes from `state`. */
export interface DTOAccountNotificationStreamResync {
  reason: 'replay_limit';
}

export type AccountNotificationStreamEvent =
  | {
      type: typeof ACCOUNT_NOTIFICATION_STREAM_EVENT.state;
      data: DTOAccountNotificationStreamState;
    }
  | {
      type: typeof ACCOUNT_NOTIFICATION_STREAM_EVENT.created;
      data: DTOAccountNotificationStreamCreated;
    }
  | {
      type: typeof ACCOUNT_NOTIFICATION_STREAM_EVENT.read;
      data: DTOAccountNotificationStreamRead;
    }
  | {
      type: typeof ACCOUNT_NOTIFICATION_STREAM_EVENT.resync;
      data: DTOAccountNotificationStreamResync;
    };

export const ACCOUNT_SESSION_STREAM_EVENT = {
  ended: 'session.ended',
} as const;

/**
 * Last event on a stream whose session was ended; the server closes the stream after it. A null
 * notice means this device signed itself out, and the client reconnects as usual. With a notice
 * the client stops reconnecting and signs out with that reason.
 */
export interface DTOAccountSessionStreamEnded {
  notice: AuthSessionEndedNotice | null;
}

export type AccountSessionStreamEvent = {
  type: typeof ACCOUNT_SESSION_STREAM_EVENT.ended;
  data: DTOAccountSessionStreamEnded;
};

/** The server sends an SSE comment at this interval so proxies keep the connection open. */
export const ACCOUNT_EVENTS_STREAM_HEARTBEAT_MS = 25_000;

/**
 * Most notifications the server replays from `Last-Event-ID` before it sends
 * `notification.resync`.
 */
export const ACCOUNT_NOTIFICATIONS_REPLAY_LIMIT = 50;

/**
 * Turns one received notification event into a typed value, or null when the name is unknown or
 * the data does not match. Clients ignore null, so a newer server can add event types, including
 * cross-device playback state and commands in the reserved `playback.*` namespace, without
 * breaking older clients.
 */
export function parseAccountNotificationStreamEvent(
  eventName: string,
  rawData: string
): AccountNotificationStreamEvent | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(rawData);
  } catch {
    return null;
  }

  switch (eventName) {
    case ACCOUNT_NOTIFICATION_STREAM_EVENT.state:
      return parseState(parsed);
    case ACCOUNT_NOTIFICATION_STREAM_EVENT.created:
      return parseCreated(parsed);
    case ACCOUNT_NOTIFICATION_STREAM_EVENT.read:
      return parseRead(parsed);
    case ACCOUNT_NOTIFICATION_STREAM_EVENT.resync:
      return parseResync(parsed);
    default:
      return null;
  }
}

/** Parses one received `session.*` event, or returns null for any other name or invalid data. */
export function parseAccountSessionStreamEvent(
  eventName: string,
  rawData: string
): AccountSessionStreamEvent | null {
  if (eventName !== ACCOUNT_SESSION_STREAM_EVENT.ended) {
    return null;
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(rawData);
  } catch {
    return null;
  }

  if (!isRecord(parsed) || !('notice' in parsed)) {
    return null;
  }
  const notice = parsed.notice;
  if (notice === null) {
    return { type: ACCOUNT_SESSION_STREAM_EVENT.ended, data: { notice: null } };
  }
  if (!isAuthSessionEndedNotice(notice)) {
    return null;
  }

  return { type: ACCOUNT_SESSION_STREAM_EVENT.ended, data: { notice } };
}

function parseState(value: unknown): AccountNotificationStreamEvent | null {
  if (!isRecord(value)) {
    return null;
  }

  const unreadCount = value.unread_count;
  const lastReadAt = value.last_read_at;
  if (!isFiniteNonNegativeInteger(unreadCount) || !isIsoStringOrNull(lastReadAt)) {
    return null;
  }

  return {
    type: ACCOUNT_NOTIFICATION_STREAM_EVENT.state,
    data: {
      unread_count: unreadCount,
      last_read_at: lastReadAt,
    },
  };
}

function parseCreated(value: unknown): AccountNotificationStreamEvent | null {
  if (!isRecord(value)) {
    return null;
  }

  const notification = value.notification;
  const unreadCount = value.unread_count;
  if (!isAccountNotificationDto(notification) || !isFiniteNonNegativeInteger(unreadCount)) {
    return null;
  }

  return {
    type: ACCOUNT_NOTIFICATION_STREAM_EVENT.created,
    data: {
      notification,
      unread_count: unreadCount,
    },
  };
}

function parseRead(value: unknown): AccountNotificationStreamEvent | null {
  if (!isRecord(value)) {
    return null;
  }

  const unreadCount = value.unread_count;
  if (!isFiniteNonNegativeInteger(unreadCount)) {
    return null;
  }

  if (value.scope === 'all') {
    const lastReadAt = value.last_read_at;
    if (typeof lastReadAt !== 'string') {
      return null;
    }

    return {
      type: ACCOUNT_NOTIFICATION_STREAM_EVENT.read,
      data: {
        scope: 'all',
        last_read_at: lastReadAt,
        unread_count: unreadCount,
      },
    };
  }

  if (value.scope === 'one') {
    const notificationId = value.notification_id;
    if (!isPositiveInteger(notificationId)) {
      return null;
    }

    return {
      type: ACCOUNT_NOTIFICATION_STREAM_EVENT.read,
      data: {
        scope: 'one',
        notification_id: notificationId,
        unread_count: unreadCount,
      },
    };
  }

  return null;
}

function parseResync(value: unknown): AccountNotificationStreamEvent | null {
  if (!isRecord(value) || value.reason !== 'replay_limit') {
    return null;
  }

  return {
    type: ACCOUNT_NOTIFICATION_STREAM_EVENT.resync,
    data: {
      reason: 'replay_limit',
    },
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isFiniteNonNegativeInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0;
}

function isPositiveInteger(value: unknown): value is number {
  return isFiniteNonNegativeInteger(value) && value > 0;
}

/** Timestamp string written by the server, or null when Mark All as Read has never run. */
function isIsoStringOrNull(value: unknown): value is string | null {
  return value === null || typeof value === 'string';
}

/**
 * Confirms the fields clients key on. The server serializes the full DTO, so the remaining
 * fields stay on the record.
 */
function isAccountNotificationDto(value: unknown): value is DTOAccountNotification {
  if (!isRecord(value)) {
    return false;
  }

  const id = value.id;
  const accountId = value.account_id;
  const title = value.title;
  const createdAt = value.created_at;
  const isUnread = value.is_unread;
  if (
    !isPositiveInteger(id) ||
    !isPositiveInteger(accountId) ||
    typeof title !== 'string' ||
    typeof createdAt !== 'string' ||
    typeof isUnread !== 'boolean'
  ) {
    return false;
  }

  // The server serializes the full DTO.
  return true;
}
