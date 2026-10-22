# 96 — Web Add by RSS feed pages use the channel livestream order

**Cursor model:** Cursor Grok 4.7 · **Reasoning:** high

## Rows

- **R72**: the web Add by RSS podcast, album, and artist pages list livestreams by the channel
  endpoint's rules (`GET /live-item/channel/:id`): live, then scheduled, then ended within a
  day (latest end first). Older ended items are hidden. Use plan 95's `compareChannelLiveItems`
  and `isLiveItemEndedAndStale`.

**Runs after:** 95 (`compareChannelLiveItems` in `@podverse/helpers`) and 87 (it writes
`apps/web/e2e/media-list-chips.spec.ts`, which this plan extends). **Runs before:** 52. Never
in one phase with 87. This plan does not edit `liveItemVisibility.ts`.

## What the pages do today

`buildAddByRSSLivestreamIndex` returns every `liveItems` entry. It does not drop a status or an
old end time. Each page then sorts a copy by `startTimeMs` descending (newest start first),
including every ended item:

- `AddByRSSPodcastPageDetailClient.tsx` — `sortedLiveItems`. Shown on the Episodes tab, page 1
  only (`showLiveItems`), above the episodes, `showChannelInfo={false}`, `sortOrder={sort}`.
- `AddByRSSAlbumPageClient.tsx` — same memo. Shown on the Tracks tab, page 1 only, above the
  tracks, `showChannelInfo` omitted.
- `AddByRSSArtistPageClient.tsx` — same memo, over livestreams from related album feeds
  (`buildAddByRSSLivestreamIndex(relatedAlbums)`), not from the artist feed record.
  `AddByRSSArtistPageList.tsx` renders that array on the Tracks tab only, with
  `showChannelInfo`. The Albums tab does not list livestreams.

The episode, track, and album sort control does not order these arrays. Rows link through
`AddByRSSLivestreamNodes` to `/add-by-rss/podcast/livestream/[id]` or the music equivalent.
Plan 88 keeps those item rows. The Livestreams chip (plan 84) is a different list: upcoming
only, `compareUpcomingLiveItems`.

## Parity source

`LiveItemController.getManyByChannel` and plan 95's `compareChannelLiveItems`: Live, then
Pending, then Ended; live and scheduled by latest start; ended by latest end; a missing time
sorts last in its group (`?? 0`). `isLiveItemEndedAndStale` hides an ended item whose end, or
start when there is no end, is before `now` minus one day. The cutoff instant is kept
(`<`, not `<=`). Live and Pending are never stale.

## Locked decisions

1. **One function, three pages.** `selectChannelOrderedLiveItems` in
   `apps/web/src/utils/addByRSS/channelLiveItems.ts`. Each `sortedLiveItems` memo becomes
   `selectChannelOrderedLiveItems(liveItems)`. No other work in the memo.
2. **Where they render.** Unchanged. Podcast: Episodes, page 1. Album: Tracks, page 1. Artist:
   Tracks tab only, one combined list across related albums (not grouped by album). Do not
   index the artist feed's own `liveItems`. Do not change `isEmptyActiveTab`: a Tracks tab
   with no track items still shows the empty message when live items exist.
3. **Which items.** Keep Live, Pending, and Ended that are not stale. Drop a missing
   `liveItem` and any other status. Do not filter inside `buildAddByRSSLivestreamIndex`. The
   IndexedDB livestream index, `getAddByRSSLivestreamByGuid`, and the livestream detail page
   still open an older ended item.
4. **Times.** Read `liveItem.start_time` and `liveItem.end_time`, not the index `startTimeMs`
   (that field is 0 when the start is missing, and it has no end). A `Date` or a non-empty
   string is a time; anything else is missing. Sort keys use `null` for a missing time so
   plan 95's comparator sorts it last in the group.
5. **Stale check.** Call `isLiveItemEndedAndStale` only when at least one time is present.
   Pass the real start when it is present, otherwise the end, and pass the end only when it
   is present. An item with neither time stays, and sorts last in its status.
6. **Sort control.** Still orders episodes, tracks, and albums only. Leave `sortOrder={sort}`
   on the podcast livestream nodes. Album and artist keep omitting `sortOrder` (the nodes
   default to `'recent'`). Do not edit `useAddByRSSPlayNext` or `useAddByRSSPlayPrevious`.
7. **Reload list.** `resolveAddByRSSListContextFromCurrentItem`'s livestream branch uses this
   function instead of sorting by `startTimeMs`. The `sortOrder` argument still orders
   episodes and tracks and is still returned on the context. Callers pass `'recent'`. If the
   current id was filtered out, `indexOf` is -1 and the function returns null, as it does
   when the id is absent.
8. **Chip.** Do not change plan 84. The Livestreams chip stays upcoming-only
   (`compareUpcomingLiveItems`, no ended items). That is the R52 list. This plan is the
   channel list on the feed page.
9. **Order stability.** Copy into a new array. Do not mutate the input. `Array.prototype.sort`
   is stable, so equal keys keep the index order (feed order, then `liveItems` order). No
   title tie-break.

## Files

