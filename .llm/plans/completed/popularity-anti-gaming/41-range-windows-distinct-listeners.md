**Cursor model:** Opus 5.5 · **Reasoning:** high

# 41 — Day, week, and month counts are distinct listeners, from events

The popularity refresh job counts each window as the number of distinct listeners (distinct
openers for profiles and playlists) with a counted event in it. It reads `stats_listen_event` or
`stats_open_event` and skips events with `popularity_counted = false` and listeners with an
uncleared flag. All-time is the sum of plan 40's `all_time_listener_count` over every daily row.
A channel merge moves every old-channel event to the survivor channel, so the survivor's windows
include the old copy's listeners.

## Rows

R12, R13, R14, R16, R24

R16 is split: this plan covers day, week, and month for opens, and plan 40 covers all-time. Plan
14 owns R24; this plan covers its day, week, and month part (cooldown listens and kept flags).

## Runs after

40

## What the code does today (R13, R14)

- `refreshStatsPopularity` (`packages/orm/src/services/stats/statsPopularityRefresh.ts`) sums
  `stats_daily_*.listener_count` per window. A daily row counts each listener once per UTC day,
  so a listener who plays a show on two days adds 2 to its week, month, and all-time counts. The
  request is right about this.
- **R14, "don't we keep the listen event rows for 90 days?"** Yes, for at least that long.
  `statsEventPartitionsMaintain` drops whole monthly partitions once every row in them is older
  than `STATS_TRACK_EVENT_RETENTION_DAYS` (default 90). Rows therefore live 90 to about 122 days.
  Open events follow the same rule. Daily totals are kept forever. The month window covers at
  most 31 days, so every window can be counted from events, and all-time cannot: plan 40 keeps it
  in the daily rows.

## Exclusions (R12)

A window counts an event only when all of these hold:

- `popularity_counted` is true. That leaves out listens past the popularity cap (plan 11),
  everything a listener stored while flagged (plan 30), and listens stored during the opt-out
  cooldown (plan 14). Opens during the cooldown are never stored.
- No `stats_flagged_listener` row for its `listener_id` has `cleared_at IS NULL`. That leaves out
  a flagged listener's listens and opens from before the flag too, for as long as the flag
  stands. Plan 14 keeps the listener row, and the flag rows with it, across an opt-out, so the
  exclusion still holds after the listener turns Taste Profile off and on again.
- `created_at` is inside the window: on or after UTC midnight of `today − lookback`, and before
  UTC midnight of `today + 1`. These are the same days the daily rows covered, using
  `STATS_POPULARITY_RANGE_LOOKBACK_DAYS`.

A clear brings the listener's events back into the windows at the next refresh, as long as those
events are still in the window. All-time does not change when a flag is set or cleared. Listens
from before the flag already added to it, and plan 30 keeps flagged listens out of the daily rows.

An opt-out deletes the listener's events (plan 14), so the listener leaves the day, week, and
month counts at the next refresh. For the cooldown that follows, its new listens are stored with
`popularity_counted = false`, so they do not bring it back. Daily rows and all-time stay.

## Entity tables

`packages/orm/src/services/stats/statsEntityTables.ts`: add `events` to every entry:
`'stats_listen_event'` for channel, item, and clip; `'stats_open_event'` for playlist and account.
Each type's `key` is already the event column (`channel_id`, `item_id`, `clip_id`, `playlist_id`,
`account_id`). Extend the doc comment: the map also names the event table each type is counted
from.

## Refresh SQL

`packages/orm/src/services/stats/statsPopularityRefresh.ts`. Replace the header comment: day,
week, and month counts are distinct listeners from the event tables, skipping events that are
not popularity-counted and listeners with an uncleared flag; all-time is the sum of the daily
rows' `all_time_listener_count`. Recent mode refreshes every entity with a counted event in the
month window or a daily row on today or yesterday, and recomputes all-time only where it can have
changed. Full mode recomputes all four counts for every entity.

New module-level helpers (table and column names come only from `STATS_ENTITY_TABLES`):

