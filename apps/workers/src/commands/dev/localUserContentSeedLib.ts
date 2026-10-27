import type { NotificationCategoryValues, NotificationLinkMessageType } from '@podverse/helpers';
import { buildNotificationLinkPath, NotificationCategoryEnum } from '@podverse/helpers';

/**
 * Emails created by infra/development/seeds/local-dev-accounts.sql.
 * dummyNN@podverse.local stays off e2e-* / *-test@example.com / embed `demo`.
 */
export const LOCAL_USER_CONTENT_SEED_EMAILS = [
  'local-trial@example.com',
  'local-premium@example.com',
  'dummy01@podverse.local',
  'dummy02@podverse.local',
  'dummy03@podverse.local',
  'dummy04@podverse.local',
  'dummy05@podverse.local',
  'dummy06@podverse.local',
] as const;

export const DUMMY_CLIP_TITLE_PREFIX = 'Dummy clip ';
export const DUMMY_AV_PLAYLIST_TITLE = 'Dummy AV mix';
export const DUMMY_MUSIC_PLAYLIST_TITLE = 'Dummy music mix';

export const FOLLOWS_AV_COUNT = 12;
export const FOLLOWS_MUSIC_COUNT = 3;
export const CLIPS_PER_ACCOUNT = 6;
export const PLAYLIST_ITEM_COUNT = 5;
export const ITEMS_PER_CHANNEL = 3;

export function pickRotated<T>(items: readonly T[], seed: number, count: number): T[] {
  if (items.length === 0 || count <= 0) {
    return [];
  }
  const take = Math.min(count, items.length);
  const start = ((seed % items.length) + items.length) % items.length;
  const picked: T[] = [];
  for (let index = 0; index < take; index += 1) {
    const item = items[(start + index) % items.length];
    if (item !== undefined) {
      picked.push(item);
    }
  }
  return picked;
}

export function dummyClipTitle(itemIdText: string): string {
  return `${DUMMY_CLIP_TITLE_PREFIX}${itemIdText}`;
}

/**
 * Podcast Index ids parsed when the local database has no row for that feed.
 * The spoken-word set includes shows that publish live items. The music ids are album feeds.
 */
export const LOCAL_SEED_PODCASTING20_FEED_IDS = [920666, 6524027, 575694, 6813728] as const;
export const LOCAL_SEED_MUSIC_FEED_IDS = [6642704, 7814960] as const;

/** Middle Season, a publisher-music feed. Its albums are remote items, not episodes. */
export const LOCAL_SEED_PUBLISHER_MUSIC_FEED_ID = 7458805;
/** Album Middle Season lists. Parsed so the New album row can open the album page. */
export const LOCAL_SEED_PUBLISHER_ALBUM_FEED_ID = 8039141;
/** Another Middle Season album. Left unparsed so the preview row opens Podcast Index. */
export const LOCAL_SEED_PUBLISHER_PREVIEW_FEED_ID = 6651863;

export const LOCAL_SEED_NOTIFICATION_KEYS = [
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
  'product-update',
  'maintenance',
  'terms-of-service',
  'general',
] as const;

export type LocalSeedNotificationKey = (typeof LOCAL_SEED_NOTIFICATION_KEYS)[number];

export type LocalSeedContentTarget = {
  channelIdText: string;
  channelTitle: string;
  imageUrl: string | null;
  itemIdText: string;
  itemTitle: string;
  mediumId: number;
};

/**
 * A channel announced by a publisher feed. The same shape covers a new podcast, video
 * channel, or album, and a Podcast Index preview of a feed that is not parsed yet.
 * `announcedIdText` is the channel id, or the Podcast Index id for a preview.
 */
export type LocalSeedPublisherChannelNotice = {
  announcedIdText: string;
  announcedTitle: string;
  imageUrl: string | null;
  mediumId: number;
  publisherIdText: string;
  publisherTitle: string;
};

