# Popularity Tracking rebuild — summary

Source request: [00-REQUEST.md](00-REQUEST.md). Models per prompt: see `COPY-PASTA.md` once Close
writes it.

The set builds the data foundation the request scopes in: a permanent listener id behind a
separate mapping table, monthly-partitioned listen events kept 90 days, anonymous daily totals
that replace the rolling aggregate columns, per-show taste profiles with two decaying scores, a
Hidden From Taste Profile list, opt-out deletion with a warning, the Taste Profile settings UI on
web and mobile, scheduled jobs, and updated explanation and terms text. The "also listened" job
and recommendation surfaces are later work.

## Requirement ledger

One item per distinct ask. Area letters are defined under `## Areas`. Close fills each Plan from
the plans' `## Rows`.

### First message

- **R1** (area A) "How would you rate our analytics tracking for listener habits for popularity purposes on Podverse infrastructure?" — Plan: 10
- **R2** (area A) "Down the road, we want to be able to use this data to help customize algorithms and let users know what they are most likely to like if they like something." — Plan: 10
- **R3** (area C) "only paid premium members can have analytics tracked" — Plan: 32
- **R4** (area G) "it's optional for them to do so" — Plan: 70
- **R5** (area C) "to help maintain at least some integrity to prevent bots from being able to game the system for cheap or for free" — Plan: 31, 32
- **R6** (area A) "if we should improve our way of tracking to be more robust and long term than it is currently" — Plan: 10
- **R7** (area A) "I am wondering if there is a better practice we should be investigating to. Have a more future-forward and more powerful way of using these analytics in the future." — Plan: 10
- **R8** (area A) "it is important that we have these anonymized IDs as we don't want to make it easy to see who is listening to what through this tracking method" — Plan: 10
- **R9** (area A) "but it can be tracked back to the user. So it's not ultimate privacy, but it is a layer of privacy. We need to maintain that." — Plan: 10
- **R10** (area A) "Do you think this system, as we have it designed, will be good enough for that approach?" — Plan: 10
- **R11** (area A) "We are also concerned about accumulating rows forever that could get costly." — Plan: 10
- **R12** (area A) "But it seems like that data will be useful potentially down the line. For purposes of designing algorithms for the user." — Plan: 10
- **R13** (area C) "we want algorithms that are not just designed around what they have listened to all time, but also what they have listened to in recent times" — Plan: 31
- **R14** (area A) "Will our current system be able to support these use cases?" — Plan: 10
- **R15** (area A) "What would you propose for a better system?" — Plan: 10
- **R16** (area A) "should we go ahead with this migration before we ship this product from our OGen to next gen Podverse?" — Plan: 10
- **R17** (process) "Ask if you have any questions." / "Actively ask questions if you are unsure about any functionality and what we will ultimately want." — Plan: n/a (process instruction; every planning step reports BLOCKED with the question instead of guessing)

### Second message

- **R18** (area I) "it should warn the user that this data will be removed in their history; if they enable it later, their recommendations will have to begin from scratch" — Plan: 91, 92, 94
- **R19** (area G) "Should turning tracking off delete the taste profile right away?" … "I would say yes" — Plan: 70

### Design accepted as the starting point

- **R20** (area A) "Listen events. One row per counted listen, carrying the item, its channel, and the clip when there is one, instead of separate per-entity event tables." — Plan: 10, 11
- **R21** (area A) "Store seconds heard and whether it finished." — Plan: 10, 11
- **R22** (area A) "Partition by month (Postgres partitions)" — Plan: 10
- **R23** (area D) "so retention drops a whole month instead of deleting rows" — Plan: 41
- **R24** (area A) "Taste profile. Per listener id and channel: listen count, completion count, first and last listen time, and two decaying scores." — Plan: 10, 11
- **R25** (area C) "`score = score × 0.5^(days since last update / half-life) + weight`. A short half-life (about 14 days) answers 'what they like right now'; a long one (about 180 days) answers 'long-term taste'." — Plan: 30, 31
- **R26** (area A) "Daily totals. One row per entity per day (listeners, completions), replacing the 17 rolling count columns." — Plan: 10, 11, 60, 61
- **R27** (area E) "Any window is a sum, so nothing goes stale. Existing range sorts (day, week, month, all time) read from it." — Plan: 50, 51, 60, 61
- **R28** (area A) "Listener id. Permanent, no rotation." — Plan: 10, 11
- **R29** (area A) "The account-to-listener-id mapping is the privacy layer: chart and recommendation code never reads it." — Plan: 10, 11, 12
- **R30** (area A) "Later, not in this set. A nightly job turning taste profiles into show-to-show 'also listened' scores … and 'Listeners Also Like' / 'For You' surfaces built on them." — Plan: 10 records it as later work; deferred (see § Deferred), and prompt 19 writes the deferred summary when it closes the set

