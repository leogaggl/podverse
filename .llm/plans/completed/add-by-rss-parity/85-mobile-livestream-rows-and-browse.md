# 85 — Mobile livestream rows and the Browse Livestreams chip

**Cursor model:** Cursor Grok 4.7 · **Reasoning:** high

## Rows

- **R51** (mobile, Browse): a Livestreams chip on Browse.
- **R52** (mobile, shared rows): live first and marked Live, then scheduled marked Scheduled, no
  ended; rows go straight to the livestream.
- **R60** (mobile, shared rows and Browse): decision 7, the row actions.

Runs after plans 40–43 (mobile Home and Add by RSS library), plan 10 (`HomeFeedRow` styling),
and plan 81 (the endpoint). Plan 86 uses this plan's row helpers for Home and the Add by RSS
library.

## Parity source

The podcast page's live rows in `src/screens/podcast/sections/PodcastEpisodesSection.tsx`:
`LIVE_ROW_METADATA` (the Live chip), the Scheduled subtitle prefix, a tap that opens
`EpisodeDetail`, and play through `runPlayAction(row, 'episodes')`. The Browse Episodes chip is
the source for list chrome.

## Locked decisions

1. **Chip order.** `livestreams` right after `tracks`: Browse is Podcasts, Episodes, Clips,
   Artists, Albums, Tracks, Livestreams, Playlists, Users (the same as web, plan 83).
2. **Label.** `media.livestream.livestreams`. Empty state: `media.livestream.no_livestreams_found`.
   No new catalog keys.
3. **Data.** `reqLiveItemGetManyUpcoming({ type: 'global', medium: 'all', page: 1 })` through
   `requestWithMobileAuthRefresh`, like the other Browse lists. Online only, as all of Browse.
4. **No controls.** Not sortable (no range chip), no categories, no grid, no filter.
5. **Marking.** A live row carries `LIVE_ROW_METADATA` (the existing Live chip). A scheduled row
   shows `"<Scheduled> • <channel>"` as its context line, and has `playable: false`.
6. **Row status lives on the row.** `HomeFeedRowData.liveStatusId?: LiveItemStatusEnum | null`.
   `HomeFeedRow` adds the Scheduled prefix itself, so Browse, Home, and the Add by RSS library
   get it from one place. `PodcastEpisodesSection` keeps its own prefix code unchanged.
7. **Taps and actions (directory rows).** Row tap → `EpisodeDetail` on the current stack. Play
   (live only) → `runPlayAction(row, 'episodes')`. Livestreams chip rows offer no Queue Next,
   Queue Last, Add to Playlist, Mark as Played, or Download on any surface: a broadcast has no
   fixed length to queue behind or finish. Directory rows offer Share, the same URL the
   livestream's page shares (`buildPublicShareUrl('episode', row.id)`); Add by RSS rows (plan
   86) offer nothing, so they show no More. `HomeFeedRow.onQueuePress` becomes optional for
   this; every other caller keeps passing it.
8. **Playable type.** `isPlayableDirectoryMediaType('livestreams')` is true, so a live row shows
   play; `playable: false` hides it on scheduled rows.

## Files

All mobile paths are under `apps/mobile/src/`.

| Path                                                  | Change                           |
| ----------------------------------------------------- | -------------------------------- |
| `screens/browse/browseTypes.ts`                       | Type, order, label, predicates   |
| `screens/browse/browseListPrefs.ts`                   | Check view-mode predicate        |
| `lib/rows/liveItemRows.ts`                            | New, pure                        |
| `lib/rows/liveItemRows.test.ts`                       | New, Vitest                      |
| `screens/home/homeFeedData.ts`                        | `liveStatusId`, directory mapper |
| `screens/home/HomeFeedRow.tsx`                        | Scheduled prefix, optional Queue |
| `screens/podcast/sections/PodcastEpisodesSection.tsx` | Import `LIVE_ROW_METADATA`       |
| `screens/browse/browseFeedData.ts`                    | `livestreams` branch             |
| `screens/browse/BrowseScreen.tsx`                     | Tap, play, Share, empty state    |
| `vitest.config.ts`                                    | Include the new test             |

