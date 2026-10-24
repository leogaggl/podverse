# Popularity anti-gaming — request

## Request

Earlier message in the same chat, for context (the agent answered it by explaining the current
write path):

> Explain to me the stats track limits per day. Does stats tracking affect the popularity metrics
> or just the taste profile? Hypothetically, we are okay with the taste profile. Having more tracks
> per day because the taste profile is just personal for the user. But for popularity in general
> and to reduce gaming, we want to be fairly strict on the maximum number of listens counted per
> paid account per day. Explain to me how these limits work and which stats get counted for taste
> profile versus which get counted for popularity. Or are they both one in the same?

The request:

> Listen time is reported by the device: the server trusts seconds_heard and checks it only against
> the item's length, not against real time passing. A scripted client could reach 300 counted
> listens in minutes.
>
> Would it be worth adding some checking that prevents an account from adding more than one count
> per user per 30 seconds? that is an attempt for the server to ignore listens that seem to violate
> the 60 seconds or 25% rule.
>
> can you also add some type of flagging for accounts that seem to be conspicuously listening in a
> botted way? we may add them to a stats tracking shadowban list where their stats are still used
> for a taste profile but not for the popularity count of the show.
>
> 300 seems too many as the default. lets make that 100.
>
> i also don't like that one account can get counted twice for listening to the same show in 2
> days. don't we keep the listen event rows for 90 days? so can we prevent the listen tracking from
> happening twice in however many days that is set?
>
> ask questions if you need to and make the changes you recommend.
>
> i may have explained some of the things you said incorrectly so don't assume what i am saying is
> correct if it seems off to you

## Operator answers

- **Minimum interval between new counted listens.** The agent recommended the listen's threshold
  divided by the 3x max playback speed, because a flat 30 seconds drops real listens at 2.5x–3x and
  short clips. Operator: "is this going to be enforced by the backend? because if someone can send
  a direct api request to side step it it won't do us much good. if we set the listen tracking time
  to 60s or 25% before track request is sent then i think it would be fine if we just have a 20s
  flat limit from the backend". Settled: a **flat 20-second** server-side floor between one
  listener's new counted listens, enforced in the listen write transaction under the per-listener
  lock. The agent proposed making it an env setting with default 20. Reports for an already-stored
  session (same `client_listen_id`) are updates and are not subject to the floor. The agent
  recommended that a too-soon report answer **429** so the mobile outbox keeps the row and retries
  on a later drain. The operator chose a 2xx instead; see **Too-soon answer** below.
- **Daily cap.** Operator chose **two caps**: at most **100** listens per listener per UTC day
  count toward popularity; up to **300** per day are still stored and feed the Taste Profile.
- **Counting the same listener more than once.** Operator chose: day, week, and month range counts
  become **distinct listeners in that window**, computed from the listen events (kept 90+ days),
  instead of summing per-day listener counts. All-time counts a listener **once per show per N
  days**, N an env setting defaulting to 90 (not above event retention). The agent pointed out that
  doing an N-day dedupe at write time instead would make the Day and Week Top lists show only new
  listeners, which the operator did not choose.
- **Botted accounts.** Operator chose: **auto-flag and auto-exclude** a listener from popularity
  as soon as it is flagged; its listens still feed its Taste Profile; an admin can clear the
  exclusion. Flags and exclusions are keyed by the pseudonymous listener id, never the account id
  (see the listener-id separation rule). Detection signals and thresholds are for planning to
  propose (too-soon reports and daily-cap hits are the obvious inputs).
- **Execution.** Operator chose a plan set in a fresh worktree.
- **Base branch.** The worktree branch `feature/popularity-anti-gaming` fast-forwards onto
  `feature/combined`, which already holds `feature/popularity-tracking-rebuild` (plus
  auth-sessions, artist-album-attribution, and realtime-banner-notifications). Paths and migration
  numbers in this file are paths on `feature/combined`.
- **Too-soon answer.** Operator chose a **2xx** with a new "not counted" result for a new listen
  under the 20-second floor, not 429. Every client treats it as done and drops it: the mobile
  outbox deletes the row, web does nothing. Offline backlogs that arrive faster than the floor are
  not retried. Mobile and web must accept the new result without logging it as an error.
