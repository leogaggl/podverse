# 84 — Web Add by RSS livestreams: Subscribed merge and the Add by RSS chip

**Cursor model:** Cursor Grok 4.7 · **Reasoning:** high

## Rows

- **R51** (web, Add by RSS): a Livestreams chip on `/add-by-rss`; Add by RSS livestreams also
  appear in the Subscribed Livestreams chip.
- **R52** (web, Add by RSS rows): live first and marked, then scheduled, no ended; rows open the
  Add by RSS livestream page.
- **R53** (web read side): only feeds whose device flag (plan 82) is set are read.
- **R62** (web): livestreams are found through the flag, never through a resource type.

Runs after plan 83 (the Subscribed chip), plans 65–67 (`useReadyAddByRSSFeeds`, the Subscribed
merge pattern, the Add by RSS chips page), plan 82 (the flag), and plan 88 (no `'livestreams'`
resource type; `ADD_BY_RSS_RESOURCE_TYPES`).

## Flag only (R62)

The Livestreams chip is a list of live **items**. It reads every ready feed whatever its
`resourceType` (podcasts, artists, or albums), keeps the flagged ones, and lists their upcoming
live items. A flagged feed also stays on its medium's chip (Podcasts, or Artists and Albums) and
its regular items stay on Episodes or Tracks; nothing here moves or hides them. The
`'livestreams'` value in `ADD_BY_RSS_CHIPS` is a chip id, not a resource type.

## Parity source

- Plan 66's Episodes merge (`useSubscribedAddByRSSItems`, `mergeSubscribedItemEntries`,
  `SubscribedEpisodeNodes`, `CoreEpisodes` `entries`) for how Add by RSS rows join a server list.
- `AddByRSSEpisodesPageClient` (after plan 67, in `components/AddByRSS/List/`) for the Add by
  RSS chip's header, Check for Updates, toasts, and signed-out behavior.
- `AddByRSSLivestreamNodes` / `AddByRSSLivestreamRow` for the rows; the row always shows the
  `LiveItemStatus` badge and links to the Add by RSS livestream detail page.

## Locked decisions

1. **One hook for both lists.** `useUpcomingAddByRSSLivestreams(active)` reads ready Add by RSS
   feeds of every resource type (`ADD_BY_RSS_RESOURCE_TYPES`, plan 88) through
   `useReadyAddByRSSFeeds`, keeps feeds for which
   `addByRSSFeedMayHaveLivestreams(feed.mayHaveLivestreams, feed.mappedFeed)` is true, and
   returns their upcoming live items, sorted with `compareUpcomingLiveItems` (plan 81).
2. **Index.** `buildAddByRSSLivestreamIndex` clears and rebuilds the whole livestream index from
   the feeds it is given, so the hook passes `await getAllAddByRSSFeeds()` (not only the ready
   feeds) and filters its return value. No other read is needed.
