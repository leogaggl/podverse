# 86 — Mobile Home and Add by RSS library Livestreams chips

**Cursor model:** Cursor Grok 4.7 · **Reasoning:** high

## Rows

- **R51** (mobile, Home and the Add by RSS library): a Livestreams chip on both.
- **R52** (mobile, Home and library rows): followed channels' and Add by RSS feeds' livestreams,
  live first and marked, then scheduled, no ended.
- **R53** (mobile read side): only Add by RSS feeds whose device flag (plan 82) is set are
  deserialized for this list.
- **R62** (mobile): § Flag only. **R60**: decision 5. **R61**: decision 6 (the page is plan 89).

Runs after plan 85 (row helpers, optional Queue), plans 40–44 (Home and library chips,
`fetchHomeFeed`, `HomeFeedRead`, `listAddByRssItemRows`, `homeItemShareResource`), plans 82 and
88 (the flag; no livestreams resource type), plan 90 (`playbackMediaId`), and plan 89 (the
`AddByRssLivestreamDetail` route, `addByRssLiveItemKey`, `toAddByRssLiveItemPlaybackResourceData`,
and `playLiveItem`).

## Flag only (R62)

Livestreams chips list live **items**, found through the flag and the bundle's live items. A
feed keeps its medium's `resourceType` and its Podcasts or Artists and Albums chip; its regular
items stay on Episodes or Tracks. The `'livestreams'` added below is a chip id, never a
`resourceType`. Directory channels match: live items come from `live_item` (plan 81), and the
medium is unchanged (plan 80).

## Parity source

- Home's Clips chip: an account-backed list the sync queue stores in kv
  (`homeClipsCacheRepository`, the `home-clips` job, Home reading the cache, Offline Mode's
  unavailable fill). **mobile-sync-orchestration**: nothing network-bound blocks first paint.
- Plan 41's Episodes merge (`HomeFeedRead.addByRssItemsById`, Add by RSS rows beside directory
  rows); plan 89's `playLiveItem` for Add by RSS playback.
- Plan 85's Browse Livestreams rows for directory row behavior; plan 44's Home Share wiring.

## Locked decisions

1. **Chip order.** Home: Podcasts, Episodes, Clips, Artists, Albums, Tracks, Livestreams. Add by
   RSS library: Podcasts, Episodes, Artists, Albums, Tracks, Livestreams. The same as web.
2. **Directory source (Home).** A new sync job `home-livestreams`, planned whenever Clips' job
   is (signed in), stores `reqLiveItemGetManyUpcoming({ type: 'subscribed', medium: 'all', page:
1 })` in kv key `home.livestreams.subscribed`. Home only reads the cache. Indicator label:
   `sync.job.live_status` (existing key).
3. **Add by RSS source.** Ready feeds (`listFeedsByCredentials().ready`) of every resource type
   with `mayHaveLivestreams === true`; for each, the stored bundle's `liveItems` whose status is
   upcoming. The flag is the pre-filter, so feeds without it are never deserialized here. No
   filter by `resourceType` and no use of `itemResourceKinds`.
4. **Order.** Home: directory rows and Add by RSS rows merge through `sortUpcomingLiveRows`
   (stable; directory first on equal keys). Library: Add by RSS rows only, same sort.
5. **No controls (R60).** Not sortable (Home's sort chip and the library's sort chip are
   hidden), no grid, no filter. Rows offer no Queue Next, Queue Last, Add to Playlist, Mark as
   Played, or Download. Home's directory rows offer Share, as on Browse (plan 85). Add by RSS
   rows offer nothing, so they show no More button.
6. **Taps (R61).** Directory rows: as plan 85 (tap → `EpisodeDetail`; play when live). Add by
   RSS rows, live or scheduled: tap opens plan 89's `AddByRssLivestreamDetail` on the current
   stack with `{ feedIdText: target.feed.idText, liveItemKey:
   addByRssLiveItemKey(target.liveBundle, target.liveIndex) }`. Play exists on live rows only
   and calls `playLiveItem`.
7. **Offline Mode.** Home Livestreams shows the unavailable fill, as Clips does. The library
   Livestreams chip lists what is stored (it is device data); playing still needs the network.
8. **Empty.** Signed in with no rows: `ListEmpty` with `media.livestream.no_livestreams_found`.
   Signed out with no rows: Home's existing no-subscriptions fill.

## Files

All mobile paths are under `apps/mobile/src/`.