export type LocalSeedNotificationCatalog = {
  episode: LocalSeedContentTarget | null;
  livestreamScheduled: LocalSeedContentTarget | null;
  livestreamStarted: LocalSeedContentTarget | null;
  /** Unknown-medium fallback. A different item than `episode` when one exists. */
  newContent: LocalSeedContentTarget | null;
  podcastIndexPreview: LocalSeedPublisherChannelNotice | null;
  publisherAlbum: LocalSeedPublisherChannelNotice | null;
  publisherPodcast: LocalSeedPublisherChannelNotice | null;
  publisherVideo: LocalSeedPublisherChannelNotice | null;
  track: LocalSeedContentTarget | null;
  video: LocalSeedContentTarget | null;
};

export type LocalSeedNotificationDraft = {
  body: string | null;
  category: NotificationCategoryValues;
  createdAt: Date;
  linkPath: string | null;
  localSeedKey: LocalSeedNotificationKey;
  markRead: boolean;
  payload: Record<string, unknown>;
  title: string;
};

const SYSTEM_SEED_ROWS: ReadonlyArray<{
  body: string;
  category: NotificationCategoryValues;
  key: LocalSeedNotificationKey;
  markRead: boolean;
  title: string;
}> = [
  {
    body: 'Local seed row for the product update category.',
    category: NotificationCategoryEnum.ProductUpdate,
    key: 'product-update',
    markRead: false,
    title: 'Dummy Product Update',
  },
  {
    body: 'Local seed row for the maintenance category.',
    category: NotificationCategoryEnum.Maintenance,
    key: 'maintenance',
    markRead: false,
    title: 'Dummy Maintenance Notice',
  },
  {
    body: 'Local seed row for the terms of service category.',
    category: NotificationCategoryEnum.TermsOfService,
    key: 'terms-of-service',
    markRead: false,
    title: 'Dummy Terms of Service',
  },
  {
    body: 'Local seed row for the general category.',
    category: NotificationCategoryEnum.General,
    key: 'general',
    markRead: true,
    title: 'Dummy General Notice',
  },
];

function contentPayload(
  key: LocalSeedNotificationKey,
  messageType: NotificationLinkMessageType,
  target: {
    channelIdText: string;
    channelTitle: string;
    imageUrl: string | null;
    itemIdText: string;
    itemTitle: string;
    mediumId: number;
  }
): Record<string, unknown> {
  const payload: Record<string, unknown> = {
    channelIdText: target.channelIdText,
    channelTitle: target.channelTitle,
    itemIdText: target.itemIdText,
    itemTitle: target.itemTitle,
    localSeedKey: key,
    mediumId: target.mediumId,
    type: messageType,
  };
  if (target.imageUrl !== null && target.imageUrl !== '') {
    payload.imageUrl = target.imageUrl;
  }
  return payload;
}

function contentDraft(
  key: LocalSeedNotificationKey,
  messageType: NotificationLinkMessageType,
  category: NotificationCategoryValues,
  target: LocalSeedContentTarget,
  createdAt: Date
): LocalSeedNotificationDraft {
  return {
    body: target.channelTitle,
    category,
    createdAt,
    linkPath: buildNotificationLinkPath({
      channelIdText: target.channelIdText,
      itemIdText: target.itemIdText,
      mediumId: target.mediumId,
      messageType,
    }),
    localSeedKey: key,
    markRead: false,
    payload: contentPayload(key, messageType, target),
    title: target.itemTitle,
  };
}

function publisherChannelDraft(
  key: LocalSeedNotificationKey,
  messageType: NotificationLinkMessageType,
  notice: LocalSeedPublisherChannelNotice,
  createdAt: Date
): LocalSeedNotificationDraft {
  return contentDraft(
    key,
    messageType,
    NotificationCategoryEnum.NewContent,
    {
      channelIdText: notice.publisherIdText,
      channelTitle: notice.publisherTitle,
      imageUrl: notice.imageUrl,
      itemIdText: notice.announcedIdText,
      itemTitle: notice.announcedTitle,
      mediumId: notice.mediumId,
    },
    createdAt
  );
}

