**Cursor model:** Opus 5.5 · **Reasoning:** high

# 14 — Opting out and back in resets no limits; popularity cooldown after an opt-out

Opting out of Taste Profile and turning it back on must not give a listener a fresh start on
public popularity. After this plan:

- An opt-out keeps the account's pseudonymous listener id. It still deletes every listening record
  right away (listen events, open events, Taste Profile rows, Hidden From Taste Profile rows).
- A No that follows a Yes records `account_settings.listen_stats_opted_out_at`.
- For `STATS_ALL_TIME_RECOUNT_DAYS` days (default 90) after that time, new listens are stored with
  `popularity_counted = false`. They still feed the Taste Profile and answer `counted`. New opens
  store nothing and answer `counted`.
- The 20-second floor treats the opt-out time as a stored listen.
- The stored daily cap still counts the listens the opt-out deleted that day.

## Rows

R24, R25

## Runs after

12

Plan 12 runs after 11, and this plan shares `statsOpenWrite.ts`, the API config, env files,
OpenAPI, and the listen-write test with both. Plan 20 has already run: use its names
(`config.tasteProfileAgreement.version`, `isTasteProfileTrackingAllowed`,
`TasteProfileConsentDecision`, `isTasteProfileConsentOptOutDestructive`, the export key
`listening_data`, and `apps/api/src/test/taste-profile-consent-opt-out.integration.test.ts` and
`account-data-export-listening-data.integration.test.ts`).

## What opt-out does today

- `PATCH /account-settings/listen-stats` with `accepted: false` runs
  `AccountSettingsListenStatsService.update`
  (`packages/orm/src/services/account/accountSettings/accountSettingsListenStats.ts`). It loads the
  `account_settings` row `pessimistic_write`, sets `listen_stats_accepted`,
  `listen_stats_agreement_version`, `listen_stats_decided_at`, and `allow_listen_stats`, and on a
  No calls `ListeningDataDeletionService.deleteForAccount` in the same transaction. Every No
  deletes, including a first-time No from an undecided account, which has nothing to delete.
- `ListeningDataDeletionService.deleteForAccount`
  (`packages/orm/src/services/stats/listenerIdentity/listeningDataDeletion.ts`) finds the listener
  id, takes `lockListener`, and calls `StatsListenerService.deleteForAccount`, which deletes the
  `listener_identity.stats_listener` row. The `ON DELETE CASCADE` foreign keys in
  `0025_popularity_tracking_foundation.sql` remove that listener's `stats_listen_event`,
  `stats_open_event`, `stats_taste_profile`, and `stats_taste_profile_hidden` rows. Daily and range
  totals have no listener column and stay.
- No column records when an opt-out happened. `listen_stats_decided_at` is overwritten by every
  later Yes or No.
- The next counted listen or open after a new Yes creates a **new** listener id
  (`getOrCreateListenerId`).

What that resets today, and what this plan does about each:

| State | Lives in | Today an opt-out and a new Yes | After this plan |
| --- | --- | --- | --- |
| Popularity daily cap (plan 11) | today's events with `popularity_counted` | Restarts at 0 | No listen counts toward popularity for the cooldown, which always outlasts the UTC day |
| Stored daily cap (plan 11) | today's events | Restarts at 0 | The opt-out writes the day's stored count onto the listener row; the cap adds it |
| 20-second floor (plan 10) | the last stored event | Restarts | The opt-out time counts as a stored listen for the floor |
| Flags and the too-soon run (plan 30) | rows keyed by listener id, cascading from `stats_listener` | Gone with the old id | The listener row is kept, so they stay until the account is deleted |
| All-time marks (plan 40) | flags on event rows | Gone with the events | The cooldown lasts as long as the recount period, so the listener cannot add to an all-time total again before that period would have ended |
| All-time totals | daily rows, no listener column | Kept | Kept |

The published agreement already says the random id "stays with your account" and that deleting the
account deletes it. Turning it off promises to delete the Taste Profile, the Hidden From Taste
Profile list, and stored listen records. Keeping the id keeps that promise.

## Behavior

### Opt-out keeps the listener id

`ListeningDataDeletionService.deleteForAccount(account_id, manager)` keeps its name and signature,
and still returns whether a listener row existed. Inside the caller's transaction:

1. `findListenerId`; return `false` when there is none (unchanged).
1. `lockListener(manager, listenerId)` (unchanged); `now = await readTransactionNow(manager)`;
   `today = utcDayBounds(now)`.