| Path                                                                      | Change                          |
| ------------------------------------------------------------------------- | ------------------------------- |
| `apps/web/src/utils/addByRSS/channelLiveItems.ts`                         | New selector                    |
| `apps/web/src/utils/addByRSS/channelLiveItems.test.ts`                    | New Vitest                      |
| `apps/web/src/app/add-by-rss/podcast/AddByRSSPodcastPageDetailClient.tsx` | Memo calls the selector         |
| `apps/web/src/app/add-by-rss/album/AddByRSSAlbumPageClient.tsx`           | Memo calls the selector         |
| `apps/web/src/app/add-by-rss/artist/AddByRSSArtistPageClient.tsx`         | Memo calls the selector         |
| `apps/web/src/app/add-by-rss/artist/AddByRSSArtistPageList.tsx`           | No change (renders `liveItems`) |
| `apps/web/src/utils/addByRSS/resolveListContextFromCurrentItem.ts`        | Livestream branch               |
| `apps/web/e2e/media-list-chips.spec.ts`                                   | Podcast page order              |
| `release-notes/scratchpad.md`                                             | Entry                           |

No i18n, OpenAPI, API, or mobile change. No new Playwright file, so the spec-order file stays.

## Implementation

### `channelLiveItems.ts`

Value import `compareChannelLiveItems`, `isLiveItemEndedAndStale`, and `LiveItemStatusEnum`
from `@podverse/helpers`. Type import `ChannelLiveItemSortKey` on its own line.

```typescript
export type ChannelLiveItemTimes = {
  live_item_status?: LiveItemStatusEnum | null;
  start_time?: string | Date | null;
  end_time?: string | Date | null;
};

export type ChannelOrderedLiveItem = {
  liveItem?: ChannelLiveItemTimes | null;
};

const hasTime = (value: string | Date | null | undefined): value is string | Date =>
  value instanceof Date || (typeof value === 'string' && value.trim() !== '');

const toFiniteTimeMs = (value: string | Date | null | undefined): number | null => {
  if (!hasTime(value)) {
    return null;
  }
  const ms = value instanceof Date ? value.getTime() : new Date(value).getTime();
  return Number.isFinite(ms) ? ms : null;
};

/**
 * Livestreams on a channel page: live, then scheduled, then ended within a day.
 * An ended item whose end (or start, when it has no end) is before the one-day
 * cutoff is omitted. The instant of the cutoff is kept.
 */
export const selectChannelOrderedLiveItems = <T extends ChannelOrderedLiveItem>(
  items: readonly T[],
  now: Date = new Date()
): T[] => {
  const kept: { item: T; key: ChannelLiveItemSortKey }[] = [];
  for (const item of items) {
    const liveItem = item.liveItem;
    const statusId = liveItem?.live_item_status;
    if (
      statusId !== LiveItemStatusEnum.Live &&
      statusId !== LiveItemStatusEnum.Pending &&
      statusId !== LiveItemStatusEnum.Ended
    ) {
      continue;
    }
    const rawStart = liveItem?.start_time;
    const rawEnd = liveItem?.end_time ?? null;
    let startForStale: string | Date | null = null;
    if (hasTime(rawStart)) {
      startForStale = rawStart;
    } else if (hasTime(rawEnd)) {
      startForStale = rawEnd;
    }
    if (startForStale !== null) {
      const endForStale = hasTime(rawEnd) ? rawEnd : null;
      if (
        isLiveItemEndedAndStale(
          {
            live_item_status_id: statusId,
            start_time: startForStale,
            end_time: endForStale,
          },
          now
        )
      ) {
        continue;
      }
    }
    kept.push({
      item,
      key: {
        statusId,
        startTimeMs: toFiniteTimeMs(rawStart),
        endTimeMs: toFiniteTimeMs(rawEnd),
      },
    });
  }
  kept.sort((a, b) => compareChannelLiveItems(a.key, b.key));
  return kept.map((entry) => entry.item);
};
```

`AddByRSSLivestreamIndexItem` is assignable to `ChannelOrderedLiveItem` (its `liveItem.start_time`
is a `Date`). Do not assert.

### Pages

In each of the three clients, replace the `sortedLiveItems` copy-and-`startTimeMs` sort with
`selectChannelOrderedLiveItems(liveItems)`. Import the function as a value from
`utils/addByRSS/channelLiveItems` (extensionless, Tier B). Leave `showLiveItems`, the divider,
`showChannelInfo`, `sortOrder`, pagination, and the artist empty-tab check as they are.

### `resolveListContextFromCurrentItem.ts`

In the `isLivestream` branch, delete the `startTimeMs` sort. Set `itemIdTexts` from
`selectChannelOrderedLiveItems(forChannel).map((item) => item.idText)`. Leave the episode
branch and the returned `sortOrder` as they are. One comment on that branch: livestreams
follow the channel order; `sortOrder` orders episodes and tracks.

## Tests

**Unit** — `channelLiveItems.test.ts`. Fixed `now` of `2026-06-13T12:00:00.000Z`. Build rows
with an `id` plus `liveItem` (`live_item_status`, `start_time`, `end_time`). Use ISO strings
except where a case says `Date`. Assert ids, in order.

