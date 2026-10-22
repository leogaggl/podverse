# 95 — Livestreams on the mobile Add by RSS feed page

**Cursor model:** Cursor Grok 4.7 · **Reasoning:** extra high

## Rows

- **R67**: the mobile Add by RSS feed page lists the feed's livestreams above its Episodes (or
  Tracks) rows, as the podcast page does; each row opens the Add by RSS livestream page.

**Runs after:** 20, 21, 22, 34 (they build `AddByRssEpisodesSection.tsx` and its row renderer),
81 (`liveItemVisibility.ts`, the live-item controller, and its API test), 85 (row helpers,
`liveStatusId`, optional Queue), 89 (route, `addByRssLiveItemKey`, `playLiveItem`), 90
(`playbackMediaId`), and 86 (`lib/addByRss/liveRows.ts`). **Runs before:** 87, whose
`add-by-rss-livestream` flow checks this section. Never in one phase with 20, 21, 22, 34, 81,
or 86.

## Web: section already present

Web's Add by RSS feed pages already list live items above their items, and plan 88 keeps them:
`AddByRSSPodcastPageDetailClient.tsx` (Episodes tab, page 1), `AddByRSSAlbumPageClient.tsx`
(Tracks tab), and `AddByRSSArtistPageList.tsx` each render `AddByRSSLivestreamNodes` from
`buildAddByRSSLivestreamIndex`, and each row links to `/add-by-rss/podcast/livestream/[id]`
through `getAddByRSSLivestreamPath`. Plan 88 deletes only the feed-level livestream components.
This plan changes no web file and does not add a section. Plan 96, which runs after this one,
replaces those pages' start-time sort with `compareChannelLiveItems` and hides ended items
older than a day.

## Parity source

- `screens/podcast/sections/PodcastEpisodesSection.tsx`: `liveDisplayRows` (stored ids
  subtracted), then `visibleRows = [...liveDisplayRows, ...episodeRows]` through
  `matchesTitleFilter`; `hasFilterHiddenEverything` counts both lists.
- `screens/album/AlbumDetailScreen.tsx`: the channel's live items merged above its tracks.
- `GET /live-item/channel/:id` (`LiveItemController.getManyByChannel`), the source both pages
  read: live (latest start first), then scheduled (latest start first), then ended (latest end
  first), with ended items older than one day hidden by `isLiveItemEndedAndStale`.
- Plan 86's Add by RSS live rows (row shape, tap, play) and plan 89's page.

## Locked decisions

1. **Where.** The items section only: `episodes` for podcast feeds, `tracks` for music feeds,
   both rendered by `AddByRssEpisodesSection`. Not Downloaded, About, Funding, or People, and
   not the Add by RSS library or Home (plan 86 covers those).
2. **Which items.** The stored mapped feed's `liveItems`: Live, Pending, and Ended items not
   stale under `isLiveItemEndedAndStale` (ended within one day, by end time, else start time).
   Other statuses are skipped. Same rule as the channel endpoint. No network read.
3. **Order.** One shared comparator, `compareChannelLiveItems` in `@podverse/helpers`, used by
   the mobile section and by `getManyByChannel` (which keeps its exact order). Live rows always
   sit above the episode rows; the section's sort chip orders episode rows only.
4. **Duplicates.** A live row whose `id` equals an episode row's `id` is dropped (a feed that
   lists the same guid as an item and as a live item), as the podcast page subtracts stored ids.
5. **Filter.** The title filter applies to live rows too. Empty and filter-hid-everything states
   count live and episode rows together.
6. **Row behavior.** Every live row, podcast or music feed, renders as an episode row
   (`mediaType="episodes"`, `showChannelContext={false}`). Tap opens plan 89's
   `AddByRssLivestreamDetail` on the current stack. Play shows only on live rows (plan 85 sets
   `playable: false` otherwise) and calls `playLiveItem`. No Queue, Add to Playlist, Mark as
   Played, Download, or Share, so no More button (R60). No new-content dot. The album page's
   live rows play on tap; this page opens the livestream page instead, as R67 asks.
