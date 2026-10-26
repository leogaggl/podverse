**Cursor model:** Cursor Grok 4.7 · **Reasoning:** high

# 33 — Mobile episode detail and full player Clips: load the next page near the bottom

## Rows

R4, R5

## Runs after

30

## Context

The Clips tab on episode detail and on the full player reads
`reqClipGetManyByItemPublic` page by page through
`apps/mobile/src/screens/episode/useEpisodeSectionPanes.ts` (`loadTab('clips')` for page 1,
`loadMoreClips` for the next). Both screens offer the next page only through a **Show more**
button:

- `apps/mobile/src/screens/episode/EpisodeDetailScreen.tsx` — `paneFooter`, branch
  `activeTab === 'clips' && clipHasMore` (`testID="episode-detail-clip-load-more"`); the list is
  the `<FillList ... ListFooterComponent={paneFooter}>` at the bottom of the component.
- `apps/mobile/src/screens/player/FullPlayerScreen.tsx` — `renderPaneFooter`, branch
  `body === null && activeTab === 'clips' && clipHasMore` (`testID="full-player-clip-load-more"`);
  the list is the inner `<FlatList ListFooterComponent={renderPaneFooter} ... nestedScrollEnabled>`.
  That list has a locked height inside the outer scroll view, so it scrolls on its own and
  `onEndReached` fires on it.

Two gaps in the hook today:

- A next-page failure sets `tabErrorKey`, which both footers render with the tab retry. That
  retry calls `loadTab`, which returns early because `loadedTabs.clips` is already true.
- `loadMoreClips` has no generation check. A sort change (`selectClipSort`) while a next page is
  in flight appends a page of the old sort to the new list. Its in-flight guard reads
  `isLoadingMoreClips` state, which two quick end-reached calls can both see as false.

## Changes

### 1. `useEpisodeSectionPanes.ts`

- New state `const [clipLoadMoreErrorKey, setClipLoadMoreErrorKey] = useState<string | null>(null);`
  added to `UseEpisodeSectionPanesResult` and returned.
- New refs: `const clipGenerationRef = useRef(0);` and `const isLoadingMoreClipsRef = useRef(false);`.
- Advance `clipGenerationRef.current += 1` in three places: the `itemIdText` reset effect (beside
  `clipPageRef.current = 0`), `selectClipSort` (beside `clipPageRef.current = 0`), and at the
  start of the `tab === 'clips'` branch in `loadTab`. Also `setClipLoadMoreErrorKey(null)` in the
  reset effect and in `selectClipSort`.
- `loadMoreClips`:
  - Replace the `isLoadingMoreClips` read in the guard with `isLoadingMoreClipsRef.current`, and
    drop `isLoadingMoreClips` from its dependency list.
  - Set `isLoadingMoreClipsRef.current = true` with `setIsLoadingMoreClips(true)`; clear both in
    `finally`.
  - Capture `const generation = clipGenerationRef.current;` before the request. After it, when
    `generation !== clipGenerationRef.current`, return without touching rows, page, has-more, or
    errors.
  - `setClipLoadMoreErrorKey(null)` before the request. In `catch`, set
    `setClipLoadMoreErrorKey('errors.generic')` instead of `setTabErrorKey`.

### 2. `EpisodeDetailScreen.tsx`

- Read `clipLoadMoreErrorKey` from the hook (beside `clipHasMore`).
- Delete `handleLoadMoreClipsPress`. Add:

  ```ts
  const handleClipsEndReached = useLoadMoreOnEndReached({
    canLoadMore:
      activeTab === 'clips' &&
      !offlineModeEnabled &&
      canLoadNextPage({
        hasError: tabErrorKey !== null || clipLoadMoreErrorKey !== null,
        hasMore: clipHasMore,
        isLoading: isTabLoading,
        isLoadingMore: isLoadingMoreClips,
      }),
    loadMore: handleLoadMoreClips,
  });
  const handleRetryClipsPage = useCallback(() => {
    void handleLoadMoreClips();
  }, [handleLoadMoreClips]);
  ```

