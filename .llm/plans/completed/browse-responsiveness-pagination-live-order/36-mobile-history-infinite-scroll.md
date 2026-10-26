**Cursor model:** Opus 5.5 · **Reasoning:** medium

# 36 — Mobile History: load the next page near the bottom

## Rows

R4, R5

## Runs after

30

## Context

`apps/mobile/src/screens/library/LibraryHistoryScreen.tsx` reads only the first page of play
history: `loadHistory` calls `fetchHistoryPage(selectedQueue.id_text, FIRST_PAGE)`
(`useQueueResources` → `queueRepository.getHistoryPage`, which caches each page under its own key
and returns `DTOQueueResource[]` with no `meta`). The API serves 60 rows per page
(`getPaginationParams` in `apps/api/src/controllers/helpers/pagination.ts`), so a full page of 60
means more may follow: `fullPageHasMore(resources.length)` from plan 30. Count the **raw**
resources; `queueResourceToHomeRow` can drop a resource, which must not end paging early.

This screen already has careful concurrency, and paging has to fit inside it:

- `historyRequestIdRef` is advanced by a medium chip change (`handleMediumChange`), by the focus
  effect when the active medium differs, by each `loadHistory`, and by a successful queue action in
  `handleQueuePress` (which also drops that row on the spot).
- `loadHistory` re-runs whenever `queueDataRevision` moves. When the medium is unchanged it is a
  **soft reload** (`isSoftReload`): rows stay on screen and a failure is silent.

## Decision: a soft reload keeps the depth

A soft reload re-reads pages 1 through the number of pages already merged, in order, and replaces
the rows once they all land. Re-reading page 1 alone would cut a deep list back to 60 rows after
every queue action taken from this screen (each one bumps the revision), which throws the reader's
place away. `getHistoryPage` serves fresh pages from its cache, so the extra reads are mostly local.
A medium change or first load still reads page 1 only.

## Changes

### 1. New `apps/mobile/src/screens/library/historyPages.ts` (pure)

```ts
export type HistoryPagesRead = {
  hasMore: boolean;
  pagesRead: number;
  resources: DTOQueueResource[];
};

export const readHistoryPages = async (
  fetchPage: (page: number) => Promise<DTOQueueResource[]>,
  pageCount: number
): Promise<HistoryPagesRead>
```

- Reads page 1, 2, … up to `Math.max(1, pageCount)`, one after another (never in parallel).
- Stops early after a page where `fullPageHasMore(page.length)` is false.
- `resources` is every page joined with
  `appendUniqueBy(current, page, (resource) => String(resource.id))`. `queueResourceToHomeRow`
  builds the row id from `resource.id` (`${idPrefix}-${resource.id}`), so this matches the list
  key. `pagesRead` is the last page read. `hasMore` is `fullPageHasMore` of the last page read.
- Errors propagate; the caller decides.

`import type { DTOQueueResource } from '@podverse/helpers/dto';` (the same source
`useQueueResources.ts` uses). No React Native imports, so Vitest can load it.

### 2. `LibraryHistoryScreen.tsx`

New state and refs beside `historyRequestIdRef`:

- `const [hasMore, setHasMore] = useState<boolean>(false);`
- `const [isLoadingMore, setIsLoadingMore] = useState<boolean>(false);`
- `const [loadMoreErrorKey, setLoadMoreErrorKey] = useState<string | null>(null);`
- `const loadedPageCountRef = useRef<number>(0);` — pages merged into `historyRows`.
- `const historyQueueIdTextRef = useRef<string | null>(null);` — the queue those pages came from.

Reset paging wherever rows are cleared for a new medium: in `handleMediumChange` and in the focus
effect's `previousMedium !== nextMedium` branch, add `loadedPageCountRef.current = 0`,
`historyQueueIdTextRef.current = null`, `setHasMore(false)`, `setIsLoadingMore(false)`,
`setLoadMoreErrorKey(null)`.

`loadHistory`:

- After the request id is advanced: `setIsLoadingMore(false)` and `setLoadMoreErrorKey(null)`.
  Any next page in flight is now stale and skips its own cleanup.
- The signed-out, `mediumId === null`, and `selectedQueue === null` branches also reset paging
  (`loadedPageCountRef.current = 0`, `historyQueueIdTextRef.current = null`, `setHasMore(false)`).
- Replace the single `fetchHistoryPage(selectedQueue.id_text, FIRST_PAGE)` call with:

  ```ts
  const pageCount =
    isSoftReload && historyQueueIdTextRef.current === selectedQueue.id_text
      ? loadedPageCountRef.current
      : FIRST_PAGE;
  const read = await readHistoryPages(
    async (page) => fetchHistoryPage(selectedQueue.id_text, page),
    pageCount
  );
  ```

  After the existing `isCurrent()` check, map `read.resources` with the existing `flatMap`, then
  set `loadedPageCountRef.current = read.pagesRead`,
  `historyQueueIdTextRef.current = selectedQueue.id_text`, and `setHasMore(read.hasMore)`.
