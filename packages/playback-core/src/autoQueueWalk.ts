import type {
  DTOChannel,
  DTOItemQueueItem,
  DTOPlaylistResource,
  PlaylistResourceIdTextOptions,
} from '@podverse/helpers';

import {
  type AutoQueueConfig,
  type AutoQueueResourcesMap,
  type AutoQueueResourcesMapRow,
  autoQueueRowFromItem,
  autoQueueRowFromPlaylistResource,
  type AutoQueueSeed,
  type AutoQueueSource,
  countAutoQueueRowsAhead,
  dedupeAutoQueueResources,
  resolveAutoQueueSource,
} from './autoQueue.js';

export type AutoQueueDirection = 'forward' | 'backward';

export type AutoQueueSourceFetchers = {
  fetchPlaylistResourcesByListPosition: (
    playlistIdText: string,
    cursor: PlaylistResourceIdTextOptions,
    direction: AutoQueueDirection
  ) => Promise<DTOPlaylistResource[]>;
  fetchPlaylistResourcesByShuffle: (
    playlistIdText: string,
    params: { page: number; shuffleHash: string }
  ) => Promise<DTOPlaylistResource[]>;
  fetchPlaylistResourcesFirstPage: (playlistIdText: string) => Promise<DTOPlaylistResource[]>;
  fetchChannelItemsByShuffle: (
    channelIdText: string,
    params: { page: number; shuffleHash: string }
  ) => Promise<DTOItemQueueItem[]>;
  fetchItemsBySeason: (
    itemIdText: string,
    direction: AutoQueueDirection
  ) => Promise<DTOItemQueueItem[]>;
  fetchChannelItemsBySeasonFirstPage: (channelIdText: string) => Promise<DTOItemQueueItem[]>;
  fetchItemsByPubDate: (
    itemIdText: string,
    direction: AutoQueueDirection
  ) => Promise<DTOItemQueueItem[]>;
  fetchChannelItemsRecentFirstPage: (channelIdText: string) => Promise<DTOItemQueueItem[]>;
};

export type AutoQueueFillInput = {
  config: AutoQueueConfig;
  seed: AutoQueueSeed | null;
  resources: AutoQueueResourcesMap;
  fetchers: AutoQueueSourceFetchers;
};

export type AutoQueueFillResult = {
  resources: AutoQueueResourcesMap;
  config: AutoQueueConfig;
  fetchedCount: number;
  appendedCount: number;
  exhausted: boolean;
};

export type AutoQueueFillAheadInput = AutoQueueFillInput & {
  activeRow: number | null;
  minRowsAhead: number;
  maxFetches?: number;
};

export type AutoQueuePreviousInput = {
  config: AutoQueueConfig;
  seed: AutoQueueSeed;
  activeRow: number;
  fetchers: AutoQueueSourceFetchers;
};

export type AutoQueuePreviousDecision =
  | { kind: 'step-back-row'; row: number }
  | { kind: 'load-previous'; resource: AutoQueueResourcesMapRow & { channel: DTOChannel } }
  | { kind: 'restart' };

function getHighestKey(resources: AutoQueueResourcesMap): number | null {
  const keys = Object.keys(resources).map(Number);
  if (keys.length === 0) {
    return null;
  }
  return Math.max(...keys);
}

function getRowCount(resources: AutoQueueResourcesMap): number {
  return Object.keys(resources).length;
}

function seedResources(
  resources: AutoQueueResourcesMap,
  seed: AutoQueueSeed
): AutoQueueResourcesMap {
  const seededResources: AutoQueueResourcesMap = { ...resources };
  if (seededResources[0] === undefined) {
    seededResources[0] = {
      item: seed.item,
      clip: seed.clip,
      item_soundbite: seed.item_soundbite,
      channel: seed.channel,
    };
  }
  return seededResources;
}

function getSourceCursor(resources: AutoQueueResourcesMap): AutoQueueResourcesMapRow | null {
  const highestKey = getHighestKey(resources);
  if (highestKey === null) {
    return null;
  }
  return resources[highestKey] ?? null;
}

