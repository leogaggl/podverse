**Cursor model:** Cursor Grok 4.7 · **Reasoning:** high

# 35 — Mobile My Clips and the Add to Playlist sheet: load the next page near the bottom

## Rows

R4, R5

## Runs after

30

## Context

Two lists read page 1 of a paginated endpoint and stop there:

- `apps/mobile/src/screens/library/LibraryMyClipsScreen.tsx` — `loadClips` calls
  `reqMyProfileClipsRecent({ page: FIRST_PAGE })` on every focus and sets `clips`. The list is the
  `<FillList ... data={clips} keyExtractor={myClipKeyExtractor}>` (keys by `clip.id_text`).
- `apps/mobile/src/screens/library/useAddToPlaylist.tsx` — `loadPlaylists` calls
  `playlistRepository.listOwned(authArgs, { medium, page: FIRST_PAGE, range: null, sort: 'a_z' }, { refresh: true })`.
  The sheet's `<FlatList data={playlists} ... style={styles.optionsScroll}>` (max height 320)
  scrolls on its own. A user with more than 60 playlists for a medium cannot reach the rest.

Both responses are `ApiListResponse` with `meta`, so has-more is
`listResponseHasMore(response.meta, response.data.length)` (plan 30).

The reuse source is `LibraryPlaylistsScreen.tsx` (`loadPlaylistsPage` with `append`, Map dedupe,
`handleLoadMore` guards, `onEndReached`). That screen is not changed.

## Changes

### 1. `LibraryMyClipsScreen.tsx`

New state and refs beside `const [clips, setClips]`:

- `const [hasMore, setHasMore] = useState<boolean>(false);`
- `const [isLoadingMore, setIsLoadingMore] = useState<boolean>(false);`
- `const [loadMoreErrorKey, setLoadMoreErrorKey] = useState<string | null>(null);`
- `const pageRef = useRef<number>(FIRST_PAGE);`
- `const generationRef = useRef<number>(0);`

`loadClips` (page 1):

- At the start, `generationRef.current += 1` and capture it. `setLoadMoreErrorKey(null)` and
  `setIsLoadingMore(false)`; a next page still in flight is now stale and skips its own cleanup.
- Signed-out branch also does `setHasMore(false)`.
- On success, when the generation still matches: `setClips(response.data)`,
  `setHasMore(listResponseHasMore(response.meta, response.data.length))`,
  `pageRef.current = FIRST_PAGE`.
- On failure, when it matches: the existing error handling plus `setHasMore(false)`.
- Only the matching generation clears `isLoading` in `finally`.

New `loadNextClipsPage` (`useCallback`, same dependencies as `loadClips`):

1. Return when `status !== 'authenticated'`.
2. Capture `generation = generationRef.current` and `nextPage = pageRef.current + 1`.
3. `setIsLoadingMore(true); setLoadMoreErrorKey(null);`
4. `reqMyProfileClipsRecent({ page: nextPage })` through the same `requestWithMobileAuthRefresh`
   call `loadClips` uses.
5. Drop the result when the generation changed.
6. Success: `setClips((current) => appendUniqueBy(current, response.data, myClipKeyExtractor))`,
   `pageRef.current = nextPage`, `setHasMore(listResponseHasMore(response.meta, response.data.length))`.
7. Failure: `setLoadMoreErrorKey('errors.generic')`.
8. `finally`: `setIsLoadingMore(false)` when the generation still matches.

Wiring:

```ts
const handleEndReached = useLoadMoreOnEndReached({
  canLoadMore:
    status === 'authenticated' &&
    canLoadNextPage({
      hasError: errorKey !== null || loadMoreErrorKey !== null,
      hasMore,
      isLoading,
      isLoadingMore,
    }),
  loadMore: loadNextClipsPage,
});
const handleRetryNextPage = useCallback(() => {
  void loadNextClipsPage();
}, [loadNextClipsPage]);
```

`listFooter`: render, in a fragment, `isLoadingMore` → `<ListLoading testID="library-my-clips-loading-more" />`,
else `loadMoreErrorKey !== null` →
`<ListError messageKey={loadMoreErrorKey} onRetry={handleRetryNextPage} testID="library-my-clips-load-more-error" />`,
then the existing playback notice.

