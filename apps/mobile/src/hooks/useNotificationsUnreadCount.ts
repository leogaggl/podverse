import { useSyncExternalStore } from 'react';

import {
  getNotificationUnreadCount,
  subscribeNotificationUnreadCount,
} from '../notifications/notificationStreamStore';

/**
 * The signed-in account's unread notification count. The account event stream keeps it live, and
 * the stream controller polls it only while the stream is down.
 */
export const useNotificationsUnreadCount = (): number =>
  useSyncExternalStore(subscribeNotificationUnreadCount, getNotificationUnreadCount);
