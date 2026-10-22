# 44 — Home Episodes and Tracks offer Mark as Played, Download, and Share

**Cursor model:** Cursor Grok 4.7 · **Reasoning:** high

Rows: R59 and R71. Mobile only. Web Subscribed rows stay as plan 66 wrote them.

Runs after plans 41 and 43. Plan 41 builds `HomeFeedRead`, `findAddByRssTarget`, and the
`useAddByRssItemActions` call. Plan 43 adds `unsubscribeAction` on `HomeFeedListItem`; keep it.
Plans 85, 86, and 90 also edit `homeFeedData.ts` (86 also edits `HomeScreen.tsx`). They run after
this plan, never in the same phase. Do not wire these actions in plan 41.

Parity source for a directory row: `PodcastEpisodesSection`'s `PodcastEpisodeRow` (one-tap
download via `downloadItem` plus More). Add by RSS uses plan 30's `downloadItem` and
`markAsPlayed`, the same pair plan 34 passes on the feed page and the library chips. `HomeFeedRow`
already turns `downloadItem` into the one-tap control and the More Download entry. Do not edit
`HomeFeedRow.tsx`.

## Locked decisions

1. **Which chips.** Episodes and Tracks only. Podcasts, Artists, and Albums get no download
   control and keep the downloaded-count line (`home-feed-row-downloaded-${row.id}`). Clips is
   unchanged. `HomeUnsubscribedDownloadRow` and `HomeFeedGridCell` are unchanged. Episodes and
   Tracks are not grid chips (`isHomeViewModeMediaType` is false).
2. **Mark as Played, both sources.** A directory row calls `runMarkAsPlayedAction(row,
   selectedMediaType)` (`useHomeRowPlayback` already allows `'episodes'` and `'tracks'`). An Add
   by RSS row calls plan 30's `markAsPlayed` with `findAddByRssTarget(row)`. A missing target
   returns. Do not send an Add by RSS row through `runMarkAsPlayedAction`.
3. **Download, both sources.** Pass the `DTOItem` as `downloadItem`. There is no separate
   download handler. The control and the More entry stay off when the item is missing or not a
   progressive file (`DownloadRowControl` and `isDownloadable`).
4. **Where the item comes from.** Directory rows omit `source`. Anything other than
   `source === 'addByRss'` reads `directoryItemsById`. Add by RSS reads
   `addByRssItemsById.get(row.id).downloadItem`, and `null` becomes no control. Pass the stored
   item through. Do not copy a channel onto it.
5. **Share, directory only.** Episodes use `buildPublicShareUrl('episode', row.id)`. Tracks use
   `buildPublicShareUrl('track', row.id)`, then `shareResolvedUrl`, as
   `PodcastEpisodesSection` and `TrackDetailScreen` do. Add by RSS gets no Share prop (no public
   page). A handler that returns without sharing still shows the menu row; pass `undefined`.
6. **Offline Mode.** Episodes and Tracks stay the downloaded-only lists (plan 41). Each row looks
   up `channelItemsRepository.getByIdText`. A hit supplies `downloadItem`. A miss keeps the row,
   Mark as Played, and Share, and leaves the download control off. No new repository method.
7. **Go to Track.** Leave `onGoToTrackPress` as plan 41's `HomeFeedListItem` bullet writes it at
   implementation time. Do not force `undefined` for Add by RSS if that bullet no longer does.
8. **No API and no new copy.** Directory history is the existing item call. Add by RSS history is
   plan 30's `reqQueueResourceItemAddByRSSAddHistory` with `completed`. Notices already fold into
   plan 41's `homeNoticeKey`.

## Files

Paths are under `apps/mobile/` except the scratchpad.

| File                                          | Change                                   |
| --------------------------------------------- | ---------------------------------------- |
| `src/screens/home/homeItemRowActions.ts`      | New: which item, and whether Share shows |
| `src/screens/home/homeItemRowActions.test.ts` | New                                      |
| `vitest.config.ts`                            | Include the new test                     |
| `src/screens/home/homeFeedData.ts`            | `directoryItemsById`; offline item read  |
| `src/screens/home/HomeScreen.tsx`             | Pass the three actions on item rows      |
| `e2e/add-by-rss.yaml`                         | Home More: Mark as Played, no Share      |
| `release-notes/scratchpad.md`                 | Append the entry below                   |

`HomeScreen.tsx` is large. Anchors: `function HomeFeedListItem`, the `useHomeRowPlayback()` call,
plan 41's `useAddByRssItemActions()` destructure, `findAddByRssTarget`, `loadFeed`'s
downloaded-only arm, and `renderItem`.

## Implementation

### `homeItemRowActions.ts` (new, pure)

No repository imports. `DTOItem` is only the caller's item type.

