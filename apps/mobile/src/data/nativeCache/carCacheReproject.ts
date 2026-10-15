/**
 * Orchestrates car-cache v2 reprojection from SQLite into the durable native cache.
 *
 * Call sites: subscribe/unsubscribe, channel item refresh, queue mutations, history load,
 * downloads mutation, live status refresh, login/logout. Soft-fail; never throw to UI.
 */

import { primaryListArtworkUrl } from '@podverse/helpers';
import type { DTOItem, DTOQueueResource } from '@podverse/helpers/dto';
import { LiveItemStatusEnum } from '@podverse/helpers/dto';

import {
  buildItemLabeledEnclosures,
  DEFAULT_ENCLOSURE_SELECTED_PARAMS,
  resolveItemEnclosureUrl,
} from '../../lib/playback/resolveEnclosureUrl';
import { addByRssRepository } from '../repositories/addByRssRepository';
import { channelItemsRepository } from '../repositories/channelItemsRepository';
import { channelLiveStatusRepository } from '../repositories/channelLiveStatusRepository';
import { downloadsRepository } from '../repositories/downloadsRepository';
import {
  mapPlaylistToNode,
  mapSubscribedChannelToNode,
  mergeLibraryBrowseNodes,
} from '../repositories/libraryBrowseProjection';
import { playableItemRepository } from '../repositories/playableItemRepository';
import { playlistRepository } from '../repositories/playlistRepository';
import type { ItemProgressLookup } from '../repositories/queueProjectionHelpers';
import {
  readHistoryForProjection,
  readItemProgressForProjection,
  readQueueCachesForProjection,
} from '../repositories/queueProjectionHelpers';
import type { SubscribedChannel } from '../repositories/subscriptionsMerge';
import { subscriptionsRepository } from '../repositories/subscriptionsRepository';
import type {
  NativeCacheBrowseNode,
  NativeCacheChildItem,
  NativeCacheHistoryEntry,
  NativeCacheLiveEntry,
  NativeCacheMediumBucket,
  NativeCacheQueueEntry,
} from './projection';
import {
  projectHistoryIndexToNativeCache,
  projectLibraryBrowseIndexToNativeCache,
  projectLibraryChildrenToNativeCache,
  projectLiveIndexToNativeCache,
  projectQueueSnapshotAvToNativeCache,
  projectQueueSnapshotMusicToNativeCache,
} from './projection';

const CHILDREN_WINDOW = 50;
const HISTORY_CAP = 20;

const mediumBucketForChannel = (channel: SubscribedChannel): NativeCacheMediumBucket =>
  channel.medium === 'music' ? 'music' : 'av';

const browseKindForChannel = (channel: SubscribedChannel): NativeCacheBrowseNode['kind'] => {
  if (channel.kind === 'artists') {
    return 'artist';
  }
  if (channel.kind === 'albums') {
    return 'album';
  }
  return 'podcast';
};

const mapChannelToBrowseNode = (channel: SubscribedChannel): NativeCacheBrowseNode => {
  const base = mapSubscribedChannelToNode(channel);
  return {
    ...base,
    kind: browseKindForChannel(channel),
    mediumBucket: mediumBucketForChannel(channel),
  };
};

const resolveMediaUrl = (item: DTOItem): string | null => {
  const labeled = buildItemLabeledEnclosures(item);
  return resolveItemEnclosureUrl({
    labeledItemEnclosures: labeled,
    selectedParams: DEFAULT_ENCLOSURE_SELECTED_PARAMS,
  });
};

const toQueueEntry = (resource: DTOQueueResource): NativeCacheQueueEntry | null => {
  const item = resource.item;
  const positionSeconds = Number(resource.playback_position);
  if (item === null || item === undefined) {
    return null;
  }
  return {
    idText: item.id_text,
    title: item.title ?? item.id_text,
    artworkUrl: primaryListArtworkUrl(item.item_images, item.channel?.channel_images),
    mediaUrl: resolveMediaUrl(item),
    podcastTitle: item.channel?.title ?? null,
    durationMs: durationMsFromItem(item),
    startPositionSeconds:
      Number.isFinite(positionSeconds) && positionSeconds > 0 ? positionSeconds : null,
    kind: 'item',
  };
};

const durationMsFromItem = (item: DTOItem): number | null => {
  const raw = item.item_about?.duration;
  if (raw === null || raw === undefined || raw === '') {
    return null;
  }
  const seconds = typeof raw === 'number' ? raw : Number(raw);
  if (!Number.isFinite(seconds) || seconds <= 0) {
    return null;
  }
  return Math.round(seconds * 1000);
};

