**Cursor model:** Opus 5.5 · **Reasoning:** high

# 30 — Auto-flag botted listeners and leave them out of popularity

The listen write path flags a listener whose listening looks scripted, in the same transaction
that sees the signal. From then on the listener's new listens and opens are stored with
`popularity_counted = false`: they add nothing to daily totals, listens still update the Taste
Profile, and every API answer stays exactly what an unflagged listener would get. Flags are keyed
by `listener_id` only. They survive an opt-out and a new Yes, because plan 14 keeps the listener
row; only account deletion removes them. An admin clears a flag in plan 31; this plan writes the
store and the rules that read it.

## Rows

R7, R8, R9, R10, R19, R21, R24, R27, R28, R29

## Runs after

14

Plans 10, 11, 12, and 14 run before this one, on the same write-path files, config, env files,
and tests. Use the code as they leave it: plan 11's `stored_daily_cap` and
`popularity_daily_cap` report fields and `STATS_LISTEN_DAILY_STORED_CAP` key; plan 14's
`readTrackingConsentForUpdate`, `isInOptOutCooldown`, `readOptOutDayCarry`, its single
`if (tooSoon) { return 'too_soon'; }` branch, and its `STATS_ALL_TIME_RECOUNT_DAYS` env lines.
Plan 20's names apply: "Taste Profile" for the opt-in in prose, `config.popularityTracking` for
the caps, and the `'Popularity Tracking'` startup-validation label on `STATS_*` keys.

## Signals and thresholds (R8, R21, R27, R28)

Two signals flag a listener. Both are checked inside `recordListen`, under the listener lock,
with `listenerId` in scope.

1. **Stored cap reached fast** (reason `stored_cap_reached`). A new listen is stored and brings
   the listener's stored listens for the UTC day to `STATS_LISTEN_DAILY_STORED_CAP` (default
   300), and it is stored within `STATS_FLAG_STORED_CAP_WITHIN_HOURS` (default 3; `0` turns this
   signal off) of the listener's first stored listen of that day. Reaching the cap later in the
   day is not a signal, and the `daily_cap_reached` answers after it write nothing. 300 listens
   in 3 hours is a new session every 36 seconds; real listening does not do that, while a full
   day of short tracks can reach 300 honestly.