| Path                                                  | Change                             |
| ----------------------------------------------------- | ---------------------------------- |
| `prefs/prefsStore.ts`                                 | `HOME_MEDIA_TYPES`                 |
| `screens/browse/browseTypes.ts`                       | `HOME_MEDIA_TYPE_ORDER`            |
| `prefs/homeListPrefs.ts`                              | Not sortable                       |
| `prefs/addByRssListPrefs.ts`                          | Library type, sortable predicate   |
| `lib/offlineModeViews.ts`                             | Livestreams unavailable offline    |
| `lib/addByRss/liveRows.ts`                            | New, pure                          |
| `lib/addByRss/liveRows.test.ts`                       | New, Vitest                        |
| `data/repositories/homeLivestreamsCacheRepository.ts` | New                                |
| `data/repositories/index.ts`                          | Export                             |
| `sync/syncJobKinds.ts`                                | Kind and label                     |
| `sync/syncJobPlan.ts`                                 | Plan the job                       |
| `sync/syncJobs.ts`                                    | Build the job                      |
| `screens/home/addByRssLiveRows.ts`                    | New: repository read               |
| `screens/home/homeFeedData.ts`                        | Livestreams branch, `HomeFeedRead` |
| `screens/home/homeItemRowActions.ts`                  | Livestreams share resource         |
| `screens/home/homeItemRowActions.test.ts`             | Livestreams cases                  |
| `screens/home/HomeScreen.tsx`                         | Taps, play, Share, offline, empty  |
| `screens/rss/addByRssLibraryFeedData.ts`              | Livestreams branch                 |
| `screens/rss/AddByRssRootScreen.tsx`                  | Taps, play, sort chip, empty       |
| `vitest.config.ts`                                    | Include the new test               |

## Implementation

### Types and predicates

- `prefsStore.ts` line 8: `HOME_MEDIA_TYPES` gains `'livestreams'` after `'tracks'`.
- `browseTypes.ts`: `HOME_MEDIA_TYPE_ORDER` gains `'livestreams'` after `'tracks'`.
- `homeListPrefs.ts`: `isHomeSortableMediaType` returns `mediaType !== 'livestreams'`
  (rename the `_mediaType` parameter). `isHomeViewModeMediaType` and `isHomeFilterMediaType`
  already return false; confirm.
- `addByRssListPrefs.ts`: `ADD_BY_RSS_LIBRARY_MEDIA_TYPES` gains `'livestreams'` after
  `'tracks'`. Add `isAddByRssLibrarySortableMediaType = (mediaType) => mediaType !==
'livestreams'`.
- `offlineModeViews.ts`: `OfflineUnavailableSurface` gains `'home_livestreams'`; add
  `isHomeLivestreamsUnavailableOffline = (mediaType: HomeMediaType): boolean => mediaType ===
'livestreams'`.
- `rg -n "HomeMediaType|AddByRssLibraryMediaType" apps/mobile/src` and fix every `Record<…>` or
  exhaustive branch the new value breaks.

### `lib/addByRss/liveRows.ts` (pure)

```typescript
export type AddByRssLiveTarget = {
  feed: MobileAddByRSSFeedRecord;
  mappedFeed: AddByRSSMappedFeed;
  liveBundle: AddByRSSMappedFeed['liveItems'][number];
  liveIndex: number;
};

export type AddByRssLiveRow = UpcomingLiveRow & { target: AddByRssLiveTarget };

/** Upcoming live rows of one stored feed, unsorted; ended and unreadable items are skipped. */
export const toAddByRssLiveRows = (
  feed: MobileAddByRSSFeedRecord,
  mappedFeed: AddByRSSMappedFeed
): AddByRssLiveRow[];
```

For each `mappedFeed.liveItems[liveIndex]`: build the index item with `toLiveIndexItem` exactly
as `toAddByRssItemPlaybackResourceData` builds its `feedForIndex` (`domain.ts` line 232). Row:
`id: indexItem.id`, `title` from the bundle's item title (trimmed; the feed title when empty),
`subtitle: indexItem.channelTitle`, `imageUrl: indexItem.channelImageUrl ?? null`, `source:
'addByRss'`, `sourceId: feed.idText`, `playbackMediaId:
addByRssPlaybackMediaId(toAddByRssLiveItemPlaybackResourceData(feed, mappedFeed, liveBundle,
liveIndex))` (plans 89 and 90, so the playing live row shows pause); then `toUpcomingLiveRow(row,
liveBundle.liveItem.live_item_status, liveBundle.liveItem.start_time)` (plan 85); `null` → skip.
Confirm `toUpcomingLiveRow` keeps `playbackMediaId`. Playback is plan 89's `playLiveItem`.

### kv cache and sync job

