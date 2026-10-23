**Cursor model:** Opus 5.5 · **Reasoning:** high

# 40 — All-time totals count a listener once per entity per N days

An entity's all-time total counts one listener at most once every `STATS_ALL_TIME_RECOUNT_DAYS`
(default 90; the API refuses to start when it is above the event retention). Plan 14 introduces
that key as the length of the popularity cooldown after an opt-out; this plan reuses it as the
all-time recount period, so one setting drives both. The write path decides this when it stores a
popularity-counted listen or open, marks the event, and adds the count to a new daily column,
`all_time_listener_count`. Daily rows outlive events, so all-time history survives retention.
Plan 41 makes the refresh job sum that column instead of `listener_count`.

## Rows

R15, R16, R22, R24

R16 is split: this plan covers the all-time half for opens; plan 41 covers day, week, and month
for opens. Plan 14 owns R24; this plan covers its all-time part (marks across an opt-out).

## Runs after

14, 30

Plan 14 already adds `POPULARITY_DEFAULT_ALL_TIME_RECOUNT_DAYS`,
`config.popularityTracking.allTimeRecountDays` (minimum 1, no clamp), the `all_time_recount_days`
field on `StatsListenReport` and `StatsOpenReport` (both controllers pass it), the
`STATS_ALL_TIME_RECOUNT_DAYS` lines in `apps/api/.env.example`, `infra/k8s/base/api/source/api.env`,
`dev/env-overrides/local/rate-limit.env.example`, and `scripts/local-env/setup.sh`, its
`validateOptional` line, its `apps/api/ENV.md` bullet, and, in the listen-write test, the
`ALL_TIME_RECOUNT_DAYS` constant, `ListenInput.allTimeRecountDays`, the `open` helper passing it,
and the `setOptedOutAt` helper. This plan adds none of those again; it extends their comments with
the all-time meaning and adds the startup check below.

## What the code does today, and the rule

- `refreshStatsPopularity` sets `all_time_count` to `SUM(listener_count)` over every daily row.
  A daily row counts each listener once per UTC day, so a listener who plays a show on two days
  adds 2 to its all-time total. The request's "counted twice … in 2 days" is right for every
  range except Day.
- **The rule.** A popularity-counted listen counts toward an entity's all-time total when the
  listener has no listen of that entity marked as counted toward all-time in the last N days.
  A counted mark therefore starts an N-day period in which that listener adds nothing more to the
  entity's all-time total. The first listen after the period ends counts again and starts a new
  period. A listener who plays a show every week adds 1 every N days, not 1 ever.
- The same rule applies, per entity, to the item, the channel, and (clip listens) the clip of a
  listen, and to the profile or playlist of an open.
- Only popularity-counted events can be marked: listens past the popularity cap (plan 11),
  everything a flagged listener stores (plan 30), and listens stored during plan 14's opt-out
  cooldown (`popularity_counted = false`) are never marked and add nothing. Opens during the
  cooldown return before this plan's open code and store nothing.
- Why the mark lives on the event: "counted again after N days" needs to know when the last
  counted listen was, not only the last listen. The API refuses to start when N is above the
  event retention, and rows live at least the retention, so the last counted mark inside the
  window is always still stored.
- **Opt-out.** An opt-out deletes the listener's events, and their marks with them (plan 14). The
  listener still cannot add to any all-time total early: plan 14's cooldown lasts N days from the
  opt-out, and no listen in it is popularity-counted. Every deleted mark is at or before the
  opt-out, so every period it started has ended by the time the cooldown does. The first
  popularity-counted listen after the cooldown is one the rule would have counted anyway. This
  holds only because both use `report.all_time_recount_days`; do not give the period its own
  setting.

## Schema

New linear migration, provisionally
`infra/k8s/base/ops/source/database/linear-migrations/app/0030_stats_all_time_recount.sql`
(plan 11 has `0027_`, plan 14 has `0028_`, plan 30 has `0029_`; Close may renumber; use the number
the COPY-PASTA prompt names if it differs):

