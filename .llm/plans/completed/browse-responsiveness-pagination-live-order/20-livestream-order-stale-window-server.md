**Cursor model:** Opus 5.5 · **Reasoning:** high

# 20 — Livestream order and stale scheduled window: shared contract, ORM, API

## Rows

R6, R7, R8, R10

## Runs after

none

## Answer to R10 (back end or front end?)

Both. The order comes from the back end, and clients only re-sort with a shared rule.

- **Back end:** `ItemService.getManyUpcomingLiveItems` (`packages/orm/src/services/item/item.ts`)
  orders by `live_item.live_item_status_id DESC` (Live before Pending), then `start_time ASC`, then
  `id ASC`. Both groups come back oldest start first, and nothing filters on start time. That is
  the 2024 → 2026 ascending list the request reports. `GET /live-item/global/upcoming` and
  `GET /live-item/subscribed/upcoming` (`apps/api/src/controllers/liveItem.ts`) return that order
  untouched.
- **Web:** Browse and Home render the server page as is (`livestreamsListSsr.ts`,
  `LivestreamsPageContext.tsx`). Home page 1 re-sorts only when Add by RSS livestreams are mixed
  in (`mergeSubscribedLivestreamEntries`), using `compareUpcomingLiveItems`.
- **Mobile:** every upcoming list re-sorts with `sortUpcomingLiveRows`, which calls the same
  `compareUpcomingLiveItems`.

So this fix has two halves: the ORM query (server order and window), and the comparator in
`@podverse/helpers` that every client sort calls. They must agree. This plan changes both, and
plans 21 (web) and 22 (mobile) apply the window to client-only Add by RSS data and update client
tests.

## The contract (other plans and area C build on this)

**Upcoming livestreams order** (Browse Livestreams, Home/Subscribed Livestreams, Add by RSS
upcoming lists, on API, web, and mobile):

1. Live items first, **latest start first** (`start_time DESC`), ties by `id ASC`.
2. Then scheduled (Pending) items, **soonest start first** (`start_time ASC`), ties by `id ASC`.
3. A missing start (client-side Add by RSS data only; the DB column is `NOT NULL`) sorts last in
   its group.
4. Ended items are never in the upcoming list.

**Stale scheduled window:** a scheduled (Pending) item whose start time is **more than 24 hours
(one day) in the past** is hidden from every list. The cutoff instant itself is kept (stale means
`start < now − 24h`). Live items have no window. A scheduled item with no start time is kept.
Detail endpoints (`GET /item/:id`, livestream pages) stay unfiltered, same as the ended window.

**Channel livestream order** (`GET /live-item/channel/:id`, web and mobile Add by RSS channel
pages): live latest start first, then scheduled **soonest start first**, then ended latest end
first. The stale scheduled window applies there too, beside the existing one-day ended window.

## Changes

### 1. `packages/helpers/src/lib/liveItemVisibility.ts`

- Add, beside `LIVE_ITEM_ENDED_VISIBILITY_MAX_AGE_MS`:
  - `export const LIVE_ITEM_PENDING_VISIBILITY_MAX_AGE_MS = ONE_DAY_MS;` with a comment that
    scheduled livestreams whose start is further in the past than this are hidden from lists,
    hardcoded by product decision (no env), detail endpoints unfiltered.
  - `export function getPendingLiveItemVisibilityCutoff(now: Date = new Date()): Date`.
  - `export const isPendingLiveItemStale = (key: UpcomingLiveItemSortKey, now: Date = new Date()): boolean`
    — true only when `key.statusId === LiveItemStatusEnum.Pending`, `key.startTimeMs !== null`,
    and `key.startTimeMs < getPendingLiveItemVisibilityCutoff(now).getTime()`. It takes the sort
    key so every caller (API, web, mobile) can pass the key it already builds;
    `ChannelLiveItemSortKey` is structurally assignable.
- `compareUpcomingLiveItems`: keep the rank step and the missing-start-last step. After those,
  when both are Live return `b.startTimeMs - a.startTimeMs`; otherwise
  `a.startTimeMs - b.startTimeMs`. Rewrite its doc comment to state the contract above (live
  latest start first, scheduled soonest first, missing start last) and that it matches
  `ItemService.getManyUpcomingLiveItems`.
- `compareChannelLiveItems`: keep the rank step and the ended branch (latest end first). For live
  and scheduled, return `compareUpcomingLiveItems(a, b)`. Rewrite its doc comment: live latest
  start first, scheduled soonest start first, ended latest end first, missing time last.

### 2. `packages/orm/src/lib/liveItemWhere.ts`

Add beside `buildEndedLiveItemTimeVariants`:

