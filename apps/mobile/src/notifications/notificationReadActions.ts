import { getErrorResponseStatus } from '@podverse/helpers/error';

import { notificationsRepository } from '../data/repositories/notificationsRepository';
import type { MobileAuthRequestContext } from '../data/repositories/types';
import { createInFlightGuard } from '../lib/rateLimit/createInFlightGuard';
import { OfflineModeEnabledError } from '../prefs/offlineMode';
import type { NotificationReadTarget } from '../push/notificationTarget';
import { setNotificationUnreadCount } from './notificationStreamStore';

const markReadInFlight = createInFlightGuard();

/**
 * A 404 means the row is already gone. Offline Mode parked the request before it left the device.
 * Neither is retried and neither is warned about.
 */
const isQuietMarkReadFailure = (error: unknown): boolean => {
  if (error instanceof OfflineModeEnabledError) {
    return true;
  }
  return getErrorResponseStatus(error) === 404;
};

const applyMarkRead = async (
  key: string,
  work: () => Promise<{ unreadCount: number }>
): Promise<void> => {
  try {
    const result = await markReadInFlight.run(key, work);
    if (result === false) {
      return;
    }
    setNotificationUnreadCount(result.unreadCount);
  } catch (error: unknown) {
    if (isQuietMarkReadFailure(error)) {
      return;
    }
    console.warn('[notifications] mark one read failed', { error });
  }
};

/** Marks one notification read and applies the returned unread count. Never throws. */
export const markNotificationReadById = (
  context: MobileAuthRequestContext,
  notificationId: number
): Promise<void> =>
  applyMarkRead(`id:${notificationId}`, () =>
    notificationsRepository.markReadOne(context, notificationId)
  );

/** Marks the notification behind a tapped push read and applies the count. Never throws. */
export const markPushNotificationRead = (
  context: MobileAuthRequestContext,
  target: NotificationReadTarget
): Promise<void> =>
  applyMarkRead(`item:${target.itemIdText}:${target.type}`, () =>
    notificationsRepository.markReadByItem(context, target)
  );
