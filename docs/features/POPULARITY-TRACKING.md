# Popularity Tracking

Popularity Tracking is the opt-in that lets a Premium member's listening count toward public
popularity sorts and build that member's Taste Profile. This document fixes what it stores, how
long each store lives, and the rules every writer and reader follows. Code comments point here.

## Design Questions, Answered

- **Why not one aggregate row per listener and entity?** A single row per pseudonymous id and
  entity cannot tell a relisten from a first listen, holds no listening time or completion, and
  keeps nothing per listener that lasts. Rolling counters refreshed for a top slice of entities
  leave everything else stale. Rotating the pseudonymous id adds no privacy when events also carry
  a stable mapping id, and it lets the same account count again after each rotation.
- **What is the better practice?** Three stores, each with its own lifetime: raw listen events
  linked to a pseudonymous listener id and kept for the retention setting; per-listener, per-show
  taste profiles with decaying recent and long-term scores; and anonymous daily totals kept
  forever. Range sorts read a small derived table rebuilt from the daily totals.
- **Can it support recommendations?** Yes. Taste profiles are the input for a show-to-show "also
  listened" job; the retained raw events allow re-deriving or tuning scores; daily totals keep
  popularity history without listener links.
- **Is the privacy layer good enough?** Yes, as a layer, not as anonymity. Every linked row stores
  only a random listener id. The account-to-listener mapping lives in one table, in its own
  schema, that only account-facing ORM code reads. The read-only database role has no access to
  that schema, and the management database browser does not list it. Anyone with the read-write credentials can still
  join it, which is why copy never calls the id anonymous.
- **How fast do rows grow?** Raw events are bounded by retention and dropped by whole month. Taste
  rows grow with listeners × shows, not with time. Daily totals grow with active entities × days;
  at about 35,000 active entities a day and roughly 80 bytes per row with its index, that is about
  1 GB a year. Folding old days into monthly rows is an option for later.
- **Ship before launch?** Yes. Nothing is imported from v4.
- **Not built yet:** the nightly "also listened" job and the "Listeners Also Like" and "For You"
  surfaces.

## Stores and Lifetimes

| Store                  | Linked to a listener?              | Kept for                          | Grows with                         |
| ---------------------- | ---------------------------------- | --------------------------------- | ---------------------------------- |
| Listen and open events | Yes, by a pseudonymous listener id | The retention setting             | Time; old data dropped by month    |
| Taste profile          | Yes                                | Until opt-out or account deletion | Listeners × shows they played      |
| Daily totals           | No                                 | Forever                           | Active entities × days             |
| Range totals           | No                                 | Rebuilt from daily totals         | Entities with any counted activity |

## Tables

All time columns are `timestamp with time zone`. Every table is in `public` except the mapping.

- **`listener_identity.stats_listener`** maps an account to its listener id: `listener_id`
  (random v4 uuid, primary key), `account_id` (unique, cascades from `account`), `created_at`. The
  id never rotates; it disappears only when the account is deleted or the listener opts out. Only
  `podverse_app_read_write` has `USAGE` on the `listener_identity` schema and privileges on the
  table; `podverse_app_read` has neither. Grants and default privileges on `public` never reach
  this schema, so bootstrap re-grants and baseline loads cannot widen access to it.
- **`stats_listen_event`** has one row per counted listen: `id`, `created_at`, `listener_id`,
  `channel_id` (the item's channel), `item_id` (for a clip, the clip's item), `clip_id` (clip
  listens only), `client_listen_id` (device-generated, so a retry or a later completion report
  finds the same row), `seconds_heard`, and `completed`. The primary key is `(created_at, id)`.
  Add by RSS listens are never stored: they have no item row.
- **`stats_open_event`** has one row per profile or playlist open: `id`, `created_at`,
  `listener_id`, and exactly one of `account_id` (the profile opened) or `playlist_id`. Opens
  count toward popularity and never feed taste profiles.
