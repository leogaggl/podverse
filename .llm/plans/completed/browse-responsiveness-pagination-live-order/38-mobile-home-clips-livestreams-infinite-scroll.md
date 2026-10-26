**Cursor model:** Opus 5.5 · **Reasoning:** high

# 38 — Mobile Home Clips and Livestreams: extend the stored window near the bottom

## Rows

R4, R5

## Runs after

20, 22, 30

Plan 20 sets the subscribed upcoming order and stale window on the server, and plan 22 makes
`mapItemsToUpcomingLiveRows` drop stale rows on the device. Home Livestreams re-sorts its whole
stored window with those rules on every read. No file overlaps with 20 or 22. Plan 30 adds the
helpers used here.

## Context

Home's Podcasts, Episodes, Artists, Albums, and Tracks chips read device tables that already hold
the whole subscribed set; they do not page and are not changed. Two Home chips read a **snapshot
of page 1** of a paginated endpoint and stop there:

- **Clips** — `apps/mobile/src/data/repositories/homeClipsCacheRepository.ts`.
  `refreshFromAccount` (run by the `home-clips` job in `apps/mobile/src/sync/syncJobs.ts`,
  `createHomeClipsJob`) stores `reqClipGetManyPublic({ page: HOME_CLIPS_PAGE, type: 'subscribed', medium: 'podcasts', sort, range })`
  under the kv key `home.clips.subscribed`. `fetchHomeFeed` (`apps/mobile/src/screens/home/homeFeedData.ts`,
  `mediaType === 'clips'` branch) reads it with `listPayload`. Clips have no A-Z order: plan 40
  removes it from the Home Clips sort chip and deletes `applyHomeSort`, so the clips list is
  always the server order of the stored pages.
- **Livestreams** — `apps/mobile/src/data/repositories/homeLivestreamsCacheRepository.ts`.
  `refreshFromAccount` (the `home-livestreams` job) stores page 1 of
  `reqLiveItemGetManyUpcoming({ type: 'subscribed', medium: 'all' })` under
  `home.livestreams.subscribed`, guarded by `getAuthSessionGeneration`. `AuthProvider.tsx` calls
  `clear()` on sign-out. `fetchHomeFeed` (`mediaType === 'livestreams'`) reads it with `listItems`,
  joins Add by RSS upcoming rows, and sorts everything with `sortUpcomingLiveRows`.

**mobile-sync-orchestration** forbids a screen reading subscribed content from the network. So
Home never puts a network page into React state. Scrolling near the bottom runs an interactive
**extend**: the repository fetches the next page, appends it to the stored snapshot, and Home
re-reads the snapshot with the existing `loadFeed('synced')`. The reuse source is the podcast
Episodes section (`extendDirectoryChannelOrDropGone` deepens the stored episode window, then the
section re-reads storage). A deeper window also stays readable offline.

## Decisions

- **Home Clips extends under every sort it offers.** Clips never offer A-Z (operator answer D9;
  plan 40 removes it), so Recent and Popularity both extend, and each new page continues the
  server order.
- **A sync refresh resets the window to page 1.** `refreshFromAccount` keeps replacing the
  snapshot with one fresh page, as it does today. A background sync after a deep scroll shortens
  the list back to page 1. Re-reading every stored page in each background job would multiply the
  job's requests; the pull-to-refresh and foreground syncs that trigger it are moments the reader
  expects the list to start over.
- **An extend reuses the query that built the window.** The snapshot records the sort and range it
  was fetched with, and the next page uses those, so page 2 always continues page 1. A Home Clips
  sort or window change refetches page 1 right away (plan 50), so the window and the chosen order
  differ only while that refetch is in flight or after it failed; an extend in that gap still
  continues the stored order.

## Changes

### 1. `homeClipsCacheRepository.ts`

Payload, parsed with a type guard (no `as`):

