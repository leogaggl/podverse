**Cursor model:** Cursor Grok 4.7 · **Reasoning:** high

# 21 — Web: stale scheduled window on Add by RSS livestreams, order tests, Browse E2E

## Rows

R6, R7, R8

## Runs after

20

## Context

Plan 20 changes the server order and window, and `compareUpcomingLiveItems` /
`compareChannelLiveItems` in `@podverse/helpers`. It also adds `isPendingLiveItemStale` and
`LIVE_ITEM_PENDING_VISIBILITY_MAX_AGE_MS`. The order contract is:

- Upcoming lists: live latest start first, then scheduled soonest start first, missing start last.
- Channel lists: live latest start first, then scheduled soonest start first, then ended latest end
  first.
- A scheduled item whose start is more than one day before now is hidden (the cutoff instant is
  kept). Live items have no window.

Web Browse and Home render the server page as is, so they get the new order and window from
plan 20 with no code change here
(`apps/web/src/app/_media-lists/livestreams/*` stays untouched). What web still owns is Add by RSS
livestream data, which never reaches the server list, plus the tests that assert the old
comparator order.

## Changes

### 1. `apps/web/src/utils/subscribed/mergeSubscribedLivestreams.ts`

- `selectUpcomingAddByRSSLivestreams(items, flaggedFeedIdTexts, now: Date = new Date())`: add a
  third filter condition, `!isPendingLiveItemStale(addByRSSUpcomingSortKey(item), now)`. Import
  `isPendingLiveItemStale` from `@podverse/helpers`.
- Rewrite its doc comment: upcoming live items of the flagged feeds, live by latest start, then
  scheduled by soonest start. An item from an unflagged feed, an ended item, and a scheduled item
  whose start is more than a day past are left out.
- Rewrite the `mergeSubscribedLivestreamEntries` doc comment's first line to "Page 1 mixes server
  livestreams with Add by RSS livestreams in the upcoming order (live latest start first, then
  scheduled soonest start first)." Keep the rest. No logic change: server rows arrive already
  windowed, and Add by RSS rows arrive through `selectUpcomingAddByRSSLivestreams`.

This one selector feeds both Home Subscribed Livestreams (`LivestreamsPageList` through
`useUpcomingAddByRSSLivestreams`) and the Add by RSS library Livestreams tab
(`AddByRSSLivestreamsPageClient`), so the hook and those components do not change.

### 2. `apps/web/src/utils/addByRSS/channelLiveItems.ts` `selectChannelOrderedLiveItems`

After the status check, skip the item when
`isPendingLiveItemStale({ statusId, startTimeMs: toFiniteTimeMs(rawStart) }, now)`. Keep the
ended check as it is. Rewrite the doc comment: live, then scheduled, then ended within a day; a
scheduled item whose start is more than a day before the cutoff is omitted, as is an ended item
whose end (or start, when it has no end) is before the one-day cutoff; the cutoff instant is
kept. This covers the Add by RSS podcast, album, and artist pages.

### 3. E2E seed: `tools/web/seed-e2e.mjs` (the live AV channel block, anchor `async function insertLiveItem(`)

Mobile E2E reuses this seed (`mobile_e2e_seed: e2e_seed_web`), so keep every existing item and
title.

- Give `insertLiveItem` a `startsInHours = 0` parameter. Its `live_item` insert becomes
  `NOW() + ($3::int * INTERVAL '1 day') + ($4::int * INTERVAL '1 hour')` with params
  `[itemId, statusName, startsInDays, startsInHours]`.
- Pass `startsInHours: -2` on the HLS video item (`E2E_LIVE_AV_HLS_VIDEO_ITEM_ID_TEXT`), so it is
  the one live item that started before the others.
- Add two scheduled items after the existing scheduled one, both with
  `enclosureType: 'audio/mpeg'`, `enclosureUrl: E2E_PODCAST_SHORT_ENCLOSURE_URL`,
  `statusName: 'pending'`:
  - `E2E_LIVE_AV_LATER_SCHEDULED_ITEM_ID_TEXT = 'e2eLiveSched02'` (14 chars),
    `E2E_LIVE_AV_LATER_SCHEDULED_ITEM_TITLE = 'E2E Later Scheduled Livestream'`,
    `guidSlug: 'scheduled-later'`, `startsInDays: 3`.
  - `E2E_LIVE_AV_STALE_SCHEDULED_ITEM_ID_TEXT = 'e2eLiveStale01'` (14 chars),
    `E2E_LIVE_AV_STALE_SCHEDULED_ITEM_TITLE = 'E2E Stale Scheduled Livestream'`,
    `guidSlug: 'scheduled-stale'`, `startsInDays: -3`.
