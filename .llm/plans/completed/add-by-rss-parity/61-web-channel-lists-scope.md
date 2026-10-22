# 61 — Web channel list modules gain a scope (Podcasts, Artists, Albums)

**Cursor model:** Cursor Grok 4.7 · **Reasoning:** medium

Rows: R47, R48, R50 (the `/podcasts`, `/artists`, `/albums` routes go away). Web only. Paths are
under `apps/web/src/` unless stated. Runs after plan 60. Plan 62 applies § Scope transformation
to the item lists; plans 63 and 64 render these modules on `/browse` and `/`.

Parity source: today's `/podcasts`, `/artists`, and `/albums` list pages. Subscribed scope behaves
like their `type=subscribed` list. Browse scope behaves like their `type=global` and
`type=category` lists. No list behavior changes beyond the scope rules below.

## Locked decisions

1. **Where the modules live.** `app/_media-lists/<media>/`. The leading underscore keeps Next
   from routing the folder. Each list's `page.tsx` becomes `<media>ListSsr.ts` in that folder,
   and the old route file is deleted, so `/podcasts`, `/artists`, and `/albums` return not found.
   `app/podcasts/livestreams/` is not moved here; plan 68 handles it.
1. **One module set per list, used by both pages.** Every Client, Context, Header, List, and
   DropdownConfig takes `scope: MediaListScope` (from `utils/mediaListChips`). No copies.
1. **Subscribed scope.** Type is always `'subscribed'`. There is no type dropdown and no category.
   Signed out, the server sends no request and the list shows the existing sign-in message and
   `HowToStartInfo`, as Home does today.
1. **Browse scope.** Type is `'global'` or, for Podcasts only, `'category'`. Podcasts' type
   dropdown offers Global and Category. Artists and Albums have no type dropdown.
1. **Keys per scope** (**filter-sort-persistence**):

   `routeKey` is `${scope}-<media>` for all three (`subscribed-podcasts`, `browse-artists`, …).

   | List     | `fd` key                           | View-mode scope (`@podverse/helpers`)   |
   | -------- | ---------------------------------- | --------------------------------------- |
   | Podcasts | `subscribed-podcasts` / `podcasts` | `HOME_…_PODCASTS` / `BROWSE_…_PODCASTS` |
   | Artists  | `subscribed-artists` / `artists`   | `HOME_…_ARTISTS` / `BROWSE_…_ARTISTS`   |
   | Albums   | `subscribed-albums` / `albums`     | `HOME_…_ALBUMS` / `BROWSE_…_ALBUMS`     |

   `HOME_…_PODCASTS` stands for `HOME_LIST_VIEW_MODE_SCOPE_PODCASTS`, and so on. The Header and
   List of one module must pass the same view-mode scope.

1. **Header title.** The page's name: `tSubscriptions('subscribed')` or
   `tFeatures('browse.browse')`. With a category: `${title} > ${tCategories(category)}`. The chip
   row already says which list is showing.
1. **Chip row slot.** Each Client takes `chipsNode: React.ReactNode` and renders it as the first
   element inside `MainColumnStack`, above the List.

## Files

| File                                               | Change                                     |
| -------------------------------------------------- | ------------------------------------------ |
| `app/_media-lists/mediaListSsr.ts`                 | New                                        |
| `app/podcasts/*` except `livestreams/`             | Move to `app/_media-lists/podcasts/`, edit |
| `app/artists/*`                                    | Move to `app/_media-lists/artists/`, edit  |
| `app/albums/*`                                     | Move to `app/_media-lists/albums/`, edit   |
| `app/{podcasts,artists,albums}/page.tsx`           | Delete after extracting loaders            |
| `app/_media-lists/podcasts/podcastsFilter.test.ts` | `basePath` cases                           |
| `hooks/useFullSubscribedChannels.ts`               | Comment names the new list                 |

## Implementation

### Move

Use `git mv` for each file except `page.tsx`:

- `app/podcasts/`: `PodcastsFilterInput.tsx`, `PodcastsPageClient.tsx`, `PodcastsPageContext.tsx`,
  `PodcastsPageDropdownConfig.ts`, `PodcastsPageHeader.tsx`, `PodcastsPageList.tsx`,
  `podcastsFilter.ts`, `podcastsFilter.test.ts`
- `app/artists/`: `ArtistsPage{Client,Context,Header,List}.tsx`, `ArtistsPageDropdownConfig.ts`
- `app/albums/`: `AlbumsPage{Client,Context,Header,List}.tsx`, `AlbumsPageDropdownConfig.ts`

Each moved file sits one folder deeper. In every relative import that starts with `../`, add one
more `../` (for example `../../components/Main/MainWrapper` becomes
`../../../components/Main/MainWrapper`, and the styles import moves the same way). Imports that
start with `./` stay as they are.

### `app/_media-lists/mediaListSsr.ts`

```typescript
export type MediaListSearchParams = Record<string, string | string[] | undefined>;

type SsrApiRequestService = Awaited<ReturnType<typeof getSSRAuthService>>['ssrApiRequestService'];

export type MediaListSsr = {
  canLoadPrivateSsrData: boolean;
  localSettings: LocalSettingsState;
  ssrApiRequestService: SsrApiRequestService;
};

/** Reads the session and the local-settings cookie once for a chips page render. */
export async function getMediaListSsr(): Promise<MediaListSsr> { … }
```

