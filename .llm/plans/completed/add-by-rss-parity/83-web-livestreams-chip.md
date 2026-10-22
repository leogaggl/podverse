# 83 — Web Livestreams chip on Browse and Subscribed

**Cursor model:** Cursor Grok 4.7 · **Reasoning:** high

## Rows

- **R51** (web, Browse and Subscribed): a Livestreams chip on `/browse` and `/`.
- **R52** (web, server rows): the chip lists livestream items, live first and marked, then
  scheduled, no ended; each row links to the livestream page.

Runs after plans 60–69 (the chips pages) and plan 81 (the endpoint). Plan 84 adds Add by RSS
rows to the Subscribed chip and the Add by RSS page's chip.

## Parity source

Today's unrouted Livestreams modules in `apps/web/src/app/podcasts/livestreams/` (plan 68
deleted their `page.tsx` files and kept the modules for this plan), and the Episodes chip
modules after plan 62 (`app/_media-lists/episodes/`) for the scope, chip slot, loader, and title.
Rows are today's `ListLiveItemRow`, which links to `/podcast/livestream/<id>` (or the music
route) and can show the `LiveItemStatus` badge.

## Locked decisions

1. **Chip order.** `livestreams` goes right after `tracks`, the same place as on mobile (plans
   85 and 86):
   - Subscribed: Podcasts, Episodes, Clips, Artists, Albums, Tracks, Livestreams.
   - Browse: Podcasts, Episodes, Clips, Artists, Albums, Tracks, Livestreams, Playlists, Users.
   - Add by RSS gets the same slot in plan 84, together with its page case.
2. **Label.** `media.livestream.livestreams` ("Livestreams"). No new catalog keys.
3. **Data.** One request: `reqLiveItemGetManyUpcoming({ type, medium: 'all', page })`, type
   `'global'` in browse scope and `'subscribed'` in subscribed scope. One chip covers podcasts
   and music livestreams.
4. **No controls.** No live/scheduled/ended tabs, no type dropdown, no sort, no range, no
   category, no view selector. The server order is the order.
5. **Rows only.** The list always renders rows (`viewSelected="rows"`), whatever the stored
   `vs` setting, and every row shows its status badge (Live or Scheduled).
6. **Subscribed signed out.** No request. `HowToStartInfo` shows, as on the other Subscribed
   chips.
7. **Keys.** `routeKey` `${scope}-livestreams` for the list-page cache. No `fd` filter defaults
   (nothing to persist); the old `podcasts-livestreams` and `music-livestreams` keys go.
8. **Header.** Title is the page name (`tSubscriptions('subscribed')` or
   `tFeatures('browse.browse')`), as plan 61's clients; no buttons.
9. **Old modules.** Replaced by new modules under `app/_media-lists/livestreams/`; the old
   directory, its DropdownConfig, the two route constants, and the list-wrapper stylesheet go.

## Files

All web paths are under `apps/web/src/`.

| Path                                                          | Change                    |
| ------------------------------------------------------------- | ------------------------- |
| `utils/mediaListChips.ts`                                     | Two chip lists, label key |
| `utils/mediaListChips.test.ts`                                | Orders                    |
| `app/_media-lists/livestreams/LivestreamsPageClient.tsx`      | New                       |
| `app/_media-lists/livestreams/LivestreamsPageContext.tsx`     | New                       |
| `app/_media-lists/livestreams/LivestreamsPageHeader.tsx`      | New                       |
| `app/_media-lists/livestreams/LivestreamsPageList.tsx`        | New                       |
| `app/_media-lists/livestreams/livestreamsListSsr.ts`          | New loader                |
| `app/podcasts/livestreams/` (five modules)                    | Delete                    |
| `styles/app/podcasts/livestreams/LivestreamsList.module.scss` | Delete                    |
| `app/browse/page.tsx`                                         | `livestreams` case        |
| `app/page.tsx`                                                | `livestreams` case        |
| `components/Core/Livestream/CoreLivestreams.tsx`              | `showLiveItemStatus`      |
| `components/Core/Livestream/CoreLivestreamNodes.tsx`          | Pass through (no change)  |
| `components/Common/Livestream/CommonLivestreamNodes.tsx`      | Prop type                 |
| `components/List/LiveItem/ListLiveItemNodes.tsx`              | Pass `showLiveItemStatus` |
| `utils/localSettings/localSettings.ts`                        | Drop two `fd` keys        |
| `constants/routes.ts`                                         | Drop two route constants  |

## Implementation

### `utils/mediaListChips.ts`

- `SUBSCRIBED_CHIPS` gains `'livestreams'` after `'tracks'`. `BROWSE_CHIPS` is
  `[...SUBSCRIBED_CHIPS, 'playlists', 'users']`, so Browse follows.
- `ADD_BY_RSS_CHIPS` is unchanged here (plan 84).
- `MEDIA_LIST_CHIP_LABEL_KEYS.livestreams = 'media.livestream.livestreams'`.
- `rg -n "SubscribedChip|BrowseChip|MediaListChip" apps/web/src` and fix any exhaustive switch
  the new value breaks besides the two page switches below.

### Loader `livestreamsListSsr.ts`

```typescript
export async function loadLivestreamsListProps(
  scope: MediaListScope,
  searchParams: MediaListSearchParams,
  ssr: MediaListSsr
): Promise<LivestreamsListProps>;
```

