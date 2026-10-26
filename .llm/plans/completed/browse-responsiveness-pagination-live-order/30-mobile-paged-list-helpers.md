**Cursor model:** Cursor Grok 4.7 · **Reasoning:** medium

# 30 — Mobile paged-list helpers (has-more, append, end-reached guard)

## Rows

R4, R5

## Runs after

none

## Screen audit (R5)

Every mobile list that reads a paginated endpoint, and what this set does with it:

| Screen | Today | Plan |
| --- | --- | --- |
| Browse, every chip | page 1 only | 31 |
| Podcast Episodes, Clips, Official Clips | Show more button | 32 |
| Episode detail Clips tab, full player Clips tab | Show more button | 33 |
| Notifications inbox | Show more button | 34 |
| Library My Clips | page 1 only | 35 |
| Add to Playlist sheet | page 1 only | 35 |
| Library History | page 1 only | 36 |
| Album Tracks | page 1 only | 37 |
| Home Clips, Home Livestreams | stored page 1 only | 38 |
| Library Playlists, Playlist detail | already loads near the bottom | none |
| Taste Profile lists | Load More button | none (see below) |
| Profile podcasts, albums, playlists, clips | page 1 of each, stacked | none (see below) |

Not paginated, so out of scope: Search (Podcast Index), Recommendations, Removed Content, a
channel's livestreams, an artist's remote items, the queue's upcoming list (one request for all).
Home Podcasts, Episodes, Artists, Albums, and Tracks read device tables that hold the whole
subscribed set. Add by RSS sections read device storage.

Kept as they are:

- **Taste Profile** (`screens/more/TasteProfileSections.tsx`): two lists rendered with `.map`
  inside accordions in one scroll view. Neither is a virtualized list, so there is no end of a list
  to detect; the Load More button per list stays.
- **Profile** (`screens/profile/ProfileContentSections.tsx`): four stacked sections in one
  `SectionList`. Only the last section touches the bottom, so end-reached loading would page one
  section and never the others. Paging all four needs a per-type selector like web's profile tabs,
  which is a layout change Phase 2 takes from the operator.

## Context

Every mobile list that pages today writes its own has-more rule, its own append, and its own
guard against loading the same page twice. Plans 31–38 add loading near the bottom to every list
in the audit above. This plan adds the shared pieces they all use, so the rules are written once.

What exists to reuse:

- `getTotalPages` and `PAGINATION` (`DEFAULT_LIMIT` is 60) in
  `packages/helpers/src/lib/pagination.ts`, exported to mobile through the subpath
  `@podverse/helpers/pagination`. Mobile must not import the `@podverse/helpers` barrel in new
  code; use the subpath.
- `sectionResponseHasMore` in
  `apps/mobile/src/screens/podcast/sections/sectionResponseHasMore.ts`. It is the right rule
  (a null `meta.count` with a full page means more, a short page means the end) but it lives under
  the podcast screen. This plan moves it to `lib/` under a general name.
- The append in `LibraryPlaylistsScreen.tsx` (`loadPlaylistsPage`, Map keyed by `id_text`: a later
  copy replaces the value, the first position is kept). The new `appendUniqueBy` keeps that exact
  behavior.
- The end-reached props in `LibraryPlaylistsScreen.tsx` and `PlaylistDetailScreen.tsx`
  (`onEndReached` + `onEndReachedThreshold`). Those two screens already page and are not changed by
  this set.

## Changes

### 1. New `apps/mobile/src/lib/pagination/pagedList.ts`

Named exports only. Import `getTotalPages` and `PAGINATION` from `@podverse/helpers/pagination`
(the subpath form mobile already uses for `@podverse/helpers/medium`, `/dto`, and others).
`sectionResponseHasMore.ts` imports `getTotalPages` from the `@podverse/helpers` barrel today; the
moved code uses the subpath.

- `LIST_END_REACHED_THRESHOLD = 0.5` — the `onEndReachedThreshold` every list in this set passes.
- `listResponseHasMore(meta: { count: number | null; limit: number; page: number }, pageRowCount: number): boolean`
  — body and doc comment moved unchanged from `sectionResponseHasMore`
  (`getTotalPages(meta.count, meta.limit, pageRowCount, meta.page) > meta.page`).
