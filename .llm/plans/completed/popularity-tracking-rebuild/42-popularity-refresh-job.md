**Cursor model:** Opus 5.5 · **Reasoning:** high

# 42 — Popularity refresh job: rebuild range totals from daily totals

A worker command and two CronJobs that rebuild `stats_popularity_{channel,item,clip,playlist,account}`
from the anonymous daily totals, per plan 10 § "Range totals are rebuilt by a job". Public sorts
(area E) and management (area F) read these tables, so this job is what keeps day, week, month,
and all-time rankings current (R31, and the "nothing goes stale" half of R27).

The command replaces `statsUpdateAggregated` and `statsUpdateAggregatedRolling`, which only ever
refreshed the top 500 entities and were never scheduled. This plan deletes both, so plan 19 finds
no worker caller of the old services.

## Rows

R31

## Runs after

10, 11, 41

## Files

- `packages/orm/src/services/stats/statsEntityTables.ts` (new)
- `packages/orm/src/services/stats/statsPopularityRefresh.ts` (new)
- `packages/orm/src/index.ts`
- `apps/workers/src/commands/stats/statsPopularityRefresh.ts` (new)
- `apps/workers/src/commands/stats/statsPopularityRefresh.test.ts` (new)
- `apps/workers/src/commands/stats/statsUpdateAggregated.ts` (delete)
- `apps/workers/src/commands/stats/statsUpdateAggregatedRolling.ts` (delete)
- `apps/workers/src/commands/index.ts`
- `packages/worker-commands/src/registry.ts`
- `apps/workers/src/lib/startup/categoriesForCommand.ts`
- `apps/workers/src/lib/startup/categoriesForCommand.test.ts`
- `apps/workers/src/lib/startup/validation.ts` (doc comment example only)
- `apps/workers/src/lib/extensions/longRunningCommands.test.ts`
- `apps/workers/src/lib/oneShotProcessExit.test.ts`
- `apps/workers/package.json`
- `infra/k8s/base/cron/worker-stats-popularity-refresh.cronjob.yaml` (new)
- `infra/k8s/base/cron/worker-stats-popularity-refresh-full.cronjob.yaml` (new)
- `infra/k8s/base/cron/kustomization.yaml`
- `apps/workers/ENV.md`
- `apps/workers/APPS-WORKERS.md`
- `docs/features/POPULARITY-TRACKING.md`
- `apps/api/src/test/stats-popularity-refresh.integration.test.ts` (new)

## What stays true

- Windows are inclusive UTC date ranges `[today − lookback, today]`, with lookbacks from
  `STATS_POPULARITY_RANGE_LOOKBACK_DAYS` in `@podverse/helpers` (day 1, week 7, month 30). The
  upper bound `day <= today` matters only for tests that pass a past `today`.
- Each window count is `SUM(listener_count)` over that range; `all_time_count` is the sum over
  every daily row of the entity. Completion counts are not part of range totals.