```typescript
export type HomeItemActionRow = {
  id: string;
  source?: 'addByRss' | 'directory';
};

/** Download item for a Home Episodes or Tracks row, or undefined when the row has none. */
export const homeItemDownloadItem = <TItem>(
  row: HomeItemActionRow,
  sources: {
    addByRssItemsById: ReadonlyMap<string, { downloadItem: TItem | null }>;
    directoryItemsById: ReadonlyMap<string, TItem>;
  }
): TItem | undefined => { … };

/** Public page a directory Home item can share. Add by RSS returns null. */
export const homeItemShareResource = (
  row: HomeItemActionRow,
  mediaType: 'episodes' | 'tracks'
): 'episode' | 'track' | null => { … };
```

`homeItemDownloadItem`: when `row.source === 'addByRss'`, return that row's `downloadItem`, or
`undefined` when the row is missing or `downloadItem` is `null`. Otherwise return
`directoryItemsById.get(row.id)`.

`homeItemShareResource`: `null` when `row.source === 'addByRss'`. Otherwise `'track'` for
`'tracks'` and `'episode'` for `'episodes'`.

### `homeFeedData.ts`

Add to plan 41's `HomeFeedRead`, and a constant beside `EMPTY_HOME_ADD_BY_RSS_ITEMS`:

```typescript
/** Stored directory items on Episodes and Tracks, by row id, for the download control. */
directoryItemsById: ReadonlyMap<string, DTOItem>;

export const EMPTY_HOME_DIRECTORY_ITEMS: ReadonlyMap<string, DTOItem> = new Map();
```

`homeFeedReadFromRows` sets `directoryItemsById: EMPTY_HOME_DIRECTORY_ITEMS`. Channel, clips, and
the empty read stay on that helper.

In the episodes/tracks branch plan 41 writes, build the map from the `stored` array before
mapping rows. Skip `id_text.length === 0`, the same ids `mapItemsToHomeFeedRows` drops. Put the
map on that branch's return. Do not read the items a second time.

New export beside `fetchDownloadedHomeFeedRows`:

```typescript
/**
 * Completed downloads as Home Episodes or Tracks rows, plus the stored item each row can offer
 * for download. A download with no stored item stays in the list without a download control.
 */
export const readDownloadedHomeItemFeed = async (
  mediaType: 'episodes' | 'tracks'
): Promise<HomeFeedRead> => { … };
```

Body: `const rows = await fetchDownloadedHomeFeedRows(mediaType)`. For each row, `const item =
await channelItemsRepository.getByIdText(row.id)`; when `item !== null`,
`directoryItemsById.set(row.id, item)`. Return
`{ addByRssItemsById: EMPTY_HOME_ADD_BY_RSS_ITEMS, directoryItemsById, rows }`.

`homeFeedData.test.ts` and `homeFeedData.localPaint.test.ts` stay outside the Vitest include. If
either constructs a `HomeFeedRead` or calls `homeFeedReadFromRows`, give it the empty directory
map. Keep reading `.rows`.

### `HomeScreen.tsx`

- State `directoryItemsById`, `useState(EMPTY_HOME_DIRECTORY_ITEMS)`, beside
  `addByRssItemsById`. Set it from `read.directoryItemsById` wherever plan 41 sets
  `setAddByRssItemsById(read.addByRssItemsById)`. Clear it with `EMPTY_HOME_DIRECTORY_ITEMS`
  wherever plan 41 clears the Add by RSS map.
- Downloaded-only arm of `loadFeed`: call `readDownloadedHomeItemFeed(selectedMediaType)` instead
  of `fetchDownloadedHomeFeedRows(…).then(homeFeedReadFromRows)`.
  `isHomeDownloadedItemsOnly` already narrows to `'episodes' | 'tracks'`.
- On the existing `useHomeRowPlayback()` call, also take `runMarkAsPlayedAction`. On plan 41's
  `useAddByRssItemActions()` destructure, add `markAsPlayed: markAddByRssAsPlayed`. Do not call
  either hook twice.
- Handlers beside `handlePlayPress`:

```typescript
const handleMarkAsPlayedPress = useCallback((row: HomeFeedRowData) => {
  if (selectedMediaType !== 'episodes' && selectedMediaType !== 'tracks') {
    return;
  }
  if (row.source === 'addByRss') {
    const target = findAddByRssTarget(row);
    if (target !== null) {
      markAddByRssAsPlayed(target);
    }
    return;
  }
  runMarkAsPlayedAction(row, selectedMediaType);
}, [findAddByRssTarget, markAddByRssAsPlayed, runMarkAsPlayedAction, selectedMediaType]);

const handleSharePress = useCallback((row: HomeFeedRowData) => {
  if (selectedMediaType !== 'episodes' && selectedMediaType !== 'tracks') {
    return;
  }
  const resource = homeItemShareResource(row, selectedMediaType);
  if (resource === null) {
    return;
  }
  shareResolvedUrl(buildPublicShareUrl(resource, row.id));
}, [selectedMediaType]);
```

  Import `buildPublicShareUrl` and `shareResolvedUrl` from `../../lib/share/shareNowPlaying`.
