**Cursor model:** Cursor Grok 4.7 · **Reasoning:** high

# 43 — Dev seeding writes simulated daily totals

`npm run workers:seed_simulated_stats` gives a local database believable Top and trending lists.
Today it writes the 17 rolling columns of `stats_aggregated_*`, which plan 19 drops. This plan
moves it to the new stores: it writes simulated `stats_daily_*` rows for the last 31 UTC days plus
one older history row, then runs the full popularity refresh (plan 42) so `stats_popularity_*` is
filled. It writes no listen events, no taste rows, and never touches the listener mapping.

The worker command is renamed from `devStatsSeedSimulatedAggregated` to
`devStatsSeedSimulatedPopularity`. The root script `workers:seed_simulated_stats`, which
`docs/QUICKSTART.md` tells contributors to run, keeps its name.

## Rows

R48

Moving the seeder off the old tables is what lets plan 19 drop them.

## Runs after

11, 42

## Files

- `apps/workers/src/lib/stats/simulatedPopularityStats.ts` (new)
- `apps/workers/src/lib/stats/simulatedPopularityStats.test.ts` (new)
- `packages/helpers/src/lib/simulatedAggregatedStats.ts` (delete)
- `packages/helpers/src/lib/simulatedAggregatedStats.test.ts` (delete)
- `packages/helpers/src/index.ts`
- `packages/orm/src/services/stats/statsDailyDevSeed.ts` (new)
- `packages/orm/src/index.ts`
- `apps/workers/src/commands/stats/devStatsSeedSimulatedAggregated.ts` (delete)
- `apps/workers/src/commands/stats/devStatsSeedSimulatedPopularity.ts` (new)
- `apps/workers/src/commands/index.ts`
- `packages/worker-commands/src/registry.ts`
- `apps/workers/src/lib/startup/categoriesForCommand.ts`
- `apps/workers/src/lib/startup/categoriesForCommand.test.ts`
- `apps/workers/package.json`
- `package.json`
- `apps/workers/ENV.md`
- `docs/QUICKSTART.md`

## Simulation — `apps/workers/src/lib/stats/simulatedPopularityStats.ts`

Move the shared machinery out of `packages/helpers/src/lib/simulatedAggregatedStats.ts` into this
file unchanged: `hash32`, `mulberry32`, `intIn`, `zipfWeight`, `assignSimulatedStatsCohort`,
`SimulatedStatsCohort`, `cohortAllTimeRange`, `cohortDayPeakRange`, and
`SIMULATED_STATS_ITEMS_PER_CHANNEL = 30`. Only the workers seeder uses them, so they live in
workers, not helpers. Delete the helpers file, its test, and its export line in
`packages/helpers/src/index.ts`.

New exports:

```typescript
export const SIMULATED_STATS_WINDOW_DAYS = 31;
export const SIMULATED_STATS_HISTORY_DAY_OFFSET = 200;

/** `window[i]` is the listener total `i` UTC days before today; `history` is one older total that carries the rest of the all-time count. */
export type SimulatedDailyCounts = { window: number[]; history: number };

export function buildSimulatedChannelDailyCounts(input: { entityId: number; rank: number; total: number }): SimulatedDailyCounts;

export function buildSimulatedItemDailyCounts(input: {
  channelCounts: SimulatedDailyCounts;
  entityId: number;
  itemCount: number;
  itemIndex: number;
}): SimulatedDailyCounts;

/** Finishers for one day: between 30% and 70% of `listenerCount`, never more than it. */
export function simulatedCompletionCount(listenerCount: number, entityId: number, dayOffset: number): number;
```

- **Channel:** seed the RNG as the old `buildSimulatedChannelAggregatedCounts` does. All-time
  target = `round(intIn(allTimeRange) × (0.55 + zipf))`, at least 1. The window is a 31-day
  version of the old `daySeries`: same decay, weekday factor, noise, and 45% zero days for `tail`,
  with peak day `intIn(0, 1)` for `rising`, `intIn(12, 25)` for `fading`, and `intIn(1, 6)`
  otherwise. `history = max(0, allTimeTarget − sum(window))`.
- **Item:** keep the old share rules (`newestShare`, long-tail share, `viral`, jitter
  `0.9 + rng() × 0.2`, seeded as the old item builder). Each window day is
  `min(channel day, round(channel day × dayShare × jitter))`, with `dayShare` 0.18 when viral,
  otherwise the long-tail share. History is
  `min(channel history, round(channel history × min(0.35, allTimeShare) × jitter))`.
- **Completions:** ratio `0.3 + 0.4 × rng()` from `mulberry32(hash32(entityId * 53 + dayOffset * 7 + 11))`,
  then `min(listenerCount, round(listenerCount × ratio))`.

## ORM — `packages/orm/src/services/stats/statsDailyDevSeed.ts`

```typescript
export type StatsDailyDevSeedRow = { id: number; day: string; listenerCount: number; completionCount: number };

/** Dev seeding only: writes daily totals directly, replacing any value already stored for that entity and day. */
export async function devUpsertStatsDailyRows(entityType: StatsEntityType, rows: StatsDailyDevSeedRow[]): Promise<number>;
```