1. Read today's stored listens before deleting them:
   `SELECT count(*)::int AS stored_count, min(created_at) AS first_stored_at FROM stats_listen_event WHERE listener_id = $1 AND created_at >= $2 AND created_at < $3`.
1. Merge with a carry the listener row already holds for today (a second opt-out in one day):
   `storedCount = earlier.storedCount + stored_count`, `firstStoredAt` = the earlier of the two
   non-null times. Write it with `StatsListenerService.writeOptOutDayCarry`. When `storedCount` is
   0, write the empty carry (`null` day, 0, `null`).
1. Delete the listening data by name, in this order, each as
   `DELETE FROM <table> WHERE listener_id = $1`: `stats_listen_event`, `stats_open_event`,
   `stats_taste_profile`, `stats_taste_profile_hidden`. Use a module constant
   `LISTENING_DATA_TABLES` with a doc comment: these are the listener-linked tables that hold
   listening data; an opt-out empties them and keeps the listener row and anything kept for write
   limits, which the account's deletion removes.
1. Return `true`.

Remove `StatsListenerService.deleteForAccount`; nothing else calls it. Account deletion is
unchanged: `stats_listener.account_id` cascades from `account`, and every listener-linked table
cascades from `stats_listener`.

Update the class doc comment of `ListeningDataDeletionService` to say what it deletes, what it
keeps (the listener id and the day's stored count), and why (write limits and flags must not
restart when the listener turns Taste Profile on again).

### Recording the opt-out time

In `AccountSettingsListenStatsService.update`, before changing the row:

```typescript
const optingOut = dto.accepted === false && accountSettings.listen_stats_accepted === true;
const decidedAt = new Date();
```

Use `decidedAt` for `listen_stats_decided_at`, and set
`accountSettings.listen_stats_opted_out_at = decidedAt` when `optingOut`. A Yes never changes the
column, and neither does a No from an undecided or already-declined account. A later opt-out
replaces the time, so each opt-out starts a new cooldown. Update the method's doc comment.

### Popularity cooldown

`packages/orm/src/services/stats/listenerIdentity/statsWriteGuard.ts`:

- Replace `isTrackingAllowedForUpdate` with:

  ```typescript
  export type TrackingConsent = {
    allowed: boolean;
    /** The last opt-out that followed a Yes, or null. */
    optedOutAt: Date | null;
  };

  export async function readTrackingConsentForUpdate(
    manager: EntityManager,
    accountId: number,
    agreementVersion: string
  ): Promise<TrackingConsent>
  ```

  Same `FOR SHARE` query, also selecting `listen_stats_opted_out_at`. `allowed` is what
  `isTrackingAllowedForUpdate` returned (false for a missing row); `optedOutAt` is the column when
  it is a `Date`, else `null`. Keep the doc comment and add the opt-out time.
- Add:

  ```typescript
  /**
   * Whether `now` falls inside the popularity cooldown that follows an opt-out: listens still
   * feed the Taste Profile, and nothing counts toward popularity.
   */
  export function isInOptOutCooldown(
    optedOutAt: Date | null,
    now: Date,
    cooldownDays: number
  ): boolean {
    return optedOutAt !== null && optedOutAt.getTime() > subtractDays(now, cooldownDays).getTime();
  }
  ```

  Import `subtractDays` from `@podverse/helpers`.

The cooldown length is `report.all_time_recount_days`, the same value plan 40 uses as the all-time
recount period. One setting drives both, so the cooldown always lasts exactly as long as a recount
period.

### Listen write path

`packages/orm/src/services/stats/listenerIdentity/statsListenWrite.ts`, as plans 10–12 leave it:

- `StatsListenReport` gains
  `/** Days after an opt-out during which the listener's new listens count toward no popularity total. */ all_time_recount_days: number;`