`LivestreamsListProps` is `Omit<LivestreamsPageClientProps, 'chipsNode'>`. Parse `page` the
way `episodesListSsr.ts` does (positive integer, default 1); ignore every other parameter.
Subscribed scope and `!ssr.canLoadPrivateSsrData` → `{ scope, initialPage: page, ssrItems: [],
ssrTotalPages: 1 }` with no request. Otherwise call
`ssr.ssrApiRequestService.reqLiveItemGetManyUpcoming({ type: scope === 'browse' ? 'global' :
'subscribed', medium: 'all', page })` and compute `ssrTotalPages` with `getTotalPages(meta.count,
meta.limit, data.length, page)`, as today's Context does. On a request error, follow what
`episodesListSsr.ts` does on error.

### Client, Context, Header, List

**Client** props: `scope`, `chipsNode`, `initialPage`, `ssrItems: DTOItem[]`,
`ssrTotalPages`. Same layout as today's Client: Provider, Header, `MainWrapper` →
`MainSidebarLayout` → `MainColumnStack` with `{chipsNode}` first, then the List.

**Context** (`LivestreamsListParams = { page: number }`):

- `useListPageCache<LivestreamsListParams, DTOItem[]>({ routeKey: \`${scope}-livestreams\`,
  initialParams: { page: initialPage }, ssrData: ssrItems, ssrTotalPages })`.
- The fetch effect (`useSkipInitialEffect`, `shouldSkipFetch` as today): subscribed scope and
  no `loggedInAccount` → `setItems([])`, `setTotalPages(1)`, return. Otherwise `setIsLoading`,
  call `apiRequestService.reqLiveItemGetManyUpcoming({ type, medium: 'all', page })`, set items
  and total pages, clear loading in a `finally`.
- Expose `scope`, `filterParams`, `setFilterParams`, `items`, `totalPages`, `isLoading`. No
  categories modal, no subscribe message, no `router.replace`, no `useFilterDefaults`.

**Header**: `<MainHeader title={title} />` with the scope title (decision 8).

**List**:

```tsx
<>
  {scope === 'subscribed' && !loggedInAccount && (
    <HowToStartInfo rows={items} totalPages={totalPages} />
  )}
  <CoreLivestreams
    page={filterParams.page}
    setPage={(page) => setFilterParams({ page })}
    items={items}
    totalPages={totalPages}
    viewSelected="rows"
    showChannelInfo
    showLiveItemStatus
  />
  <WebLoadingSpinnerOverlay isLoading={isLoading} />
</>
```

Use the import paths the Episodes chip modules use for the same components.

### Row status badge

- `ListLiveItemNodes` `Params` gain `showLiveItemStatus?: boolean`; the rows branch passes it to
  `ListLiveItemRow` (which already accepts it). The grid branch is unchanged.
- `CommonLivestreamListNodes` props gain the same optional prop (it spreads props through).
  `CoreLivestreamNodes` takes its props type from it and needs no edit.
- `CoreLivestreams` `Props` gain `showLiveItemStatus?: boolean` and pass it to
  `CoreLivestreamNodes`.
- `ListLiveItemRow`: confirm the badge shows Live for status live and Scheduled for pending.

### Chips pages

- `app/browse/page.tsx` (plan 63): `case 'livestreams': return <LivestreamsPageClient
key="livestreams" chipsNode={chipsNode} {...await loadLivestreamsListProps('browse', params,
ssr)} />;` after the `tracks` case.
- `app/page.tsx` (plan 64): the same with `'subscribed'`.

### Removals

- Delete `app/podcasts/livestreams/` (Client, Context, DropdownConfig, Header, List) and the
  stylesheet; remove `app/podcasts/` and `app/music/livestreams/` if they are now empty
  (`app/music/livestream/` stays).
- `utils/localSettings/localSettings.ts`: remove the `podcasts-livestreams` and `music-livestreams` entries
  (lines 76–77), `PodcastsLivestreamsFilterDefaults` and `MusicLivestreamsFilterDefaults`
  (lines 142–162), and their validation (lines 396–399). Line numbers are from before plans
  60–68; find them by name.
- `constants/routes.ts`: remove `PODCASTS_LIVESTREAMS` and `MUSIC_LIVESTREAMS`.
- Check that these find nothing in `apps/web` (a hit in e2e specs is plan 87's):

```bash
rg -n "podcasts-livestreams|music-livestreams|podcasts/livestreams" apps/web
rg -n "PODCASTS_LIVESTREAMS|MUSIC_LIVESTREAMS|LivestreamsPageDropdownConfig" apps/web
```

## Reuse

`CoreLivestreams`, `ListLiveItemRow` and its `LiveItemStatus` badge, `HowToStartInfo`,
`useListPageCache`, `getMediaListSsr`, `getTotalPages`, and plan 60's chip lists and resolver.

## Tests

**Unit** — `utils/mediaListChips.test.ts`: the Subscribed and Browse literal chip-order arrays
(plan 60's mobile-parity case) gain `'livestreams'` after `'tracks'`; add a case that
`MEDIA_LIST_CHIP_LABEL_KEYS.livestreams` is `media.livestream.livestreams`.

Playwright is plan 87.

## Release scratchpad

Append to `release-notes/scratchpad.md`:

```markdown
## Livestreams chip on web Subscribed and Browse

- Surfaces: web
- Change: Subscribed (`/?tab=livestreams`) and Browse (`/browse?tab=livestreams`) have a
  Livestreams chip after Tracks. It lists livestreams on the air now first, marked Live, then
  scheduled ones marked Scheduled, by start time; ended livestreams are not listed. Each row
  opens the livestream page. Podcast and music livestreams share the chip.
- Who notices: web listeners who follow channels that broadcast live
- Operator steps: none
```
