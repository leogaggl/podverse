import * as Notifications from 'expo-notifications';

import { getMobileConfig } from '../config';
import type { NotificationReadTarget } from './notificationTarget';
import {
  extractNotificationReadTarget,
  extractNotificationTargetPath,
  HOME_FALLBACK_PATH,
} from './notificationTarget';

/**
 * Notification payloads carry a content type + ids, an explicit `url` / `link_path`, or a legacy
 * `{ type, id_text }` pair. Those resolve to a Home-stack path when the destination has a parent
 * (podcast > episode, album > track) and then go through the same pending-deep-link buffer +
 * `getStateFromPath` mapping used for universal links. Malformed/unknown payloads fall back to Home.
 */

export type NotificationOpenUnsubscribe = () => void;

const HANDLED_NOTIFICATION_RESPONSE_LIMIT = 50;

/**
 * Response identifiers already handed to a read-target consumer. Capped so a long session cannot
 * grow without bound. A repeat of an identifier still in the set is not marked again.
 */
const handledNotificationResponseIds = new Set<string>();

let initialNotificationReadTargetConsumed = false;

const isPushRoutingEnabled = (): boolean => {
  return getMobileConfig().pushProvider !== 'none';
};

const claimNotificationResponse = (response: Notifications.NotificationResponse): boolean => {
  const identifier = response.notification.request.identifier;
  if (handledNotificationResponseIds.has(identifier)) {
    return false;
  }
  handledNotificationResponseIds.add(identifier);
  while (handledNotificationResponseIds.size > HANDLED_NOTIFICATION_RESPONSE_LIMIT) {
    const oldest = handledNotificationResponseIds.values().next();
    if (oldest.done === true) {
      break;
    }
    handledNotificationResponseIds.delete(oldest.value);
  }
  return true;
};

export { extractNotificationTargetPath, HOME_FALLBACK_PATH } from './notificationTarget';

const resolveOpenedNotificationPath = (response: Notifications.NotificationResponse): string => {
  const data = response.notification.request.content.data;
  return extractNotificationTargetPath(data) ?? HOME_FALLBACK_PATH;
};

/**
 * Cold-start tap: if the app was launched by tapping a notification, resolve its target path.
 * Returns `null` when the app was not launched from a notification (so the caller leaves the
 * pending-deep-link buffer untouched).
 */
export const getInitialNotificationDeepLinkUrl = async (): Promise<string | null> => {
  if (!isPushRoutingEnabled()) {
    return null;
  }

  const lastResponse = await Notifications.getLastNotificationResponseAsync();
  if (lastResponse === null || lastResponse === undefined) {
    return null;
  }

  return resolveOpenedNotificationPath(lastResponse);
};

/**
 * Foreground/background tap: subscribe to notification-open events and emit the resolved target
 * path. No-op (returns an empty unsubscribe) when push routing is disabled for the flavor.
 */
export const subscribeToNotificationOpen = (
  onOpen: (url: string) => void
): NotificationOpenUnsubscribe => {
  if (!isPushRoutingEnabled()) {
    return () => {};
  }

  const subscription = Notifications.addNotificationResponseReceivedListener((response) => {
    onOpen(resolveOpenedNotificationPath(response));
  });

  return () => {
    subscription.remove();
  };
};

/**
 * The read target of the notification that cold-launched the app, once per process. Later calls
 * resolve null so a remount does not mark it again.
 */
export const getInitialNotificationReadTarget =
  async (): Promise<NotificationReadTarget | null> => {
    if (!isPushRoutingEnabled()) {
      return null;
    }
    if (initialNotificationReadTargetConsumed) {
      return null;
    }
    initialNotificationReadTargetConsumed = true;

    const lastResponse = await Notifications.getLastNotificationResponseAsync();
    if (lastResponse === null || lastResponse === undefined) {
      return null;
    }
    if (!claimNotificationResponse(lastResponse)) {
      return null;
    }
    return extractNotificationReadTarget(lastResponse.notification.request.content.data);
  };

/** Warm taps: emits each tapped push's read target once. Empty unsubscribe when push is off. */
export const subscribeToNotificationOpenReadTarget = (
  onTarget: (target: NotificationReadTarget) => void
): NotificationOpenUnsubscribe => {
  if (!isPushRoutingEnabled()) {
    return () => {};
  }

  const subscription = Notifications.addNotificationResponseReceivedListener((response) => {
    if (!claimNotificationResponse(response)) {
      return;
    }
    const target = extractNotificationReadTarget(response.notification.request.content.data);
    if (target === null) {
      return;
    }
    onTarget(target);
  });

  return () => {
    subscription.remove();
  };
};
