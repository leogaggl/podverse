/**
 * The one map from popularity entity type to its daily and range-total tables, and to the event
 * table each type's day, week, and month counts come from. SQL in stats services takes table and
 * column names only from here, never from input. Not exported from `@podverse/orm`.
 */
export const STATS_ENTITY_TABLES = {
  channel: {
    key: 'channel_id',
    daily: 'stats_daily_channel',
    popularity: 'stats_popularity_channel',
    events: 'stats_listen_event',
    hasCompletions: true,
  },
  item: {
    key: 'item_id',
    daily: 'stats_daily_item',
    popularity: 'stats_popularity_item',
    events: 'stats_listen_event',
    hasCompletions: true,
  },
  clip: {
    key: 'clip_id',
    daily: 'stats_daily_clip',
    popularity: 'stats_popularity_clip',
    events: 'stats_listen_event',
    hasCompletions: true,
  },
  playlist: {
    key: 'playlist_id',
    daily: 'stats_daily_playlist',
    popularity: 'stats_popularity_playlist',
    events: 'stats_open_event',
    hasCompletions: false,
  },
  account: {
    key: 'account_id',
    daily: 'stats_daily_account',
    popularity: 'stats_popularity_account',
    events: 'stats_open_event',
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
