**Cursor model:** Opus 5.5 · **Reasoning:** high

# 51 — Channel merge moves popularity data to the survivor

When a duplicate channel is absorbed (`applyAbsorb` in
`packages/orm/src/services/channel/applyChannelMerge.ts`), move its popularity data to the
survivor:

- Anonymous daily totals are added into the survivor's rows. For every day still inside retention,
  listeners who have listen events on both copies that day are counted once. All of this is
  journaled, so a revert restores the exact pre-merge rows.
- The old copy's range totals are deleted (journaled). The survivor's range totals are left to
  plan 42's refresh job, which rebuilds them from the merged daily rows.
- Listen events, taste profile rows, and Hidden From Taste Profile rows move without a journal.
  Two taste rows for the same listener become one.

The old `stats_aggregated_*` / `stats_track_event_*` handling leaves the merge code and the journal
allowlist, so plan 19 can drop those tables.

Repoint merges (`applyRepoint`) keep one channel and change no ids, so they need nothing here.

## Rows

R27, R65, R66, R67, R68

## Runs after

10, 11, 30 (taste half-life constants), 42 (refresh job and its lock keys), 50 (all of 10, 11, 42,
and 50 edit `docs/features/POPULARITY-TRACKING.md`)

## Files

- `packages/orm/src/services/channel/applyChannelMerge.ts`
- `packages/orm/src/services/channel/channelMergeRowJournal.ts`
- `apps/workers/src/commands/podcastIndex/deadFeeds/flagAndMerge.ts`
- `apps/api/src/test/channel-merge.integration.test.ts`
- `apps/api/src/test/channel-merge-redirect.integration.test.ts`
- `docs/features/POPULARITY-TRACKING.md`

## What moves, and how

Read the migration plan 10 wrote and the doc's contracts first. Table and column names below are
plan 10's; where the SQL differs, the SQL wins.

| Data | Rows for | Moved by | Journaled | On revert |
| --- | --- | --- | --- | --- |
| `stats_daily_channel` | the channel pair | per `day`: add into the survivor's row, subtracting the same-day overlap when the day is inside retention; insert when the survivor has no row; delete the old row | yes | restored to the pre-merge images |
| `stats_daily_item` | each matched item pair | same, per pair | yes | restored |
| `stats_popularity_channel` | the old channel | delete the old row; the survivor's row is not written | yes | old row restored |
| `stats_popularity_item` | each matched old item | same | yes | old rows restored |
| `stats_listen_event` | events whose `item_id` is a matched old item | `item_id` and `channel_id` set to the survivor item and channel | no | stay on the survivor |
| `stats_taste_profile` | rows on the old channel | merged into the survivor (below) | no | stay on the survivor |
| `stats_taste_profile_hidden` | rows on the old channel | moved to the survivor (below) | no | stay on the survivor |

Untouched:

- Events on unmatched old items: their item stays in the old channel, and an event's `channel_id`
  is always its item's channel.
- `stats_daily_clip` / `stats_popularity_clip`: clips keep their ids when `moveItemColumn` moves
  them to the survivor item.
- `stats_open_event`, `stats_daily_playlist`, `stats_daily_account`, and their range totals: not
  channel data.

## Retention days reach the merge

- `VerifyAndApplyDuplicateMergesOptions` gains a required
  `statsTrackEventRetentionDays: number`. `verifyAndApplyDuplicateMerges` throws
  `new Error('statsTrackEventRetentionDays must be a positive integer')` before any work when the
  value is not an integer of at least 1. Pass it down through `applyMerge` to `applyAbsorb`.
- `apps/workers/src/commands/podcastIndex/deadFeeds/flagAndMerge.ts`: import `getStatsConfig` from
  `@workers/config/index.js` beside `getPodcastIndexConfig`, and pass
  `statsTrackEventRetentionDays: getStatsConfig().trackEventRetentionDays`. Base startup
  validation already checks `STATS_TRACK_EVENT_RETENTION_DAYS` for every command, so no
  validation change.
