**Cursor model:** Opus 5.5 · **Reasoning:** high

# 10 — Popularity tracking foundation: schema, partition functions, contracts doc

Add every new popularity-tracking table in one app linear migration: the listener-id mapping,
monthly-partitioned listen and open events, taste profile and Hidden From Taste Profile rows,
anonymous daily totals, and the derived range totals that public sorts read. Add the two
`SECURITY DEFINER` functions that create and drop event partitions under the existing roles.
Write `docs/features/POPULARITY-TRACKING.md`, the durable home for the contracts every later plan
in this set builds on (plans are deleted after the set lands; code comments point at the doc, not
at plans).

The old `stats_*` tables stay until plan 19 drops them, after every caller has moved.

## Rows

R1, R2, R6, R7, R8, R9, R10, R11, R12, R14, R15, R16, R20, R21, R22, R24, R26, R28, R29, R30, R41, R50, R51, R53, R65, R69, R70

## Runs after

none

## Files

- `infra/k8s/base/ops/source/database/linear-migrations/app/NNNN_popularity_tracking_foundation.sql` (new; `NNNN` is the next free app number when this runs — `0021` at planning time, but two other active sets also plan a `0021`, so list the directory first)
- `infra/k8s/base/db/source/bootstrap/0004_app_linear_baseline.sql.gz` (regenerated)
- `infra/k8s/base/db/source/bootstrap/0005_management_linear_baseline.sql.gz` (regenerated)
- `infra/k8s/base/api/source/api.env` (`API_EXPECTED_MIGRATION_FILENAME` only)
- `infra/k8s/base/ops/kustomization.yaml` (`podverse-ops-migration-scripts`: the `API_EXPECTED_MIGRATION_FILENAME` literal and the app migration `files` entry only)
- `docs/features/POPULARITY-TRACKING.md` (new)
- `apps/api/src/test/stats-foundation-schema.integration.test.ts` (new)

## Questions the request asked, answered

Copy these answers, shortened, into the doc's opening section so they outlive the plan.

- **How good is today's tracking (R1, R14)?** Not good enough for the stated goals. It keeps one
  row per pseudonymous id per entity, so it cannot tell a relisten from a first listen, holds no
  listening time or completion, and keeps nothing per listener that lasts. The aggregate job
  refreshes only the top 500 entities and is never scheduled, so deployed counts never move and
  raw rows are never deleted. The 7-day id rotation adds no privacy (events also carry the stable
  mapping row id) and lets the same account count again after each rotation.
- **Better practice (R6, R7, R15)?** Three stores, each with its own lifetime: raw listen events
  linked to a pseudonymous listener id and kept for the retention setting; per-listener, per-show
  taste profiles with decaying recent and long-term scores; and anonymous daily totals kept
  forever. Range sorts read a small derived table rebuilt from the daily totals.
- **Can it support recommendations later (R2, R12)?** Yes. Taste profiles are the input for a
  later show-to-show "also listened" job; 90 days of raw events allow re-deriving or tuning
  scores; daily totals keep popularity history without listener links.
- **Is the privacy layer good enough (R8, R9, R10)?** Yes, as a layer, not as anonymity. Every
  linked row stores only a random listener id. The account-to-listener mapping lives in one table
  that only account-facing ORM code reads (plan 12 enforces this in lint and a test), the
  read-only database role cannot select from it, and the management database browser does not
  list it. Anyone with the read-write credentials can still join it, which is why copy never
  calls the id anonymous.
- **Row growth (R11)?** Raw events are bounded by retention and dropped by whole month. Taste rows
  grow with listeners × shows, not with time. Daily totals grow with active entities × days; at
  about 35,000 active entities a day and roughly 80 bytes per row with its index, that is about
  1 GB a year. Folding old days into monthly rows is a later option, not part of this set.
