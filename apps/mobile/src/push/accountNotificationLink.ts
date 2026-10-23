import { resolveNotificationDestinationFromPayload } from '@podverse/helpers';

import { HOME_FALLBACK_PATH } from './notificationTarget';

/**
 * The path an inbox row and a banner open. `link_path` on the notification wins over a
 * `link_path` inside the payload.
 */
export function resolveAccountNotificationOpenPath(notification: {
  link_path: string | null;
  payload: Record<string, unknown> | null;
}): string {
  const destination = resolveNotificationDestinationFromPayload({
    ...(notification.payload ?? {}),
    link_path: notification.link_path,
  });
  return (
    destination.mobileStackPath ??
    (destination.kind === 'home' ? HOME_FALLBACK_PATH : destination.webPath)
  );
}