7. **Marking.** As plan 85: a live row carries `LIVE_ROW_METADATA` (the Live badge); the status
   rides on `liveStatusId`. No subtitle edits here. Plan 97, which runs later, has `HomeFeedRow`
   show Scheduled or Ended at the start of the date line from `liveStatusId`.
8. **Row index.** Episode rows keep their own index (list index minus the visible live-row
   count), so `add-by-rss-home-play-first` and `add-by-rss-home-download-${index}` still mean the
   first episode.
9. **Processing feed.** `detail.mappedFeed === null` → no live rows.

## Files

| Path                                                                 | Change                    |
| -------------------------------------------------------------------- | ------------------------- |
| `packages/helpers/src/lib/liveItemVisibility.ts`                     | Channel order comparator  |
| `packages/helpers/src/lib/liveItemVisibility.test.ts`                | Cases                     |
| `apps/api/src/controllers/liveItem.ts`                               | Use the comparator        |
| `apps/api/src/test/category-channel-item-read.test.ts`               | Order case                |
| `apps/mobile/src/lib/addByRss/liveRows.ts`                           | Feed page live rows       |
| `apps/mobile/src/lib/addByRss/liveRows.test.ts`                      | Cases                     |
| `apps/mobile/src/screens/home/addByRss/AddByRssEpisodesSection.tsx`  | Live rows above episodes  |
| `release-notes/scratchpad.md`                                        | Entry                     |