```typescript
export function buildPendingLiveItemTimeWhere(
  cutoff: Date = getPendingLiveItemVisibilityCutoff()
): FindOptionsWhere<LiveItem> {
  return { start_time: MoreThanOrEqual(cutoff) };
}
```

with a one-line doc: keeps scheduled live items whose start is at or after the cutoff.

### 3. New `packages/orm/src/lib/upcomingLiveItemsPage.ts`

A pure page split, so the two-group pagination is unit-testable without mocking `ItemService`:

```typescript
export type UpcomingLiveItemsPageSegment = { skip: number; take: number };

/**
 * Splits one page of the upcoming list across the live group, which comes first, and the
 * scheduled group. A group the page does not reach is null.
 */
export function splitUpcomingLiveItemsPage(params: {
  skip: number;
  take: number;
  liveCount: number;
}): { live: UpcomingLiveItemsPageSegment | null; pending: UpcomingLiveItemsPageSegment | null };
```

- `live` = `skip < liveCount ? { skip, take: Math.min(take, liveCount - skip) } : null`.
- `remaining = take - (live?.take ?? 0)`; `pending` = `remaining > 0 ? { skip: Math.max(0, skip - liveCount), take: remaining } : null`.

### 4. `ItemService.getManyUpcomingLiveItems` (`packages/orm/src/services/item/item.ts`, anchor `async getManyUpcomingLiveItems(`)

Keep the signature, the empty-`channelIds` early return, and the `channelWhere` construction.
Replace the single `find` with two groups, following the two-segment precedent in
`getManyByChannelBySeason` in the same file:

- `liveWhere`: `{ channel: channelWhere, live_item: { live_item_status_id: Equal(LiveItemStatusEnum.Live) }, item_flag_status: { id: ItemFlagStatusStatusEnum.Active } }`.
- `pendingWhere`: same, with `live_item: { live_item_status_id: Equal(LiveItemStatusEnum.Pending), ...buildPendingLiveItemTimeWhere() }`.
- `liveCount = await this.repositoryRead.count({ where: liveWhere })`.
- `splitUpcomingLiveItemsPage({ skip: config.skip ?? 0, take: config.take ?? PAGINATION.DEFAULT_LIMIT, liveCount })`.
- Live segment (when not null): `find({ ...config, where: liveWhere, order: { live_item: { start_time: 'DESC' }, id: 'ASC' }, skip, take })`.
- Pending segment (when not null): `find({ ...config, where: pendingWhere, order: { live_item: { start_time: 'ASC' }, id: 'ASC' }, skip, take })`.
- Return `[...liveItems, ...pendingItems]`.
- Delete the `// Live (2) sorts before Pending (1).` comment. Rewrite the JSDoc: live items
  latest start first, then scheduled items soonest start first; scheduled items whose start is
  more than a day past are left out; `channelIds` null lists public channels, an empty array
  lists nothing.

The response shape and `meta` (`count: null`) do not change, so no client request code changes.

### 5. Per-status lists (`liveItemType=pending`) get the same window

These builders already add the ended window when `liveItemType === 'ended'`. Add the matching
branch for `'pending'`, `buildWhere({ ...liveItemWhere, ...buildPendingLiveItemTimeWhere() })`,
keeping the ended branch and the default branch as they are:

- `ItemService.getMany` (anchor: the `const where =` after `buildWhere` near
  `liveItemType === 'ended'`, first occurrence in `item.ts`).
- `ItemService.getManyByChannels` (second occurrence in `item.ts`).
- `StatsPopularityItemService.buildListWhere`
  (`packages/orm/src/services/stats/popularity/statsPopularityItem.ts`).

No web or mobile code calls these lists today. They are public API, and this keeps one rule:
list endpoints hide stale ended and stale scheduled items.

### 6. `apps/api/src/controllers/liveItem.ts` `getManyByChannel`

Extend the existing filter so an item is dropped when
`isLiveItemEndedAndStale(item.live_item)` **or** `isPendingLiveItemStale(toChannelLiveItemSortKey(item))`.
Import `isPendingLiveItemStale` from `@podverse/helpers`. Rewrite the comment above it to name
both windows (ended more than a day ago; scheduled whose start is more than a day past). The sort
already calls `compareChannelLiveItems`, so the new scheduled order comes from step 1.

`getManyGlobalUpcoming` and `getManySubscribedUpcoming` do not change.

### 7. `apps/api/openapi.yml` (large file: Grep the path, then Read a window)

Descriptions only; no parameter or schema change.