- **Opens.** Operator: "there should be at least some anti gaming on profile and playlist even if
  it is simpler than listening. i would even suggest a hard limit of 10 counts per day for
  profiles and playlists per user since it is not a type of page we expect users to visit many of
  per day (and visiting and your own content profile or playlist should not count towards
  popularity)". Settled:
  - At most **10** counted opens per listener per UTC day, **profiles and playlists combined**, an
    env setting defaulting to 10. Opens past the cap store nothing and count nothing (opens never
    feed taste).
  - Own profile and own playlist opens already return `own_content` and store nothing; keep that.
  - Flagged listeners' opens are excluded from popularity, same as their listens.
  - Day, week, and month open counts become **distinct openers in that window**, and all-time
    follows the same once-per-N-days rule as listens.
  - No 20-second floor for opens.

### Review of the first planning pass

The operator answered the planner decisions D1–D32 listed in `00-SUMMARY.md` § Decisions to
review, and added D33–D37. Every answer below is settled.

**Kept as planned:** D1 (`too_soon`), D2 (the floor applies after every stored listen), D3 (`0`
turns the floor off), D4 (a later report of the same session can still be stored), D6 (answer
`counted` past the popularity cap), D7 (the `popularity_counted` column), D8, D9 (no version
bump), D10 (distinct UTC minutes, flag at 30, `STATS_FLAG_TOO_SOON_MINUTES`, `0` off; refined by
D34), D12 and D13 (not signals), D14 (excluded at write and at count time), D15 (opens stored with
`popularity_counted`), D16, D17 ("a clear holds for the rest of that UTC day"), D18 ("the listener
is never told and flags stay out of the export"), D19, D20 (general sentences, no bump), D21–D27,
D28 (no bump), D29 (reject retention below 31), D30 (simulated counts).

**Changed:**

- **D5:** "rename both keys, STATS_LISTEN_DAILY_STORED_CAP (300) and
  STATS_LISTEN_DAILY_POPULARITY_CAP (100)." `STATS_LISTEN_DAILY_CAP` goes away.
- **D11:** "flag only when 300 stored listens are reached within 3 hours of the first stored
  listen of the day, STATS_FLAG_STORED_CAP_WITHIN_HOURS default 3, 0 turns it off." Reaching the
  stored cap later in the day is not a signal.
- **D31:** "API startup fails with a clear message when STATS_ALL_TIME_RECOUNT_DAYS is greater
  than STATS_TRACK_EVENT_RETENTION_DAYS. No quiet lowering."
- **D32:** "tighten plan 33 in all four locales: listens and opens recorded while the mark was in
  place stay left out after it is removed."

**New:**

- **D33:** "opting out and back in must not reset caps, flags or all-time counts. After any
  opt-out, a popularity cooldown of STATS_ALL_TIME_RECOUNT_DAYS (90) applies, stored in a new
  account_settings.listen_stats_opted_out_at column. Listens still feed the Taste Profile and
  answer counted. One legal sentence goes in plan 42. The work is a new area A plan after plan
  11."
- **D34:** "the too-soon signal counts only an unbroken run. A too-soon minute more than 2 minutes
  after the last one resets the count to 1, so flagging needs about 30 near-continuous too-soon
  minutes. This protects several devices on one account and mobile backlog flushes. No new
  storage beyond the count and last minute plan 30 already keeps."
- **D35:** "a too_soon answer does not count toward the signal when the server-side duration of
  the item or clip is under 60 seconds. The floor itself still applies."
- **D36:** "the E2E API env and the web E2E server env set STATS_FLAG_TOO_SOON_MINUTES=0 and
  STATS_FLAG_STORED_CAP_WITHIN_HOURS=0 so seeded test accounts are never flagged."
- **D37**, its own plan: "the user-facing name of the opt-in changes from Popularity Tracking to
  Taste Profile in web, mobile, legal and terms, in all four locales. The summary next to the
  switch says plainly that {brand_name} tracks your listens to build your Taste Profile, and that
  those listens also count toward public popularity rankings without your name. Buttons and status
  copy use the new name, for example Yes, Build My Taste Profile and Turn Off Taste Profile?. Web
  Settings merges the switch section and the Taste Profile list into one Taste Profile section:
  heading, switch, short description, then the shows list and Hidden From Taste Profile. Mobile
  uses the same layout on its renamed screen. The web consent page moves from /popularity-tracking
  to /taste-profile with no redirect, because nothing has shipped. Internal identifiers that name
  the opt-in as popularity tracking are renamed too: i18n namespace and keys, routes, components
  such as PopularityAgreementGate, helpers, config, the env keys
  POPULARITY_TRACKING_AGREEMENT_VERSION and POPULARITY_TRACKING_CONTENT_DIR in every env file, k8s
  env, ENV.md and startup validation, the API legal path and the apps/api/legal/popularity-tracking
  folder, docs, abcmemory references, tests, E2E specs and Maestro flows. New names must not
  collide with existing taste profile identifiers, for example use an agreement or consent suffix.
  Keep popularity names where they mean public counts: stats_popularity tables, popularity caps,
  popularity_counted, ranking code, and the management Flagged Listeners page. Keep the
  account_settings listen_stats columns. No agreement or terms version bump. Run it alone, before
  plans 13, 33 and 42, so those plans write their legal wording with the new name."

## Glossary

- "stats track" / "listen tracking": Popularity Tracking listen reports (`POST /stats/listen`).
- "shadowban list": a listener exclusion from popularity counts that the listener is not told
  about; taste keeps working.
- "paid account": an account with the `trackStats` capability.

## Orientation

- `docs/features/POPULARITY-TRACKING.md` — the contract for every store, writer, and job; update it
  with every behavior change.
- `.cursor/rules/popularity-listener-id-separation.mdc` — only the listener identity zone reads
  the account-to-listener mapping; flags and exclusions must work from `listener_id`.
- `packages/orm/src/services/stats/listenerIdentity/statsListenWrite.ts` —
  `StatsListenWriteService.recordListen`: consent check, counted-listen rule, session match
  (7-day lookback), daily cap (`readListenerDay` count vs `daily_cap`), event insert, daily rows
  (first-of-day per item, channel, clip), taste rows. One cap gates popularity and taste today.
- `packages/orm/src/services/stats/listenerIdentity/statsWriteGuard.ts` — `lockListener`,
  `utcDayBounds`, `isTrackingAllowedForUpdate`.
- `packages/helpers/src/lib/popularityListen.ts` — `isCountedListen`, threshold constants, taste
  weights and half-lives, `PopularityListenResult` union (add new results here).
- `apps/api/src/controllers/stats/statsListen.ts` — maps `PopularityListenResult` to HTTP status;
  passes `config.popularityTracking.dailyListenCap`.
- `apps/api/src/config/index.ts` (`popularityTracking.dailyListenCap`, default 300 parsed inline),
  `apps/api/src/lib/startup/validation.ts` (`STATS_LISTEN_DAILY_CAP` optional), `apps/api/ENV.md`,
  `apps/api/.env.example`, `infra/k8s/base/api/source/api.env`,
  `dev/env-overrides/local/rate-limit.env.example`, `scripts/local-env/setup.sh` (rate-limit var
  loop) — every place `STATS_LISTEN_DAILY_CAP` appears.
- `STATS_TRACK_MAX_PER_MINUTE` (default 60) is a per-process rate limit shared by `/stats/listen`
  and `/stats/open`; it is not a cross-pod limit.
- `packages/orm/src/services/stats/statsPopularityRefresh.ts` — `refreshStatsPopularity`; recent
  and full modes sum `stats_daily_*.listener_count` per window. `statsEntityTables.ts` lists the
  five types (channel, item, clip, playlist, account).
- `infra/k8s/base/ops/source/database/linear-migrations/app/0025_popularity_tracking_foundation.sql`
  — event, taste, daily, and range tables; `stats_listen_event_listener_created_idx`
  `(listener_id, created_at)`, plus `item_id`, `channel_id`, `clip_id` indexes. New SQL needs a new
  linear migration, baseline regen, and the readiness marker (see **linear-sql-greenfield-only**,
  **migration-readiness-marker-sync**).
- Event retention: `STATS_TRACK_EVENT_RETENTION_DAYS`, 90 by default; partitions drop by whole
  month, so rows live 90 to about 122 days.
- `apps/mobile/src/data/repositories/statsRepository.ts` (`runDrainPass`) and
  `statsListenOutbox.ts` (`classifyStatsListenSendFailure`) — mobile keeps rows on 401, 429, 5xx,
  and no response, and stops the pass at the first retry; drains run on each new report and from
  sync jobs.
- `apps/web/src/utils/statsTracking/statsTracking.ts` — web sends without retry.
- Max playback speed is 3x (`packages/helpers/src/dtos/mediaPlayer/playbackSpeed.ts`).
- Channel merge (`verifyAndApplyDuplicateMerges`, doc § Channel Merge) moves events and adjusts
  daily rows; a range job that reads events must still give the right answer after a merge.
- `apps/management-api/src/lib/database/tablePolicy.ts` — which stats tables the management DB
  browser lists; `stats_listener` is never listed.
- Profile and playlist opens (`StatsOpenWriteService` in
  `packages/orm/src/services/stats/listenerIdentity/statsOpenWrite.ts`, `stats_open_event`) also
  feed popularity once per opener per entity per day, with no daily cap today; the rules that now
  apply to them are under **Opens** above.