- `homeLivestreamsCacheRepository.ts`: copy `homeClipsCacheRepository.ts` with key
  `home.livestreams.subscribed`, payload `{ items: DTOItem[] }` (guard `Array.isArray(items)`),
  `listItems(): Promise<DTOItem[]>`, `replaceItems(items)`, and `refreshFromAccount(context)`
  calling `api.reqLiveItemGetManyUpcoming({ type: 'subscribed', medium: 'all', page: 1 })`.
  Export from `data/repositories/index.ts`. `rg -n "home.clips.subscribed|homeClipsCache"
apps/mobile/src` and clear the new key wherever the clips key is cleared (sign-out, account
  switch).
- `syncJobKinds.ts`: `'home-livestreams'` after `'home-clips'` in `SYNC_JOB_KINDS`; label
  `'sync.job.live_status'`.
- `syncJobPlan.ts` line 77: `planned.push({ kind: 'home-livestreams', priority });` right after
  `home-clips`.
- `syncJobs.ts`: `createHomeLivestreamsJob(deps, priority)` beside `createHomeClipsJob`
  (`buildJob('home-livestreams', priority, 'home-livestreams', async () =>
homeLivestreamsCacheRepository.refreshFromAccount(deps.getAuthContext()))`) and its case in
  the `buildSyncJobs` switch.

### `screens/home/addByRssLiveRows.ts`

```typescript
/** Upcoming live rows of ready, flagged Add by RSS feeds, live first. */
export const listAddByRssUpcomingLiveRows = async (
  readyFeeds: readonly MobileAddByRSSFeedRecord[]
): Promise<AddByRssLiveRow[]>;
```

Feeds with `mayHaveLivestreams === true` only; `addByRssRepository.getMappedFeedByUrl`, skip
`null`, `toAddByRssLiveRows`, then `sortUpcomingLiveRows` over all of them.

### `homeFeedData.ts`

- `HomeFeedRead` gains `addByRssLiveItemsById: ReadonlyMap<string, AddByRssLiveTarget>`;
  `EMPTY_HOME_ADD_BY_RSS_LIVE_ITEMS` beside plan 41's empty map; `homeFeedReadFromRows` sets it.
  Keep plan 44's `directoryItemsById` on that type and on every return, including
  `homeFeedReadFromRows`.
- A `livestreams` branch in `fetchHomeFeed` before the trailing return: `listItems()`,
  `ensureCurrent()`, `listFeedsByCredentials()`, `ensureCurrent()`,
  `listAddByRssUpcomingLiveRows(ready)`, `ensureCurrent()`. `rows =
sortUpcomingLiveRows([...mapItemsToUpcomingLiveRows(stored), ...addByRss])`; the map is
  `new Map(addByRss.map((row) => [row.id, row.target]))`. A one-line comment: the directory
  half comes from the home-livestreams job's cache, and nothing here waits on the network.
- `fetchDownloadedHomeFeedRows('livestreams')` (if reachable) returns `[]`.

### `HomeScreen.tsx`

