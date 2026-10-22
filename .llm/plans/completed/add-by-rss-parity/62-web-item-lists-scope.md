# 62 — Web item list modules gain a scope (Episodes, Clips, Tracks)

**Cursor model:** Cursor Grok 4.7 · **Reasoning:** medium

Rows: R47, R48, R50 (the `/episodes`, `/clips`, `/tracks` routes go away). Web only. Paths are
under `apps/web/src/` unless stated. Runs after plan 61; read its § Move, § Loaders, and § Scope
transformation first. This plan applies them to three more lists.

Parity source: today's `/episodes`, `/clips`, and `/tracks` list pages, as in plan 61.

## Locked decisions

1. **Where the modules live.** `app/_media-lists/episodes/`, `app/_media-lists/clips/`, and
   `app/_media-lists/tracks/`, moved with `git mv` and with relative imports deepened as plan 61
   § Move says. `clips/` imports `../episodes/EpisodesPageDropdownConfig`; both folders move
   together, so that import stays as it is.
1. **Subscribed scope.** Type `'subscribed'`, no type dropdown, no category. Signed out, no
   server request (`ssrItems`/`ssrClips` `[]`, `ssrTotalPages: 1`).
1. **Browse scope.** Episodes and Clips: type dropdown with Global and Category. Tracks: no type
   dropdown (music has no category).
1. **Keys per scope:**

   | List     | `routeKey`          | `fd` key                           |
   | -------- | ------------------- | ---------------------------------- |
   | Episodes | `${scope}-episodes` | `subscribed-episodes` / `episodes` |
   | Clips    | `${scope}-clips`    | `subscribed-clips` / `clips`       |
   | Tracks   | `${scope}-tracks`   | `subscribed-tracks` / `tracks`     |

   Item lists keep the global list/grid setting (`vs`), as today; no view-mode scope is added.

1. **Category links.** `linkPath` is `buildMediaListChipPath('browse', '<chip>')`, for example
   `/browse?tab=episodes`. Plan 60's `onClickCategory` change appends `&category=…`.
1. **Clearing `category` from the URL.** Today the Episodes and Clips contexts call
   `router.replace(removeQueryParamByPattern(ROUTES.EPISODES, 'category'))` after every fetch
   without a category. That would drop `tab` and re-request the page each time. Replace it in
   both contexts with:

   ```typescript
   if (!filterParams.category && new URLSearchParams(window.location.search).has('category')) {
     router.replace(
       removeQueryParamByPattern(`${window.location.pathname}${window.location.search}`, 'category')
     );
   }
   ```

1. **Header title.** As plan 61 decision 6: the page's name, with ` > <Category>` when a category
   is set.

## Files

| File                                                           | Change                          |
| -------------------------------------------------------------- | ------------------------------- |
| `app/episodes/*` → `app/_media-lists/episodes/`                | Move, then edit                 |
| `app/clips/*` → `app/_media-lists/clips/`                      | Move, then edit                 |
| `app/tracks/*` → `app/_media-lists/tracks/`                    | Move, then edit                 |
| `app/{episodes,clips,tracks}/page.tsx`                         | Delete after extracting loaders |
| `app/podcasts/livestreams/LivestreamsPage{Context,Header}.tsx` | Import path                     |

Files moved:

- `app/episodes/`: `EpisodesPage{Client,Context,DropdownConfig,Header,List}.tsx`
- `app/clips/`: `ClipsPage{Client,Context,Header,List}.tsx` (no DropdownConfig; it reuses
  Episodes')
- `app/tracks/`: `TracksPage{Client,Context,DropdownConfig,Header,List}.tsx`

## Implementation

### Loaders

- `app/_media-lists/episodes/episodesListSsr.ts`: `loadEpisodesListProps(scope, searchParams,
ssr)`
- `app/_media-lists/clips/clipsListSsr.ts`: `loadClipsListProps`
- `app/_media-lists/tracks/tracksListSsr.ts`: `loadTracksListProps`

Each follows plan 61 § Loaders: the `fd` key from decision 4, no guard in subscribed scope, no
request signed out in subscribed scope, and the scope passed to the filter-params getter. The
request calls stay as they are: `reqItemGetMany` (Episodes `av`, Tracks `music`) and
`reqClipGetManyPublic` (Clips `av`). Each returns the Client's props without `chipsNode`
(`EpisodesListProps`, `ClipsListProps`, `TracksListProps`, exported from each Client file).

### DropdownConfig

- `getEpisodesPageFilterParams(params, isValidAuthSession, scope?)` and
  `getTracksPageFilterParams(…, scope)` pass `scope` to `buildSubscribedListFilterParams`. Clips
  calls `getEpisodesPageFilterParams` with its own `scope`.
- `getEpisodesPageDropdownConfig({ type, sort, tFilters, scope? })`: `typeOptions` are Global and
  Category in browse scope and `[]` in subscribed scope. Clips' Header passes its `scope`.
- In both Episodes getters `scope` is optional: undefined keeps today's behavior (Subscribed,
  Global, and Category). The Livestreams modules call them without a scope.
- `getTracksPageDropdownConfig`: `typeOptions: []`.

### Livestreams imports

`app/podcasts/livestreams/LivestreamsPageContext.tsx` and `LivestreamsPageHeader.tsx` import
`../../episodes/EpisodesPageDropdownConfig`. Change both to
`../../_media-lists/episodes/EpisodesPageDropdownConfig`. Their calls stay as they are, with no
scope. `app/music/livestreams/page.tsx` imports only the Livestreams modules; no change.

### Client, Context, List

As plan 61 § Scope transformation:

- Clients take `scope` and `chipsNode`, and render `{chipsNode}` first in `MainColumnStack`.
- Contexts take and expose `scope`, and use decision 4's keys.
- Episodes and Clips Lists use decision 5's `linkPath`.
- Episodes and Clips Contexts use decision 6's URL clean-up. Remove the `ROUTES` import where it
  becomes unused.

### Header

- Episodes and Clips: `useSubscribedListHeader({ …, showTypeDropdown: scope === 'browse' })` and
  the decision 7 title.
- Tracks: delete the type `Dropdown`, its change handler, the type guard, and the
  `typeMenuItems` destructure. Use the decision 7 title.

## Reuse

The same modules serve both pages (moved, not copied). Clips keeps reusing Episodes'
DropdownConfig. `removeQueryParamByPattern` stays the URL helper.

## Tests

No new unit test. The scope rules are tested in plan 60, and the routes in plan 69's Playwright
spec. Clean up any test file under these folders that imported the old paths (none exist today;
check with Grep for `app/episodes/`, `app/clips/`, `app/tracks/`).

## Release scratchpad

No entry. Plan 68's entry covers the removed URLs, and plans 63 and 64 log the new pages.
