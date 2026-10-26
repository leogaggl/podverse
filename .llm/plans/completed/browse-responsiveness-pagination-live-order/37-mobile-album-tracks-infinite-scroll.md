**Cursor model:** Cursor Grok 4.7 · **Reasoning:** high

# 37 — Mobile album Tracks: load the next page near the bottom

## Rows

R4, R5

## Runs after

30

## Context

`apps/mobile/src/screens/album/AlbumDetailScreen.tsx` reads one page of tracks. `loadTracks`
calls `reqItemGetManyByChannelBySeason({ idOrIdText: albumId, page: FIRST_PAGE, range: sort === 'top' ? range : null, sort })`,
puts the channel's live items first (`reqLiveItemGetManyByChannel`), joins them with
`removeDuplicateItems`, and maps them with `toTrackRows`. The list is `tracksBody`
(`<FillList ... testID="album-detail-track-list">`) with no `onEndReached`. An album or a
music channel with more than 60 tracks stops at 60.

Offline mode reads stored tracks (`readStoredTracks`) and has no next page.

`toTrackRows` maps item by item (no running numbers), so an appended page can be mapped by
re-mapping the joined item list.

## Changes

All in `AlbumDetailScreen.tsx`.

### 1. State and refs

Beside `const [trackRows, setTrackRows]`:

- `const [tracksHasMore, setTracksHasMore] = useState<boolean>(false);`
- `const [isTracksLoadingMore, setIsTracksLoadingMore] = useState<boolean>(false);`
- `const [tracksLoadMoreErrorKey, setTracksLoadMoreErrorKey] = useState<string | null>(null);`
- `const trackItemsRef = useRef<DTOItem[]>([]);` — the joined items behind `trackRows`.
- `const tracksPageRef = useRef<number>(FIRST_PAGE);`
- `const tracksGenerationRef = useRef<number>(0);`

### 2. `loadTracks` (page 1)

- At the start: `tracksGenerationRef.current += 1`, capture it as `generation`,
  `setIsTracksLoadingMore(false)`, `setTracksLoadMoreErrorKey(null)`.
- Offline branch: when `generation` still matches, set `trackItemsRef.current = storedItems` and
  `setTracksHasMore(false)` beside the existing sets.
- Online: after building `merged`, when `generation` still matches:
  `trackItemsRef.current = merged`, `tracksPageRef.current = FIRST_PAGE`,
  `setTracksHasMore(listResponseHasMore(seasonResponse.meta, seasonResponse.data.length))`,
  then the existing `setTrackRows` / `setTracksById`. Count the season response only; live items
  are not paged.
- `catch` and `finally`: act only when `generation` still matches. `catch` also clears
  `trackItemsRef.current = []` and `setTracksHasMore(false)`.

`loadTracks` re-runs on sort, range, album, and offline changes through its dependencies, so each
of those starts again at page 1 and drops any next page in flight.

### 3. New `loadNextTracksPage`

`useCallback` with `[albumId, authContext, offlineModeEnabled, range, sort]`:

1. Return when `offlineModeEnabled`.
2. Capture `generation = tracksGenerationRef.current` and `nextPage = tracksPageRef.current + 1`.
3. `setIsTracksLoadingMore(true); setTracksLoadMoreErrorKey(null);`
4. The same `reqItemGetManyByChannelBySeason` call as `loadTracks` with `page: nextPage`.
5. When `generation !== tracksGenerationRef.current`, return without touching state.
6. Success: `const joined = removeDuplicateItems([...trackItemsRef.current, ...response.data]);`
   `trackItemsRef.current = joined;` `tracksPageRef.current = nextPage;`
   `setTrackRows(toTrackRows(joined, albumId, channelTitleRef.current));`
   `setTracksById(new Map(joined.map((item) => [item.id_text, item])));`
   `setTracksHasMore(listResponseHasMore(response.meta, response.data.length));`
7. Failure: `setTracksLoadMoreErrorKey('errors.generic')`.
8. `finally`: `setIsTracksLoadingMore(false)` when the generation still matches.

### 4. Wiring

```ts
const handleTracksEndReached = useLoadMoreOnEndReached({
  canLoadMore:
    !offlineModeEnabled &&
    canLoadNextPage({
      hasError: trackErrorKey !== null || tracksLoadMoreErrorKey !== null,
      hasMore: tracksHasMore,
      isLoading: isTracksLoading || isTracksRefreshing,
      isLoadingMore: isTracksLoadingMore,
    }),
  loadMore: loadNextTracksPage,
});
const handleRetryTracksPage = useCallback(() => {
  void loadNextTracksPage();
}, [loadNextTracksPage]);
```

`tracksFooter`: in a fragment, `isTracksLoadingMore` →
`<ListLoading testID="album-detail-track-loading-more" />`, else
`tracksLoadMoreErrorKey !== null` →
`<ListError messageKey={tracksLoadMoreErrorKey} onRetry={handleRetryTracksPage} testID="album-detail-track-load-more-error" />`,
then the existing playback notice. Update its dependencies.

`tracksBody` `FillList`: add `onEndReached={handleTracksEndReached}` and
`onEndReachedThreshold={LIST_END_REACHED_THRESHOLD}`.

Imports (relative from `screens/album/`): `ListLoading` from
`'../../components/state/ListLoading'`; `canLoadNextPage`, `LIST_END_REACHED_THRESHOLD`, and
`listResponseHasMore` from `'../../lib/pagination/pagedList'`; `useLoadMoreOnEndReached` from
`'../../hooks/useLoadMoreOnEndReached'`.

## Files

apps/mobile/src/screens/album/AlbumDetailScreen.tsx

## Tests

No new unit test: wiring over plan 30's tested helpers. `apps/mobile/e2e/album.yaml` and
`apps/mobile/e2e/detail-sort-prefs.yaml` must keep passing; seed albums hold fewer than 60 tracks.

## Release scratchpad

## Mobile album tracks load more as you scroll

- Surfaces: mobile
- Change: an album's Tracks list used to stop at the first 60 tracks. It now loads the next page
  when you scroll near the bottom, with a loading row while it reads and a Retry row if the page
  fails. Changing the sort or range starts again from the top. Offline mode still shows the stored
  tracks only.
- Who notices: listeners opening large albums or music channels on the mobile app
- Operator steps: none