- **Ship before launch (R16)?** Yes; the operator chose to build the foundation before the move
  from v4 to next gen. Nothing is imported from v4 (R50), and the old tables and their data are
  dropped (R48, plan 19).
- **Deferred (R30):** the nightly "also listened" job and the "Listeners Also Like" / "For You"
  surfaces. Close records them in a deferred summary.

## Migration

Greenfield-only (**linear-sql-greenfield-only**): no `IF NOT EXISTS`, no catalog probes in the
migration body. Header comment: one or two sentences naming the stores and pointing at
`docs/features/POPULARITY-TRACKING.md`. Follow the style of `0019_account_content_log.sql`
(inline named constraints, then indexes, then grants). Postgres is 18.3.

Nothing is deployed to production and every alpha database and device can be wiped (R65), so
the migration only creates tables and functions: no compatibility columns, no data conversion, and
no cleanup of existing rows.

Use `timestamp with time zone` for every time column. Event ids use an explicit sequence default
(`bigint DEFAULT nextval('public.<table>_id_seq')`), not an identity column, so the partition
move path below can copy rows between tables without identity rules getting in the way.

### `stats_listener` — the mapping (R28, R29, R51)

| Column | Type | Notes |
| --- | --- | --- |
| `listener_id` | `uuid DEFAULT gen_random_uuid()` | primary key; random v4, never derived from the account |
| `account_id` | `integer NOT NULL` | unique; FK `account(id) ON DELETE CASCADE` |
| `created_at` | `timestamptz DEFAULT now() NOT NULL` | |

- Permanent: nothing rotates it. It disappears only when the account is deleted or when the
  listener confirms opting out (area G deletes this row; the cascades below remove every linked
  row). Turning tracking on again later creates a new id, which matches "recommendations start
  from scratch".
- Grants: `SELECT, INSERT, DELETE, UPDATE` to `podverse_app_read_write`. Then
  `REVOKE ALL ON TABLE public.stats_listener FROM podverse_app_read;` — default privileges grant
  the read role `SELECT` on new tables, and the read role must not see the mapping. ORM code that
  reads it uses the read-write data source.

### `stats_listen_event` — one row per counted listen (R20, R21, R22)

`PARTITION BY RANGE (created_at)`.

| Column | Type | Notes |
| --- | --- | --- |
| `id` | `bigint NOT NULL DEFAULT nextval('public.stats_listen_event_id_seq')` | |
| `created_at` | `timestamptz DEFAULT now() NOT NULL` | server receive time, the only clock: partition key, the daily-totals day, and the time taste scores fade from |
| `listener_id` | `uuid NOT NULL` | FK `stats_listener(listener_id) ON DELETE CASCADE` |
| `channel_id` | `integer NOT NULL` | FK `channel(id) ON DELETE CASCADE`; the item's channel |
| `item_id` | `integer NOT NULL` | FK `item(id) ON DELETE CASCADE`; for a clip, the clip's item |
| `clip_id` | `integer` | FK `clip(id) ON DELETE CASCADE`; set only for clip listens |
| `client_listen_id` | `uuid` | device-generated id for this listen, so a retry or a later completion report finds the same row |
| `seconds_heard` | `integer DEFAULT 0 NOT NULL` | `CHECK (seconds_heard >= 0)` |
| `completed` | `boolean DEFAULT false NOT NULL` | |

- Primary key `(created_at, id)`: a partitioned table's keys must include the partition key, and
  the leading `created_at` also serves day-range scans.
- No device time column. Reports carry no listen time, so a stored device time would always equal
  `created_at`.
- Indexes, created on the parent so every partition gets them:
  - `stats_listen_event_listener_created_idx (listener_id, created_at)` — daily cap, first-listen
    checks, completion lookups by `client_listen_id`, opt-out cascade.
  - `stats_listen_event_item_id_idx (item_id)` and `stats_listen_event_channel_id_idx (channel_id)`.
  - `stats_listen_event_clip_id_idx (clip_id) WHERE clip_id IS NOT NULL`.
  - The entity indexes serve FK cascades and the channel merge, including its same-day listener
    overlap count over events inside retention.
