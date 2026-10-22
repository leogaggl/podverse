# 67 — Web Add by RSS chips page

**Cursor model:** Cursor Grok 4.7 · **Reasoning:** high

Rows: R21, R49, R50 (the `/add-by-rss/<list>` pages). Web only. Paths are under `apps/web/src/`
unless stated. Runs after plan 60. Plan 68 points the sidebar's one Add by RSS link here.

Parity source: mobile My Library → Add by RSS (`apps/mobile/src/screens/rss/AddByRssRootScreen.tsx`),
one screen with chips over Add by RSS feeds only. On web the five list clients already exist; they
move behind one chips page.

**R21** is already true: every Add by RSS list reads only this browser's Add by RSS feeds. No code
change for it beyond keeping that so.

## Locked decisions

1. **Route.** `app/add-by-rss/page.tsx` (`/add-by-rss`), a server component on the Browse page's
   pattern (plan 63) with `ADD_BY_RSS_CHIPS`, chips page `'add-by-rss'`, and the stored chip from
   `readStoredMediaListChip(ssr.localSettings, 'add-by-rss')`. It is `noindex` through the
   existing `app/add-by-rss/layout.tsx`, and it stays out of the sitemap.
1. **Chips.** Podcasts, Episodes, Artists, Albums, Tracks (area H adds Livestreams). Podcasts is
   the default and is never in the URL. Livestreams is a chip over live items, not a feed
   resource type: a feed with livestreams stays on its medium's chip (plans 84 and 88).
1. **List pages removed.** `/add-by-rss/podcasts`, `/episodes`, `/artists`, `/albums`, `/tracks`,
   `/podcast/livestream`, `/music/livestream`, and the `[resource]` list (any single segment)
   return not found. Plan 88 removes the `'livestreams'` resource type and its remaining
   branches in `AddByRSSListClient` and `[resource]/[id_text]`; leave those here. Detail routes
   stay: `[resource]/[id_text]`, `podcast/[id]`, `album/[id]`, `artist/[id]`, `episode/[episodeId]`,
   `track/[id]`, `credentials/[id]`, `add`, and the two `livestream/[id]` routes.
1. **Header.** Title `tFeatures('add_by_rss.label')` ("Add by RSS") for every chip. The header
   gains an **Add Feed** button (`tFeatures('add_feed.add_feed')`) that pushes
   `ROUTES.ADD_BY_RSS_ADD`, before Check for Updates. It replaces the sidebar's Add Feed link
   (plan 68).
1. **Clients move.** The three route-local clients move to `components/AddByRSS/List/` beside
   `AddByRSSListClient`, since their route folders are deleted.
1. **List behavior per chip is unchanged** (sorts, paging, needs-credentials section, Check for
   Updates, first parses). Only the title, the chip row, and the Add Feed button are new.

## Files

| File                                                           | Change                      |
| -------------------------------------------------------------- | --------------------------- |
| `app/add-by-rss/page.tsx`                                      | New                         |
| `app/add-by-rss/episodes/AddByRSSEpisodesPageClient.tsx`       | Move (§ Moved clients)      |
| `app/add-by-rss/artists/AddByRSSArtistsPageClient.tsx`         | Move (§ Moved clients)      |
| `app/add-by-rss/tracks/AddByRSSTracksPageClient.tsx`           | Move (§ Moved clients)      |
| `app/add-by-rss/<list>/page.tsx` (five lists)                  | Delete                      |
| `app/add-by-rss/podcast/livestream/page.tsx`                   | Delete                      |
| `app/add-by-rss/music/livestream/page.tsx`                     | Delete                      |
| `app/add-by-rss/[resource]/page.tsx`                           | Delete                      |
| `components/AddByRSS/List/AddByRSSListClient.tsx`              | `chipsNode`, title          |
| `components/AddByRSS/List/AddByRSSListHeader.tsx`              | Add Feed button             |
| `app/add-by-rss/credentials/AddByRSSCredentialsPageClient.tsx` | Link to `ROUTES.ADD_BY_RSS` |
| `constants/routes.ts`                                          | Remove six list constants   |

The five `<list>` folders are `podcasts`, `albums`, `episodes`, `artists`, and `tracks`.

## Implementation

### `app/add-by-rss/page.tsx`

```tsx
type AddByRSSPageProps = { searchParams: Promise<MediaListSearchParams> };

export default async function AddByRSSPage({ searchParams }: AddByRSSPageProps) { … }
```

