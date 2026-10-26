**Cursor model:** Cursor Grok 4.7 · **Reasoning:** high

# 22 — Mobile: stale scheduled window on livestream rows, order tests

## Rows

R6, R7, R8, R9

## Runs after

20

## Answer to R9 (does mobile display livestreams correctly?)

Not before this set: mobile shows the same wrong order as web. Every mobile upcoming list goes
through one row seam and one sort, both built on the shared helpers:

- **Browse Livestreams** (`apps/mobile/src/screens/browse/browseFeedData.ts`, livestream branch)
  fetches `reqLiveItemGetManyUpcoming({ type: 'global', page: 1 })` and maps it with
  `mapItemsToUpcomingLiveRows` (`apps/mobile/src/screens/home/homeFeedData.ts`), which calls
  `toUpcomingLiveRow` and then `sortUpcomingLiveRows`.
- **Home Livestreams** (`homeFeedData.ts`, `mediaType === 'livestreams'`) reads the cached
  subscribed page (`homeLivestreamsCacheRepository`, written by the `home-livestreams` sync job),
  adds Add by RSS rows from `listAddByRssUpcomingLiveRows`, and sorts the union with
  `sortUpcomingLiveRows`.
- **Add by RSS library Livestreams** (`apps/mobile/src/screens/rss/addByRssLibraryFeedData.ts`)
  uses `listAddByRssUpcomingLiveRows` too.
- `sortUpcomingLiveRows` (`apps/mobile/src/lib/rows/liveItemRows.ts`) calls
  `compareUpcomingLiveItems` from `@podverse/helpers`, so live rows sorted oldest start first, as
  on web.

Rows already show the right status: the Live badge on live rows, and a `Scheduled` word on
scheduled rows (`liveStatusWordKey`, `HomeFeedRow`). Only the order and the long-past scheduled
rows were wrong.

After plan 20, the order is fixed on mobile with no code change, because the server order and the
comparator both change. What mobile still needs is the window on data the server never filtered:

- Add by RSS live items parsed on the device.
- The cached Home page, which can hold a scheduled item that went stale after the last sync.

Putting the check in `toUpcomingLiveRow` covers every list above, plus the Add by RSS channel
page (`toAddByRssFeedLiveRows`).

## Changes

### 1. `apps/mobile/src/lib/rows/liveItemRows.ts`

- `toUpcomingLiveRow(row, statusId, startTime, now: Date = new Date())`: after computing
  `startTimeMs`, return `null` when
  `isPendingLiveItemStale({ statusId, startTimeMs }, now)`. Import `isPendingLiveItemStale` from
  `@podverse/helpers`, next to the existing imports from that module.
- Its doc comment becomes: "Marks a row live or scheduled; null when the status is not upcoming,
  or when a scheduled start is more than a day past."
- `sortUpcomingLiveRows` doc comment becomes: "Live first by latest start, then scheduled by
  soonest start (`compareUpcomingLiveItems`); stable." No logic change.

### 2. `apps/mobile/src/lib/addByRss/liveRows.ts`

- `toAddByRssLiveRows(feed, mappedFeed, now: Date = new Date())`: pass `now` as the fourth
  argument to `toUpcomingLiveRow`. Doc comment: "Upcoming live rows of one stored feed, unsorted;
  ended items, scheduled items more than a day past, and unreadable items are skipped."
- `toAddByRssFeedLiveRows`: pass its existing `now` as the fourth argument to `toUpcomingLiveRow`.
  Doc comment: "The feed page's live rows, in the channel order: live, scheduled, then ended
  within a day. Older ended items, scheduled items more than a day past, and unknown statuses are
  skipped."

Do not edit `apps/mobile/src/screens/browse/browseFeedData.ts`,
`apps/mobile/src/screens/home/homeFeedData.ts`, or `addByRssLiveRows.ts`. They call these
functions with the default `now`, and area C (mobile pagination) edits the first two.

## Files

apps/mobile/src/lib/rows/liveItemRows.ts
apps/mobile/src/lib/rows/liveItemRows.test.ts
apps/mobile/src/lib/addByRss/liveRows.ts
apps/mobile/src/lib/addByRss/liveRows.test.ts

## Tests

Unit tests carry this claim (**mobile-test-economics**): the window and order are pure
functions, and the server half is covered by plan 20's tests and the web Browse Playwright test.
No Maestro flow changes. The existing `apps/mobile/e2e/browse.yaml` Livestreams steps must keep
passing with the seed rows plan 21 adds. The later and stale scheduled rows sit after
`E2E Scheduled Livestream`, so the rows above it are unchanged.

- `apps/mobile/src/lib/rows/liveItemRows.test.ts`
  - `marks a scheduled row unplayable and reads an ISO start`: pass
    `new Date('2026-01-15T12:00:00.000Z')` as `now` (the fixture start is that evening).
  - In `sortUpcomingLiveRows`, the `upcoming` helper passes `new Date(10_000)` as `now`, so its
    millisecond fixtures stay inside the window. Existing expectations are unchanged.
  - Add to `toUpcomingLiveRow`: drops a scheduled row whose start is one millisecond before the
    cutoff (`now − LIVE_ITEM_PENDING_VISIBILITY_MAX_AGE_MS`); keeps one at the cutoff; keeps a
    live row that started ten days before `now`; keeps a scheduled row with no start.
  - Add to `sortUpcomingLiveRows`: `sorts live rows by the latest start first` (live 1_000 and
    live 3_000, given earliest first, come back `[3_000, 1_000]`).
- `apps/mobile/src/lib/addByRss/liveRows.test.ts`
  - `toAddByRssLiveRows` test: pass `new Date('2026-06-01T12:00:00.000Z')` as `now`. Expectations
    unchanged.
  - The `upcomingIndexes` call at the end of the `toAddByRssFeedLiveRows` test: pass `now`.
    Expectation `[1, 3]` unchanged.
  - Add to `toAddByRssFeedLiveRows`: a feed with one live item and one scheduled item that
    started two days before `now` returns only the live row.

## Release scratchpad

```markdown
## Mobile: livestream rows follow the new order and hide long-past scheduled streams

- Surfaces: mobile
- Change: Browse, Home, and the Add by RSS library Livestreams lists show live streams latest
  start first, then scheduled streams soonest start first. Scheduled streams whose start time is
  more than a day in the past are hidden, including ones already sitting in the cached Home list
  and Add by RSS feeds parsed on the device. Add by RSS podcast pages list scheduled streams
  soonest start first.
- Who notices: mobile listeners who open Livestreams on Browse, Home, or the Add by RSS library
- Operator steps: none
```