- `/live-item/global/upcoming` (`apiGetLiveItemGlobalUpcoming`): "Live items on the air now,
  latest start first, then scheduled ones, soonest start first. Scheduled items whose start time
  is more than a day in the past are omitted. Ended live items are never listed."
- `/live-item/subscribed/upcoming` (`apiGetLiveItemSubscribedUpcoming`): the same sentences, then
  "from channels the account follows" and the existing API key sentence.
- `/live-item/channel/{channel_id_or_id_text}`: live by latest start, then pending by soonest
  start, then ended by latest end; ended items that ended more than a day ago and pending items
  whose start is more than a day past are omitted.
- The four live-item recent/top descriptions that say `When liveItemType is "ended", only live
  items that ended within the last day are returned.` (Grep `ended within the last day`): append
  `When liveItemType is "pending", only live items whose start time is within the last day or
  later are returned.`

## Files

packages/helpers/src/lib/liveItemVisibility.ts
packages/helpers/src/lib/liveItemVisibility.test.ts
packages/orm/src/lib/liveItemWhere.ts
packages/orm/src/lib/liveItemWhere.test.ts
packages/orm/src/lib/upcomingLiveItemsPage.ts
packages/orm/src/lib/upcomingLiveItemsPage.test.ts
packages/orm/src/services/item/item.ts
packages/orm/src/services/stats/popularity/statsPopularityItem.ts
apps/api/src/controllers/liveItem.ts
apps/api/src/test/category-channel-item-read.test.ts
apps/api/openapi.yml

## Tests

- `packages/helpers/src/lib/liveItemVisibility.test.ts`
  - `compareUpcomingLiveItems`: keep "live before scheduled even when live starts later" and the
    scheduled earliest-first test. Add: two live items sort latest start first; a live item with
    no start sorts after a dated live item.
  - `compareChannelLiveItems`: keep the existing tests (they still pass). Add: two scheduled items
    sort soonest start first.
  - `LIVE_ITEM_PENDING_VISIBILITY_MAX_AGE_MS` is one day; `getPendingLiveItemVisibilityCutoff`
    returns now minus one day.
  - `isPendingLiveItemStale`: true one millisecond before the cutoff; false at the cutoff; false
    for a future start; false for Live and Ended at any age; false when `startTimeMs` is null.
- `packages/orm/src/lib/liveItemWhere.test.ts`: `buildPendingLiveItemTimeWhere(CUTOFF)` returns a
  `moreThanOrEqual` operator on `start_time` with the cutoff; the default cutoff is about one day
  before now (mirror the existing ended default test).
- `packages/orm/src/lib/upcomingLiveItemsPage.test.ts`: page entirely inside the live group;
  page spanning live into scheduled (`skip: 0, take: 60, liveCount: 5` gives live `{0,5}`,
  pending `{0,55}`); page entirely in the scheduled group (`skip: 60, take: 60, liveCount: 5`
  gives live null, pending `{55,60}`); no live items; live count exactly fills the page (pending
  null).
- `apps/api/src/test/category-channel-item-read.test.ts`:
  - Rename and change `GET /live-item/channel/:id always returns live and pending items regardless
    of age`: the ten-day-old live item (301) is kept, the ten-day-old pending item (302) and the
    stale ended item (303) are dropped.
  - Add: `GET /live-item/channel/:id lists two scheduled items soonest start first` (two Pending
    mocks with negative `startAgoMs`, one hour and five hours ahead, given in the reverse order).
  - Keep `GET /live-item/channel/:id orders live, then scheduled, then ended` (already newest
    live first) and the `/live-item/global/upcoming` mock-order test unchanged.

## Release scratchpad

```markdown
## Livestream lists: newest live first, soonest scheduled first, long-past scheduled hidden

- Surfaces: api, web, mobile
- Change: `GET /live-item/global/upcoming` and `GET /live-item/subscribed/upcoming` list live
  items latest start first, then scheduled items soonest start first. Before, both groups came
  back oldest start first. Scheduled items whose start time is more than a day in the past are
  left out of these lists, of the per-status live-item lists with `liveItemType=pending`, and of
  `GET /live-item/channel/:id`. Channel livestream lists also show scheduled items soonest start
  first. Detail pages still open long-past scheduled items. Web and mobile use the same order
  through the shared `compareUpcomingLiveItems`.
- Who notices: everyone on Browse and Home Livestreams; API consumers of the live-item list routes
- Operator steps: none
```

## Notes

- Do not edit web or mobile tests here. Plans 21 and 22 update the client tests that assert the
  old comparator order and add the client-side window.
- `apps/mobile/src/screens/browse/browseFeedData.ts` and `homeFeedData.ts` are not touched by any
  area B plan.