The body is the first lines of today's list pages: `getSSRAuthService()`, `canLoadPrivateSsrData
= isValidAuthSession && !termsAcceptanceRequired`, and `getParsedLocalSettings(await cookies())`.

### Loaders (`<media>ListSsr.ts`)

Move each `page.tsx`'s zod schema, `parseSearchParams`, and request into one exported function.
Remove `generateMetadata` and the default export.

```typescript
export async function loadPodcastsListProps(
  scope: MediaListScope,
  searchParams: MediaListSearchParams,
  ssr: MediaListSsr
): Promise<PodcastsListProps>;
```

`PodcastsListProps` is `Omit<PodcastsPageClientProps, 'chipsNode'>`, exported from
`PodcastsPageClient.tsx`. Use `loadArtistsListProps` and `loadAlbumsListProps` the same way.

Inside each loader:

1. `cookieDefaults = getFilterDefaultsForPage(ssr.localSettings, <fd key for scope>)`.
1. `searchParamsSchema.safeParse(searchParams)`, keeping today's fallback for a failed parse.
1. **Subscribed scope:** skip `guardSubscribedSsrFilter`. Resolve with
   `get<Media>PageFilterParams(…, ssr.canLoadPrivateSsrData, 'subscribed')`. When
   `!ssr.canLoadPrivateSsrData`, send no request: `ssrChannels: []`, `ssrTotalPages: 1`.
1. **Browse scope:** today's guarded path, ending in `get<Media>PageFilterParams(…, isAuthenticated,
'browse')`.
1. Podcasts only: `initialFilterTerm` is `clampFilterTerm(…filter)` in subscribed scope and `''` in
   browse scope.
1. Return `{ scope, initialQueryParams, ssrChannels, ssrTotalPages }`, plus `initialFilterTerm`
   for Podcasts.

### Scope transformation

Plan 62 applies the same steps to Episodes, Clips, and Tracks.

**DropdownConfig.**

- `get<Media>PageFilterParams(params, isValidAuthSession, scope)` passes `scope` to
  `buildSubscribedListFilterParams`.
- `get<Media>PageDropdownConfig` takes `scope`. Podcasts' `typeOptions` are Global and Category in
  browse scope and `[]` in subscribed scope. Artists and Albums keep their sort lists; their
  `typeOptions` become `[]` because no type dropdown renders.

**Client.**

- Props add `scope: MediaListScope` and `chipsNode: React.ReactNode`.
- Pass `scope` to the Provider. Render `{chipsNode}` first inside `MainColumnStack`.

**Context.**

- Provider props add `scope`, and the context value exposes it.
- `routeKey` and the `useFilterDefaults` key follow decision 5.
- In the fetch, the call to `get<Media>PageFilterParams` passes `scope`. The signed-out branch
  stays on `filterParams.type === 'subscribed'`, which subscribed scope always has.

**Header.**

- Title per decision 6.
- Podcasts: `useSubscribedListHeader({ …, showTypeDropdown: scope === 'browse', viewModeScope })`.
- Artists and Albums: delete the type `Dropdown`, `handleTypeChange`, `isChannelType`, and the
  `typeMenuItems` destructure. Pass the scope's view-mode scope to `useListViewMode`.

**List.** Use the same view-mode scope as the Header. Podcasts' `onClickCategory` uses `linkPath:
ROUTES.BROWSE` (Podcasts is the default chip, so no `tab`).

### Podcasts specifics

- `podcastsFilter.ts`: `buildPodcastsPagePath` takes `basePath: string` and returns `basePath` or
  `${basePath}?${query}`. Remove the `ROUTES` import if nothing else uses it.
- `PodcastsPageContext.tsx`: the URL sync passes `basePath: MEDIA_LIST_CHIP_BASE_PATHS[scope ===
'subscribed' ? 'subscribed' : 'browse']`. Podcasts is the default chip on both pages, so the path
  carries no `tab`.
- The filter input, `useFullSubscribedChannels`, and `useChannelUnseenBadges(type ===
'subscribed')` stay as they are. They already apply only to the subscribed list.

### `hooks/useFullSubscribedChannels.ts`

In the comment near line 77, replace "`/podcasts` pages" with "the subscribed Podcasts list pages".

## Reuse

All five modules per list are moved, not copied. `buildSubscribedListFilterParams`,
`useSubscribedListHeader`, the view-mode scope constants, and `guardSubscribedSsrFilter` are
reused.

## Tests

**Unit** — `app/_media-lists/podcasts/podcastsFilter.test.ts`. `pathParams` adds
`basePath: '/'`. Existing expectations change from `/podcasts` to `/` (for example
`/?filter=daily…`). Add one case: `basePath: '/browse'` with `category: 'news'` gives
`/browse?category=news`.

**Unit** — plan 60's `dropdownMenuItems` scope cases cover the type rules.

Playwright coverage is in plan 69.

## Release scratchpad

No entry. Plan 68's entry covers the removed URLs, and plans 63 and 64 log the new pages.