```typescript
const FLAGGED_LISTENER_TABLE = 'stats_flagged_listener';

/** UTC midnight `lookbackParam` days before `$1` (today). */
function windowStartSql(lookbackParam: string): string {
  return `(($1::date - ${lookbackParam}::int)::timestamp AT TIME ZONE 'UTC')`;
}

const WINDOW_END_SQL = `(($1::date + 1)::timestamp AT TIME ZONE 'UTC')`;

/**
 * Events of alias `e` that count toward a window starting `lookbackParam` days before `$1`:
 * popularity-counted, inside the window, and from a listener without an uncleared flag.
 */
function countedEventsWhere(tables: EntityTables, lookbackParam: string): string {
  const { key } = tables;
  return `e.${key} IS NOT NULL
     AND e.created_at >= ${windowStartSql(lookbackParam)}
     AND e.created_at < ${WINDOW_END_SQL}
     AND e.popularity_counted
     AND NOT EXISTS (
           SELECT 1 FROM ${FLAGGED_LISTENER_TABLE} f
            WHERE f.listener_id = e.listener_id AND f.cleared_at IS NULL
         )`;
}

/**
 * CTEs ending in `window_totals (entity_id, day_count, week_count, month_count)`: distinct
 * listeners per entity in each window. `$1` today, `$2`–`$4` day, week, and month lookbacks.
 */
function windowTotalsSql(tables: EntityTables): string {
  const { key, events } = tables;
  return `window_listeners AS (
  SELECT e.${key} AS entity_id, e.listener_id, max(e.created_at) AS last_at
    FROM ${events} e
   WHERE ${countedEventsWhere(tables, '$4')}
   GROUP BY e.${key}, e.listener_id
),
window_totals AS (
  SELECT entity_id,
         (count(*) FILTER (WHERE last_at >= ${windowStartSql('$2')}))::int AS day_count,
         (count(*) FILTER (WHERE last_at >= ${windowStartSql('$3')}))::int AS week_count,
         count(*)::int AS month_count
    FROM window_listeners
   GROUP BY entity_id
)`;
}
```

A listener's latest event in the month window decides which shorter windows it falls in, so each
listener counts once per window.

**Recent upsert** (`recentUpsertSql`, params `$1` today, `$2`–`$4` lookbacks, `$5`
`ALL_TIME_RECHECK_DAYS`), passed to `upsertChangedRowsSql` as before:

```sql
${windowTotalsSql(tables)},
recent_daily AS (
  SELECT DISTINCT d.${key} AS entity_id
    FROM ${daily} d
   WHERE d.day >= $1::date - $5::int AND d.day <= $1::date
),
targets AS (
  SELECT COALESCE(w.entity_id, r.entity_id) AS entity_id,
         COALESCE(w.day_count, 0) AS day_count,
         COALESCE(w.week_count, 0) AS week_count,
         COALESCE(w.month_count, 0) AS month_count,
         stored.all_time_count AS stored_all_time_count,
         (r.entity_id IS NOT NULL
           OR stored.${key} IS NULL
           OR stored.all_time_count < COALESCE(w.month_count, 0)) AS needs_all_time
    FROM window_totals w
    FULL JOIN recent_daily r ON r.entity_id = w.entity_id
    LEFT JOIN ${popularity} stored ON stored.${key} = COALESCE(w.entity_id, r.entity_id)
),
all_time_totals AS (
  SELECT d.${key} AS entity_id, SUM(d.all_time_listener_count)::int AS all_time_count
    FROM ${daily} d
   WHERE d.${key} IN (SELECT t.entity_id FROM targets t WHERE t.needs_all_time)
   GROUP BY d.${key}
),
refreshed AS (
  SELECT t.entity_id, t.day_count, t.week_count, t.month_count,
         COALESCE(a.all_time_count, t.stored_all_time_count, 0) AS all_time_count
    FROM targets t
    LEFT JOIN all_time_totals a ON a.entity_id = t.entity_id
)
```

Update its doc comment. All-time is recomputed for entities with a daily row on today or
yesterday (the only rows whose `all_time_listener_count` can grow), for new rows, and where the
stored value is below the new month count.

**Recent zero** (`recentZeroSql`, params `$1` today, `$2` month lookback):

```sql
UPDATE ${popularity} AS p
   SET day_count = 0, week_count = 0, month_count = 0
 WHERE (p.day_count <> 0 OR p.week_count <> 0 OR p.month_count <> 0)
   AND NOT EXISTS (
         SELECT 1 FROM ${events} e
          WHERE e.${key} = p.${key}
            AND ${countedEventsWhere(tables, '$2')}
       )
```