- Both integration test files pass `statsTrackEventRetentionDays: 90` at every
  `verifyAndApplyDuplicateMerges` call (four in `channel-merge.integration.test.ts`, one in
  `channel-merge-redirect.integration.test.ts`).
- The ORM never reads the env itself.

The **retention boundary** is computed once per absorb, inside the merge transaction, so it uses
the same clock as the listens' `created_at`:
`SELECT ((now() AT TIME ZONE 'UTC')::date - $1::integer)::text AS boundary_day`. Narrow the row
with the file's `isRecord` / `nullableText` helpers; throw when it is missing. A day is **inside
retention** when `day >= boundary_day`.

Every event on a day inside retention is still stored. Plan 41 drops a month only when the month
ends on or before the first of the month containing `now − retention days`. Opt-out cascades are
the one exception, covered under "Why the result never undercounts".

## Order inside `applyAbsorb`

Keep the existing follow, notification, auto-download, and pending-follow moves first. Then:

1. **Locks**, in this order (§ Concurrency explains it):
   1. `SELECT pg_advisory_xact_lock(hashtextextended('popularity_refresh:channel', 0))`, then the
      same with `'popularity_refresh:item'`.
   1. `SELECT 1 FROM stats_listen_event WHERE item_id = ANY($1::int[]) FOR UPDATE` with every
      matched old item id. Skip it when there are none.
   1. `SELECT 1 FROM stats_daily_item WHERE item_id = ANY($1::int[]) FOR UPDATE` with every
      matched old and survivor item id.
   1. `SELECT 1 FROM stats_daily_channel WHERE channel_id = ANY($1::int[]) FOR UPDATE` with both
      channel ids.
1. Compute `boundary_day`.
1. **Channel totals**, before any event moves: read the channel overlap, then
   `moveDailyTotals` for `stats_daily_channel`, then `deleteMergedPopularityRow` for
   `stats_popularity_channel` on the old channel.
1. **The existing item loop**, in `item_merge_map` id order. For each matched pair, after the
   queue, clip, and playlist moves already in the loop:
   1. Read the item overlap.
   1. `moveDailyTotals` for `stats_daily_item`.
   1. `deleteMergedPopularityRow` for `stats_popularity_item` on the old item.
   1. Move that pair's listen events.
1. The unmatched-item loop, unchanged.
1. **Taste and hidden rows** (below).
1. The feed lifecycle update and `match_stats`, unchanged.

The channel overlap is read before step 4 because moving item events rewrites their `channel_id`.
After that, nothing can tell which copy an event came from.

`item_merge_map` has no unique constraint on `to_item_id`, so several old items can map to one
survivor item. Handling each pair in turn, with its events moved before the next pair's overlap
read, keeps that case right. By then the survivor's daily row already includes the earlier old
item, and so do the survivor item's events.

## Daily totals and same-day overlap (journaled)

Replace `STATS_COUNT_COLUMNS`, `addStats`, and `moveTrackEvents` with these helpers, built on the
journal functions already in the file. Column and table names come only from the fixed unions in
the signatures, never from input.

### `readSameDayOverlap(manager, key: 'channel_id' | 'item_id', fromId, toId, boundaryDay)`

Returns `Map<string, { listeners: number; completions: number }>` keyed by `YYYY-MM-DD`:

```sql
WITH per_copy AS (
  SELECT listener_id,
         (created_at AT TIME ZONE 'UTC')::date AS day,
         <key> = $1 AS on_old,
         bool_or(completed) AS completed
  FROM stats_listen_event
  WHERE <key> IN ($1, $2)
    AND created_at >= ($3::date)::timestamp AT TIME ZONE 'UTC'
  GROUP BY 1, 2, 3
)
SELECT o.day::text AS day,
       COUNT(*)::int AS listeners,
       (COUNT(*) FILTER (WHERE o.completed AND s.completed))::int AS completions
FROM per_copy o
JOIN per_copy s ON s.listener_id = o.listener_id AND s.day = o.day AND NOT s.on_old
WHERE o.on_old
GROUP BY o.day
```

