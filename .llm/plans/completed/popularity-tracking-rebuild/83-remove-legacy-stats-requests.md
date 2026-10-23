**Cursor model:** Cursor Grok 4.7 · **Reasoning:** medium

# 83 — Remove the legacy stats request functions; document client listen sending

After plans 81 and 82, nothing calls the five `reqStatsTrack*` request functions; their routes
already answer 404 since plan 32. This plan deletes them from `@podverse/helpers-requests` and
adds the client half of the contract to the Popularity Tracking feature doc, so the rules plans
80–82 put in code are written down in one place.

It is a separate plan because plans 81 and 82 may run at the same time and each still compiles
against the old functions until both are done.

## Rows

R34, R44, R71

## Runs after

31, 81, 82

## Files

- `packages/helpers-requests/src/api/stats/stats.ts`
- `packages/helpers-requests/src/api/_request.ts`
- `docs/features/POPULARITY-TRACKING.md`

## Remove the legacy request functions

- First search the tree (excluding `node_modules`, `dist`, and `.llm/`) for `reqStatsTrack` and
  `trackStatsChannel|trackStatsClip|trackStatsItem|trackStatsPlaylist|trackStatsAccountVisit|trackPlaybackStats|replayPlaybackStats`.
  When any hit remains outside the two files below, stop and report it; it means plan 81 or 82
  left a caller.
- `packages/helpers-requests/src/api/stats/stats.ts`: delete `reqStatsTrackAccount`,
  `reqStatsTrackChannel`, `reqStatsTrackClip`, `reqStatsTrackItem`, `reqStatsTrackPlaylist`, and
  the `StatsTrackResponse` type when nothing in the file uses it any more. Keep plan 32's
  `reqStatsListen`, `reqStatsOpen`, and their types.
- `packages/helpers-requests/src/api/_request.ts`: remove the five names from the
  `./stats/stats.js` import (lines 326–330) and the five methods under `/* STATS TRACK */`
  (lines 1564–1584). Keep the comment heading for plan 32's two methods, renaming it to
  `/* STATS */` if it still reads `STATS TRACK`.

## Doc — `docs/features/POPULARITY-TRACKING.md`

Add a section `## Client Listen Sending` after the section that describes the listen write path
(plan 31 fills that one; place this one directly after it, or at the end of the contracts when the
headings differ). Present tense, no plan numbers (**comments-future-forward**,
**documentation-conventions**). It states:

- Web and mobile measure media seconds actually heard with the shared tracker in
  `packages/playback-core/src/listenSession.ts`. A position sample adds its forward change only
  while playing and only when the change fits in the wall-clock time since the previous sample at
  the playback rate, so seeks and source jumps add nothing.
- Each load's `PlaybackLoadDecision.listenSession` starts a session, keeps it (the same media
  moved to another file), or tracks nothing (Add by RSS, livestreams). A soundbite or chapter counts
  toward its item; a clip counts toward the clip and closes when playback reaches its end.
- A session sends its first report once `isCountedListen` holds for whole seconds heard, again on
  first reaching 60 seconds when the first report was below 60, on completion, and on pause or end
  after 60 more seconds. Every report repeats the session's `client_listen_id`.
- Web sends reports directly from `apps/web/src/utils/statsTracking/statsTracking.ts` without
  retry. The request body has no `listened_at`; the server stamps the time it receives the
  report. Web already sends no listen time. Profile and playlist opens go to `POST /stats/open`.
- Mobile stores reports in the `stats_listen_outbox` SQLite table and sends them when online.
  The request body has no `listened_at`. A replayed listen counts and fades from the time the
  server receives it. `counted_at` stays on the row for the age rules and is not sent. 2xx
  removes a row; 400, 403, 404, and 410 drop it; 401, 429, 5xx, and no response keep it for the
  next drain. A row holding only an update is dropped 6 days after it counted, so it still
  arrives inside the server's 7-day session lookup. An unsent first report is dropped 30 days
  after it counted; that is the outbox's storage bound, not a server clamp. A declined
  Popularity Tracking decision deletes the device's pending rows. Mobile records no profile or
  playlist opens.
- Both clients send only for a signed-in account whose Popularity Tracking decision allows it; the
  server re-checks on every report.
- Listening that plays while the mobile app's JavaScript is not running (a car-started source
  before the app wakes) is not counted.

If the doc does not exist yet (plan 10 creates it), stop and report.

## Tests

None new. The helpers-requests package has no tests for the removed functions; the type-check of
web and mobile after this plan proves no caller remains.

## Release scratchpad

none (the routes were already removed; the client entries are in plans 81 and 82)