- Only this job writes `stats_popularity_*` (channel merge in area E may delete a merged-away
  channel's row; the nightly run corrects any survivor).
- The job reads daily rows through MVCC and never blocks the listen write path; it takes no lock
  the write path takes.
- Two runs never interleave on one entity type: each type's work runs in one transaction that
  starts with `SELECT pg_advisory_xact_lock(hashtextextended('popularity_refresh:' || $1, 0))`
  with the type name.
- A row is written only when one of its four counts changes (`ON CONFLICT … DO UPDATE … WHERE`
  the new tuple `IS DISTINCT FROM` the stored one), so hourly runs do not rewrite unchanged rows.
- Workers and this ORM file never name the listener mapping (plan 12's guard).

## Two modes (decided)

Daily totals only grow on the current UTC date: the write path stamps each event with server
`created_at` and adds to that day's row (plan 10 § "Daily totals are filled at write time").
So between runs, only entities with a daily row on today or yesterday can have a changed
all-time total. The modes use that.

- **Recent** (default, hourly):
  1. For every entity with a daily row in the month window: upsert `day_count`, `week_count`,
     `month_count` from the window sums (zero when the entity has no rows in a shorter window).
  1. Recompute `all_time_count` as the full per-entity sum, but only for entities that have a
     daily row in `[today − 1, today]`, or whose popularity row was just inserted, or whose stored
     `all_time_count` is below its new `month_count`. Other entities keep their stored all-time
     total, which nothing could have changed.
  1. Zero `day_count`, `week_count`, and `month_count` on popularity rows where any of them is
     non-zero and the entity has no daily row in the month window. `all_time_count` stays.
- **Full** (`-full`, nightly): recompute all four counts for every entity with any daily row in
  one grouped pass per type, and set all four to zero on popularity rows whose entity has no daily
  rows at all. This catches what recent mode cannot see: a run gap longer than a day, and daily
  rows that channel merge moved onto a survivor's past days.

The SQL shape (CTEs, one statement or several inside the transaction) is the implementer's
choice. Use the `(day, <type>_id) INCLUDE (listener_count)` index for window sums and the
`(<type>_id, day)` primary key for per-entity all-time sums. Table and column names come only from
the fixed map below, never from input.

## `packages/orm/src/services/stats/statsEntityTables.ts`

The one map from entity type to table names, shared with plan 43's dev seeder.

```typescript
export const STATS_ENTITY_TABLES = {
  channel: { key: 'channel_id', daily: 'stats_daily_channel', popularity: 'stats_popularity_channel', hasCompletions: true },
  item: { key: 'item_id', daily: 'stats_daily_item', popularity: 'stats_popularity_item', hasCompletions: true },
  clip: { key: 'clip_id', daily: 'stats_daily_clip', popularity: 'stats_popularity_clip', hasCompletions: true },
  playlist: { key: 'playlist_id', daily: 'stats_daily_playlist', popularity: 'stats_popularity_playlist', hasCompletions: false },
  account: { key: 'account_id', daily: 'stats_daily_account', popularity: 'stats_popularity_account', hasCompletions: false },
} as const;

export type StatsEntityType = keyof typeof STATS_ENTITY_TABLES;
export const STATS_ENTITY_TYPES: readonly StatsEntityType[] = ['channel', 'item', 'clip', 'playlist', 'account'];
```

Not exported from `@podverse/orm`; only stats services import it.

## `packages/orm/src/services/stats/statsPopularityRefresh.ts`

```typescript
export type StatsPopularityRefreshMode = 'recent' | 'full';

export type StatsPopularityRefreshTypeResult = {
  entityType: StatsEntityType;
  rowsWritten: number;
  rowsZeroed: number;
};

/** Rebuilds range totals from daily totals for every entity type; `today` is the UTC date `YYYY-MM-DD` the windows end on. */
export async function refreshStatsPopularity(input: {
  today: string;
  mode: StatsPopularityRefreshMode;
}): Promise<StatsPopularityRefreshTypeResult[]>;
```

- Validate `today` against `/^\d{4}-\d{2}-\d{2}$/` and throw on anything else.
- Run the types in `STATS_ENTITY_TYPES` order, each in its own
  `AppDataSourceReadWrite.transaction`, so a slow item pass never holds the channel lock.
- Count affected rows with the row-count narrowing already used in
  `packages/orm/src/services/accountContentLog.ts` (`statementRowCount`); copy that small guard
  into this file rather than exporting it from there.
- Export `refreshStatsPopularity` and the two types from `packages/orm/src/index.ts`.
- File doc comment: range totals derived from daily totals; recent versus full; see
  `docs/features/POPULARITY-TRACKING.md`.

## `apps/workers/src/commands/stats/statsPopularityRefresh.ts`

1. `mode = 'full' in args ? 'full' : 'recent'`; `today = getUtcDateString(new Date())` from
   `@workers/lib/stats/statsUtcDates.js` (plan 41).
1. Log start: `statsPopularityRefresh starting mode=<mode> today=<today>`.
1. `await refreshStatsPopularity({ today, mode })`; log one line per type:
   `statsPopularityRefresh <type> rows_written=<n> rows_zeroed=<n>`, then the total duration with
   `getTimerManager()` as the deleted command did.
1. Errors propagate.

## Removing the old commands

- Delete `statsUpdateAggregated.ts` and `statsUpdateAggregatedRolling.ts`.
- `apps/workers/src/commands/index.ts`: drop their imports and entries; add
  `statsPopularityRefresh`.
- `packages/worker-commands/src/registry.ts`: replace the two entries with:

```typescript
  {
    name: 'statsPopularityRefresh',
    label: 'Stats: refresh popularity range totals',
    description:
      'Rebuild day, week, month, and all-time popularity totals from daily totals. Hourly runs cover entities active in the last 30 days; -full recomputes every entity.',
    category: 'stats',
    risk: 'normal',
    example_cli: 'npm run stats_popularity_refresh -w apps/workers -- -full',
  },
```

- `apps/workers/src/lib/startup/categoriesForCommand.ts`: remove the two names from
  `BASE_ORM_COMMANDS`, add `'statsPopularityRefresh'`.
- `apps/workers/package.json`: remove `stats_update_aggregated` and
  `stats_update_aggregated_rolling`; add
  `"stats_popularity_refresh": "node ./dist/index.js statsPopularityRefresh"`.
- `apps/workers/src/lib/startup/validation.ts`: the `@param commandName` example names
  `statsPopularityRefresh` instead of `statsUpdateAggregated`.
- `longRunningCommands.test.ts` and `oneShotProcessExit.test.ts` use `'statsUpdateAggregated'` as
  a sample one-shot name; change it to `'statsPopularityRefresh'`.
- After the edits, search `apps/workers`, `packages/worker-commands`, root `package.json`, and
  `docs/` for `statsUpdateAggregated` and `stats_update_aggregated`; fix every hit outside
  `.llm/`.

## CronJobs

Both copy `worker-account-content-log-purge.cronjob.yaml`, changing only the name, schedule, and
command arguments:

| File | `metadata.name` | `schedule` | command args after `apps/workers/dist/index.js` |
| --- | --- | --- | --- |
| `worker-stats-popularity-refresh.cronjob.yaml` | `worker-stats-popularity-refresh` | `"5 * * * *"` | `"statsPopularityRefresh"` |
| `worker-stats-popularity-refresh-full.cronjob.yaml` | `worker-stats-popularity-refresh-full` | `"45 0 * * *"` | `"statsPopularityRefresh"`, `"-full"` |

Add both to `infra/k8s/base/cron/kustomization.yaml` after plan 41's
`worker-stats-event-partitions.cronjob.yaml`. `concurrencyPolicy: Forbid` stops a CronJob from
overlapping itself; the per-type advisory lock serializes the hourly and nightly CronJobs when
they meet at 00:05–00:45. Alpha inherits both through its `base/cron` ref.

## Docs

- `apps/workers/ENV.md`: in the "Base + ORM only" list, replace `statsUpdateAggregated` with
  `statsPopularityRefresh` (re-pad the table).
- `apps/workers/APPS-WORKERS.md`: replace the `stats_update_aggregated` commands-table row with
  `npm run stats_popularity_refresh` — "Rebuild popularity range totals (`-full` for every
  entity)"; in "Scheduled Jobs" replace the `stats_update_aggregated` bullet with
  `stats_popularity_refresh`; in the K8s cron paragraph add `worker-stats-popularity-refresh`
  (hourly at :05) and `worker-stats-popularity-refresh-full` (`-full`, daily at 00:45). Line 207
  names `stats_update_aggregated` as the example ORM-only cron job; use `stats_popularity_refresh`.
- `docs/features/POPULARITY-TRACKING.md`, section "Jobs and schedules": a "Range totals"
  subsection with the two modes, why recent mode's all-time totals stay exact, what the nightly
  run catches, the CronJob names and schedules, and the manual command. Locally nothing is
  scheduled; `npm run stats_popularity_refresh -w apps/workers` refreshes on demand.

## Tests

- `apps/workers/src/commands/stats/statsPopularityRefresh.test.ts` (mock `@podverse/orm`, fake
  timers at `2026-10-21T00:30:00Z`): default args call `refreshStatsPopularity` with
  `{ today: '2026-10-21', mode: 'recent' }`; `{ full: '' }` passes `mode: 'full'`; a rejection
  propagates.
- `apps/workers/src/lib/startup/categoriesForCommand.test.ts`: a case mapping
  `statsPopularityRefresh` to Base and ORM.
- `apps/api/src/test/stats-popularity-refresh.integration.test.ts` (DB-backed, `startTestApp`,
  `vi.mock('@podverse/orm')` header as in `archived-slimming.integration.test.ts`). Create the
  channels, items, and a playlist the test needs (or use seeded ids from the API test helpers),
  insert `stats_daily_*` rows in 2001, and call `refreshStatsPopularity` with `today` in 2001.
  Assert only on the test's own entities. Cases:
  1. Daily rows on 2001-06-30 (5), 06-29 (3), 06-25 (2), 06-05 (7), and 2001-01-10 (11) with
     `today = '2001-06-30'`, recent mode: `day_count` 8, `week_count` 10, `month_count` 17,
     `all_time_count` 28.
  1. Moving `today` to `'2001-07-31'`, recent mode: day, week, and month are all 0, and
     `all_time_count` stays 28.
  1. An entity whose only rows are older than the month window and that has no popularity row
     gets no row from recent mode, and gets `all_time_count` equal to its sum from full mode.
  1. Recent mode leaves a stored `all_time_count` alone for an entity with rows in the month
     window but none on today or yesterday (set it by hand to 999, above its true sum, first),
     and full mode corrects it.
  1. A second identical run reports `rowsWritten` 0 for the type.
  1. Full mode sets all four counts to 0 on a popularity row whose entity has no daily rows.
  1. The playlist and account types work the same (one window case each).
  - Delete the test's rows in `afterAll`. The real-date data in a shared test database is not
    asserted on; recent mode with a 2001 `today` may zero window counts on other rows, which is
    harmless there.

## Release scratchpad

```markdown
## Popularity rankings refresh hourly from daily totals

- Surfaces: workers, k8s base cron
- Change: new worker command `statsPopularityRefresh` rebuilds day, week, month, and all-time
  popularity totals from the anonymous daily totals for every channel, item, clip, playlist, and
  profile. CronJob `worker-stats-popularity-refresh` runs it hourly at :05 for entities active in
  the last 30 days; `worker-stats-popularity-refresh-full` runs `-full` daily at 00:45 for every
  entity. The unscheduled `statsUpdateAggregated` and `statsUpdateAggregatedRolling` commands and
  their npm scripts are removed.
- Who notices: listeners see Top and trending sorts move within an hour of new listens; operators
- Operator steps: none beyond letting the CronJobs deploy; alpha picks them up when its
  `base/cron` ref moves. Run `statsPopularityRefresh -full` by hand to refresh at once.
```
