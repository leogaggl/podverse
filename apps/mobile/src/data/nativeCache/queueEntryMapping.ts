/**
 * Native cache queue rows: the account queue snapshot entry and the advance window's entries.
 * Pure mapping; imports no repository values, so both repositories and the reprojector can use it.
 */

import { primaryListArtworkUrl } from '@podverse/helpers';
import type {
  DTOItemAbout,
  DTOItemEnclosure,
  DTOItemQueueItem,
  DTOQueueResource,
} from '@podverse/helpers/dto';
import { buildLabeledItemEnclosures } from '@podverse/helpers/item/itemEnclosure';
import type { AutoQueueResourcesMapRow } from '@podverse/playback-core/autoQueue';

import {
  addByRssPlaybackMediaId,
  isAddByRssLivestreamResourceData,
} from '../../lib/addByRss/resourceData';
import {
  clipBoundsForClip,
  clipBoundsForSoundbite,
} from '../../lib/playback/mediaEngineSourceMeta';
import {
  DEFAULT_ENCLOSURE_SELECTED_PARAMS,
  resolveItemEnclosureUrl,
} from '../../lib/playback/resolveEnclosureUrl';
import { itemArtistNames, verifiedArtistNames } from '../../lib/playback/verifiedArtists';
import type { ItemPlaybackProgress } from '../repositories/queueProjectionHelpers';
import type { AdvanceWindowAddByRssMedia } from './advanceWindow';
import type { NativeCacheQueueEntry, NativeCacheQueueEntryKind } from './projection';

export type NativeAdvanceIdentity = { kind: NativeCacheQueueEntryKind; idText: string };

const nonBlankString = (value: unknown): string | null =>
  typeof value === 'string' && value.trim().length > 0 ? value : null;

/** Seconds as a finite positive number, else null. */
export const positiveSecondsOrNull = (value: number | string | null | undefined): number | null => {
  if (value === null || value === undefined || value === '') {
    return null;
  }
  const seconds = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(seconds) && seconds > 0 ? seconds : null;
};

/** Where a cached row resumes. A played item starts over, so it carries no resume point. */
export const nativeResumeSeconds = (progress: ItemPlaybackProgress | null): number | null =>
  progress !== null && !progress.played && progress.positionSeconds > 0
    ? progress.positionSeconds
    : null;

/** The enclosure URL the player picks by default. */
export const resolveNativeCacheMediaUrl = (
  enclosures: DTOItemEnclosure[] | null | undefined
): string | null =>
  resolveItemEnclosureUrl({
    labeledItemEnclosures: buildLabeledItemEnclosures(enclosures ?? []),
    selectedParams: DEFAULT_ENCLOSURE_SELECTED_PARAMS,
  });

/** The media file's duration when known, else the feed's, in rounded milliseconds. */
export const nativeCacheDurationMs = (
  item: { item_about?: DTOItemAbout | null },
  mediaFileDuration?: number | string | null
): number | null => {
  const seconds =
    positiveSecondsOrNull(mediaFileDuration) ?? positiveSecondsOrNull(item.item_about?.duration);
  return seconds === null ? null : Math.round(seconds * 1000);
};

/** The account queue snapshot entry for a resource. Item-based: null without `resource.item`. */
export const nativeQueueEntryFromQueueResource = (
  resource: DTOQueueResource,
  options?: { downloadFileName?: string | null }
): NativeCacheQueueEntry | null => {
  const item = resource.item;
  if (item === null || item === undefined) {
    return null;
  }
  return {
    idText: item.id_text,
    title: item.title ?? item.id_text,
    artworkUrl: primaryListArtworkUrl(item.item_images, item.channel?.channel_images),
    mediaUrl: resolveNativeCacheMediaUrl(item.item_enclosures),
    podcastTitle: item.channel?.title ?? null,
    artist: itemArtistNames(item),
    startPositionSeconds: positiveSecondsOrNull(resource.playback_position),
    durationMs: nativeCacheDurationMs(item, resource.media_file_duration),
    kind: 'item',
    ...(options?.downloadFileName !== undefined
      ? { downloadFileName: options.downloadFileName }
      : {}),
  };
};

/** One row's identity in the advance window, the dedupe key and the saved-source key. */
export const nativeAdvanceIdentityKey = (identity: { kind: string; idText: string }): string =>
  `${identity.kind}:${identity.idText}`;

/** The `kind` and `idText` the engine meta records once this row plays. */
export const advanceIdentityFromAutoQueueRow = (
  row: AutoQueueResourcesMapRow
): NativeAdvanceIdentity => {
  if (row.clip) {
    return { kind: 'clip', idText: row.clip.id_text };
  }
  if (row.item_soundbite && row.item_soundbite.item) {
    return { kind: 'item_soundbite', idText: row.item_soundbite.id_text };
  }
  return { kind: 'item', idText: row.item.id_text };
};

