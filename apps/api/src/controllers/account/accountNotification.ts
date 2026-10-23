import { handleGenericErrorResponse } from '@api/controllers/helpers/error.js';
import {
  accountNotificationPreferenceToJson,
  accountNotificationToJson,
} from '@api/lib/accountNotificationApiSerialization.js';
import { ensureAuthenticated, getAuthenticatedUser } from '@api/lib/auth/index.js';
import { getParamRequired } from '@api/lib/params.js';
import {
  validateBodyObject,
  validateParamsObject,
  validateQueryObject,
} from '@api/lib/validation/index.js';
import type { Request, Response } from 'express';
import Joi from 'joi';

import type { NotificationCategoryValues } from '@podverse/helpers';
import { ACCOUNT_ENTITLEMENT_CAPABILITY, NOTIFICATION_CATEGORY_VALUES } from '@podverse/helpers';
import {
  AccountNotificationPreferenceService,
  AccountNotificationService,
  AccountService,
} from '@podverse/orm';

const NOTIFICATIONS_DEFAULT_LIMIT = 20;
const NOTIFICATIONS_MAX_LIMIT = 50;

type UpdateNotificationPreferenceInput = {
  category: NotificationCategoryValues;
  in_app_enabled: boolean;
  push_enabled: boolean;
};

type MarkReadByItemInput = {
  item_id_text: string;
  type: string;
};

const notificationPreferenceSchema = Joi.object({
  category: Joi.string()
    .valid(...NOTIFICATION_CATEGORY_VALUES)
    .required(),
  in_app_enabled: Joi.boolean().required(),
  push_enabled: Joi.boolean().required(),
});

/**
 * Notifications are **read/unread**; channel content is **seen/unseen**. Both indicators are
 * timestamps a badge counts against, so they use different verbs on purpose — a field or a log line
 * naming one is never ambiguous about which badge it belongs to.
 */
export class AccountNotificationController {
  private static accountService = new AccountService();
  private static accountNotificationService = new AccountNotificationService();
  private static accountNotificationPreferenceService = new AccountNotificationPreferenceService();

  /** The account's unread count, or null when the account row is missing. */
  private static async getUnreadCountForAccount(account_id: number): Promise<number | null> {
    const account = await AccountNotificationController.accountService.get(account_id);
    if (!account) {
      return null;
    }

    return AccountNotificationController.accountNotificationService.countUnread(
      account_id,
      account.notifications_last_read_at ?? null
    );
  }

  static async getNotifications(req: Request, res: Response): Promise<void> {
    const querySchema = Joi.object({
      page: Joi.number().integer().min(1).default(1),
      limit: Joi.number()
        .integer()
        .min(1)
        .max(NOTIFICATIONS_MAX_LIMIT)
        .default(NOTIFICATIONS_DEFAULT_LIMIT),
    });

    validateQueryObject(querySchema, req, res, async () => {
      ensureAuthenticated(
        req,
        res,
        async () => {
          try {
            const jwtUser = getAuthenticatedUser(req);
            const account_id = jwtUser.id;
            const page = Number(req.query.page ?? 1);
            const limit = Number(req.query.limit ?? NOTIFICATIONS_DEFAULT_LIMIT);
            const offset = (page - 1) * limit;

            const account = await AccountNotificationController.accountService.get(account_id);
            if (!account) {
              res.status(404).json({ message: 'Account not found' });
              return;
            }

            const lastReadAt = account.notifications_last_read_at ?? null;
            const notifications =
              await AccountNotificationController.accountNotificationService.listPaginatedForAccount(
                account_id,
                {
                  limit,
                  offset,
                }
              );
            const totalCount =
              await AccountNotificationController.accountNotificationService.countForAccount(
                account_id
              );
            const unreadCount =
              await AccountNotificationController.accountNotificationService.countUnread(
                account_id,
                lastReadAt
              );
            const totalPages = totalCount === 0 ? 0 : Math.ceil(totalCount / limit);

            res.json({
              data: {
                items: notifications.map((notification) =>
                  accountNotificationToJson(notification, lastReadAt)
                ),
                last_read_at: lastReadAt?.toISOString() ?? null,
                pagination: {
                  page,
                  total_count: totalCount,
                  total_pages: totalPages,
                },
                sections: {
                  unread_count: unreadCount,
                },
              },
            });
          } catch (error) {
            handleGenericErrorResponse(res, error);
          }
        },
        {
          skipMembershipStatus: true,
          apiKeyAccess: { resource: 'notifications', action: 'read' },
        }
      );
    });
  }

  static async getUnreadCount(req: Request, res: Response): Promise<void> {
    ensureAuthenticated(
      req,
      res,
      async () => {
        try {
          const jwtUser = getAuthenticatedUser(req);
          const account_id = jwtUser.id;
          const unreadCount =
            await AccountNotificationController.getUnreadCountForAccount(account_id);
          if (unreadCount === null) {
            res.status(404).json({ message: 'Account not found' });
            return;
          }

          res.json({
            data: {
              unread_count: unreadCount,
            },
          });
        } catch (error) {
          handleGenericErrorResponse(res, error);
        }
      },
      {
        skipMembershipStatus: true,
        apiKeyAccess: { resource: 'notifications', action: 'read' },
      }
    );
  }