`FillList`: add `onEndReached={handleEndReached}` and
`onEndReachedThreshold={LIST_END_REACHED_THRESHOLD}`.

A focus reload reads page 1 again and drops later pages, the same as Library Playlists on focus.

### 2. `useAddToPlaylist.tsx`

New state and refs beside `const [playlists, setPlaylists]`:

- `const [hasMore, setHasMore] = useState<boolean>(false);`
- `const [isLoadingMore, setIsLoadingMore] = useState<boolean>(false);`
- `const [hasLoadMoreError, setHasLoadMoreError] = useState<boolean>(false);`
- `const pageRef = useRef<number>(FIRST_PAGE);`
- `const generationRef = useRef<number>(0);`

Keep `noticeKey` for its current uses (page 1 error and add results). A failed next page uses
`hasLoadMoreError` so it never overwrites an "added to playlist" notice.

- `requestAddToPlaylist` and `closeSheet`: `generationRef.current += 1`, `setHasMore(false)`,
  `setIsLoadingMore(false)`, `setHasLoadMoreError(false)`, `pageRef.current = FIRST_PAGE`.
- `loadPlaylists`: capture `generationRef.current` at the start (its only caller,
  `requestAddToPlaylist`, has just advanced it); on success, when it still
  matches, `setPlaylists(response.data)` and
  `setHasMore(listResponseHasMore(response.meta, response.data.length))`. Drop results (including
  errors and `setIsLoading(false)`) for an older generation.
- New `loadNextPlaylistsPage` (`useCallback` on `[authArgs, target]`): return when
  `target === null`; capture generation and `nextPage = pageRef.current + 1`; `setIsLoadingMore(true)`,
  `setHasLoadMoreError(false)`; call `playlistRepository.listOwned` with the same params as
  `loadPlaylists` but `page: nextPage` and the same `{ refresh: true }`; drop for an older
  generation; on success append with `appendUniqueBy(current, response.data, (playlist) => playlist.id_text)`,
  set `pageRef.current` and `hasMore`; on failure `setHasLoadMoreError(true)`; clear
  `isLoadingMore` in `finally` when the generation matches.
- `handleEndReached = useLoadMoreOnEndReached({ canLoadMore: target !== null && canLoadNextPage({ hasError: hasLoadMoreError, hasMore, isLoading, isLoadingMore }), loadMore: loadNextPlaylistsPage })`.
- On the sheet `FlatList`, add `onEndReached={handleEndReached}`,
  `onEndReachedThreshold={LIST_END_REACHED_THRESHOLD}`, and a `ListFooterComponent`:
  `isLoadingMore` → `<ListLoading testID="add-to-playlist-loading-more" />`, else
  `hasLoadMoreError` →
  `<ListError messageKey="errors.generic" onRetry={() => { void loadNextPlaylistsPage(); }} testID="add-to-playlist-load-more-error" />`,
  else `null`. Memoize the footer with `useMemo` so the list does not see a new element each render.

Imports (relative from `screens/library/`): `ListLoading` from
`'../../components/state/ListLoading'`, `ListError` from `'../../components/state/ListError'`
where not imported, `appendUniqueBy`, `canLoadNextPage`, `LIST_END_REACHED_THRESHOLD`, and
`listResponseHasMore` from `'../../lib/pagination/pagedList'`, `useLoadMoreOnEndReached` from
`'../../hooks/useLoadMoreOnEndReached'`. Add `useRef` to the React imports.

## Files

apps/mobile/src/screens/library/LibraryMyClipsScreen.tsx
apps/mobile/src/screens/library/useAddToPlaylist.tsx

## Tests

No new unit test: wiring over plan 30's tested helpers. `apps/mobile/e2e/library-playlists.yaml`
(opens the Add to Playlist sheet) and `apps/mobile/e2e/make-clip.yaml` must keep passing; the E2E
seed holds fewer than 60 rows, so neither list asks for page 2.

## Release scratchpad

## Mobile My Clips and Add to Playlist load more as you scroll

- Surfaces: mobile
- Change: My Clips in the Library and the playlist picker in the Add to Playlist sheet used to show
  only the first 60 entries. Both now load the next page when you scroll near the bottom, with a
  loading row while it reads and a Retry row if the page fails.
- Who notices: signed-in users with more than 60 clips, or more than 60 playlists for one medium
- Operator steps: none