- `paneFooter`: replace the `activeTab === 'clips' && clipHasMore` `Pressable` branch with two
  branches, in this order:
  - `activeTab === 'clips' && isLoadingMoreClips` → `<ListLoading testID="episode-detail-clip-loading-more" />`
  - `activeTab === 'clips' && clipLoadMoreErrorKey !== null` →
    `<ListError messageKey={clipLoadMoreErrorKey} onRetry={handleRetryClipsPage} testID="episode-detail-clip-load-more-error" />`
  Update the `useMemo` dependencies (drop `handleLoadMoreClipsPress`, `styles.loadMore`,
  `styles.loadMoreLabel`; add the new values).
- Delete the `loadMore` and `loadMoreLabel` entries from the screen's `StyleSheet` when nothing else
  reads them (`rg -n "styles.loadMore" EpisodeDetailScreen.tsx`). Drop `Pressable` from the
  `react-native` import only when no other use remains.
- `FillList`: add `onEndReached={activeTab === 'clips' ? handleClipsEndReached : undefined}` and
  `onEndReachedThreshold={LIST_END_REACHED_THRESHOLD}`.

### 3. `FullPlayerScreen.tsx`

- Read `clipLoadMoreErrorKey` from the hook (beside `clipHasMore`).
- Add `handleClipsEndReached` the same way as step 2, with `loadMore: loadMoreClips` and the same
  `canLoadMore`, plus `addByRssPaneState === null` in the condition so Add by RSS panes never page.
  Add `handleRetryClipsPage` calling `void loadMoreClips()`.
- `renderPaneFooter`: replace the `body === null && activeTab === 'clips' && clipHasMore` branch
  with:
  - `body === null && activeTab === 'clips' && isLoadingMoreClips` → the same
    `<View style={styles.pane}><View style={styles.column}>` wrapper around
    `<ListLoading testID="full-player-clip-loading-more" />`
  - `body === null && activeTab === 'clips' && clipLoadMoreErrorKey !== null` →
    `<View style={styles.paneError}>` around
    `<ListError messageKey={clipLoadMoreErrorKey} onRetry={handleRetryClipsPage} testID="full-player-clip-load-more-error" />`
  Update its dependency list. Delete `loadMore` / `loadMoreLabel` styles and the `Pressable`
  import only when nothing else uses them.
- Inner pane `FlatList`: add `onEndReached={activeTab === 'clips' ? handleClipsEndReached : undefined}`
  and `onEndReachedThreshold={LIST_END_REACHED_THRESHOLD}`.

Imports (relative from `screens/episode/` and `screens/player/`): `ListLoading` from
`'../../components/state/ListLoading'` where not already imported; `canLoadNextPage` and
`LIST_END_REACHED_THRESHOLD` from `'../../lib/pagination/pagedList'`; `useLoadMoreOnEndReached`
from `'../../hooks/useLoadMoreOnEndReached'`.

## Files

apps/mobile/src/screens/episode/useEpisodeSectionPanes.ts
apps/mobile/src/screens/episode/EpisodeDetailScreen.tsx
apps/mobile/src/screens/player/FullPlayerScreen.tsx

## Tests

No new unit test: this is wiring over plan 30's tested helpers. `apps/mobile/e2e/podcast-episode.yaml`
and `apps/mobile/e2e/player-screen.yaml` must keep passing; neither taps a `*-clip-load-more`
testID (`rg -n clip-load-more apps/mobile/e2e` returns nothing).

## Release scratchpad

## Mobile episode and full player Clips load more as you scroll

- Surfaces: mobile
- Change: the Clips tab on an episode's screen and on the full player now loads the next page of
  clips when you scroll near the bottom, replacing the Show more button. A failed page shows Retry
  under the clips already loaded, and Retry now reloads that page (before, retry after a failed
  Show more did nothing). Changing the clip sort while a page is loading no longer mixes in clips
  from the old sort.
- Who notices: anyone reading clips on a well-clipped episode in the mobile app
- Operator steps: none