- Default partition: `CREATE TABLE public.stats_listen_event_default PARTITION OF public.stats_listen_event DEFAULT;`
  No dated partitions in the migration: a date computed from `now()` would make the generated
  baseline differ by the day it was built. Area D's job creates monthly partitions through the
  function below.
- Grants on the parent and the sequence, matching `0019`. The app addresses partitions only
  through the parent, so partitions created at runtime need no grants.
- Add by RSS listens are never stored here: `item_id` is required and Add by RSS items have no
  database row.

### `stats_open_event` — profile and playlist opens (popularity only)

`PARTITION BY RANGE (created_at)`, same partition scheme, default partition
`stats_open_event_default`.

| Column | Type | Notes |
| --- | --- | --- |
| `id` | `bigint NOT NULL DEFAULT nextval('public.stats_open_event_id_seq')` | |
| `created_at` | `timestamptz DEFAULT now() NOT NULL` | partition key |
| `listener_id` | `uuid NOT NULL` | FK `stats_listener ON DELETE CASCADE` |
| `account_id` | `integer` | the profile that was opened; FK `account(id) ON DELETE CASCADE` |
| `playlist_id` | `integer` | FK `playlist(id) ON DELETE CASCADE` |

- `CHECK (num_nonnulls(account_id, playlist_id) = 1)`; primary key `(created_at, id)`.
- Indexes: `(listener_id, created_at)`; `(account_id) WHERE account_id IS NOT NULL`;
  `(playlist_id) WHERE playlist_id IS NOT NULL`.
- Opens never feed taste profiles (R43); they exist so a profile or playlist counts each opener
  once per day.

### `stats_taste_profile` — one row per listener and show (R24, R41)

| Column | Type | Notes |
| --- | --- | --- |
| `listener_id` | `uuid NOT NULL` | FK `stats_listener ON DELETE CASCADE` |
| `channel_id` | `integer NOT NULL` | FK `channel ON DELETE CASCADE` |
| `listen_count` | `integer DEFAULT 0 NOT NULL` | |
| `completion_count` | `integer DEFAULT 0 NOT NULL` | |
| `first_listened_at` | `timestamptz NOT NULL` | |
| `last_listened_at` | `timestamptz NOT NULL` | |
| `recent_score` | `double precision DEFAULT 0 NOT NULL` | short half-life score |
| `long_term_score` | `double precision DEFAULT 0 NOT NULL` | long half-life score |
| `scores_updated_at` | `timestamptz NOT NULL` | the time both scores were last faded to |

- Primary key `(listener_id, channel_id)`; index `stats_taste_profile_channel_id_idx (channel_id)`.
- Checks: counts `>= 0`, scores `>= 0`, `first_listened_at <= last_listened_at`.
- Rows are shows only (R41): a podcast or album is the item's channel; an artist is a
  `publisher-music` channel. Episodes and tracks never get rows. A music listen updates the
  album's row and, when the album's `channel_publisher_remote_item.feed_guid` matches a channel's
  `podcast_guid`, that artist channel's row too (area C writes this; state it in the doc). The
  decay formula and half-lives belong to the write path (area C, R25); readers fade a stored score
  to "now" with the same formula before comparing.

### `stats_taste_profile_hidden` — Hidden From Taste Profile

| Column | Type | Notes |
| --- | --- | --- |
| `listener_id` | `uuid NOT NULL` | FK `stats_listener ON DELETE CASCADE` |
| `channel_id` | `integer NOT NULL` | FK `channel ON DELETE CASCADE` |
| `hidden_at` | `timestamptz DEFAULT now() NOT NULL` | |

Primary key `(listener_id, channel_id)`; index `stats_taste_profile_hidden_channel_id_idx (channel_id)`.