This also zeroes an entity whose only events in the window come from flagged listeners.

**Full upsert** (`fullUpsertSql`, params `$1` today, `$2`–`$4` lookbacks):

```sql
${windowTotalsSql(tables)},
all_time_totals AS (
  SELECT d.${key} AS entity_id, SUM(d.all_time_listener_count)::int AS all_time_count
    FROM ${daily} d
   GROUP BY d.${key}
),
refreshed AS (
  SELECT COALESCE(w.entity_id, a.entity_id) AS entity_id,
         COALESCE(w.day_count, 0) AS day_count,
         COALESCE(w.week_count, 0) AS week_count,
         COALESCE(w.month_count, 0) AS month_count,
         COALESCE(a.all_time_count, 0) AS all_time_count
    FROM window_totals w
    FULL JOIN all_time_totals a ON a.entity_id = w.entity_id
)
```

**Full zero** (`fullZeroSql`, params `$1` today, `$2` month lookback; it took none before):

```sql
UPDATE ${popularity} AS p
   SET day_count = 0, week_count = 0, month_count = 0, all_time_count = 0
 WHERE (p.day_count <> 0 OR p.week_count <> 0 OR p.month_count <> 0 OR p.all_time_count <> 0)
   AND NOT EXISTS (SELECT 1 FROM ${daily} d WHERE d.${key} = p.${key})
   AND NOT EXISTS (
         SELECT 1 FROM ${events} e
          WHERE e.${key} = p.${key}
            AND ${countedEventsWhere(tables, '$2')}
       )
```

`refreshEntityType` passes `[today, month]` to `fullZeroSql`. Everything else stays as it is:
`ALL_TIME_RECHECK_DAYS`, `upsertChangedRowsSql`, `rowsWrittenFrom`, `statementRowCount`,
`lockPopularityRefresh`, one transaction per type, `AppDataSourceReadWrite`, and the exported
types. The job still takes no row locks and nothing the write path takes.

Reading listener ids from event rows and reading `stats_flagged_listener` are both allowed for
the range-totals refresh by **popularity-listener-id-separation**. Neither touches the mapping.

## Channel merge: every old-channel event moves to the survivor channel

`packages/orm/src/services/channel/applyChannelMerge.ts`:

- Today events of unmatched old items keep `channel_id` = the old channel. Their daily rows move
  into the survivor, so the survivor's old daily sums included those listeners. Windows now come
  from events, so those events must count toward the survivor channel too.
- `lockMergeStatsRows` gains a `fromChannelId: number` first parameter after `manager`. Replace
  the `oldItemIds.length > 0` events lock with one lock that always runs:
  `SELECT 1 FROM stats_listen_event WHERE channel_id = $1 OR item_id = ANY($2::int[]) FOR UPDATE`
  with `[fromChannelId, [...oldItemIds]]`. Update its doc comment: the old channel's events, and
  any matched old item's events, come first. `applyAbsorb` passes `from.channelId`.
- New function after `moveListenEvents`:

  ```typescript
  /**
   * Every remaining event of the old channel counts toward the survivor channel; unmatched items
   * keep their `item_id`. Not journaled, for the reason `moveListenEvents` gives.
   */
  async function moveChannelListenEvents(
    manager: EntityManager,
    fromChannelId: number,
    toChannelId: number
  ): Promise<void>
  ```

  It runs `UPDATE stats_listen_event SET channel_id = $2 WHERE channel_id = $1`.
- In `applyAbsorb`, call it once, right after the matched-pair loop ends and before the unmatched
  loop. Every overlap read has already run by then, so it changes no overlap.
- Extend the `applyAbsorb` doc comment by one sentence on the move.
- Effects to state in the docs (no code): a later completion of an unmatched old item's event adds
  to the survivor's daily rows (which hold the old rows) and its taste rows. Those are the same
  rows the merge already moved the old channel's totals and taste into. A revert leaves the
  events on the survivor, like matched events, so after a revert the old channel's day, week,
  and month counts start again from new listens, while its all-time comes back from the restored
  daily rows.

## Dev seed