- Table and key from `STATS_ENTITY_TABLES` (plan 42's `statsEntityTables.ts`). Export
  `StatsEntityType` from `@podverse/orm` alongside this function if plan 42 did not.
- Batches of 1000 rows. Per batch, one statement through `AppDataSourceReadWrite.manager.query`:
  `INSERT INTO <daily> (<key>, day, listener_count, completion_count) SELECT * FROM unnest($1::int[], $2::date[], $3::int[], $4::int[]) ON CONFLICT (<key>, day) DO UPDATE SET listener_count = EXCLUDED.listener_count, completion_count = EXCLUDED.completion_count`.
  For playlist and account (`hasCompletions: false`), leave out `completion_count` and `$4`.
- Skip rows whose `listenerCount` is 0. Clamp `completionCount` to `listenerCount`.
- Returns the number of rows sent. The doc comment says this bypasses the write path and is for
  `devStatsSeedSimulatedPopularity` only.

## Command — `apps/workers/src/commands/stats/devStatsSeedSimulatedPopularity.ts`

Same flow as the deleted `devStatsSeedSimulatedAggregated.ts`: same entity queries
(`channelService.getMany`, `itemService.getManyByChannel` newest first, public clips, playlists,
accounts, `PUBLIC_LIST_TAKE = 5000`), same `-itemsPerChannel` / `-items` argument with
`HARD_MAX_ITEMS_PER_CHANNEL = 80`, and the same "No public parsed channels found" early return.
Differences:

- `now = new Date()`. Day strings are `getUtcDateString(subtractDays(now, offset))` (plan 41's
  `statsUtcDates.ts`, `subtractDays` from `@podverse/helpers`): offset `i` for `window[i]`, offset
  `SIMULATED_STATS_HISTORY_DAY_OFFSET` for `history`.
- Channels and items use the two builders above; clips, playlists, and accounts use the channel
  builder ranked by list position, as today.
- Collect rows per entity type and write them with `devUpsertStatsDailyRows` (one call per type,
  the ORM batches).
- Then `await refreshStatsPopularity({ today: getUtcDateString(now), mode: 'full' })`.
- Final log line keeps the old shape with daily row counts:
  `[devStatsSeedSimulatedPopularity] Done. Channels: …, items: …, clips: …, playlists: …, accounts: … daily rows; popularity refreshed.`
- Re-running on a later day writes the new window over the same entities. Rows written on
  earlier runs stay; the seeder never deletes daily rows, because a local database may also hold
  totals from real test listens.

## Registration

- `apps/workers/src/commands/index.ts`: swap the import and object entry to
  `devStatsSeedSimulatedPopularity`.
- `packages/worker-commands/src/registry.ts`: replace the `devStatsSeedSimulatedAggregated` entry
  with name `devStatsSeedSimulatedPopularity`, the same label, description
  `'Write 31 days of staggered daily listener totals plus one older history day for public channels, a capped set of newest items, and public clips, playlists, and accounts, then refresh popularity range totals.'`,
  and the same category, risk, and `example_cli`. In the `devSeedLocalUserContent` description,
  the text "Run workers:seed_simulated_stats afterward for Top lists." stays.
- `apps/workers/src/lib/startup/categoriesForCommand.ts`: rename in `BASE_ORM_COMMANDS`.
- `apps/workers/package.json`: replace `dev_stats_seed_simulated_aggregated` with
  `"dev_stats_seed_simulated_popularity": "node ./dist/index.js devStatsSeedSimulatedPopularity"`.
- Root `package.json`: `"workers:seed_simulated_stats": "node apps/workers/dist/index.js devStatsSeedSimulatedPopularity"`.
- `apps/workers/ENV.md`: rename in the "Base + ORM only" list (re-pad the table).
- Search for `devStatsSeedSimulatedAggregated`, `dev_stats_seed_simulated_aggregated`,
  `SimulatedAggregatedCounts`, and `buildSimulated` outside `node_modules`, `dist`, `.llm/`, and
  `tools/qa/docs/faker/`; fix every remaining hit.

## `docs/QUICKSTART.md`

Rewrite the `workers:seed_simulated_stats` paragraph: it writes 31 days of simulated daily
listener totals (and one older day, so all-time differs from month) for public channels, a cap of
newest episodes per show, and public clips, playlists, and accounts when present, then refreshes
the popularity range totals. Keep "It does not insert a stats row for the whole catalog", the
re-run advice, and `-itemsPerChannel 30` (max 80).

## Tests

- `apps/workers/src/lib/stats/simulatedPopularityStats.test.ts` replaces the deleted helpers test.
  Read `packages/helpers/src/lib/simulatedAggregatedStats.test.ts` before deleting it and keep its
  cohort cases (moved with `assignSimulatedStatsCohort`). Add:
  - Builders are deterministic: the same input twice gives equal output.
  - `window` has length `SIMULATED_STATS_WINDOW_DAYS`; every value and `history` is a
    non-negative integer; the channel's `sum(window) + history` is at least 1.
  - Every item window day and the item history are at most the channel's value for the same day.
  - Across 200 ranked channels, the top-ranked tenth has a larger mean all-time total
    (`sum(window) + history`) than the bottom half.
  - `simulatedCompletionCount` is between `round(0.3 × n)` and `n` for several `n`, and 0 for 0.
- `apps/workers/src/lib/startup/categoriesForCommand.test.ts`: rename the
  `devStatsSeedSimulatedAggregated` case to `devStatsSeedSimulatedPopularity`.

## Release scratchpad

none (dev-only command; the root script name is unchanged)