### Daily totals — `stats_daily_{channel,item,clip,playlist,account}` (R26)

One table per entity type, so each has a real foreign key and readers keep one table per type as
they do today.

| Column | Type | Notes |
| --- | --- | --- |
| `<type>_id` | `integer NOT NULL` | `channel_id`, `item_id`, `clip_id`, `playlist_id`, or `account_id` (the profile opened); FK to that table `ON DELETE CASCADE` |
| `day` | `date NOT NULL` | UTC calendar day of the counted events' `created_at` |
| `listener_count` | `integer DEFAULT 0 NOT NULL` | distinct listeners counted that day |
| `completion_count` | `integer DEFAULT 0 NOT NULL` | channel, item, and clip tables only; distinct listeners who finished |

- Primary key `(<type>_id, day)`.
- Index `stats_daily_<type>_day_idx (day, <type>_id) INCLUDE (listener_count)` for window sums.
- Checks: counts `>= 0`; on the three listen tables also `completion_count <= listener_count`.

### Range totals — `stats_popularity_{channel,item,clip,playlist,account}`

Derived from the daily totals and rebuilt by a job (area D); public and management sorts read it
(areas E and F). Four columns, always recomputed from complete daily rows, take the place of the
17 rolling columns, so nothing goes stale.

| Column | Type | Notes |
| --- | --- | --- |
| `<type>_id` | `integer NOT NULL` | primary key; FK `ON DELETE CASCADE` |
| `day_count` | `integer DEFAULT 0 NOT NULL` | |
| `week_count` | `integer DEFAULT 0 NOT NULL` | |
| `month_count` | `integer DEFAULT 0 NOT NULL` | |
| `all_time_count` | `integer DEFAULT 0 NOT NULL` | |

Indexes: `stats_popularity_<type>_<range>_count_idx (<range>_count DESC, <type>_id)` for each of
`day`, `week`, `month`, `all_time`.

### Partition functions (R22, R53)

Two `plpgsql` functions, `SECURITY DEFINER`, `SET search_path = pg_catalog, public`, created in
this migration so they share the tables' owner. `REVOKE ALL ON FUNCTION … FROM PUBLIC;` then
`GRANT EXECUTE ON FUNCTION … TO podverse_app_read_write;`. The workers' existing read-write role
can then create and drop partitions without owning the tables and without a new role or
credentials.

- `public.stats_event_ensure_month_partition(parent_table text, month_start date) RETURNS boolean`
  - Accepts only `'stats_listen_event'` and `'stats_open_event'`; raises otherwise. Raises when
    `month_start` is not the first of a month.
  - Partition name `<parent>_pYYYYMM`. Bounds are UTC midnight timestamps
    (`month_start::timestamp AT TIME ZONE 'UTC'` up to the next month), never session-time-zone
    literals. Build DDL with `format('%I')` / `%L`.
  - Returns false when the partition already exists; otherwise creates it and returns true.
  - When the default partition already holds rows in that month (the job did not run in time),
    those rows end up in the new partition and none are lost. Lock the default partition first so
    concurrent inserts wait instead of landing in the gap. The mechanism (detach and reattach the
    default, or build a standalone table and attach it) is the implementer's choice; the
    integration test covers this path.
- `public.stats_event_drop_month_partitions_before(parent_table text, cutoff date) RETURNS integer`
  - Same allowlist. Drops every `<parent>_pYYYYMM` partition whose upper bound is on or before
    `cutoff` (UTC midnight) and returns how many it dropped, then deletes rows with
    `created_at < cutoff` from the default partition.
  - Never touches a partition whose range reaches past `cutoff`. How the job turns the retention
    setting into a cutoff (whole months only, or an extra row delete in the oldest month) is area
    D's choice; the function supports both.

## Contracts the doc fixes

