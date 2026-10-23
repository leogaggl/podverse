import type { CommandLineArgs } from '@workers/commands/index.js';
import { getLoggerService } from '@workers/factories/loggerService.js';
import type { SimulatedDailyCounts } from '@workers/lib/stats/simulatedPopularityStats.js';
import {
  buildSimulatedChannelDailyCounts,
  buildSimulatedItemDailyCounts,
  SIMULATED_STATS_HISTORY_DAY_OFFSET,
  SIMULATED_STATS_ITEMS_PER_CHANNEL,
  simulatedCompletionCount,
} from '@workers/lib/stats/simulatedPopularityStats.js';
import { getUtcDateString } from '@workers/lib/stats/statsUtcDates.js';

import { subtractDays } from '@podverse/helpers';
import type { StatsDailyDevSeedRow, StatsEntityType } from '@podverse/orm';
import {
  AccountService,
  ChannelService,
  ClipService,
  devUpsertStatsDailyRows,
  devWriteStatsPopularityWindowsFromDailyRows,
  ItemService,
  PlaylistService,
  refreshStatsPopularity,
} from '@podverse/orm';

const HARD_MAX_ITEMS_PER_CHANNEL = 80;
const SEEDED_ENTITY_TYPES: readonly StatsEntityType[] = [
  'channel',
  'item',
  'clip',
  'playlist',
  'account',
];
const PUBLIC_LIST_TAKE = 5000;

function parsePositiveInt(raw: string | string[] | undefined, fallback: number): number {
  if (raw === undefined || raw === '') {
    return fallback;
  }
  const value = Array.isArray(raw) ? raw[0] : raw;
  const parsed = parseInt(String(value ?? ''), 10);
  if (Number.isNaN(parsed) || parsed < 1) {
    return fallback;
  }
  return parsed;
}

function appendDailyRows(
  rows: StatsDailyDevSeedRow[],
  id: number,
  counts: SimulatedDailyCounts,
  now: Date,
  includeCompletions: boolean
): void {
  for (let offset = 0; offset < counts.window.length; offset += 1) {
    const listenerCount = counts.window[offset] ?? 0;
    rows.push({
      id,
      day: getUtcDateString(subtractDays(now, offset)),
      listenerCount,
      completionCount: includeCompletions ? simulatedCompletionCount(listenerCount, id, offset) : 0,
    });
  }
  rows.push({
    id,
    day: getUtcDateString(subtractDays(now, SIMULATED_STATS_HISTORY_DAY_OFFSET)),
    listenerCount: counts.history,
    completionCount: includeCompletions
      ? simulatedCompletionCount(counts.history, id, SIMULATED_STATS_HISTORY_DAY_OFFSET)
      : 0,
  });
}

function appendRankedChannelRows(
  rows: StatsDailyDevSeedRow[],
  entities: { id: number }[],
  now: Date,
  includeCompletions: boolean
): void {
  for (let rank = 0; rank < entities.length; rank += 1) {
    const entity = entities[rank];
    if (entity === undefined) {
      continue;
    }
    appendDailyRows(
      rows,
      entity.id,
      buildSimulatedChannelDailyCounts({
        entityId: entity.id,
        rank,
        total: entities.length,
      }),
      now,
      includeCompletions
    );
  }
}

export async function devStatsSeedSimulatedPopularity(args: CommandLineArgs) {
  const logger = getLoggerService();
  const itemsPerChannel = Math.min(
    HARD_MAX_ITEMS_PER_CHANNEL,
    parsePositiveInt(
      'itemsPerChannel' in args ? args.itemsPerChannel : args.items,
      SIMULATED_STATS_ITEMS_PER_CHANNEL
    )
  );

  const channelService = new ChannelService();
  const itemService = new ItemService();
  const clipService = new ClipService();
  const playlistService = new PlaylistService();
  const accountService = new AccountService();

  const channels = await channelService.getMany(
    { order: { id: 'ASC' }, take: PUBLIC_LIST_TAKE },
    'all',
    null
  );

  if (channels.length === 0) {
    logger.warn(
      '[devStatsSeedSimulatedPopularity] No public parsed channels found. Parse feeds first.'
    );
    return;
  }

  const now = new Date();
  logger.info(
    `[devStatsSeedSimulatedPopularity] Writing staggered daily totals for ${channels.length} channel(s), up to ${itemsPerChannel} newest item(s) each, plus public clips, playlists, and accounts when present.`
  );

  const channelRows: StatsDailyDevSeedRow[] = [];
  const itemRows: StatsDailyDevSeedRow[] = [];

  for (let rank = 0; rank < channels.length; rank += 1) {
    const channel = channels[rank];
    if (channel === undefined) {
      continue;
    }

    const channelCounts = buildSimulatedChannelDailyCounts({
      entityId: channel.id,
      rank,
      total: channels.length,
    });
    appendDailyRows(channelRows, channel.id, channelCounts, now, true);

    const items = await itemService.getManyByChannel(channel, {
      order: { pub_date: 'DESC' },
      take: itemsPerChannel,
    });

    for (let itemIndex = 0; itemIndex < items.length; itemIndex += 1) {
      const item = items[itemIndex];
      if (item === undefined) {
        continue;
      }
      appendDailyRows(
        itemRows,
        item.id,
        buildSimulatedItemDailyCounts({
          channelCounts,
          entityId: item.id,
          itemCount: items.length,
          itemIndex,
        }),
        now,
        true
      );
    }
  }

  const clips = await clipService.getManyPublic(null, null, {
    order: { id: 'ASC' },
    take: PUBLIC_LIST_TAKE,
  });
  const playlists = await playlistService.getManyPublic({
    order: { id: 'ASC' },
    take: PUBLIC_LIST_TAKE,
  });
  const accounts = await accountService.getManyPublic({
    order: { id: 'ASC' },
    take: PUBLIC_LIST_TAKE,
  });

  const clipRows: StatsDailyDevSeedRow[] = [];
  const playlistRows: StatsDailyDevSeedRow[] = [];
  const accountRows: StatsDailyDevSeedRow[] = [];
  appendRankedChannelRows(clipRows, clips, now, true);
  appendRankedChannelRows(playlistRows, playlists, now, false);
  appendRankedChannelRows(accountRows, accounts, now, false);

  const channelRowCount = await devUpsertStatsDailyRows('channel', channelRows);
  const itemRowCount = await devUpsertStatsDailyRows('item', itemRows);
  const clipRowCount = await devUpsertStatsDailyRows('clip', clipRows);
  const playlistRowCount = await devUpsertStatsDailyRows('playlist', playlistRows);
  const accountRowCount = await devUpsertStatsDailyRows('account', accountRows);

  const today = getUtcDateString(now);
  await refreshStatsPopularity({ today, mode: 'full' });
  for (const entityType of SEEDED_ENTITY_TYPES) {
    await devWriteStatsPopularityWindowsFromDailyRows(entityType, today);
  }

  logger.info(
    `[devStatsSeedSimulatedPopularity] Done. Channels: ${channelRowCount}, items: ${itemRowCount}, clips: ${clipRowCount}, playlists: ${playlistRowCount}, accounts: ${accountRowCount} daily rows; popularity refreshed, and day, week, and month counts written from the simulated daily rows.`
  );
}
