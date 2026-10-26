**Cursor model:** Opus 5.5 · **Reasoning:** medium

# 31 — Mobile Browse: load the next page near the bottom

## Rows

R4, R5

## Runs after

20, 22, 30

Plan 20 fixes the server order and stale window for `GET /live-item/global/upcoming`; plan 22
makes `mapItemsToUpcomingLiveRows` drop stale rows on the device. This plan appends livestream
pages and relies on both. Plan 30 adds the helpers used here. No file overlaps with 20 or 22.

## Context

Browse asks for page 1 only. `apps/mobile/src/screens/browse/browseFeedData.ts` hard-codes
`const BROWSE_FEED_PAGE = 1;` and every branch of `fetchBrowseFeedRows` passes it. The list in
`apps/mobile/src/screens/browse/BrowseScreen.tsx` (`feedList`, `<FillList ... testID="browse-feed-list">`)
has no `onEndReached`. So scrolling to the bottom of any Browse chip stops at 60 rows.

Every Browse endpoint returns `ApiListResponse<T>` with `meta: { page, count, limit }`, and
`count` can be null. Has-more is decided by `listResponseHasMore(response.meta, response.data.length)`
from plan 30, read from the **raw** response before mapping. Plan 22 drops stale livestream rows
on the device, so the mapped row count can be short of a full page while the server still has more.

The category picker view (`isCategoryView`) is a local tree and does not page.

## Changes

Imports from plan 30, relative from `screens/browse/`: `'../../lib/pagination/pagedList'`
(`appendUniqueBy`, `canLoadNextPage`, `LIST_END_REACHED_THRESHOLD`, `listResponseHasMore`) and
`'../../hooks/useLoadMoreOnEndReached'`.

### 1. `browseFeedData.ts` — one page per call

- Delete `BROWSE_FEED_PAGE`.
- Add `page: number` to `BrowseFeedOptions`.
- Add and export `type BrowseFeedPage = { feed: BrowseFeedResult; hasMore: boolean };`.
- `fetchBrowseFeedRows` returns `Promise<BrowseFeedPage>`. Every branch passes `page: options.page`
  and returns `{ feed: <the same result it returns today>, hasMore: listResponseHasMore(response.meta, response.data.length) }`.
- The `apiRequestService === null` early return becomes
  `{ feed: emptyBrowseFeed(mediaType), hasMore: false }`.
- Update the doc comment above `fetchBrowseFeedRows` to say it reads one page.

### 2. New `apps/mobile/src/screens/browse/browseFeedPages.ts` — pure append

```ts
export const appendBrowseFeedPage = (
  current: BrowseFeedResult,
  next: BrowseFeedResult
): BrowseFeedResult
```

- Same `kind` on both: return the same kind with `appendUniqueBy` (plan 30) over the list —
  `rows` keyed by `row.id`, `playlists` by `id_text`, `accounts` by `id_text`. These are the ids
  `listRows` in `BrowseScreen.tsx` already uses as list keys, so a repeat can never reach the list
  twice.
- Different `kind`: return `current` unchanged. The screen's request guard makes this unreachable;
  the branch keeps the function total.
- No re-sort. Each server page is already in the server's global order (for livestreams, the plan
  20 contract: Live latest start first, then Scheduled soonest first), so page 1 followed by page 2
  is that same order. An item that moves from Scheduled to Live between two page reads can show up
  on both pages; the dedupe keeps its first position.

Import `BrowseFeedResult` with `import type` from `./browseFeedData`. Keep this file free of
React Native and auth imports so Vitest can load it.

### 3. `BrowseScreen.tsx` — paging state and the end-reached load

New state and refs beside the feed state near `const [directoryFeed, setDirectoryFeed]`:

- `const [feedHasMore, setFeedHasMore] = useState<boolean>(false);`
- `const [isFeedLoadingMore, setIsFeedLoadingMore] = useState<boolean>(false);`
- `const [feedLoadMoreErrorKey, setFeedLoadMoreErrorKey] = useState<string | null>(null);`
- `const feedPageRef = useRef<number>(1);` — the last page merged into `directoryFeed`.

`commitMediaTypeChange`: beside `setDirectoryFeed(emptyBrowseFeed(mediaType))`, also
`setFeedHasMore(false)`, `setIsFeedLoadingMore(false)`, `setFeedLoadMoreErrorKey(null)`, and
`feedPageRef.current = 1`. It already advances `feedRequestIdRef`, which drops any in-flight next
page for the chip being left.

`loadFeed` (page 1 for `'initial' | 'refresh' | 'retry'`):

- Right after `feedRequestIdRef.current = requestId;`, `setIsFeedLoadingMore(false)` and
  `setFeedLoadMoreErrorKey(null)`. A next page still in flight is now stale and its `finally`
  skips cleanup (step 8 below), so this is what clears its spinner, including when page 1 then
  fails.
