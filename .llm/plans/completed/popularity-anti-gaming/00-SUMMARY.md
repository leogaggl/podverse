# Popularity anti-gaming — summary

Prompts and models: see `COPY-PASTA.md` in this set; phases and file ownership are in
`00-EXECUTION-ORDER.md`. The request and the
operator's answers are in `00-REQUEST.md`; the answers there are settled and override the
request's first wording (for example the 30-second floor became 20 seconds, and the single cap of
100 became two caps).

## Base branch

`feature/popularity-anti-gaming` fast-forwards onto `feature/combined`, which holds
`feature/popularity-tracking-rebuild` and the other combined features. Every path below is a path
on `feature/combined`. There the foundation migration is `0025_popularity_tracking_foundation.sql`,
followed by `0026_drop_legacy_stats.sql`. Before researching, confirm
`packages/orm/src/services/stats/listenerIdentity/statsListenWrite.ts` exists; if it does not, the
fast-forward has not happened.

## Requirement ledger

- **R1** (area A) "Listen time is reported by the device: the server trusts seconds_heard and checks it only against the item's length, not against real time passing. A scripted client could reach 300 counted listens in minutes." — Plan: 10
- **R2** (area A) "prevents an account from adding more than one count per user per 30 seconds" — settled as a flat 20-second server-side floor between one listener's new counted listens, an env setting defaulting to 20, enforced in the listen write transaction under the per-listener lock; reports for an already-stored session (same `client_listen_id`) are updates and skip the floor — Plan: 10 (legal copy 13)
- **R3** (area A) "an attempt for the server to ignore listens that seem to violate the 60 seconds or 25% rule" — confirm the counted-listen rule in code matches what the request describes — Plan: 10
- **R4** (area A) "recommended that a too-soon report answer **429**" — settled as a **2xx** with a new "not counted" result; nothing is stored and the report is not retried — Plan: 10
- **R5** (area A) "300 seems too many as the default. lets make that 100." — settled as two caps: "at most **100** listens per listener per UTC day count toward popularity" — Plan: 11 (legal copy 13)
- **R6** (area A) "up to **300** per day are still stored and feed the Taste Profile" — Plan: 11 (legal copy 13)
- **R7** (area C) "can you also add some type of flagging for accounts that seem to be conspicuously listening in a botted way?" — Plan: 30
- **R8** (area C) "Detection signals and thresholds are for planning to propose (too-soon reports and daily-cap hits are the obvious inputs)" — Plan: 30
- **R9** (area C) "we may add them to a stats tracking shadowban list" — settled as "auto-flag and auto-exclude a listener from popularity as soon as it is flagged" — Plan: 30 (legal copy 33)
- **R10** (area C) "Flags and exclusions are keyed by the pseudonymous listener id, never the account id" — Plan: 30, 31
- **R11** (area C) "an admin can clear the exclusion" — Plan: 31, 32
- **R12** (area D) "their stats are still used for a taste profile but not for the popularity count of the show" — Plan: 41 (write-time exclusion 30)
- **R13** (area D) "i also don't like that one account can get counted twice for listening to the same show in 2 days" — settled as "day, week, and month range counts become **distinct listeners in that window**, computed from the listen events" — Plan: 41 (legal copy 42)
- **R14** (area D) "don't we keep the listen event rows for 90 days?" — answer from the retention code — Plan: 41
- **R15** (area D) "can we prevent the listen tracking from happening twice in however many days that is set?" — settled as "All-time counts a listener **once per show per N days**, N an env setting defaulting to 90 (not above event retention)" — Plan: 40
- **R16** (area D) "Day, week, and month open counts become **distinct openers in that window**, and all-time follows the same once-per-N-days rule as listens" — opens excluded for flagged listeners too (R19's store) — Plan: 40 (all-time), 41 (day, week, month), legal copy 42
- **R17** (area A) "Every client treats it as done and drops it … Mobile and web must accept the new result without logging it as an error" — the mobile outbox (`runDrainPass`, `classifyStatsListenSendFailure`) and the web sender handle the not-counted result — Plan: 10 (answered: both clients already treat any 2xx as done, so no client code changes)
- **R18** (area A) "At most **10** counted opens per listener per UTC day, **profiles and playlists combined**, an env setting defaulting to 10" — opens past the cap store nothing; own-content opens keep returning `own_content`; no 20-second floor for opens — Plan: 12 (legal copy 13)
- **R19** (area C) "Flagged listeners' opens are excluded from popularity, same as their listens" — whether open-cap hits are a flagging signal is for area C to propose — Plan: 30

Rows R20–R40 come from the first review (`00-REQUEST.md` § Review of the first planning pass).
The step named in each row is in the planning run's second pass.

- **R20** (area A, step 07) D5 "rename both keys, STATS_LISTEN_DAILY_STORED_CAP (300) and STATS_LISTEN_DAILY_POPULARITY_CAP (100)" — `STATS_LISTEN_DAILY_CAP` goes away everywhere; areas C and D update their own plans' references (steps 08, 09) — Plan: 11
- **R21** (area C, step 08) D11 "flag only when 300 stored listens are reached within 3 hours of the first stored listen of the day, STATS_FLAG_STORED_CAP_WITHIN_HOURS default 3, 0 turns it off" — Plan: 30
- **R22** (area D, step 09) D31 "API startup fails with a clear message when STATS_ALL_TIME_RECOUNT_DAYS is greater than STATS_TRACK_EVENT_RETENTION_DAYS. No quiet lowering." — Plan: 40
- **R23** (area C, step 08) D32 "tighten plan 33 in all four locales: listens and opens recorded while the mark was in place stay left out after it is removed" — Plan: 33
- **R24** (area A, step 07) D33 "opting out and back in must not reset caps, flags or all-time counts" — plan 14 owns it; steps 08 and 09 make plans 30 and 40 honor it — Plan: 14 (also 30 flags, 33 legal copy, 40 all-time marks, 41 windows)
- **R25** (area A, step 07) D33 "After any opt-out, a popularity cooldown of STATS_ALL_TIME_RECOUNT_DAYS (90) applies, stored in a new account_settings.listen_stats_opted_out_at column. Listens still feed the Taste Profile and answer counted." — new plan 14, after plan 11 — Plan: 14
- **R26** (area D, step 09) D33 "One legal sentence goes in plan 42" — Plan: 42
- **R27** (area C, step 08) D34 "the too-soon signal counts only an unbroken run. A too-soon minute more than 2 minutes after the last one resets the count to 1 … No new storage beyond the count and last minute plan 30 already keeps" — Plan: 30
- **R28** (area C, step 08) D35 "a too_soon answer does not count toward the signal when the server-side duration of the item or clip is under 60 seconds. The floor itself still applies." — Plan: 30
- **R29** (area C, step 08) D36 "the E2E API env and the web E2E server env set STATS_FLAG_TOO_SOON_MINUTES=0 and STATS_FLAG_STORED_CAP_WITHIN_HOURS=0" — Plan: 30
- **R30** (area B, step 06) D37 "the user-facing name of the opt-in changes from Popularity Tracking to Taste Profile in web, mobile, legal and terms, in all four locales" — Plan: 20
- **R31** (area B, step 06) D37 "The summary next to the switch says plainly that {brand_name} tracks your listens to build your Taste Profile, and that those listens also count toward public popularity rankings without your name" — Plan: 20
- **R32** (area B, step 06) D37 "Buttons and status copy use the new name, for example Yes, Build My Taste Profile and Turn Off Taste Profile?" — Plan: 20
- **R33** (area B, step 06) D37 "Web Settings merges the switch section and the Taste Profile list into one Taste Profile section: heading, switch, short description, then the shows list and Hidden From Taste Profile" — Plan: 20
- **R34** (area B, step 06) D37 "Mobile uses the same layout on its renamed screen" — Plan: 20
- **R35** (area B, step 06) D37 "The web consent page moves from /popularity-tracking to /taste-profile with no redirect" — Plan: 20
- **R36** (area B, step 06) D37 "Internal identifiers that name the opt-in as popularity tracking are renamed too: i18n namespace and keys, routes, components such as PopularityAgreementGate, helpers, config … the API legal path and the apps/api/legal/popularity-tracking folder, docs, abcmemory references, tests, E2E specs and Maestro flows" — Plan: 20
- **R37** (area B, step 06) D37 "the env keys POPULARITY_TRACKING_AGREEMENT_VERSION and POPULARITY_TRACKING_CONTENT_DIR in every env file, k8s env, ENV.md and startup validation" — Plan: 20
- **R38** (area B, step 06) D37 "New names must not collide with existing taste profile identifiers, for example use an agreement or consent suffix" — Plan: 20
- **R39** (area B, step 06) D37 "Keep popularity names where they mean public counts: stats_popularity tables, popularity caps, popularity_counted, ranking code, and the management Flagged Listeners page. Keep the account_settings listen_stats columns." — Plan: 20
- **R40** (area B, step 06) D37 "No agreement or terms version bump" — Plan: 20

The request's closing lines ("ask questions if you need to", "don't assume what i am saying is
correct") are instructions to every area, not rows: each area checks the request's claims against
the code before planning on them (R1, R3, R14 are the explicit ones).

## Areas

### Area A — Listen and open write limits (wave 1, plans 10–19)

- **Rows:** R1, R2, R3, R4, R5, R6, R17, R18
- **Starts from:** `packages/orm/src/services/stats/listenerIdentity/statsListenWrite.ts`
  (`StatsListenWriteService.recordListen`, `LISTENER_DAY_SQL`, daily and taste writes),
  `statsOpenWrite.ts` (`StatsOpenWriteService`), `statsWriteGuard.ts` (`lockListener`,
  `utcDayBounds`), `packages/helpers/src/lib/popularityListen.ts` (`PopularityListenResult`,
  `isCountedListen`) and the open result type, `apps/api/src/controllers/stats/statsListen.ts`
  (`listenResponse`) and the open controller, `apps/api/src/config/index.ts`
  (`popularityTracking.dailyListenCap`), every file holding `STATS_LISTEN_DAILY_CAP`, and the
  listen senders: `apps/mobile/src/data/repositories/statsRepository.ts` (`runDrainPass`),
  `statsListenOutbox.ts` (`classifyStatsListenSendFailure`), and
  `apps/web/src/utils/statsTracking/statsTracking.ts`.
- **Scope:** the 20-second floor and its env setting; the not-counted too-soon result, answered
  as 2xx; splitting the daily listen cap into a popularity cap (100) and a stored cap (300) with
  env settings; how a stored-but-not-popularity listen is marked so area D can tell it apart (for
  example a column on `stats_listen_event`), and the SQL migration for it; the combined open cap
  (10 per listener per UTC day) with its env setting and result; mobile and web accepting the new
  results without errors or retries; the legal copy that states the caps
  (`apps/api/src/lib/legal/popularityTrackingContent.ts`, `termsContent.ts`) and whether the
  agreement version changes.
- **Depends on:** no other area.
- **Shares files with:** area C (`statsListenWrite.ts`, `statsOpenWrite.ts`,
  `popularityListen.ts`, `statsListen.ts`, API env files), area D (`statsListenWrite.ts` and
  `statsOpenWrite.ts` daily-row writes, `stats_listen_event` schema), all areas
  (`docs/features/POPULARITY-AND-TASTE-PROFILE.md`, linear migrations and baseline archives, readiness
  marker, `release-notes/scratchpad.md`).

### Area B — Taste Profile rename of the opt-in (second pass, plan 20)

- **Rows:** R30–R40
- **Starts from:** the web consent page under `/popularity-tracking`, `PopularityAgreementGate`,
  web Settings' tracking switch and Taste Profile sections, the mobile tracking screen, the i18n
  namespace for the opt-in, `apps/api/src/lib/legal/popularityTrackingContent.ts`,
  `apps/api/legal/popularity-tracking/`, `termsContent.ts`, every file holding
  `POPULARITY_TRACKING_AGREEMENT_VERSION` or `POPULARITY_TRACKING_CONTENT_DIR`, and abcmemory
  references (`.cursor/**`).
- **Scope:** one plan, 20, that renames the opt-in's user-facing name and its internal
  identifiers, merges web Settings into one Taste Profile section, matches the layout on mobile,
  and moves the consent route. Popularity names that mean public counts stay (R39).
- **Depends on:** no other plan. Every other plan in the set runs after it and uses its names.
- **Shares files with:** every area (API env files, legal Markdown, docs, `release-notes/scratchpad.md`).

### Area C — Botted-listener flagging and admin clear (wave 2, plans 30–39)

- **Rows:** R7, R8, R9, R10, R11, R19
- **Starts from:** area A's plans, `statsListenWrite.ts` (where too-soon and cap hits happen),
  `.cursor/rules/popularity-listener-id-separation.mdc`,
  `packages/orm/src/services/stats/statsListenerSeparation.sourceGuard.test.ts`,
  `apps/management-api/src/lib/database/tablePolicy.ts`, and the management-api and
  management-web route and page patterns for a small admin list with one action.
- **Scope:** which signals are recorded and where, the thresholds that flag a listener, the
  flag and exclusion store keyed by `listener_id` and its migration, auto-exclusion at flag time,
  and how an admin sees and clears an exclusion without reading the account-to-listener mapping.
  The exclusion covers a flagged listener's opens as well as its listens; whether open-cap hits
  feed flagging is for this area to propose. How exclusion changes popularity counts belongs to
  area D.
- **Depends on:** area A (same write-path files; the too-soon and cap results it builds on).
- **Shares files with:** area A (`statsListenWrite.ts`, `popularityListen.ts`, `statsListen.ts`,
  API env files), area D (the exclusion store it reads), all areas (shared files above).

### Area D — Popularity range counting (wave 3, plans 40–49)

- **Rows:** R12, R13, R14, R15, R16
- **Starts from:** `packages/orm/src/services/stats/statsPopularityRefresh.ts`
  (`refreshStatsPopularity`, recent and full SQL), `statsEntityTables.ts`, `statsEventPartitions.ts`,
  `statsOpenWrite.ts`, the workers stats commands and config (`STATS_TRACK_EVENT_RETENTION_DAYS`),
  `packages/orm/src/services/channel/applyChannelMerge.ts` with doc § Channel Merge, and the
  `stats_listen_event` and `stats_open_event` indexes in `0025_popularity_tracking_foundation.sql`.
- **Scope:** day, week, and month counts as distinct listeners (and distinct openers for
  profiles and playlists) from events; all-time once per listener per entity per N days with its
  env setting capped at event retention, for listens and opens alike; leaving out area A's
  over-cap listens and area C's excluded listeners from both; correct counts after a channel
  merge; query cost on the event tables.
- **Depends on:** area A (how a popularity-counted listen is marked), area C (the exclusion
  store).
- **Shares files with:** area A (`statsListenWrite.ts` daily-row writes, if all-time moves
  there), area C (exclusion store), workers env files, all areas (shared files above).

## Shared files

Every area may touch these; Close serializes their plans:

- `docs/features/POPULARITY-AND-TASTE-PROFILE.md` — the contract; each plan updates its own sections.
- New linear migrations under `infra/k8s/base/ops/source/database/linear-migrations/app/`, the
  generated `0004_app_linear_baseline.sql.gz`, and the readiness marker. Each area that needs SQL
  writes its own migration; Close assigns the numbers in phase order.
- `apps/api` env files (`config/index.ts`, `lib/startup/validation.ts`, `ENV.md`, `.env.example`),
  `infra/k8s/base/api/source/api.env`, `dev/env-overrides/local/rate-limit.env.example`, and
  `scripts/local-env/setup.sh`.
- `release-notes/scratchpad.md`.

## Order

Wave 1: area A. Wave 2: area C, after A. Wave 3: area D, after A and C. The first pass had no
area B; its row (R17) moved into area A once the too-soon answer became a 2xx.

**Second pass, after the first review.** Area B now holds the Taste Profile rename (R30–R40,
plan 20, block 20–29). Its planning step (06) runs first and alone. Area A (step 07: R20, R24,
R25, new plan 14, and plan 20's names in plans 10–13) runs next. Areas C and D (steps 08 and 09)
then run at once, each editing only its own plans. In the implementation set, plan 20 runs
alone, ahead of every other plan, so the others are written against its new names.

## Decisions to review

Planner choices the request and answers did not settle. Numbered D1, D2, … so the operator can
answer each by number.

### Step 02 — area A, listen and open write limits

- **D1** (plan 10) Too-soon result name is `too_soon`. Alternative: a literal `not_counted`.
- **D2** (plan 10) The 20-second floor counts every stored listen, including ones over the popularity cap. Alternative: count only popularity-counted listens.
- **D3** (plan 10) `STATS_LISTEN_MIN_INTERVAL_SECONDS=0` turns the floor off (tests, local dev). Alternative: minimum of 1.
- **D4** (plan 10) A session whose first report was too soon is not refused for good: a later report of the same `client_listen_id` can store it once 20 seconds have passed. Alternative: remember too-soon session ids and refuse them (needs new storage).
- **D5** (plan 11) `STATS_LISTEN_DAILY_CAP` keeps its key and default 300 as the stored cap; `STATS_LISTEN_DAILY_POPULARITY_CAP` (100) is added. Alternative: rename both keys.
- **D6** (plan 11) A listen past the popularity cap still answers `counted`, so the API never reveals popularity status (this also hides area C's exclusions). Alternative: a new `counted_taste_only` result.
- **D7** (plan 11) Over-cap listens are marked by a `popularity_counted` column on `stats_listen_event`; they and their completions add nothing to daily rows. Alternative: a separate table.
- **D8** (plan 12) Own-content opens and repeat opens of the same profile or playlist that day do not use up the 10-open cap.
- **D9** (plan 13) No agreement or terms version bump; legal copy is edited in place because the limits record less. Alternative: bump, which pauses tracking for every account until it accepts again.

### Step 04 — area C, botted-listener flagging and admin clear

- **D10** (plan 30) Too-soon signal: count distinct UTC minutes in a day that had a too-soon answer; flag at 30 (`STATS_FLAG_TOO_SOON_MINUTES`, `0` turns it off). Alternative: count raw too-soon answers, which would flag a legitimate offline outbox drain.
- **D11** (plan 30) Reaching the stored daily cap (300) flags the listener at once. Alternative: wait for repeat days.
- **D12** (plan 30) Hitting the popularity cap (100) is not a signal, since heavy real listeners reach it.
- **D13** (plan 30) Hitting the open daily cap (10) is not a signal (R19). Alternative: flag after some number of open-cap rejections in a day.
- **D14** (plan 30) Exclusion happens at write time (`popularity_counted = false`, no daily rows) and at read time (area D skips uncleared flags). Alternative: read time only, writing daily rows as before.
- **D15** (plan 30) Flagged opens are still stored, via a new `stats_open_event.popularity_counted` column. Alternative: store nothing for flagged opens.
- **D16** (plan 30) A clear does not rewrite events: pre-flag listens count again, listens stored while flagged stay out. Alternative: restore everything.
- **D17** (plans 30, 31) A clear holds for the rest of its UTC day; a signal on a later day flags again. Alternatives: permanent exemption, or deleting the flag row.
- **D18** (plan 30) The listener is never told, and flags are not in the account data export. Alternative: include the flag in the export.
- **D19** (plans 31, 32) The admin page shows the pseudonymous listener id and 7-day listen and open counts, never the account; flag tables stay out of the database browser; view uses stats read, clear uses stats update, no new permission. Alternative: list the tables in the database browser.
- **D20** (plan 33) Add general "automated-looking listening can be left out" sentences with no version bump. Alternatives: a bump, or no copy change.

### Step 05 — area D, popularity range counting

- **D21** (plan 40) All-time uses fixed N-day periods starting at the listener's last all-time-counted listen, with a marker on each event row. Alternative: count whenever the gap since any earlier listen exceeds N, which would never recount a regular listener.
- **D22** (plan 40) No event backfill: existing events get no marker, so each listener may be counted once extra per entity during the first N days after deploy. Alternative: replay the rule in the migration.
- **D23** (plan 40) `all_time_listener_count` starts equal to `listener_count`, so existing all-time totals do not change.
- **D24** (plan 40) On channel merge, old and survivor all-time counts are added and capped at the merged `listener_count`, with no overlap read. Alternative: an overlap read like the listener-count one.
- **D25** (plan 41) An uncleared flag removes all of a listener's events from day, week, and month; a clear brings pre-flag ones back. All-time keeps what the listener added before the flag. Alternative: subtract from all-time and seal it when the partition drops (much more complex).
- **D26** (plan 41) A merge moves every old-channel event to the survivor, so the survivor's windows include listeners of unmatched items. Alternative: leave unmatched items' events on the old channel.
- **D27** (plan 41) After a merge revert, events stay on the survivor; the old channel's windows restart from new listens, its all-time comes back from the restored daily rows.
- **D28** (plan 42) Opt-out and account deletion now remove the listener from day, week, and month counts; legal copy updated with no version bump. Alternative: a bump.
- **D29** (plan 41) Workers reject `STATS_TRACK_EVENT_RETENTION_DAYS` below 31, because the month window reads events.
- **D30** (plan 41) The dev seed writes simulated window counts directly instead of creating fake events.
- **D31** (plan 40) The API clamps N to its own `STATS_TRACK_EVENT_RETENTION_DAYS`; docs tell operators to keep it equal to the workers' value.

### Consistency note for the review

- **D32** (plans 33, 41) Step 05 notes that plan 33's sentence says a flagged id's listens and opens are left out "until the mark is removed", which is broader than D16 and D25: listens stored while flagged stay out after a clear. Tighten plan 33's wording to match, or change D16 so a clear restores everything.

### Second pass — reviewed by the operator

Steps 06–09 made these choices; the operator reviewed each one after Close. All are kept as
planned except D51.

- **D38** (plan 14) Opt-out keeps the `stats_listener` row and deletes every listening row. Kept.
- **D39** (plan 14) That UTC day's stored count and first listen time carry across an opt-out on the kept row. Kept.
- **D40** (plan 14) Only a No that follows a Yes sets the opt-out time and starts the cooldown. Kept.
- **D41** (plan 14) Opens during the cooldown store nothing and answer `counted`. Kept.
- **D42** (plan 14) `listen_stats_opted_out_at` appears in `GET /auth/me` account settings and the data export. Kept.
- **D43** (plan 42) The cooldown sentence also says turning Taste Profile off and on does not reset the daily limits. Kept.
- **D44** (plan 30) Unknown duration counts toward the too-soon run; only a known duration under 60 seconds is exempt. Kept.
- **D45** (plan 30) The stored-cap signal is checked when the listen that reaches the cap is stored. Kept.
- **D46** (plan 30) The too-soon run resets only on the 2-minute gap, not at UTC midnight. Kept.
- **D47** (plans 30, 31) An admin clear leaves the too-soon run as it is. Kept.
- **D48** (plan 20) "Agreement" names the document and its version; "consent" names the decision and its UI. Kept.
- **D49** (plan 20) `config.tasteProfileAgreement { version, contentDir }`; caps stay in `config.popularityTracking`. Kept.
- **D50** (plan 20) Error code `taste_profile_consent_required`; export key `listening_data`. Kept.
- **D51** (plan 20) **Changed:** the feature doc moves to `docs/features/POPULARITY-AND-TASTE-PROFILE.md` with H1 "Popularity and Taste Profile". Plan 20 updates the listener-id separation rule and the sixteen source comments that cite it. Migration 0025's comment keeps the old path, because applied migrations are not edited. Plans 10–14, 30, 31, 40, 41 and the set files cite the new path.
- **D52** (plan 20) i18n keys that no code reads are removed. Kept.
- **D53** (plan 20) Web Settings: one section with two stacked sibling regions, no divider. Kept.
- **D54** (plan 20) The mobile screen drops its in-list "Taste Profile" heading. Kept.
