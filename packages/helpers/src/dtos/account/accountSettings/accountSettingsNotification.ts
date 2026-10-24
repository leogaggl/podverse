import type { DTOAccountSettingsNotificationType } from './accountSettingsNotificationType.js';

export interface DTOAccountSettingsNotification {
  id: number;
  account_settings_id: number;
  /**
   * Absent means off, which is the server default.
   */
  auto_enable_on_subscribe?: boolean;
  account_settings_notification_types?: DTOAccountSettingsNotificationType[];
}
