# 66 — Web Subscribed Episodes and Tracks include Add by RSS items

**Cursor model:** Cursor Grok 4.7 · **Reasoning:** extra high

Rows: R20, R22, R47 (item chips). Web only. Paths are under `apps/web/src/` unless stated. Runs
after plans 62 and 65 (it reuses `useReadyAddByRSSFeeds`). Clips stays server only: Add by RSS
feeds have no clips.

Parity source: mobile plan 41 (`homeItemMerge.ts`): each source keeps its own newest 60; Recent
is newest first across both; Popularity lists the ranked server rows, then Add by RSS rows newest
first. On web, rows come from the existing server list and the Add by RSS library rows
(`AddByRSSEpisodesListNodes`, `AddByRSSTrackNodes`).

## Locked decisions

1. **Which items.** Episodes takes the items of ready feeds whose `resourceType` is `podcasts`
   or `episodes`. Tracks takes ready feeds of type `artists`, `albums`, or `tracks`. Same split
   as mobile and the library. Livestreams are a per-feed flag, not a resource type (plans 82 and
   88); a feed's live items are plan 84's.
1. **Window.** The 60 newest of those items (`PAGINATION.DEFAULT_LIMIT`), by `pubDateMs`; an item
   with `pubDateMs` 0 (no date) sorts after dated items.
1. **Where they go.** Server paging stays as it is.
   - `recent`: on page 1 only, the Add by RSS items interleave with the server rows, newest
     first; undated rows go last. Page 1 can hold up to 120 rows.
   - `top`: on the last server page (`page === totalPages`, page 1 when the account follows
     nothing on the server), after the server rows, newest first.
   - A tie in date puts the server row first. Server rows keep their order.
1. **Item index.** Add by RSS rows need index items (their `idText` is the detail URL and the
   play key). The hook rebuilds the index from every stored feed
   (`buildAddByRSSItemsIndex(await getAllAddByRSSFeeds())`), which keeps each item's `idText`,
   then reads it. It rebuilds on mount and after each feed change, as the Tracks library does on
   every visit.
1. **Rows.** Server rows render as today (live rows included). Add by RSS rows render with
   `AddByRSSEpisodeRow` / `AddByRSSEpisodeGridCard` and `AddByRSSTrackRow` /
   `AddByRSSTrackGridCard`, with the same list context the library builds from the Add by RSS
   rows on the page, in display order.
1. **When nothing changes.** Signed out, browse scope, Clips, or no ready items: the list is
   exactly plan 62's.

## Files

| File                                                        | Change                 |
| ----------------------------------------------------------- | ---------------------- |
| `hooks/useSubscribedAddByRSSItems.ts`                       | New                    |
| `utils/subscribed/mergeSubscribedItems.ts`                  | New: pure merge        |
| `utils/subscribed/mergeSubscribedItems.test.ts`             | New, Vitest            |
| `components/Common/Podcast/Episode/CommonEpisodeNodes.tsx`  | Extract the row switch |
| `components/Common/Artist/Album/Track/CommonTrackNodes.tsx` | Extract the row switch |
| `components/Subscribed/SubscribedEpisodeNodes.tsx`          | New                    |
| `components/Subscribed/SubscribedTrackNodes.tsx`            | New                    |
| `components/Core/Podcast/Episodes/CoreEpisodes.tsx`         | Optional `entries`     |
| `components/Core/Artist/Album/Track/CoreTracks.tsx`         | Optional `entries`     |
| `app/_media-lists/episodes/EpisodesPageList.tsx`            | Merge                  |
| `app/_media-lists/tracks/TracksPageList.tsx`                | Merge                  |

## Implementation

### `hooks/useSubscribedAddByRSSItems.ts`

```typescript
export function useSubscribedAddByRSSItems(
  resourceTypes: readonly AddByRSSResourceType[]
): { items: AddByRSSItemIndexItem[]; isReady: boolean };
```

- `const { feeds, isReady } = useReadyAddByRSSFeeds(resourceTypes);`
- When `isReady` and `feeds` is non-empty, on each new `feeds` array: rebuild the index
  (decision 4), `getAllAddByRSSItems()`, keep items whose `channelIdText` is a ready feed's
  `idText`, sort by `pubDateMs` descending with 0 last, and keep the first 60.
- Empty `feeds`: no index work; `items` is empty and `isReady` follows the feeds hook.
- `isReady` is false until the first read after the feeds are ready. Ignore results that land
  after unmount or after a newer read started. Errors: `console.error`, empty items.

### `utils/subscribed/mergeSubscribedItems.ts`

```typescript
export type SubscribedItemEntry =
  | { source: 'server'; item: DTOItem }
  | { source: 'add-by-rss'; item: AddByRSSItemIndexItem };

export const mergeSubscribedItemEntries = (params: {
  serverItems: readonly DTOItem[];
  addByRSSItems: readonly AddByRSSItemIndexItem[];
  sort: 'recent' | 'top';
  page: number;
  totalPages: number;
}): SubscribedItemEntry[];
```

