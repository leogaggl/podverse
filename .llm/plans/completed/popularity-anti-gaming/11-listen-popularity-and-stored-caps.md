**Cursor model:** Opus 5.5 · **Reasoning:** high

# 11 — Two daily listen caps: popularity (100) and stored (300)

Each listener stores at most `STATS_LISTEN_DAILY_STORED_CAP` (default 300) new listens per UTC
day; they all feed the Taste Profile. Only the first `STATS_LISTEN_DAILY_POPULARITY_CAP` (default
100) of them count toward popularity. A listen past the popularity cap is stored with
`stats_listen_event.popularity_counted = false` and adds nothing to any daily total, including
its completion.

`STATS_LISTEN_DAILY_CAP` goes away: this plan renames it to `STATS_LISTEN_DAILY_STORED_CAP` in
every file that holds it, with the same default. Nothing reads the old key afterwards, and there
is no fallback to it; nothing has shipped with it.

## Rows

R5, R6, R20

## Runs after

10

Plan 20's names apply (see plan 10 § Runs after). Say "Taste Profile" for the opt-in and
"popularity" or "public counts" for rankings.

## Schema

New linear migration, provisionally
`infra/k8s/base/ops/source/database/linear-migrations/app/0027_stats_listen_event_popularity_counted.sql`
(Close may renumber it; use the number the COPY-PASTA prompt names if it differs):

```sql
-- False for a stored listen past the listener's daily popularity cap: it feeds taste rows and
-- adds nothing to daily or range totals.
ALTER TABLE public.stats_listen_event
    ADD COLUMN popularity_counted boolean DEFAULT true NOT NULL;
```

- Adding a column with a constant default to the partitioned parent reaches every partition and
  rewrites nothing. Every existing row counted under the single cap, so `true` is right for them.
- No index: every reader filters by `listener_id` and `created_at` (write path) or by entity id
  (merge), and this column only narrows those rows.
- Follow **linear-sql-greenfield-only** and **migration-readiness-marker-sync**: set
  `API_EXPECTED_MIGRATION_FILENAME` in `infra/k8s/base/api/source/api.env` and in the
  `podverse-ops-migration-scripts` literals of `infra/k8s/base/ops/kustomization.yaml`, list the
  file under `podverse-ops-app-linear-migrations` `files` there, then run
  `make db_regen_linear_baseline` and `make db_verify_linear_baseline` and leave the regenerated
  `infra/k8s/base/db/source/bootstrap/0004_app_linear_baseline.sql.gz` and
  `0005_management_linear_baseline.sql.gz` in the tree. If those targets cannot run (no Docker),
  stop and report BLOCKED.
- `packages/orm/src/entities/stats/statsListenEvent.ts`: add after `completed`:
  `@Column({ type: 'boolean', default: true }) popularity_counted!: boolean;` with a one-line doc
  comment.

Area D's range job reads this column; area C may also set it. The name says what it means to a
reader: this event counts toward popularity.

## Write path

`packages/orm/src/services/stats/listenerIdentity/statsListenWrite.ts`:

