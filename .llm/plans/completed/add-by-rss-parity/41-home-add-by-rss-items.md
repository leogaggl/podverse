# 41 — Home Episodes and Tracks include Add by RSS items

**Cursor model:** Cursor Grok 4.7 · **Reasoning:** high

Rows: R1 (item chips; "the home page should be a combination of the normal server side content
and the AdByRSS content", R22), R65 (Go to Track on Add by RSS track rows). Mobile only.

Runs after plan 40, and after plans 30 (`useAddByRssItemActions`, `itemKey`, `downloadItem`), 33
(`HOME_STACK_ROUTES.AddByRssEpisodeDetail`), 37 (music feeds stored as music), 38
(`HOME_STACK_ROUTES.AddByRssTrackDetail`), and 34 (the Library item rows in
`AddByRssRootScreen.tsx`). Never together with plan 34, 42, or 43.

Parity source: Home's directory episode and track rows (`HomeFeedListItem`, `handleRowPress`,
`handlePlayPress`, `handleQueuePress`, `handleAddToPlaylistPress`). An Add by RSS row gets the same
row and the same tap rule as a directory row of that chip. Play, Queue, and Add to Playlist match.
Mark as Played, Download, and Share are plan 44.

## Locked decisions

1. **What is listed.** Episodes adds the items of ready Add by RSS feeds whose `resourceType` is
   `podcasts` or `episodes`. Tracks adds the items of ready feeds whose `resourceType` is
   `artists`, `albums`, or `tracks`. Livestreams are a per-feed flag, not a resource type (plans
   82 and 88), so the moved `itemResourceKinds` drops today's `'livestreams'` entry. A feed with
   livestreams stays on these lists by its medium; its live items are plan 86's.