```ts
type HomeClipsCacheWindow = {
  hasMore: boolean;
  pageCount: number;
  range: QueryParamsStatsRange | null;
  sort: 'recent' | 'top';
};
export type HomeClipsCacheSnapshot = { items: unknown[]; window: HomeClipsCacheWindow | null };
```

- Export a pure `parseHomeClipsCache(value: unknown): HomeClipsCacheSnapshot`. A payload written
  before this change (`{ items }` only) or a `window` that fails the guard parses as
  `window: null`, which means "no next page" until the next sync writes a window.
- Export a pure `appendHomeClipsPage(snapshot: HomeClipsCacheSnapshot & { window: HomeClipsCacheWindow }, response: { data: unknown[]; meta: { count: number | null; limit: number; page: number } }): HomeClipsCacheSnapshot`
  — `items: appendUniqueBy(snapshot.items, response.data, clipCacheKey)`,
  `window: { ...snapshot.window, hasMore: listResponseHasMore(response.meta, response.data.length), pageCount: response.meta.page }`.
  `clipCacheKey(item: unknown): string` reads `id_text` with `isObjectLike` and returns `''`
  otherwise (rows without an id are already dropped by `normalizeClipRows`).
- Module-level `let homeClipsCacheWriteGeneration = 0;`, advanced by every write
  (`replacePayload`, the extend write).
- New `readSnapshot(): Promise<HomeClipsCacheSnapshot>` — the current `listPayload` read, parsed
  with `parseHomeClipsCache`. `listPayload` becomes `(await readSnapshot()).items`.
- `replacePayload(items, window)` takes the window; `refreshFromAccount` passes
  `{ hasMore: listResponseHasMore(response.meta, response.data.length), pageCount: HOME_CLIPS_PAGE, range: options.range, sort: options.sort }`.
- `refreshFromAccount` also captures `getAuthSessionGeneration()` before the request and skips
  the write when it changed, matching `homeLivestreamsCacheRepository`.
- In the `refreshFromAccount` doc comment, delete the sentence "Alphabetical Home order is applied
  when the screen reads the cache, because the endpoint has no title sort." and keep the line that
  `sort` is the directory token the endpoint accepts. The snapshot is shown in the order it was
  fetched.
- New `extendFromAccount(context: MobileAuthRequestContext): Promise<'end' | 'extended' | 'stale'>`:
  1. Capture `getAuthSessionGeneration()` and `homeClipsCacheWriteGeneration`.
  2. `readSnapshot()`; when `window === null` or `!window.hasMore`, return `'end'`.
  3. `reqClipGetManyPublic` with the same fixed params as `refreshFromAccount`, `page: window.pageCount + 1`,
     and the window's `range` and `sort`.
  4. When either generation changed, return `'stale'` without writing.
  5. Write `appendHomeClipsPage(snapshot, response)` (advancing the write generation) and return
     `'extended'`.
  Errors propagate.

### 2. `homeLivestreamsCacheRepository.ts`

The same shape, without a query (the request has no sort or range):

- `type HomeLivestreamsCacheWindow = { hasMore: boolean; pageCount: number };`
  `export type HomeLivestreamsCacheSnapshot = { items: DTOItem[]; window: HomeLivestreamsCacheWindow | null };`
