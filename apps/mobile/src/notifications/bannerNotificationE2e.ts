import { NotificationCategoryEnum } from '@podverse/helpers';

import { isMobileE2eFromEnv } from '../config/env';
import { getBannerNotificationEnabled } from '../prefs/bannerNotificationPrefs';
import { presentBannerNotification } from './bannerNotificationStore';
import { isNotificationsInboxFocused } from './notificationStreamStore';

/**
 * Presents one local banner for Maestro. The link opens Notifications. A real new-episode
 * payload would open the episode instead. Mark-read for this id answers 404, which the read
 * action ignores.
 */
export function presentE2eBannerNotification(): void {
  if (!isMobileE2eFromEnv()) {
    return;
  }

  presentBannerNotification(
    {
      account_id: 1,
      body: 'E2E banner body',
      category: NotificationCategoryEnum.NewContent,
      created_at: '2026-01-01T00:00:00.000Z',
      expires_at: '2026-02-01T00:00:00.000Z',
      id: 9001,
      is_unread: true,
      link_path: '/notifications',
      payload: null,
      title: 'E2E Banner',
    },
    getBannerNotificationEnabled(),
    {
      appActive: true,
      inboxFocused: isNotificationsInboxFocused(),
    }
  );
}