The seed writes daily rows and no events, so a refresh would give its entities zero day, week,
and month counts.

- `packages/orm/src/services/stats/statsDailyDevSeed.ts`:
  - Both `upsertSql` variants also write `all_time_listener_count` equal to `listener_count`. Pass
    the listener-count array again. In `ON CONFLICT … DO UPDATE`, set
    `all_time_listener_count = EXCLUDED.all_time_listener_count`.
  - New exported function:

    ```typescript
    /**
     * Dev seeding only. Sets the day, week, and month counts of existing range rows to sums of
     * the seeded daily rows, since dev seeding writes no events. A later refresh replaces them
     * with event counts. Only `devStatsSeedSimulatedPopularity` calls this.
     */
    export async function devWriteStatsPopularityWindowsFromDailyRows(
      entityType: StatsEntityType,
      today: string
    ): Promise<number>
    ```

    It runs one `UPDATE ${popularity} AS p SET day_count = w.day_count, week_count = w.week_count, month_count = w.month_count FROM (…) w WHERE p.${key} = w.entity_id`
    whose subquery groups `${daily}` rows with `day >= $1::date - $4::int AND day <= $1::date`
    and sums `listener_count` with `FILTER (WHERE day >= $1::date - $2::int)` for day and `$3`
    for week. Params are `[today, day, week, month]` from
    `STATS_POPULARITY_RANGE_LOOKBACK_DAYS`. It returns the updated row count (reuse the
    `rowCount` reading pattern of `statementRowCount` from the refresh module, or a small local
    copy if that function stays private).
- `apps/workers/src/commands/stats/devStatsSeedSimulatedPopularity.ts`: after
  `refreshStatsPopularity({ … mode: 'full' })`, call
  `devWriteStatsPopularityWindowsFromDailyRows` for each of `'channel'`, `'item'`, `'clip'`,
  `'playlist'`, `'account'` with `getUtcDateString(now)`. The final log line says the windows
  were written from the simulated daily rows.
- `packages/worker-commands/src/registry.ts` `devStatsSeedSimulatedPopularity` description:
  "…then refresh popularity range totals and write simulated day, week, and month counts."

## Workers: retention must cover the month window

`apps/workers/src/lib/startup/validation.ts`: give `validateRetentionDays` an optional fourth
parameter `min = RETENTION_DAYS_MIN`. Pass
`STATS_POPULARITY_RANGE_LOOKBACK_DAYS.month + 1` (31) for `STATS_TRACK_EVENT_RETENTION_DAYS`,
imported from `@podverse/helpers`. Retention below 31 days would drop events the month window
still counts. `apps/workers/ENV.md`: in the retention table row for
`STATS_TRACK_EVENT_RETENTION_DAYS`, note "at least 31: popularity month counts read events".

## Comments that name the old source

- `apps/workers/src/commands/stats/statsPopularityRefresh.ts` doc comment: "Rebuilds popularity
  range totals: day, week, and month from counted events, all-time from daily totals."
- `packages/worker-commands/src/registry.ts` `statsPopularityRefresh` description: "Rebuild
  popularity range totals: day, week, and month as distinct listeners from counted events,
  all-time from daily totals. Hourly runs cover entities active in the last 30 days; -full
  recomputes every entity."