### Operator answers

- **R31** (area D) "Schedule the jobs" — Plan: 41, 42
- **R32** (area B) "updated explanation and terms text" — Plan: 20, 21
- **R33** (area C) "What counts as a listen: whichever comes first, 60 seconds heard or 25% of the item." (the shared rule and the server's check) — Plan: 30, 31, 32
- **R34** (area H) "What counts as a listen: whichever comes first, 60 seconds heard or 25% of the item." (web and mobile send a listen only once the rule is met) — Plan: 80, 81, 82, 83
- **R35** (area I) "Turning tracking off: asks first, with a warning that their listening data is removed and that recommendations would start from scratch if they turn it on later." — Plan: 92, 94
- **R36** (area G) "On confirm, delete right away the taste profile, the Hidden From Taste Profile list, and that listener's raw listen events." — Plan: 70
- **R37** (area G) "Anonymous totals already counted stay." — Plan: 70
- **R38** (area G) "Tracking stopping without the listener choosing it (membership lapses, or a new explanation version is waiting to be confirmed): keep the taste profile paused." — Plan: 70
- **R39** (area C) "It resumes when tracking turns back on." — Plan: 31
- **R40** (area D) "Raw listen event retention: 90 days, as a server setting." — Plan: 40, 41
- **R41** (area A) "Taste profile granularity: shows only (podcasts, albums, artists). Episodes and tracks are not profile rows." — Plan: 10, 11
- **R42** (area C) "Web profile and playlist opens: keep recording them for popularity counts only." — Plan: 31, 32
- **R43** (area C) "They never feed taste profiles." — Plan: 31
- **R44** (area H) "Mobile does not add them." — Plan: 82, 83
- **R45** (area C) "a per-account rate limit on the tracking endpoints" — Plan: 32
- **R46** (area C) "a daily cap on counted listens" — Plan: 31, 32
- **R47** (area C) "both server settings. The planner picks the defaults." — Plan: 32
- **R48** (area A) "Existing data: drop the current stats tables and their data." — Plan: 19, 43
- **R49** (area B) "Alpha testers' opt-ins reset when the explanation version changes." — Plan: 20
- **R50** (area A) "Import nothing from v4." — Plan: 10
- **R51** (area A) "Listener-id separation: a separate mapping table." — Plan: 10, 11
- **R52** (area A) "Chart and recommendation jobs never read it, enforced in code and by a test." — Plan: 12
- **R53** (area A) "No new database role or credentials." — Plan: 10
- **R54** (area G) "Yes, that list with per show removal" (the server side: list, hide, and unhide endpoints for the listener's own taste profile) — Plan: 71
- **R55** (area I) "Yes, that list with per show removal" (the list and its per-show remove control on web and mobile) — Plan: 91, 93, 95
- **R56** (area I) "if the user removes it, it should go into a separate section" — Plan: 91, 93, 95
- **R57** (area C) "if they were to listen to that content in the future, it would not be automatically added back to their taste profile" — Plan: 31
- **R58** (area I) "they will need the ability to see what is in their hidden from taste profile so that they can remove something they actually want in their taste profile in the future" — Plan: 91, 93, 95
- **R59** (area I) "When they press the remove from removed from taste profile feature, it should ask them, do you want to add it to your taste profile or do you just want to remove it from the blocked list? Or something to that effect." — Plan: 93, 95
- **R60** (area G) "Hiding a show deletes its taste data. Its scores and counts are removed." — Plan: 71
- **R61** (area G) "'Add back' starts the show fresh, and later listens build it up again." — Plan: 71
- **R62** (area C) "Listens to a hidden show still count toward public popularity totals. Hiding affects only the taste profile." — Plan: 31
- **R63** (area I) "Where the taste profile list appears: web Settings and mobile Popularity Tracking settings, matching on both." — Plan: 93, 95
- **R64** (area I) "UI names: 'Taste Profile', with a 'Hidden From Taste Profile' section." — Plan: 90, 93, 95

### Review of the first planning pass

- **R65** (all areas; planning steps 11, 12, 13, 14) "nothing is deployed to production; alpha and all devices can be wiped, so plan no compatibility paths or data migrations anywhere." — Plan: 10, 31, 32, 51, 82 (step 14 swept every other plan and found nothing to change in its `## Rows`)
- **R66** (area E; planning step 13) "during a channel merge, remove duplicate listeners using stats_listen_event for every day still inside retention (count listeners with events on both copies on the same UTC day, per channel pair and per matched item pair, and subtract that overlap from the summed daily row)" — Plan: 51
- **R67** (area E; planning step 13) "only days already past retention are summed without a check" — Plan: 51
- **R68** (area E; planning step 13) "Keep the journal so revert restores exact pre-merge rows." — Plan: 51
- **R69** (areas A and C; planning step 11) "use server receive time for both daily totals and taste score decay" — Plan: 10, 31, 32
- **R70** (areas A, C, and G; planning step 11) "remove listened_at from the listen request contract, the services" — Plan: 10, 11, 31, 32, 72
- **R71** (area H; planning step 12) "and the web and mobile senders" — Plan: 81, 82, 83

## Areas

Each area lists its rows, where its research starts, the areas it depends on, the files it shares
with other areas, and its plan number block.

### Area A — Data foundation (schema, ORM, DTOs, listener id)

- **Rows:** R1, R2, R6, R7, R8, R9, R10, R11, R12, R14, R15, R16, R20, R21, R22, R24, R26, R28, R29, R30, R41, R48, R50, R51, R52, R53
- **Starts from:** `infra/k8s/base/ops/source/database/linear-migrations/app/0001_app_schema.sql` (`CREATE TABLE public.stats_`), the newest app migration (`0020_add_by_rss_feed_identity.sql` at split time), `packages/orm/src/entities/stats/`, `packages/orm/src/services/stats/`, `packages/orm/src/db/entities.ts`, `packages/helpers/src/dtos/stats/`, `packages/orm/src/services/stats/baseStatsTrackEvent.sourceGuard.test.ts` (existing source-guard test pattern).
- **Depends on:** none.
- **Shares:** `packages/orm/src/index.ts`, `packages/orm/src/db/entities.ts`, `packages/helpers/src/index.ts`, `packages/helpers/src/dtos/index.ts` (C and G add exports); the linear baseline gz files and readiness marker (A only).
- **Plan block:** 10–19.
- **Notes for the area step:**
  - A owns every new table, including the Hidden From Taste Profile list, so no other area writes a migration. Other areas build on the table and service names A's plans fix.
  - A decides how daily totals are filled (upsert at listen time, or a job rolling up from listen events) and states it as a contract C and D follow. Distinct-listener counts per day are the hard part of that choice.
  - Old tables are dropped (R48), but readers in areas C, D, E, F still reference the old entities. Put the removal of the old entities, services, and DTOs in its own plan; Close sets its Runs after to the C, D, E, F plans that move those callers.
  - The question rows (R1, R6, R7, R10, R12, R14, R15, R16) are answered by the accepted design; record the answer in a short section of the foundation plan. R30 is out of scope; note it so Close writes the deferred summary.

### Area B — Explanation and terms copy

- **Rows:** R32, R49
- **Starts from:** `apps/api/legal/popularity-tracking/{en-US,es,fr,el-GR}.md`, `apps/api/legal/terms/en-US.md` § Popularity Tracking, `apps/api/src/lib/legal/popularityTrackingContent.ts`, `POPULARITY_TRACKING_AGREEMENT_VERSION` in `apps/api/src/config/index.ts`, `.llm/plans/completed/popularity-tracking-how-it-works/`.
- **Depends on:** none. The copy describes the design fixed in `00-REQUEST.md` (three stores, 90-day retention, taste profile until opt-out, hiding, deletion on opt-out, pausing on involuntary stop); it uses the existing `{retention_days}` placeholder rather than any value another area picks.
- **Shares:** `apps/api/src/config/index.ts` and `apps/api/src/lib/startup/validation.ts` (C adds rate-limit and cap settings), `infra/k8s/base/api/source/api.env` (C and D).
- **Plan block:** 20–29.
- **Notes for the area step:** copy never calls the listener id anonymous or anonymized. `misc/aicasts/listener-privacy-1-popularity-tracking.md` describes today's behavior; it is not in scope, so note it as stale for a later abcaicast.

### Area C — Listen write path (API)

- **Rows:** R3, R5, R13, R25, R33, R39, R42, R43, R45, R46, R47, R57, R62
- **Starts from:** `apps/api/src/routes/stats.ts`, `apps/api/src/controllers/stats/`, `apps/api/src/lib/legal/listenStats.ts`, `apps/api/src/lib/rateLimiter.ts`, `packages/helpers/src/lib/accountTrust.ts` (`trackStats`), `packages/helpers-requests/src/api/stats/stats.ts`, `apps/api/src/test/stats.track.test.ts`.
- **Depends on:** A (tables, services, and the daily-totals contract).
- **Shares:** `apps/api/openapi.yml` (G), `apps/api/src/config/index.ts` and `apps/api/src/lib/startup/validation.ts` (B), `infra/k8s/base/api/source/api.env` (B, D), `packages/helpers-requests/src/api/stats/stats.ts` (H consumes; C owns), `apps/api/src/lib/legal/listenStats.ts` (G), `packages/helpers/src/index.ts`.
- **Plan block:** 30–39.
- **Notes for the area step:**
  - C owns the shared counted-listen rule (60 seconds or 25%, whichever first) as a helper H's clients call, and the server's check of it. Fix the request contract (fields such as seconds heard, finished, and whether a client listen time is accepted for offline replays) so H can build on it.
  - Profile and playlist opens (R42, R43) stay popularity-only. C does not edit web files; if the request function changes, H updates the web call sites.

### Area D — Jobs, partitions, and retention

- **Rows:** R23, R31, R40
- **Starts from:** `apps/workers/src/commands/stats/` (`statsUpdateAggregated.ts`, `statsUpdateAggregatedRolling.ts`, `devStatsSeedSimulatedAggregated.ts`), `packages/helpers/src/lib/simulatedAggregatedStats.ts`, `packages/worker-commands/src/registry.ts`, `infra/k8s/base/cron/worker-account-content-log-purge.cronjob.yaml` (pattern), `infra/k8s/base/cron/kustomization.yaml`, `STATS_TRACK_EVENT_RETENTION_DAYS` (30 today in `api.env`, `workers.env`, and `web-sidecar.env`).
- **Depends on:** A (partitioned table and the daily-totals contract).
- **Shares:** `packages/worker-commands/src/registry.ts`, `infra/k8s/base/api/source/api.env` and `infra/k8s/base/web/source/web-sidecar.env` (D changes the retention value; B and C edit other keys), `apps/workers/src/config/index.ts`.
- **Plan block:** 40–49.
- **Notes for the area step:** jobs never read the listener-id mapping (R52, test in A). Dev seeding moves to the new tables. The alpha GitOps repo (`../k.podcastdj.com/apps/podverse-alpha`) has no stats schedule; say whether it needs one or inherits base.

### Area E — Public popularity readers and channel merge

- **Rows:** R27
- **Starts from:** `apps/api/src/lib/stats.ts` (`getStatsOrder`), `packages/helpers/src/lib/statsAggregatedCountField.ts`, `packages/orm/src/services/item/item.ts` (large file), `apps/api/src/controllers/{item,channel,clip}.ts`, `apps/api/src/controllers/playlist/playlist.ts`, `apps/api/src/controllers/account/account.ts`, `packages/orm/src/services/channel/applyChannelMerge.ts`, `channelMergeRowJournal.ts`.
- **Depends on:** A.
- **Shares:** `packages/helpers/src/lib/statsAggregatedCountField.ts` and `packages/helpers-requests/src/api/queryParams.ts` (F may read), `apps/api/openapi.yml` if range params change (C, G).
- **Plan block:** 50–59.
- **Notes for the area step:** range sorts over every entity type must stay fast when they sum daily rows; say how (indexes, a bounded window, or a stored all-time total). Channel merge must move daily totals, listen events, and taste profile rows to the survivor, merging two taste rows for the same listener.

### Area F — Management stats

- **Rows:** none of its own; it carries the management side of R26 and R27 (listed under A and E).
- **Starts from:** `apps/management-api/src/routes/stats.ts`, `apps/management-api/src/lib/database/tablePolicy.ts`, `apps/management-api/src/routes/database.integration.test.ts`, `apps/management-api/openapi.yml`, `packages/management-api-requests/src/stats.ts`, `apps/management-web/src/app/(management)/stats/StatsPageClient.tsx`, `apps/management-web/e2e/stats-page.spec.ts`.
- **Depends on:** A.
- **Shares:** none with other areas beyond helper exports.
- **Plan block:** 60–69.
- **Notes for the area step:** list R26 and R27 in `## Rows` of the plans that move management reads. The management table policy decides whether the listener-id mapping and taste tables are visible in the database browser; R29 and R52 say chart code never reads the mapping.

### Area G — Consent lifecycle and taste profile API

- **Rows:** R4, R19, R36, R37, R38, R54, R60, R61
- **Starts from:** `packages/orm/src/services/account/accountSettings/accountSettingsListenStats.ts`, `packages/helpers/src/lib/popularityTracking.ts`, `apps/api/src/lib/legal/listenStats.ts`, the account settings routes and controllers in `apps/api/src/`, `packages/helpers/src/dtos/account/accountDataExport.ts`.
- **Depends on:** A.
- **Shares:** `apps/api/openapi.yml` (C), `apps/api/src/lib/legal/listenStats.ts` (C), `packages/helpers-requests/` (I consumes the taste profile requests G adds), `packages/helpers/src/index.ts`.
- **Plan block:** 70–79.
- **Notes for the area step:** fix the endpoint contract I builds on: list the profile, hide a show, and the two unhide choices (add back fresh versus only leave the hidden list). Say whether account data export includes the taste profile and hidden list.

### Area H — Client listen sending (web player, mobile playback)

- **Rows:** R34, R44
- **Starts from:** `apps/web/src/utils/statsTracking/statsTracking.ts`, `apps/web/src/components/MediaPlayer/Controller/NonLiveMediaOrchestrator.tsx` and `MEDIA-PLAYER-DECISION-MATRIX.md`, `apps/web/src/components/StatsTracking/StatsPageViewTrackers.tsx`, `apps/web/src/app/profile/[id_text]/ProfilePageClient.tsx`, `packages/playback-core/src/resolvePlaybackLoadDecision.ts` (`shouldRecordPlaybackStat`), `apps/mobile/src/playback/PlaybackProvider.tsx`, `apps/mobile/src/data/repositories/statsRepository.ts`, `apps/mobile/src/data/repositories/playbackOutboxRepository.ts`, `apps/mobile/src/popularityTracking/popularityTrackingGate.ts`.
- **Depends on:** C (counted-listen helper and request contract).
- **Shares:** `apps/web/src/contexts/Account.tsx` (I may edit), `packages/helpers-requests/src/api/stats/stats.ts` (C owns).
- **Plan block:** 80–89.

### Area I — Taste Profile settings UI and opt-out warning (web, mobile)

- **Rows:** R18, R35, R55, R56, R58, R59, R63, R64
- **Starts from:** `apps/web/src/components/Settings/Panels/SettingsAccount/SettingsListenStats.tsx`, `apps/web/src/lib/popularityTrackingStatus.ts`, `apps/web/e2e/popularity-tracking-consent.spec.ts`, `apps/mobile/src/screens/more/MoreSettingsPopularityTrackingScreen.tsx`, `syncAllowListenStatsToAccountSettings` in `apps/mobile/src/auth/syncAccountPrefs.ts`, `apps/mobile/e2e/popularity-tracking.yaml`, the shared i18n catalogs.
- **Depends on:** G (taste profile endpoints and opt-out contract).
- **Shares:** i18n catalogs, `apps/web/src/contexts/Account.tsx` (H).
- **Plan block:** 90–99.
- **Notes for the area step:** web and mobile match; the parity source is the web Settings panel unless the plan records a reason.

## Order

Waves, from the dependencies above. An area waits only when its plan builds on another area's plan.

| Wave | Step | Area | Rows | Depends on |
| --- | --- | --- | --- | --- |
| 1 | 02 | A — Data foundation | R1, R2, R6–R12, R14–R16, R20–R22, R24, R26, R28–R30, R41, R48, R50–R53 | none |
| 1 | 03 | B — Explanation and terms copy | R32, R49 | none |
| 2 | 04 | C — Listen write path | R3, R5, R13, R25, R33, R39, R42, R43, R45–R47, R57, R62 | 02 |
| 2 | 05 | D — Jobs, partitions, retention | R23, R31, R40 | 02 |
| 2 | 06 | E — Public readers and channel merge | R27 | 02 |
| 2 | 07 | F — Management stats | (R26, R27 management side) | 02 |
| 2 | 08 | G — Consent lifecycle and taste profile API | R4, R19, R36–R38, R54, R60, R61 | 02 |
| 3 | 09 | H — Client listen sending | R34, R44 | 04 |
| 3 | 10 | I — Taste Profile UI and opt-out warning | R18, R35, R55, R56, R58, R59, R63, R64 | 08 |

R17 is a process instruction and maps to no plan.

These waves ordered the planning. The implementation run's twelve phases are in
[00-EXECUTION-ORDER.md](00-EXECUTION-ORDER.md).

**Second pass after the first review.** The operator's answers are in `00-REQUEST.md` § Review of the first planning pass. Four planning steps under one heading revise existing plans, each owning separate plan files: step 11 removes `listened_at` and uses server receive time on the server side (plans 10, 11, 31, 32, 72; R65, R69, R70); step 12 removes it from the web and mobile senders (plans 81, 82, 83; R65, R71); step 13 adds same-day overlap removal to the channel merge (plan 51; R65–R68); step 14 removes compatibility paths and data migrations from every other plan (R65). No new plan numbers are expected.

## Decisions to review

Collected from the `## Decisions` list of each area step's final message. Each item names its step, area, and plans, then the choice made and the main alternative. Answer by D number; an item with no answer stands.

Reviewed in the first pass (`00-REQUEST.md` § Review of the first planning pass): D3 and D17 changed (R69–R71), D26 changed (R66–R68), every other item accepted, and R65 applies to every plan.

### Step 02 — Area A, data foundation

- **D1** (step 02, plan 10) Daily totals are filled at write time by area C, under a per-listener advisory lock with first-of-day checks. Alternative: a job that rebuilds days from raw events, rejected because re-running a day after an opt-out deleted raw events would lower totals, breaking "anonymous totals already counted stay."
- **D2** (step 02, plans 10, 11) A derived `stats_popularity_*` table per type, rebuilt by area D's job, backs the range sorts. Each window total sums the daily rows, so a listener counts once per day they listen. Alternatives: sum daily rows at query time (slow for month and all-time), or count distinct listeners per window from raw events (those counts drop on opt-out).
- **D3** (changed: R69, R70) (step 02, plan 10) The day is the UTC date of server receive time, so an offline replay counts on the day it arrives. Alternative: the device's listen time.
- **D4** (step 02, plan 11) Window lengths are day 1, week 7, month 30, where a window of N covers today plus the N previous UTC dates. Alternative: calendar windows, which leave "today" nearly empty just after midnight UTC.
- **D5** (step 02, plan 10; G implements) Confirmed opt-out deletes the `stats_listener` row; cascades remove events, opens, taste rows, and hidden rows. Turning tracking back on creates a new listener id. Alternative: keep the id and delete each data set separately.
- **D6** (step 02, plan 10) Profile and playlist opens get their own partitioned `stats_open_event` table with the same retention, so each opener counts once per day. Alternative: no raw opens, counting distinct openers some other way.
- **D7** (step 02, plan 10) The read-only database role cannot select the listener-id mapping. Alternative: grant it like every other table.
- **D8** (step 02, plan 10; C implements) Artists get taste rows: a music listen also updates the artist channel when the album's publisher remote item's `feed_guid` matches a channel's `podcast_guid`. Alternative: album rows only, leaving artists out despite R41.

### Step 03 — Area B, explanation and terms copy

- **D9** (step 03, plans 20, 21) The explanation version becomes `2026-10-21`; the terms version stays `2026-10-15`. Alternative: bump the terms version too, which blocks the app until every account accepts the terms again.
- **D10** (step 03, plans 20, 21) The copy says Popularity Tracking is available with a Premium membership. Alternative: leave membership out, as today's text does, because a deployment can turn tracking on for Trial and a per-account override exists.
- **D11** (step 03, plans 20, 21) The copy says there is a daily limit on counted listens without giving the number. Alternative: omit the limit until area C picks the number.
- **D12** (step 03, plans 20, 21) Listen records are described as deleted a month at a time after `{retention_days}`, so a record can remain until its month is removed. Alternative: keep "deleted after `{retention_days}` days" with no mention of months.
- **D13** (step 03, plans 20, 21) The 14-day and 180-day half-lives are not in the copy; it says "lately" and "over a longer time". Alternative: state those approximate half-lives.

### Step 04 — Area C, listen write path

- **D14** (step 04, plan 32) Two new routes replace the five old ones, which are removed. Installed mobile builds stop recording stats; they get a 404, which they ignore. Alternative: keep the old paths working alongside the new ones.
- **D15** (step 04, plans 31, 32) One report per listening session, keyed by a required device-made `client_listen_id`. Later reports raise seconds heard and set finished; finished never turns back off, and a session is never counted twice. A session older than 7 days counts as a new listen. Alternative: a single report with no updates, which would never record finishing.
- **D16** (step 04, plan 30) Taste weights and half-lives are fixed in code: 1 per counted listen, plus 1 when it finishes, half-lives of 14 and 180 days. Alternatives: not weighting finishes, or making these server settings.
- **D17** (changed: R69) (step 04, plan 31) Taste scores decay from the device's listen time, capped at 30 days old, while daily totals use server receive time, so late offline listens do not inflate "what they like now". Alternative: server receive time for both.
- **D18** (step 04, plan 32) Default limits are 60 requests a minute and 300 stored listens a day. The request let the planner pick these.
- **D19** (step 04, plan 32) Hitting the daily cap answers 200 with `daily_cap_reached`, not 429, so devices do not retry a listen that will never be stored. Alternative: 429.
- **D20** (step 04, plan 31) Opening your own profile or playlist is ignored, and repeat opens on the same day store nothing. Alternative: count every open.

### Step 05 — Area D, jobs, partitions, retention

- **D21** (step 05, plan 41) Retention drops whole months only. A month goes once every row in it is older than the setting, so with 90 days a row stays between 90 and about 122 days. Alternatives: delete rows inside the oldest month to hold exactly 90 days, or drop a month as soon as its oldest rows pass 90, removing some rows early. Plan 20's copy matches whole-month behavior (D12).
- **D22** (step 05, plan 42) Range totals refresh hourly, plus a nightly full pass. The hourly pass recalculates all-time totals only for entities with daily rows today or yesterday; the nightly pass catches outages longer than a day and channel merges. Alternatives: one nightly run (the "day" sort up to a day stale), or summing every daily row every hour.
- **D23** (step 05, plan 40) The env name `STATS_TRACK_EVENT_RETENTION_DAYS` stays. Alternative: rename it, touching the API, workers, web sidecar, local env scripts, and alpha GitOps for no behavior change.

### Step 06 — Area E, public readers and channel merge

- **D24** (step 06, plan 51) Listen events, taste rows, and hidden rows move on a channel merge without a journal; a reverted merge leaves them on the survivor and restores only the anonymous totals. Alternative: journal them so a revert puts everything back, rejected because the journal is kept forever (holding history past retention and past opt-out) and a revert would fail after a listener opted out.
- **D25** (step 06, plan 51) A hidden show stays hidden after a merge: if a listener hid either copy, the survivor is hidden for them and both taste rows are deleted. Alternative: keep only the survivor's hidden state.
- **D26** (changed: R66, R67, R68) (step 06, plan 51) Daily rows are added together on merge, so a listener who listened to both copies on the same day counts twice. Alternative: remove that overlap using raw events, which only works within retention and would break "totals never go down".
- **D27** (step 06, plan 51) The merge uses row locks, not the per-listener advisory lock, because one merge can cover thousands of listeners. Alternative: take the per-listener locks.
- **D28** (step 06, plan 50) Top lists for clips, playlists, and profiles keep listing every row, including zero counts, without padding, matching today. Alternative: filter out zeros as channel and item lists do.

### Step 07 — Area F, management stats

- **D29** (step 07, plan 60) Management range tabs are Day, Week, Month, and All-time. Alternative: keep 7-day, 30-day, and 1-year by summing daily rows in the query; the popularity tables only have the four public range columns, and the old "1 year" was two month buckets.
- **D30** (step 07, plan 60) The detail panel has one chart: each UTC day in the month window, missing days as zero. Alternative: a second weekly chart, or only the last nine days.
- **D31** (step 07, plan 61) The database browser lists only the five popularity tables, not daily, event, or taste tables (composite keys, tied to a listener id); the listener-id mapping stays off the allowlist. Alternative: teach the browser composite keys and list those tables too.
- **D32** (step 07, plan 60) The page keeps the word "Views". Alternative: rename the column to Listeners, since the number is a sum of daily listener counts.
- **D33** (step 07, plan 60) Completion counts are not on the Stats page; range tables have no completion column. Alternative: a second series.

### Step 08 — Area G, consent lifecycle and taste profile API

- **D34** (step 08, plan 70) Any No deletes, and the server asks for no confirmation flag; clients confirm before a No whenever the shared helper says it would delete data. Alternative: a required `confirm_delete` body field, which would make opt-out fail with a 400 on installed clients.
- **D35** (step 08, plan 71) Taste Profile routes need an account, not a current membership or consent, so a paused listener can still review and hide shows. Alternative: require the membership tier, blocking a lapsed listener from managing their own data.
- **D36** (step 08, plan 71) "Add back" creates a visible fresh row at zero counts and scores, with null listen times until the first listen; "only take it off the list" adds nothing until the next listen. Alternative: make both choices identical. Plan 20's copy matches this reading.
- **D37** (step 08, plan 71) Hide only works on a show in the Taste Profile or already hidden; anything else gets a 404. Alternative: allow hiding any show ahead of time, which needs a listener id created without a listen.
- **D38** (step 08, plan 71) The Taste Profile list sorts by most recent listen and returns no scores. Alternative: sort by long-term score faded to now and return the scores.
- **D39** (step 08, plan 72) The data export includes raw listen and open records as well as the Taste Profile and the hidden list. Alternative: export only the Taste Profile and the hidden list.

### Step 09 — Area H, client listen sending

- **D40** (step 09, plan 80) Music session restore starts a session; seconds only count while playing, so a restored load that stays paused never reports. Alternative: keep it at `'none'`.
- **D41** (step 09, plan 80) Livestreams are not counted on web or mobile, matching mobile today. Alternative: count a live item by its id after 60 seconds.
- **D42** (step 09, plan 80) A clip completes and closes its session when playback reaches the clip's end; listening past the end counts toward nothing. Alternative: start an item session at that point.
- **D43** (step 09, plan 80) An extra report goes out at 60 seconds when the first report came in below 60, because the server may know a different duration.
- **D44** (step 09, plan 81) Web sends without retry and without `listened_at`, using one tracker for the whole page. Alternative: a `localStorage` outbox.
- **D45** (step 09, plan 82) Mobile uses a dedicated outbox with age rules: a session the server never saw is dropped after 30 days, an update after 6 days, so the server's 7-day rule never counts a late update as a second listen. A declined consent deletes pending rows; while the agreement version is unknown, rows are kept. Alternative: ride the existing playback outbox, whose rows collapse and get evicted.
- **D46** (step 09, plan 82) Car listening while the app's JavaScript is not running is not counted. Alternative: derive listens from the native playback journal.
- **D47** (step 09, plan 83) The legacy request functions are removed in a separate plan, 83, not inside 81 or 82, because 81 and 82 can run in parallel.

### Step 10 — Area I, Taste Profile UI and opt-out warning

- **D48** (step 10, plans 93, 95) Taste Profile and Removed Content rows are plain text, not links, on both clients. Alternative: register show detail screens on the mobile More stack and link from both clients.
- **D49** (step 10, plans 93, 95) Both sections sit on the existing settings surface: web under the Popularity Tracking switch, mobile on the Popularity Tracking screen. They show whenever the listener is signed in, with empty-list copy. Alternative: a separate pushed screen.
- **D50** (step 10, plans 93, 95) Remove acts right away, with no confirmation. The show moves to the hidden list and Unhide can restore it, but its old listen counts are not restored. Alternative: confirm before each Remove.
- **D51** (step 10, plan 90) Rows show a date, not a listen count: "Last Listened: {date}" or "Added back. No listens since." for Taste Profile rows, "Hidden: {date}" for hidden rows. Alternative: a listen count.
- **D52** (step 10, plans 90, 92, 94) The opt-out warning title is "Turn Off Popularity Tracking?", the confirm button is "Turn Off and Delete" in the danger style, and cancel reuses `misc.cancel`. Alternative: a softer confirm label.
- **D53** (step 10, plan 94) The mobile consent prompt asks for confirmation inside its own screen, while mobile Settings uses a dialog. Alternative: a dialog in both places, which cannot display over that prompt.
- **D54** (step 10, plan 91) The two new E2E accounts are dedicated rather than reusing `e2e-user`, which other specs rely on.
- **D55** (step 10, plans 94, 95) The mobile Taste Profile Maestro flow changes nothing on the server, because parallel iOS and Android runs share one database; hide and unhide are covered by the web spec, and the consent prompt's in-place confirmation has no Maestro step. Alternative: a flow that hides and unhides, with an account per platform.

### Second pass — open for review

Steps 11, 12, and 14 made no new decisions. This one stands unless the operator changes it
before the implementation run reaches plan 51 (phase 10).

- **D56** (step 13, plan 51) The merge leaves the survivor's range totals to plan 42's refresh job. Day, week, and month rankings catch up within the hour, and all-time within the hour or by the nightly run. Alternative: recompute the survivor's range row inside the merge (journaled), which ranks it at once but adds a second writer of range values.

## Deferred

Out of scope for this set. Prompt 19 copies this section into
`.llm/plans/active/popularity-tracking-rebuild-deferred/00-SUMMARY.md` when it closes the set.

- **"Also listened" scores and recommendation surfaces (R30).** A nightly job that turns taste
  profiles into show-to-show "also listened" scores with no listener ids, kept forever, and the
  "Listeners Also Like" and "For You" surfaces built on them. It waits because the operator scoped
  this set to the data foundation. Questions to settle first: the minimum number of shared
  listeners before a pair is published (so a score cannot point back to one person); whether the
  recent or the long-term score drives each surface; and whether hidden shows are excluded from
  the listener's own "For You" only or from the pair counts too.
- **Stale training episodes.** `misc/aicasts/listener-privacy-1-popularity-tracking.md` describes
  the old rotating id and rolling counts. `misc/aicasts/content-lifecycle-4-duplicate-feed-merge.md`
  says stats are added together on a merge; after plan 51, same-day overlap inside retention is
  removed, taste rows merge, and a revert does not move listener data back. Both wait for an
  abcaicast after this set ships.
- **Stale QA docs.** `tools/qa/docs/faker/07d-stats-aggregated.md`, `07e-stats-events.md`,
  `01-architecture.md`, and `08-llm-skills.md` still describe the old stats tables.
- **Alpha GitOps retention.** `../k.podcastdj.com/apps/podverse-alpha` now sets
  `STATS_TRACK_EVENT_RETENTION_DAYS` to 90 in its `api.env` and `web-sidecar.env`, edited outside
  this set. The operator pushes it with the alpha ref bump for this set.