async function fetchForwardRows(
  source: AutoQueueSource,
  config: AutoQueueConfig,
  cursor: AutoQueueResourcesMapRow,
  fetchers: AutoQueueSourceFetchers
): Promise<{
  playlistRows: DTOPlaylistResource[];
  itemRows: DTOItemQueueItem[];
  config: AutoQueueConfig;
}> {
  if (source.kind === 'playlist-list-position') {
    let playlistRows = await fetchers.fetchPlaylistResourcesByListPosition(
      source.playlistIdText,
      {
        item_id_text: cursor.item.id_text,
        clip_id_text: cursor.clip?.id_text,
        item_soundbite_id_text: cursor.item_soundbite?.id_text,
      },
      'forward'
    );
    if (config.repeat && playlistRows.length === 0) {
      playlistRows = await fetchers.fetchPlaylistResourcesFirstPage(source.playlistIdText);
    }
    return {
      playlistRows,
      itemRows: [],
      config,
    };
  }

  if (source.kind === 'playlist-shuffle') {
    let playlistRows = await fetchers.fetchPlaylistResourcesByShuffle(source.playlistIdText, {
      page: config.nextPage,
      shuffleHash: config.shuffleHash,
    });
    if (config.repeat && playlistRows.length === 0) {
      playlistRows = await fetchers.fetchPlaylistResourcesByShuffle(source.playlistIdText, {
        page: 1,
        shuffleHash: config.shuffleHash,
      });
      return {
        playlistRows,
        itemRows: [],
        config: {
          ...config,
          nextPage: 2,
        },
      };
    }
    return {
      playlistRows,
      itemRows: [],
      config: {
        ...config,
        nextPage: config.nextPage + 1,
      },
    };
  }

  if (source.kind === 'channel-shuffle') {
    let itemRows = await fetchers.fetchChannelItemsByShuffle(source.channelIdText, {
      page: config.nextPage,
      shuffleHash: config.shuffleHash,
    });
    if (config.repeat && itemRows.length === 0) {
      itemRows = await fetchers.fetchChannelItemsByShuffle(source.channelIdText, {
        page: 1,
        shuffleHash: config.shuffleHash,
      });
      return {
        playlistRows: [],
        itemRows,
        config: {
          ...config,
          nextPage: 2,
        },
      };
    }
    return {
      playlistRows: [],
      itemRows,
      config: {
        ...config,
        nextPage: config.nextPage + 1,
      },
    };
  }

  if (source.kind === 'channel-season') {
    let itemRows = await fetchers.fetchItemsBySeason(cursor.item.id_text, 'forward');
    if (config.repeat && itemRows.length === 0) {
      itemRows = await fetchers.fetchChannelItemsBySeasonFirstPage(source.channelIdText);
    }
    return {
      playlistRows: [],
      itemRows,
      config,
    };
  }

  let itemRows = await fetchers.fetchItemsByPubDate(cursor.item.id_text, 'forward');
  if (config.repeat && itemRows.length === 0) {
    itemRows = await fetchers.fetchChannelItemsRecentFirstPage(source.channelIdText);
  }
  return {
    playlistRows: [],
    itemRows,
    config,
  };
}

export async function fillAutoQueueForward(
  input: AutoQueueFillInput
): Promise<AutoQueueFillResult> {
  if (input.seed === null) {
    return {
      resources: {},
      config: input.config,
      fetchedCount: 0,
      appendedCount: 0,
      exhausted: true,
    };
  }

  const seededResources = seedResources(input.resources, input.seed);
  const seededRowCount = getRowCount(seededResources);
  const source = resolveAutoQueueSource(input.config, input.seed);
  if (source === null) {
    return {
      resources: seededResources,
      config: input.config,
      fetchedCount: 0,
      appendedCount: 0,
      exhausted: true,
    };
  }

  const cursor = getSourceCursor(seededResources);
  if (cursor === null) {
    return {
      resources: seededResources,
      config: input.config,
      fetchedCount: 0,
      appendedCount: 0,
      exhausted: true,
    };
  }

  const fetchedRows = await fetchForwardRows(source, input.config, cursor, input.fetchers);
  const nextResources: AutoQueueResourcesMap = { ...seededResources };
  const appendStart = (getHighestKey(nextResources) ?? -1) + 1;

  if (source.kind === 'playlist-list-position' || source.kind === 'playlist-shuffle') {
    let rowOffset = 0;
    for (const playlistRow of fetchedRows.playlistRows) {
      const mapped = autoQueueRowFromPlaylistResource(playlistRow);
      if (mapped !== null) {
        nextResources[appendStart + rowOffset] = mapped;
        rowOffset += 1;
      }
    }
  } else {
    let index = 0;
    for (const item of fetchedRows.itemRows) {
      nextResources[appendStart + index] = autoQueueRowFromItem(item);
      index += 1;
    }
  }

  const finalResources =
    input.config.random === true ? dedupeAutoQueueResources(nextResources) : nextResources;
  const fetchedCount =
    source.kind === 'playlist-list-position' || source.kind === 'playlist-shuffle'
      ? fetchedRows.playlistRows.length
      : fetchedRows.itemRows.length;

  return {
    resources: finalResources,
    config: fetchedRows.config,
    fetchedCount,
    appendedCount: getRowCount(finalResources) - seededRowCount,
    exhausted: fetchedCount === 0,
  };
}