- The five `packages/orm/src/entities/stats/statsPopularity*.ts` class comments ("derived from the
  daily table") and the five `packages/orm/src/services/stats/popularity/statsPopularity*.ts`
  service comments ("Rows are rebuilt from the daily totals"): say "rebuilt from counted events
  and daily totals by the popularity refresh job".

## Docs

`docs/features/POPULARITY-AND-TASTE-PROFILE.md`:

- § Design Questions, Answered, "What is the better practice?": range sorts read a small derived
  table rebuilt from recent events and the daily totals.
- § Stores and Lifetimes table, Range totals row, "Kept for": "Rebuilt from events and daily
  totals".
- § Listener Id and Its Separation, § Opting Out Deletes Listening Data, and plan 14's
  § Popularity Cooldown After an Opt-Out: wherever the text (as plan 14 leaves it) says daily and
  range totals, or all public totals, stay after an opt-out or account deletion, say instead:
  daily totals and all-time counts stay; day, week, and month counts come from events, so a
  listener whose events are deleted leaves them at the next refresh. In the cooldown section, add
  that cooldown listens are not popularity-counted and so stay out of the windows.
- § Range Totals Are Rebuilt by a Job: rewrite the bullets. Windows and lookbacks stay as they
  are. Each window count is the number of distinct listeners (openers) with a counted event in it.
  A listener who returns on three days counts once in the week. State the exclusions from
  "Exclusions" above. All-time is the sum of `all_time_listener_count` (plan 40's rule).
  Retention covers the month window; the workers refuse a retention below 31 days.
- § Merged Range Totals: the windows follow the moved events within the hour.
- § Channel Merge table, `stats_listen_event` row: "Events of matched items move to the survivor
  item; every old-channel event counts toward the survivor channel". In the paragraph after the
  table, replace "Events of unmatched old items stay, since their item stays in the old channel."
  with: events of unmatched old items keep their item and count toward the survivor channel.
- § Merge Journal and Revert: the revert consequence from the merge section above.
- § Flagged Listeners (plan 30's section): fill in how range totals leave a flagged listener out.
  An uncleared flag removes all of the listener's events from the windows. A clear brings them
  back while they are in the window. All-time keeps what the listener added before the flag.
- § Range Totals (under Jobs and Schedules): rewrite recent mode, full mode, and "Why recent
  all-time totals stay exact" for the SQL above. Recent mode scans the month window of the type's
  event table, plus daily rows from today and yesterday. Full mode adds every daily row. A flag or
  clear reaches the windows at the next hourly run.
- § Cost and Growth: each hourly run reads one month of events once per type: three times for
  listens (channel, item, clip) and twice for opens. At 10,000 listeners and 10 listens a day
  that is about 3 million rows per listen pass. The primary key `(created_at, id)` serves the
  time range.

## Files

packages/orm/src/services/stats/statsPopularityRefresh.ts
packages/orm/src/services/stats/statsEntityTables.ts
packages/orm/src/services/stats/statsDailyDevSeed.ts
packages/orm/src/services/channel/applyChannelMerge.ts
packages/orm/src/entities/stats/statsPopularityChannel.ts
packages/orm/src/entities/stats/statsPopularityItem.ts
packages/orm/src/entities/stats/statsPopularityClip.ts
packages/orm/src/entities/stats/statsPopularityPlaylist.ts
packages/orm/src/entities/stats/statsPopularityAccount.ts
packages/orm/src/services/stats/popularity/statsPopularityChannel.ts
packages/orm/src/services/stats/popularity/statsPopularityItem.ts
packages/orm/src/services/stats/popularity/statsPopularityClip.ts
packages/orm/src/services/stats/popularity/statsPopularityPlaylist.ts
packages/orm/src/services/stats/popularity/statsPopularityAccount.ts
apps/workers/src/commands/stats/statsPopularityRefresh.ts
apps/workers/src/commands/stats/devStatsSeedSimulatedPopularity.ts
apps/workers/src/lib/startup/validation.ts
apps/workers/ENV.md
packages/worker-commands/src/registry.ts
docs/features/POPULARITY-AND-TASTE-PROFILE.md
apps/api/src/test/stats-popularity-refresh.integration.test.ts
apps/api/src/test/channel-merge.integration.test.ts
release-notes/scratchpad.md

## Tests

API integration, `apps/api/src/test/stats-popularity-refresh.integration.test.ts`. Rewrite the
seeding around events. Keep the 2001 dates, the `refresh`, `resultFor`, `seedAccount`,
`seedChannel`, `setPopularityRow`, and `popularityRow` helpers, and the file's cleanup.

- `TABLES` gains `events` per type (and `item`/`clip` only if a test below uses them).
  `insertDailyRows` takes `{ day, listeners, allTime }` and writes `all_time_listener_count`.
- New helpers:
  - `seedListener(label)`: `seedAccount`, then
    `INSERT INTO listener_identity.stats_listener (account_id) VALUES ($1) RETURNING listener_id::text AS listener_id`
    (the channel-merge test's pattern).
  - `insertListen(listenerId, channelId, itemId, at, popularityCounted = true)` into
    `stats_listen_event` (`created_at`, `listener_id`, `channel_id`, `item_id`,
    `popularity_counted`). Seed one item per channel with the file's existing repository pattern,
    or with whatever helper the file gains.
  - `insertOpen(listenerId, kind, entityId, at)` into `stats_open_event`.
  - `flagListener(listenerId, cleared)`: insert into `stats_flagged_listener`
    (`listener_id`, `reason` `'stored_cap_reached'`, `flagged_at`, and, when cleared,
    `cleared_at` and `cleared_by_admin_id` 1).
  - Timestamps are `${day}T12:00:00.000Z`.
- Cleanup deletes the seeded accounts; events, flags, and listener rows cascade from the listener
  row.
- "counts distinct listeners per window, not listener-days": window channel, today `2001-06-30`.
  Listener A on 06-30, 06-29, and 06-05; B on 06-30 twice; C on 06-25; D on 05-20 (outside the
  month window). Daily rows give all-time 9. Recent mode: `{ day_count: 2, week_count: 3,
  month_count: 3, all_time_count: 9 }`.
- "writes no rows when an identical recent run follows": unchanged in intent.
- "leaves out events that are not popularity-counted and listeners with an uncleared flag, and
  counts them again after a clear": a fresh channel with listener E (06-30, normal), F (06-30,
  `popularity_counted` false, which stands for both a listen past the popularity cap and one
  stored in the opt-out cooldown), and G (06-30, flagged, not cleared), plus a daily row with
  all-time 3. Recent: day, week, month 1, all-time 3. Clear G's flag; recent again: windows 2.
- "zeroes the windows and keeps the all-time total once the month window holds no counted
  events": run recent with today `2001-08-15` (no events after 07-15 for the window channel).
  The window channel's windows are 0 and all-time stays 9.
- "creates no row in recent mode for an entity with only old daily rows, and full mode creates
  it": the old-rows channel has daily rows in Feb–Mar 2001 (all-time 10) and no events. Recent
  at 06-30 creates nothing; full creates `{ 0, 0, 0, 10 }`.
- "keeps a stored all-time total in recent mode without a daily row today or yesterday, and full
  mode corrects it": the existing stale all-time case, with `allTime` on the daily rows and one
  listener's event on 06-20 so the entity is in the month window.
- "sets all four counts to zero in full mode on a row whose entity has no daily rows and no
  counted events": unchanged in intent.
- "sums all_time_listener_count, not listener_count": a daily row with `listeners: 5, allTime: 2`
  gives all-time 2.
- "refreshes playlist and profile range totals from open events": two openers of the playlist on
  06-30 and one on 06-28, one opener of the profile on 06-29 twice (two rows on different days,
  since one opener opens once a day), plus daily all-time rows. Expect distinct openers per
  window.

API integration, `apps/api/src/test/channel-merge.integration.test.ts`, test "adds daily totals
without same-day overlap inside retention…": `expectedEvents` becomes
`[[oldOnlyItem, survivorChannel, 1], [survivorItem, survivorChannel, 8]]` (sorted as now), both
after apply and after revert. Nothing else in the test changes.

No new unit test for the workers validation change: `validation.ts` has no test file, and the
change only passes a different minimum to an existing check.

## Release scratchpad

```markdown
## Popularity day, week, and month counts are distinct listeners

- Surfaces: workers (popularity refresh job), database reads, channel merge
- Change: the refresh job counts each Day, Week, and Month list as distinct listeners (distinct
  openers for profiles and playlists) from the listen and open events, instead of summing daily
  listener counts. A listener who returns on three days counts once in the week. Events past the
  daily popularity cap, listens stored during the cooldown after a Taste Profile opt-out, and
  every event of a listener with an uncleared flag are left out, and a cleared flag counts them
  again. All-time sums the daily `all_time_listener_count`. A channel
  merge moves every event of the merged-away channel to the survivor channel. A listener who opts
  out or deletes their account leaves the day, week, and month counts at the next refresh; all-time
  counts stay. The workers refuse `STATS_TRACK_EVENT_RETENTION_DAYS` below 31.
- Who notices: Top lists for Week and Month show fewer, more realistic counts; dev seeding still
  fills Top lists
- Operator steps: run a full refresh once after deploy
  (`npm run stats_popularity_refresh -w apps/workers -- -full`) so every entity's counts move to
  the new rule
```