No i18n, OpenAPI, or `vitest.config.ts` change (plan 86 already includes `liveRows.test.ts`;
the endpoint's response does not change).

## Implementation

### `@podverse/helpers` — `liveItemVisibility.ts`

Beside plan 81's `compareUpcomingLiveItems` (the file is exported from the package index):

```typescript
export type ChannelLiveItemSortKey = {
  statusId: LiveItemStatusEnum | null | undefined;
  startTimeMs: number | null;
  endTimeMs: number | null;
};

/**
 * A channel's livestream order: live, then scheduled, then ended. Live and scheduled show the
 * latest start first; ended shows the latest end first. A missing time sorts last.
 */
export const compareChannelLiveItems = (
  a: ChannelLiveItemSortKey,
  b: ChannelLiveItemSortKey
): number => { … };
```

Rank: Live 0, Pending 1, Ended 2, anything else 3. Unequal ranks → rank difference. Equal rank:
Ended compares `(b.endTimeMs ?? 0) - (a.endTimeMs ?? 0)`; every other rank compares
`(b.startTimeMs ?? 0) - (a.startTimeMs ?? 0)`. Missing as 0 is the controller's `?? 0` today.

### API — `LiveItemController.getManyByChannel`

Anchor: the `live` / `pending` / `ended` arrays and their three `sort` calls after the stale
filter. Replace them with:

- `items.filter` keeping items whose `live_item?.live_item_status?.id` is Live, Pending, or
  Ended (today's loop drops every other item).
- `.sort` with `compareChannelLiveItems` over a local `toChannelLiveItemSortKey(item: Item)`:
  `statusId: item.live_item?.live_item_status?.id`, `startTimeMs` and `endTimeMs` from
  `new Date(value).getTime()` when the column is set, else `null`.
- `res.json(sorted)`. Keep the stale filter and its comment. Drop the `Item` import only if
  nothing else uses it.

The response is the same list in the same order, so `openapi.yml` does not change.

### Mobile — `lib/addByRss/liveRows.ts`

Plan 86 wrote `toAddByRssLiveRows`. Split its per-item body into a private
`toAddByRssLiveBaseRow(feed, mappedFeed, liveBundle, liveIndex): (HomeFeedRowData & { target:
AddByRssLiveTarget }) | null` (the row before `toUpcomingLiveRow`), and have
`toAddByRssLiveRows` call it; its behavior does not change. Then add:

```typescript
/**
 * The feed page's live rows, in the channel order: live, scheduled, then ended within a day.
 * Older ended items and unknown statuses are skipped.
 */
export const toAddByRssFeedLiveRows = (
  feed: MobileAddByRSSFeedRecord,
  mappedFeed: AddByRSSMappedFeed,
  now: Date = new Date()
): AddByRssLiveRow[];
```

For each `mappedFeed.liveItems[liveIndex]`, with `liveItem = liveBundle.liveItem`:

1. `liveItem.live_item_status` not Live, Pending, or Ended → skip.
2. `isLiveItemEndedAndStale({ live_item_status_id: liveItem.live_item_status, start_time:
   liveItem.start_time, end_time: liveItem.end_time }, now)` → skip. After the SQLite JSON
   round trip the times are strings; the helper accepts `string | Date`.
3. Base row `null` → skip.
4. Live or Pending → `toUpcomingLiveRow(base, status, liveItem.start_time)` (plan 85; spread
   `target` back on if that helper's return type drops it). Ended → `{ ...base, liveStatusId:
   LiveItemStatusEnum.Ended, startTimeMs, playable: false }`, `startTimeMs` computed the way
   `toUpcomingLiveRow` computes it (reuse its helper if it has one; otherwise a local
   `toFiniteTimeMs`).
5. Keep `{ row, key }` pairs, where `key` is the `ChannelLiveItemSortKey` (start and end from
   `liveItem`, finite ms or `null`). Sort the pairs with `compareChannelLiveItems` (stable), then
   return the rows.

`AddByRssLiveRow` already allows an Ended `liveStatusId`; extend its doc comment to say so.
Import `compareChannelLiveItems`, `isLiveItemEndedAndStale`, and `LiveItemStatusEnum` from
`@podverse/helpers`.

### Mobile — `AddByRssEpisodesSection.tsx`

**Live row component.** Beside `AddByRssEpisodeRow`:

```typescript
type AddByRssLiveFeedRowProps = {
  onOpen: (row: AddByRssLiveRow) => void;
  onPlay: (row: AddByRssLiveRow) => void;
  row: AddByRssLiveRow;
};
```

It renders one `HomeFeedRow` with `mediaType="episodes"`, `onPress` and `onPlayPress` wrapping
`onOpen(row)` / `onPlay(row)` (`HomeFeedRow` hands back `HomeFeedRowData`, so close over
`row`), `row`, `showChannelContext={false}`, `testID={`add-by-rss-home-live-${row.id}`}`, and
`playTestID={`add-by-rss-home-play-live-${row.id}`}`. Pass no `onQueuePress`, no other action
handlers, no `downloadItem`, and no `itemLastSeenAtMs`.

**Row renderer hook.** `useAddByRssEpisodeRowRenderer` (plans 21 and 34) already holds the
section's `useAddByRssPlayback` instance and `navigation`. Extend its playback destructure with
`playLiveItem` (plan 89) and add:

- `handleOpenLive(row)`: `navigation.navigate('AddByRssLivestreamDetail', { feedIdText:
  row.target.feed.idText, liveItemKey: addByRssLiveItemKey(row.target.liveBundle,
  row.target.liveIndex) })`.
- `handlePlayLive(row)`: `playLiveItem(row.target.feed, row.target.mappedFeed,
  row.target.liveBundle, row.target.liveIndex)`.
- Return `renderLiveRow: (row: AddByRssLiveRow) => ReactElement` beside `renderRow`, memoized
  on both handlers. The playback notice stays the hook's one `noticeKey`.
  `AddByRssDownloadedSection` ignores `renderLiveRow`.

**Section.** Keep plan 20's sorted episode rows (call them `episodeRows` here) and add:

```typescript
const liveRows = useMemo(() => {
  if (detail.mappedFeed === null) {
    return [];
  }
  const episodeIds = new Set(detail.episodeRows.map((row) => row.id));
  return toAddByRssFeedLiveRows(detail.feed, detail.mappedFeed).filter(
    (row) => !episodeIds.has(row.id)
  );
}, [detail.episodeRows, detail.feed, detail.mappedFeed]);
```

- `visibleLiveRows` and `visibleEpisodeRows`: each list through `matchesTitleFilter(row.title,
  filterTerm)`, memoized.
- `PodcastSectionList`'s `TRow` becomes `AddByRssEpisodeListRow = AddByRssLiveRow |
  AddByRssHomeEpisode`; `rows = [...visibleLiveRows, ...visibleEpisodeRows]`; `keyExtractor`
  stays `row.id` (ids are unique after the dedupe).
- `renderRow({ index, row })`: `liveRowsById` (a memoized `Map` over `visibleLiveRows`) has
  `row.id` → `renderLiveRow(that live row)`. Otherwise find the episode row
  (`visibleEpisodeRows[index - visibleLiveRows.length]`) and call the hook's `renderRow` with
  that index. Use the map and index, not `as`, so no assertion is needed.
- `hasFilterHiddenEverything`: `liveRows.length + episodeRows.length > 0 && rows.length === 0`.
  The empty message shows only when both lists are empty, as today when episodes are empty.
- Doc comment on the section: live rows sit above the episode rows in the channel order, the
  sort chip orders episode rows only, and live rows open the Add by RSS livestream page.

No change to `AddByRssHomeDetailScreen.tsx`, `addByRssHomeDetailData.ts`, or the library: the
section reads the feed record and mapped feed it already has on `detail`.

## Tests

**Helpers** — `liveItemVisibility.test.ts`, `compareChannelLiveItems`:

- A scheduled item that starts later than a live one still sorts after it; an ended item sorts
  after both.
- Two live items: the later start first. Two ended items: the later end first, even when its
  start is earlier.
- A missing start (or end, for ended) sorts after a dated one of the same status.

**API** — `category-channel-item-read.test.ts`, beside the other `/live-item/channel/:id` cases:
`GET /live-item/channel/:id orders live, then scheduled, then ended`. Mock with
`buildLiveItemMock`: two live items (starts 3 h and 1 h ago), one pending (start 2 h ago), and
two ended items within a day (ends 5 h and 1 h ago). Assert the exact id order: the later live,
the earlier live, the pending item, the later-ended item, the earlier-ended item.

**Mobile unit** — `lib/addByRss/liveRows.test.ts`, `toAddByRssFeedLiveRows` with a fixed `now`:

- A feed with one live, one pending, one ended an hour before `now`, and one ended two days
  before `now` returns three rows in the order live, pending, ended; the stale ended item is
  absent.
- The live row has `metadata.isLive` true; the pending and ended rows have `playable: false`;
  the ended row's `liveStatusId` is Ended.
- Each row's `target.liveIndex` points back at its bundle in `mappedFeed.liveItems`.
- An unknown status is skipped. `toAddByRssLiveRows` still drops the ended item (plan 86's
  cases keep passing).

**Maestro** — plan 87's `add-by-rss-livestream` flow checks the section on the feed page (live
and scheduled rows above the episode, the scheduled row opens the livestream page). This plan
adds no flow step itself.

## Release scratchpad

```markdown
## Add by RSS feed page lists livestreams on mobile

- Surfaces: mobile, api
- Change: the mobile Add by RSS feed page lists the feed's livestreams above its Episodes or
  Tracks: live first (with the Live badge and play), then scheduled, then any that ended within
  the last day. The title filter applies to them; the sort chip orders episodes only. Tapping a
  livestream opens the Add by RSS livestream page; there is no More menu. The podcast page's
  live-item endpoint now sorts through the same shared helper, with no change to its order.
- Who notices: mobile users with Add by RSS feeds that publish podcast:liveItem entries
- Operator steps: none
```