- The `catch` keeps its current behavior; on a non-soft failure also `setHasMore(false)`.

New `loadNextHistoryPage` (`useCallback` on `[fetchHistoryPage, status]`):

1. Return when `status !== 'authenticated'` or `historyQueueIdTextRef.current === null`.
2. Capture `requestId = historyRequestIdRef.current`, `queueIdText = historyQueueIdTextRef.current`,
   `nextPage = loadedPageCountRef.current + 1`. Do not advance the request id.
3. `setIsLoadingMore(true); setLoadMoreErrorKey(null);`
4. `const resources = await fetchHistoryPage(queueIdText, nextPage);`
5. When `historyRequestIdRef.current !== requestId`, return without touching state (a queue action,
   medium change, or reload superseded this page; whichever did it already cleared the spinner).
6. Success: map with the same `queueResourceToHomeRow(resource, 'history')` `flatMap`, then
   `setHistoryRows((rows) => appendUniqueBy(rows, mapped, historyRowKeyExtractor))`,
   `loadedPageCountRef.current = nextPage`, `setHasMore(fullPageHasMore(resources.length))`.
7. Failure (when still current): `setLoadMoreErrorKey('errors.generic')`.
8. `finally`: `setIsLoadingMore(false)` when the request id still matches.

Note on `handleQueuePress`: it advances `historyRequestIdRef` to drop one row, which also drops a
next page in flight. Add `setIsLoadingMore(false)` beside its `historyRequestIdRef.current += 1`
so the footer spinner clears; the revision refetch that follows re-reads every merged page.

Wiring:

```ts
const handleEndReached = useLoadMoreOnEndReached({
  canLoadMore:
    status === 'authenticated' &&
    historyFill === 'ready' &&
    canLoadNextPage({
      hasError: errorKey !== null || loadMoreErrorKey !== null,
      hasMore,
      isLoading: isInitialLoading,
      isLoadingMore,
    }),
  loadMore: loadNextHistoryPage,
});
const handleRetryNextPage = useCallback(() => {
  void loadNextHistoryPage();
}, [loadNextHistoryPage]);
```

Place `handleEndReached` after `historyFill` is computed.

`listFooter`: in a fragment, `isLoadingMore` → `<ListLoading testID="library-history-loading-more" />`,
else `loadMoreErrorKey !== null` →
`<ListError messageKey={loadMoreErrorKey} onRetry={handleRetryNextPage} testID="library-history-load-more-error" />`,
then the existing playback notice. Update its dependencies.

`FillList`: add `onEndReached={handleEndReached}` and
`onEndReachedThreshold={LIST_END_REACHED_THRESHOLD}`.

Imports (relative from `screens/library/`): `ListLoading` from
`'../../components/state/ListLoading'`; `appendUniqueBy`, `canLoadNextPage`, `fullPageHasMore`,
and `LIST_END_REACHED_THRESHOLD` from `'../../lib/pagination/pagedList'`;
`useLoadMoreOnEndReached` from `'../../hooks/useLoadMoreOnEndReached'`; `readHistoryPages` from
`'./historyPages'`.

## Files

apps/mobile/src/screens/library/historyPages.ts
apps/mobile/src/screens/library/historyPages.test.ts
apps/mobile/src/screens/library/LibraryHistoryScreen.tsx

## Tests

New `apps/mobile/src/screens/library/historyPages.test.ts` (Vitest, a fake `fetchPage` that
records the pages asked for):

- `pageCount` 1 reads page 1 only; a full page reports `hasMore: true`.
- `pageCount` 3 with three full pages reads 1, 2, 3 in order and joins them.
- `pageCount` 3 where page 2 is short stops after page 2 with `hasMore: false` and `pagesRead: 2`.
- `pageCount` 0 still reads page 1.
- A resource repeated across pages appears once, at its first position.
- A rejected page rejects the whole read.

`apps/mobile/e2e/history-screen.yaml` must keep passing; its seed history is shorter than 60 rows.

## Release scratchpad

## Mobile History loads more as you scroll

- Surfaces: mobile
- Change: History in the Library used to show only the 60 most recent plays. It now loads older
  plays when you scroll near the bottom, with a loading row while it reads and a Retry row if a
  page fails. Adding a history row back to the queue, or a listen syncing in the background, no
  longer resets a long scrolled list to the first 60 rows.
- Who notices: signed-in users with a long play history on the mobile app
- Operator steps: none