- `StatsListenReport`: rename `daily_cap` to `stored_daily_cap` ("Stored listens allowed per
  listener per UTC day.") and add `popularity_daily_cap` ("Stored listens per listener per UTC day
  that count toward popularity; later ones feed taste rows only.").
- `LISTENER_DAY_SQL` returns `stored_count` (`count(*)`), `popularity_count`
  (`count(*) FILTER (WHERE popularity_counted)`), and computes every `*_listened` and
  `*_completed` flag over popularity-counted events only (`bool_or(popularity_counted AND …)`).
  `ListenerDay` becomes `{ storedCount, popularityCount, listened, completed }` and the
  `readListenerDay` doc comment says the flags cover popularity-counted listens.
- `SESSION_EVENT_SQL` also selects `popularity_counted`; `SessionEvent` gains
  `popularityCounted: boolean` and `findSessionEvent` checks its type like the others.
- `INSERT_LISTEN_EVENT_SQL` writes `popularity_counted` as `$9`.
- In `recordListen`, after plan 10's floor:
  1. `if (listenerDay.storedCount >= report.stored_daily_cap) return 'daily_cap_reached';`
  1. `const popularityCounted = listenerDay.popularityCount < report.popularity_daily_cap;`
  1. Insert the event with `popularityCounted`.
  1. Run the daily-row loop only when `popularityCounted`.
  1. `addListenToTaste` always.
  1. Return `'counted'` either way. The wire does not say whether a stored listen counted
     toward popularity: clients do nothing with the difference, and a scripted client should not
     learn when it stops counting. A listener excluded from popularity must not be able to tell
     either.
- `addCompletionOfStoredListen`: run the daily completion loop only when
  `event.popularityCounted`; the taste completion always runs. Since `readListenerDay`'s flags
  already exclude over-cap events, a counted event's completion is still checked against other
  counted listens only.
- Update the class doc comment and `updateSessionEvent`'s comment where they name "the daily cap".

## Channel merge

`packages/orm/src/services/channel/applyChannelMerge.ts` `readSameDayOverlap`: add
`AND popularity_counted` to the `per_copy` CTE's `WHERE`, so the overlap subtracted from merged
daily rows counts only listeners those rows counted. Leave the rest of the merge alone; area D
owns the range counting it feeds.

## Config, controller, env

- `packages/helpers/src/lib/popularityListen.ts`: add
  `POPULARITY_DEFAULT_DAILY_LISTEN_STORED_CAP = 300` and
  `POPULARITY_DEFAULT_DAILY_LISTEN_POPULARITY_CAP = 100` with one-line doc comments naming their
  env keys.
- `apps/api/src/config/index.ts`: replace the `dailyListenCap` IIFE. Compute two consts above
  `config` with plan 10's `readWholeNumberEnv`:
  `statsListenStoredCap = readWholeNumberEnv('STATS_LISTEN_DAILY_STORED_CAP', POPULARITY_DEFAULT_DAILY_LISTEN_STORED_CAP, 1)`
  and
  `statsListenPopularityCap = Math.min(readWholeNumberEnv('STATS_LISTEN_DAILY_POPULARITY_CAP', POPULARITY_DEFAULT_DAILY_LISTEN_POPULARITY_CAP, 1), statsListenStoredCap)`.
  In `popularityTracking`, rename `dailyListenCap` to `dailyListenStoredCap` and add
  `dailyListenPopularityCap`; update the `Config` type and doc comments.
- `apps/api/src/controllers/stats/statsListen.ts`: pass `stored_daily_cap` and
  `popularity_daily_cap` from config.
- Rename `STATS_LISTEN_DAILY_CAP` to `STATS_LISTEN_DAILY_STORED_CAP` in place (same position,
  default 300) and add `STATS_LISTEN_DAILY_POPULARITY_CAP` (default 100) right after plan 10's
  `STATS_LISTEN_MIN_INTERVAL_SECONDS` in each file:
  - `apps/api/.env.example`: the stored cap comment becomes
    `# Optional. Stored listens per listener per UTC day; each feeds the listener's Taste Profile. Empty uses 300.`
    The new key's comment:
    `# Optional. Stored listens per listener per UTC day that count toward popularity; at most STATS_LISTEN_DAILY_STORED_CAP. Empty uses 100.`
  - `infra/k8s/base/api/source/api.env`: the same two comments without "Optional.".
  - `dev/env-overrides/local/rate-limit.env.example`: rename the key and add
    `STATS_LISTEN_DAILY_POPULARITY_CAP="100"` under plan 10's block comment.
  - `scripts/local-env/setup.sh`: rename the key in the rate-limit loop and add
    `STATS_LISTEN_DAILY_POPULARITY_CAP` after `STATS_LISTEN_MIN_INTERVAL_SECONDS`.
  - `apps/api/src/lib/startup/validation.ts`: the stored cap line becomes
    `validateOptional('STATS_LISTEN_DAILY_STORED_CAP', 'Popularity Tracking', 'Use Default (300)')`;
    after plan 10's interval line add
    `validateOptional('STATS_LISTEN_DAILY_POPULARITY_CAP', 'Popularity Tracking', 'Use Default (100)')`.
  - `apps/api/ENV.md` § Related soft caps: rewrite the old cap bullet as
    **`STATS_LISTEN_DAILY_STORED_CAP`** (default `300`): stored listens per listener per UTC day,
    enforced in the database; each feeds the listener's Taste Profile; a new listen past it answers
    200 with `daily_cap_reached` and stores nothing; later reports for a stored session do not
    count against it; unset, empty, or below 1 uses the default. Add the
    **`STATS_LISTEN_DAILY_POPULARITY_CAP`** (default `100`) bullet: past it a listen is stored,
    answers `counted`, feeds the Taste Profile, and adds to no daily total; a value above the
    stored cap is lowered to it. In the `STATS_TRACK_MAX_PER_MINUTE` bullet, name
    `STATS_LISTEN_DAILY_STORED_CAP`, `STATS_LISTEN_DAILY_POPULARITY_CAP`, and
    `STATS_LISTEN_MIN_INTERVAL_SECONDS` as the controls that hold across pods.
- After the edits, `rg --hidden STATS_LISTEN_DAILY_CAP` outside `.llm/` and
  `release-notes/scratchpad.md` finds nothing. Leave the older scratchpad entry that names the old
  key alone; this plan's entry records the rename.

## OpenAPI

`apps/api/openapi.yml` `/stats/listen` description: "counts toward the listener's daily cap"
becomes: the first report of a session stores one listen event, up to the listener's daily cap;
only the first listens of a day, up to a lower cap, count toward popularity, and the rest feed
only the Taste Profile. The `201` description stays ("A new listening session was stored").

## Docs

`docs/features/POPULARITY-AND-TASTE-PROFILE.md`:

- § Tables, `stats_listen_event`: add `popularity_counted` to the column list with its meaning.
- § Daily Totals Are Filled at Write Time, **Listeners** and **Completions** bullets: only
  popularity-counted events add to daily rows, and the first-of-day checks read only those.
- Replace § Daily Cap with `### Daily Caps`: both settings (`STATS_LISTEN_DAILY_STORED_CAP`,
  `STATS_LISTEN_DAILY_POPULARITY_CAP`) and defaults, that the popularity cap never exceeds the
  stored cap, what each blocks, and that later reports for a stored session are never capped.
- § Merged Daily Totals: the same-day overlap counts only popularity-counted events.
- § Taste Rows: a listen past the popularity cap still updates taste rows.

## Files

infra/k8s/base/ops/source/database/linear-migrations/app/0027_stats_listen_event_popularity_counted.sql
infra/k8s/base/ops/kustomization.yaml
infra/k8s/base/api/source/api.env
infra/k8s/base/db/source/bootstrap/0004_app_linear_baseline.sql.gz
infra/k8s/base/db/source/bootstrap/0005_management_linear_baseline.sql.gz
packages/orm/src/entities/stats/statsListenEvent.ts
packages/orm/src/services/stats/listenerIdentity/statsListenWrite.ts
packages/orm/src/services/channel/applyChannelMerge.ts
packages/helpers/src/lib/popularityListen.ts
apps/api/src/config/index.ts
apps/api/src/controllers/stats/statsListen.ts
apps/api/src/lib/startup/validation.ts
apps/api/.env.example
apps/api/ENV.md
dev/env-overrides/local/rate-limit.env.example
scripts/local-env/setup.sh
apps/api/openapi.yml
docs/features/POPULARITY-AND-TASTE-PROFILE.md
apps/api/src/test/stats-listen-write.integration.test.ts
apps/api/src/test/stats.track.test.ts
apps/api/src/test/channel-merge.integration.test.ts
release-notes/scratchpad.md

## Tests

API integration, `apps/api/src/test/stats-listen-write.integration.test.ts`:

- Replace `DAILY_CAP` with `STORED_DAILY_CAP = 300` and `POPULARITY_DAILY_CAP = 100`;
  `ListenInput.dailyCap` becomes `storedDailyCap?` and `popularityDailyCap?`; `listenEvents`
  also selects `popularity_counted`.
- The existing daily cap test passes `storedDailyCap: 2` and `popularityDailyCap: 2` and keeps its
  expectations.
- New test "stores listens past the popularity cap for taste only and counts none of them daily":
  fresh account and a fresh item on `podcastChannelId` (`seedItem`). Read the channel daily row
  first. With `popularityDailyCap: 1, storedDailyCap: 3`: session 1 on `podcastItem` is `counted`
  with `popularity_counted` true; session 2 on the fresh item is `counted`, its event has
  `popularity_counted` false, the fresh item has no daily row, the channel daily row equals what
  session 1 left; taste `listen_count` is 2. Completing session 2 answers `updated`, the fresh
  item still has no daily row, the channel `completion_count` is unchanged, taste
  `completion_count` rose by 1. Session 3 is `counted` (popularity false); session 4 is
  `daily_cap_reached`.

API integration, `apps/api/src/test/channel-merge.integration.test.ts`, test "adds daily totals
without same-day overlap inside retention…": seed a fifth listener whose two `t1` events (old item
and survivor item, both completed) are inserted with `popularity_counted = false`; leave every
seeded daily row and every expected total unchanged. The test then proves those events are not
subtracted.

