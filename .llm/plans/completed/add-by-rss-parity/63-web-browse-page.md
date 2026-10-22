# 63 — Web Browse chips page

**Cursor model:** Cursor Grok 4.7 · **Reasoning:** high

Rows: R48, R50 (sitemap and SEO for the six moved lists). Web only. Paths are under
`apps/web/src/` unless stated. Runs after plans 60, 61, and 62.

Parity source: mobile Browse (`apps/mobile/src/screens/browse/BrowseScreen.tsx`,
`browseFeedData.ts`). Its chips are Podcasts, Episodes, Clips, Artists, Albums, Tracks, Playlists,
and Users. Playlists read public playlists (`type: 'public'`) and Users read global accounts
(`type: 'global'`). On web the lists are today's directory lists, now in browse scope, plus the
`/playlists` and `/profiles` modules with their type fixed. Server content only.

## Locked decisions

1. **Route.** `app/browse/page.tsx`, a server component. It resolves the chip (plan 60), loads that
   chip's list, and renders one Client with the chip row. The other chips load nothing.
1. **Playlists chip.** The `/playlists` modules with `listScope: 'browse'`: type fixed to
   `'public'`, no My Playlists / Subscribed / Global tabs, no Create Playlist button. The
   Podcasts/Music medium buttons and the sort and range dropdowns stay.
1. **Users chip.** The `/profiles` modules with `listScope: 'browse'`: type fixed to `'global'`, no
   type dropdown. Sort and range stay.
1. **`/playlists` and `/profiles` keep working as today.** `listScope` defaults to `'page'`.
1. **Keys.** Playlists in browse: `routeKey` and `fd` key `browse-playlists`. Users in browse:
   `browse-users`. In page scope, both keep `playlists` and `profiles`.
1. **Header title.** `tFeatures('browse.browse')` for every Browse chip.
1. **SEO.** `/browse` is a curated `product_listing` page with one canonical URL for every chip
   (the canonical ignores the query). The six lists moved in plans 61 and 62 leave
   `CURATED_PAGE_PATHS`, `routeSeoPolicy`, the sitemap, and the catalogs. Livestream entries stay
   until plan 68 removes those routes.

## Files

| File                                              | Change                          |
| ------------------------------------------------- | ------------------------------- |
| `app/browse/page.tsx`                             | New                             |
| `app/playlists/playlistsListSsr.ts`               | New: `loadPlaylistsBrowseProps` |
| `app/playlists/PlaylistsPage*.tsx` (four files)   | `listScope`, `chipsNode`        |
| `app/profiles/profilesListSsr.ts`                 | New: `loadProfilesBrowseProps`  |
| `app/profiles/ProfilesPage*.tsx` (three files)    | `listScope`, `chipsNode`        |
| `lib/seo/curatedPageMetadata.ts`                  | Add `browse`, remove six        |
| `lib/seo/routeSeoPolicy.ts`                       | Add `/browse`, remove six       |
| `lib/seo/routeSeoPolicy.test.ts`                  | `/browse`                       |
| `lib/seo/buildStaticPageMetadata.test.ts`         | Sample path `/browse`           |
| `app/sitemap.ts`                                  | Add `/browse`, remove six       |
| `packages/i18n-catalog/consumer/originals/*.json` | `seo.pages.browse`, remove six  |

## Implementation

### `app/browse/page.tsx`

```tsx
type BrowsePageProps = { searchParams: Promise<MediaListSearchParams> };

export async function generateMetadata() {
  return getCuratedStaticPageMetadata('browse');
}

export default async function BrowsePage({ searchParams }: BrowsePageProps) { … }
```

Body:

1. `const params = await searchParams;` and `const ssr = await getMediaListSsr();`
1. `const { chip, urlChip } = resolveMediaListChip({ chips: BROWSE_CHIPS, urlValue:
params[MEDIA_LIST_CHIP_QUERY_PARAM], storedValue: readStoredMediaListChip(ssr.localSettings,
'browse'), defaultChip: DEFAULT_MEDIA_LIST_CHIP });`
1. `const chipsNode = <MediaListChips page="browse" chips={BROWSE_CHIPS} selected={chip}
urlChip={urlChip} />;`
1. A `switch (chip)` returns one Client with `key={chip}` and `chipsNode={chipsNode}`. The six
   media chips spread `await load<Media>ListProps('browse', params, ssr)`. `playlists` spreads
   `await loadPlaylistsBrowseProps(params, ssr)`. `users` spreads `await
loadProfilesBrowseProps(params, ssr)`. A `default` branch assigns `chip` to `never`.

The extra `tab` key in `params` is harmless: the list schemas are non-strict `z.object`s.

### Playlists in browse scope

**`playlistsListSsr.ts`.** `loadPlaylistsBrowseProps(searchParams, ssr)` returns the Client's
props (without `chipsNode`) with `listScope: 'browse'`.

- Move `searchParamsSchema` from `app/playlists/page.tsx` into `playlistsListSsr.ts`, export it,
  and import it in `page.tsx`, so both share one schema. A Next page file may not export it.