## Implementation

### `browseTypes.ts`

- `BROWSE_MEDIA_TYPE_ORDER`: insert `'livestreams'` after `'tracks'`.
- `MEDIA_TYPE_LABEL_KEYS.livestreams = 'media.livestream.livestreams'`.
- `isBrowseSortableMediaType(mediaType)` returns `mediaType !== 'livestreams'`; update its doc
  comment ("Every Browse directory list except Livestreams is popularity-ranked …").
- `isPlayableDirectoryMediaType` adds `|| mediaType === 'livestreams'`.
- `HOME_MEDIA_TYPE_ORDER` is plan 86's.
- `rg -n "BrowseMediaType|DirectoryMediaType" apps/mobile/src` and handle every `Record<…>` or
  exhaustive branch the new value breaks. `browseListPrefs.ts`: confirm
  `isBrowseViewModeMediaType('livestreams')` is false (it should follow channel types only).

### `lib/rows/liveItemRows.ts` (pure, new)

Imports: `LiveItemStatusEnum` and `isUpcomingLiveItemStatus`, `compareUpcomingLiveItems` from
`@podverse/helpers`; types `HomeFeedRowData` (from `../../screens/home/homeFeedData`) and
`HomeRowMetadata`. No repository imports.

```typescript
/** What a broadcasting row claims: on the air, and nothing else a subscription says. */
export const LIVE_ROW_METADATA: HomeRowMetadata = { … }; // moved from PodcastEpisodesSection

export type UpcomingLiveRow = HomeFeedRowData & {
  liveStatusId: LiveItemStatusEnum;
  startTimeMs: number | null;
};

/** Marks a row live or scheduled; null when the status is not upcoming. */
export const toUpcomingLiveRow = (
  row: HomeFeedRowData,
  statusId: LiveItemStatusEnum | null | undefined,
  startTime: Date | string | number | null | undefined
): UpcomingLiveRow | null;

/** Live first, then scheduled, by start time (`compareUpcomingLiveItems`); stable. */
export const sortUpcomingLiveRows = <T extends UpcomingLiveRow>(rows: readonly T[]): T[];
```

`toUpcomingLiveRow`: `isUpcomingLiveItemStatus(statusId)` false → `null`. Otherwise
`{ ...row, liveStatusId: statusId, startTimeMs, metadata: statusId === Live ? LIVE_ROW_METADATA :
row.metadata, playable: statusId === Live ? row.playable : false }`. `startTimeMs`: a finite
number, a parsed ISO string, or a `Date`'s time; anything else (or ≤ 0) is `null`. Also set
`updatedAt` to the start time when the row has none, so the row's date line reads the start.

Move `LIVE_ROW_METADATA` here; `PodcastEpisodesSection.tsx` imports it from
`../../../lib/rows/liveItemRows` and drops its local copy.

### `homeFeedData.ts`

- `HomeFeedRowData` gains `liveStatusId?: LiveItemStatusEnum | null;` with a short doc comment
  (set on livestream rows; drives the Scheduled prefix).
- Export:

```typescript
/** Upcoming livestream rows from directory items, live first; ended items are dropped. */
export const mapItemsToUpcomingLiveRows = (items: readonly DTOItem[]): UpcomingLiveRow[] =>
  sortUpcomingLiveRows(
    items.flatMap((item) => {
      const row = toUpcomingLiveRow(
        mapItemToHomeFeedRow(item),
        item.live_item?.live_item_status_id,
        item.live_item?.start_time
      );
      return row === null || row.id.length === 0 ? [] : [row];
    })
  );
```

`homeFeedData.ts` importing values from `lib/rows/liveItemRows.ts` is fine; `liveItemRows.ts`
imports only the type back.

### `HomeFeedRow.tsx`