- `listeners` counts listeners with an event on both copies that UTC day.
- `completions` counts listeners with a completed event on both copies that day.
- The lower bound on `created_at` lets Postgres skip partitions older than the boundary. The
  `(channel_id)` / `(item_id)` index finds each copy's rows in the partitions that are left.
- Narrow each result row with a type guard; no `as`.

### `moveDailyTotals(manager, mergeId, table: 'stats_daily_channel' | 'stats_daily_item', key, fromId, toId, overlap, boundaryDay)`

Load the old rows and the survivor rows with `selectMergeRows`. `day` comes back as `YYYY-MM-DD`
text from `row_to_json`, and it round-trips through `whereSql` and the revert functions unchanged.
For each old row (`f`, `fc`) on `day`:

- **Survivor has a row** (`s`, `sc`): let `o` and `oc` be the overlap for `day` when
  `day >= boundaryDay`, else 0. Write, with `journaledUpdate` on `{ [key]: toId, day }`:
  - `listener_count = max(f + s − o, f, s)`
  - `completion_count = min(max(fc + sc − oc, fc, sc), listener_count)`
- **Survivor has no row**: `journaledInsert` the old counts unchanged on `toId`.
- Then `journaledDelete` the old row.

The `max(…, f, s)` floor reflects that the union of two days' listeners is never smaller than
either copy. With consistent data it never applies. It keeps hand-seeded rows that have no events,
such as plan 43's dev seed, from going below either copy. The `min` keeps plan 10's
`completion_count <= listener_count` check. Ignore overlap days that have no old row.

### Why the result never undercounts

The overlap only counts listeners whose events on both copies are still stored. A listener who
opted out after listening has no events left, so their overlap is not subtracted and they may be
counted on both copies. A listener the merge does subtract is in both summed rows (§ Concurrency).

### `deleteMergedPopularityRow(manager, mergeId, table: 'stats_popularity_channel' | 'stats_popularity_item', key, fromId)`

`journaledDelete` on `{ [key]: fromId }`. The merge never writes the survivor's range row.

## Range totals: left to the refresh job

The survivor's `stats_popularity_*` row is not a plain sum once overlap is removed. The merge does
not recompute it. Plan 42's refresh job rebuilds it from the merged daily rows:

- Recent mode, hourly, recomputes `day_count`, `week_count`, and `month_count` for every entity
  with a daily row in the month window, and that includes the survivor.
- `all_time_count` is recomputed hourly when the survivor has a daily row today or yesterday.
  Otherwise the nightly full run picks it up. Plan 42 names merged past days as one reason full
  mode exists.

Why not recompute in the merge:

- Plan 42's job is the only code that turns daily rows into range values, so the window rules live
  in one place.
- A second writer would need the job's window math or a new export from its file, for a value the
  job overwrites within the hour.
- A revert needs nothing from the survivor's range row. The merge never wrote it, and the next
  refresh brings it back in line with the restored daily rows.

Deleting the old copy's range rows takes the merged-away channel and its matched episodes out of
every range sort at once. Plan 42's recent mode would only zero their windows and leave
`all_time_count` until the nightly run.

## Listen events (not journaled)

Per matched pair, one statement after that pair's overlap read and daily move:
`UPDATE stats_listen_event SET item_id = $toItem, channel_id = $toChannel WHERE item_id = $fromItem`.
`created_at` does not change, so rows stay in their partitions.

## Taste profile and hidden rows (not journaled)

Set-based SQL on the merge's manager, in this order, with `$from` / `$to` the channel ids:

1. Move hidden rows: insert `(listener_id, $to, hidden_at)` for every hidden row on `$from`,
   `ON CONFLICT (listener_id, channel_id) DO NOTHING`, then delete the hidden rows on `$from`.
1. Hidden wins: delete taste rows on `$from` or `$to` whose listener now has a hidden row on
   `$to`.
