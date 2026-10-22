**Cursor model:** Opus 5.5 · **Reasoning:** high

# 41 — Event partition job: create months ahead, drop expired months

A daily worker command and CronJob that keep the monthly partitions of `stats_listen_event` and
`stats_open_event` (plan 10) in shape: it creates the current month and the next two ahead, then
drops every month whose rows are all older than the retention setting. Retention removes whole
partitions, never row by row (R23); the window is `STATS_TRACK_EVENT_RETENTION_DAYS`, 90 by
default (R40, plan 40). Scheduling it is part of R31.

This job deletes listener data on a schedule. The one property that must hold: **a partition is
dropped only when every row it can hold is older than the retention window.** The explanation
copy (plan 20) promises exactly this: "Listen records are kept for {retention_days} days. We then
delete a whole month of records at once, so a record can remain until its month is removed."

## Rows

R23, R31, R40

## Runs after

10, 40

## Files

- `apps/workers/src/lib/stats/statsUtcDates.ts` (new)
- `apps/workers/src/lib/stats/statsUtcDates.test.ts` (new)
- `packages/orm/src/services/stats/statsEventPartitions.ts` (new)
- `packages/orm/src/index.ts`
- `apps/workers/src/commands/stats/statsEventPartitionsMaintain.ts` (new)
- `apps/workers/src/commands/stats/statsEventPartitionsMaintain.test.ts` (new)
- `apps/workers/src/commands/index.ts`
- `packages/worker-commands/src/registry.ts`
- `apps/workers/src/lib/startup/categoriesForCommand.ts`
- `apps/workers/src/lib/startup/categoriesForCommand.test.ts`
- `apps/workers/package.json`
- `infra/k8s/base/cron/worker-stats-event-partitions.cronjob.yaml` (new)
- `infra/k8s/base/cron/kustomization.yaml`
- `apps/workers/ENV.md`
- `apps/workers/APPS-WORKERS.md`
- `docs/features/POPULARITY-TRACKING.md`
- `apps/api/src/test/stats-event-partitions.integration.test.ts` (new)

## Retention math (decided)

All dates are UTC calendar dates, matching the partition bounds plan 10's functions build.

- **Cutoff** = the first day of the UTC month that contains `now − retentionDays`, where the
  subtraction is `subtractDays` from `@podverse/helpers` (absolute 24-hour days).
- The job calls `stats_event_drop_month_partitions_before(parent, cutoff)`. That function drops
  only partitions whose upper bound is on or before `cutoff` and deletes default-partition rows
  with `created_at < cutoff`.
- Why it is safe: a dropped partition's rows all have `created_at < upper bound ≤ cutoff ≤ now −
  retentionDays`, so every removed row is older than the window. A row lives at least
  `retentionDays` and at most about `retentionDays + 31` days, plus up to a day until the next run.
  With 90 days that is 90 to about 122 days.
- Whole months only. The job never deletes rows from a dated partition that reaches past the
  cutoff.

Worked example: run at `2026-10-21T03:30Z` with 90 days. `now − 90 days` is `2026-07-23`, so the
cutoff is `2026-07-01`. June 2026 and earlier are dropped; July stays until the run on or after
`2026-10-30`, when `now − 90 days` reaches August and the cutoff becomes `2026-08-01`.

**Months ahead:** each run ensures the current UTC month and the next 2. Partitions then exist
about two months before any row needs them, so a CronJob outage of weeks still routes rows to
dated partitions. If rows ever land in the default partition, plan 10's ensure function moves
them into the new month.

## `apps/workers/src/lib/stats/statsUtcDates.ts`

Pure functions, no I/O. Plan 42 and plan 43 reuse `getUtcDateString`.

```typescript
/** `YYYY-MM-DD` for the UTC calendar day containing `instant`. */
export function getUtcDateString(instant: Date): string;

/** `YYYY-MM-01` for the UTC month containing `instant`. */
export function getUtcMonthStart(instant: Date): string;

/** The UTC month containing `now` and the `monthsAhead` months after it, as `YYYY-MM-01`. */
export function getStatsEventPartitionMonthStarts(now: Date, monthsAhead: number): string[];

