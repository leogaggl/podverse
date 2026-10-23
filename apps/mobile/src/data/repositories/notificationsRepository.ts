import type {
  DTOAccountNotification,
  DTOAccountNotificationPreference,
  NotificationCategoryValues,
} from '@podverse/helpers';

import { requestWithMobileAuthRefresh } from '../../auth/authRequestWithRefresh';
import type { MobileAuthRequestContext } from './types';

const DEFAULT_NOTIFICATIONS_PAGE_LIMIT = 20;

export type NotificationsPage = {
  items: DTOAccountNotification[];
  unreadCount: number;
  page: number;
  totalPages: number;
};

export type NotificationsMarkReadResult = { markedIds: number[]; unreadCount: number };

export const notificationsRepository = {
  getUnreadCount: async (context: MobileAuthRequestContext): Promise<number> => {
    const response = await requestWithMobileAuthRefresh(context, async (apiRequestService) =>
      apiRequestService.reqNotificationsUnreadCount()
    );
    return response.unread_count;
  },

  list: async (
    context: MobileAuthRequestContext,
    params: { page?: number; limit?: number } = {}
  ): Promise<NotificationsPage> => {
    const response = await requestWithMobileAuthRefresh(context, async (apiRequestService) =>
      apiRequestService.reqNotificationsList({
        limit: params.limit ?? DEFAULT_NOTIFICATIONS_PAGE_LIMIT,
        page: params.page ?? 1,
      })
    );
    return {
      items: response.items,
      unreadCount: response.sections.unread_count,
      page: response.pagination.page,
      totalPages: response.pagination.total_pages,
    };
  },

  markRead: async (context: MobileAuthRequestContext): Promise<void> => {
    await requestWithMobileAuthRefresh(context, async (apiRequestService) =>
      apiRequestService.reqNotificationsMarkRead()
    );
  },

  markReadOne: async (
    context: MobileAuthRequestContext,
    notificationId: number
  ): Promise<NotificationsMarkReadResult> => {
    const response = await requestWithMobileAuthRefresh(context, async (apiRequestService) =>
      apiRequestService.reqNotificationsMarkReadOne(notificationId)
    );
    return {
      markedIds: response.marked_ids,
      unreadCount: response.unread_count,
    };
  },

  markReadByItem: async (
    context: MobileAuthRequestContext,
    target: { itemIdText: string; type: string }
  ): Promise<NotificationsMarkReadResult> => {
    const response = await requestWithMobileAuthRefresh(context, async (apiRequestService) =>
      apiRequestService.reqNotificationsMarkReadByItem({
        item_id_text: target.itemIdText,
        type: target.type,
      })
    );
    return {
      markedIds: response.marked_ids,
      unreadCount: response.unread_count,
    };
  },

  listPreferences: async (
    context: MobileAuthRequestContext
  ): Promise<DTOAccountNotificationPreference[]> => {
    return requestWithMobileAuthRefresh(context, async (apiRequestService) =>
      apiRequestService.reqNotificationPreferencesGet()
    );
  },

  updatePreferences: async (
    context: MobileAuthRequestContext,
    params: {
      preferences: Array<{
        category: NotificationCategoryValues;
        in_app_enabled: boolean;
        push_enabled: boolean;
      }>;
    }
  ): Promise<DTOAccountNotificationPreference[]> => {
    return requestWithMobileAuthRefresh(context, async (apiRequestService) =>
      apiRequestService.reqNotificationPreferencesUpdate(params)
    );
  },
};