const toChildItem = (
  item: DTOItem,
  downloadById: Map<string, string | null>,
  progressFor: ItemProgressLookup
): NativeCacheChildItem => {
  const downloadFileName = downloadById.get(item.id_text) ?? null;
  const progress = progressFor(item);
  return {
    idText: item.id_text,
    title: item.title ?? item.id_text,
    subtitle: item.channel?.title ?? null,
    artworkUrl: primaryListArtworkUrl(item.item_images, item.channel?.channel_images),
    mediaUrl: downloadFileName ?? resolveMediaUrl(item),
    durationMs: durationMsFromItem(item),
    pubDateMs:
      typeof item.pub_date === 'string' && item.pub_date.length > 0
        ? Date.parse(item.pub_date)
        : null,
    // A played item starts over in the car, so it carries no resume point.
    progressSeconds:
      progress !== null && !progress.played && progress.positionSeconds > 0
        ? progress.positionSeconds
        : null,
    played: progress?.played ?? false,
    downloadFileName,
  };
};

const readAccountIdText = async (): Promise<string | null> => {
  try {
    const { accountRepository } = await import('../repositories/accountRepository');
    return (await accountRepository.getSnapshot())?.id_text ?? null;
  } catch {
    return null;
  }
};

const readProgressLookup = async (): Promise<ItemProgressLookup> => {
  try {
    return await readItemProgressForProjection(await readAccountIdText());
  } catch {
    return () => null;
  }
};

const soft = async (label: string, work: () => Promise<void>): Promise<void> => {
  try {
    await work();
  } catch (error) {
    if (__DEV__) {
      console.warn(`[native-cache] ${label} soft-fail`, error);
    }
  }
};

const completeDownloadMap = async (): Promise<Map<string, string | null>> => {
  const downloads = await downloadsRepository.list();
  return new Map(
    downloads
      .filter((row) => row.status === 'complete')
      .map((row) => [row.itemIdText, row.filePath])
  );
};

/** Project library index (podcasts + music + playlists). Excludes credentialed add-by-RSS. */
export const reprojectLibraryIndex = async (): Promise<void> => {
  await soft('library-index', async () => {
    const subscribed = await subscriptionsRepository.list();
    const credentialedUrls = new Set<string>();
    try {
      const feeds = await addByRssRepository.listFeeds();
      for (const feed of feeds) {
        if (feed.requiresCredentials === true) {
          credentialedUrls.add(feed.feedUrl);
        }
      }
    } catch {
      // Soft-fail: project directory follows even if add-by-RSS list fails.
    }

    const channelNodes = subscribed
      .filter((channel) => {
        if (channel.source !== 'addByRss') {
          return true;
        }
        return !credentialedUrls.has(channel.idText);
      })
      .map(mapChannelToBrowseNode);

    let playlistNodes: NativeCacheBrowseNode[] = [];
    try {
      const playlists = await playlistRepository.listFollowedCached();
      playlistNodes = playlists
        .map(mapPlaylistToNode)
        .filter((node): node is NativeCacheBrowseNode => node !== null);
    } catch {
      // Playlists optional for car index.
    }

    await projectLibraryBrowseIndexToNativeCache({
      nodes: mergeLibraryBrowseNodes(channelNodes, playlistNodes),
    });
  });
};

/** Project recent children for one channel (cap 50), with where the account left off in each. */
export const reprojectLibraryChildrenForChannel = async (
  channelIdText: string,
  mediumBucket: NativeCacheMediumBucket = 'av',
  progressLookup?: ItemProgressLookup
): Promise<void> => {
  await soft(`library-children/${channelIdText}`, async () => {
    const items = await channelItemsRepository.listByChannel(channelIdText, { sort: 'recent' });
    const window = items.slice(0, CHILDREN_WINDOW);
    const downloadById = await completeDownloadMap();
    const progressFor = progressLookup ?? (await readProgressLookup());
    const childItems = window.map((item) => toChildItem(item, downloadById, progressFor));
    await projectLibraryChildrenToNativeCache({
      channelIdText,
      mediumBucket,
      items: childItems,
    });
  });
};

/** Project children for every subscribed directory channel (best-effort). */
export const reprojectLibraryChildrenAll = async (): Promise<void> => {
  await soft('library-children-all', async () => {
    const subscribed = await subscriptionsRepository.list();
    const progressFor = await readProgressLookup();
    for (const channel of subscribed) {
      if (channel.source === 'addByRss') {
        continue;
      }
      await reprojectLibraryChildrenForChannel(
        channel.idText,
        mediumBucketForChannel(channel),
        progressFor
      );
    }
  });
};

