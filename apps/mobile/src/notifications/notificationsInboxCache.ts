import type { DTOAccountNotification } from '@podverse/helpers';

/**
 * Last successful inbox page for Offline Mode — session-scoped, not durable across process death.
 */
export type NotificationsInboxCache = {
  items: DTOAccountNotification[];
  page: number;
  totalPages: number;
  unreadCount: number;
};

let lastCachedInbox: NotificationsInboxCache | null = null;

export function getNotificationsInboxCache(): NotificationsInboxCache | null {
  return lastCachedInbox;
}

export function setNotificationsInboxCache(next: NotificationsInboxCache | null): void {
  lastCachedInbox = next;
}

export function resetNotificationsInboxCache(): void {
  lastCachedInbox = null;
}

/** New rows first. Returns `items` unchanged when the id is already listed. */
export function prependLiveNotification(
  items: readonly DTOAccountNotification[],
  notification: DTOAccountNotification
): DTOAccountNotification[] {
  if (items.some((item) => item.id === notification.id)) {
    return items.slice();
  }
  return [notification, ...items];
}