/** A manual queue row in the auto-queue row shape. Callers handle Add by RSS rows first. */
export const autoQueueRowFromQueueResource = (
  resource: DTOQueueResource
): AutoQueueResourcesMapRow => ({
  item: resource.item,
  clip: resource.clip ?? null,
  item_soundbite: resource.item_soundbite ?? null,
  channel:
    resource.item?.channel ??
    resource.clip?.item?.channel ??
    resource.item_soundbite?.item?.channel ??
    null,
});

/** The item whose media a row plays, in the order the player picks it. */
const mediaItemForRow = (row: AutoQueueResourcesMapRow): DTOItemQueueItem | null => {
  if (row.clip) {
    return row.clip.item ?? null;
  }
  if (row.item_soundbite && row.item_soundbite.item) {
    return row.item_soundbite.item;
  }
  return row.item;
};

const isLiveMediaItem = (item: DTOItemQueueItem): boolean =>
  'live_item' in item && item.live_item !== null && item.live_item !== undefined;

/**
 * The advance-window entry for an auto-queue or manual queue row, played the way the app plays
 * it. Null ends the window: a clip without its item, a missing item, a livestream, or a row with
 * neither a media URL nor a download.
 */
export const nativeQueueEntryFromAutoQueueRow = (
  row: AutoQueueResourcesMapRow,
  options: {
    downloadFileNameFor: (itemIdText: string) => string | null;
    startPositionSeconds: number | null;
    mediaFileDuration?: number | string | null;
  }
): NativeCacheQueueEntry | null => {
  if (row.item === null || row.item === undefined) {
    return null;
  }
  const mediaItem = mediaItemForRow(row);
  if (mediaItem === null || mediaItem === undefined || isLiveMediaItem(mediaItem)) {
    return null;
  }
  const mediaUrl = resolveNativeCacheMediaUrl(mediaItem.item_enclosures);
  const downloadFileName = options.downloadFileNameFor(mediaItem.id_text);
  if (mediaUrl === null && downloadFileName === null) {
    return null;
  }

  const identity = advanceIdentityFromAutoQueueRow(row);
  const channel = row.channel ?? mediaItem.channel ?? null;
  const base = {
    idText: identity.idText,
    kind: identity.kind,
    artworkUrl: primaryListArtworkUrl(mediaItem.item_images, channel?.channel_images),
    podcastTitle: channel?.title ?? null,
    artist: verifiedArtistNames({ channel, item: mediaItem }),
    durationMs: nativeCacheDurationMs(mediaItem, options.mediaFileDuration),
    mediaUrl,
    downloadFileName,
  };
  const itemTitle = nonBlankString(mediaItem.title);

  // A clip or soundbite plays its own range, so saved progress does not move its start.
  if (row.clip) {
    const bounds = clipBoundsForClip(row.clip);
    return {
      ...base,
      title: nonBlankString(row.clip.title) ?? itemTitle ?? row.clip.id_text,
      startPositionSeconds: bounds.start,
      clipStartSeconds: bounds.start,
      clipEndSeconds: bounds.end,
    };
  }
  if (identity.kind === 'item_soundbite' && row.item_soundbite) {
    const bounds = clipBoundsForSoundbite(row.item_soundbite);
    return {
      ...base,
      title: nonBlankString(row.item_soundbite.title) ?? itemTitle ?? row.item_soundbite.id_text,
      startPositionSeconds: bounds.start,
      clipStartSeconds: bounds.start,
      clipEndSeconds: bounds.end,
    };
  }
  return {
    ...base,
    title: itemTitle ?? mediaItem.id_text,
    startPositionSeconds: options.startPositionSeconds,
  };
};

/**
 * The advance-window entry for an Add by RSS episode. Null ends the window: a livestream, or an
 * episode with neither a safe media URL nor a download.
 */
export const nativeQueueEntryFromAddByRss = (
  media: AdvanceWindowAddByRssMedia
): NativeCacheQueueEntry | null => {
  const { resourceData } = media;
  if (isAddByRssLivestreamResourceData(resourceData)) {
    return null;
  }
  if (media.mediaUrl === null && media.downloadFileName === null) {
    return null;
  }
  const idText = addByRssPlaybackMediaId(resourceData);
  return {
    idText,
    kind: 'add_by_rss',
    title: nonBlankString(resourceData.title) ?? idText,
    artworkUrl:
      primaryListArtworkUrl(resourceData.item_images ?? [], resourceData.channel_images ?? []) ??
      null,
    podcastTitle: nonBlankString(resourceData.channel_title),
    durationMs: null,
    mediaUrl: media.mediaUrl,
    downloadFileName: media.downloadFileName,
    startPositionSeconds: media.startPositionSeconds,
  };
};
