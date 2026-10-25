import type { AccountNotificationStreamEvent, AuthSessionEndedNotice } from '@podverse/helpers';
import {
  parseAccountNotificationStreamEvent,
  parseAccountSessionStreamEvent,
} from '@podverse/helpers';

import type {
  NotificationStreamConnection,
  NotificationStreamConnectionOptions,
  NotificationStreamStatus,
} from './notificationStreamConnection';
import { openNotificationStreamConnection } from './notificationStreamConnection';

export type LockManagerLike = {
  request(
    name: string,
    options: { signal: AbortSignal },
    callback: () => Promise<void>
  ): Promise<unknown>;
};

export type BroadcastChannelLike = {
  postMessage(message: unknown): void;
  onmessage: ((event: MessageEvent<unknown>) => void) | null;
  close(): void;
};

export type NotificationStreamEnvironment = {
  locks: LockManagerLike | null;
  createChannel: ((name: string) => BroadcastChannelLike) | null;
  openConnection: (options: NotificationStreamConnectionOptions) => NotificationStreamConnection;
};

export type NotificationStreamCoordinatorOptions = {
  accountId: number;
  apiBaseUrl: string;
  /** Parsed events, in this tab, whether this tab leads or follows. */
  onEvent: (event: AccountNotificationStreamEvent) => void;
  /** Called in this tab when the stream reports that this browser's session was ended elsewhere. */
  onSessionEnded?: (notice: AuthSessionEndedNotice) => void;
  onStatus: (status: NotificationStreamStatus) => void;
  environment?: Partial<NotificationStreamEnvironment>;
};

export type NotificationStreamCoordinator = {
  stop(): void;
};

/** Shared by every account; each message carries its `accountId`. */
const NOTIFICATION_STREAM_CHANNEL_NAME = 'podverse:notification-stream';

function getNotificationStreamLockName(accountId: number): string {
  return `podverse:notification-stream:${accountId}`;
}

type ChannelMessage =
  | {
      kind: 'event';
      accountId: number;
      eventName: string;
      rawData: string;
      lastEventId: number | null;
    }
  | { kind: 'status'; accountId: number; status: NotificationStreamStatus }
  | { kind: 'hello'; accountId: number }
  | {
      kind: 'snapshot';
      accountId: number;
      status: NotificationStreamStatus;
      lastEventId: number | null;
    };

function isNotificationStreamStatus(value: unknown): value is NotificationStreamStatus {
  return value === 'off' || value === 'connecting' || value === 'open' || value === 'down';
}

function isLastEventId(value: unknown): value is number | null {
  return value === null || (typeof value === 'number' && Number.isSafeInteger(value) && value > 0);
}

/** Channel data comes from other tabs, possibly running an older build, so it is checked here. */
function readChannelMessage(value: unknown): ChannelMessage | null {
  if (typeof value !== 'object' || value === null) {
    return null;
  }
  if (!('kind' in value) || !('accountId' in value)) {
    return null;
  }
  const { kind, accountId } = value;
  if (typeof accountId !== 'number') {
    return null;
  }

  switch (kind) {
    case 'hello':
      return { kind: 'hello', accountId };
    case 'status': {
      const status = 'status' in value ? value.status : undefined;
      return isNotificationStreamStatus(status) ? { kind: 'status', accountId, status } : null;
    }
    case 'snapshot': {
      const status = 'status' in value ? value.status : undefined;
      const lastEventId = 'lastEventId' in value ? value.lastEventId : undefined;
      if (!isNotificationStreamStatus(status) || !isLastEventId(lastEventId)) {
        return null;
      }
      return { kind: 'snapshot', accountId, status, lastEventId };
    }
    case 'event': {
      const eventName = 'eventName' in value ? value.eventName : undefined;
      const rawData = 'rawData' in value ? value.rawData : undefined;
      const lastEventId = 'lastEventId' in value ? value.lastEventId : undefined;
      if (
        typeof eventName !== 'string' ||
        typeof rawData !== 'string' ||
        !isLastEventId(lastEventId)
      ) {
        return null;
      }
      return { kind: 'event', accountId, eventName, rawData, lastEventId };
    }
    default:
      return null;
  }
}

function isAbortError(error: unknown): boolean {
  return (
    typeof error === 'object' && error !== null && 'name' in error && error.name === 'AbortError'
  );
}

function getDefaultLocks(): LockManagerLike | null {
  return typeof navigator !== 'undefined' && 'locks' in navigator ? navigator.locks : null;
}

function getDefaultCreateChannel(): ((name: string) => BroadcastChannelLike) | null {
  return typeof BroadcastChannel === 'function' ? (name) => new BroadcastChannel(name) : null;
}

