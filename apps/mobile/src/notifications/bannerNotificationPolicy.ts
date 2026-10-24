import type { NotificationCategoryValues } from '@podverse/helpers';
import { NotificationCategoryEnum } from '@podverse/helpers';
import { htmlToPlainTextPreview } from '@podverse/helpers/html';

/**
 * Which account notifications may show a mobile banner, and the one line of copy the banner uses.
 *
 * Every new-content notification follows the New Item switch. A livestream shows a banner only
 * when its payload message type is exactly `livestream-started` or `livestream-scheduled`.
 */

export const BANNER_NOTIFICATION_KINDS = [
  'new-item',
  'livestream-started',
  'livestream-scheduled',
  'product-update',
  'maintenance',
  'terms-of-service',
  'general',
] as const;

export type BannerNotificationKind = (typeof BANNER_NOTIFICATION_KINDS)[number];

export const DEFAULT_BANNER_NOTIFICATION_ENABLED: Record<BannerNotificationKind, boolean> = {
  'new-item': true,
  'livestream-started': true,
  'livestream-scheduled': false,
  'product-update': false,
  maintenance: false,
  'terms-of-service': false,
  general: false,
};

/** Catalog keys so Settings and this list stay on the same strings. */
export const BANNER_NOTIFICATION_KIND_LABEL_KEY: Record<BannerNotificationKind, string> = {
  'new-item': 'settings.notifications.new_item',
  'livestream-started': 'settings.notifications.livestream_started',
  'livestream-scheduled': 'settings.notifications.livestream_scheduled',
  'product-update': 'settings.notifications.category_product_update',
  maintenance: 'settings.notifications.category_maintenance',
  'terms-of-service': 'settings.notifications.category_terms_of_service',
  general: 'settings.notifications.category_general',
};

const BANNER_BODY_PREVIEW_MAX_CHARS = 140;

export type BannerNotificationSource = {
  category: NotificationCategoryValues;
  payload: Record<string, unknown> | null;
};

const collapseWhitespace = (value: string): string => {
  return value.replace(/\s+/g, ' ').trim();
};

/**
 * Payload message type: `type`, then `messageType`. A non-empty trimmed string counts.
 * Anything else is no message type.
 */
const readPayloadMessageType = (payload: Record<string, unknown> | null): string | null => {
  if (payload === null) {
    return null;
  }

  const candidates = [payload.type, payload.messageType];
  for (const candidate of candidates) {
    if (typeof candidate !== 'string') {
      continue;
    }

    const trimmed = candidate.trim();
    if (trimmed !== '') {
      return trimmed;
    }
  }

  return null;
};

export const bannerKindForNotification = (
  notification: BannerNotificationSource
): BannerNotificationKind | null => {
  switch (notification.category) {
    case NotificationCategoryEnum.NewContent:
      return 'new-item';
    case NotificationCategoryEnum.Livestream: {
      const messageType = readPayloadMessageType(notification.payload);
      if (messageType === 'livestream-started' || messageType === 'livestream-scheduled') {
        return messageType;
      }
      return null;
    }
    case NotificationCategoryEnum.ProductUpdate:
      return 'product-update';
    case NotificationCategoryEnum.Maintenance:
      return 'maintenance';
    case NotificationCategoryEnum.TermsOfService:
      return 'terms-of-service';
    case NotificationCategoryEnum.General:
      return 'general';
  }
};

export const shouldShowBannerNotification = (
  notification: BannerNotificationSource,
  enabled: Readonly<Record<BannerNotificationKind, boolean>>
): boolean => {
  const kind = bannerKindForNotification(notification);
  if (kind === null) {
    return false;
  }
  return enabled[kind];
};

export const resolveBannerNotificationEnabled = (
  stored: Partial<Record<BannerNotificationKind, boolean>> | null
): Record<BannerNotificationKind, boolean> => {
  const resolved: Record<BannerNotificationKind, boolean> = {
    ...DEFAULT_BANNER_NOTIFICATION_ENABLED,
  };

  if (stored === null) {
    return resolved;
  }

  for (const kind of BANNER_NOTIFICATION_KINDS) {
    const value = stored[kind];
    if (typeof value === 'boolean') {
      resolved[kind] = value;
    }
  }

  return resolved;
};

export const bannerNotificationCopy = (notification: {
  title: string;
  body: string | null;
}): { title: string; body: string | null } | null => {
  const title = collapseWhitespace(notification.title);
  const plainBody =
    notification.body === null
      ? ''
      : collapseWhitespace(
          htmlToPlainTextPreview(notification.body, BANNER_BODY_PREVIEW_MAX_CHARS)
        );

  if (title === '' && plainBody === '') {
    return null;
  }

  if (title === '') {
    return { title: plainBody, body: null };
  }

  return {
    title,
    body: plainBody === '' ? null : plainBody,
  };
};
