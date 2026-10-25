import type {
  DTOChannel,
  DTOClip,
  DTOItemQueueItem,
  DTOItemSoundbite,
  DTOPlaylistResource,
} from '@podverse/helpers';
import { isRemovedSource } from '@podverse/helpers';
import { MediumEnum } from '@podverse/helpers/medium';

import type { PlaybackTarget } from './playbackTarget.js';

export type AutoQueueResourcesMapRow = {
  item: DTOItemQueueItem;
  clip: DTOClip | null;
  item_soundbite: DTOItemSoundbite | null;
  channel: DTOChannel | null;
};

export type AutoQueueResourcesMap = { [key: number]: AutoQueueResourcesMapRow };

export type AutoQueueConfig = {
  playlist_id_text: string | null;
  disabled: boolean;
  random: boolean;
  repeat: boolean;
  nextPage: number;
  shuffleHash: string;
};

export type AutoQueueSeed = {
  item: DTOItemQueueItem;
  channel: DTOChannel;
  clip: DTOClip | null;
  item_soundbite: DTOItemSoundbite | null;
};

export type AutoQueueSource =
  | { kind: 'playlist-list-position'; playlistIdText: string }
  | { kind: 'playlist-shuffle'; playlistIdText: string }
  | { kind: 'channel-shuffle'; channelIdText: string }
  | { kind: 'channel-season'; channelIdText: string }
  | { kind: 'channel-pub-date'; channelIdText: string };

function getSortedKeys(resources: AutoQueueResourcesMap): number[] {
  return Object.keys(resources)
    .map(Number)
    .sort((a, b) => a - b);
}

export function checkIsActiveRowHighestKey(
  autoQueueActiveRow: number | null,
  autoQueueResources: AutoQueueResourcesMap
): boolean {
  if (autoQueueActiveRow === null) {
    return false;
  }
  const keys = Object.keys(autoQueueResources).map(Number);
  if (keys.length === 0) {
    return false;
  }
  const highestKey = Math.max(...keys);
  return autoQueueActiveRow === highestKey;
}

export function autoQueueIncrementActiveRow(autoQueueActiveRow: number | null): number {
  if (autoQueueActiveRow === null || autoQueueActiveRow < 1) {
    return 1;
  }
  return autoQueueActiveRow + 1;
}

export function countAutoQueueRowsAhead(
  resources: AutoQueueResourcesMap,
  activeRow: number | null
): number {
  const startRow = activeRow === null ? 0 : Math.max(activeRow, 0);
  let count = 0;
  let row = startRow + 1;
  while (resources[row] !== undefined) {
    count += 1;
    row += 1;
  }
  return count;
}

export function selectAutoQueueRowsAhead(
  resources: AutoQueueResourcesMap,
  activeRow: number | null,
  limit: number
): AutoQueueResourcesMapRow[] {
  if (limit <= 0) {
    return [];
  }
  const rows: AutoQueueResourcesMapRow[] = [];
  const startRow = activeRow === null ? 0 : Math.max(activeRow, 0);
  let row = startRow + 1;
  while (rows.length < limit) {
    const nextRow = resources[row];
    if (nextRow === undefined) {
      break;
    }
    rows.push(nextRow);
    row += 1;
  }
  return rows;
}

export function hasAutoQueueRowAfter(
  resources: AutoQueueResourcesMap,
  activeRow: number | null
): boolean {
  return countAutoQueueRowsAhead(resources, activeRow) > 0;
}

export function createDefaultAutoQueueConfig(nextShuffleHash: () => string): AutoQueueConfig {
  return {
    playlist_id_text: null,
    disabled: false,
    random: false,
    repeat: false,
    nextPage: 1,
    shuffleHash: nextShuffleHash(),
  };
}

export function resolveAutoQueueConfigForExplicitPlay(
  current: AutoQueueConfig,
  playlistIdText: string | null,
  nextShuffleHash: () => string
): AutoQueueConfig {
  return {
    ...current,
    playlist_id_text: playlistIdText,
    disabled: false,
    nextPage: 1,
    shuffleHash: nextShuffleHash(),
  };
}

export function toggleAutoQueueShuffle(
  current: AutoQueueConfig,
  nextShuffleHash: () => string
): AutoQueueConfig {
  return {
    ...current,
    random: !current.random,
    nextPage: 1,
    shuffleHash: nextShuffleHash(),
  };
}