- Export pure `parseHomeLivestreamsCache(value: unknown)` and
  `appendHomeLivestreamsPage(snapshot, response)` (dedupe by `item.id_text`; has-more from the
  **raw** `response.data.length`, before plan 22's stale filter runs on read).
- `homeLivestreamsCacheWriteGeneration`, advanced by `replaceItems`, `clear`, and the extend write.
  `clear()` starts with `homeLivestreamsCacheWriteGeneration += 1` before its first `await`, then
  deletes the `home.livestreams.subscribed` row. That bump is what stops an extend that started
  before sign-out from writing. Plan 55 copies this `clear()` onto the clips repository.
- `readSnapshot()`; `listItems` becomes `(await readSnapshot()).items`.
- `replaceItems(items, window)`; `refreshFromAccount` passes
  `{ hasMore: listResponseHasMore(response.meta, response.data.length), pageCount: HOME_LIVESTREAMS_PAGE }`.
- `extendFromAccount(context)` with the same four steps as clips (`reqLiveItemGetManyUpcoming`,
  `medium: 'all'`, `type: 'subscribed'`, `page: window.pageCount + 1`).

`syncJobs.ts` needs no change: both jobs call `refreshFromAccount` with the same arguments.

### 3. `homeFeedData.ts`

- `HomeFeedRead` gets `/** The stored window has another page the screen may extend into. */ hasMore: boolean;`.
  Set it to `false` in `homeFeedReadFromRows`, `readDownloadedHomeItemFeed`, and the
  episodes/tracks return. The `clips` branch reads `homeClipsCacheRepository.readSnapshot()` and
  returns `{ ...homeFeedReadFromRows(applyHomeSort(normalizeClipRows(snapshot.items), sort)), hasMore: snapshot.window?.hasMore === true }`.
  There is no sort guard on `hasMore`; plan 40 deletes `applyHomeSort` afterwards.
  The `livestreams` branch reads `homeLivestreamsCacheRepository.readSnapshot()` and sets
  `hasMore: snapshot.window?.hasMore === true`; rows are built as today from `snapshot.items`.
- New export:

  ```ts
  export const extendHomeFeed = async (
    mediaType: HomeMediaType,
    context: MobileAuthRequestContext
  ): Promise<'end' | 'extended' | 'stale'>
  ```

  `'clips'` → `homeClipsCacheRepository.extendFromAccount(context)`, `'livestreams'` →
  `homeLivestreamsCacheRepository.extendFromAccount(context)`, anything else → `'end'`.

### 4. `HomeScreen.tsx`

State beside `const [feedRows, setFeedRows]`:

- `const [feedHasMore, setFeedHasMore] = useState<boolean>(false);`
- `const [isFeedExtending, setIsFeedExtending] = useState<boolean>(false);`
- `const [feedExtendErrorKey, setFeedExtendErrorKey] = useState<string | null>(null);`

`loadFeed`: wherever it sets `setFeedRows(read.rows)`, also `setFeedHasMore(read.hasMore)`. In the
offline-unavailable branch and the error branch that clears rows, `setFeedHasMore(false)`.

`commitMediaTypeChange`: `setFeedHasMore(false)`, `setIsFeedExtending(false)`,
`setFeedExtendErrorKey(null)`.

New `extendFeed` (`useCallback`):

1. Return unless `status === 'authenticated'`, `!offlineModeEnabled`, and `selectedMediaType` is
   `'clips'` or `'livestreams'`. Capture `const mediaType = selectedMediaType;`.
2. `setIsFeedExtending(true); setFeedExtendErrorKey(null);`
3. `const outcome = await extendHomeFeed(mediaType, { accessToken, clearSession, refreshToken, setTokens });`
4. `'extended'` or `'stale'` → `await loadFeedRef.current('synced')` (a stale outcome means a sync
   or sign-out rewrote the snapshot; the re-read shows that). `'end'` → `setFeedHasMore(false)`.
   `loadFeed` checks its own request id, so a chip change during the extend is safe: the re-read
   reads the newly selected chip.
5. `catch` → `setFeedExtendErrorKey('errors.generic')`.
6. `finally` → `setIsFeedExtending(false)`.

Wiring:

```ts
const handleFeedEndReached = useLoadMoreOnEndReached({
  canLoadMore:
    (selectedMediaType === 'clips' || selectedMediaType === 'livestreams') &&
    status === 'authenticated' &&
    !offlineModeEnabled &&
    pendingMediaType === null &&
    canLoadNextPage({
      hasError: feedErrorKey !== null || feedExtendErrorKey !== null,
      hasMore: feedHasMore,
      isLoading: isFeedRefreshing,
      isLoadingMore: isFeedExtending,
    }),
  loadMore: extendFeed,
});
const handleRetryExtend = useCallback(() => {
  void extendFeed();
}, [extendFeed]);
```

`listFooter` (the `useMemo` above `feedList`): add, before its existing content,
`isFeedExtending` → `<ListLoading testID="home-feed-loading-more" />`, else
`feedExtendErrorKey !== null` →
`<ListError messageKey={feedExtendErrorKey} onRetry={handleRetryExtend} testID="home-feed-load-more-error" />`.
Update its dependencies.

`feedList`: add `onEndReached={handleFeedEndReached}` and
`onEndReachedThreshold={LIST_END_REACHED_THRESHOLD}` to the `FillList`, and
`handleFeedEndReached` to the memo dependencies (it is stable).

Imports (relative from `screens/home/`): `ListLoading` from
`'../../components/state/ListLoading'`, `ListError` from `'../../components/state/ListError'`
where not already imported, `canLoadNextPage` and `LIST_END_REACHED_THRESHOLD` from
`'../../lib/pagination/pagedList'`, `useLoadMoreOnEndReached` from
`'../../hooks/useLoadMoreOnEndReached'`. In the repositories: `appendUniqueBy` and
`listResponseHasMore` from `'../../lib/pagination/pagedList'`, and `getAuthSessionGeneration`
from `'../../auth/authRequestWithRefresh'` in the clips repository.

### 5. `homeFeedData.localPaint.test.ts`

The mock of `homeClipsCacheRepository` gains `readSnapshot: vi.fn()`; the clips case mocks
`readSnapshot` with `{ items: [...the same clip...], window: null }` instead of `listPayload`, and
asserts `read.hasMore` is `false`. Reset `readSnapshot` in `beforeEach`.

## Files

apps/mobile/src/data/repositories/homeClipsCacheRepository.ts
apps/mobile/src/data/repositories/homeClipsCacheRepository.test.ts
apps/mobile/src/data/repositories/homeLivestreamsCacheRepository.ts
apps/mobile/src/data/repositories/homeLivestreamsCacheRepository.test.ts
apps/mobile/src/screens/home/homeFeedData.ts
apps/mobile/src/screens/home/homeFeedData.localPaint.test.ts
apps/mobile/src/screens/home/HomeScreen.tsx

## Tests

New repository tests that load only the pure exports, mocking `../db` and
`../../auth/authRequestWithRefresh` the way `itemDescriptionCacheRepository.test.ts` does:

- `homeClipsCacheRepository.test.ts`: `parseHomeClipsCache` reads a full payload; an old
  `{ items }` payload and a malformed window parse as `window: null`; a non-object parses as empty.
  `appendHomeClipsPage` appends in order, keeps the first position of a repeated `id_text`,
  advances `pageCount`, and turns `hasMore` off on a short page while keeping `sort` and `range`.
- `homeLivestreamsCacheRepository.test.ts`: the same cases for the livestream parse and append;
  `hasMore` comes from the raw page length.

`homeFeedData.localPaint.test.ts`: the updated clips case above, plus a clips case with a window
whose `hasMore` is true, read under `sort: 'recent'` and under `sort: 'popularity'` (both expect
`hasMore: true`).

`apps/mobile/e2e/home.yaml` must keep passing; seed accounts hold fewer than 60 subscribed clips or
livestreams.

## Release scratchpad

## Mobile Home Clips and Livestreams load more as you scroll

- Surfaces: mobile
- Change: Home's Clips and Livestreams chips used to show only the first 60 rows saved by
  background sync. Scrolling near the bottom now fetches the next page, saves it on the device with
  the rest, and redraws the list, so the deeper list also stays readable offline. A loading row
  shows while it reads and a Retry row if it fails. Clips extend under Recent and Popularity. The
  next background sync starts the saved list over from page 1.
  Livestreams stay in live-first, then soonest-scheduled order across pages.
- Who notices: signed-in users following many clip-heavy podcasts or many livestreaming channels
- Operator steps: none