- `recordListen`, in order:
  1. `const consent = await readTrackingConsentForUpdate(…)`; `if (!consent.allowed) return 'not_allowed';`
  1. `const now = await readTransactionNow(manager);` moves here, from after `lockListener`.
     `now()` is the transaction's start time, so the value is the same; it is needed before the
     listener lookup. Remove the later call.
  1. `const coolingDown = isInOptOutCooldown(consent.optedOutAt, now, report.all_time_recount_days);`
  1. `const optOutTooSoon = report.min_interval_seconds > 0 && consent.optedOutAt !== null && consent.optedOutAt.getTime() > now.getTime() - report.min_interval_seconds * 1000;`
  1. Resolve target and rule (unchanged).
  1. Listener lookup. When there is no listener id: `below_threshold` when the rule is not met
     (unchanged); then `if (optOutTooSoon) return 'too_soon';` before `getOrCreateListenerId`, so a
     too-soon report never creates a listener id (plan 10's rule).
  1. `lockListener`, session match, rule check (unchanged).
  1. Plan 10's floor becomes: `if (optOutTooSoon) return 'too_soon';` then plan 10's
     recent-event query and its `return 'too_soon'`. Keep one `too_soon` branch shape so a later
     plan can hook both returns: write it as
     `const tooSoon = optOutTooSoon || (await hasRecentListen(…));` followed by one
     `if (tooSoon) { return 'too_soon'; }`, where `hasRecentListen` wraps plan 10's query (run it
     only when `optOutTooSoon` is false and `min_interval_seconds > 0`).
  1. `today`, `listenerDay` (plan 11, unchanged), then
     `const carried = await this.listenerService.readOptOutDayCarry(listenerId, today.day, manager);`
  1. Stored cap: `if (listenerDay.storedCount + carried.storedCount >= report.stored_daily_cap) return 'daily_cap_reached';`
  1. `const popularityCounted = !coolingDown && listenerDay.popularityCount < report.popularity_daily_cap;`
     Everything after is plan 11's code: insert with `popularityCounted`, daily rows only when it is
     true, taste always, return `'counted'` either way.
- Session updates are unchanged: a stored session's completion adds to daily rows only when its
  event has `popularity_counted`, and events stored in the cooldown do not.
- Class doc comment: add that after an opt-out the listener's new listens feed taste rows only for
  the cooldown, and the answer does not say so.

### Open write path

`packages/orm/src/services/stats/listenerIdentity/statsOpenWrite.ts`, as plan 12 leaves it:

- `StatsOpenReport` gains the same `all_time_recount_days: number;` field, with the doc comment
  "Days after an opt-out during which the opener's opens are not recorded."
- `recordOpen`: use `readTrackingConsentForUpdate`; move `readTransactionNow` up to right after
  the consent check (remove the later call); after the `own_content` return and before the
  listener lookup, `if (isInOptOutCooldown(consent.optedOutAt, now, report.all_time_recount_days)) return 'counted';`
- A cooldown open creates no listener id, stores no event, writes no daily row, and does not use up
  the open cap. Opens never feed taste, so there is nothing to keep, and answering `counted`
  matches the listen path, which never says whether something counted.
- Class doc comment: add the cooldown sentence.

### `StatsListenerService`

`packages/orm/src/services/stats/listenerIdentity/statsListener.ts`:

```typescript
/** Listens stored on the listener's last opt-out day, which the opt-out deleted. */
export type OptOutDayCarry = { storedCount: number; firstStoredAt: Date | null };
```

- `readOptOutDayCarry(listenerId: string, day: string, manager: EntityManager): Promise<OptOutDayCarry>`:
  reads `opt_out_day`, `opt_out_day_stored_count`, `opt_out_day_first_stored_at` by primary key.
  A row whose `opt_out_day` is `day` returns its count and time. A row whose `opt_out_day` is an
  earlier day is cleared (`writeOptOutDayCarry(listenerId, null, manager)`) and reads as
  `{ storedCount: 0, firstStoredAt: null }`, so the count is kept no longer than its own day plus
  the next report. A null day reads as empty. Doc comment says the caller holds the listener lock.
- `writeOptOutDayCarry(listenerId: string, carry: (OptOutDayCarry & { day: string }) | null, manager: EntityManager): Promise<void>`:
  one `UPDATE` of the three columns by primary key; `null` writes `NULL, 0, NULL`.
- TypeORM returns a `date` column as a `YYYY-MM-DD` string; compare it as text with `day` from
  `utcDayBounds`.

## Schema

New linear migration, provisionally
`infra/k8s/base/ops/source/database/linear-migrations/app/0028_listen_stats_opt_out_cooldown.sql`
(plan 11 is `0027_`; Close renumbers plans 30 and 40 after this one and may renumber this file;
use the number the COPY-PASTA prompt names if it differs):