```sql
-- True when this listen started the listener's N-day all-time period for that entity
-- (STATS_ALL_TIME_RECOUNT_DAYS): the item, the channel, or the clip.
ALTER TABLE public.stats_listen_event
    ADD COLUMN item_all_time_counted boolean DEFAULT false NOT NULL,
    ADD COLUMN channel_all_time_counted boolean DEFAULT false NOT NULL,
    ADD COLUMN clip_all_time_counted boolean DEFAULT false NOT NULL;

-- True when this open started the opener's N-day all-time period for the profile or playlist.
ALTER TABLE public.stats_open_event
    ADD COLUMN all_time_counted boolean DEFAULT false NOT NULL;

-- Listeners who added to the entity's all-time total on this day. Range totals sum this column
-- for all_time_count. Rows already stored counted every listener of their day.
ALTER TABLE public.stats_daily_channel ADD COLUMN all_time_listener_count integer DEFAULT 0 NOT NULL;
ALTER TABLE public.stats_daily_item ADD COLUMN all_time_listener_count integer DEFAULT 0 NOT NULL;
ALTER TABLE public.stats_daily_clip ADD COLUMN all_time_listener_count integer DEFAULT 0 NOT NULL;
ALTER TABLE public.stats_daily_playlist ADD COLUMN all_time_listener_count integer DEFAULT 0 NOT NULL;
ALTER TABLE public.stats_daily_account ADD COLUMN all_time_listener_count integer DEFAULT 0 NOT NULL;

UPDATE public.stats_daily_channel SET all_time_listener_count = listener_count WHERE listener_count <> 0;
UPDATE public.stats_daily_item SET all_time_listener_count = listener_count WHERE listener_count <> 0;
UPDATE public.stats_daily_clip SET all_time_listener_count = listener_count WHERE listener_count <> 0;
UPDATE public.stats_daily_playlist SET all_time_listener_count = listener_count WHERE listener_count <> 0;
UPDATE public.stats_daily_account SET all_time_listener_count = listener_count WHERE listener_count <> 0;

ALTER TABLE public.stats_daily_channel ADD CONSTRAINT stats_daily_channel_all_time_check
    CHECK (all_time_listener_count >= 0 AND all_time_listener_count <= listener_count);
ALTER TABLE public.stats_daily_item ADD CONSTRAINT stats_daily_item_all_time_check
    CHECK (all_time_listener_count >= 0 AND all_time_listener_count <= listener_count);
ALTER TABLE public.stats_daily_clip ADD CONSTRAINT stats_daily_clip_all_time_check
    CHECK (all_time_listener_count >= 0 AND all_time_listener_count <= listener_count);
ALTER TABLE public.stats_daily_playlist ADD CONSTRAINT stats_daily_playlist_all_time_check
    CHECK (all_time_listener_count >= 0 AND all_time_listener_count <= listener_count);
ALTER TABLE public.stats_daily_account ADD CONSTRAINT stats_daily_account_all_time_check
    CHECK (all_time_listener_count >= 0 AND all_time_listener_count <= listener_count);
```

Notes for the implementer:

- The daily backfill keeps every stored all-time total exactly where it is: before this change,
  all-time was the sum of `listener_count`. On an empty database it changes nothing.
- Stored events are not backfilled. Their marks stay false, so in the first N days after this
  ships a listener can add 1 more to an entity's all-time total than the rule allows. That
  happens once per listener and entity. Backfilling would mean replaying the rule over every
  stored event in a migration.
- Why `all_time_listener_count <= listener_count` always holds: N is at least one day, so one
  listener adds at most 1 to an entity's all-time total in a UTC day. Any listen that adds 1 is
  popularity-counted, so that listener is also in the day's `listener_count`.
- Adding a column with a constant default to a partitioned parent reaches every partition and
  rewrites nothing. No index: the write path reads these columns through
  `stats_listen_event_listener_created_idx` / `stats_open_event_listener_created_idx`.