API route, `apps/api/src/test/stats.track.test.ts`: "passes exactly the report fields…" expects
`stored_daily_cap` and `popularity_daily_cap` from config instead of `daily_cap`.

## Release scratchpad

```markdown
## Public popularity counts take at most 100 listens a day per listener

- Surfaces: api, k8s base env, local env overrides, database migration
- Change: `STATS_LISTEN_DAILY_POPULARITY_CAP` (default 100) caps how many of a listener's
  listens each UTC day count toward popularity. `STATS_LISTEN_DAILY_CAP` is renamed
  `STATS_LISTEN_DAILY_STORED_CAP` (still default 300); it caps stored listens, which all feed the
  Taste Profile. The old key is no longer read. A listen between the two caps is stored with the
  new `stats_listen_event.popularity_counted = false` column and adds nothing to daily totals.
  The API still answers `counted` for it.
- Who notices: heavy listeners' Taste Profiles keep updating past 100 listens a day; public
  counts stop growing from any one listener after 100
- Operator steps: run the app migration; any deployment that sets `STATS_LISTEN_DAILY_CAP` on the
  API renames it to `STATS_LISTEN_DAILY_STORED_CAP`; set `STATS_LISTEN_DAILY_POPULARITY_CAP` to
  change the popularity cap
```