- `fullPageHasMore(pageRowCount: number, limit: number = PAGINATION.DEFAULT_LIMIT): boolean` —
  `pageRowCount >= limit`. For repository calls that return only an array (no `meta`).
- `appendUniqueBy<T>(current: readonly T[], next: readonly T[], keyOf: (row: T) => string): T[]` —
  insert `current` then `next` into a `Map` keyed by `keyOf`, return `[...map.values()]`. A key
  already present keeps its first position and takes the later value.
- `canLoadNextPage(state: { hasError: boolean; hasMore: boolean; isLoading: boolean; isLoadingMore: boolean }): boolean`
  — `hasMore && !isLoading && !isLoadingMore && !hasError`. `isLoading` covers initial load and
  pull-to-refresh; each screen passes whichever of its flags mean "a page-1 load is running."

### 2. New `apps/mobile/src/hooks/useLoadMoreOnEndReached.ts`

```ts
export function useLoadMoreOnEndReached(options: {
  canLoadMore: boolean;
  loadMore: () => Promise<void> | void;
}): () => void;
```

- Store `canLoadMore` and `loadMore` in refs updated every render.
- Return a `useCallback` with an empty dependency list (a stable identity, so passing it to
  `FlatList` does not re-render rows; see **mobile-row-render-cost**).
- The callback returns at once when `canLoadMoreRef.current` is false or `inFlightRef.current` is
  true. Otherwise it sets `inFlightRef.current = true`, calls `loadMore()`, and clears the flag in
  `Promise.resolve(result).finally(...)`. This covers `FlatList` firing `onEndReached` twice
  before React commits the screen's `isLoadingMore` state.
- No logging; the screen's `loadMore` owns its errors.

### 3. Retire `sectionResponseHasMore`

Delete `apps/mobile/src/screens/podcast/sections/sectionResponseHasMore.ts` and call
`listResponseHasMore` through a relative import of `lib/pagination/pagedList` (mobile `src/` uses
relative paths, e.g. `'../../../lib/rows/homeRowMappers'` in `PodcastClipsSection.tsx`) at each
current call site:

- `apps/mobile/src/screens/podcast/sections/PodcastClipsSection.tsx`
- `apps/mobile/src/screens/podcast/sections/PodcastOfficialClipsSection.tsx`
- `apps/mobile/src/screens/episode/episodeSectionPaneLoaders.ts`
- `apps/mobile/src/screens/podcast/sections/usePodcastSectionRows.ts` — drop its re-export of
  `sectionResponseHasMore`.
- `apps/mobile/src/screens/podcast/sections/index.ts` — drop `sectionResponseHasMore` from the
  `./usePodcastSectionRows` export list.

Run `rg -n sectionResponseHasMore apps/mobile` after; it must return nothing. No test file
imports it today.

### Footer chrome the later plans use

No new component. Plans 31–38 render the existing `ListLoading`
(`apps/mobile/src/components/state/ListLoading.tsx`, with a `testID`) while the next page loads,
and the existing `ListError` (`components/state/ListError.tsx`) with `onRetry` when a next page
fails while rows are on screen. Rows already shown stay.

## Files

apps/mobile/src/lib/pagination/pagedList.ts
apps/mobile/src/lib/pagination/pagedList.test.ts
apps/mobile/src/hooks/useLoadMoreOnEndReached.ts
apps/mobile/src/screens/podcast/sections/sectionResponseHasMore.ts
apps/mobile/src/screens/podcast/sections/PodcastClipsSection.tsx
apps/mobile/src/screens/podcast/sections/PodcastOfficialClipsSection.tsx
apps/mobile/src/screens/podcast/sections/usePodcastSectionRows.ts
apps/mobile/src/screens/podcast/sections/index.ts
apps/mobile/src/screens/episode/episodeSectionPaneLoaders.ts

## Tests

New `apps/mobile/src/lib/pagination/pagedList.test.ts` (Vitest, pure functions; mobile has no
hook-render tests, so the hook stays untested and thin):

- `listResponseHasMore`: a full page with null count has more; a short page with null count does
  not; a known count past the current page has more; a known count on the last page does not.
- `fullPageHasMore`: 60 rows has more, 59 does not, a custom limit is honored.
- `appendUniqueBy`: new keys append in order; a repeated key keeps its first position and the
  later value.
- `canLoadNextPage`: true only when `hasMore` and nothing is loading or failed.
## Release scratchpad

none