- Declare the four constants beside `E2E_LIVE_AV_SCHEDULED_ITEM_*` and add both ids to the
  `Seeded playable live E2E channel …` log line.

The titles avoid containing `E2E Scheduled Livestream` as a substring, because the spec's
`liveItemRow` filters by `hasText`.

### 4. `apps/web/e2e/helpers/seedConstants.ts`

Export the same four constants beside `E2E_LIVE_AV_SCHEDULED_ITEM_TITLE`.

### 5. `apps/web/e2e/media-list-chips.spec.ts` (Browse Livestreams test)

Retitle `When Browse Livestreams is opened signed out, live streams are listed before scheduled
ones` to `When Browse Livestreams is opened signed out, live streams are listed latest start
first, then scheduled streams soonest start first, and a long-past scheduled stream is hidden`.
In its first step (retitle that step to match), keep every existing assertion and add:

- `hlsVideoRow = liveItemRow(page, E2E_LIVE_AV_HLS_VIDEO_ITEM_TITLE)` is visible and
  `rowTop(hlsVideoRow)` is greater than `rowTop(audioRow)` (the audio item started now, the HLS
  video item two hours ago).
- `laterScheduledRow = liveItemRow(page, E2E_LIVE_AV_LATER_SCHEDULED_ITEM_TITLE)` is visible,
  shows `Scheduled`, and its top is greater than `scheduledTop`.
- `liveItemRow(page, E2E_LIVE_AV_STALE_SCHEDULED_ITEM_TITLE)` has count 0.
- Change the `capturePageLoad` caption to `Browse Livestreams lists live streams latest start
  first, then scheduled streams soonest start first, without the long-past scheduled stream.`
  and keep `scheduledRow` as the captured element.

Leave the Subscribed Livestreams tests alone; the stale and later scheduled items belong to the
unfollowed live AV channel, which those tests already expect to be absent.

## Files

apps/web/src/utils/subscribed/mergeSubscribedLivestreams.ts
apps/web/src/utils/subscribed/mergeSubscribedLivestreams.test.ts
apps/web/src/utils/addByRSS/channelLiveItems.ts
apps/web/src/utils/addByRSS/channelLiveItems.test.ts
tools/web/seed-e2e.mjs
apps/web/e2e/helpers/seedConstants.ts
apps/web/e2e/media-list-chips.spec.ts

## Tests

- `apps/web/src/utils/subscribed/mergeSubscribedLivestreams.test.ts`
  - `selectUpcomingAddByRSSLivestreams` existing test: pass `new Date(10_000)` as `now` so its
    epoch-millisecond fixtures stay inside the window; expectations unchanged.
  - Add: `leaves out a scheduled item whose start is more than a day before now, keeps one at the
    cutoff, and keeps an old live item` with
    `now = new Date('2026-06-13T12:00:00.000Z')`,
    `cutoffMs = now.getTime() - LIVE_ITEM_PENDING_VISIBILITY_MAX_AGE_MS`, items
    `stale` (Pending, `cutoffMs - 1`), `at-cutoff` (Pending, `cutoffMs`), `old-live` (Live,
    `now - 10 days`); expect `['old-live', 'at-cutoff']`.
  - `mergeSubscribedLivestreamEntries` first test: retitle to `orders page 1 live by latest start,
    then scheduled, and keeps the server row when the keys match`; the expected labels become
    `['server:1', 'server:2', 'add-by-rss:rss-live-same', 'add-by-rss:rss-live-earlier',
    'add-by-rss:rss-scheduled']`.
- `apps/web/src/utils/addByRSS/channelLiveItems.test.ts`
  - `drops an ended item one millisecond before the cutoff and keeps the cutoff, plus old live and
    scheduled items`: retitle to `… keeps the cutoff and an old live item, and drops a scheduled
    item that started ten days ago`; expect `['old-live', 'at-cutoff']`.
  - Add: two scheduled items one hour and five hours ahead, given in reverse, list soonest first.
  - Add: a scheduled item one millisecond before the pending cutoff is dropped, one at the cutoff
    is kept, and a scheduled item with `start_time: null` is kept.
- Playwright: the Browse Livestreams test in `apps/web/e2e/media-list-chips.spec.ts` (above).

## Release scratchpad

```markdown
## Web: long-past scheduled Add by RSS livestreams are hidden

- Surfaces: web
- Change: Home Subscribed Livestreams, the Add by RSS library Livestreams tab, and Add by RSS
  podcast, album, and artist pages leave out scheduled livestreams whose start time is more than a
  day in the past, matching the server lists. Add by RSS channel pages list scheduled livestreams
  soonest start first.
- Who notices: web listeners with Add by RSS feeds that carry livestreams
- Operator steps: none
```