- Parse `page`, `sort`, `range`, and `medium` with that schema.
- Defaults come from `getFilterDefaultsForPage(ssr.localSettings, 'browse-playlists')`, then
  `sort: 'top'`, `range: 'week'`, and `medium: 'av'`.
- `type` is always `'public'`.
- The request is today's `reqPlaylistGetMany` call through `safeSsrListRequest` with `type:
'public'`.

**Client.** Optional props `listScope?: 'page' | 'browse'` (default `'page'`) and `chipsNode?:
React.ReactNode` (default `null`). Pass `listScope` to the Provider; render `{chipsNode}` first in
`MainColumnStack`.

**Context.** Take and expose `listScope`. `routeKey` and the `useFilterDefaults` key follow
decision 5. Pass the key as a literal in a ternary, so `useFilterDefaults` keeps its page type.

**Header.** In browse: title `tFeatures('browse.browse')` and `buttonsNode={null}`.

**ListHeader.** In browse, pass no `tabs` to `ListHeader`, which already renders without them.

### Users in browse scope

**`profilesListSsr.ts`.** `loadProfilesBrowseProps(searchParams, ssr)`, with `listScope:
'browse'`.

- Move `searchParamsSchema` from `app/profiles/page.tsx` here and import it in `page.tsx`, as for
  playlists.
- Defaults from `getFilterDefaultsForPage(ssr.localSettings, 'browse-users')`.
- Resolve with `getProfilesPageFilterParams({ type: 'global', sort, range, page },
ssr.canLoadPrivateSsrData)`.
- The request is today's `reqAccountGetMany` through `safeSsrListRequest` with `type: 'global'`.

**Client and Context.** As for playlists (keys from decision 5).

**Header.** In browse: no type `Dropdown`, and title `tFeatures('browse.browse')`.

### `lib/seo/curatedPageMetadata.ts`

In `CURATED_PAGE_PATHS`, add `browse: '/browse'` after `home`. Remove `podcasts`, `episodes`,
`artists`, `albums`, `tracks`, and `clips`. Keep `podcastsLivestreams` and `musicLivestreams`
(plan 68).

### `lib/seo/routeSeoPolicy.ts`

Add `{ class: 'product_listing', pathPattern: '/browse' }` right after the `'/'` entry. Delete the
`/podcasts`, `/episodes`, `/artists`, `/albums`, `/tracks`, and `/clips` entries.

### `app/sitemap.ts`

`STATIC_SITEMAP_PATHS` starts `'/', '/browse',` and drops `/podcasts`, `/episodes`, `/artists`,
`/albums`, `/tracks`, and `/clips`. `/podcasts/livestreams` and `/music/livestreams` stay until
plan 68.

### Catalogs

In all four `consumer/originals/*.json`, inside `seo.pages`: replace the `podcasts` block with a
`browse` block, and delete the `episodes`, `artists`, `albums`, `tracks`, and `clips` blocks. Keep
`podcastsLivestreams` and `musicLivestreams`.

Values for the `browse` block (`title`, then `description`):

- en-US: "Browse"; "Browse podcasts, episodes, clips, music, playlists, and profiles on
  {brand_name}."
- es: "Explorar"; "Explora podcasts, episodios, clips, música, listas de reproducción y perfiles
  en {brand_name}."
- fr: "Parcourir"; "Parcourez des podcasts, des épisodes, des extraits, de la musique, des
  playlists et des profils sur {brand_name}."
- el-GR: "Περιήγηση"; "Περιηγηθείτε σε podcasts, επεισόδια, αποσπάσματα, μουσική, λίστες
  αναπαραγωγής και προφίλ στο {brand_name}"

Each description is one line in the JSON; the breaks above are only for this plan. The four
files are `en-US.json`, `es.json`, `fr.json`, and `el-GR.json`.

el-GR descriptions in this block have no final period; keep that.

## Reuse

The browse-scope list modules from plans 61 and 62, the `/playlists` and `/profiles` modules,
`MediaListChips`, `getCuratedStaticPageMetadata`, and `safeSsrListRequest`.

## Tests

**Unit:**

- `lib/seo/routeSeoPolicy.test.ts`: replace the `/podcasts` and `/episodes` assertions with
  `expect(classFor('/browse')).toBe('product_listing')`.
- `lib/seo/buildStaticPageMetadata.test.ts`: change the sample `pathname` and the expected
  canonical and URL from `/podcasts` to `/browse`. The image URL may stay.

Playwright coverage is in plan 69 (the Browse chips, the SEO metadata spec, and the sitemap spec).

## Release scratchpad

```markdown
## Web Browse page with chips

- Surfaces: web
- Change: A new Browse page (`/browse`) lists server content behind chips, in the mobile app's
  order: Podcasts, Episodes, Clips, Artists, Albums, Tracks, Playlists, Users. Podcasts,
  Episodes, and Clips can be narrowed to a category. Playlists shows public playlists; Users shows
  public profiles. The chip is in the URL (`?tab=`) and the last chip is remembered in this
  browser. `/browse` replaces `/podcasts`, `/episodes`, `/clips`, `/artists`, `/albums`, and
  `/tracks` in the sitemap and has its own page title and description.
- Who notices: every web visitor
- Operator steps: none
```