1. Merge pairs: for each listener with taste rows on both, update the survivor's row:
   - Counts are summed.
   - `first_listened_at` is the earlier of the two and `last_listened_at` the later.
   - Each score fades to a common time and adds. With
     `T = GREATEST(s.scores_updated_at, f.scores_updated_at)`, each score becomes
     `s.score × 0.5^(days(T − s.scores_updated_at) / h) + f.score × 0.5^(days(T − f.scores_updated_at) / h)`,
     where `h` is the recent or long-term half-life. Set `scores_updated_at = T`.
   - Days are `EXTRACT(EPOCH FROM interval) / 86400`.
   - Pass both half-lives as query parameters from plan 30's
     `POPULARITY_TASTE_HALF_LIFE_DAYS.recent` and `.longTerm`. Never repeat the numbers here.
1. Delete the old-channel rows just merged.
1. Move the rest: `UPDATE stats_taste_profile SET channel_id = $to WHERE channel_id = $from`.

This code reads `listener_id` values already stored in event, taste, and hidden rows and never names
the listener mapping table (plan 12's lint rule and source-guard test apply).

## Why listener-linked rows are not journaled

The journal (`channel_merge_journal`) is kept indefinitely. Journaling listen events or taste rows
would keep listening history past the retention window and past a confirmed opt-out, both of which
the explanation promises to delete. Reverting them could also fail outright: a listener who opts
out after the merge no longer has the mapping row those rows reference.

So these rows move one way. A revert restores the anonymous totals and everything else in the
journal. The reverted channel's listeners rebuild its taste rows as they listen.

## Concurrency

The merge runs in one read-write transaction (READ COMMITTED) while listens and completion reports
may be written for both channels. It takes row locks, not the per-listener advisory lock from the
daily-totals contract: one merge can cover thousands of listeners, more advisory locks than one
transaction should hold.

### Why the overlap read stays correct

Each overlap read runs after the `FOR UPDATE` locks on both copies' existing daily rows:

- The write path inserts a listen event and adds to its daily rows in one transaction. So any event
  the overlap read can see belongs to a transaction that has committed, and its increment is
  already in the locked row the merge reads.
- A transaction that has not committed cannot get past the locked daily rows until the merge
  commits. The overlap read does not see its event, and its increment lands on the merged row
  afterwards.

So the merge subtracts only listeners already counted in both summed rows. A listen that races the
merge can leave one duplicate count, but never removes a real listener:

- Its first-of-day check may have read the copy it was not on.
- It may land on the old copy's row after the merge deletes it.

A first-of-day row for the survivor can be created after the locks are taken (there was no row to
lock). The merge's `journaledInsert` for that day then fails with a unique violation. The
transaction rolls back, `verifyAndApplyDuplicateMerges` logs it, and the merge stays `verified`
and is retried on the next run. Do not add retry logic.

### Lock order, so the merge never deadlocks with a listen

The write path's order is:

- **New listen:** insert the event, then upsert the item daily row, then the channel daily row,
  then the taste rows.
- **Completion report:** update the event row, then the daily rows.

The merge takes event rows, then item daily rows, then channel daily rows, and taste rows last. A
completion report on a matched old item therefore waits at its event row while holding nothing the
merge needs. Without the event-row lock, the report could hold the event row while waiting for a
daily row, and the merge's event `UPDATE` would wait for the report.

Before the taste steps, lock with `FOR UPDATE` the old channel's taste rows and the survivor rows
of the same listeners (not every survivor row).

### Range totals and the refresh job

The merge takes plan 42's per-type advisory locks, `'popularity_refresh:channel'` then
`'popularity_refresh:item'`, before any other lock. A refresh run then never writes an old copy's
range row between the merge's delete and its commit. The job holds one type's lock at a time and
takes no daily-row locks, so the two cannot wait on each other in a cycle.

## Journal allowlist — `channelMergeRowJournal.ts`

- `JOURNAL_TABLES`: remove `stats_aggregated_channel`, `stats_aggregated_item`,
  `stats_track_event_channel`, `stats_track_event_item`; add `stats_daily_channel`,
  `stats_daily_item`, `stats_popularity_channel`, `stats_popularity_item`.
- `PRIMARY_KEYS`: drop the four old entries; add `stats_daily_channel: ['channel_id', 'day']`,
  `stats_daily_item: ['item_id', 'day']`, `stats_popularity_channel: ['channel_id']`,
  `stats_popularity_item: ['item_id']`.
- **Exact restore over a recreated row.** After a merge, a listen to an unmatched old item can
  recreate an old daily row, and the refresh job can recreate the old channel's range row. A plain
  `insertFromImage` would then fail and block the revert.
  - For the four stats tables only, `insertFromImage` writes
    `INSERT … ON CONFLICT (<primary key columns>) DO UPDATE SET <each other column> = EXCLUDED.<column>`.
  - The row then equals the pre-merge image exactly.
  - Keep the set of such tables as a constant next to `PRIMARY_KEYS`. Every other table keeps the
    plain insert.
- The `FOR UPDATE` statements stay inline in `applyChannelMerge.ts`. Table names in any new SQL
  still pass through the fixed unions, never through input.

## Doc — `docs/features/POPULARITY-TRACKING.md`

Add a `## Channel merge` section, in present tense, covering:

- What moves (the table above, shortened).
- Daily rows are added per day. For days on or after the current UTC date minus
  `STATS_TRACK_EVENT_RETENTION_DAYS`, listeners with events on both copies that day are counted
  once (completions likewise), and older days are summed. The count never goes below either copy.
- Listeners who opted out after listening have no events left, so they may still count on both
  copies.
- The old copy's range rows are deleted. The refresh job rebuilds the survivor's range totals:
  windows within the hour, all-time within the hour or at the nightly full run.
- Daily rows and the deleted range rows are journaled, and a revert restores the exact pre-merge
  rows, even over a row recreated since.
- Listener-linked rows move without a journal and stay on the survivor after a revert.
- The hidden-wins rule.
- The per-type `'popularity_refresh:<type>'` locks the merge shares with the refresh job, and the
  merge's lock order.

In the daily-totals contract:

- Plan 10's doc names channel merge as the one writer that subtracts. Link that sentence to the new
  section. If the sentence is missing, add it to the "totals only go up" bullet.
- Add one line: channel merge writes daily rows under row locks instead of the per-listener lock.

## Tests

Add one case to `apps/api/src/test/channel-merge.integration.test.ts`, reusing its `seedShow` and
`seedAccount` helpers and its absorb flow (dry run, apply, revert). Pass
`statsTrackEventRetentionDays: 90` at every `verifyAndApplyDuplicateMerges` call in this file and
in `channel-merge-redirect.integration.test.ts`. Tests may write `stats_listener` and
`stats_listen_event` rows directly; plan 12's guard skips test files.

Dates are computed in the test from the current UTC date: `T1` = today − 2, `T2` = today − 3, and
`P` = today − 120 (past the 90-day boundary). Each event's `created_at` is noon UTC on its day, and
the test database's default partition holds them. Use a run-id suffix.

Seed:

- **Shows:** an old and a survivor show with one matched item pair (`oldItem` → `survivorItem`) and
  one unmatched old item (`oldOnlyItem`).
- **Listeners:** four accounts with listener ids `L1`–`L4`.
- **Listen events:**
  - `T1`: `L1` completed on `oldItem` and completed on `survivorItem`.
  - `T1`: `L2` not completed on `oldItem`, completed on `survivorItem`.
  - `T1`: `L3` on `oldOnlyItem` and on `survivorItem`, neither completed.
  - `T2`: `L4` on `oldItem`.
  - `P`: `L1` on `oldItem` and on `survivorItem`, neither completed.
- **Daily channel rows** `(listener_count, completion_count)`. The counts above the event-derived
  ones stand for listeners who have since opted out.
  - Old: `T1 (5, 2)`, `T2 (1, 0)`, `P (1, 0)`.
  - Survivor: `T1 (4, 2)`, `P (1, 0)`.
- **Daily item rows:**
  - `oldItem`: `T1 (2, 1)`, `T2 (1, 0)`, `P (1, 0)`.
  - `survivorItem`: `T1 (3, 2)`, `P (1, 0)`.
- **Range rows:**
  - Old channel `(1, 2, 3, 10)`, survivor channel `(4, 5, 6, 20)`.
  - `oldItem` `(1, 1, 1, 4)`, `survivorItem` `(2, 2, 2, 8)`.
- **Taste rows:** `L1` on both channels with different counts, times, and `scores_updated_at`;
  `L2` on the old channel only; `L3` on the survivor only, plus a hidden row for `L3` on the old
  channel.

After apply:

- **Channel overlap inside retention:** survivor `T1 (6, 3)`. That is 5 + 4 − 3 listeners
  (`L1`, `L2`, `L3` on both copies) and 2 + 2 − 1 completions (only `L1` completed on both).
- **Item overlap inside retention:** `survivorItem` `T1 (3, 2)`. That is 2 + 3 − 2 listeners (`L1`
  and `L2`; `L3` was never on `oldItem`) and 1 + 2 − 1 completions.
- **No survivor row:** survivor channel and `survivorItem` each get an inserted `T2 (1, 0)`.
- **Past retention, summed unchecked:** survivor channel and `survivorItem` `P (2, 0)`, although
  `L1` has events on both copies that day.
- No daily rows are left on the old channel or `oldItem`.
- The old channel's and `oldItem`'s range rows are gone. The survivor channel's and
  `survivorItem`'s range rows are unchanged (the test runs no refresh job).
- **Events:** every `oldItem` event points at `survivorItem` and the survivor channel. `L3`'s
  `oldOnlyItem` event is unchanged.
- **Taste rows:**
  - `L1` has one survivor taste row with summed counts, the earlier first and later last listen,
    and scores equal to the fade-and-add formula. The test computes the expected scores from
    `POPULARITY_TASTE_HALF_LIFE_DAYS` and compares with a small tolerance.
  - `L2`'s row is on the survivor unchanged.
  - `L3` has a hidden row on the survivor and no taste row on either channel.

Then, before the revert, recreate two rows as later writes would: insert `stats_daily_channel` for
the old channel on `T2` with `(7, 0)`, and `stats_popularity_channel` for the old channel with
`(0, 0, 0, 1)`.

After revert:

- Every daily row of both channels and both matched items equals its seeded value exactly. That
  includes the old channel's `T2 (1, 0)` over the recreated row, and no `T2` rows on the survivor
  channel or `survivorItem`.
- Every range row equals its seeded value exactly, including the old channel's `(1, 2, 3, 10)`.
- Events, taste rows, and the hidden row stay on the survivor.

The existing case's journal-count idempotency check keeps passing; nothing else in the file
changes. Plan 42's integration test covers rebuilding range totals from moved daily rows.

## Release scratchpad

```markdown
## Duplicate feed merges carry popularity and taste data

- Surfaces: workers (duplicate feed merge), management-api (merge revert)
- Change: absorbing a duplicate channel adds its anonymous daily listener and completion totals
  to the survivor, per day. For days still inside `STATS_TRACK_EVENT_RETENTION_DAYS`, a listener
  with listen events on both copies that day counts once; older days are added as they are. The
  merged-away copy's range totals are removed, and the hourly and nightly popularity refresh
  rebuilds the survivor's day, week, month, and all-time totals from the merged daily rows. Listen
  events for matched episodes move to the survivor, and each listener's taste profile rows for the
  two copies merge into one (counts added, scores faded to the same time and added). A show
  hidden from a taste profile stays hidden on the survivor. Reverting a merge restores the exact
  pre-merge daily and range rows; listen events and taste rows stay on the survivor.
- Who notices: operators reviewing merges; listeners see Top lists and their Taste Profile treat
  the two copies as one show
- Operator steps: none
```