export async function fillAutoQueueAhead(
  input: AutoQueueFillAheadInput
): Promise<AutoQueueFillResult> {
  const maxFetches = input.maxFetches ?? 3;
  const existingRowsAhead = countAutoQueueRowsAhead(input.resources, input.activeRow);
  if (existingRowsAhead >= input.minRowsAhead) {
    return {
      resources: input.resources,
      config: input.config,
      fetchedCount: 0,
      appendedCount: 0,
      exhausted: false,
    };
  }

  let resources = input.resources;
  let config = input.config;
  let fetchesRun = 0;
  let fetchedCount = 0;
  let appendedCount = 0;
  let exhausted = false;

  while (
    fetchesRun < maxFetches &&
    countAutoQueueRowsAhead(resources, input.activeRow) < input.minRowsAhead
  ) {
    const result = await fillAutoQueueForward({
      config,
      seed: input.seed,
      resources,
      fetchers: input.fetchers,
    });

    resources = result.resources;
    config = result.config;
    fetchedCount += result.fetchedCount;
    appendedCount += result.appendedCount;
    exhausted = result.exhausted;
    fetchesRun += 1;

    if (result.exhausted || result.appendedCount === 0) {
      break;
    }
  }

  return {
    resources,
    config,
    fetchedCount,
    appendedCount,
    exhausted,
  };
}

export async function resolveAutoQueuePrevious(
  input: AutoQueuePreviousInput
): Promise<AutoQueuePreviousDecision> {
  if (input.activeRow > 0) {
    return {
      kind: 'step-back-row',
      row: input.activeRow - 1,
    };
  }
  if (input.config.random) {
    return { kind: 'restart' };
  }

  const source = resolveAutoQueueSource(input.config, input.seed);
  if (source === null) {
    return { kind: 'restart' };
  }

  if (source.kind === 'playlist-list-position') {
    const playlistRows = await input.fetchers.fetchPlaylistResourcesByListPosition(
      source.playlistIdText,
      {
        item_id_text: input.seed.item.id_text,
        clip_id_text: input.seed.clip?.id_text,
        item_soundbite_id_text: input.seed.item_soundbite?.id_text,
      },
      'backward'
    );
    const playableRow = playlistRows.find((row) => autoQueueRowFromPlaylistResource(row) !== null);
    if (playableRow === undefined) {
      return { kind: 'restart' };
    }
    const mapped = autoQueueRowFromPlaylistResource(playableRow);
    if (mapped === null || mapped.channel === null) {
      return { kind: 'restart' };
    }
    return {
      kind: 'load-previous',
      resource: {
        ...mapped,
        channel: mapped.channel,
      },
    };
  }

  if (source.kind === 'channel-season') {
    const previousItems = await input.fetchers.fetchItemsBySeason(
      input.seed.item.id_text,
      'backward'
    );
    const previousItem = previousItems[0];
    if (previousItem === undefined) {
      return { kind: 'restart' };
    }
    const mapped = autoQueueRowFromItem(previousItem);
    if (mapped.channel === null) {
      return { kind: 'restart' };
    }
    return {
      kind: 'load-previous',
      resource: {
        ...mapped,
        channel: mapped.channel,
      },
    };
  }

  if (source.kind === 'channel-pub-date') {
    const previousItems = await input.fetchers.fetchItemsByPubDate(
      input.seed.item.id_text,
      'backward'
    );
    const previousItem = previousItems[0];
    if (previousItem === undefined) {
      return { kind: 'restart' };
    }
    const mapped = autoQueueRowFromItem(previousItem);
    if (mapped.channel === null) {
      return { kind: 'restart' };
    }
    return {
      kind: 'load-previous',
      resource: {
        ...mapped,
        channel: mapped.channel,
      },
    };
  }

  return { kind: 'restart' };
}
