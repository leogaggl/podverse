**Cursor model:** Opus 5.5 · **Reasoning:** high

# 10 — Minimum interval between new listens (`too_soon`)

A listener's new listen is stored only when the listener has no stored listen event in the last
`STATS_LISTEN_MIN_INTERVAL_SECONDS` (default 20). A report under the floor answers **200**
`{ "result": "too_soon" }` and stores nothing. Reports for an already-stored session are updates
and never meet the floor.

## Rows

R1, R2, R3, R4, R17

## Runs after

20

Plan 20 renames the opt-in to Taste Profile first. Use its names: `config.tasteProfileAgreement.version`
in the controllers, `TASTE_PROFILE_CONSENT_REQUIRED_BODY`, and "Taste Profile" for the opt-in in
prose. `config.popularityTracking`, every `STATS_*` key, and the `'Popularity Tracking'`
startup-validation label stay as they are.

## What the code does today (answers R1 and R3)

- **R1 is correct.** `StatsListenWriteService.recordListen`
  (`packages/orm/src/services/stats/listenerIdentity/statsListenWrite.ts`) clamps the reported
  `seconds_heard` to the item or clip length (`storedSecondsHeard`) and checks `isCountedListen`.
  Nothing compares it with wall-clock time, so a scripted client can send a new
  `client_listen_id` with `seconds_heard: 60` as often as the per-process rate limit
  (`STATS_TRACK_MAX_PER_MINUTE`, 60 per minute per pod) allows, up to the daily cap (300).
- **R3 matches the request.** `isCountedListen` in `packages/helpers/src/lib/popularityListen.ts`
  counts a listen at 60 media seconds or 25% of the item or clip, whichever is smaller; an unknown
  duration uses 60 seconds. The floor in this plan is the server-side check that a client cannot
  skip: it bounds new listens to one per 20 seconds of server time, whatever the device claims.

## Behavior

The order inside `recordListen` becomes:

1. Consent check (unchanged).
1. Resolve target (unchanged).
1. Listener lookup; a report below the rule with no listener id answers `below_threshold`
   (unchanged).
1. `lockListener`, `readTransactionNow` (unchanged).
1. Session match (unchanged). A match goes to `updateSessionEvent` and skips everything below.
1. Rule check: `below_threshold` (unchanged).
1. **New: the floor.** When `report.min_interval_seconds > 0`, query
   `SELECT 1 AS recent FROM stats_listen_event WHERE listener_id = $1 AND created_at > $2 LIMIT 1`
   with `$2 = now - min_interval_seconds` (compute in JS from `now`). A row means
   `return 'too_soon'`. No upper bound on `created_at`: a transaction that waited on the listener
   lock can have a `now()` earlier than the `created_at` of the event the lock holder just
   stored, and that event must still block it. The query uses
   `stats_listen_event_listener_created_idx`.
1. Daily cap check, insert, daily rows, taste (unchanged in this plan; plan 11 changes the caps).

Rules that must stay true:

- The floor counts **every** stored listen event of the listener, including events plan 11 stores
  past the popularity cap. A scripted client cannot get under the floor by being over a cap.
- `too_soon` stores nothing, creates no listener id that would not otherwise exist, and touches
  no daily or taste row.
- The floor runs under the per-listener advisory lock, so five concurrent new sessions from one
  listener store exactly one event.
- `min_interval_seconds` of `0` turns the floor off (local development and tests). Config never
  produces a negative value.
- A session whose first report was `too_soon` has no stored event, so a later report for the same
  `client_listen_id` (the tracker reports again at 60 seconds, on completion, and on pause or end)
  is treated as a new listen and is stored once the floor has passed. Document this; it is how a
  real listen that arrived too soon still counts.

## Result type and HTTP