  /**
   * Mark All as Read: moves the account's cutoff to now in one write. Rows read one at a time keep
   * their own `read_at`; the cutoff covers every row created at or before it either way, so this
   * never touches notification rows and its cost does not grow with the inbox.
   */
  static async markRead(req: Request, res: Response): Promise<void> {
    ensureAuthenticated(
      req,
      res,
      async () => {
        try {
          const jwtUser = getAuthenticatedUser(req);
          const account_id = jwtUser.id;
          const lastReadAt =
            await AccountNotificationController.accountService.updateNotificationsLastReadAt(
              account_id,
              new Date()
            );

          res.json({
            data: {
              last_read_at: lastReadAt.toISOString(),
            },
          });
        } catch (error) {
          handleGenericErrorResponse(res, error);
        }
      },
      {
        skipMembershipStatus: true,
        apiKeyAccess: { resource: 'notifications', action: 'update' },
      }
    );
  }

  /**
   * Marks one notification read on its own. An already-read row succeeds with no ids and sends no
   * event.
   */
  static async markReadOne(req: Request, res: Response): Promise<void> {
    const paramsSchema = Joi.object({
      notification_id: Joi.number().integer().positive().required(),
    }).unknown(false);

    validateParamsObject(paramsSchema, req, res, async () => {
      ensureAuthenticated(
        req,
        res,
        async () => {
          try {
            const jwtUser = getAuthenticatedUser(req);
            const account_id = jwtUser.id;
            const notification_id = Number(getParamRequired(req, 'notification_id'));
            const result =
              await AccountNotificationController.accountNotificationService.markReadById(
                account_id,
                notification_id
              );
            if (result.found === false) {
              res.status(404).json({ message: 'Notification not found' });
              return;
            }

            const unreadCount =
              await AccountNotificationController.getUnreadCountForAccount(account_id);
            if (unreadCount === null) {
              res.status(404).json({ message: 'Account not found' });
              return;
            }

            res.json({
              data: {
                marked_ids: result.marked_ids,
                unread_count: unreadCount,
              },
            });
          } catch (error) {
            handleGenericErrorResponse(res, error);
          }
        },
        {
          skipMembershipStatus: true,
          apiKeyAccess: { resource: 'notifications', action: 'update' },
        }
      );
    });
  }

  /**
   * Marks read the notification an OS push was about. Push data carries the item id and message
   * type, not the notification id.
   */
  static async markReadByItem(req: Request, res: Response): Promise<void> {
    const bodySchema = Joi.object({
      item_id_text: Joi.string().trim().min(1).max(64).required(),
      type: Joi.string().trim().min(1).max(64).required(),
    }).unknown(false);

    validateBodyObject(bodySchema, req, res, async () => {
      const { item_id_text, type }: MarkReadByItemInput = req.body;

      ensureAuthenticated(
        req,
        res,
        async () => {
          try {
            const jwtUser = getAuthenticatedUser(req);
            const account_id = jwtUser.id;
            const markedIds =
              await AccountNotificationController.accountNotificationService.markReadByItem(
                account_id,
                item_id_text,
                type
              );
            const unreadCount =
              await AccountNotificationController.getUnreadCountForAccount(account_id);
            if (unreadCount === null) {
              res.status(404).json({ message: 'Account not found' });
              return;
            }

            res.json({
              data: {
                marked_ids: markedIds,
                unread_count: unreadCount,
              },
            });
          } catch (error) {
            handleGenericErrorResponse(res, error);
          }
        },
        {
          skipMembershipStatus: true,
          apiKeyAccess: { resource: 'notifications', action: 'update' },
        }
      );
    });
  }

  static async getPreferences(req: Request, res: Response): Promise<void> {
    ensureAuthenticated(
      req,
      res,
      async () => {
        try {
          const jwtUser = getAuthenticatedUser(req);
          const account_id = jwtUser.id;
          const preferences =
            await AccountNotificationController.accountNotificationPreferenceService.seedDefaultsForAccount(
              account_id
            );

          res.json({
            data: preferences.map(accountNotificationPreferenceToJson),
          });
        } catch (error) {
          handleGenericErrorResponse(res, error);
        }
      },
      {
        skipMembershipStatus: true,
        apiKeyAccess: { resource: 'notifications', action: 'read' },
      }
    );
  }

  static async updatePreferences(req: Request, res: Response): Promise<void> {
    const bodySchema = Joi.object({
      preferences: Joi.array().items(notificationPreferenceSchema).min(1).required(),
    });

    validateBodyObject(bodySchema, req, res, async () => {
      const { preferences } = req.body as { preferences: UpdateNotificationPreferenceInput[] };
      const requiresNotificationsCapability = preferences.some(
        (preference) => preference.push_enabled === true
      );

      ensureAuthenticated(
        req,
        res,
        async () => {
          try {
            const jwtUser = getAuthenticatedUser(req);
            const account_id = jwtUser.id;

            for (const preference of preferences) {
              const shouldForceInAppEnabled =
                preference.category === 'maintenance' ||
                preference.category === 'terms-of-service' ||
                preference.category === 'general';

              const inAppEnabled = shouldForceInAppEnabled ? true : preference.in_app_enabled;
              await AccountNotificationController.accountNotificationPreferenceService.upsert({
                account_id,
                category: preference.category,
                in_app_enabled: inAppEnabled,
                push_enabled: preference.push_enabled,
              });
            }

            const updatedPreferences =
              await AccountNotificationController.accountNotificationPreferenceService.getForAccount(
                account_id
              );
            res.json({
              data: updatedPreferences.map(accountNotificationPreferenceToJson),
            });
          } catch (error) {
            handleGenericErrorResponse(res, error);
          }
        },
        {
          skipMembershipStatus: !requiresNotificationsCapability,
          requiredCapability: requiresNotificationsCapability
            ? ACCOUNT_ENTITLEMENT_CAPABILITY.allowNotifications
            : undefined,
          apiKeyAccess: { resource: 'notifications', action: 'update' },
        }
      );
    });
  }
}
