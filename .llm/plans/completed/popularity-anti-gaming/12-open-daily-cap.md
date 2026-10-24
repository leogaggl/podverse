**Cursor model:** Cursor Grok 4.7 · **Reasoning:** high

# 12 — Daily cap on counted profile and playlist opens

A listener counts at most `STATS_OPEN_DAILY_CAP` (default 10) opens per UTC day, profiles and
playlists combined. An open past the cap answers **200** `{ "result": "daily_cap_reached" }` and
stores nothing. Opening your own profile or playlist keeps answering `own_content` and never uses
up the cap. Opening the same profile or playlist again that day keeps answering `unchanged` and
never uses up the cap. Opens have no minimum interval.

## Rows

R18

## Runs after

11

Plan 20's names apply (see plan 10 § Runs after): `statsOpen.ts` already reads
`config.tasteProfileAgreement.version`.

## Write path

`packages/orm/src/services/stats/listenerIdentity/statsOpenWrite.ts`:

- `StatsOpenReport` gains
  `/** Counted opens allowed per listener per UTC day, profiles and playlists together. */ daily_cap: number;`
- Replace the `openedToday` query with one query that answers both questions:

  ```typescript
  const [openDay] = await queryRows(
    manager,
    `SELECT count(*)::int AS open_count,
            COALESCE(bool_or(${column} = $4), false) AS opened
       FROM stats_open_event
      WHERE listener_id = $1 AND created_at >= $2 AND created_at < $3`,
    [listenerId, today.start, today.end, opened.id]
  );
  if (openDay?.opened === true) {
    return 'unchanged';
  }
  const openCount = typeof openDay?.open_count === 'number' ? openDay.open_count : 0;
  if (openCount >= report.daily_cap) {
    return 'daily_cap_reached';
  }
  ```

  Keep the order: consent, resolve target, `own_content`, listener id, `lockListener`, the query
  above, then the event insert and daily row upsert as they are. Every stored open event is a
  counted open, so `count(*)` over today's events is the number of counted opens.
- Class doc comment: add "at most `daily_cap` counted opens per listener and UTC day".

`packages/helpers/src/lib/popularityListen.ts`:

- `PopularityOpenResult` becomes
  `'counted' | 'unchanged' | 'own_content' | 'daily_cap_reached' | 'not_allowed' | 'not_found'`.
- Add `export const POPULARITY_DEFAULT_DAILY_OPEN_CAP = 10;` with the doc comment "Counted
  profile and playlist opens per listener per UTC day unless `STATS_OPEN_DAILY_CAP` sets another
  value."

## API

- `apps/api/src/controllers/stats/statsOpen.ts` `openResponse`: `'daily_cap_reached'` joins the
  `200 { result }` cases with `'unchanged'` and `'own_content'`. Pass
  `daily_cap: config.popularityTracking.dailyOpenCap` to `recordOpen`.
- `apps/api/src/config/index.ts`: in `popularityTracking`, add
  `dailyOpenCap: readWholeNumberEnv('STATS_OPEN_DAILY_CAP', POPULARITY_DEFAULT_DAILY_OPEN_CAP, 1)`
  (the helper exists from plan 10), and `dailyOpenCap: number;` with a doc comment in the
  `Config` type.

## Env

Place `STATS_OPEN_DAILY_CAP` right after `STATS_LISTEN_DAILY_POPULARITY_CAP` in each file:

- `apps/api/.env.example`: `# Optional. Counted profile and playlist opens per listener per UTC day, together. Empty uses 10.`
  then `STATS_OPEN_DAILY_CAP="10"`.
- `infra/k8s/base/api/source/api.env`: same comment without "Optional.", then
  `STATS_OPEN_DAILY_CAP=10`.
- `dev/env-overrides/local/rate-limit.env.example`: `STATS_OPEN_DAILY_CAP="10"` in the
  per-listener stats write limits block that plan 10 titled.
- `scripts/local-env/setup.sh`: add `STATS_OPEN_DAILY_CAP` to the rate-limit loop after
  `STATS_LISTEN_DAILY_POPULARITY_CAP`.