- `packages/helpers/src/lib/popularityListen.ts`: add `'too_soon'` to `PopularityListenResult`
  (after `'daily_cap_reached'`). Add
  `export const POPULARITY_DEFAULT_LISTEN_MIN_INTERVAL_SECONDS = 20;` beside the threshold
  constants, with a one-line doc comment ("Server seconds between one listener's new stored
  listens unless `STATS_LISTEN_MIN_INTERVAL_SECONDS` sets another value.").
- `apps/api/src/controllers/stats/statsListen.ts` `listenResponse`: `'too_soon'` joins the
  `200 { result }` cases.
- `StatsListenReport` in `statsListenWrite.ts` gains
  `/** Server seconds a new listen must wait after the listener's last stored listen; 0 turns the check off. */ min_interval_seconds: number;`
- The controller passes `min_interval_seconds: config.popularityTracking.listenMinIntervalSeconds`.
- `packages/helpers-requests/src/api/stats/stats.ts` needs no edit: `StatsListenResponse` uses the
  union.

## Clients (R17): no code change

- **Mobile** `runDrainPass` (`apps/mobile/src/data/repositories/statsRepository.ts`) calls
  `settleSentRecord` on every 2xx, which deletes the row. It never reads the result and logs
  nothing. `classifyStatsListenSendFailure` only sees thrown errors, so a 200 never reaches it.
  An offline backlog drains oldest first; the first new session is stored and the rest answer
  `too_soon` and are deleted, as the operator chose.
- **Web** `reportListen` (`apps/web/src/utils/statsTracking/statsTracking.ts`) ignores the
  response and catches failures.
- No test is added on either client: neither reads the result, so a client test would only
  restate that a 2xx resolves.

## Config and env

`apps/api/src/config/index.ts`:

- Add a module-level helper above `config` and import `parseOptionalNonNegativeInt` from
  `@podverse/helpers`:

  ```typescript
  function readWholeNumberEnv(name: string, fallback: number, min: number): number {
    const parsed = parseOptionalNonNegativeInt(process.env[name]);
    return parsed !== undefined && parsed >= min ? parsed : fallback;
  }
  ```

- Leave the `dailyListenCap` IIFE as it is. Plan 11 replaces it, renames its key to
  `STATS_LISTEN_DAILY_STORED_CAP`, and moves 300 to a helpers constant.
- Add `listenMinIntervalSeconds: readWholeNumberEnv('STATS_LISTEN_MIN_INTERVAL_SECONDS', POPULARITY_DEFAULT_LISTEN_MIN_INTERVAL_SECONDS, 0)`
  to `popularityTracking`, and to the `Config` type with a doc comment.

Env files (keep each file's existing style; **env-file-formatting**, **env-defaults-match-code**,
**startup-validation-env-order**). Every entry below goes right after the existing daily listen cap
line, whose key is still `STATS_LISTEN_DAILY_CAP` when this plan runs; plan 11 renames that key to
`STATS_LISTEN_DAILY_STORED_CAP` in place, so the new line stays next to it. Do not rename it here.

- `apps/api/.env.example`: after the daily listen cap line, add
  `# Optional. Server seconds between one listener's new stored listens; 0 turns the check off. Empty uses 20.`
  then `STATS_LISTEN_MIN_INTERVAL_SECONDS="20"`.
- `infra/k8s/base/api/source/api.env`: after the daily listen cap line, the same comment without
  "Optional." and `STATS_LISTEN_MIN_INTERVAL_SECONDS=20`.
- `dev/env-overrides/local/rate-limit.env.example`: after the daily listen cap line, add
  `STATS_LISTEN_MIN_INTERVAL_SECONDS="20"`, and replace the block's comment ("# Popularity Tracking
  daily cap on stored listens per listener (not an HTTP limit).") with
  `# Per-listener stats write limits (not HTTP limits).` Plans 11, 12, and 14 add their keys under
  this comment without changing it.
- `scripts/local-env/setup.sh`: add `STATS_LISTEN_MIN_INTERVAL_SECONDS` to the rate-limit `for v
  in …` loop right after the daily listen cap key.
- `apps/api/src/lib/startup/validation.ts`: after the daily listen cap line, add
  `validateOptional('STATS_LISTEN_MIN_INTERVAL_SECONDS', 'Popularity Tracking', 'Use Default (20)')`.
- `apps/api/ENV.md` § Related soft caps: add a `STATS_LISTEN_MIN_INTERVAL_SECONDS` (default `20`)
  bullet: a new listen within that many seconds of the listener's last stored listen answers 200
  with `too_soon` and stores nothing; later reports for a stored session are not checked; `0`
  turns it off; unset, empty, or invalid uses the default. In the `STATS_TRACK_MAX_PER_MINUTE`
  bullet, say the daily listen cap and `STATS_LISTEN_MIN_INTERVAL_SECONDS` are the controls that
  hold across pods (plan 11 names its two cap keys there).

## OpenAPI

`apps/api/openapi.yml` (search `StatsListenResponse:` and `/stats/listen:`):

- `StatsListenResponse.result` enum: add `too_soon` after `daily_cap_reached`.
- `/stats/listen` description: add one sentence: a new session that arrives within the server's
  minimum interval of the listener's last stored listen is not stored and answers `too_soon`.
- `"200"` description: "updated, unchanged, daily_cap_reached, or too_soon".

## Docs

`docs/features/POPULARITY-AND-TASTE-PROFILE.md`:

- § One Report per Listening Session: say later reports for a stored session also skip the
  minimum interval.
- New subsection `### Minimum Interval` after § One Clock: the rule, the env setting and default,
  that it counts every stored listen event, that it runs under the listener lock, that `0` turns
  it off, that a `too_soon` session can still be stored by a later report of the same session
  after the interval, and that clients treat `too_soon` as done.
- § Client Listen Sending: after "2xx removes a row", add that this includes `too_soon`, so an
  offline backlog sent faster than the interval stores only its first new session.

## Files

packages/helpers/src/lib/popularityListen.ts
packages/orm/src/services/stats/listenerIdentity/statsListenWrite.ts
apps/api/src/controllers/stats/statsListen.ts
apps/api/src/config/index.ts
apps/api/src/lib/startup/validation.ts
apps/api/.env.example
apps/api/ENV.md
infra/k8s/base/api/source/api.env
dev/env-overrides/local/rate-limit.env.example
scripts/local-env/setup.sh
apps/api/openapi.yml
docs/features/POPULARITY-AND-TASTE-PROFILE.md
apps/api/src/test/stats-listen-write.integration.test.ts
apps/api/src/test/stats.track.test.ts
release-notes/scratchpad.md

## Tests

API integration, `apps/api/src/test/stats-listen-write.integration.test.ts`:

- `ListenInput` gains `minIntervalSeconds?: number`; the `listen` helper passes
  `min_interval_seconds: input.minIntervalSeconds ?? 0`, so every existing test keeps sending
  back-to-back listens.
- New test "answers too_soon for a new session inside the minimum interval and still updates the
  stored session": fresh account; session A with `minIntervalSeconds: 20` is `counted`; session B
  (new id) with 20 is `too_soon`; the account has one event, the item and channel daily rows and
  the taste `listen_count` are unchanged by B; session A completed with 20 is `updated`. Then move
  the stored event back 21 seconds
  (`UPDATE stats_listen_event SET created_at = created_at - interval '21 seconds'` scoped to the
  account's listener id) and send session B again with 20: `counted`.
- New test "stores one event when five new sessions arrive at once inside the minimum interval":
  fresh account, five concurrent new sessions with `minIntervalSeconds: 20`; results sorted equal
  `['counted', 'too_soon', 'too_soon', 'too_soon', 'too_soon']`; one event.

API route, `apps/api/src/test/stats.track.test.ts`:

- "passes exactly the report fields…" expects
  `min_interval_seconds: config.popularityTracking.listenMinIntervalSeconds`.
- Add `'too_soon'` to the `it.each([...])` of 200 results.

## Release scratchpad

```markdown
## New listens sent too close together are not recorded

- Surfaces: api, k8s base env
- Change: a new listen arriving within `STATS_LISTEN_MIN_INTERVAL_SECONDS` (default 20) of the
  listener's last stored listen is not stored. `POST /stats/listen` answers 200 with
  `{ "result": "too_soon" }`. Later reports for an already-stored listening session are not
  affected. Web and mobile treat the answer as done and do not retry, so an offline backlog sent
  all at once stores only its first new listen.
- Who notices: nobody listening normally; scripted clients can no longer store listens faster
  than one per 20 seconds
- Operator steps: none; set `STATS_LISTEN_MIN_INTERVAL_SECONDS` on the API to change the
  interval (`0` turns it off)
```
