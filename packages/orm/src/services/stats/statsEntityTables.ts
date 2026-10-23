/**
 * The one map from popularity entity type to its daily and range-total tables. SQL in stats
 * services takes table and column names only from here, never from input. Not exported from
 * `@podverse/orm`.
 */
export const STATS_ENTITY_TABLES = {
  channel: {
    key: 'channel_id',
    daily: 'stats_daily_channel',
    popularity: 'stats_popularity_channel',
    hasCompletions: true,
  },
  item: {
    key: 'item_id',
    daily: 'stats_daily_item',
    popularity: 'stats_popularity_item',
    hasCompletions: true,
  },
  clip: {
    key: 'clip_id',
    daily: 'stats_daily_clip',
    popularity: 'stats_popularity_clip',
    hasCompletions: true,
  },
  playlist: {
    key: 'playlist_id',
    daily: 'stats_daily_playlist',
    popularity: 'stats_popularity_playlist',
    hasCompletions: false,
  },
  account: {
    key: 'account_id',
    daily: 'stats_daily_account',
    popularity: 'stats_popularity_account',
    hasCompletions: false,
  },
} as const;

export type StatsEntityType = keyof typeof STATS_ENTITY_TABLES;

export const STATS_ENTITY_TYPES: readonly StatsEntityType[] = [
  'channel',
  'item',
  'clip',
  'playlist',
  'account',
];