- `HomeFeedListItem` gains `addByRssItemsById`, `directoryItemsById`, `onMarkAsPlayed`, and
  `onShare` (the two handlers above). `renderItem` passes them and lists them in its dependency
  array. The grid branch does not use them.
- On the list `HomeFeedRow` only, when `mediaType === 'episodes' || mediaType === 'tracks'`:

```typescript
const downloadItem = homeItemDownloadItem(row, { addByRssItemsById, directoryItemsById });
const shareResource = homeItemShareResource(row, mediaType);
```

  Pass `downloadItem` and `downloadTestID={`home-item-download-${row.id}`}` only when
  `downloadItem !== undefined`. Pass `onMarkAsPlayedPress={onMarkAsPlayed}`. Pass
  `onSharePress={shareResource !== null ? onShare : undefined}`. Other chips pass none of these
  four props. Keep `onGoToTrackPress` as decision 7 says.

## Tests

`homeItemRowActions.test.ts`. Add `'src/screens/home/homeItemRowActions.test.ts'` to
`vitest.config.ts` `include`, immediately after the `homeItemMerge.test.ts` entry plan 41 adds.
Plain objects, no `as`.

- A directory row (no `source`, and `source: 'directory'`) returns the map's item, and its share
  resource is `'episode'` or `'track'` from the media type.
- An id missing from `directoryItemsById` returns `undefined` and still has a share resource.
- Add by RSS with a `downloadItem` returns that item and share `null`.
- Add by RSS with `downloadItem: null`, or an id missing from the Add by RSS map, returns
  `undefined` and share `null`.

No change to `home.yaml`. That flow does not wait for a stored episode. The podcast episode flow
already shows this menu when the handlers are passed.

Maestro `e2e/add-by-rss.yaml` (R71), inside plan 41's Home Episodes block, after
`- takeScreenshot: add-by-rss-home-episode-listed` and before the `tapOn` of
`E2E Add-by-RSS Episode`. This is the Home row that flow reaches. Assert the download control
and the More menu's Download entry, then cancel. Leave both ids untapped: a tap starts or
removes a download. Tracks use the same props and get no extra step.

The row id is plan 30's `${feed.idText}-${itemKey}`. This fixture's item key is the guid
`https://e2e-seed-addbyrss.example/item-guid/fresh`, so both ids contain `item-guid/fresh`.
`HomeFeedRow` puts the caller's `downloadTestID` on `DownloadRowControl`. This plan passes
`home-item-download-${row.id}`. It builds More entries through `buildMediaRowMoreActions` with
`idSuffix` `-${row.id}`, and the Download spec key is `download`, so the entry id is
`media-row-action-download-${row.id}` (`MediaRowActions.tsx`). Match the control by that id.
It sits beside the title, so a `below` the title filter does not see it. The fixture enclosure is
`http://localhost:2111/e2e/audio/e2e-addbyrss-fresh-60s-440hz.mp3` with type `audio/mpeg`
(`E2E_DEFAULT_PARSED_FEED` in `accountAddByRSSParse.ts`). `addByRssDownloadItem` copies that
source onto the item, so `isDownloadable` is true and the control renders. This plan passes no
`completeTestID`, and the episode is not on disk, so the id stays the download id.

`index: 0` is the first More under that title. Leave the later title tap as plan 41 wrote it.
The title scroll just above has brought this row on screen, so the control assert needs no
extra wait and no horizontal swipe.

```yaml
# Download is on the row and in More. Neither tap runs: a tap would start the download.
- assertVisible:
    id: "home-item-download-.*item-guid/fresh"
- tapOn:
    id: "home-row-more-.*"
    index: 0
    below:
      text: E2E Add-by-RSS Episode
- extendedWaitUntil:
    visible:
      id: "media-row-menu-.*"
    timeout: ${TIMEOUT_FASTER}
- assertVisible:
    id: "media-row-action-mark-as-played-.*"
- assertVisible:
    id: "media-row-action-download-.*item-guid/fresh"
- assertNotVisible:
    id: "media-row-action-share-.*"
- takeScreenshot: add-by-rss-home-episode-more-menu
- tapOn:
    id: "media-row-menu-.*-cancel"
- assertNotVisible:
    id: "media-row-menu-.*"
```

## Release scratchpad

Append to `release-notes/scratchpad.md`:

```markdown
## Mobile Home episode and track rows can be marked played, downloaded, and shared

- Surfaces: mobile
- Change: Every row on Home's Episodes and Tracks chips, directory and Add by RSS, offers Mark
  as Played and the same download control podcast episode rows use (the button on the row and
  the More entry). Directory rows also offer Share. Add by RSS rows do not. Podcast, artist, and
  album rows keep their downloaded count and gain no download button. Clips is unchanged. Offline
  Mode still lists downloads only.
- Who notices: anyone using Home Episodes or Tracks
- Operator steps: none
```