3. **Start time.** `startTimeMs` of 0 or less reads as no start time (sorts last in its group).
4. **Subscribed merge.** On page 1 only, server and Add by RSS items merge with
   `compareUpcomingLiveItems`; a tie keeps the server row first. Later pages are server rows
   only. Signed out, nothing is read (plan 83's `HowToStartInfo` stays).
5. **Add by RSS chip.** Rows only, no pagination (all upcoming items on one page), no sort
   dropdown, no view selector. Check for Updates and Add Feed stay as on the other chips.
6. **Empty state.** `media.livestream.no_livestreams_found` on both lists (Subscribed through
   `CoreLivestreams`).
7. **Refresh.** No timer. The hook re-reads when `useReadyAddByRSSFeeds` hands it a new feeds
   array (it already listens to feed-changed events), so a finished parse refreshes the list.

## Files

All web paths are under `apps/web/src/`.

| Path                                                         | Change                  |
| ------------------------------------------------------------ | ----------------------- |
| `utils/subscribed/mergeSubscribedLivestreams.ts`             | New, pure               |
| `utils/subscribed/mergeSubscribedLivestreams.test.ts`        | New, Vitest             |
| `hooks/useUpcomingAddByRSSLivestreams.ts`                    | New                     |
| `components/Subscribed/SubscribedLivestreamNodes.tsx`        | New                     |
| `components/Core/Livestream/CoreLivestreams.tsx`             | Optional `entries`      |
| `app/_media-lists/livestreams/LivestreamsPageList.tsx`       | Merge in subscribed     |
| `components/AddByRSS/List/AddByRSSLivestreamsPageClient.tsx` | New                     |
| `components/AddByRSS/List/AddByRSSListHeader.tsx`            | `showViewSelector` prop |
| `utils/mediaListChips.ts`                                    | `ADD_BY_RSS_CHIPS`      |
| `utils/mediaListChips.test.ts`                               | Add by RSS order        |
| `app/add-by-rss/page.tsx`                                    | `livestreams` case      |

## Implementation

### `utils/subscribed/mergeSubscribedLivestreams.ts` (pure)

```typescript
export type SubscribedLivestreamEntry =
  | { source: 'server'; item: DTOItem }
  | { source: 'add-by-rss'; item: AddByRSSLivestreamIndexItem };

/** Upcoming live items of the flagged feeds, live first, then scheduled. */
export const selectUpcomingAddByRSSLivestreams = (
  items: readonly AddByRSSLivestreamIndexItem[],
  flaggedFeedIdTexts: ReadonlySet<string>
): AddByRSSLivestreamIndexItem[];

export const mergeSubscribedLivestreamEntries = (params: {
  serverItems: readonly DTOItem[];
  addByRSSItems: readonly AddByRSSLivestreamIndexItem[];
  page: number;
}): SubscribedLivestreamEntry[];
```

- `selectUpcomingAddByRSSLivestreams`: keep items whose `channelIdText` is in the set and whose
  `isUpcomingLiveItemStatus(item.liveItem.live_item_status)` is true; sort a copy with
  `compareUpcomingLiveItems` over `{ statusId: item.liveItem.live_item_status, startTimeMs:
item.startTimeMs > 0 ? item.startTimeMs : null }`.
- `mergeSubscribedLivestreamEntries`: `page !== 1` or no Add by RSS items → server entries only.
  Otherwise build entries with sort keys (server: `item.live_item?.live_item_status_id` and
  `toEpochMsOrNull(item.live_item?.start_time)` from plan 65), list server entries first, then
  Add by RSS entries, and stable-sort the whole list with `compareUpcomingLiveItems` (equal keys
  keep server first).

If `live_item_status` is typed as a string status rather than `LiveItemStatusEnum`, convert it
with the helper `buildAddByRSSResourceData` uses for the same field; do not cast.

### `hooks/useUpcomingAddByRSSLivestreams.ts`

```typescript
export function useUpcomingAddByRSSLivestreams(
  active: boolean
): { items: AddByRSSLivestreamIndexItem[]; isReady: boolean };
```

- Module constant `NO_TYPES = []`; import `ADD_BY_RSS_RESOURCE_TYPES` (the five resource
  types) from `@podverse/parser-mapping`. `const { feeds, isReady: feedsReady } =
useReadyAddByRSSFeeds(active ? ADD_BY_RSS_RESOURCE_TYPES : NO_TYPES);`
- On each new `feeds` array once `feedsReady`: flagged ids = `feeds` filtered by decision 1. None
  → `items` `[]`, ready. Else `buildAddByRSSLivestreamIndex(await getAllAddByRSSFeeds())`, then
  `selectUpcomingAddByRSSLivestreams(result, flaggedIds)`.
- Same guards as plan 66's hook: ignore results after unmount or after a newer read started;
  errors → `console.error` and `[]`. `isReady` is false until the first read after the feeds are
  ready, and true at once when inactive.

### `components/Subscribed/SubscribedLivestreamNodes.tsx`

Props: `entries: readonly SubscribedLivestreamEntry[]`, `showChannelInfo?: boolean`. Rows only,
`styles.list` from `ListNodes.module.scss`, a `Divider` between entries, key `item.id`.

- Server entries without `item.channel` or `item.live_item` are dropped, as
  `ListLiveItemNodes` does. The rest render `ListLiveItemRow` with `channel`, `item`,
  `live_item`, `showChannelInfo`, and `showLiveItemStatus`.
- Add by RSS entries render `AddByRSSLivestreamRow` with `item`, `showChannelInfo`, and the
  `listContext` `AddByRSSLivestreamNodes` builds (`feedIdText` from the first Add by RSS entry,
  `itemIdTexts` of the Add by RSS entries in order, `currentIndex` among them, `sortOrder:
'recent'`).

### `CoreLivestreams`

Optional `entries?: readonly SubscribedLivestreamEntry[]`. When given, the Pagination body is
`<SubscribedLivestreamNodes entries={entries} showChannelInfo={showChannelInfo} />`, the scroll
effect watches `entries`, and the empty check reads `entries.length`. Without it, nothing
changes.

### `LivestreamsPageList.tsx` (from plan 83)

```typescript
const addByRSS = useUpcomingAddByRSSLivestreams(scope === 'subscribed' && !!loggedInAccount);
const entries = useMemo(
  () =>
    addByRSS.items.length === 0
      ? undefined
      : mergeSubscribedLivestreamEntries({ serverItems: items, addByRSSItems: addByRSS.items,
          page: filterParams.page }),
  [addByRSS.items, filterParams.page, items]
);
```

Pass `entries` to `CoreLivestreams`; `HowToStartInfo` gets `entries ?? items` as `rows` (match
plan 66's change to its prop type).

### Add by RSS chip

- `utils/mediaListChips.ts`: `ADD_BY_RSS_CHIPS` gains `'livestreams'` after `'tracks'`.
- `app/add-by-rss/page.tsx`: `case 'livestreams': return <AddByRSSLivestreamsPageClient
key="livestreams" chipsNode={chipsNode} />;` after `tracks`.
- `AddByRSSListHeader`: optional `showViewSelector?: boolean` (default `true`); when false, the
  `ViewSelector` is not rendered. Other callers are unchanged.
- `AddByRSSLivestreamsPageClient.tsx` (`'use client'`), props `chipsNode: React.ReactNode`:
  - `useAccount`, `useModals`, `useLocalSettings` (for the header's required view props),
    translations as in the Episodes client.
  - `const { items, isReady } = useUpcomingAddByRSSLivestreams(!!loggedInAccount);`
  - Header: `<AddByRSSListHeader title={tFeatures('add_by_rss.label')} isUpdating={isUpdating}
onCheckUpdates={handleCheckForUpdates} checkUpdatesLabel={tFeatures('add_by_rss.check_updates')}
viewSelected={viewSelected} setViewSelected={setViewSelected} showViewSelector={false} />`.
  - `handleCheckForUpdates`: the Episodes client's handler without the index-page refresh
    (decision 7): sign-in modal when signed out, delayed loading toast, `runAddByRSSParseAll`
    with `applyAddByRSSParseStatus`, the same wait/done/failed toasts.
  - Body inside `MainColumnStack`: `{chipsNode}`; signed out → what the Episodes client shows
    signed out; ready with items → `<AddByRSSLivestreamNodes items={items} viewSelected="rows"
showChannelInfo />`; ready and empty → `<NoResults
message={tMedia('livestream.no_livestreams_found')} />`; `<WebLoadingSpinnerOverlay
isLoading={!!loggedInAccount && !isReady} />`.

## Reuse

`useReadyAddByRSSFeeds`, `toEpochMsOrNull` (plan 65), plan 66's merge shape,
`buildAddByRSSLivestreamIndex`, `getAllAddByRSSFeeds`, `addByRSSFeedMayHaveLivestreams` (plan
82), `compareUpcomingLiveItems` / `isUpcomingLiveItemStatus` (plan 81), `AddByRSSLivestreamNodes`,
`AddByRSSLivestreamRow`, `ListLiveItemRow`, `AddByRSSListHeader`, `NoResults`.

## Tests

**Unit** — `mergeSubscribedLivestreams.test.ts`:

- `selectUpcomingAddByRSSLivestreams`: drops an ended item and an item of an unflagged feed;
  orders a scheduled item after a live one; a 0 start time sorts after a dated scheduled item.
- `mergeSubscribedLivestreamEntries`, page 1: a live Add by RSS item that started earlier lands
  before a live server item; a scheduled Add by RSS item lands after every live server item;
  equal keys keep the server item first.
- Page 2: server entries only, in server order.

**Unit** — `mediaListChips.test.ts`: the Add by RSS literal order gains `'livestreams'` after
`'tracks'`.

Playwright is plan 87.

## Release scratchpad

Append to `release-notes/scratchpad.md`:

```markdown
## Add by RSS livestreams on web

- Surfaces: web
- Change: the Add by RSS page has a Livestreams chip after Tracks, listing the livestreams of
  followed Add by RSS feeds: live now first, marked Live, then scheduled. The Subscribed
  Livestreams chip lists those Add by RSS livestreams too, merged by the same order on its first
  page. Each row opens the Add by RSS livestream page. A feed with livestreams stays on its
  Podcasts or Artists and Albums chip; livestreams are a flag on the feed, not a feed type.
- Who notices: web listeners who add feeds by RSS that broadcast live
- Operator steps: none
```
