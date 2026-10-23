import type { AccountNotificationStreamEvent } from '@podverse/helpers';
import { ACCOUNT_NOTIFICATION_STREAM_EVENT } from '@podverse/helpers';

/** The badge count an event carries, or null for events that carry none. */
export function getNotificationStreamEventUnreadCount(
  event: AccountNotificationStreamEvent
): number | null {
  switch (event.type) {
    case ACCOUNT_NOTIFICATION_STREAM_EVENT.state:
    case ACCOUNT_NOTIFICATION_STREAM_EVENT.created:
    case ACCOUNT_NOTIFICATION_STREAM_EVENT.read:
      return event.data.unread_count;
    case ACCOUNT_NOTIFICATION_STREAM_EVENT.resync:
      return null;
  }
}