2. **Window.** Each source keeps its own newest 60: the directory window is unchanged
   (`listSubscribed`'s limit), and the 60 newest Add by RSS items join it. When there are no Add
   by RSS items, the rows are exactly today's rows.
3. **Order.** Recent: newest first across both sources, rows without a date last. A-Z: by title
   ignoring a leading article (`articleStrippedTitle`). Popularity: directory rows in their ranked
   order, then Add by RSS rows newest first (they have no listen counts).
4. **Row shape.** Episodes rows carry title, show name, date, duration, and description. Tracks
   rows are compact (title and show name), like `mapTrackToHomeFeedRow`. Both set
   `source: 'addByRss'` and `sourceId: feed.idText`.
5. **Tap.** An Add by RSS episode opens the Home stack's `AddByRssEpisodeDetail` with
   `{ feedIdText: feed.idText, itemKey }`. An Add by RSS track plays on tap, as directory tracks
   do (R24).
6. **Play, Queue, Add to Playlist** run through `useAddByRssPlayback` and plan 30's
   `useAddByRssItemActions`. Do not wire Mark as Played, Download, or Share here. Plan 44 adds
   them on Episodes and Tracks for both sources, and adds Share on directory rows only. Go to
   Track shows on Add by RSS track rows, as on directory track rows (R65), and opens the Home
   stack's `AddByRssTrackDetail` (plan 38). Go to Album stays hidden because those rows have no
   `channelId`.
7. **Offline Mode** keeps today's downloaded-only Episodes and Tracks lists. No Add by RSS change.
8. **No swipe on item chips**, same as directory item rows.

## Files

| File                                                     | Change                           |
| -------------------------------------------------------- | -------------------------------- |
| `src/screens/home/addByRssItemRows.ts`                   | New: shared Add by RSS item read |
| `src/screens/home/homeItemMerge.ts`                      | New: pure merge                  |
| `src/screens/home/homeItemMerge.test.ts`                 | New                              |
| `vitest.config.ts`                                       | Include the new test             |
| `src/screens/rss/addByRssLibraryFeedData.ts`             | Use the shared read              |
| `src/screens/rss/AddByRssRootScreen.tsx`                 | Type import only                 |
| `src/screens/home/homeFeedData.ts`                       | `fetchHomeFeed` and the merge    |
| `src/screens/home/HomeScreen.tsx`                        | Map, handlers, notice, sheet     |
| `src/screens/home/homeFeedData.test.ts`                  | Rename and new mock              |
| `src/screens/home/homeFeedData.localPaint.test.ts`       | Rename and new mock              |
| `e2e/add-by-rss.yaml`                                    | Episode on Home                  |
| `APPS-MOBILE.md`                                         | `fetchHomeFeed` name             |
| `.cursor/rules/mobile-react-native.mdc` (repo root)      | `fetchHomeFeed` name             |

Paths are under `apps/mobile/` except the rule. `fetchHomeFeedRows` appears in
`APPS-MOBILE.md` (line 98) and `mobile-react-native.mdc` (line 121); rename it there.

## Implementation

### `addByRssItemRows.ts` (new)

Move from `addByRssLibraryFeedData.ts`: the `AddByRssLibraryItemRow` type (renamed
`AddByRssItemRow`), `itemResourceKinds`, and the per-feed loop. Export:

```typescript
export type AddByRssItemRow = AddByRssHomeEpisode & {
  feed: MobileAddByRSSFeedRecord;
  mappedFeed: AddByRSSMappedFeed;
};

/** Every item of the given ready feeds that belongs on an Episodes or Tracks list, unsorted. */
export const listAddByRssItemRows = async (
  mediaType: 'episodes' | 'tracks',
  readyFeeds: readonly MobileAddByRSSFeedRecord[]
): Promise<AddByRssItemRow[]> => { … };

/** The list row for an Add by RSS item; `compact` matches Home's track rows. */
export const toAddByRssItemHomeRow = (
  item: AddByRssItemRow,
  options: { compact?: boolean } = {}
): HomeFeedRowData => { … };
```

`listAddByRssItemRows` filters `readyFeeds` by `itemResourceKinds(mediaType)`, then runs today's
loop (`addByRssRepository.getMappedFeedByUrl`, skip `null`, `buildAddByRssHomeDetailData`, push
`{ ...episode, feed, mappedFeed }`). `toAddByRssItemHomeRow` returns today's Library mapping
(`description`, `duration`, `id`, `imageUrl`, `source: 'addByRss'`, `sourceId: item.feed.idText`,
`subtitle`, `title`, `updatedAt`); with `compact: true` it returns only `id`, `imageUrl`,
`source`, `sourceId`, `subtitle`, and `title`. Import `HomeFeedRowData` as a type only, so this
file and `homeFeedData.ts` never import each other's values.

### `addByRssLibraryFeedData.ts`

The item branch becomes `const itemRows = await listAddByRssItemRows(mediaType, ready);`, then
today's `sortAddByRssHomeEpisodes(itemRows, sort)` and a map through `toAddByRssItemHomeRow(row)`
that also fills `itemRowsById`. `AddByRssLibraryFeedResult.itemRowsById` is
`ReadonlyMap<string, AddByRssItemRow>`. Delete the moved code. In `AddByRssRootScreen.tsx`, import
`type { AddByRssItemRow } from '../home/addByRssItemRows'` in place of `AddByRssLibraryItemRow`.

### `homeItemMerge.ts` (new, pure)

Imports: `articleStrippedTitle` from `@podverse/helpers`; types `HomeSortOption` and
`HomeFeedRowData`. No repository imports.

```typescript
/** How many newest Add by RSS items join Home's stored directory window. */
export const HOME_ADD_BY_RSS_ITEM_LIMIT = 60;

export type HomeItemMergeEntry = { pubDateMs: number | null; row: HomeFeedRowData };

/** Milliseconds from a number, ISO string, or Date; anything unreadable is null. */
export const readItemPubDateMs = (value: unknown): number | null => { … };

export const mergeHomeItemRows = (params: {
  addByRss: readonly HomeItemMergeEntry[];
  directory: readonly HomeItemMergeEntry[];
  sort: HomeSortOption;
}): HomeFeedRowData[] => { … };
```

`mergeHomeItemRows`:

1. `addByRss.length === 0` → return `directory.map((entry) => entry.row)`.
2. Window: sort `addByRss` newest first (null last, ties keep input order), keep the first
   `HOME_ADD_BY_RSS_ITEM_LIMIT`.
3. `recent`: stable sort of directory then window by `pubDateMs` descending, null last.
4. `alphabetical`: stable sort of the same list by
   `articleStrippedTitle(a.row.title).localeCompare(articleStrippedTitle(b.row.title))`.
5. `popularity`: directory in input order, then the window.

### `homeFeedData.ts`

- Rename `fetchHomeFeedRows` to `fetchHomeFeed` and return `HomeFeedRead`:

```typescript
export type HomeFeedRead = {
  /** Add by RSS rows on the Episodes and Tracks chips, by row id, for play and More. */
  addByRssItemsById: ReadonlyMap<string, AddByRssItemRow>;
  rows: HomeFeedRowData[];
};

export const EMPTY_HOME_ADD_BY_RSS_ITEMS: ReadonlyMap<string, AddByRssItemRow> = new Map();

export const homeFeedReadFromRows = (rows: HomeFeedRowData[]): HomeFeedRead => ({
  addByRssItemsById: EMPTY_HOME_ADD_BY_RSS_ITEMS,
  rows,
});
```

- Channel, clips, and the trailing `return []` return `homeFeedReadFromRows(…)`.
- Replace the episodes and tracks branches with one branch
  `if (mediaType === 'episodes' || mediaType === 'tracks')` that:
  1. reads directory channels exactly as today (`kind: 'podcasts'` for episodes; the
     artists/albums filter for tracks), `ensureCurrent()`, then `listSubscribed` as today,
     `ensureCurrent()`;
  2. `const { ready } = await addByRssRepository.listFeedsByCredentials();` `ensureCurrent()`;
     `const items = await listAddByRssItemRows(mediaType, ready);` `ensureCurrent()`;
  3. `compact = mediaType === 'tracks'`. A directory entry is
     `pubDateMs: readItemPubDateMs(item.pub_date)` with
     `row: mapItemToHomeFeedRow(item, { compact })`, empty ids dropped (as
     `mapItemsToHomeFeedRows` does). An Add by RSS entry is
     `pubDateMs: readItemPubDateMs(item.updatedAt)` with
     `row: toAddByRssItemHomeRow(item, { compact })`;
  4. returns `{ addByRssItemsById: new Map(items.map((item) => [item.id, item])), rows:
     mergeHomeItemRows({ addByRss, directory, sort }) }`.
- Comment on the branch: Episodes and Tracks list stored directory items plus ready Add by RSS
  items; each source keeps its own newest window, and nothing waits on the network.

### `HomeScreen.tsx`

- State and hooks beside `useHomeRowPlayback()`:
  `addByRssItemsById` (`useState(EMPTY_HOME_ADD_BY_RSS_ITEMS)`), `addByRssPlaybackNoticeKey`
  (`string | null`), `const { playItem: playAddByRssItem } = useAddByRssPlayback({ onNotice:
  setAddByRssPlaybackNoticeKey })`, and `const { actionNoticeKey: addByRssActionNoticeKey,
  addToPlaylist: addAddByRssToPlaylist, addToPlaylistSheet: addByRssAddToPlaylistSheet, queue:
  queueAddByRssItem } = useAddByRssItemActions()` (`./addByRss/useAddByRssItemActions`).
- `loadFeed`: the read becomes `read`; the offline branch wraps
  `fetchDownloadedHomeFeedRows(selectedMediaType).then(homeFeedReadFromRows)`; the other calls
  `fetchHomeFeed`. Set `setFeedRows(read.rows)` and `setAddByRssItemsById(read.addByRssItemsById)`
  together; `setHasPodcastSubscriptions(read.rows.length > 0)`.
- Every `setFeedRows([])` (`commitMediaTypeChange`, the offline clips branch, the error branch)
  also sets `setAddByRssItemsById(EMPTY_HOME_ADD_BY_RSS_ITEMS)`. `commitMediaTypeChange` also sets
  `setAddByRssPlaybackNoticeKey(null)`.
- `const findAddByRssTarget = useCallback((row): AddByRssItemActionTarget | null => …,
  [addByRssItemsById])` returns `{ feed, itemBundle, itemIndex, mappedFeed }` for an
  `addByRss` row found in the map, else `null`.
- `handleRowPress`: after plan 40's channel check, add: when `row.source === 'addByRss'` and the
  chip is episodes or tracks, look up `addByRssItemsById.get(row.id)` (missing → return). Episodes
  → `navigation.navigate(HOME_STACK_ROUTES.AddByRssEpisodeDetail, { feedIdText:
  item.feed.idText, itemKey: item.itemKey })`; tracks → `void playAddByRssItem(item.feed,
  item.mappedFeed, item.itemBundle, item.itemIndex)`. Return.
- `handlePlayPress`, `handleQueuePress`, `handleAddToPlaylistPress`: after `perfMark` (play
  only), `if (nextRow.source === 'addByRss') { const target = findAddByRssTarget(nextRow); if
  (target !== null) { … } return; }` calling `playAddByRssItem(target.feed, target.mappedFeed,
  target.itemBundle, target.itemIndex)`, `queueAddByRssItem(target, position)`, or
  `addAddByRssToPlaylist(target)`. Directory rows keep today's path. Update dependency lists.
- `handleGoToTrack` (anchor `const handleGoToTrack`): first, when `row.source === 'addByRss'`,
  look up `addByRssItemsById.get(row.id)` (missing → return), call
  `navigation.navigate(HOME_STACK_ROUTES.AddByRssTrackDetail, { feedIdText: item.feed.idText,
  itemKey: item.itemKey })`, and return. Directory rows keep `buildTrackDetailParams`. Add
  `addByRssItemsById` to its dependency list.
- `HomeFeedListItem` keeps `onGoToTrackPress={goToTrack}` for every row; `rowGoToTrack` already
  limits it to the Tracks chip.
- Footer notice: `const homeNoticeKey = addByRssActionNoticeKey ?? addByRssPlaybackNoticeKey ??
  playbackNoticeKey;` replaces `playbackNoticeKey` in the footer `Text` and its dependency list.
- Render `{addByRssAddToPlaylistSheet}` right after `{addToPlaylistSheet}`.

### Unit test files outside the vitest include

`homeFeedData.test.ts` and `homeFeedData.localPaint.test.ts` do not run (they import SQLite
repositories). Keep them accurate: call `fetchHomeFeed` and read `.rows`; mock
`addByRssRepository.listFeedsByCredentials` to resolve `{ needsCredentials: [], ready: [] }`; the
item half of the plan 40 test keeps its directory-only `list` expectations.

### `e2e/add-by-rss.yaml`

Inside plan 40's Home block, after `- takeScreenshot: add-by-rss-home-listed` and before
`- tapOn: id: tab-my-library`:

```yaml
# Episodes merges Add by RSS items with directory episodes; the row opens Home's episode page.
- tapOn:
    id: home-media-type-episodes
- scrollUntilVisible:
    element:
      text: E2E Add-by-RSS Episode
    direction: DOWN
    timeout: ${TIMEOUT_SLOW}
- takeScreenshot: add-by-rss-home-episode-listed
- tapOn:
    text: E2E Add-by-RSS Episode
- extendedWaitUntil:
    visible:
      id: add-by-rss-episode-detail-screen
    timeout: ${TIMEOUT_SLOW}
- runFlow: shared/stack-back.yaml
- tapOn:
    id: home-media-type-podcasts
```

## Tests

`homeItemMerge.test.ts` (add `'src/screens/home/homeItemMerge.test.ts'` to `vitest.config.ts`
`include`, after `'src/screens/home/homeRowMetadata.test.ts'`):

- no Add by RSS entries → the directory rows unchanged, for each of the three sorts;
- 70 Add by RSS entries → only the 60 newest appear, beside every directory row;
- recent interleaves by date and puts null dates last;
- A-Z ignores a leading "The";
- popularity keeps directory order and lists Add by RSS rows after, newest first;
- `readItemPubDateMs` reads a number, an ISO string, and a `Date`, and returns null for `'x'`.

## Release scratchpad

Append to `release-notes/scratchpad.md`:

```markdown
## Mobile Home Episodes and Tracks include Add by RSS items

- Surfaces: mobile
- Change: Home's Episodes and Tracks chips list items from Add by RSS feeds beside directory
  items, sorted together (the newest 60 Add by RSS items join the stored directory list). An Add
  by RSS episode opens its episode page on the Home tab; a track plays, and its More menu has Go
  to Track, which opens the track's page. Play, Queue Next, Queue Last, and Add to Playlist work
  on those rows. Offline Mode still lists downloads only.
- Who notices: anyone with Add by RSS follows
- Operator steps: none
```