`docs/features/POPULARITY-TRACKING.md` states these as rules, in present tense, with the table
names above. Later plans in the set build on them, and code comments point at the doc.

### Listener id and its separation

- One `stats_listener` row per account while it has tracking data. The write path creates it on
  the first counted listen or open, not at opt-in.
- Only ORM services under `packages/orm/src/services/stats/listenerIdentity/` (the listener
  identity zone) read or write `stats_listener`. `StatsListenerService`, which maps an account to
  its listener id, stays inside the zone and is not exported from `@podverse/orm`. The zone
  services the ORM index does export take an `account_id` and never return a `listener_id`.
  Everything else — workers, management API, popularity readers, the range-totals
  job, and the later recommendation jobs — works from `listener_id` values already stored in
  event and taste rows and never joins the mapping. Plan 12 enforces this.
- Opt-out deletion is one statement: delete the account's `stats_listener` row; cascades remove
  its listen events, open events, taste rows, and hidden rows. Daily and range totals have no
  listener column and stay.
- Tracking that stops without the listener choosing it (membership lapse, a new explanation
  version waiting) deletes nothing; the write path simply stops writing.

### Daily totals are filled at write time

Steps 04 (area C) and 05 (area D) build on this.

- The listen and open write paths (area C) update daily totals in the same transaction that
  inserts the event. No job builds daily totals from events.
- The transaction starts with `SELECT pg_advisory_xact_lock(hashtextextended('popularity_listen:' || $listener_id::text, 0))`
  so one listener's writes are serialized and the first-of-day checks cannot race. Every writer
  of a listener's events or daily rows takes this same lock.
- Server receive time (`created_at`) is the only clock. The day is the UTC date of the event's
  `created_at`. Reports carry no device time, so a report sent late (for example after offline
  time) counts on the day it arrives.
- **Listeners:** before inserting a listen, check whether the listener already has a listen event
  that UTC day for the same item; likewise for the channel and, for clip listens, the clip (one
  query on `stats_listen_event_listener_created_idx`). For each entity where it is the first,
  upsert its daily row with `listener_count + 1`:
  `INSERT … VALUES (…, 1, 0) ON CONFLICT (<type>_id, day) DO UPDATE SET listener_count = <table>.listener_count + EXCLUDED.listener_count, completion_count = <table>.completion_count + EXCLUDED.completion_count`.
- **Completions:** when a listen is stored completed, or an existing row turns from not completed
  to completed, add 1 to `completion_count` for each of its entities on the event's own day,
  unless the listener already has a completed listen of that entity that day.
- **Opens:** same lock, first-of-day check on `stats_open_event`, `listener_count + 1` on
  `stats_daily_playlist` or `stats_daily_account`.
- Totals only go up, with one exception. Opt-out, hiding a show, retention drops, and event
  updates never subtract. An item, clip, channel, playlist, or account deletion removes its own
  daily rows by cascade.
- **The exception is the channel merge.** When two copies of a channel merge, their daily rows for
  the same day are summed, and for every day still inside retention the merge subtracts the
  listeners who have listen events on both copies that UTC day (per channel pair and per matched
  item pair), so each listener counts once per entity per day. Days already past retention are
  summed without that check, since their events are gone. The merge journal keeps the pre-merge
  rows, so a revert restores them exactly. The channel-merge section of the doc owns the details.
- Listens to a hidden show still count (R62); hiding affects only taste rows.

### Range totals are rebuilt by a job

- Area D's job rebuilds `stats_popularity_*` from the daily tables. A window of `N` days covers
  `day >= (current UTC date - N)`, which always spans at least the last `N × 24` hours. The
  lookbacks live in `STATS_POPULARITY_RANGE_LOOKBACK_DAYS` in `@podverse/helpers` (plan 11):
  day 1, week 7, month 30.
- Each window count is the sum of `listener_count` over the window, so a listener who returns on
  three days counts three times. `all_time_count` is the sum over every daily row.