- Pass `page: 1` in the options to `fetchBrowseFeedRows`.
- On success (inside the existing `requestId === feedRequestIdRef.current` guard):
  `setDirectoryFeed(result.feed)`, `setFeedHasMore(result.hasMore)`, `feedPageRef.current = 1`.
  Advancing `feedRequestIdRef` at
  the top of `loadFeed` already invalidates any next-page read, so a refresh can never be
  overwritten by an older page 2.
- On failure for `'initial' | 'retry'`, also `setFeedHasMore(false)`.

New `loadNextFeedPage` (a `useCallback` with the same dependencies as `loadFeed`):

1. Return when `offlineModeEnabled`, `activePrefs === null`, or `isCategoryView`.
2. Capture `const requestId = feedRequestIdRef.current;` and `const nextPage = feedPageRef.current + 1;`.
   Do **not** advance the request id; a next page belongs to the current list generation.
3. `setIsFeedLoadingMore(true); setFeedLoadMoreErrorKey(null);`
4. `await fetchBrowseFeedRows(selectedMediaType, <same auth deps>, { category: activePrefs.category, page: nextPage, range: activePrefs.range })`.
5. If `requestId !== feedRequestIdRef.current`, return without touching state (the `finally`
   below also skips).
6. Success: `setDirectoryFeed((current) => appendBrowseFeedPage(current, result.feed))`,
   `feedPageRef.current = nextPage`, `setFeedHasMore(result.hasMore)`.
7. Failure: `setFeedLoadMoreErrorKey('errors.generic')`. Rows and `feedHasMore` stay.
8. `finally`: when the request id still matches, `setIsFeedLoadingMore(false)`.

Wire it with `useLoadMoreOnEndReached` (plan 30):

```ts
const handleFeedEndReached = useLoadMoreOnEndReached({
  canLoadMore:
    !isCategoryView &&
    !offlineModeEnabled &&
    canLoadNextPage({
      hasError: feedErrorKey !== null || feedLoadMoreErrorKey !== null,
      hasMore: feedHasMore,
      isLoading: isFeedLoading || isFeedRefreshing,
      isLoadingMore: isFeedLoadingMore,
    }),
  loadMore: loadNextFeedPage,
});
```

`handleRetryFeedPage` (`useCallback`): `setFeedLoadMoreErrorKey(null)` then
`void loadNextFeedPage()`.

`listFooter`: keep the playback notice and render, in this order, when `!isCategoryView`:

- `isFeedLoadingMore` → `<ListLoading testID="browse-list-loading-more" />`
- else `feedLoadMoreErrorKey !== null` →
  `<ListError messageKey={feedLoadMoreErrorKey} onRetry={handleRetryFeedPage} testID="browse-list-load-more-error" />`
- then the existing playback notice `Text`.

Wrap them in a fragment and add the new values to the `useMemo` dependencies. Import
`{ ListLoading }` from `'../../components/state/ListLoading'`, beside the existing `ListError`
import.

`feedList`: on the `FillList`, add
`onEndReached={isCategoryView ? undefined : handleFeedEndReached}` and
`onEndReachedThreshold={LIST_END_REACHED_THRESHOLD}`, and add `handleFeedEndReached` and
`isCategoryView` to the memo dependencies if not already present. `handleFeedEndReached` is stable,
so the list does not re-render per page.

`feedErrorKey` stays the page-1 error. `showFeedRows` reads only `feedErrorKey`, so a failed next
page keeps the rows on screen with the footer retry.

### Out of scope

The perf marks (`browse.paint` and others) stay keyed to page 1; appended pages add no marks.

## Files

apps/mobile/src/screens/browse/browseFeedData.ts
apps/mobile/src/screens/browse/browseFeedPages.ts
apps/mobile/src/screens/browse/browseFeedPages.test.ts
apps/mobile/src/screens/browse/BrowseScreen.tsx

## Tests

New `apps/mobile/src/screens/browse/browseFeedPages.test.ts` (Vitest):

- Media rows: page 2 appends after page 1 in order.
- A row id on both pages appears once, at its page 1 position, with the page 2 value.
- Playlists and accounts append and dedupe by `id_text`.
- A kind mismatch returns the current feed unchanged.
- Two livestream pages built in server order (Live rows, then Scheduled rows) stay in that order
  after the append. Build rows inline; do not call the network.

The Maestro flow `apps/mobile/e2e/browse.yaml` must keep passing unchanged. The E2E seed holds
fewer than 60 rows per Browse chip, so `hasMore` is false there and no next page is requested.

## Release scratchpad

## Mobile Browse loads more rows as you scroll

- Surfaces: mobile
- Change: every Browse chip (Podcasts, Episodes, Clips, Livestreams, Artists, Albums, Tracks,
  Playlists, Users) used to stop at the first 60 rows. Scrolling near the bottom now loads the next
  page and appends it, with a loading row while it reads and a Retry row if that page fails. Rows
  already shown stay. Pull to refresh and chip, range, or category changes start again from page 1.
  Livestream pages keep the server order (live first, then scheduled soonest first).
- Who notices: anyone browsing past the first screenful on the mobile app
- Operator steps: none