```sql
-- When the account last turned Taste Profile off after a Yes. For STATS_ALL_TIME_RECOUNT_DAYS
-- after it, the listener's new listens feed the Taste Profile and count toward no popularity
-- total.
ALTER TABLE public.account_settings
    ADD COLUMN listen_stats_opted_out_at timestamp with time zone;

-- Listens stored on the UTC day of the listener's last opt-out, which the opt-out deleted. The
-- stored daily cap adds them for the rest of that day.
ALTER TABLE listener_identity.stats_listener
    ADD COLUMN opt_out_day date,
    ADD COLUMN opt_out_day_stored_count integer DEFAULT 0 NOT NULL,
    ADD COLUMN opt_out_day_first_stored_at timestamp with time zone,
    ADD CONSTRAINT stats_listener_opt_out_day_check
        CHECK ((opt_out_day IS NULL) = (opt_out_day_first_stored_at IS NULL)
               AND opt_out_day_stored_count >= 0
               AND (opt_out_day IS NOT NULL OR opt_out_day_stored_count = 0));
```

- No backfill: nothing with this tracking has shipped, so no earlier opt-out needs a time.
- No grants: `account_settings` and `listener_identity.stats_listener` keep their existing grants,
  and new columns inherit table privileges.
- Follow **linear-sql-greenfield-only** and **migration-readiness-marker-sync**: set
  `API_EXPECTED_MIGRATION_FILENAME` in `infra/k8s/base/api/source/api.env` and in the
  `podverse-ops-migration-scripts` literals of `infra/k8s/base/ops/kustomization.yaml`, list the
  file under `podverse-ops-app-linear-migrations` `files` there, then run
  `make db_regen_linear_baseline` and `make db_verify_linear_baseline` and leave the regenerated
  `infra/k8s/base/db/source/bootstrap/0004_app_linear_baseline.sql.gz` and
  `0005_management_linear_baseline.sql.gz` in the tree. If those targets cannot run (no Docker),
  stop and report BLOCKED.

Entities:

- `packages/orm/src/entities/account/accountSettings/accountSettings.ts`: after
  `listen_stats_decided_at`,
  `@Column({ type: 'timestamptz', name: 'listen_stats_opted_out_at', nullable: true }) listen_stats_opted_out_at!: Date | null;`
  with a one-line doc comment.
- `packages/orm/src/entities/stats/statsListener.ts`: `opt_out_day` (`type: 'date', nullable: true`,
  `string | null`), `opt_out_day_stored_count` (`type: 'integer', default: 0`, `number`),
  `opt_out_day_first_stored_at` (`type: 'timestamptz', nullable: true`, `Date | null`), each with a
  one-line doc comment.
- `packages/orm/src/services/account/account.ts` `ensureAccountSettings`: set
  `accountSettings.listen_stats_opted_out_at = null;` beside the other `listen_stats_*` nulls.

The management database browser never lists `stats_listener`
(`apps/management-api/src/lib/database/tablePolicy.ts`); this plan does not change that.

## Config, controllers, env

- `packages/helpers/src/lib/popularityListen.ts`, beside plans 10–12's constants:

  ```typescript
  /**
   * Days after an opt-out during which a listener's new listens count toward no popularity
   * total, unless `STATS_ALL_TIME_RECOUNT_DAYS` sets another value.
   */
  export const POPULARITY_DEFAULT_ALL_TIME_RECOUNT_DAYS = 90;
  ```

- `apps/api/src/config/index.ts`: in `popularityTracking`, add
  `allTimeRecountDays: readWholeNumberEnv('STATS_ALL_TIME_RECOUNT_DAYS', POPULARITY_DEFAULT_ALL_TIME_RECOUNT_DAYS, 1)`
  and `allTimeRecountDays: number;` in the `Config` type with the doc comment "Days after an
  opt-out during which the listener's new listens and opens count toward no popularity total."
  Do not clamp it here.
- `apps/api/src/controllers/stats/statsListen.ts` and `statsOpen.ts`: pass
  `all_time_recount_days: config.popularityTracking.allTimeRecountDays`.
