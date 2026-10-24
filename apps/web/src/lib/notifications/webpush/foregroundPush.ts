import { ROUTES } from '../../../constants/routes';

export type PushMarkReadParams = { item_id_text: string; type: string };

export type ForegroundPushNotification = {
  title: string;
  body: string;
  icon: string | undefined;
  image: string | undefined;
  link: string;
  markRead: PushMarkReadParams | null;
};

const isRecord = (value: unknown): value is Record<string, unknown> => {
  return typeof value === 'object' && value !== null;
};

/** A string the push can use as an id or title. Whitespace alone does not count. */
const readNonEmptyString = (value: unknown): string | null => {
  if (typeof value !== 'string' || value.trim() === '') {
    return null;
  }
  return value;
};

/** Reads a `PUSH_NOTIFICATION` message posted by the service worker; null for anything else. */
export function readForegroundPushMessage(value: unknown): ForegroundPushNotification | null {
  if (!isRecord(value) || !('type' in value) || value.type !== 'PUSH_NOTIFICATION') {
    return null;
  }
  if (!('payload' in value) || !isRecord(value.payload)) {
    return null;
  }

  const payload = value.payload;
  if (!('title' in payload)) {
    return null;
  }
  const title = readNonEmptyString(payload.title);
  if (title === null) {
    return null;
  }

  const body = typeof payload.body === 'string' ? payload.body : '';
  const link = typeof payload.link === 'string' && payload.link !== '' ? payload.link : '/';
  const icon = typeof payload.icon === 'string' ? payload.icon : undefined;
  const image = typeof payload.image === 'string' ? payload.image : undefined;

  let markRead: PushMarkReadParams | null = null;
  if ('data' in payload && isRecord(payload.data)) {
    const itemIdText = readNonEmptyString(payload.data.itemIdText);
    const type = readNonEmptyString(payload.data.type);
    if (itemIdText !== null && type !== null) {
      markRead = { item_id_text: itemIdText, type };
    }
  }

  return { title, body, icon, image, link, markRead };
}

/** The focused tab skips the popup on the Notifications page, where the row appears live. */
export function shouldShowForegroundPushPopup(pathname: string): boolean {
  return pathname !== ROUTES.NOTIFICATIONS;
}

/**
 * Options for `registration.showNotification`, with the `data` shape the worker's click handler reads.
 * The tag matches `public/webpush-sw.js`, so a later push for the same item and type replaces the popup.
 * `image` is part of that call; the DOM `NotificationOptions` type omits it.
 */
export function buildForegroundPushNotificationOptions(
  notification: ForegroundPushNotification
): NotificationOptions & { image?: string } {
  const itemIdText = notification.markRead === null ? null : notification.markRead.item_id_text;
  const type = notification.markRead === null ? null : notification.markRead.type;
  const options: NotificationOptions & { image?: string } = {
    body: notification.body,
    badge: '/favicon/favicon-96x96.png',
    tag:
      itemIdText !== null && type !== null
        ? `podverse-notification-${type}-${itemIdText}`
        : `podverse-notification-${Date.now()}`,
    data: {
      url: notification.link,
      itemIdText,
      type,
    },
  };
  if (notification.icon !== undefined) {
    options.icon = notification.icon;
  }
  if (notification.image !== undefined) {
    options.image = notification.image;
  }
  return options;
}