- `apps/api/src/lib/startup/validation.ts`: after the popularity cap line,
  `validateOptional('STATS_OPEN_DAILY_CAP', 'Popularity Tracking', 'Use Default (10)')`.
- `apps/api/ENV.md` § Related soft caps: add the bullet "**`STATS_OPEN_DAILY_CAP`** (default
  `10`) limits counted profile and playlist opens per listener per UTC day, both kinds together,
  enforced in the database. An open past the cap answers 200 with `daily_cap_reached` and stores
  nothing. Own-content opens and repeat opens of the same profile or playlist that day do not use
  it up. Unset, empty, or below 1 uses the default."

## OpenAPI

`apps/api/openapi.yml`:

- `StatsOpenResponse.result` enum: add `daily_cap_reached` after `own_content`.
- `/stats/open` description: after "never for the opener's own profile or playlist", add "and at
  most a daily number of counted opens per opener, profiles and playlists together".
- `"200"` description: "Already opened today (unchanged), the opener's own profile or playlist
  (own_content), or the opener's daily cap reached (daily_cap_reached)".

## Docs

`docs/features/POPULARITY-AND-TASTE-PROFILE.md` § Opens: replace "Opens never touch taste rows and have no
daily cap; the API rate limit covers them." with: opens never touch taste rows; at most
`STATS_OPEN_DAILY_CAP` (default 10) counted opens per listener per UTC day, profiles and
playlists together; an open past it returns `daily_cap_reached` and stores nothing; own-content
and repeat opens do not use it up; opens have no minimum interval.

## Clients

Web `trackStatsProfileOpen` and `trackStatsPlaylistOpen`
(`apps/web/src/utils/statsTracking/statsTracking.ts`) ignore the response, so they need no
change. Mobile records no opens.

## Files

packages/orm/src/services/stats/listenerIdentity/statsOpenWrite.ts
packages/helpers/src/lib/popularityListen.ts
apps/api/src/controllers/stats/statsOpen.ts
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

- The `open` helper takes an optional third argument `dailyCap = OPEN_DAILY_CAP` (new constant
  `OPEN_DAILY_CAP = 10`) and passes it as `daily_cap`.
- New test "stops counting opens at the daily cap, profiles and playlists together, without
  counting own or repeat opens": fresh opener account and two fresh owner accounts (`seedAccount`),
  each owner's likes playlist via `PlaylistService.getOrCreateDefaultLikesPlaylist` like the
  existing `beforeAll`. With `dailyCap` 2: opening owner A's profile is `counted`; opening it again
  is `unchanged`; opening the opener's own profile is `own_content`; opening owner A's playlist is
  `counted`; opening owner B's profile is `daily_cap_reached` and owner B has no
  `stats_daily_account` row today (`dailyOpenCount` returns 0); opening owner A's profile again is
  still `unchanged`.

API route, `apps/api/src/test/stats.track.test.ts`:

- "answers 201 for the first open today…" expects `daily_cap: config.popularityTracking.dailyOpenCap`
  in the service call.
- Add a test "answers 200 with the result when the opener reached the daily cap": mock
  `recordOpenMock.mockResolvedValue('daily_cap_reached')`, post `{ playlist_id_text: 'playlist-id-text' }`,
  expect 200 and `{ result: 'daily_cap_reached' }`.

## Release scratchpad

```markdown
## Public popularity counts take at most 10 profile and playlist opens a day per listener

- Surfaces: api, k8s base env
- Change: `STATS_OPEN_DAILY_CAP` (default 10) caps counted profile and playlist opens per
  listener per UTC day, both kinds together. `POST /stats/open` answers 200 with
  `{ "result": "daily_cap_reached" }` past it and stores nothing. Opening your own profile or
  playlist, or the same one again that day, does not use up the cap.
- Who notices: nobody browsing normally; one account can no longer push many profiles or
  playlists up the public lists in a day
- Operator steps: none; set `STATS_OPEN_DAILY_CAP` on the API to change the cap
```