- Place `STATS_ALL_TIME_RECOUNT_DAYS` right after plan 12's `STATS_OPEN_DAILY_CAP` in each file
  (**env-file-formatting**, **env-defaults-match-code**, **startup-validation-env-order**):
  - `apps/api/.env.example`:
    `# Optional. Days after an opt-out during which a listener's new listens count toward no popularity total. Empty uses 90.`
    then `STATS_ALL_TIME_RECOUNT_DAYS="90"`.
  - `infra/k8s/base/api/source/api.env`: the same comment without "Optional.", then
    `STATS_ALL_TIME_RECOUNT_DAYS=90`.
  - `dev/env-overrides/local/rate-limit.env.example`: `STATS_ALL_TIME_RECOUNT_DAYS="90"` under
    plan 10's block comment.
  - `scripts/local-env/setup.sh`: add `STATS_ALL_TIME_RECOUNT_DAYS` to the rate-limit loop after
    `STATS_OPEN_DAILY_CAP`.
  - `apps/api/src/lib/startup/validation.ts`: after the `STATS_OPEN_DAILY_CAP` line,
    `validateOptional('STATS_ALL_TIME_RECOUNT_DAYS', 'Popularity Tracking', 'Use Default (90)')`.
  - `apps/api/ENV.md` § Related soft caps: "**`STATS_ALL_TIME_RECOUNT_DAYS`** (default `90`): for
    this many days after an account turns Taste Profile off, its new listens are stored for the
    Taste Profile but count toward no popularity total, and its opens are not recorded. Unset,
    empty, or below 1 uses the default."

## DTO, export, and OpenAPI

- `packages/helpers/src/dtos/account/accountSettings/accountSettings.ts`: add
  `listen_stats_opted_out_at: string | null;` after `listen_stats_decided_at`. The account
  settings entity is serialized as-is into `GET /auth/me`, so the field appears there once the
  column exists. Adding a field only widens the DTO that mobile stores in `account_snapshot`. No
  client reads it, and an older stored copy without it reads as `undefined`, which nothing uses.
- `apps/api/openapi.yml` `components.schemas.AccountSettings` (search `AccountSettings:` near the
  `listen_stats_decided_at` property): add `listen_stats_opted_out_at` (`string`, `date-time`,
  nullable) with the description "When the account last turned Taste Profile off after a Yes.
  New listens count toward no popularity total for a server-set number of days after it."
- `apps/api/openapi.yml` `/stats/listen` description: add "For a server-set number of days after
  the account turns Taste Profile off, new listens are stored for the Taste Profile only and
  still answer `counted`." `/stats/open` description: add "For a server-set number of days after
  the account turns Taste Profile off, opens are not recorded and still answer `counted`." The
  PATCH `/account-settings/listen-stats` description: a No after a Yes records the opt-out time,
  deletes listening records, and keeps the pseudonymous id.
- Account data export: `packages/helpers/src/dtos/account/accountDataExport.ts`
  `DTOAccountDataExport` gains `listen_stats_opted_out_at: string | null;` after
  `listen_stats_decided_at`. `packages/orm/src/services/account/accountDataExport.ts`: add it to
  the return type and to `exportData`, as an ISO string from
  `account.account_settings?.listen_stats_opted_out_at`, built like `listenStatsDecidedAt`.
  The opt-out-day carry and the listener id stay out of the export.

## Docs

`docs/features/POPULARITY-AND-TASTE-PROFILE.md`, on top of plans 10–12 and 20:

- § Tables, `listener_identity.stats_listener`: the id never rotates and disappears only when the
  account is deleted; an opt-out keeps it. Add the three `opt_out_day*` columns and their meaning.
- § Listener Id and Its Separation: one row exists per account from its first counted listen or
  open until the account is deleted. Replace the "Opt-out deletion is one statement" bullet: an
  opt-out deletes the listener's listen events, open events, taste rows, and hidden rows by name,
  keeps the listener row, and writes the day's stored count onto it.
- § Consent Under a Row Lock: the opt-out deletes the listener's listening data (not the listener
  row) in the same transaction, so a report that started before it cannot keep data afterwards.
- Plan 10's § Minimum Interval: the opt-out time counts as a stored listen for the interval.
- Plan 11's § Daily Caps: on the UTC day of an opt-out, the stored cap also counts the listens the
  opt-out deleted.
- New `### Popularity Cooldown After an Opt-Out`, after § Daily Caps: the setting and default; a
  No after a Yes records `listen_stats_opted_out_at`, and a later opt-out restarts the cooldown;
  during the cooldown new listens are stored with `popularity_counted = false`, feed taste rows,
  and answer `counted`; opens store nothing and answer `counted`. Include a short list of what an
  opt-out and a new Yes do not reset: the listener id, the daily caps, the minimum interval,
  anything else kept by listener id until the account is deleted, and all-time totals. Explain
  that the cooldown has the same length as the all-time recount period, which is why it covers
  the deleted all-time marks.