- **`stats_taste_profile`** has one row per listener and show: `listen_count`,
  `completion_count`, `first_listened_at`, `last_listened_at`, `recent_score`,
  `long_term_score`, and `scores_updated_at` (the time both scores were last faded to).
- **`stats_taste_profile_hidden`** is Hidden From Taste Profile: `listener_id`, `channel_id`,
  `hidden_at`.
- **`stats_daily_{channel,item,clip,playlist,account}`** hold anonymous daily totals:
  `<type>_id`, `day` (UTC date of the counted events' `created_at`), `listener_count`, and, on
  the channel, item, and clip tables, `completion_count`. The primary key is `(<type>_id, day)`.
- **`stats_popularity_{channel,item,clip,playlist,account}`** hold range totals: `<type>_id`,
  `day_count`, `week_count`, `month_count`, and `all_time_count`, each with a descending index
  for sorts.

Every entity column cascades from its entity, and every listener-linked row cascades from
`listener_identity.stats_listener`. Event ids come from a sequence default rather than an identity column, so rows
can move between partitions with their ids intact.

### Taste Profile Rows Are Shows

Taste profile rows exist for shows only: a podcast or album is the item's channel, and an artist
is a `publisher-music` channel. Episodes and tracks never get rows. A music listen updates the
album's row and, when the album's `channel_publisher_remote_item.feed_guid` matches a channel's
`podcast_guid`, that artist channel's row too. The write path owns the decay formula and
half-lives; readers fade a stored score to "now" with the same formula before comparing.

## Listener Id and Its Separation

- One `listener_identity.stats_listener` row exists per account while it has tracking data. The write path creates
  it on the first counted listen or open, not at opt-in.
- Only ORM services under `packages/orm/src/services/stats/listenerIdentity/` (the listener
  identity zone) read or write `listener_identity.stats_listener`. `StatsListenerService`, which maps an account to
  its listener id, stays inside the zone and is not exported from `@podverse/orm`. The zone
  services the ORM index does export take an `account_id` and never return a `listener_id`.
- Everything else — workers, the management API, popularity readers, the range-totals job, and
  recommendation jobs — works from `listener_id` values already stored in event and taste rows and
  never joins the mapping. A lint rule and a source guard test enforce this.
- Opt-out deletion is one statement: delete the account's `listener_identity.stats_listener` row. Cascades remove
  its listen events, open events, taste rows, and hidden rows. Daily and range totals have no
  listener column and stay.
- Tracking that stops without the listener choosing it (membership lapse, a new explanation
  version waiting) deletes nothing; the write path stops writing.

### The Migrator Creates the Schema

The migration that creates `listener_identity` runs as the app migrator role, which needs
`CREATE` on the app database. DB bootstrap grants it. A database created before that grant gets it
by running the `ops-db-rebootstrap-roles` job once, before `ops-db-migrate-app` applies the
migration:

```bash
kubectl -n <namespace> create job --from=cronjob/ops-db-rebootstrap-roles ops-db-rebootstrap-roles-manual
kubectl -n <namespace> create job --from=cronjob/ops-db-migrate-app ops-db-migrate-app-manual
```

Wait for the first job to finish before starting the second.

## Daily Totals Are Filled at Write Time

- The listen and open write paths update daily totals in the same transaction that inserts the
  event. No job builds daily totals from events.
- Once the listener id is known, and before it reads any of the listener's events, the
  transaction takes
  `SELECT pg_advisory_xact_lock(hashtextextended('popularity_listen:' || $listener_id::text, 0))`,
  so one listener's writes are serialized and the first-of-day checks cannot race. Every writer of
  a listener's events or daily rows takes this same lock; `lockListener` in the listener identity
  zone runs it.
- The channel merge writes daily rows under row locks instead of the per-listener lock; see
  [Merge Locks](#merge-locks).
- Server receive time (`created_at`) is the only clock. The day is the UTC date of the event's
  `created_at`. Reports carry no device time, so a report sent late (for example after offline
  time) counts on the day it arrives.
- **Listeners:** before inserting a listen, the write path checks whether the listener already has
  a listen event that UTC day for the same item; likewise for the channel and, for clip listens,
  the clip (one query on `stats_listen_event_listener_created_idx`). For each entity where it is
  the first, it upserts the daily row with `listener_count + 1`:
  `INSERT … VALUES (…, 1, 0) ON CONFLICT (<type>_id, day) DO UPDATE SET listener_count = <table>.listener_count + EXCLUDED.listener_count, completion_count = <table>.completion_count + EXCLUDED.completion_count`.
- **Completions:** when a listen is stored completed, or an existing row turns from not completed
  to completed, `completion_count` goes up by 1 for each of its entities on the event's own day,
  unless the listener already has a completed listen of that entity that day.
- **Opens:** same lock, a first-of-day check on `stats_open_event`, and `listener_count + 1` on
  `stats_daily_playlist` or `stats_daily_account`.
- Totals only go up, with one exception. Opt-out, hiding a show, retention drops, and event
  updates never subtract. Deleting an item, clip, channel, playlist, or account removes its own
  daily rows by cascade.
- The exception is the channel merge; see [Channel Merge](#channel-merge).
- Listens to a hidden show still count; hiding affects only taste rows.

## Range Totals Are Rebuilt by a Job

- A job rebuilds `stats_popularity_*` from the daily tables. A window of `N` days covers
  `day >= (current UTC date - N)`, which always spans at least the last `N × 24` hours. The
  lookbacks live in `STATS_POPULARITY_RANGE_LOOKBACK_DAYS` in `@podverse/helpers`: day 1, week 7,
  month 30.
- Each window count is the sum of `listener_count` over the window, so a listener who returns on
  three days counts three times. `all_time_count` is the sum over every daily row.
- An hourly run refreshes every entity with a daily row inside the month window and resets to
  zero the windows of any popularity row with no daily row in it; a nightly full run recomputes
  every entity. Details and schedules are in [Range Totals](#range-totals).

## Public range sorts

Top lists for channels, items and live items, clips, playlists, and profiles read the
`stats_popularity_*` table for their type through `StatsPopularity<Type>Service`.

- `range` maps to a column through `STATS_POPULARITY_COUNT_FIELDS`; ties order by the entity id.
- Channel and item Top lists include only entities whose count for the chosen range is above zero
  and pad a short page with recent entities (`fillTopPage` in `@podverse/helpers`). Clip, playlist,
  and profile Top lists list every row and do not pad.
- Requests never sum daily rows; freshness follows the refresh job's schedule.

## Channel Merge

When a duplicate channel is absorbed into a survivor (`verifyAndApplyDuplicateMerges`), its
popularity data moves to the survivor in the merge transaction. A repoint merge keeps one channel
and changes no ids, so it moves nothing.

| Data                                | What happens                                 | Journaled |
| ----------------------------------- | -------------------------------------------- | --------- |
| `stats_daily_channel`               | Added into the survivor's rows per day       | Yes       |
| `stats_daily_item`                  | Same, per matched item pair                  | Yes       |
| `stats_popularity_channel`, `_item` | The old copy's rows are deleted              | Yes       |
| `stats_listen_event`                | Events of matched items move to the survivor | No        |
| `stats_taste_profile`               | Merged into the survivor's rows              | No        |
| `stats_taste_profile_hidden`        | Moved to the survivor                        | No        |

Events of unmatched old items stay, since their item stays in the old channel. Clip daily and
range rows need nothing: clips keep their ids when they move to the survivor item. Open events,
playlist and profile totals are not channel data.

### Merged Daily Totals

- Each old daily row is added into the survivor's row for the same `day`, or moved when the
  survivor has none, and then deleted.
- For days on or after the current UTC date minus `STATS_TRACK_EVENT_RETENTION_DAYS`, listeners
  with listen events on both copies that UTC day are counted once, and so are listeners with a
  completed event on both. Older days are summed without a check, since their events are gone.
- The merged count never goes below either copy, and completions never exceed listeners.
- Listeners who opted out after listening have no events left, so they may still count on both
  copies. The merge only subtracts listeners whose events on both copies are still stored, so
  it never undercounts.
- The channel's overlap is read before any item's events move. Matched item pairs follow in
  `item_merge_map` order, each read before its own events move, so several old items matched
  to one survivor item are each checked against everything merged before them.

### Merged Range Totals

The old copy's `stats_popularity_channel` and `stats_popularity_item` rows are deleted, which
takes it out of every range sort at once. The merge never writes the survivor's range rows. The
[range-totals job](#range-totals) rebuilds them from the merged daily rows: the day, week, and
month windows within the hour, and the all-time total within the hour or at the nightly full run.

### Merge Journal and Revert

Daily rows and the deleted range rows are journaled in `channel_merge_journal`, so a revert
restores the exact pre-merge rows. A row recreated since the merge (a listen to an unmatched old
item, or a refresh writing the old copy's range row) is overwritten with the pre-merge image.

Listen events, taste rows, and hidden rows move without a journal and stay on the survivor after
a revert. The journal is kept indefinitely, so journaling them would keep listening history past
retention and past an opt-out. After a revert, the old channel's listeners rebuild its taste rows
as they listen.

### Merged Taste and Hidden Rows

- **Hidden wins:** a listener who hid either copy has the survivor hidden, and both taste rows
  are deleted.
- Otherwise two taste rows for one listener become one on the survivor. Counts are added,
  `first_listened_at` is the earlier and `last_listened_at` the later. Each score fades to the
  later `scores_updated_at` with the [taste half-lives](#taste-rows) and the two are added.
- An old-copy row with no survivor row moves to the survivor unchanged.

### Merge Locks

The merge runs in one read-write transaction. It takes row locks instead of the per-listener lock,
because one merge can cover more listeners than one transaction should hold advisory locks for.
In order:

1. `SELECT pg_advisory_xact_lock(hashtextextended('popularity_refresh:channel', 0))`, then the
   same with `'popularity_refresh:item'`. The range-totals job takes these per-type locks, so a
   refresh never writes an old copy's range row between the merge's delete and its commit. The
   job holds one type's lock at a time and takes no daily-row locks, so the two never wait on
   each other in a cycle.
1. `FOR UPDATE` on the matched old items' listen events, then on both copies' item daily rows,
   then on both channels' daily rows. This follows the [write order](#write-order), so a
   completion report on a matched item waits at its event row while holding nothing the merge
   needs.
1. Before the taste steps, `FOR UPDATE` on the old channel's taste rows and on the survivor rows
   of the same listeners and of listeners who hid the old channel, not on every survivor row.

Every overlap read runs after the daily-row locks, so the merge subtracts only listeners already
in both summed rows. A listen that races the merge can leave one duplicate count but never removes
a real listener. A first-of-day survivor row created after the locks makes the merge's insert
fail with a unique violation; the merge rolls back, stays `verified`, and is retried on the next
run.

## Partitions and Retention

- `stats_listen_event` and `stats_open_event` are partitioned by range on `created_at`. Events
  land in monthly partitions named `<parent>_pYYYYMM`, created ahead of time by a job (see
  [Partitions and Retention Job](#partitions-and-retention-job)). The
  default partitions (`stats_listen_event_default`, `stats_open_event_default`) are a safety net
  that stays empty while the job runs.
- Retention removes whole partitions. The app addresses partitions only through the parent table.

### Partition Functions

Both functions are `SECURITY DEFINER`, owned by the table owner, and executable only by
`podverse_app_read_write`, so workers create and drop partitions without owning the tables or
needing another role. Both accept only `stats_listen_event` and `stats_open_event` and raise for
any other table.

- **`stats_event_ensure_month_partition(parent_table, month_start)`** returns `true` when it
  creates `<parent>_pYYYYMM` and `false` when the partition already exists. `month_start` must be
  the first of a month. Bounds are UTC midnight of that month and the next. It locks the parent,
  which also locks every partition, so concurrent inserts wait. When the default partition already
  holds rows for that month, it detaches the default, creates the month partition, moves those
  rows into it with their ids, and reattaches the default; no row is lost.
- **`stats_event_drop_month_partitions_before(parent_table, cutoff)`** drops every
  `<parent>_pYYYYMM` partition whose upper bound is on or before `cutoff` (UTC midnight), deletes
  rows older than `cutoff` from the default partition, and returns how many partitions it
  dropped. A partition whose range reaches past `cutoff` is never touched, so a cutoff inside a
  month needs a separate row delete for that month.

## Cost and Growth

- Listen events cost about 140 bytes a row with indexes. At 10,000 listeners and 10 listens a day
  each, that is about 14 MB a day, or about 1.3 GB at 90 days of retention.
- Taste rows grow with listeners × shows played, not with time.
- Daily totals grow with active entities × days: about 1 GB a year at 35,000 active entities a
  day.
- Range totals hold one row per entity with any counted activity.

## Write Path and Counted-Listen Rule

`StatsListenWriteService` and `StatsOpenWriteService` record reports. They live in the listener
identity zone, take an `account_id`, run each report in one read-write transaction, and return a
result such as `counted` or `below_threshold`, never a listener id.

### Consent Under a Row Lock

Each report first reads the account's decision from `account_settings` `FOR SHARE` and returns
`not_allowed` unless it accepted the current explanation version. Opting out updates that row and
deletes the `listener_identity.stats_listener` row in the same transaction, so a report that
started before an opt-out cannot recreate the listener id afterwards.

### What Counts as a Listen

- A listen counts once 60 seconds or 25% of it has been heard, whichever comes first. Seconds are
  media seconds actually played, not wall-clock time or seek distance. An unknown duration uses
  the 60-second rule. Every surface uses the same rule: `popularityListen` in `@podverse/helpers`.
- A clip listen measures against the clip's span, or from its start to the end of the episode
  when it has no end time. A clip whose episode was removed is not counted.
- `seconds_heard` is stored in whole seconds, at most the duration rounded up.

### One Report per Listening Session

- The device generates a `client_listen_id` for each listening session and sends it with every
  report for that session. The first report that meets the rule stores the event. Later reports
  for the same session raise `seconds_heard` and mark it finished; they never lower either, never
  count the listen twice, and skip the rule and the daily cap.
- A session is matched among the listener's events stored in the last seven days, by receive
  time. A session first stored earlier than that is a new listen.
- A report that does not meet the rule and matches no stored session stores nothing. It does not
  create a listener id either: one is created only for a report that stores an event.

### One Clock

Server receive time is the only clock; reports carry no device time. The transaction's `now()`
becomes the event's `created_at`. Its UTC date is the daily-total day, it fills the taste rows'
`first_listened_at` and `last_listened_at`, and it is the time taste scores fade to. A report sent
after offline time counts, and decays, from when it arrives. A completion reported later counts on
the UTC day of the event it completes.

### Daily Cap

`STATS_LISTEN_DAILY_CAP`, a server setting, caps stored listens per listener per UTC day. A new
session past the cap returns `daily_cap_reached` and stores nothing. Reports for an already-stored
session are not capped.

### Write Order

A new listen inserts the event, then upserts the item, channel, and (clip listens) clip daily
rows, then the taste rows. A completion updates the event, then the daily rows, then the taste
rows. The channel merge takes its locks in the same order.

### Taste Rows

- **Shows:** the item's channel (a podcast or an album). A music album listen also updates each
  artist channel its publisher remote items point to.
- **Weights:** 1 per counted listen and 1 more when it finishes (`POPULARITY_TASTE_LISTEN_WEIGHT`,
  `POPULARITY_TASTE_COMPLETION_WEIGHT`).
- **Half-lives:** 14 days for `recent_score` and 180 days for `long_term_score`
  (`POPULARITY_TASTE_HALF_LIFE_DAYS`).
- **Update at time `t`:** when `t` is on or after `scores_updated_at`,
  `score = score × 0.5^(days(t − scores_updated_at) / h) + weight`. When `t` is earlier (the
  completion of an event stored before the row's last update),
  `score = score + weight × 0.5^(days(scores_updated_at − t) / h)`. Either way
  `scores_updated_at` becomes the later of the two times.
- **Completions** use the event's `created_at` as `t`, change only rows that already exist, and
  leave listen counts and listen times as they are.
- **Hidden shows** are skipped: listening neither creates nor changes their rows. The listen still
  counts toward daily totals.
- **Pause and resume:** while tracking is stopped without the listener choosing it, no report is
  accepted, so taste rows stay as they are. The next counted listen fades each score across the
  whole gap before adding to it.

### Opens

- A profile or playlist open counts once per opener, entity, and UTC day. The first stores an
  open event and adds 1 to `stats_daily_account` or `stats_daily_playlist`; repeats return
  `unchanged`. Opening your own profile or playlist returns `own_content` and stores nothing.
- Opens never touch taste rows and have no daily cap; the API rate limit covers them.

## Client Listen Sending

Web and mobile measure media seconds actually heard with the shared tracker in
`packages/playback-core/src/listenSession.ts`. A position sample adds its forward change only
while playing and only when the change fits in the wall-clock time since the previous sample at
the playback rate, so seeks and source jumps add nothing.

Each load's `PlaybackLoadDecision.listenSession` starts a session, keeps it (the same media
moved to another file), or tracks nothing (Add by RSS, livestreams). A soundbite or chapter
counts toward its item; a clip counts toward the clip and closes when playback reaches its end.

A session sends its first report once `isCountedListen` holds for whole seconds heard, again on
first reaching 60 seconds when the first report was below 60, on completion, and on pause or end
after 60 more seconds. Every report repeats the session's `client_listen_id`.

Web sends reports directly from `apps/web/src/utils/statsTracking/statsTracking.ts` without
retry. The request body has no `listened_at`; the server stamps the time it receives the
report. Web sends no listen time. Profile and playlist opens go to `POST /stats/open`.

Mobile stores reports in the `stats_listen_outbox` SQLite table and sends them when online.
The request body has no `listened_at`. A replayed listen counts and fades from the time the
server receives it. `counted_at` stays on the row for the age rules and is not sent. 2xx
removes a row; 400, 403, 404, and 410 drop it; 401, 429, 5xx, and no response keep it for the
next drain. A row holding only an update is dropped 6 days after it counted, so it still
arrives inside the server's 7-day session lookup. An unsent first report is dropped 30 days
after it counted; that is the outbox's storage bound, not a server clamp. A declined
Popularity Tracking decision deletes the device's pending rows. Mobile records no profile or
playlist opens.

Both clients send only for a signed-in account whose Popularity Tracking decision allows it; the
server re-checks on every report.

Listening that plays while the mobile app's JavaScript is not running (a car-started source
before the app wakes) is not counted.

## Jobs and Schedules

This section covers the partition, retention, and range-totals jobs and when each runs.

### Partitions and Retention Job

The worker command `statsEventPartitionsMaintain` keeps the event partitions in shape. It runs
for both `stats_listen_event` and `stats_open_event`, and it creates partitions before it drops
any, so a failed drop never leaves a coming month without a partition.

- **Months ahead:** each run ensures the current UTC month and the next two. Partitions exist
  about two months before any row needs them, so an outage of weeks still routes rows to dated
  partitions. Rows that reach the default partition move into their month when it is created.
- **Cutoff:** the first day of the UTC month that contains `now − STATS_TRACK_EVENT_RETENTION_DAYS`
  (absolute 24-hour days, 90 by default). The job drops every partition whose upper bound is on or
  before the cutoff and deletes older rows from the default partition.
- **Whole months only:** a dropped partition's rows are all older than its upper bound, which is
  on or before the cutoff, which is on or before `now − retention`. Every removed row is older
  than the window. The job never deletes rows from a dated partition that reaches past the
  cutoff, so a row stays at least the retention window and at most about a month longer, plus up
  to a day until the next run: 90 to about 122 days at the default.
- **Worked example:** a run at `2026-10-21T03:30Z` with 90 days computes `now − 90 days` as
  `2026-07-23`, so the cutoff is `2026-07-01`. June 2026 and earlier are dropped. July stays until
  the run on or after `2026-10-30`, when `now − 90 days` reaches August and the cutoff becomes
  `2026-08-01`.
- **Schedule:** the CronJob `worker-stats-event-partitions` in `infra/k8s/base/cron` runs it daily
  at 03:30. After the migration first runs on a deployment, start it once by hand so dated
  partitions exist before the first listens arrive.
- **Manual run:** `npm run stats_event_partitions_maintain -w apps/workers` after
  `npm run build -w apps/workers`.
- **Local development:** nothing runs on a schedule locally, so events stay in the default
  partitions until the command is run.

### Range Totals

The worker command `statsPopularityRefresh` rebuilds the five `stats_popularity_*` tables from the
daily totals through `refreshStatsPopularity` in `@podverse/orm`. It is the only writer of range
values; a channel merge only deletes the merged-away copy's row.

- **One transaction per type:** channel, item, clip, playlist, then account. Each starts with
  `SELECT pg_advisory_xact_lock(hashtextextended('popularity_refresh:' || $type, 0))`, so two runs
  never interleave on one type, and a slow item pass never holds the channel lock. The job reads
  daily rows without locking them and takes no lock the write path takes, so listens are never
  blocked.
- **Unchanged rows stay put:** each upsert writes a row only when one of its four counts differs
  from the stored tuple, so an hourly run over a quiet hour writes nothing.
- **Recent mode** (default): for every entity with a daily row in the month window, it upserts
  the day, week, and month counts (zero for a shorter window with no rows). It recomputes
  `all_time_count` from every daily row only for entities with a daily row on today or yesterday,
  for rows it just inserted, and where the stored all-time total is below the new month count.
  Last, it zeroes the day, week, and month counts of popularity rows with no daily row in the
  month window; their all-time totals stay.
- **Why recent all-time totals stay exact:** the write path adds only to the current UTC date's
  daily row. Between two runs less than a day apart, only an entity with a row on today or
  yesterday can have gained listeners, so every other stored all-time total still equals its sum.
- **Full mode** (`-full`): recomputes all four counts for every entity with any daily row in one
  grouped pass per type, and sets all four to zero on popularity rows whose entity has no daily
  rows left. It catches what recent mode cannot see: a gap between runs longer than a day, and
  daily rows that a channel merge added to the survivor's past days.
- **Schedule:** two CronJobs in `infra/k8s/base/cron`. `worker-stats-popularity-refresh` runs
  recent mode hourly at :05, and `worker-stats-popularity-refresh-full` runs `-full` daily at
  00:45. `concurrencyPolicy: Forbid` keeps each from overlapping itself, and the per-type lock
  serializes the two when they meet between 00:05 and 00:45.
- **Manual run:** `npm run stats_popularity_refresh -w apps/workers` (append `-- -full` for every
  entity) after `npm run build -w apps/workers`.
- **Local development:** nothing runs on a schedule locally; run the command to refresh on demand.

## Consent Lifecycle

This section covers opting in, opting out and what it deletes, pausing without the listener
choosing it, and the Taste Profile routes a signed-in account uses to review and hide shows.

The account data export (`GET /account/download-data`) includes the Taste Profile, the Hidden From
Taste Profile list, and stored listen and open records under `popularity_tracking`. It never
includes the listener id. After an opt-out the section is empty.

### Opting In

- Tracking is opt-in and optional. A new account starts undecided
  (`listen_stats_accepted = null`, `allow_listen_stats = false`).
- `getPopularityTrackingChoice` in `@podverse/helpers` names the four states: undecided, allowed
  (Yes on the current explanation version), opted out (No), and stale acceptance (Yes on an older
  version).
- Writes need a Yes on the current version and the `trackStats` capability. The listener id is
  created at the first counted listen or open, not at the Yes.

### Opting Out Deletes Listening Data

- `PATCH /account-settings/listen-stats` with `accepted: false` records the No and, in the same
  transaction, deletes the account's `listener_identity.stats_listener` row
  (`ListeningDataDeletionService`). Cascades remove that listener's listen events, open events,
  Taste Profile rows, and Hidden From Taste Profile rows right away.
- Daily and range totals have no listener column and stay.
- A No from an account with no listener id deletes nothing and still records the decision.
- Turning tracking on again creates a new listener id at the next counted listen, so the Taste
  Profile and recommendations start from scratch.
- Deleting the account cascades the same way.
- The server takes no confirmation flag. Clients confirm before sending a No whenever
  `isPopularityTrackingOptOutDestructive` in `@podverse/helpers` is true, which is any recorded
  Yes, on any version.

### Pausing Without the Listener Choosing It

- A membership lapse, a removed `trackStats` override, or a new explanation version waiting for a
  Yes deletes nothing. Writes stop; the Taste Profile and hidden list stay; stored events still age
  out on retention.
- A later Yes resumes with the same listener id, and the next counted listen fades each taste
  score across the gap. A Yes never deletes.
- The Taste Profile endpoints keep working while tracking is paused, so a listener can still
  review and hide shows.

### Consent and the Write Path Under Locks

- The opt-out loads the `account_settings` row `FOR UPDATE`, records the No, takes the listener
  lock (`lockListener`), and deletes the listener row, all in one transaction.
- Inside its own transaction, before it looks up or creates a listener id, the listen and open
  write path re-reads `listen_stats_accepted` and `listen_stats_agreement_version` from
  `account_settings` `FOR SHARE` and writes nothing unless `isPopularityTrackingAllowed` holds for
  the current version.
- `FOR SHARE` waits for the opt-out's row lock, so a report that arrives during an opt-out reads
  the No after it commits and cannot create a fresh listener id. A report that locked first makes
  the opt-out wait, and the cascade then removes what it wrote.

### Taste Profile and Hidden From Taste Profile

Signed-in accounts read and edit their own Taste Profile here. A paused listener, including one
whose membership has lapsed or whose explanation version is still waiting, can list shows and hide
them. An opted-out account has no listener row, so both lists are empty. Responses carry channel
data and counts only.

- `GET /account/taste-profile` returns the Taste Profile, newest `last_listened_at` first, then
  `channel_id` descending. `page` starts at 1. `limit` defaults to 20 and stops at 50.
- `GET /account/taste-profile/hidden` returns Hidden From Taste Profile, newest `hidden_at` first,
  then `channel_id` descending, with the same paging.
- `POST /account/taste-profile/hide` deletes the show's taste row and inserts a hidden row. Both
  writes run under the listener lock (`lockListener`). A show that is already hidden succeeds and
  stays as it is. Hide answers not found when the account has no listener row, when the show is in
  neither list, or when the channel is unknown. Daily and range totals stay as they are.
- Listening to a hidden show still counts in public totals. The listen write path skips that show,
  so the listen leaves its taste rows unchanged.
- `POST /account/taste-profile/unhide` takes the show off the hidden list. The body includes
  `add_to_taste_profile`. When that is true, unhide also inserts a fresh Taste Profile row with
  listen count 0, completion count 0, and both scores 0. When it is false, unhide only removes the
  hidden row, and a later listen can add the show again. Unhide of a show that is not hidden
  changes nothing, including when `add_to_taste_profile` is true. An unknown channel is not found.
- An added-back row stores the add-back time in `first_listened_at`, `last_listened_at`, and
  `scores_updated_at`. The list reports both listen times as null while `listen_count` is 0.