const projectQueueBucket = async (
  queueIdText: string | null | undefined,
  bucket: NativeCacheMediumBucket
): Promise<void> => {
  // An unknown queue id is not an empty queue. Sign-out empties the snapshots itself, so a
  // missing id leaves what the car already shows.
  if (queueIdText === null || queueIdText === undefined || queueIdText === '') {
    return;
  }

  const caches = await readQueueCachesForProjection(queueIdText);
  const entries: NativeCacheQueueEntry[] = [];
  if (caches.nowPlaying !== null) {
    const entry = toQueueEntry(caches.nowPlaying);
    if (entry !== null) {
      entries.push(entry);
    }
  }
  for (const resource of caches.upcoming) {
    const entry = toQueueEntry(resource);
    if (entry !== null && entry.idText !== caches.nowPlaying?.item?.id_text) {
      entries.push(entry);
    }
  }

  const snapshot = {
    nowPlayingIdText: caches.nowPlaying?.item?.id_text ?? null,
    entries,
  };
  if (bucket === 'music') {
    await projectQueueSnapshotMusicToNativeCache(snapshot);
  } else {
    await projectQueueSnapshotAvToNativeCache(snapshot);
  }
};

/** Dual-queue projection for AV + Music queue id texts. */
export const reprojectDualQueues = async (params: {
  avQueueIdText?: string | null;
  musicQueueIdText?: string | null;
}): Promise<void> => {
  await soft('queue-av', () => projectQueueBucket(params.avQueueIdText, 'av'));
  await soft('queue-music', () => projectQueueBucket(params.musicQueueIdText, 'music'));
};

/** History index (cap 20) from the queue history page when available. */
export const reprojectHistoryIndex = async (queueIdText?: string | null): Promise<void> => {
  await soft('history-index', async () => {
    if (queueIdText === null || queueIdText === undefined || queueIdText === '') {
      return;
    }
    const resources = await readHistoryForProjection(queueIdText, HISTORY_CAP);
    const downloadById = await completeDownloadMap();
    const entries: NativeCacheHistoryEntry[] = [];
    for (const resource of resources) {
      const item = resource.item;
      if (item === null || item === undefined) {
        continue;
      }
      const downloadFileName = downloadById.get(item.id_text) ?? null;
      entries.push({
        idText: item.id_text,
        title: item.title ?? item.id_text,
        channelTitle: item.channel?.title ?? null,
        artworkUrl: primaryListArtworkUrl(item.item_images, item.channel?.channel_images),
        mediaUrl: downloadFileName ?? resolveMediaUrl(item),
        mediumBucket: 'av',
        downloadFileName,
      });
      if (entries.length >= HISTORY_CAP) {
        break;
      }
    }
    await projectHistoryIndexToNativeCache({ entries });
  });
};

const writeLiveIndex = async (items: readonly DTOItem[]): Promise<void> => {
  const entries: NativeCacheLiveEntry[] = [];
  for (const item of items) {
    // Pending and ended items have no stream to join yet or anymore.
    if (item.live_item?.live_item_status_id !== LiveItemStatusEnum.Live) {
      continue;
    }
    const mediaUrl = resolveMediaUrl(item);
    if (mediaUrl === null || mediaUrl === '') {
      continue;
    }
    const channelIdText = item.channel?.id_text;
    if (channelIdText === null || channelIdText === undefined || channelIdText === '') {
      continue;
    }
    entries.push({
      idText: item.id_text,
      title: item.title ?? item.channel?.title ?? item.id_text,
      channelIdText,
      channelTitle: item.channel?.title ?? null,
      artworkUrl: primaryListArtworkUrl(item.item_images, item.channel?.channel_images),
      mediaUrl,
      mediumBucket: 'av',
    });
  }
  await projectLiveIndexToNativeCache({ entries });
};

/** Project Live Now rows from freshly fetched live items (stream URL required). */
export const reprojectLiveIndexFromItems = async (items: readonly DTOItem[]): Promise<void> => {
  await soft('live-index', () => writeLiveIndex(items));
};

/**
 * Live Now from the stored live items, limited to channels whose broadcast status is still
 * trusted. A broadcast ends whether or not this device hears about it, so a stale status drops
 * its row rather than offering a stream that has stopped.
 */
export const reprojectLiveIndex = async (): Promise<void> => {
  await soft('live-index-stored', async () => {
    const [items, broadcasting] = await Promise.all([
      playableItemRepository.listBySource('live'),
      channelLiveStatusRepository.listBroadcastingKeys(),
    ]);
    await writeLiveIndex(
      items.filter((item) => {
        const channelIdText = item.channel?.id_text;
        return channelIdText !== undefined && broadcasting.has(channelIdText);
      })
    );
  });
};

/** Full car-cache refresh used by background car sync. */
export const reprojectCarCacheAll = async (params?: {
  avQueueIdText?: string | null;
  musicQueueIdText?: string | null;
}): Promise<void> => {
  await reprojectLibraryIndex();
  await reprojectLibraryChildrenAll();
  await reprojectDualQueues({
    avQueueIdText: params?.avQueueIdText,
    musicQueueIdText: params?.musicQueueIdText,
  });
  await reprojectHistoryIndex(params?.avQueueIdText);
  await reprojectLiveIndex();
};