1. **Too-soon run** (reason `too_soon_minutes`). A new listen answers `too_soon`. The write path
   counts the minutes in one unbroken run in which the listener got at least one `too_soon`, and
   flags when the run reaches `STATS_FLAG_TOO_SOON_MINUTES` (default 30; `0` turns this signal
   off and writes nothing). A too-soon minute more than 2 minutes
   (`POPULARITY_FLAG_TOO_SOON_RUN_GAP_MINUTES`) after the run's last one starts a new run at 1.
   So flagging needs about 30 near-continuous too-soon minutes. The run does not reset at UTC
   midnight; the gap rule is the only reset.
   - A `too_soon` answer for a new listen whose item or clip has a server-side duration under 60
     seconds (`POPULARITY_COUNTED_LISTEN_MIN_SECONDS`, the target's `durationSeconds`) is not a
     signal and writes nothing. The 20-second floor still answers `too_soon` for it. A target
     whose duration is unknown (`durationSeconds === null`) does count toward the run.
   - A `too_soon` answered before the listener has an id (plan 14's opt-out check) writes no
     signal; there is no id to write it to.

Why a run and not a count of reports or of minutes per day:

- The mobile outbox holds up to 500 sessions (`STATS_LISTEN_OUTBOX_MAX_ROWS_PER_ACCOUNT`) and
  drains 50 per pass (`STATS_LISTEN_DRAIN_BATCH_LIMIT`), so one offline backlog can answer
  hundreds of `too_soon` in a few short bursts. Each burst is one or two minutes, and bursts
  further apart than 2 minutes restart the run, so a full backlog stays far below 30.
- Several devices on one account start new sessions close together only now and then; those
  minutes are scattered and never form a 30-minute run.
- Short items and clips count at 25% of their length, so someone moving through tracks or clips
  under 60 seconds stores a counted listen every few seconds and meets the floor honestly.
- A script sending new sessions faster than the floor for half an hour reaches 30.

Not signals:

- **Reaching the popularity cap** (100). A listener who plays music all day can pass 100 tracks;
  the cap already stops those listens from counting.
- **Open cap hits** (R19's open question). The open cap stops counting at 10 a day, an open past
  it stores nothing, and browsing a list of profiles or playlists can reach it honestly. Opens of
  a flagged listener are still left out (below).

## Store and migration (R10)

New linear migration, provisionally
`infra/k8s/base/ops/source/database/linear-migrations/app/0029_stats_flagged_listener.sql`
(plan 11 is `0027_`, plan 14 is `0028_`; use the number the COPY-PASTA prompt names if it
differs):

```sql
-- Listeners whose listening looked scripted. While cleared_at is null, the listener's new listens
-- and opens are stored with popularity_counted = false, and range totals leave the listener out.
CREATE TABLE public.stats_flagged_listener (
    id integer GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
    listener_id uuid NOT NULL,
    reason text NOT NULL,
    flagged_at timestamp with time zone NOT NULL,
    times_flagged integer DEFAULT 1 NOT NULL,
    cleared_at timestamp with time zone,
    cleared_by_admin_id integer,
    CONSTRAINT stats_flagged_listener_listener_id_key UNIQUE (listener_id),
    CONSTRAINT stats_flagged_listener_listener_id_fkey
        FOREIGN KEY (listener_id) REFERENCES listener_identity.stats_listener(listener_id) ON DELETE CASCADE,
    CONSTRAINT stats_flagged_listener_reason_check
        CHECK (reason IN ('stored_cap_reached', 'too_soon_minutes')),
    CONSTRAINT stats_flagged_listener_times_flagged_check CHECK (times_flagged >= 1),
    CONSTRAINT stats_flagged_listener_cleared_check
        CHECK ((cleared_at IS NULL) = (cleared_by_admin_id IS NULL))
);

-- The listener's latest run of minutes in which a new listen answered too_soon. A too-soon minute
-- more than 2 minutes after last_too_soon_minute starts a new run. One row per listener.
CREATE TABLE public.stats_flag_signal (
    listener_id uuid NOT NULL,
    too_soon_minutes integer NOT NULL,
    last_too_soon_minute timestamp with time zone NOT NULL,
    CONSTRAINT stats_flag_signal_pkey PRIMARY KEY (listener_id),
    CONSTRAINT stats_flag_signal_listener_id_fkey
        FOREIGN KEY (listener_id) REFERENCES listener_identity.stats_listener(listener_id) ON DELETE CASCADE,
    CONSTRAINT stats_flag_signal_too_soon_minutes_check CHECK (too_soon_minutes >= 1)
);

-- False for an open stored while its opener was flagged: it adds nothing to daily or range totals.
ALTER TABLE public.stats_open_event
    ADD COLUMN popularity_counted boolean DEFAULT true NOT NULL;

GRANT SELECT, INSERT, DELETE, UPDATE ON TABLE public.stats_flagged_listener TO podverse_app_read_write;
GRANT SELECT ON TABLE public.stats_flagged_listener TO podverse_app_read;

GRANT SELECT, INSERT, DELETE, UPDATE ON TABLE public.stats_flag_signal TO podverse_app_read_write;
GRANT SELECT ON TABLE public.stats_flag_signal TO podverse_app_read;
```

Notes for the implementer:

- `cleared_by_admin_id` is a management-database admin id; the app database has no admin table,
  so it has no foreign key (same as `feed_policy_override.updated_by_admin_id`).
- The integer `id` exists because the management audit log takes a numeric row id (plan 31).
- Both tables cascade from the listener row, so account deletion removes them. An opt-out keeps
  the listener row (plan 14), so flags and the too-soon run survive a No and a new Yes. Do not add
  either table to `LISTENING_DATA_TABLES` in `listeningDataDeletion.ts`.
- The stored-cap signal needs no table: it reads today's events and plan 14's opt-out-day carry.
- No other index: the write path reads by `listener_id` (unique), and the admin list is small.
- Table names avoid the bare word `stats_listener`, which the source guard forbids outside the
  listener identity zone; management code in plan 31 names `stats_flagged_listener`.
- Follow **linear-sql-greenfield-only** and **migration-readiness-marker-sync**: set
  `API_EXPECTED_MIGRATION_FILENAME` in `infra/k8s/base/api/source/api.env` and in the
  `podverse-ops-migration-scripts` literals of `infra/k8s/base/ops/kustomization.yaml`, list the
  file under `podverse-ops-app-linear-migrations` `files` there, then run
  `make db_regen_linear_baseline` and `make db_verify_linear_baseline` and leave the regenerated
  `infra/k8s/base/db/source/bootstrap/0004_app_linear_baseline.sql.gz` and
  `0005_management_linear_baseline.sql.gz` in the tree. If those targets cannot run (no Docker),
  stop and report BLOCKED.

## Entities

- New `packages/orm/src/entities/stats/statsFlaggedListener.ts`, class `StatsFlaggedListener`,
  `@Entity('stats_flagged_listener')`: `@PrimaryGeneratedColumn({ type: 'integer' }) id`,
  `listener_id` (`uuid`), `reason` (`text`, typed `PopularityFlagReason`), `flagged_at`
  (`timestamptz`), `times_flagged` (`integer`, default 1), `cleared_at` (`timestamptz`, nullable),
  `cleared_by_admin_id` (`integer`, nullable). Doc comment: one row per flagged listener; an
  uncleared row leaves the listener out of popularity.
- New `packages/orm/src/entities/stats/statsFlagSignal.ts`, class `StatsFlagSignal`,
  `@Entity('stats_flag_signal')`: `listener_id` (primary, `uuid`), `too_soon_minutes`
  (`integer`), `last_too_soon_minute` (`timestamptz`). Doc comment: the listener's latest run of
  too-soon minutes.
- `packages/orm/src/entities/stats/statsOpenEvent.ts`: add
  `@Column({ type: 'boolean', default: true }) popularity_counted!: boolean;` after `playlist_id`,
  with a one-line doc comment.
- Register both new classes in `packages/orm/src/db/entities.ts` (beside
  `StatsTasteProfileHidden`, import and array entry) and export them from
  `packages/orm/src/index.ts` next to `statsTasteProfileHidden.js`.

## Shared vocabulary

`packages/helpers/src/lib/popularityListen.ts`, beside the constants of plans 10–12 and 14:

```typescript
/** Why a listener was left out of popularity. */
export const POPULARITY_FLAG_REASONS = ['stored_cap_reached', 'too_soon_minutes'] as const;

export type PopularityFlagReason = (typeof POPULARITY_FLAG_REASONS)[number];

/**
 * Too-soon minutes in one unbroken run that flag a listener unless `STATS_FLAG_TOO_SOON_MINUTES`
 * sets another value; 0 turns the signal off.
 */
export const POPULARITY_DEFAULT_FLAG_TOO_SOON_MINUTES = 30;

/** A too-soon minute more than this many minutes after the run's last one starts a new run. */
export const POPULARITY_FLAG_TOO_SOON_RUN_GAP_MINUTES = 2;

/**
 * Hours from a listener's first stored listen of a UTC day within which reaching the stored daily
 * cap flags the listener, unless `STATS_FLAG_STORED_CAP_WITHIN_HOURS` sets another value; 0 turns
 * the signal off.
 */
export const POPULARITY_DEFAULT_FLAG_STORED_CAP_WITHIN_HOURS = 3;
```

Add three functions with doc comments and no assertions:

- `isPopularityFlagReason(value: unknown): value is PopularityFlagReason` — a loop over
  `POPULARITY_FLAG_REASONS`.
- `countsTowardTooSoonSignal(durationSeconds: number | null): boolean` — false only when
  `durationSeconds` is a finite number below `POPULARITY_COUNTED_LISTEN_MIN_SECONDS`. Doc comment:
  items and clips under 60 seconds count at 25% of their length, so honest listening meets the
  floor; an unknown duration counts.
- `isStoredCapReachedFast(input: { firstStoredAt: Date; reachedAt: Date; withinHours: number }): boolean`
  — true when `withinHours > 0` and `reachedAt - firstStoredAt` is at most `withinHours` hours.

## Zone module

New `packages/orm/src/services/stats/listenerIdentity/statsListenerFlags.ts` (inside the zone; not
exported from `@podverse/orm`). Header comment: the flag and signal steps the listen and open
write paths share; flags are kept by listener id until the account is deleted; contracts in
docs/features/POPULARITY-AND-TASTE-PROFILE.md. Every function takes the transaction's `manager`, runs under
the caller's `lockListener`, and never returns a listener id to a caller outside the zone.

```typescript
/** Whether the listener has an uncleared flag. */
export async function isListenerFlagged(manager: EntityManager, listenerId: string): Promise<boolean>
```

`SELECT 1 AS flagged FROM stats_flagged_listener WHERE listener_id = $1 AND cleared_at IS NULL`
through `queryRows`; true when a row comes back.

```typescript
/**
 * Flags the listener. An uncleared flag stays as it is. A cleared flag comes back only when it was
 * cleared before the UTC day of `now`, so an admin's clear holds for the rest of that day.
 */
export async function flagListener(
  manager: EntityManager,
  listenerId: string,
  reason: PopularityFlagReason,
  now: Date
): Promise<void>
```

```sql
INSERT INTO stats_flagged_listener AS f (listener_id, reason, flagged_at)
VALUES ($1, $2, $3)
ON CONFLICT (listener_id) DO UPDATE SET
  reason = EXCLUDED.reason,
  flagged_at = EXCLUDED.flagged_at,
  times_flagged = f.times_flagged + 1,
  cleared_at = NULL,
  cleared_by_admin_id = NULL
WHERE f.cleared_at IS NOT NULL AND f.cleared_at < $4
```

with `$4 = utcDayBounds(now).start`. Run it with `manager.query` (no rows needed).

```typescript
/**
 * Adds the minute of `now` to the listener's run of too-soon minutes and flags the listener when
 * the run reaches `threshold`. A threshold of 0 writes nothing.
 */
export async function recordTooSoonMinute(
  manager: EntityManager,
  listenerId: string,
  now: Date,
  threshold: number
): Promise<void>
```

- Return at once when `threshold <= 0`.
- `minute = new Date(Math.floor(now.getTime() / 60_000) * 60_000)`.
- Upsert and read the run in one statement through `queryRows`, with
  `$3 = POPULARITY_FLAG_TOO_SOON_RUN_GAP_MINUTES`:

  ```sql
  INSERT INTO stats_flag_signal AS s (listener_id, too_soon_minutes, last_too_soon_minute)
  VALUES ($1, 1, $2)
  ON CONFLICT (listener_id) DO UPDATE SET
    too_soon_minutes = CASE
      WHEN EXCLUDED.last_too_soon_minute > s.last_too_soon_minute + make_interval(mins => $3::int)
        THEN 1
      WHEN EXCLUDED.last_too_soon_minute > s.last_too_soon_minute
        THEN s.too_soon_minutes + 1
      ELSE s.too_soon_minutes
    END,
    last_too_soon_minute = GREATEST(s.last_too_soon_minute, EXCLUDED.last_too_soon_minute)
  RETURNING too_soon_minutes
  ```

  The first branch starts a new run after a gap of more than 2 minutes. The `ELSE` keeps the run
  when a report lands in the same minute, or when a transaction whose `now()` is a moment earlier
  than the one that wrote the row (it waited on the listener lock) lands in an earlier minute.
  This uses only the run length and its last minute; nothing else is stored.
- When the returned `too_soon_minutes` is a number `>= threshold`, call
  `flagListener(manager, listenerId, 'too_soon_minutes', now)`.

```typescript
/**
 * Flags the listener when the listen that just reached the stored daily cap was stored within
 * `withinHours` of the day's first stored listen. A window of 0 writes nothing.
 */
export async function recordStoredCapReached(
  manager: EntityManager,
  listenerId: string,
  firstStoredAt: Date,
  now: Date,
  withinHours: number
): Promise<void>
```

Calls `flagListener(manager, listenerId, 'stored_cap_reached', now)` when
`isStoredCapReachedFast({ firstStoredAt, reachedAt: now, withinHours })`.

## Listen write path

`packages/orm/src/services/stats/listenerIdentity/statsListenWrite.ts`, as plans 10, 11, and 14
leave it:

- `StatsListenReport` gains:
  - `/** Too-soon minutes in one unbroken run that flag the listener; 0 turns the signal off. */ flag_too_soon_minutes: number;`
  - `/** Hours from the day's first stored listen within which reaching the stored cap flags the listener; 0 turns the signal off. */ flag_stored_cap_within_hours: number;`
- `LISTENER_DAY_SQL` (plan 11's version) also selects `min(created_at) AS first_stored_at`.
  `ListenerDay` gains `firstStoredAt: Date | null` (a `Date` when the value is one, else `null`),
  and the `readListenerDay` doc comment names it.
- In `recordListen`, right after `await lockListener(manager, listenerId);`:
  `const flagged = await isListenerFlagged(manager, listenerId);` (`now` is already read; plan 14
  moved it before the listener lookup).
- Session match: pass `flagged` to `updateSessionEvent`, which passes it to
  `addCompletionOfStoredListen`. There the daily completion loop runs only when
  `event.popularityCounted && !flagged` (plan 11 adds the first half); the taste completion always
  runs. Update both functions' doc comments.
- Plan 14's too-soon branch becomes:

  ```typescript
  if (tooSoon) {
    if (countsTowardTooSoonSignal(target.durationSeconds)) {
      await recordTooSoonMinute(manager, listenerId, now, report.flag_too_soon_minutes);
    }
    return 'too_soon';
  }
  ```

  Plan 14's `return 'too_soon'` before a listener id exists stays as it is and writes no signal.
- Stored cap: name the sum plan 14 checks,
  `const storedBefore = listenerDay.storedCount + carried.storedCount;`, and keep
  `if (storedBefore >= report.stored_daily_cap) return 'daily_cap_reached';` with no flag call.
- The popularity decision becomes
  `const popularityCounted = !flagged && !coolingDown && listenerDay.popularityCount < report.popularity_daily_cap;`
  Everything after it is plan 11's code: the event stores `popularityCounted`, daily rows run only
  when it is true, taste always runs.
- After the taste write and before `return 'counted'`:

  ```typescript
  if (storedBefore + 1 >= report.stored_daily_cap) {
    await recordStoredCapReached(
      manager,
      listenerId,
      earliestDate(listenerDay.firstStoredAt, carried.firstStoredAt) ?? now,
      now,
      report.flag_stored_cap_within_hours
    );
  }
  ```

  `earliestDate(a: Date | null, b: Date | null): Date | null` is a small module-level function in
  this file (the earlier of the non-null values). `?? now` covers a cap of 1, where the listen
  just stored is the day's first. The result is `'counted'` either way.
- Update the class doc comment: a flagged listener's listens are stored and feed taste but count
  toward no daily total, and the answer never says so.

Rules that must stay true:

- A flagged listener gets the same result for every report as an unflagged one would.
- A flag changes only later reports. The too-soon signal stores no listen. The stored-cap signal
  flags after the listen that reaches the cap is stored, and that listen keeps the
  `popularity_counted` it was stored with.
- Flagging never edits stored events or daily rows. Listens stored before the flag keep
  `popularity_counted = true`; range totals leave them out while the flag is uncleared (area D),
  and count them again after a clear while they are still within retention.
- Listens and opens stored while flagged keep `popularity_counted = false` after a clear.
- `too_soon` and `daily_cap_reached` still store no listen event; `too_soon` writes only the
  signal and flag rows, and `daily_cap_reached` writes nothing.
- Flags and the too-soon run survive an opt-out and a new Yes. Only account deletion removes them.
- The account data export (`listeningDataExport.ts`) stays as it is: it includes no flag, no
  signal, and no `popularity_counted`.

## Open write path

`packages/orm/src/services/stats/listenerIdentity/statsOpenWrite.ts`, as plans 12 and 14 leave it:

- Plan 14's cooldown return comes before the listener lookup, so cooldown opens never reach the
  flag check.
- After `lockListener`:
  `const flagged = await isListenerFlagged(manager, listenerId);`
- The `unchanged` and `daily_cap_reached` checks stay as plan 12 wrote them, so a flagged opener
  gets the same answers and uses up the same cap.
- The event insert writes `popularity_counted` as `!flagged`:
  `INSERT INTO stats_open_event (created_at, listener_id, ${column}, popularity_counted) VALUES ($1, $2, $3, $4)`.
- The daily row upsert runs only when `!flagged`. Return `'counted'` either way.
- Class doc comment: a flagged opener's opens are stored and count toward no daily total.
- Open-cap hits do not call any flag function.

## API config and env

- `apps/api/src/config/index.ts`: in `popularityTracking`, add
  `flagTooSoonMinutes: readWholeNumberEnv('STATS_FLAG_TOO_SOON_MINUTES', POPULARITY_DEFAULT_FLAG_TOO_SOON_MINUTES, 0)`
  and
  `flagStoredCapWithinHours: readWholeNumberEnv('STATS_FLAG_STORED_CAP_WITHIN_HOURS', POPULARITY_DEFAULT_FLAG_STORED_CAP_WITHIN_HOURS, 0)`
  (plan 10's helper), and both to the `Config` type with doc comments.
- `apps/api/src/controllers/stats/statsListen.ts`: pass
  `flag_too_soon_minutes: config.popularityTracking.flagTooSoonMinutes` and
  `flag_stored_cap_within_hours: config.popularityTracking.flagStoredCapWithinHours` to
  `recordListen`.
- Place `STATS_FLAG_TOO_SOON_MINUTES`, then `STATS_FLAG_STORED_CAP_WITHIN_HOURS`, right after
  plan 14's `STATS_ALL_TIME_RECOUNT_DAYS` in each file (**env-file-formatting**,
  **env-defaults-match-code**, **startup-validation-env-order**):
  - `apps/api/.env.example`:
    `# Optional. Too-soon minutes in one unbroken run (no gap over 2 minutes) that flag a listener out of popularity; items and clips under 60 seconds do not count; 0 turns it off. Empty uses 30.`
    then `STATS_FLAG_TOO_SOON_MINUTES="30"`, then
    `# Optional. Hours from a listener's first stored listen of a UTC day within which reaching STATS_LISTEN_DAILY_STORED_CAP flags the listener out of popularity; 0 turns it off. Empty uses 3.`
    then `STATS_FLAG_STORED_CAP_WITHIN_HOURS="3"`.
  - `infra/k8s/base/api/source/api.env`: the same comments without "Optional.", then
    `STATS_FLAG_TOO_SOON_MINUTES=30` and `STATS_FLAG_STORED_CAP_WITHIN_HOURS=3`.
  - `dev/env-overrides/local/rate-limit.env.example`: `STATS_FLAG_TOO_SOON_MINUTES="30"` and
    `STATS_FLAG_STORED_CAP_WITHIN_HOURS="3"` under the "Per-listener stats write limits" block
    comment.
  - `scripts/local-env/setup.sh`: add both keys to the rate-limit loop after
    `STATS_ALL_TIME_RECOUNT_DAYS`.
  - `apps/api/src/lib/startup/validation.ts`: after the `STATS_ALL_TIME_RECOUNT_DAYS` line,
    `validateOptional('STATS_FLAG_TOO_SOON_MINUTES', 'Popularity Tracking', 'Use Default (30)')`
    and
    `validateOptional('STATS_FLAG_STORED_CAP_WITHIN_HOURS', 'Popularity Tracking', 'Use Default (3)')`.
  - `apps/api/ENV.md` § Related soft caps: two bullets, both naming
    `docs/features/POPULARITY-AND-TASTE-PROFILE.md` § Flagged Listeners:
    - "**`STATS_FLAG_TOO_SOON_MINUTES`** (default `30`): when a listener's new listens answer
      `too_soon` in this many minutes of one unbroken run, the listener is flagged and left out of
      popularity. A too-soon minute more than 2 minutes after the last one starts a new run, and
      items and clips under 60 seconds do not count toward it. `0` turns the signal off; unset,
      empty, or invalid uses the default."
    - "**`STATS_FLAG_STORED_CAP_WITHIN_HOURS`** (default `3`): when a listener's stored listens
      reach `STATS_LISTEN_DAILY_STORED_CAP` within this many hours of its first stored listen of
      the UTC day, the listener is flagged and left out of popularity. Reaching the cap later is
      not a signal. `0` turns the signal off; unset, empty, or invalid uses the default."

`apps/api/openapi.yml` needs no edit: no request field, result, or status changes.

## E2E API env (R29)

`packages/helpers-config/src/podverseTestEnv.ts` holds both E2E API envs: `apiWebE2e` is the API
that `apps/web/playwright.e2e-server-env.ts` (`buildE2eWebApiEnvPrefix`) starts for web E2E, and
`apiMobileE2e` is the API that `npm run mobile:e2e:api` starts
(`scripts/mobile/e2e-api-env-prefix.mjs`). Both spread the profile, so neither caller changes.

In `apiProfileOverrides`, add to both `apiWebE2e` and `apiMobileE2e`, after
`PODVERSE_E2E_FIXTURES` (and after `OPML_IMPORT_MAX_FEEDS_PER_HOUR` in `apiMobileE2e`):

```typescript
    // Seeded accounts listen in fast bursts across the whole suite. Keep both botted-listener
    // signals off so no account is flagged out of popularity; API integration tests cover them.
    STATS_FLAG_TOO_SOON_MINUTES: '0',
    STATS_FLAG_STORED_CAP_WITHIN_HOURS: '0',
```

`apiVitest` keeps the defaults: the integration tests call the write service with explicit
values, and the route test reads whatever config holds.

## Docs

`docs/features/POPULARITY-AND-TASTE-PROFILE.md`:

- § Tables: add `stats_flagged_listener` and `stats_flag_signal` with their columns and meaning,
  and `popularity_counted` to the `stats_open_event` bullet.
- § Listener Id and Its Separation: flag and signal rows are kept by listener id, so they survive
  an opt-out (which keeps the listener row) and are removed by cascade when the account is
  deleted.
- New `### Flagged Listeners` after plan 14's `### Popularity Cooldown After an Opt-Out`:
  - the two signals: the stored cap reached within `STATS_FLAG_STORED_CAP_WITHIN_HOURS` of the
    day's first stored listen (later is not a signal), and a run of
    `STATS_FLAG_TOO_SOON_MINUTES` too-soon minutes, where a gap of more than 2 minutes starts a new
    run and items and clips under 60 seconds do not count;
  - why a run is counted instead of reports (outbox bursts, several devices, short media);
  - that open-cap hits and popularity-cap hits are not signals;
  - what a flag changes: new listens and opens stored with `popularity_counted = false`, no daily
    totals, taste unchanged, same API answers;
  - that flagging edits no stored row, and range totals leave a flagged listener out (area D fills
    in how);
  - the clear rule: an admin clear holds for the rest of its UTC day, and a signal on a later day
    flags again and adds to `times_flagged`;
  - that flags and the too-soon run survive an opt-out and a new Yes, and go with the account;
  - that the export includes none of it;
  - that the web and mobile E2E API profiles turn both signals off.
  Plan 31 adds the management routes to this section.
- § Opens: a flagged opener's opens are stored with `popularity_counted = false` and add to no
  daily total; the answers do not change.
- § Taste Rows: a flagged listener's listens still update taste rows.

## Files

infra/k8s/base/ops/source/database/linear-migrations/app/0029_stats_flagged_listener.sql
infra/k8s/base/ops/kustomization.yaml
infra/k8s/base/api/source/api.env
infra/k8s/base/db/source/bootstrap/0004_app_linear_baseline.sql.gz
infra/k8s/base/db/source/bootstrap/0005_management_linear_baseline.sql.gz
packages/orm/src/entities/stats/statsFlaggedListener.ts
packages/orm/src/entities/stats/statsFlagSignal.ts
packages/orm/src/entities/stats/statsOpenEvent.ts
packages/orm/src/db/entities.ts
packages/orm/src/index.ts
packages/orm/src/services/stats/listenerIdentity/statsListenerFlags.ts
packages/orm/src/services/stats/listenerIdentity/statsListenWrite.ts
packages/orm/src/services/stats/listenerIdentity/statsOpenWrite.ts
packages/helpers/src/lib/popularityListen.ts
packages/helpers/src/lib/popularityListen.test.ts
packages/helpers-config/src/podverseTestEnv.ts
apps/api/src/config/index.ts
apps/api/src/controllers/stats/statsListen.ts
apps/api/src/lib/startup/validation.ts
apps/api/.env.example
apps/api/ENV.md
dev/env-overrides/local/rate-limit.env.example
scripts/local-env/setup.sh
docs/features/POPULARITY-AND-TASTE-PROFILE.md
apps/api/src/test/stats-listen-write.integration.test.ts
apps/api/src/test/stats.track.test.ts
apps/api/src/test/podverse-test-env-startup.test.ts
release-notes/scratchpad.md

## Tests

API integration, `apps/api/src/test/stats-listen-write.integration.test.ts`:

- `ListenInput` gains `flagTooSoonMinutes?: number` and `flagStoredCapWithinHours?: number`; the
  `listen` helper passes `flag_too_soon_minutes: input.flagTooSoonMinutes ?? 0` and
  `flag_stored_cap_within_hours: input.flagStoredCapWithinHours ?? 0`, so existing tests never
  write signals or flags.
- Small helpers in the file: `flagRow(listenerId)` reads `reason`, `times_flagged`, `cleared_at`,
  `cleared_by_admin_id` from `stats_flagged_listener`; `signalRow(listenerId)` reads
  `stats_flag_signal`; `moveRunBack(listenerId, minutes)` runs
  `UPDATE stats_flag_signal SET last_too_soon_minute = last_too_soon_minute - make_interval(mins => $2) WHERE listener_id = $1`.
  Get the listener id with the file's `listenerIdOf`.
- Every too-soon test below passes `minIntervalSeconds: 20` and sends its sessions right after
  session A, so each new session lands inside the floor. Session A uses `podcastItem` (a
  long item) unless the test says otherwise.
- "flags a listener that reaches the stored cap within the window and leaves its later listens and
  opens out of daily totals": fresh account, `storedDailyCap: 2, popularityDailyCap: 2,
  flagStoredCapWithinHours: 3`. Session 1 `counted` and no flag row; session 2 `counted` and the
  flag row has reason `stored_cap_reached`, `times_flagged` 1, no `cleared_at`; session 3
  `daily_cap_reached` and the flag row is unchanged. Then with `storedDailyCap: 10,
  popularityDailyCap: 10`, a session on a fresh item (`seedItem`) is `counted`, its event has
  `popularity_counted` false, the fresh item has no daily row, the channel daily row is
  unchanged, and taste `listen_count` rose by 1. An open of a fresh owner's profile by the same
  account is `counted`; its `stats_open_event` row has `popularity_counted` false and the owner
  has no `stats_daily_account` row today.
- "does not flag a listener that reaches the stored cap after the window": fresh account,
  `storedDailyCap: 3, flagStoredCapWithinHours: 1`. Session 1 `counted`. Give the listener row an
  opt-out-day carry that started two hours ago:
  `UPDATE listener_identity.stats_listener SET opt_out_day = $2::date, opt_out_day_stored_count = 1, opt_out_day_first_stored_at = now() - interval '2 hours' WHERE listener_id = $1`
  with `$2` today's UTC date from JS (the carry's time may fall on the previous UTC day; the write
  path only compares times). Session 2 `counted` (it reaches the cap) and no flag row; session 3
  `daily_cap_reached` and still no flag row. Then the same steps on a second fresh account with
  `interval '30 minutes'`: session 2 writes a `stored_cap_reached` flag row.
- "writes no flag at the stored cap when the window is 0": fresh account, `storedDailyCap: 1`
  and the default window; session 1 `counted`, session 2 `daily_cap_reached`, no flag row.
- "flags a listener after an unbroken run of too-soon minutes": fresh account,
  `flagTooSoonMinutes: 3`. A `counted`; B `too_soon` (signal 1, no flag row); C `too_soon` in the
  same minute (still 1); `moveRunBack(id, 2)`; D `too_soon` (2, a 2-minute gap keeps the run);
  `moveRunBack(id, 1)`; E `too_soon`: signal 3 and the flag row has reason `too_soon_minutes`.
- "starts a new run after a gap of more than 2 minutes": fresh account, `flagTooSoonMinutes: 2`.
  A `counted`; B `too_soon` (1); `moveRunBack(id, 3)`; C `too_soon`: signal 1 and no flag row.
- "does not count too-soon listens of items under 60 seconds toward the run": fresh account,
  `flagTooSoonMinutes: 1`, a fresh 30-second item (`seedItem(podcastChannelId, 'short-…', 30)`).
  A `counted`; B on the short item with `secondsHeard: 30` is `too_soon`, and there is no signal
  row and no flag row; C on a long fresh item is `too_soon`, signal 1, and a flag row exists.
- "writes no signal when the too-soon minutes threshold is 0": fresh account; A `counted`, B
  `too_soon` with the default threshold 0; no `stats_flag_signal` row.
- "does not add a completion to daily totals for a listen stored before the flag": fresh account,
  `flagTooSoonMinutes: 1`. Session A `counted` (not completed); B `too_soon` flags the listener;
  complete A: `updated`, the item and channel daily `completion_count` are unchanged, taste
  `completion_count` rose by 1.
- "keeps a clear for the rest of its UTC day and flags again on a later day": fresh account,
  `flagTooSoonMinutes: 1`. A `counted`; B `too_soon` flags the listener;
  `UPDATE stats_flagged_listener SET cleared_at = now(), cleared_by_admin_id = 1` for that
  listener; C `too_soon`: the row stays cleared with `times_flagged` 1. Set
  `cleared_at = now() - interval '1 day'`; D `too_soon`: `cleared_at` null,
  `cleared_by_admin_id` null, `times_flagged` 2.
- "keeps flag and signal rows across a No and a new Yes, and removes them with the account":
  fresh account, `flagTooSoonMinutes: 1`. A `counted`; B `too_soon` flags the listener; remember
  `listenerIdOf`. `AccountSettingsListenStatsService.update` with `accepted: false`, then with
  `accepted: true` (both with `AGREEMENT_VERSION`): `listenerIdOf` is unchanged and both the flag
  row and the signal row still exist for that id. `AccountService.delete` the account and remove
  its id from `createdAccountIds`; neither table has a row for that id.
- Five concurrent new sessions inside the floor for a fresh listener with
  `flagTooSoonMinutes: 1`: results sort to one `counted` and four `too_soon`, and exactly one flag
  row exists with `times_flagged` 1. Do not assert the run length; the five can straddle a minute
  boundary.

API route, `apps/api/src/test/stats.track.test.ts`: "passes exactly the report fields…" also
expects `flag_too_soon_minutes: config.popularityTracking.flagTooSoonMinutes` and
`flag_stored_cap_within_hours: config.popularityTracking.flagStoredCapWithinHours`.

API unit, `apps/api/src/test/podverse-test-env-startup.test.ts`: new test "turns off both
botted-listener signals in the web and mobile E2E API profiles": for `apiWebE2e` and
`apiMobileE2e`, `buildPodverseApiTestEnv` has `STATS_FLAG_TOO_SOON_MINUTES` and
`STATS_FLAG_STORED_CAP_WITHIN_HOURS` equal to `'0'`.

Helpers unit test, `packages/helpers/src/lib/popularityListen.test.ts`:

- `isPopularityFlagReason` accepts both reasons and rejects other strings, numbers, and `null`.
- `countsTowardTooSoonSignal` is false for 30 and 59.9, true for 60, 3600, and `null`.
- `isStoredCapReachedFast` is true at exactly 3 hours with `withinHours: 3`, false a second
  later, and false for any gap when `withinHours` is 0.

## Release scratchpad

```markdown
## Listening that looks scripted is left out of public popularity

- Surfaces: api, k8s base env, local env overrides, database migration
- Change: a listener is flagged when its stored listens reach `STATS_LISTEN_DAILY_STORED_CAP`
  within `STATS_FLAG_STORED_CAP_WITHIN_HOURS` (default 3, `0` off) of its first stored listen of
  the UTC day, or when its new listens answer `too_soon` in a run of `STATS_FLAG_TOO_SOON_MINUTES`
  (default 30, `0` off) minutes. A gap of more than 2 minutes starts a new run, and items and
  clips under 60 seconds do not count toward it. A flagged listener's later listens and opens are
  stored with `popularity_counted = false` and add nothing to daily totals; listens still update
  the Taste Profile, and API answers do not change. New tables `stats_flagged_listener` and
  `stats_flag_signal` are keyed by the pseudonymous listener id; they survive turning Taste
  Profile off and on and are removed when the account is deleted. `stats_open_event` gains
  `popularity_counted`. The web and mobile E2E API profiles set both signals to `0`.
- Who notices: nobody listening normally; scripted listening stops moving public lists
- Operator steps: run the app migration; set `STATS_FLAG_TOO_SOON_MINUTES` or
  `STATS_FLAG_STORED_CAP_WITHIN_HOURS` on the API to change or turn off either signal
```
