import type { DTOAccountNotification } from '@podverse/helpers';

/**
 * In-memory notification state for the signed-in account: the unread count, the account event
 * stream's connection, and the in-app event channel the inbox, badges, and banner subscribe to.
 * Module-level state with listener sets; no coalescing, because events are rare.
 */

export type NotificationStreamConnection = 'idle' | 'connecting' | 'open' | 'retrying' | 'stopped';

export type NotificationStreamAppEvent =
  | { type: 'created'; notification: DTOAccountNotification; unreadCount: number }
  | { type: 'read'; scope: 'all'; lastReadAt: string; unreadCount: number }
  | { type: 'read'; scope: 'one'; notificationId: number; unreadCount: number }
  /** Rows may have been missed: a fresh open, or the server's replay limit. Refetch lists. */
  | { type: 'resync' };

type NotificationStreamEventListener = (event: NotificationStreamAppEvent) => void;

let unreadCount = 0;
let connection: NotificationStreamConnection = 'idle';
let inboxFocusHolds = 0;

const unreadCountListeners = new Set<() => void>();
const connectionListeners = new Set<() => void>();
const eventListeners = new Set<NotificationStreamEventListener>();
const inboxFocusListeners = new Set<() => void>();

const callListener = (call: () => void): void => {
  try {
    call();
  } catch (error) {
    console.warn('[notifications] stream store listener failed', error);
  }
};

const notify = (listeners: ReadonlySet<() => void>): void => {
  for (const listener of [...listeners]) {
    callListener(listener);
  }
};

export function getNotificationUnreadCount(): number {
  return unreadCount;
}

/** Clamps to a non-negative integer; notifies only when the value changes. */
export function setNotificationUnreadCount(count: number): void {
  const next = Number.isFinite(count) ? Math.max(0, Math.floor(count)) : 0;
  if (next === unreadCount) {
    return;
  }
  unreadCount = next;
  notify(unreadCountListeners);
}

export function subscribeNotificationUnreadCount(listener: () => void): () => void {
  unreadCountListeners.add(listener);
  return () => {
    unreadCountListeners.delete(listener);
  };
}

export function getNotificationStreamConnection(): NotificationStreamConnection {
  return connection;
}

/** Notifies only when the value changes. */
export function setNotificationStreamConnection(next: NotificationStreamConnection): void {
  if (next === connection) {
    return;
  }
  connection = next;
  notify(connectionListeners);
}

export function subscribeNotificationStreamConnection(listener: () => void): () => void {
  connectionListeners.add(listener);
  return () => {
    connectionListeners.delete(listener);
  };
}

export function publishNotificationStreamEvent(event: NotificationStreamAppEvent): void {
  for (const listener of [...eventListeners]) {
    callListener(() => {
      listener(event);
    });
  }
}

export function subscribeNotificationStreamEvents(
  listener: NotificationStreamEventListener
): () => void {
  eventListeners.add(listener);
  return () => {
    eventListeners.delete(listener);
  };
}

/** Runs when the inbox focus count crosses between zero and positive. A double release does not. */
export function subscribeNotificationsInboxFocus(listener: () => void): () => void {
  inboxFocusListeners.add(listener);
  return () => {
    inboxFocusListeners.delete(listener);
  };
}

/**
 * The inbox calls this on focus and the returned function on blur. Holds are counted, so two
 * mounts nest, and calling the returned function more than once releases only its own hold.
 * Listeners run when the first hold is taken and when the last hold is released.
 */
export function markNotificationsInboxFocused(): () => void {
  const crossedIntoFocus = inboxFocusHolds === 0;
  inboxFocusHolds += 1;
  if (crossedIntoFocus) {
    notify(inboxFocusListeners);
  }
  let released = false;
  return () => {
    if (released) {
      return;
    }
    released = true;
    inboxFocusHolds = Math.max(0, inboxFocusHolds - 1);
    if (inboxFocusHolds === 0) {
      notify(inboxFocusListeners);
    }
  };
}

export function isNotificationsInboxFocused(): boolean {
  return inboxFocusHolds > 0;
}

/** Session end: unread count 0, connection idle. Listeners and inbox focus stay. */
export function resetNotificationStreamStore(): void {
  setNotificationUnreadCount(0);
  setNotificationStreamConnection('idle');
}
