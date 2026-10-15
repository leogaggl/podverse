/**
 * Orchestrates car-cache v2 reprojection from SQLite into the durable native cache.
 *
 * Call sites: subscribe/unsubscribe, channel item refresh, queue mutations, history load,
 * downloads mutation, live status refresh, login/logout. Soft-fail; never throw to UI.
 */

import { primaryListArtworkUrl } from '@podverse/helpers';
import type { DTOItem, DTOQueueResource } from '@podverse/helpers/dto';

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
import { playlistRepository } from '../repositories/playlistRepository';
import {
  readHistoryForProjection,
  readQueueCachesForProjection,
} from '../repositories/queueProjectionHelpers';
import type { SubscribedChannel } from '../repositories/subscriptionsMerge';
import { subscriptionsRepository } from '../repositories/subscriptionsRepository';
import {
  projectHistoryIndexToNativeCache,
  projectLibraryBrowseIndexToNativeCache,
  projectLibraryChildrenToNativeCache,
  projectLiveIndexToNativeCache,
  projectQueueSnapshotAvToNativeCache,
  projectQueueSnapshotMusicToNativeCache,
  type NativeCacheBrowseNode,
  type NativeCacheChildItem,
  type NativeCacheHistoryEntry,
  type NativeCacheLiveEntry,
  type NativeCacheMediumBucket,
  type NativeCacheQueueEntry,
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
  downloadById: Map<string, string | null>
): NativeCacheChildItem => {
  const downloadFileName = downloadById.get(item.id_text) ?? null;
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
    downloadFileName,
  };
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

/** Project recent children for one channel (cap 50). */
export const reprojectLibraryChildrenForChannel = async (
  channelIdText: string,
  mediumBucket: NativeCacheMediumBucket = 'av'
): Promise<void> => {
  await soft(`library-children/${channelIdText}`, async () => {
    const items = await channelItemsRepository.listByChannel(channelIdText, { sort: 'recent' });
    const window = items.slice(0, CHILDREN_WINDOW);
    const downloadById = await completeDownloadMap();
    const childItems = window.map((item) => toChildItem(item, downloadById));
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
    for (const channel of subscribed) {
      if (channel.source === 'addByRss') {
        continue;
      }
      await reprojectLibraryChildrenForChannel(channel.idText, mediumBucketForChannel(channel));
    }
  });
};

const projectQueueBucket = async (
  queueIdText: string | null | undefined,
  bucket: NativeCacheMediumBucket
): Promise<void> => {
  const empty = { nowPlayingIdText: null, entries: [] as NativeCacheQueueEntry[] };
  if (queueIdText === null || queueIdText === undefined || queueIdText === '') {
    if (bucket === 'music') {
      await projectQueueSnapshotMusicToNativeCache(empty);
    } else {
      await projectQueueSnapshotAvToNativeCache(empty);
    }
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
      await projectHistoryIndexToNativeCache({ entries: [] });
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

/** Project Live Now rows from freshly fetched live items (stream URL required). */
export const reprojectLiveIndexFromItems = async (items: readonly DTOItem[]): Promise<void> => {
  await soft('live-index', async () => {
    const entries: NativeCacheLiveEntry[] = [];
    for (const item of items) {
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
  });
};

/** Live Now index from broadcasting keys only — empty when no stream URLs were projected. */
export const reprojectLiveIndex = async (): Promise<void> => {
  await soft('live-index-keys', async () => {
    // Status keys alone cannot play; keep an empty index unless `reprojectLiveIndexFromItems` ran.
    await channelLiveStatusRepository.listBroadcastingKeys();
    await projectLiveIndexToNativeCache({ entries: [] });
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