function resolveEnvironment(
  overrides: Partial<NotificationStreamEnvironment> | undefined
): NotificationStreamEnvironment {
  return {
    locks: overrides?.locks === undefined ? getDefaultLocks() : overrides.locks,
    createChannel:
      overrides?.createChannel === undefined ? getDefaultCreateChannel() : overrides.createChannel,
    openConnection: overrides?.openConnection ?? openNotificationStreamConnection,
  };
}

/**
 * Keeps one account event stream per browser profile and account. Tabs elect a leader with a Web
 * Lock; the leader holds the stream and relays each raw event over a `BroadcastChannel`, and every
 * tab parses what it receives. When the leader tab closes, the browser releases its lock and the
 * next waiting tab opens the stream from the newest `notification.created` id it has seen. Without
 * Web Locks or `BroadcastChannel`, each tab holds its own stream.
 */
export function startNotificationStreamCoordinator(
  options: NotificationStreamCoordinatorOptions
): NotificationStreamCoordinator {
  const { accountId, apiBaseUrl, onEvent, onStatus } = options;
  const { locks, createChannel, openConnection } = resolveEnvironment(options.environment);

  let stopped = false;
  let lastEventId: number | null = null;
  let connection: NotificationStreamConnection | null = null;

  const deliver = (eventName: string, rawData: string) => {
    const parsed = parseAccountNotificationStreamEvent(eventName, rawData);
    if (parsed !== null) {
      onEvent(parsed);
    }
    const sessionEvent = parseAccountSessionStreamEvent(eventName, rawData);
    if (sessionEvent !== null && sessionEvent.data.notice !== null) {
      options.onSessionEnded?.(sessionEvent.data.notice);
    }
  };

  const noteLastEventId = (id: number | null) => {
    if (id !== null && (lastEventId === null || id > lastEventId)) {
      lastEventId = id;
    }
  };

  if (locks === null || createChannel === null) {
    connection = openConnection({
      apiBaseUrl,
      initialLastEventId: null,
      onRawEvent: (raw) => {
        if (!stopped) {
          deliver(raw.eventName, raw.rawData);
        }
      },
      onStatus: (next) => {
        if (!stopped) {
          onStatus(next);
        }
      },
    });

    return {
      stop: () => {
        if (stopped) {
          return;
        }
        stopped = true;
        connection?.close();
        connection = null;
        onStatus('off');
      },
    };
  }

  const channel = createChannel(NOTIFICATION_STREAM_CHANNEL_NAME);
  const lockAbort = new AbortController();
  let status: NotificationStreamStatus = 'connecting';
  let leading = false;
  let releaseLock: (() => void) | null = null;

  const post = (message: ChannelMessage) => {
    channel.postMessage(message);
  };

  const setStatus = (next: NotificationStreamStatus) => {
    status = next;
    onStatus(next);
  };

  const lead = async (): Promise<void> => {
    if (stopped) {
      return;
    }
    leading = true;
    const held = new Promise<void>((resolve) => {
      releaseLock = resolve;
    });
    connection = openConnection({
      apiBaseUrl,
      initialLastEventId: lastEventId,
      onRawEvent: (raw) => {
        if (stopped) {
          return;
        }
        noteLastEventId(raw.lastEventId);
        deliver(raw.eventName, raw.rawData);
        post({
          kind: 'event',
          accountId,
          eventName: raw.eventName,
          rawData: raw.rawData,
          lastEventId: raw.lastEventId,
        });
      },
      onStatus: (next) => {
        if (stopped) {
          return;
        }
        setStatus(next);
        post({ kind: 'status', accountId, status: next });
      },
    });
    await held;
  };

  channel.onmessage = (event) => {
    const message = readChannelMessage(event.data);
    if (stopped || message === null || message.accountId !== accountId) {
      return;
    }

    switch (message.kind) {
      case 'hello':
        if (leading) {
          post({ kind: 'snapshot', accountId, status, lastEventId });
        }
        return;
      case 'event':
        if (!leading) {
          noteLastEventId(message.lastEventId);
          deliver(message.eventName, message.rawData);
        }
        return;
      case 'status':
        if (!leading) {
          setStatus(message.status);
        }
        return;
      case 'snapshot':
        if (!leading) {
          noteLastEventId(message.lastEventId);
          setStatus(message.status);
        }
        return;
    }
  };

  setStatus('connecting');
  post({ kind: 'hello', accountId });
  locks
    .request(getNotificationStreamLockName(accountId), { signal: lockAbort.signal }, lead)
    .catch((error: unknown) => {
      if (stopped && isAbortError(error)) {
        return;
      }
      console.warn('Notification stream lock failed', error);
    });

  return {
    stop: () => {
      if (stopped) {
        return;
      }
      stopped = true;
      lockAbort.abort();
      const wasLeading = leading;
      leading = false;
      connection?.close();
      connection = null;
      if (wasLeading) {
        post({ kind: 'status', accountId, status: 'connecting' });
      }
      releaseLock?.();
      releaseLock = null;
      channel.onmessage = null;
      channel.close();
      onStatus('off');
    },
  };
}