Where `channelLabel` is computed (around line 382 before plan 10): when `row.liveStatusId ===
LiveItemStatusEnum.Pending`, the label is `` `${t('media.livestream.pending')} • ${subtitle}` ``
(or just the Scheduled word when the subtitle is empty), using the same `contextLineVisible` and
`isChannelList` guards. Keep plan 10's and plan 90's edits.

`onQueuePress` becomes optional (`onQueuePress?: …`, doc: "Omit for rows that cannot be
queued"). In `moreActions`, `onQueueLast` and `onQueueNext` are `undefined` when it is missing;
`buildMediaRowMoreActions` already drops undefined handlers.

### `browseFeedData.ts`

Before the `episodes || tracks` branch:

```typescript
if (mediaType === 'livestreams') {
  const response = await requestWithMobileAuthRefresh(authDeps, async (api) =>
    api.reqLiveItemGetManyUpcoming({ type: 'global', medium: 'all', page: BROWSE_FEED_PAGE })
  );
  return { kind: 'media', rows: mapItemsToUpcomingLiveRows(response.data) };
}
```

Match the exact `requestWithMobileAuthRefresh` call shape of the clips branch.

### `BrowseScreen.tsx`

- `handleRowPress`: `if (selectedMediaType === 'livestreams') { navigation.navigate(
BROWSE_STACK_ROUTES.EpisodeDetail, { episodeId: row.id }); return; }`.
- `browsePlayMediaType` returns `'episodes'` for livestreams already (the fallthrough); leave it.
- `addToPlaylistTarget` stays `null` for livestreams (no change needed; confirm).
- `BrowseFeedItem` (around line 195): its `onQueue` prop becomes optional and is passed through
  as `onQueuePress`. The list passes `onQueue={selectedMediaType === 'livestreams' ? undefined :
handleQueuePress}` (use the handler name the file has).
- Share (decision 7): `BrowseFeedItem` gains `share?: (row: HomeFeedRowData) => void`, passed as
  `onSharePress`. A module-scope `shareLivestreamRow = (row) =>
  shareResolvedUrl(buildPublicShareUrl('episode', row.id))` (from
  `../../lib/share/shareNowPlaying`); the list passes `share={selectedMediaType ===
  'livestreams' ? shareLivestreamRow : undefined}`. Browse passes no Mark as Played or download
  props today; keep it so. Go to Podcast stays tracks-only (`rowGoToChannel`).
- The empty state (line 946): `messageKey={selectedMediaType === 'livestreams' ?
'media.livestream.no_livestreams_found' : 'features.browse.empty'}`.
- The range chip and category chip follow the predicates; no other change.

### `vitest.config.ts`

Add `'src/lib/rows/liveItemRows.test.ts'` after `'src/lib/rows/homeRowMappers.test.ts'`.

## Reuse

`mapItemToHomeFeedRow`, `LIVE_ROW_METADATA`, `useHomeRowPlayback.runPlayAction`, the Browse
fetch pattern, `HomeFeedRow`'s existing Live chip, and plan 81's comparator.

## Tests

**Unit** — `lib/rows/liveItemRows.test.ts`:

- `toUpcomingLiveRow`: Ended → null; Live → `metadata.isLive` true and play left as is;
  Pending → `playable: false` and `liveStatusId` Pending; an ISO start becomes `startTimeMs`.
- `sortUpcomingLiveRows`: a live row that started later still sorts before a scheduled row; two
  scheduled rows sort by start; equal keys keep input order.

`browseTypes.test.ts` is not in the vitest include; if it asserts the Browse order or the
sortable predicate, update those cases so the file stays accurate.

Maestro is plan 87.

## Release scratchpad

Append to `release-notes/scratchpad.md`:

```markdown
## Livestreams chip on mobile Browse

- Surfaces: mobile
- Change: Browse has a Livestreams chip after Tracks. It lists livestreams on the air now,
  marked Live, then scheduled ones, labeled Scheduled, by start time; ended livestreams are not
  listed. Tapping a row opens the livestream; play starts a live one. No range or category
  chips. A row's More menu offers Share only: no Queue, playlist, or played actions.
- Who notices: mobile listeners browsing for live shows
- Operator steps: none
```