- Each run recomputes every entity with a daily row inside the month window and resets to zero
  any popularity row whose day, week, or month count is non-zero but has no daily row in the
  window. How often it runs, and how it keeps `all_time_count` exact without summing every row
  each run, is area D's choice.

### Partitions and retention

- Events land in monthly partitions named `<parent>_pYYYYMM`, created ahead of time by area D's
  job through `stats_event_ensure_month_partition`. The default partition is a safety net that
  stays empty while the job runs.
- Retention removes whole partitions through `stats_event_drop_month_partitions_before`.

## The doc

`docs/features/POPULARITY-TRACKING.md`, following **documentation-conventions**: what Popularity
Tracking stores, then sections for the stores and their lifetimes, the tables, the contracts
above, the partition functions, and cost and growth. Short, present tense, no plan or step
numbers. Later areas add their own sections (write path and counted-listen rule, jobs and
schedules, consent lifecycle). Add those three headings now, each with one sentence saying what
the section covers, so later edits fill a section instead of restructuring the doc.

## Baselines and readiness marker

Per **linear-baseline-0004** and **migration-readiness-marker-sync**, in this prompt:

1. `make db_regen_linear_baseline`, then `make db_verify_linear_baseline` (artifact generation,
   not tests; agents run these). Leave both gz files in the tree.
1. In `infra/k8s/base/ops/kustomization.yaml`, under the `podverse-ops-migration-scripts`
   generator, set the `API_EXPECTED_MIGRATION_FILENAME` literal to the new file name and add the
   new file after the last `source/database/linear-migrations/app/` entry in `files`.
1. Set `API_EXPECTED_MIGRATION_FILENAME` in `infra/k8s/base/api/source/api.env` to the new file
   name. The management chain does not change.
1. When the regen fails because the database tooling is not up, stop and report it; do not hand
   edit the gz files.

## Tests

`apps/api/src/test/stats-foundation-schema.integration.test.ts`, DB-backed, following
`add-by-rss-feed-identity.integration.test.ts` (`startTestApp`, raw SQL through the read-write
manager). Use far-past months (for example 2001-01 through 2001-03) so real partitions are never
touched, and drop what the test creates.

- `stats_event_ensure_month_partition` creates `stats_listen_event_p200101`, returns false the
  second time, and a row with a January 2001 `created_at` lands in it.
- A row inserted into the default partition for a month with no partition moves into that month's
  partition when the function creates it; the row count is unchanged.
- `stats_event_drop_month_partitions_before('stats_listen_event', '2001-03-01')` drops January and
  February only and returns 2.
- Both functions raise for a parent table outside the allowlist and for a `month_start` that is
  not the first of a month.
- Deleting a seeded account removes its `stats_listener` row and, by cascade, its listen, open,
  taste, and hidden rows, while its entities' daily rows stay.
- `has_table_privilege('podverse_app_read', 'public.stats_listener', 'SELECT')` is false.
- Inserting into `stats_open_event` with both or neither of `account_id` and `playlist_id`
  fails.

## Release scratchpad

```markdown
## Popularity tracking storage foundation

- Surfaces: api, workers, ops (app database)
- Change: new app migration adds the popularity-tracking tables: a pseudonymous listener-id
  mapping (unreadable by the read-only role), monthly-partitioned listen and open events with a
  default partition, per-show taste profile and Hidden From Taste Profile rows, anonymous daily
  totals per channel, item, clip, playlist, and profile, and range totals for public sorts. Server
  receive time is the only clock on listen events: it decides the daily-totals day and when taste
  scores fade from; no device listen time is stored. Two security-definer functions let the
  existing read-write role create and drop event partitions.
  The old stats tables stay until a later migration in the same release drops them.
- Who notices: operators running migrations; nobody else until the write path and jobs use it
- Operator steps: run the linear migrations; `API_EXPECTED_MIGRATION_FILENAME` advances
```
