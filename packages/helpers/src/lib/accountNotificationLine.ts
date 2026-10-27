import type { NotificationLinkMessageType } from './appRoutes.js';
import type { NotificationCategoryValues } from './notificationCategory.js';
import { NotificationCategoryEnum } from './notificationCategory.js';

const NOTIFICATION_LINK_MESSAGE_TYPES = [
  'new',
  'new-episode',
  'new-podcast',
  'new-video',
  'new-video-channel',
  'new-track',
  'new-album',
  'podcast-index-feed',
  'livestream-started',
  'livestream-scheduled',
] as const satisfies readonly NotificationLinkMessageType[];

const LEGACY_LIVESTREAM_TITLE_PREFIXES = ['Live Scheduled: ', 'Live: '] as const;

const NAME_SEPARATOR = ' – ';
const PUBLISHER_SEPARATOR = ' — ';

/** A new channel announced by a publisher feed the account follows. */
const PUBLISHER_CHANNEL_MESSAGE_TYPES = [
  'new-podcast',
  'new-video-channel',
  'new-album',
  'podcast-index-feed',
] as const satisfies readonly NotificationLinkMessageType[];

export type AccountNotificationLineLabels = {
  [K in NotificationLinkMessageType]: string;
} & {
  livestream: string;
  systemUpdate: string;
};

export type AccountNotificationLineSource = {
  body: string | null;
  category: NotificationCategoryValues;
  payload: Record<string, unknown> | null;
  title: string;
};

function readString(record: Record<string, unknown> | null, key: string): string | null {
  if (record === null) {
    return null;
  }
  const value = record[key];
  if (typeof value !== 'string') {
    return null;
  }
  const trimmed = value.trim();
  return trimmed === '' ? null : trimmed;
}

function nonEmpty(value: string | null): string | null {
  if (value === null) {
    return null;
  }
  const trimmed = value.trim();
  return trimmed === '' ? null : trimmed;
}

function readMessageType(
  payload: Record<string, unknown> | null
): NotificationLinkMessageType | null {
  const value = readString(payload, 'type');
  if (value === null) {
    return null;
  }
  for (const messageType of NOTIFICATION_LINK_MESSAGE_TYPES) {
    if (value === messageType) {
      return messageType;
    }
  }
  return null;
}

function stripLegacyLivestreamPrefix(title: string): string {
  for (const prefix of LEGACY_LIVESTREAM_TITLE_PREFIXES) {
    if (title.startsWith(prefix)) {
      return title.slice(prefix.length).trim();
    }
  }
  return title;
}

function isLivestreamLine(
  category: NotificationCategoryValues,
  messageType: NotificationLinkMessageType | null
): boolean {
  return (
    category === NotificationCategoryEnum.Livestream ||
    messageType === 'livestream-started' ||
    messageType === 'livestream-scheduled'
  );
}

function isPublisherChannelNotice(messageType: NotificationLinkMessageType): boolean {
  for (const publisherType of PUBLISHER_CHANNEL_MESSAGE_TYPES) {
    if (messageType === publisherType) {
      return true;
    }
  }
  return false;
}

/** Show or album title, then the publisher feed title. Identical names stay one title. */
function joinPublisherNotice(
  showTitle: string | null,
  publisherTitle: string | null
): string | null {
  if (showTitle !== null && publisherTitle !== null && publisherTitle !== showTitle) {
    return `${showTitle}${PUBLISHER_SEPARATOR}${publisherTitle}`;
  }
  if (showTitle !== null) {
    return showTitle;
  }
  return publisherTitle;
}

function joinNames(channel: string | null, item: string | null): string | null {
  const names: string[] = [];
  if (channel !== null) {
    names.push(channel);
  }
  if (item !== null && item !== channel) {
    names.push(item);
  }
  if (names.length === 0) {
    return null;
  }
  return names.join(NAME_SEPARATOR);
}

function withLabel(label: string, detail: string | null): string {
  if (detail === null) {
    return label;
  }
  return `${label}: ${detail}`;
}

function systemDetail(title: string, body: string | null): string | null {
  const titleText = title.trim();
  const bodyText = nonEmpty(body) ?? '';
  if (titleText !== '' && bodyText !== '' && bodyText !== titleText) {
    return `${titleText}${NAME_SEPARATOR}${bodyText}`;
  }
  if (titleText !== '') {
    return titleText;
  }
  if (bodyText !== '') {
    return bodyText;
  }
  return null;
}

/**
 * One inbox line: a medium-specific label, then the titles.
 * A publisher channel notice names the new show or album, then the publisher feed.
 * Other rows name the channel, then the item.
 * Titles come from the payload when present, otherwise from body and title.
 */
export function formatAccountNotificationLine(
  notification: AccountNotificationLineSource,
  labels: AccountNotificationLineLabels
): string {
  const payload = notification.payload;
  const messageType = readMessageType(payload);
  const channel = readString(payload, 'channelTitle') ?? nonEmpty(notification.body);
  const storedItem = readString(payload, 'itemTitle') ?? nonEmpty(notification.title);
  const item =
    storedItem === null
      ? null
      : isLivestreamLine(notification.category, messageType)
        ? nonEmpty(stripLegacyLivestreamPrefix(storedItem))
        : storedItem;

  if (messageType !== null && isPublisherChannelNotice(messageType)) {
    return withLabel(labels[messageType], joinPublisherNotice(item, channel));
  }

  if (messageType !== null) {
    return withLabel(labels[messageType], joinNames(channel, item));
  }

  if (notification.category === NotificationCategoryEnum.Livestream) {
    return withLabel(labels.livestream, joinNames(channel, item));
  }

  if (notification.category === NotificationCategoryEnum.NewContent) {
    return withLabel(labels.new, joinNames(channel, item));
  }

  return withLabel(labels.systemUpdate, systemDetail(notification.title, notification.body));
}

/** Item artwork when the payload has it, otherwise channel artwork. Missing means the placeholder. */
export function accountNotificationImageUrl(
  payload: Record<string, unknown> | null
): string | null {
  return readString(payload, 'imageUrl');
}
