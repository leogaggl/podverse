**Cursor model:** Cursor Grok 4.7 · **Reasoning:** high

# 32 — Mobile podcast sections: load the next page near the bottom

## Rows

R4, R5, R16

## Runs after

30

Plan 30 edits `PodcastClipsSection.tsx`, `PodcastOfficialClipsSection.tsx`, and
`usePodcastSectionRows.ts` (the `sectionResponseHasMore` swap). This plan edits the same files
afterwards.

## Context

The podcast screen's Episodes, Clips, and Official Clips sections page, but only through a
**Show more** button in the footer of
`apps/mobile/src/screens/podcast/sections/PodcastSectionList.tsx`
(`<Pressable ... testID={`${prefix}-load-more`}>`). Scrolling to the bottom does nothing.

Who passes `onLoadMore` to `PodcastSectionList` today:

- `PodcastEpisodesSection.tsx` — `handleLoadMore` → `loadMoreEpisodes` →
  `extendDirectoryChannelOrDropGone` (deepens the stored episode window). Has a title filter
  (`filterTerm`).
- `PodcastClipsSection.tsx` — `loadMore` from `usePodcastSectionRows`. No title filter.
- `PodcastOfficialClipsSection.tsx` — `loadMore` from `usePodcastSectionRows`. Has a title filter.

`PodcastDownloadedSection`, `PodcastPodrollSection`, and the Add by RSS sections use the same list
without `onLoadMore`; they are not changed.

## Decision: a typed filter keeps the button

The title filter runs on the device over loaded rows. While a filter term is typed, a list that
matches few rows is short, so `onEndReached` would fire at once and keep loading pages until the
feed ends. While the filter term is non-empty, the section does not auto-load and the
**Show more** button stays, but only while the feed still has another page (`hasMore`); once the
feed is fully loaded the button is hidden. With no filter term, the button is replaced by
end-reached loading.

## Changes

### 1. `PodcastSectionList.tsx`

- Prop type: `onLoadMore?: () => Promise<void> | void;`
- New prop, documented in the props type:
  `/** Load the next page on reaching the bottom. When false, a Show more button is offered instead. */ autoLoadMore?: boolean;`
  Default `true` in the destructure.
- Inside the component:

  ```ts
  const canLoadMore = isSettled && hasMore && onLoadMore !== undefined;
  const handleEndReached = useLoadMoreOnEndReached({
    canLoadMore:
      autoLoadMore &&
      canLoadMore &&
      canLoadNextPage({
        hasError: errorKey !== null,
        hasMore,
        isLoading: isInitialLoading || isRefreshing,
        isLoadingMore,
      }),
    loadMore: onLoadMore ?? noopLoadMore,
  });
  ```

  with a module-level `const noopLoadMore = (): void => {};`.
- `FillList`: add `onEndReached={autoLoadMore && onLoadMore !== undefined ? handleEndReached : undefined}`
  and `onEndReachedThreshold={LIST_END_REACHED_THRESHOLD}`.
- Footer, replacing the current `isSettled && hasMore && onLoadMore !== undefined` block:
  - `canLoadMore && autoLoadMore && isLoadingMore` → `<ListLoading testID={`${prefix}-loading-more`} />`
  - `canLoadMore && !autoLoadMore` → the existing `Pressable` unchanged (same label logic, same
    `testID={`${prefix}-load-more`}`, same `isLoadingMore` guard), calling `void onLoadMore()`.
  - The existing footer `ListError` and notice stay as they are.
- Update the component doc comment: the list reaches further on its own when scrolled to the
  bottom, and offers a button while a filter is narrowing it.

Imports: `ListLoading` from `'../../../components/state/ListLoading'`; `canLoadNextPage` and
`LIST_END_REACHED_THRESHOLD` from `'../../../lib/pagination/pagedList'`; `useLoadMoreOnEndReached`
from `'../../../hooks/useLoadMoreOnEndReached'`.