- § Consent Lifecycle intro: the export also has the top-level `listen_stats_opted_out_at`.
- § Opting Out Deletes Listening Data: rewrite the bullets to match: the opt-out time, deletion by
  table with the listener row kept, the carry, and "turning Taste Profile on again reuses the same
  listener id; the Taste Profile and recommendations start from scratch because their rows are
  gone". "Deleting the account cascades the same way" becomes "Deleting the account deletes the
  listener row, and every listener-linked row cascades from it."
- § Consent and the Write Path Under Locks: "deletes the listener row" becomes "deletes the
  listener's listening data"; "the cascade then removes what it wrote" becomes "the deletion then
  removes what it wrote". The write path reads `listen_stats_opted_out_at` in the same `FOR SHARE`
  read as the decision.

## Files

infra/k8s/base/ops/source/database/linear-migrations/app/0028_listen_stats_opt_out_cooldown.sql
infra/k8s/base/ops/kustomization.yaml
infra/k8s/base/api/source/api.env
infra/k8s/base/db/source/bootstrap/0004_app_linear_baseline.sql.gz
infra/k8s/base/db/source/bootstrap/0005_management_linear_baseline.sql.gz
packages/orm/src/entities/account/accountSettings/accountSettings.ts
packages/orm/src/entities/stats/statsListener.ts
packages/orm/src/services/account/account.ts
packages/orm/src/services/account/accountSettings/accountSettingsListenStats.ts
packages/orm/src/services/account/accountDataExport.ts
packages/orm/src/services/stats/listenerIdentity/listeningDataDeletion.ts
packages/orm/src/services/stats/listenerIdentity/statsListener.ts
packages/orm/src/services/stats/listenerIdentity/statsWriteGuard.ts
packages/orm/src/services/stats/listenerIdentity/statsListenWrite.ts
packages/orm/src/services/stats/listenerIdentity/statsOpenWrite.ts
packages/helpers/src/lib/popularityListen.ts
packages/helpers/src/dtos/account/accountSettings/accountSettings.ts
packages/helpers/src/dtos/account/accountDataExport.ts
apps/api/src/config/index.ts
apps/api/src/controllers/stats/statsListen.ts
apps/api/src/controllers/stats/statsOpen.ts
apps/api/src/lib/startup/validation.ts
apps/api/.env.example
apps/api/ENV.md
apps/api/openapi.yml
dev/env-overrides/local/rate-limit.env.example
scripts/local-env/setup.sh
docs/features/POPULARITY-AND-TASTE-PROFILE.md
apps/api/src/test/taste-profile-consent-opt-out.integration.test.ts
apps/api/src/test/account-data-export-listening-data.integration.test.ts
apps/api/src/test/stats-listen-write.integration.test.ts
apps/api/src/test/stats.track.test.ts
release-notes/scratchpad.md

## Tests

API integration, `apps/api/src/test/taste-profile-consent-opt-out.integration.test.ts` (plan 20's
name for the opt-out test). Add a helper `optedOutAt(accountId)` that reads
`listen_stats_opted_out_at` from `account_settings`, and `optOutDayCarry(listenerId)` that reads
the three `opt_out_day*` columns.

- The first test becomes "keeps the listener id and deletes every linked row on a No, and leaves
  other listeners and daily totals alone": `listenerIdOf(listenerA.id)` still equals
  `listenerIdA`, `rowsForListenerId(listenerIdA)` is 0, `listeningRowCounts(listenerA.id)` is
  `{ listener: 1, taste: 0, hidden: 0, listens: 0, opens: 0 }`, and `optedOutAt(listenerA.id)` is
  not null. Listener B and the daily totals are unchanged, as before.
- "records a No from an account with no listener id…": also expect `optedOutAt` to be null (a
  first-time No is not an opt-out).
- New "records the opt-out time only for a No that follows a Yes, and a later Yes keeps it": an
  allowed account says No (time T1 not null); No again (still T1); Yes (still T1).
- New "carries today's stored listens onto the kept listener row": an allowed account with
  `seedListeningData` plus one more listen event inserted the same way (default `created_at`).
  Before the No, read `count(*)` and `min(created_at)` of that listener's events since today's UTC
  midnight (computed in JS). Answer No; the carry's day is today's UTC date, its count is 2, and
  its first time equals the `min(created_at)` read before. Insert no backdated events: the test
  database may not have the previous month's partition.