/** First day of the UTC month containing `now − retentionDays`; partitions ending on or before it hold only expired rows. */
export function getStatsEventRetentionCutoff(now: Date, retentionDays: number): string;
```

Build strings from `getUTCFullYear` / `getUTCMonth` / `getUTCDate` with zero padding; step months
with `Date.UTC(year, month + i, 1)` so December rolls into January. Export
`STATS_EVENT_PARTITION_MONTHS_AHEAD = 2` from this file.

## `packages/orm/src/services/stats/statsEventPartitions.ts`

Thin wrappers over plan 10's SQL functions. Read-write data source. This file never names the
listener mapping (plan 12's guard scans it).

```typescript
export const STATS_EVENT_PARENT_TABLES = ['stats_listen_event', 'stats_open_event'] as const;
export type StatsEventParentTable = (typeof STATS_EVENT_PARENT_TABLES)[number];

/** Creates the month partition when missing; true when it created one. */
export async function ensureStatsEventMonthPartition(parentTable: StatsEventParentTable, monthStart: string): Promise<boolean>;

/** Drops month partitions that end on or before `cutoff`; returns how many it dropped. */
export async function dropStatsEventMonthPartitionsBefore(parentTable: StatsEventParentTable, cutoff: string): Promise<number>;
```

- SQL: `SELECT public.stats_event_ensure_month_partition($1, $2::date) AS created` and
  `SELECT public.stats_event_drop_month_partitions_before($1, $2::date) AS dropped`, through
  `AppDataSourceReadWrite.manager.query`.
- Narrow the result rows with a type guard (`Array.isArray`, then `Reflect.get(row, 'created')`
  is a boolean / `dropped` is a number or numeric string). Throw
  `new Error('stats event partitions: unexpected function result')` otherwise. No `as`.
- Export the file from `packages/orm/src/index.ts`, next to the other `./services/stats/` exports.

## `apps/workers/src/commands/stats/statsEventPartitionsMaintain.ts`

Pattern: `apps/workers/src/commands/orm/accountContentLog/purge.ts` (`getLogger`, config getter,
one start and one completion log line).

1. `now = new Date()`; `retentionDays` from `getStatsConfig().trackEventRetentionDays`.
1. Ensure first, so a failed drop never leaves next month without a partition: for each parent in
   `STATS_EVENT_PARENT_TABLES`, for each month from
   `getStatsEventPartitionMonthStarts(now, STATS_EVENT_PARTITION_MONTHS_AHEAD)`, call
   `ensureStatsEventMonthPartition`; count the `true` results per parent.
1. `cutoff = getStatsEventRetentionCutoff(now, retentionDays)`; for each parent, call
   `dropStatsEventMonthPartitionsBefore(parent, cutoff)`.
1. Log at start: `statsEventPartitionsMaintain starting retention_days=<n> cutoff=<cutoff> months=<first..last>`.
   At the end, one line per parent: `statsEventPartitionsMaintain <parent> partitions_created=<n> partitions_dropped=<n>`.
1. Errors propagate; the one-shot exit path already turns a throw into a non-zero exit.

Doc comment on the export, two sentences: it keeps monthly event partitions ahead of time and drops
months whose rows are all older than `STATS_TRACK_EVENT_RETENTION_DAYS`; see
`docs/features/POPULARITY-TRACKING.md`.

## Registration

- `apps/workers/src/commands/index.ts`: import beside the other `@workers/commands/stats/` imports
  and add `statsEventPartitionsMaintain` to the default export object next to the stats entries.
- `packages/worker-commands/src/registry.ts`: add after the existing stats entries:

```typescript
  {
    name: 'statsEventPartitionsMaintain',
    label: 'Stats: maintain listen event partitions',
    description:
      'Create monthly partitions for popularity listen and open events two months ahead, then drop months whose rows are all older than STATS_TRACK_EVENT_RETENTION_DAYS.',
    category: 'stats',
    risk: 'normal',
    example_cli: 'npm run stats_event_partitions_maintain -w apps/workers',
  },