export function toggleAutoQueueRepeat(current: AutoQueueConfig): AutoQueueConfig {
  return {
    ...current,
    repeat: !current.repeat,
    nextPage: 1,
  };
}

export function autoQueueSeedFromPlaybackTarget(
  target: PlaybackTarget | null
): AutoQueueSeed | null {
  if (target === null || target.kind === 'add-by-rss' || target.kind === 'livestream') {
    return null;
  }
  return {
    item: target.item,
    channel: target.channel,
    clip: target.kind === 'clip' ? target.clip : null,
    item_soundbite: target.kind === 'soundbite' ? target.soundbite : null,
  };
}

export function isPlayablePlaylistResource(resource: DTOPlaylistResource): boolean {
  if (isRemovedSource(resource)) {
    return false;
  }
  if (resource.clip) {
    return (
      !isRemovedSource(resource.clip) &&
      resource.clip.item !== null &&
      resource.clip.item !== undefined
    );
  }
  if (resource.item_soundbite) {
    return resource.item_soundbite.item !== null && resource.item_soundbite.item !== undefined;
  }
  return resource.item !== null && resource.item !== undefined;
}

export function autoQueueRowFromPlaylistResource(
  resource: DTOPlaylistResource
): AutoQueueResourcesMapRow | null {
  if (!isPlayablePlaylistResource(resource)) {
    return null;
  }
  if (resource.clip && resource.clip.item) {
    return {
      item: resource.clip.item,
      clip: resource.clip,
      item_soundbite: null,
      channel: resource.clip.item.channel ?? null,
    };
  }
  if (resource.item_soundbite && resource.item_soundbite.item) {
    return {
      item: resource.item_soundbite.item,
      clip: null,
      item_soundbite: resource.item_soundbite,
      channel: resource.item_soundbite.item.channel ?? null,
    };
  }
  if (resource.item) {
    return {
      item: resource.item,
      clip: null,
      item_soundbite: null,
      channel: resource.item.channel ?? null,
    };
  }
  return null;
}

export function autoQueueRowFromItem(item: DTOItemQueueItem): AutoQueueResourcesMapRow {
  return {
    item,
    clip: null,
    item_soundbite: null,
    channel: item.channel ?? null,
  };
}

export function dedupeAutoQueueResources(resources: AutoQueueResourcesMap): AutoQueueResourcesMap {
  const seenClipIds = new Set<string>();
  const seenSoundbiteIds = new Set<string>();
  const seenItemIds = new Set<string>();
  const deduped: AutoQueueResourcesMap = {};
  let dedupedKey = 0;
  for (const key of getSortedKeys(resources)) {
    const row = resources[key];
    if (row === undefined) {
      continue;
    }
    let shouldSkip = false;
    if (row.clip) {
      if (seenClipIds.has(row.clip.id_text)) {
        shouldSkip = true;
      } else {
        seenClipIds.add(row.clip.id_text);
      }
    } else if (row.item_soundbite) {
      if (seenSoundbiteIds.has(row.item_soundbite.id_text)) {
        shouldSkip = true;
      } else {
        seenSoundbiteIds.add(row.item_soundbite.id_text);
      }
    } else if (seenItemIds.has(row.item.id_text)) {
      shouldSkip = true;
    } else {
      seenItemIds.add(row.item.id_text);
    }
    if (!shouldSkip) {
      deduped[dedupedKey] = row;
      dedupedKey += 1;
    }
  }
  return deduped;
}

export function resolveAutoQueueSource(
  config: AutoQueueConfig,
  seed: AutoQueueSeed
): AutoQueueSource | null {
  if (config.disabled) {
    return null;
  }
  if (config.playlist_id_text) {
    if (config.random) {
      return { kind: 'playlist-shuffle', playlistIdText: config.playlist_id_text };
    }
    return { kind: 'playlist-list-position', playlistIdText: config.playlist_id_text };
  }
  if (config.random) {
    return { kind: 'channel-shuffle', channelIdText: seed.channel.id_text };
  }
  if (seed.channel.medium_id === MediumEnum.Music) {
    return { kind: 'channel-season', channelIdText: seed.channel.id_text };
  }
  return { kind: 'channel-pub-date', channelIdText: seed.channel.id_text };
}