- New "deleting the account removes the kept listener row": after a No, `AccountService.delete`
  the account; `listenerIdOf` is null. Remove the id from `createdAccountIds` so `afterAll` does
  not delete it twice.

API integration, `apps/api/src/test/stats-listen-write.integration.test.ts`:

- New constant `ALL_TIME_RECOUNT_DAYS = 90`. `ListenInput` gains `allTimeRecountDays?: number`;
  `listen` passes `all_time_recount_days: input.allTimeRecountDays ?? ALL_TIME_RECOUNT_DAYS`; the
  `open` helper always passes `all_time_recount_days: ALL_TIME_RECOUNT_DAYS`.
- Helper `setOptedOutAt(accountId, sqlInterval)` runs
  `UPDATE account_settings SET listen_stats_opted_out_at = now() - $2::interval WHERE account_id = $1`.
- "stores listens in the opt-out cooldown for the Taste Profile only and answers counted": fresh
  allowed account; `setOptedOutAt(id, '1 day')`; a session on a fresh item (`seedItem`) is
  `counted`, its event has `popularity_counted` false, the item has no daily row, taste
  `listen_count` is 1. `setOptedOutAt(id, '91 days')`; a session on a second fresh item is
  `counted` with `popularity_counted` true and that item's daily `listener_count` is 1.
- "answers too_soon for a new listen inside the minimum interval after an opt-out, without
  creating a listener id": fresh allowed account with no listener row; `setOptedOutAt(id, '5
  seconds')`; a session with `minIntervalSeconds: 20` is `too_soon` and `listenerRowCount` is 0;
  `setOptedOutAt(id, '21 seconds')`; the same session is `counted`.
- "keeps today's stored listens against the stored cap after an opt-out and a new Yes": fresh
  allowed account; with `storedDailyCap: 3`, two sessions `counted`; remember `listenerIdOf`;
  `AccountSettingsListenStatsService.update` with `accepted: false`, then with `accepted: true`
  (both with `AGREEMENT_VERSION`); `listenerIdOf` is unchanged; session 3 is `counted` with
  `popularity_counted` false; session 4 is `daily_cap_reached`. Then
  `UPDATE listener_identity.stats_listener SET opt_out_day = opt_out_day - 1, opt_out_day_first_stored_at = opt_out_day_first_stored_at - interval '1 day'`
  for that listener; session 5 is `counted` (the stale carry no longer counts) and the row's
  `opt_out_day` is now null.
- "does not record opens in the opt-out cooldown": fresh allowed opener and a fresh owner;
  `setOptedOutAt(opener, '1 day')`; opening the owner's profile is `counted`, the opener has no
  `stats_open_event` row and no listener row, and the owner has no `stats_daily_account` row
  today. `setOptedOutAt(opener, '91 days')`; the same open is `counted` and stores one event.

API integration, `apps/api/src/test/account-data-export-listening-data.integration.test.ts`: the
existing export test expects `listen_stats_opted_out_at` null for a fresh account. Add one case:
after setting the column with SQL, the export has it as the same ISO string.

API route, `apps/api/src/test/stats.track.test.ts`: the "passes exactly the report fields…" tests
for listen and open expect `all_time_recount_days: config.popularityTracking.allTimeRecountDays`.

## Release scratchpad

```markdown
## Turning Taste Profile off and on again does not reset popularity limits

- Surfaces: api, k8s base env, local env overrides, database migration
- Change: a No after a Yes on `PATCH /account-settings/listen-stats` records the new
  `account_settings.listen_stats_opted_out_at`. For `STATS_ALL_TIME_RECOUNT_DAYS` days (default
  90) after it, new listens are stored for the Taste Profile only (`popularity_counted = false`)
  and still answer `counted`, and profile and playlist opens are not recorded and still answer
  `counted`. Opting out still deletes listen records, open records, the Taste Profile, and Hidden
  From Taste Profile right away, but keeps the account's pseudonymous listener id, so limits kept
  by that id survive. A new listen within the minimum interval of the opt-out answers
  `too_soon`, and the stored daily cap still counts that day's deleted listens. `GET /auth/me`
  account settings and the account data export include `listen_stats_opted_out_at`.
- Who notices: listeners who turn Taste Profile off and on again; their listens do not count
  toward public popularity for 90 days. Nobody else.
- Operator steps: run the app migration; set `STATS_ALL_TIME_RECOUNT_DAYS` on the API to change the
  period
```