Resolve the chip with `resolveMediaListChip({ chips: ADD_BY_RSS_CHIPS, … })` from
`params[MEDIA_LIST_CHIP_QUERY_PARAM]`, the stored chip, and `DEFAULT_MEDIA_LIST_CHIP`. Build
`<MediaListChips page="add-by-rss" chips={ADD_BY_RSS_CHIPS} selected={chip} urlChip={urlChip} />`.
Then a `switch (chip)` with a `never` default:

| Chip     | Renders                                                                   |
| -------- | ------------------------------------------------------------------------- |
| podcasts | `<AddByRSSListClient key="podcasts" resourceType="podcasts" chipsNode />` |
| episodes | `<AddByRSSEpisodesPageClient key="episodes" chipsNode />`                 |
| artists  | `<AddByRSSArtistsPageClient key="artists" chipsNode />`                   |
| albums   | `<AddByRSSListClient key="albums" resourceType="albums" chipsNode />`     |
| tracks   | `<AddByRSSTracksPageClient key="tracks" chipsNode />`                     |

(`chipsNode={chipsNode}` in each.) No list data loads on the server; these clients read
IndexedDB.

### Moved clients

`git mv` each of the three to `components/AddByRSS/List/<same name>.tsx`. Their relative imports
all start with `../../../`, which still resolves from the new folder. Rewrite the ones that point
into `components/AddByRSS/List/` (`../../../components/AddByRSS/List/AddByRSSListHeader`) to
`./AddByRSSListHeader`. Delete the emptied route folders.

### All four clients

- Add the prop `chipsNode: React.ReactNode` and render it first inside `MainColumnStack`, above the
  sign-in message.
- Header title: `tFeatures('add_by_rss.label')`. Remove the now-unused `getResourceLabel` helper
  and `tMedia` uses if nothing else in the file needs them.
- The `page` and `sort` query reads stay; a chip change drops them (plan 60).

### `AddByRSSListHeader.tsx`

Add `const router = useRouter();` and, first in `buttonsNode`:

```tsx
<Button onClick={() => router.push(ROUTES.ADD_BY_RSS_ADD)} variant="mini">
  {tFeatures('add_feed.add_feed')}
</Button>
```

`tFeatures` is `useTranslations('features')`. The header's only callers are the four clients.

### Credentials page

`AddByRSSCredentialsPageClient.tsx` lines 236 and 335: `ROUTES.ADD_BY_RSS_PODCASTS` →
`ROUTES.ADD_BY_RSS`.

### `constants/routes.ts`

Delete `ADD_BY_RSS_ALBUMS`, `ADD_BY_RSS_ARTISTS`, `ADD_BY_RSS_EPISODES`, `ADD_BY_RSS_LIVESTREAMS`,
`ADD_BY_RSS_PODCASTS`, and `ADD_BY_RSS_TRACKS`. `SideBar.tsx` still names five of them until plan
68; if plan 68 has not run, leave those five constants and let plan 68 delete them. Check with
`rg 'ADD_BY_RSS_(ALBUMS|ARTISTS|EPISODES|LIVESTREAMS|PODCASTS|TRACKS)' apps/web/src`.

## Reuse

The four existing Add by RSS list clients and their header, `MediaListChips` and the chip
resolver (plan 60), and the Browse page's switch (plan 63).

## Tests

No new unit tests: the page is a switch over plan 60's resolver, which has its own tests.
Playwright coverage is in plan 69 (the chips, the Add Feed button, a removed list URL returning
not found, and the specs that opened `/add-by-rss/podcasts`).

## Release scratchpad

```markdown
## Web Add by RSS library is one page with chips

- Surfaces: web
- Change: The Add by RSS lists are one page, `/add-by-rss`, with Podcasts, Episodes, Artists,
  Albums, and Tracks chips. The chip is in the URL (`?tab=`) and the last chip is remembered in
  this browser. An Add Feed button in the page header opens the add page. The old list URLs
  (`/add-by-rss/podcasts`, `/add-by-rss/episodes`, `/add-by-rss/artists`, `/add-by-rss/albums`,
  `/add-by-rss/tracks`, and the two livestream list pages) now return not found; feed and item
  pages keep their URLs.
- Who notices: web users of Add by RSS; old bookmarks to the list pages stop working
- Operator steps: none
```