```

- `apps/workers/src/lib/startup/categoriesForCommand.ts`: add `'statsEventPartitionsMaintain'` to
  `BASE_ORM_COMMANDS`.
- `apps/workers/package.json`: `"stats_event_partitions_maintain": "node ./dist/index.js statsEventPartitionsMaintain"`,
  placed with the other `stats_*` scripts.

## CronJob — `infra/k8s/base/cron/worker-stats-event-partitions.cronjob.yaml`

Copy `worker-account-content-log-purge.cronjob.yaml` exactly, changing only:

- `metadata.name: worker-stats-event-partitions`
- `schedule: "30 3 * * *"` (daily, 03:30)
- command argument `"statsEventPartitionsMaintain"`

Add the file to `infra/k8s/base/cron/kustomization.yaml` after
`worker-account-content-log-purge.cronjob.yaml`.

The alpha GitOps repo's `cron/kustomization.yaml` pulls `infra/k8s/base/cron` by git ref, so alpha
gets this CronJob when its ref moves; it needs no alpha-only file.

## Docs

- `apps/workers/ENV.md`: add `statsEventPartitionsMaintain` to the "Base + ORM only" command list
  (re-pad the table).
- `apps/workers/APPS-WORKERS.md`: a commands-table row
  `npm run stats_event_partitions_maintain` — "Create popularity event partitions ahead and drop
  expired months", and in the K8s cron paragraph add
  `worker-stats-event-partitions` (`statsEventPartitionsMaintain`, daily at 03:30).
- `docs/features/POPULARITY-TRACKING.md`, section "Jobs and schedules" (plan 10 creates the
  heading): a "Partitions and retention" subsection stating the cutoff rule, the worked example,
  the two-months-ahead rule, the CronJob name and schedule, the manual command, and that locally
  nothing runs on a schedule, so events stay in the default partition unless the command is run.
  Plan 42 adds the refresh subsection to the same section.

## Tests

- `apps/workers/src/lib/stats/statsUtcDates.test.ts`:
  - `getStatsEventRetentionCutoff(new Date('2026-10-21T03:30:00Z'), 90)` is `'2026-07-01'`.
  - Month edge: `new Date('2026-03-01T00:30:00Z')` with 90 is `'2025-12-01'`.
  - Short window: `new Date('2026-10-15T12:00:00Z')` with 1 is `'2026-10-01'`.
  - Invariant sweep: for every day of 2026 at 00:00 and 23:59 UTC and retention values 1, 30, 31,
    90, 365, the cutoff is a first-of-month string and `Date.parse(cutoff + 'T00:00:00Z')` is at
    most `subtractDays(now, retention).getTime()`.
  - `getStatsEventPartitionMonthStarts(new Date('2026-11-30T23:59:00Z'), 2)` is
    `['2026-11-01', '2026-12-01', '2027-01-01']`.
  - UTC, not local: `new Date('2026-10-31T23:30:00-05:00')` gives month start `'2026-11-01'` and
    date string `'2026-11-01'`.
- `apps/workers/src/commands/stats/statsEventPartitionsMaintain.test.ts` (pattern: `purge.test.ts`,
  `vi.mock('@podverse/orm')`, fake timers at `2026-10-21T03:30:00Z`):
  - With no env value: ensure is called for both parents with `2026-10-01`, `2026-11-01`,
    `2026-12-01` (six calls), then drop is called for both parents with `2026-07-01`.
  - Every ensure call happens before the first drop call.
  - `STATS_TRACK_EVENT_RETENTION_DAYS=30` gives cutoff `2026-09-01`.
  - A rejected ensure makes the command reject and no drop runs.
- `apps/workers/src/lib/startup/categoriesForCommand.test.ts`: one case mapping
  `statsEventPartitionsMaintain` to Base and ORM, in the style of the `accountContentLogPurge`
  case.
- `apps/api/src/test/stats-event-partitions.integration.test.ts` (DB-backed, `startTestApp` /
  `stopTestApp`, same `vi.mock('@podverse/orm')` header as `archived-slimming.integration.test.ts`):
  calls the ORM wrappers, not raw SQL, so a typo in their SQL fails here.
  - `ensureStatsEventMonthPartition('stats_open_event', '2002-01-01')` returns true, then false;
    `to_regclass('public.stats_open_event_p200201')` is not null.
  - `dropStatsEventMonthPartitionsBefore('stats_open_event', '2002-02-01')` returns 1 and the
    partition is gone.
  - Use 2002 so plan 10's 2001 test partitions are never touched; drop anything left in
    `afterAll`.

## Release scratchpad

```markdown
## Popularity listen events are partitioned by month and expire a month at a time

- Surfaces: workers, k8s base cron
- Change: new worker command `statsEventPartitionsMaintain` and daily CronJob
  `worker-stats-event-partitions` (03:30). It creates monthly partitions for popularity listen and
  open events two months ahead, then drops each month once every row in it is older than
  `STATS_TRACK_EVENT_RETENTION_DAYS` (90 days by default, so rows stay 90 to about 122 days).
  Retention never deletes rows one by one from a dated month.
- Who notices: operators; listeners only through the retention promise in the explanation
- Operator steps: after the migration runs on a deployment, start the job once by hand
  (`kubectl -n <namespace> create job --from=cronjob/worker-stats-event-partitions worker-stats-event-partitions-manual`)
  so dated partitions exist before the first listens arrive. Alpha picks up the CronJob when its
  `base/cron` ref moves.
```
