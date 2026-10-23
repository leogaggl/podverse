import type { NotificationCategoryValues } from '../../lib/notificationCategory.js';

export interface DTOAccountNotification {
  id: number;
  account_id: number;
  category: NotificationCategoryValues;
  /**
   * True when the row was created after the account's Mark All as Read cutoff and has not been read
   * on its own (a banner tap, a push tap, or opening it from the inbox).
   *
   * Derived per response: the cutoff is one timestamp on the account, and per-row read state is a
   * timestamp on the row.
   */
  is_unread: boolean;
  title: string;
  body: string | null;
  link_path: string | null;
  payload: Record<string, unknown> | null;
  created_at: string;
  expires_at: string;
}