- Existing grants cover new columns.
- Follow **linear-sql-greenfield-only** and **migration-readiness-marker-sync**: set
  `API_EXPECTED_MIGRATION_FILENAME` in `infra/k8s/base/api/source/api.env` and in the
  `podverse-ops-migration-scripts` literals of `infra/k8s/base/ops/kustomization.yaml`, list the
  file under `podverse-ops-app-linear-migrations` `files` there, then run
  `make db_regen_linear_baseline` and `make db_verify_linear_baseline` and leave the regenerated
  `infra/k8s/base/db/source/bootstrap/0004_app_linear_baseline.sql.gz` and
  `0005_management_linear_baseline.sql.gz` in the tree. If those targets cannot run (no Docker),
  stop and report BLOCKED.

## Entities

- `packages/orm/src/entities/stats/statsListenEvent.ts`: after plan 11's `popularity_counted`,
  add `item_all_time_counted`, `channel_all_time_counted`, `clip_all_time_counted`, each
  `@Column({ type: 'boolean', default: false })` with a one-line doc comment ("Started this
  listener's all-time period for the item." and so on).
- `packages/orm/src/entities/stats/statsOpenEvent.ts`: after plan 30's `popularity_counted`, add
  `all_time_counted` the same way.
- `statsDailyChannel.ts`, `statsDailyItem.ts`, `statsDailyClip.ts`, `statsDailyPlaylist.ts`,
  `statsDailyAccount.ts` in `packages/orm/src/entities/stats/`: add
  `@Column({ type: 'integer', default: 0 }) all_time_listener_count!: number;` after
  `listener_count` (after `completion_count` where it exists) with the doc comment "Listeners who
  added to the all-time total on this day; at most one per listener every
  `STATS_ALL_TIME_RECOUNT_DAYS`." Leave the class doc comments.

## Shared constant

`packages/helpers/src/lib/popularityListen.ts`: plan 14 adds
`POPULARITY_DEFAULT_ALL_TIME_RECOUNT_DAYS = 90`. Do not add it again. Replace its doc comment
with:

```typescript
/**
 * Days in which one listener adds to an entity's all-time total at most once, and the length of
 * the popularity cooldown after an opt-out, unless `STATS_ALL_TIME_RECOUNT_DAYS` sets another
 * value. The API refuses to start when it is above the event retention.
 */
```

## Listen write path

`packages/orm/src/services/stats/listenerIdentity/statsListenWrite.ts`, as plans 10, 11, 14, and
30 leave it:

- `StatsListenReport.all_time_recount_days` exists from plan 14. Extend its doc comment: "Also the
  number of days in which one listener adds to an entity's all-time total at most once."
- New SQL constant after `LISTENER_DAY_SQL`:

  ```typescript
  const ALL_TIME_PERIOD_SQL = `SELECT
      COALESCE(bool_or(item_all_time_counted AND item_id = $3), false) AS item_counted,
      COALESCE(bool_or(channel_all_time_counted AND channel_id = $4), false) AS channel_counted,
      COALESCE(bool_or(clip_all_time_counted AND clip_id = $5), false) AS clip_counted
    FROM stats_listen_event
    WHERE listener_id = $1 AND created_at >= $2`;
  ```

- New function with a doc comment ("Per entity, whether the listener has a listen marked as counted
  toward all-time since `since`. A listen of an entity without one starts a new all-time period
  for it."):

  ```typescript
  async function readAllTimePeriods(
    manager: EntityManager,
    listenerId: string,
    since: Date,
    entities: ListenEntities
  ): Promise<EntityFlags>
  ```

  Same parsing style as `readListenerDay` (`row?.item_counted === true`, and so on).
- `INSERT_LISTEN_EVENT_SQL` also writes `item_all_time_counted`, `channel_all_time_counted`, and
  `clip_all_time_counted` as the next three parameters after plan 11's `popularity_counted`.
- `addToDailyRow` takes `{ listeners, completions, allTimeListeners }` (a named object, since three
  bare numbers in a row are easy to swap) and:
  - returns when all three are 0;
  - when `listeners === 0`, runs one update and leaves a missing row alone:
    `UPDATE ${table} SET completion_count = completion_count + $3, all_time_listener_count = all_time_listener_count + $4 WHERE ${column} = $1 AND day = $2::date`.
    This replaces the `addCompletionToDailyRow` loop in that branch. The row always exists here:
    a listener with `listeners === 0` already had a popularity-counted listen of this entity
    today, and that listen wrote the row;
  - otherwise upserts with `all_time_listener_count` in the column list, `VALUES ($1, $2::date, $3, $4, $5)`,
    and `all_time_listener_count = ${table}.all_time_listener_count + EXCLUDED.all_time_listener_count`
    in the `DO UPDATE`.
  `addCompletionToDailyRow` stays for `addCompletionOfStoredListen`.
- In `recordListen`, where plan 11 inserts the event. `popularityCounted` here is plan 14's and
  plan 30's value (`!flagged && !coolingDown && listenerDay.popularityCount < …`), so a listen
  stored during the opt-out cooldown never reads periods and never sets a mark:
  1. When `popularityCounted`, before the insert:
     `const periods = await readAllTimePeriods(manager, listenerId, subtractDays(now, report.all_time_recount_days), target);`
     then `allTime[entity] = !periods[entity]` for each entity in `entityIds(target)`. The clip
     flag is false when `target.clipId` is null. When not `popularityCounted`, every flag is
     false and the query does not run.
  1. Insert the event with the three flags.
  1. The daily-row loop (which plan 11 runs only when `popularityCounted`) passes
     `allTimeListeners: allTime[entity] ? 1 : 0` next to the existing listener and completion
     counts.
  1. Run the read before the insert, so it never sees the new event. It takes no row lock, so the
     write order (event, item daily row, channel daily row, clip daily row, taste rows) does not
     change.
- `updateSessionEvent` and `addCompletionOfStoredListen` do not change: a completion never adds to
  an all-time total.
- Do not skip the period read when the entity was already listened to today: an earlier listen
  today may have been inside the last period, while this one is the first after it ends.
- Class doc comment: add one sentence: a popularity-counted listen adds to an entity's all-time
  total when it starts a new N-day period for the listener.

## Open write path

`packages/orm/src/services/stats/listenerIdentity/statsOpenWrite.ts`, as plans 12, 14, and 30
leave it:

- `StatsOpenReport.all_time_recount_days` exists from plan 14. Extend its doc comment: "Also the
  number of days in which one opener adds to a profile's or playlist's all-time total at most
  once."
- Plan 14's cooldown return (`counted`, before the listener lookup) runs before everything below,
  so a cooldown open never reaches the period read.
- After plan 12's `unchanged` and `daily_cap_reached` returns, and before the insert:

  ```typescript
  let allTimeCounted = false;
  if (!flagged) {
    const [period] = await queryRows(
      manager,
      `SELECT 1 AS counted
         FROM stats_open_event
        WHERE listener_id = $1 AND ${column} = $2 AND all_time_counted AND created_at >= $3
        LIMIT 1`,
      [listenerId, opened.id, subtractDays(now, report.all_time_recount_days)]
    );
    allTimeCounted = period === undefined;
  }
  ```

  Import `subtractDays` from `@podverse/helpers`.
- The insert also writes `all_time_counted` as `$5`.
- The daily upsert (which plan 30 runs only when `!flagged`) writes
  `(${column}, day, listener_count, all_time_listener_count) VALUES ($1, $2::date, 1, $3)` and adds
  `all_time_listener_count = ${dailyTable}.all_time_listener_count + EXCLUDED.all_time_listener_count`.
- Class doc comment: a counted open adds to the profile's or playlist's all-time total when it
  starts a new N-day period for the opener.

## Channel merge

`packages/orm/src/services/channel/applyChannelMerge.ts`, `moveDailyTotals` and
`mergedDailyCounts`:

- Read `all_time_listener_count` from each old and survivor row with `asNumber`.
- Moving an old row to a day the survivor lacks: `journaledInsert` also writes
  `all_time_listener_count` from the old row.
- Adding into an existing survivor row: the merged value is
  `Math.min(old.allTimeListeners + survivor.allTimeListeners, listenerCount)`, where
  `listenerCount` is the merged `listener_count`. Give `mergedDailyCounts` old and survivor
  arguments of a new type `DailyCopyCounts = SameDayOverlap & { allTimeListeners: number }` (the
  shared overlap stays `SameDayOverlap`). The function returns
  `{ listener_count, completion_count, all_time_listener_count }`, and its doc comment adds the
  rule. The result is never below either copy: each copy's value is at most its own
  `listener_count`, and the merged `listener_count` is at least both.
- No overlap read for all-time: a listener who added to both copies' all-time totals in the same
  N days stays counted twice. Clamping to the merged `listener_count` removes the same-day case.
  Merges are rare, and reading each listener's periods across both copies is not worth it.
- Events carry their marks when they move, so the survivor's next periods start from the merged
  history.
- The journal stores whole row images, so revert restores the column with no other change.

## Config, startup check, env

The key, its config value, and the controllers' `all_time_recount_days` come from plan 14 and do
not change here. There is no clamp: a recount period above the event retention stops the API at
startup instead of being lowered.

- `apps/api/src/config/index.ts`: leave plan 14's
  `allTimeRecountDays: readWholeNumberEnv('STATS_ALL_TIME_RECOUNT_DAYS', POPULARITY_DEFAULT_ALL_TIME_RECOUNT_DAYS, 1)`
  as it is. Extend its `Config` doc comment: "Also the number of days in which one listener adds
  to an entity's all-time total at most once. Startup validation rejects a value above
  `STATS_TRACK_EVENT_RETENTION_DAYS`." Leave `terms.retentionDays` as it is.
- `apps/api/src/lib/startup/validation.ts`: new module-level function above
  `validateStartupRequirements`, next to `validateMetaboostAppAssertionPair`:

  ```typescript
  /**
   * The all-time recount period may not outlast event retention: the period is read from marks on
   * stored listen and open events, so a longer one would let a listener count again once the mark
   * that started it is deleted. Values resolve the way config and the legal loaders read them.
   */
  const validateAllTimeRecountWithinRetention = (): ValidationResult => {
    const resolve = (name: string, fallback: number): number => {
      const parsed = parseOptionalNonNegativeInt(process.env[name]);
      return parsed !== undefined && parsed >= 1 ? parsed : fallback;
    };
    const recountDays = resolve(
      'STATS_ALL_TIME_RECOUNT_DAYS',
      POPULARITY_DEFAULT_ALL_TIME_RECOUNT_DAYS
    );
    const retentionDays = resolve(
      'STATS_TRACK_EVENT_RETENTION_DAYS',
      DEFAULT_STATS_TRACK_EVENT_RETENTION_DAYS
    );
    const isValid = recountDays <= retentionDays;
    return {
      name: 'STATS_ALL_TIME_RECOUNT_DAYS',
      isSet: true,
      isValid,
      isRequired: false,
      message: isValid
        ? `${recountDays} days, within STATS_TRACK_EVENT_RETENTION_DAYS (${retentionDays})`
        : `STATS_ALL_TIME_RECOUNT_DAYS (${recountDays}) is greater than STATS_TRACK_EVENT_RETENTION_DAYS (${retentionDays}). Lower STATS_ALL_TIME_RECOUNT_DAYS, or raise STATS_TRACK_EVENT_RETENTION_DAYS on the API and the workers.`,
      category: 'Popularity Tracking',
    };
  };
  ```

  Import `DEFAULT_STATS_TRACK_EVENT_RETENTION_DAYS`, `parseOptionalNonNegativeInt`, and
  `POPULARITY_DEFAULT_ALL_TIME_RECOUNT_DAYS` from `@podverse/helpers` in the existing value
  import. Push it right after plan 14's
  `validateOptional('STATS_ALL_TIME_RECOUNT_DAYS', 'Popularity Tracking', 'Use Default (90)')`
  line: `results.push(validateAllTimeRecountWithinRetention());`. An invalid result makes
  `summary.failed` non-zero, so `validateStartupRequirements` logs the message above under
  `[Popularity Tracking]` (also in silent mode) and throws. Both values unset resolve to 90 and
  90, so the defaults pass; lowering only the retention below 90 fails until the recount period
  is lowered too.
- Comments on plan 14's env lines (**env-file-formatting**, **env-defaults-match-code**). Replace
  the comment above `STATS_ALL_TIME_RECOUNT_DAYS` with:
  - `apps/api/.env.example`:
    `# Optional. Days in which one listener adds to an entity's all-time popularity at most once, and days after an opt-out during which new listens count toward no popularity total. Must not be above STATS_TRACK_EVENT_RETENTION_DAYS, or the API does not start. Empty uses 90.`
  - `infra/k8s/base/api/source/api.env`: the same comment without "Optional.".
  - Leave `dev/env-overrides/local/rate-limit.env.example` and `scripts/local-env/setup.sh` as
    plan 14 leaves them.
- `apps/api/ENV.md`: extend plan 14's **`STATS_ALL_TIME_RECOUNT_DAYS`** bullet with: "It is also
  the all-time recount period: a listener adds to an entity's all-time popularity total at most
  once in this many days. The API does not start when it is greater than
  `STATS_TRACK_EVENT_RETENTION_DAYS`; nothing lowers it quietly." Rewrite the
  `STATS_TRACK_EVENT_RETENTION_DAYS` bullet (near line 168): the retention window goes into the
  terms document and must be at least `STATS_ALL_TIME_RECOUNT_DAYS`; set it to the same value as
  the workers' `STATS_TRACK_EVENT_RETENTION_DAYS`, which drops the events.

`apps/api/openapi.yml` needs no edit: no request field, result, or status changes.

## Docs

`docs/features/POPULARITY-AND-TASTE-PROFILE.md`:

- § Tables: add the three listen-event marks to the `stats_listen_event` bullet, `all_time_counted`
  to the `stats_open_event` bullet, and `all_time_listener_count` to the `stats_daily_*` bullet.
- § Daily Totals Are Filled at Write Time: new **All-time listeners** bullet after
  **Completions**, stating the rule from "What the code does today, and the rule" above: one read
  on `stats_listen_event_listener_created_idx` over the last N days, the marks on the event, and
  `all_time_listener_count + 1`. Listens stored during the opt-out cooldown are not
  popularity-counted, so they are never marked. Extend the **Opens** bullet the same way.
- Plan 14's § Popularity Cooldown After an Opt-Out: add that an opt-out deletes the all-time marks
  with the events, and that the cooldown covers them because it uses the same setting as the
  recount period (the argument under "Opt-out" above, in two sentences).
- § Merged Daily Totals: `all_time_listener_count` is added and capped at the merged
  `listener_count`; there is no all-time overlap check.
- § Cost and Growth: each popularity-counted listen reads the listener's events from the last N
  days. That is at most N × `STATS_LISTEN_DAILY_STORED_CAP` rows, and far fewer for real
  listeners.
- Wherever the doc names `STATS_ALL_TIME_RECOUNT_DAYS` as a setting, add that the API does not
  start when it is above `STATS_TRACK_EVENT_RETENTION_DAYS`.
- Plan 41 rewrites the range-totals sections; this plan does not touch them.

## Files

infra/k8s/base/ops/source/database/linear-migrations/app/0030_stats_all_time_recount.sql
infra/k8s/base/ops/kustomization.yaml
infra/k8s/base/api/source/api.env
infra/k8s/base/db/source/bootstrap/0004_app_linear_baseline.sql.gz
infra/k8s/base/db/source/bootstrap/0005_management_linear_baseline.sql.gz
packages/orm/src/entities/stats/statsListenEvent.ts
packages/orm/src/entities/stats/statsOpenEvent.ts
packages/orm/src/entities/stats/statsDailyChannel.ts
packages/orm/src/entities/stats/statsDailyItem.ts
packages/orm/src/entities/stats/statsDailyClip.ts
packages/orm/src/entities/stats/statsDailyPlaylist.ts
packages/orm/src/entities/stats/statsDailyAccount.ts
packages/orm/src/services/stats/listenerIdentity/statsListenWrite.ts
packages/orm/src/services/stats/listenerIdentity/statsOpenWrite.ts
packages/orm/src/services/channel/applyChannelMerge.ts
packages/helpers/src/lib/popularityListen.ts
apps/api/src/config/index.ts
apps/api/src/lib/startup/validation.ts
apps/api/.env.example
apps/api/ENV.md
docs/features/POPULARITY-AND-TASTE-PROFILE.md
apps/api/src/test/stats-listen-write.integration.test.ts
apps/api/src/test/channel-merge.integration.test.ts
apps/api/src/test/podverse-test-env-startup.test.ts
release-notes/scratchpad.md

## Tests

API integration, `apps/api/src/test/stats-listen-write.integration.test.ts`:

- `ALL_TIME_RECOUNT_DAYS`, `ListenInput.allTimeRecountDays`, the `open` helper's
  `all_time_recount_days`, and `setOptedOutAt` exist from plan 14; reuse them. Leave
  `dailyCounts` as it is, so existing `toEqual` expectations hold, and add
  `allTimeDailyCount(entity, entityId, day)` reading `all_time_listener_count` (0 for a missing
  row) for listen and open tables.
- A helper `backdateListens(listenerId, hours, clientListenId?)`:
  `UPDATE stats_listen_event SET created_at = created_at - make_interval(hours => $2) WHERE listener_id = $1 AND ($3::uuid IS NULL OR client_listen_id = $3::uuid)`.
  Moving a row's `created_at` within the default partition, or across dated partitions, is an
  ordinary update. Use `listenerIdOf`. Add `backdateOpens(listenerId, hours)` the same way for
  `stats_open_event`. "Backdate by 2 days" below means 48 hours.
- Backdating moves events and leaves daily rows where they are, so every daily expectation below
  is today's row after all the calls so far. Read the item's row with both `dailyCounts` and
  `allTimeDailyCount`.
- "adds a listener to all-time totals once per recount period and again after it": fresh account,
  fresh item on `podcastChannelId` (`seedItem`). Read the channel's `allTimeDailyCount` for today.
  Session 1 is `counted`: the item's row is listeners 1, all-time 1; the channel's all-time today
  is 1 more than before; the event has `item_all_time_counted` and `channel_all_time_counted`
  true. Backdate the listener's events by 2 days. Session 2 on the same item is `counted`: the
  item's row is listeners 2, all-time 1 (first listen of the day, inside the period), and both
  marks on the new event are false. Backdate by 2 more days and send session 3 with
  `allTimeRecountDays: 3`: the item's row is listeners 3, all-time 2, and the new event's item
  mark is true. The marked listen is 4 days old, and session 2 was never marked.
- "adds a listener already counted today once the period ends later that day": fresh account and
  item, every call with `allTimeRecountDays: 3`. Session 1 `counted` (marked): listeners 1,
  all-time 1. Backdate every event of the listener by 71 hours. Session 2 is `counted`: the
  marked listen is inside the period, so the row is listeners 2, all-time 1. Backdate only
  session 1's event by 2 more hours (73 hours old). Session 3 is `counted`: session 2 is today's
  listen, so listeners stay 2, and the period has ended, so all-time is 2. Session 3's event is
  marked. This covers the `listeners === 0` update branch.
- "does not mark listens past the popularity cap, from a flagged listener, or in the opt-out
  cooldown": with `popularityDailyCap: 1, storedDailyCap: 3`, the second session's event has
  every mark false and the fresh item's `all_time_listener_count` is 0 (no daily row). The
  flagged case reuses plan 30's flag setup: after the flag, a session's marks are false. The
  cooldown case: a fresh allowed account, `setOptedOutAt(id, '1 day')`, a session on a fresh item
  is `counted` with `popularity_counted` false, every mark false, and no daily row for the item.
- "does not let an opt-out and a new Yes add a listener to an all-time total again inside the
  period": fresh allowed account and fresh item. Session 1 is `counted` and marked (item row
  listeners 1, all-time 1). `AccountSettingsListenStatsService.update` with `accepted: false`,
  then `accepted: true` (both with `AGREEMENT_VERSION`). The listener's events, marks included,
  are gone. Session 2 on the same item is `counted` with `popularity_counted` false and every
  mark false; the item's row is still listeners 1, all-time 1.
- "adds an opener to a profile's all-time total once per recount period": fresh opener and owner.
  Open the owner's profile: `counted`, `allTimeDailyCount('account', owner, today)` is 1, the
  open event's `all_time_counted` is true. Backdate the opener's open events by 48 hours and
  open again: `counted` (the repeat check reads only today's opens), today's row is
  `listener_count` 2, `all_time_listener_count` 1, and the new open event is not marked.
- Existing tests keep passing unchanged, since 90 days covers every test's history.

API unit, `apps/api/src/test/podverse-test-env-startup.test.ts`, inside the existing `describe`
(its `beforeEach` and `afterEach` already snapshot and restore `process.env`):

- "fails startup when STATS_ALL_TIME_RECOUNT_DAYS is greater than STATS_TRACK_EVENT_RETENTION_DAYS":
  apply the `apiVitest` profile, set `STATS_TRACK_EVENT_RETENTION_DAYS` to `'60'` and
  `STATS_ALL_TIME_RECOUNT_DAYS` to `'61'`; `validateStartupRequirements` throws.
- "fails startup when only the retention is lowered below the default recount period": the
  profile, `STATS_TRACK_EVENT_RETENTION_DAYS` `'60'`, `STATS_ALL_TIME_RECOUNT_DAYS` deleted;
  throws.
- "passes startup when STATS_ALL_TIME_RECOUNT_DAYS equals STATS_TRACK_EVENT_RETENTION_DAYS": both
  `'60'`; does not throw.

The existing two profile tests keep passing: the test env sets retention 90 and leaves the
recount period at its default 90.

API integration, `apps/api/src/test/channel-merge.integration.test.ts`, test "adds daily totals
without same-day overlap inside retention…": after `insertDaily`, set
`all_time_listener_count = listener_count` on the four seeded entities' rows with one `UPDATE` per
table. After apply, read the survivor's `all_time_listener_count` per day (a small helper next to
`dailyCounts`) and expect channel `{ t1: 6, t2: 1, pastRetention: 2 }` (t1: min(5 + 4, 6)) and
item `{ t1: 3, t2: 1, pastRetention: 2 }` (t1: min(2 + 3, 3)). After revert, both copies' values
equal the seeded `listener_count` again. Leave the existing tuple expectations alone.

## Release scratchpad

```markdown
## Popularity all-time totals count a listener once per 90 days

- Surfaces: api, k8s base env, database migration
- Change: a listener adds to an episode's, show's, clip's, profile's, or playlist's all-time
  popularity total at most once every `STATS_ALL_TIME_RECOUNT_DAYS` (default 90; the same setting
  sets the popularity cooldown after a Taste Profile opt-out). The first popularity-counted listen
  or open after the period ends counts again. Listens stored during the opt-out cooldown never
  add to all-time. The API now refuses to start, with a message naming both keys, when
  `STATS_ALL_TIME_RECOUNT_DAYS` is greater than `STATS_TRACK_EVENT_RETENTION_DAYS`; nothing
  lowers it quietly. New `all_time_listener_count` on the five `stats_daily_*` tables
  (backfilled from `listener_count`) and new marks on `stats_listen_event` and
  `stats_open_event`. Range totals read the new column once the range-totals change ships.
- Who notices: all-time Top lists grow more slowly; daily listener counts do not change;
  operators whose API retention is below 90 days see a startup failure
- Operator steps: run the app migration; keep the API's `STATS_TRACK_EVENT_RETENTION_DAYS` equal
  to the workers' value; if either retention is below 90, set `STATS_ALL_TIME_RECOUNT_DAYS` on the
  API to that value or lower before deploying
```