- State `addByRssLiveItemsById`, set and reset everywhere plan 41 sets `addByRssItemsById`.
  Leave plan 44's `directoryItemsById` resets in those same places.
  `const { playItem: playAddByRssItem, playLiveItem: playAddByRssLiveItem } =
useAddByRssPlayback(…)` (extend plan 41's destructure).
- `loadFeed` offline branch: `isHomeLivestreamsUnavailableOffline` joins
  `isHomeClipsUnavailableOffline` (empty rows, no read).
- `handleRowPress`, before the trailing `runPlayAction(row, 'tracks')`:

```typescript
if (selectedMediaType === 'livestreams') {
  if (row.source !== 'addByRss') {
    navigation.navigate(HOME_STACK_ROUTES.EpisodeDetail, { episodeId: row.id });
    return;
  }
  const target = addByRssLiveItemsById.get(row.id);
  if (target === undefined) {
    return;
  }
  navigation.navigate(HOME_STACK_ROUTES.AddByRssLivestreamDetail, {
    feedIdText: target.feed.idText,
    liveItemKey: addByRssLiveItemKey(target.liveBundle, target.liveIndex),
  });
  return;
}
```

Add `addByRssLiveItemsById` to the dependency list.

- `handlePlayPress`: on livestreams, an Add by RSS row plays through `playAddByRssLiveItem`; a
  directory row calls `runPlayAction(nextRow, 'episodes')`. Only live rows have play.
- `renderItem`: `onQueue={selectedMediaType === 'livestreams' ? undefined : handleQueuePress}`;
  make `HomeFeedListItem`'s `onQueue` optional and pass it through. Confirm
  `rowAddToPlaylistPress` is undefined for livestreams.
- Share (decision 5), on plan 44's code:
  - `homeItemShareResource`'s `mediaType` widens to `'episodes' | 'tracks' | 'livestreams'`;
    `'livestreams'` → `'episode'` (a directory livestream's page is `EpisodeDetail`, so it
    shares that URL). Add by RSS stays `null`. Update its doc comment.
  - `handleSharePress`'s guard also lets `'livestreams'` through.
  - `HomeFeedListItem`, list `HomeFeedRow`, when `mediaType === 'livestreams'`: pass only
    `onSharePress={shareResource !== null ? onShare : undefined}`; no download, no Mark as
    Played. Episodes and Tracks keep plan 44's four props.
- Empty fill (around line 1076): `showClipsOfflineUnavailable` also covers livestreams (rename to
  `showNetworkListOfflineUnavailable`, testID `home-livestreams-offline-unavailable` for that
  chip). Before the `showNoSubscriptions` branches, when `selectedMediaType === 'livestreams'`,
  `status === 'authenticated'`, and `showNoSubscriptions`: `<ListEmpty
messageKey="media.livestream.no_livestreams_found" testID="home-livestreams-empty" />`.
- The sort chip already follows `isHomeSortableMediaType` (line 1407).

### Add by RSS library

- `addByRssLibraryFeedData.ts`: `AddByRssLibraryFeedResult` gains `liveItemsById:
  ReadonlyMap<string, AddByRssLiveTarget>` (empty map in the other branches). A `livestreams`
  branch, before the channel and item branches: `listAddByRssUpcomingLiveRows(ready)` (every
  ready feed) → rows and map; `needsCredentials: []`.
- `AddByRssRootScreen.tsx`: keep `liveItemsById` beside `itemRowsById` from the same read;
  `handleRowPress` and `handlePlayPress` on livestreams follow decision 6 (tap →
  `LIBRARY_STACK_ROUTES.AddByRssLivestreamDetail`; play → `playLiveItem`); no Queue or other
  More actions for livestreams; the trailing sort chip renders only when
  `isAddByRssLibrarySortableMediaType(selectedMediaType)`; empty livestreams → `ListEmpty` with
  `media.livestream.no_livestreams_found`, testID `rss-livestreams-empty`.

### `vitest.config.ts`

Add `'src/lib/addByRss/liveRows.test.ts'` beside the other `src/lib/addByRss/` entries.

## Reuse

`homeClipsCacheRepository`, the `home-clips` job, `toLiveIndexItem`, plan 89's
`addByRssLiveItemKey`, `toAddByRssLiveItemPlaybackResourceData`, and `playLiveItem`, plan 90's
`addByRssPlaybackMediaId`, plan 44's `homeItemShareResource`, plan 85's `toUpcomingLiveRow`,
`sortUpcomingLiveRows`, and `mapItemsToUpcomingLiveRows`.

## Tests

**Unit** — `lib/addByRss/liveRows.test.ts`: a feed with one live, one pending, and one ended
live item gives two rows (ended dropped); the live row has `metadata.isLive`; the pending row
has `playable: false`; each row's `target.liveIndex` matches its bundle position, and its
`playbackMediaId` equals the live playback data's media id.

**Unit** — `homeItemRowActions.test.ts`: `homeItemShareResource` on livestreams is `'episode'`
for a directory row and `null` for an Add by RSS row.

**Unit** — `sync/syncQueue.test.ts` ("adds the account-backed work once signed in", line 285):
`expect(kinds).toContain('home-livestreams')`; the signed-out case does not contain it.

**Unit** — `prefs/prefsStore.test.ts` and `prefs/homeListPrefs.test.ts`: a stored
`livestreams` Home type reads back; `isHomeSortableMediaType('livestreams')` is false.

`syncJobKinds.test.ts` and `offlineModeViews.test.ts` are not in the include; keep their
assertions accurate if they list kinds or surfaces.

Maestro is plan 87.

## Release scratchpad

Append to `release-notes/scratchpad.md`:

```markdown
## Livestreams chip on mobile Home and the Add by RSS library

- Surfaces: mobile
- Change: Home and the Add by RSS library have a Livestreams chip after Tracks. Home lists the
  livestreams of followed channels (refreshed by a background sync job) and of Add by RSS feeds;
  the library lists Add by RSS livestreams. A feed with livestreams stays on its medium's chips.
  Live now comes first and is marked Live, then scheduled ones labeled Scheduled; ended
  livestreams are not listed. Rows have no Queue, playlist, or played actions; followed
  channels' rows offer Share. An Add by RSS livestream, live or scheduled, opens its own page,
  and a live one plays from the row. In Offline Mode, Home's Livestreams chip shows the
  unavailable message.
- Who notices: mobile listeners who follow channels or Add by RSS feeds that broadcast live
- Operator steps: none
```