/** Inbox rows for one account. Omits a content type when that parsed target is missing. */
export function buildLocalSeedNotificationDrafts(
  catalog: LocalSeedNotificationCatalog,
  now: Date = new Date()
): LocalSeedNotificationDraft[] {
  const drafts: LocalSeedNotificationDraft[] = [];
  const push = (draft: LocalSeedNotificationDraft | null) => {
    if (draft !== null) {
      drafts.push(draft);
    }
  };
  const at = (index: number) => new Date(now.getTime() - index * 60_000);

  push(
    catalog.newContent === null
      ? null
      : contentDraft('new', 'new', NotificationCategoryEnum.NewContent, catalog.newContent, at(0))
  );
  push(
    catalog.episode === null
      ? null
      : contentDraft(
          'new-episode',
          'new-episode',
          NotificationCategoryEnum.NewContent,
          catalog.episode,
          at(1)
        )
  );
  push(
    catalog.publisherPodcast === null
      ? null
      : publisherChannelDraft('new-podcast', 'new-podcast', catalog.publisherPodcast, at(2))
  );
  push(
    catalog.video === null
      ? null
      : contentDraft(
          'new-video',
          'new-video',
          NotificationCategoryEnum.NewContent,
          catalog.video,
          at(3)
        )
  );
  push(
    catalog.publisherVideo === null
      ? null
      : publisherChannelDraft(
          'new-video-channel',
          'new-video-channel',
          catalog.publisherVideo,
          at(4)
        )
  );
  push(
    catalog.track === null
      ? null
      : contentDraft(
          'new-track',
          'new-track',
          NotificationCategoryEnum.NewContent,
          catalog.track,
          at(5)
        )
  );
  push(
    catalog.publisherAlbum === null
      ? null
      : publisherChannelDraft('new-album', 'new-album', catalog.publisherAlbum, at(6))
  );
  push(
    catalog.podcastIndexPreview === null
      ? null
      : publisherChannelDraft(
          'podcast-index-feed',
          'podcast-index-feed',
          catalog.podcastIndexPreview,
          at(7)
        )
  );
  push(
    catalog.livestreamStarted === null
      ? null
      : contentDraft(
          'livestream-started',
          'livestream-started',
          NotificationCategoryEnum.Livestream,
          catalog.livestreamStarted,
          at(8)
        )
  );
  push(
    catalog.livestreamScheduled === null
      ? null
      : contentDraft(
          'livestream-scheduled',
          'livestream-scheduled',
          NotificationCategoryEnum.Livestream,
          catalog.livestreamScheduled,
          at(9)
        )
  );

  SYSTEM_SEED_ROWS.forEach((row, index) => {
    drafts.push({
      body: row.body,
      category: row.category,
      createdAt: at(10 + index),
      linkPath: null,
      localSeedKey: row.key,
      markRead: row.markRead,
      payload: { localSeedKey: row.key },
      title: row.title,
    });
  });

  return drafts;
}

export function readLocalSeedKey(
  payload: Record<string, unknown> | null | undefined
): string | null {
  if (payload === null || payload === undefined) {
    return null;
  }
  const value = payload.localSeedKey;
  if (typeof value !== 'string' || value === '') {
    return null;
  }
  return value;
}

/** 15–30s window that starts in the first minute and ends by 90s. */
export function dummyClipWindow(accountId: number, itemId: number): { end: number; start: number } {
  const mixed = (accountId * 1009 + itemId * 17) >>> 0;
  const duration = 15 + (mixed % 16);
  const start = 5 + (mixed % 56);
  const end = Math.min(90, start + duration);
  return {
    end,
    start: Math.min(start, end - 15),
  };
}