### 2. `usePodcastSectionRows.ts`

- `PodcastSectionRows<TRow>['loadMore']` becomes `() => Promise<void>`, and the returned
  `loadMore` is the inner `loadMore` itself (not a `void` wrapper), so the end-reached hook can see
  when it settles.
- Add `const generationRef = useRef<number>(0);`. `loadFirstPage` does `generationRef.current += 1`
  at its start and captures the value; it only sets rows, `hasMore`, `errorKey`, and loading flags
  when the generation still matches.
- `loadMore` captures `generationRef.current` before the request and, when it no longer matches,
  drops the result: no rows, `hasMore`, page, or `setErrorKey`. This keeps a page 2 read for the
  old sort or channel from landing after the section restarted at page 1.
- Add `const isLoadingMoreRef = useRef<boolean>(false);`. `loadMore` returns at once when it is
  true, sets it true before the request, and in `finally` clears both the ref and
  `setIsLoadingMore(false)` whatever the generation, so a dropped page never leaves the footer
  spinner on.
- Add `const failedLoadRef = useRef<'first' | 'more' | null>(null);`. Set `'first'` in
  `loadFirstPage`'s `catch`, `'more'` in `loadMore`'s `catch`, and `null` on either success.
  `retry` becomes: when `failedLoadRef.current === 'more'`, `setErrorKey(null)` and
  `void loadMore()`; otherwise `void loadFirstPage(false)`. A failed next page is then retried in
  place instead of reloading the section from page 1.

### 3. `PodcastEpisodesSection.tsx`

- `handleLoadMore` returns the promise: `const handleLoadMore = useCallback(() => loadMoreEpisodes(), [loadMoreEpisodes]);`
- Add `const isLoadingMoreRef = useRef<boolean>(false);` and guard `loadMoreEpisodes` with it the
  same way as step 2 (return when set; set before; clear in `finally`).
- On `<PodcastSectionList`, pass `autoLoadMore={filterTerm.trim().length === 0}`.

### 4. `PodcastOfficialClipsSection.tsx`

On `<PodcastSectionList`, pass `autoLoadMore={filterTerm.trim().length === 0}`. `onLoadMore={loadMore}`
now passes the promise-returning function from step 2.

### 5. `PodcastClipsSection.tsx`

No prop change (no filter, so the default `autoLoadMore` is right). It already passes
`onLoadMore={loadMore}`; confirm it type-checks with the new signature.

## Files

apps/mobile/src/screens/podcast/sections/PodcastSectionList.tsx
apps/mobile/src/screens/podcast/sections/usePodcastSectionRows.ts
apps/mobile/src/screens/podcast/sections/PodcastEpisodesSection.tsx
apps/mobile/src/screens/podcast/sections/PodcastOfficialClipsSection.tsx
apps/mobile/src/screens/podcast/sections/PodcastClipsSection.tsx

## Tests

No new unit test: the paging rules live in plan 30's tested helpers, and this plan is wiring.
`apps/mobile/e2e/podcast-episode.yaml` and `apps/mobile/e2e/add-by-rss-episode-sections.yaml` must
keep passing. No Maestro flow taps a `*-load-more` testID today (checked with
`rg -n load-more apps/mobile/e2e`), so removing the button in the unfiltered state breaks no flow.

## Release scratchpad

## Mobile podcast Episodes, Clips, and Official Clips load more as you scroll

- Surfaces: mobile
- Change: on a podcast's screen, the Episodes, Clips, and Official Clips sections now load their
  next page when you scroll near the bottom, with a loading row while it reads. The Show more button
  is gone, except while a title filter is typed: then the section keeps the button so a narrow
  filter does not pull the whole feed. A failed next page shows Retry under the rows and retries that
  page instead of reloading the section.
- Who notices: anyone scrolling a long podcast on the mobile app
- Operator steps: none