Dates: server `item.pub_date` through `toEpochMsOrNull` (plan 65); Add by RSS `pubDateMs`, with 0
read as null. Apply decision 3. On a page where Add by RSS items do not go, return the server
items as server entries. `addByRSSItems` arrive sorted from the hook; the merge does not re-sort
them except to place undated items last.

### Row switch extraction

In `CommonEpisodeNodes.tsx`, move the rows branch's `item.live_item ? <ListLiveItemRow … /> :
<CommonEpisodeListRow … />` into an exported `CommonEpisodeListItemRow` component (props
`channel`, `item`, `showChannelInfo`) in the same file, and use it in `CommonEpisodeListNodes`.
Do the same in `CommonTrackNodes.tsx` as `CommonTrackListItemRow`. Output does not change.

### `components/Subscribed/SubscribedEpisodeNodes.tsx`

Props: `entries: readonly SubscribedItemEntry[]`, `viewSelected`, `showChannelInfo`.

- Drop server entries whose `item.channel` is missing, as `CommonEpisodeListNodes` does.
- Build `listContext` for Add by RSS rows once: `itemIdTexts` from the Add by RSS entries in
  order, `feedIdText` from the first of them, `sortOrder: 'recent'`, and `currentIndex` the row's
  position among them.
- Rows view: `styles.list` from `ListNodes.module.scss`; each entry renders
  `CommonEpisodeListItemRow` (server) or `AddByRSSEpisodeRow` with the props
  `AddByRSSEpisodesListNodes` passes (Add by RSS), with a `Divider` between entries. Key by
  `item.id`.
- Grid view: `styles.grid`; `CommonEpisodeListGridNode` or `<AddByRSSEpisodeGridCard item={…}
showChannelInfo />`.

`SubscribedTrackNodes.tsx` is the same with `styles.listTracks`, `CommonTrackListItemRow`,
`CommonTrackListGridNode`, `AddByRSSTrackRow`, and `AddByRSSTrackGridCard`.

### Core list components

`CoreEpisodes` and `CoreTracks` take an optional `entries?: readonly SubscribedItemEntry[]`. When
given, the Pagination body is `SubscribedEpisodeNodes` / `SubscribedTrackNodes` and the scroll
effect watches `entries`. Without it, nothing changes.

### List files

`EpisodesPageList.tsx`:

```typescript
const ADD_BY_RSS_EPISODE_TYPES = ['podcasts', 'episodes'] as const;
// inside the component:
const addByRSS = useSubscribedAddByRSSItems(
  scope === 'subscribed' ? ADD_BY_RSS_EPISODE_TYPES : NO_TYPES
);
const entries = useMemo(
  () =>
    addByRSS.items.length === 0
      ? undefined
      : mergeSubscribedItemEntries({ serverItems: items, addByRSSItems: addByRSS.items, sort,
          page, totalPages }),
  [addByRSS.items, items, page, sort, totalPages]
);
```

Pass `entries` to `CoreEpisodes`. `HowToStartInfo` gets `entries ?? items` as `rows`, so an
account that follows only Add by RSS feeds does not see the getting-started message.
`TracksPageList.tsx` is the same with `['artists', 'albums', 'tracks']`. `NO_TYPES` is a
module-level empty array. `scope` and `sort` come from the list context (plan 62).

## Reuse

`useReadyAddByRSSFeeds` and `toEpochMsOrNull` (plan 65), `buildAddByRSSItemsIndex`,
`getAllAddByRSSItems`, the Common episode and track rows, and the Add by RSS library rows and
list context (`AddByRSSEpisodesListNodes`, `AddByRSSTrackNodes`).

## Tests

**Unit** — `utils/subscribed/mergeSubscribedItems.test.ts` (Vitest, minimal `DTOItem` and index
item fixtures built by small local helpers):

- `recent`, page 1: a newer Add by RSS item lands before an older server row; an undated Add by
  RSS item lands after every dated row.
- `recent`, page 2: server rows only.
- `top`, `page === totalPages`: server rows in their order, then Add by RSS items.
- `top`, page 1 of 3: server rows only.
- `top` with no server rows (`totalPages` 1): only Add by RSS items, newest first.
- A date tie puts the server row first.

Playwright coverage is in plan 69 (an Add by RSS episode shows on the Subscribed Episodes chip).

## Release scratchpad

```markdown
## Web Subscribed Episodes and Tracks include Add by RSS items

- Surfaces: web
- Change: On Subscribed (`/`), the Episodes and Tracks chips also show the 60 newest items from
  this browser's Add by RSS feeds. Under "Recent" they mix into the first page by date; under
  "Top" they follow the ranked items on the last page. Clips stays server only.
- Who notices: signed-in web users who follow Add by RSS feeds
- Operator steps: none
```