- Channel order beats start order. One live item starting two hours before `now`, one Pending
  item starting 30 minutes before `now`, one Ended item starting 10 minutes before `now` and
  ending 5 minutes before `now`. Result: live, Pending, Ended. A start-time sort would put
  the Ended item first.
- Two Ended items inside the day: the later end comes first, even when its start is earlier.
- An Ended item ending one millisecond before `now - LIVE_ITEM_ENDED_VISIBILITY_MAX_AGE_MS`
  is dropped. One ending at that instant is kept. A Live item and a Pending item whose times
  are ten days earlier are kept.
- An Ended item with `end_time: null` and a start two days earlier is dropped. The same with
  a start one hour earlier is kept.
- `liveItem: null` is dropped. A `liveItem` with no `live_item_status` is dropped.
- Two Live items, one with `start_time: null` and one with a start: the dated one is first.
  The input array's order is unchanged after the call.
- One Live item whose `start_time` is a `Date` of the same instant as another's ISO string:
  the later instant is first.

**Playwright** — extend plan 87's `PARSED_FEED.podcastLiveItems` in
`e2e/media-list-chips.spec.ts`. Do not add a spec file. Follow **e2e-readability** and
**e2e-screenshot-verified-element**. Album and artist call this same function; they do not
get a separate browser test. The signed-in fixture is a podcast feed.

Set the existing live item's `start` to two hours before `Date.now()`. That item's title
constant stays `E2E_CHIPS_ADD_BY_RSS_LIVESTREAM_TITLE`. Add three items that copy its other
fields (`enclosure` and anything else plan 87 set) and override title, guid, status, start,
and end:

| Title constant                            | Title                               | guid                                | status    | start   | end    |
| ----------------------------------------- | ----------------------------------- | ----------------------------------- | --------- | ------- | ------ |
| (existing)                                | `E2E Chips Add by RSS Livestream`   | `e2e-chips-add-by-rss-live`         | `live`    | now-2h  | omit   |
| `E2E_CHIPS_ADD_BY_RSS_SCHEDULED_TITLE`    | `E2E Chips Add by RSS Scheduled`    | `e2e-chips-add-by-rss-scheduled`    | `pending` | now-30m | omit   |
| `E2E_CHIPS_ADD_BY_RSS_ENDED_RECENT_TITLE` | `E2E Chips Add by RSS Ended Recent` | `e2e-chips-add-by-rss-ended-recent` | `ended`   | now-10m | now-5m |
| `E2E_CHIPS_ADD_BY_RSS_ENDED_OLD_TITLE`    | `E2E Chips Add by RSS Ended Old`    | `e2e-chips-add-by-rss-ended-old`    | `ended`   | now-3d  | now-2d |

`status` is the partytime string (`Phase4LiveStatus`): `pending` renders as "Scheduled".
Times are `toISOString()`, as plan 87's live `start` is. A start-time sort would list Ended
Recent, then Scheduled, then Live. The channel order is Live, Scheduled, Ended Recent.

New test inside the signed-in nested `describe` that already stubs this feed (the one plan 87's
Add by RSS livestream test uses). Do not add a `beforeEach`. Steps, each a full sentence, each
capturing with the helper that spec already uses, centered on the element the step checks:

1. Open `/add-by-rss?tab=livestreams` and wait until a link with
   `E2E_CHIPS_ADD_BY_RSS_LIVESTREAM_TITLE` is visible (15 seconds). This only waits for the
   parse. Do not assert chip order.
2. Click the Podcasts chip (`getByRole('button', { name: 'Podcasts', exact: true })` inside
   `getByTestId('media-list-chips')`). Click the feed link
   `a[href*="/add-by-rss/podcast/"]:not([href*="/livestream/"])` filtered by
   `E2E_ADD_BY_RSS_TEST_ASSETS_FEED_TITLE`.
3. On the podcast page, three `add-by-rss-livestream-row` rows are visible, in this vertical
   order: the live title (its row also contains "Live"), then the scheduled title (contains
   "Scheduled"), then the recent-ended title (contains "Ended"). Compare `boundingBox().y`
   (fail if a box is null). Center the shot on the live row.
4. The old-ended title has count 0. Center the shot on the recent-ended row.
5. Click the button named "Recent" (`filters.sort.recent`), then the menuitem named "Oldest".
   The three rows stay in the same vertical order. Center the shot on the live row.

Plan 87's chip assertions still pass: they look for the live title, not for it to be the only
row, and they do not forbid a scheduled row.

## Release scratchpad

Append to `release-notes/scratchpad.md`:

```markdown
## Add by RSS feed pages use the channel livestream order

- Surfaces: web
- Change: the Add by RSS podcast, album, and artist pages list livestreams the way a channel's
  live-item list does. Live comes first, then scheduled, then any that ended within the last
  day (latest end first). Older ended livestreams are hidden. The sort control still orders
  episodes, tracks, or albums only.
- Who notices: web listeners whose Add by RSS feeds include livestreams, especially ones that
  have ended
- Operator steps: none
```
