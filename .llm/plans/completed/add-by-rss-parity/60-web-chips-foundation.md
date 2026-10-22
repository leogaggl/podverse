# 60 — Web chip row foundation

**Cursor model:** Cursor Grok 4.7 · **Reasoning:** high

Rows: R47, R48, R49 (the pieces all three chips pages share). Web only. Paths are under
`apps/web/src/` unless stated. Nothing here changes a page yet; plans 61–68 use these pieces.

Parity source: mobile's chip orders in `apps/mobile/src/screens/browse/browseTypes.ts`
(`HOME_MEDIA_TYPE_ORDER`, `BROWSE_MEDIA_TYPE_ORDER`) and the Add by RSS library chips in
`AddByRssRootScreen.tsx`. Mobile stores the Browse chip in the sort-pref store under scope
`{ kind: 'list', name: 'browse' }`, field `mediaType` (`browseListPrefs.ts`). Web does the same in
its `local-settings` cookie (`sp`), so the server can read the chip on first paint.

## Locked decisions

1. **Chip lists.** In mobile order. The first chip is each page's default.
   - Subscribed: `podcasts, episodes, clips, artists, albums, tracks`
   - Browse: `podcasts, episodes, clips, artists, albums, tracks, playlists, users`
   - Add by RSS: `podcasts, episodes, artists, albums, tracks`

   Area H adds `livestreams` to each list and a `livestreams` entry to the label map. The
   component renders whatever list it is given, so nothing else changes for that chip.

1. **URL.** The query parameter `tab` names the chip. The default chip never appears in the URL
   (**routing-url-params**). Other list parameters (`page`, `type`, `sort`, `range`, `category`,
   `filter`) belong to the chip on screen and are dropped when the chip changes.
1. **Resolution order.** A valid `tab` in the URL, then the stored chip, then the default. An
   invalid `tab` is ignored, as if absent.
1. **Storage.** `updateStoredSortPref(scope, { mediaType })` with scopes `{ kind: 'list', name:
'home' }` (Subscribed), `{ kind: 'list', name: 'browse' }`, and `{ kind: 'list', name:
'add-by-rss' }`. Selecting the default chip writes `mediaType: undefined`, which clears it. A
   chip named in the URL is written on mount, so an explicit URL wins and is remembered
   (**filter-sort-persistence**).
1. **Navigation.** A chip click writes the store, then `router.replace(path)`. When `path` equals
   the current path and query (the stored chip had produced a clean URL), call `router.refresh()`
   instead, because the server picks the chip from the cookie.
1. **Chip row.** `ButtonTabs` from `@podverse/ui`, as on the Search page, inside a wrapper
   `div` with `data-testid="media-list-chips"`. Each chip page puts it first in `MainColumnStack`.
1. **List scope.** `MediaListScope = 'subscribed' | 'browse'`. Subscribed always lists type
   `'subscribed'`; Browse lists `'global'` or `'category'` and never `'subscribed'`.
1. **Filter-default keys.** Browse keeps the existing `fd` keys (`podcasts`, `episodes`, `clips`,
   `artists`, `albums`, `tracks`). Subscribed gets `subscribed-<chip>` keys. Browse's Playlists
   and Users get `browse-playlists` and `browse-users`, separate from the `/playlists` and
   `/profiles` pages, which keep theirs.

## Files

| File                                                          | Change                         |
| ------------------------------------------------------------- | ------------------------------ |
| `constants/routes.ts`                                         | `ADD_BY_RSS`, `BROWSE`, `HOME` |
| `utils/mediaListChips.ts`                                     | New                            |
| `utils/mediaListChips.test.ts`                                | New, Vitest                    |
| `utils/dropdownMenuItems.test.ts`                             | Scope cases                    |
| `components/MediaListChips/MediaListChips.tsx`                | New                            |
| `styles/components/MediaListChips/MediaListChips.module.scss` | New                            |
| `utils/localSettings/localSettings.ts`                        | New `fd` keys                  |
| `utils/dropdownMenuItems.ts`                                  | `scope` argument               |
| `hooks/useSubscribedListHeader.tsx`                           | `showTypeDropdown`             |
| `utils/categories.ts`                                         | Query separator                |
| `consumer/originals/*.json`                                   | New keys                       |
| `mobile/originals/*.json`                                     | Move `features.browse.users`   |

Catalog paths are under `packages/i18n-catalog/`; `*` is `en-US`, `es`, `fr`, and `el-GR`.

## Implementation

### `constants/routes.ts`

Add, in alphabetical position: `ADD_BY_RSS: '/add-by-rss'`, `BROWSE: '/browse'`, `HOME: '/'`.
Leave the old list constants; plan 68 removes them.

### `utils/mediaListChips.ts`

Tier B, no `next/*` imports, so server pages and client components can both import it.

```typescript
export const SUBSCRIBED_CHIPS = [
  'podcasts',
  'episodes',
  'clips',
  'artists',
  'albums',
  'tracks',
] as const;
export const BROWSE_CHIPS = [...SUBSCRIBED_CHIPS, 'playlists', 'users'] as const;
export const ADD_BY_RSS_CHIPS = ['podcasts', 'episodes', 'artists', 'albums', 'tracks'] as const;

export type SubscribedChip = (typeof SUBSCRIBED_CHIPS)[number];
export type BrowseChip = (typeof BROWSE_CHIPS)[number];
export type AddByRSSChip = (typeof ADD_BY_RSS_CHIPS)[number];
export type MediaListChip = SubscribedChip | BrowseChip | AddByRSSChip;
export type MediaListChipsPage = 'subscribed' | 'browse' | 'add-by-rss';
export type MediaListScope = 'subscribed' | 'browse';

export const MEDIA_LIST_CHIP_QUERY_PARAM = 'tab';
export const DEFAULT_MEDIA_LIST_CHIP = 'podcasts';
```

Also export:

- `MEDIA_LIST_CHIP_LABEL_KEYS: Record<MediaListChip, string>` with full catalog paths:
  `media.podcast.podcasts`, `media.podcast.episodes`, `features.clip.clips`, `media.music.artists`,
  `media.music.albums`, `media.music.tracks`, `features.playlist.playlists`,
  `features.browse.users`.
- `MEDIA_LIST_CHIP_SCOPES: Record<MediaListChipsPage, SortPrefScope>` (decision 4).
- `MEDIA_LIST_CHIP_BASE_PATHS: Record<MediaListChipsPage, string>`: `ROUTES.HOME`,
  `ROUTES.BROWSE`, `ROUTES.ADD_BY_RSS`.
- `buildMediaListChipPath(page, chip): string`. The base path for `DEFAULT_MEDIA_LIST_CHIP`,
  otherwise `${base}?tab=${chip}`.
- `resolveMediaListChip<T extends string>({ chips, urlValue, storedValue, defaultChip })`, which
  returns `{ chip: T; urlChip: T | null }`.
  - `urlValue` is `string | string[] | undefined`; for an array, use the first entry.
  - `urlChip` is the entry of `chips` equal to it, or `null`.
  - `chip` is `urlChip ?? pickSortPrefToken(storedValue, chips, defaultChip)`.
  - `pickSortPrefToken` comes from `@podverse/helpers`.
- `readStoredMediaListChip(settings: LocalSettingsState, page): string | undefined`, which
  returns `getStoredSortPref(settings, MEDIA_LIST_CHIP_SCOPES[page])?.mediaType`.
- `writeMediaListChip(page, chip)`, which calls
  `updateStoredSortPref(MEDIA_LIST_CHIP_SCOPES[page], { mediaType })`, where `mediaType` is
  `undefined` for `DEFAULT_MEDIA_LIST_CHIP` and `chip` otherwise.

One-line JSDoc on each export, describing the behavior.

### `components/MediaListChips/MediaListChips.tsx`

`'use client'`. Named export `MediaListChips`.

```typescript
type MediaListChipsProps = {
  page: MediaListChipsPage;
  chips: readonly MediaListChip[];
  selected: MediaListChip;
  urlChip: MediaListChip | null;
};
```

- `const t = useTranslations();` Each chip's label is `t(MEDIA_LIST_CHIP_LABEL_KEYS[chip])`.
- A `useEffect` with an empty dependency list: when `urlChip !== null`, call
  `writeMediaListChip(page, urlChip)`.
- `onSelect(chip)`: return when `chip === selected`. Otherwise call `writeMediaListChip`, then
  `const path = buildMediaListChipPath(page, chip)`. Compare it with
  `${window.location.pathname}${window.location.search}`: if equal, `router.refresh()`;
  otherwise `router.replace(path)`.
- Markup: `<div className={styles.chipRow} data-testid="media-list-chips">` wrapping
  `<ButtonTabs buttonTabs={…} className={styles.chips} selectedKey={selected} />`.

### `styles/components/MediaListChips/MediaListChips.module.scss`

```scss
.chipRow {
  margin-bottom: var(--spacing-2xl);
}

.chips {
  justify-content: flex-start;
}
```

These match `app/search/SearchPageListHeader.module.scss`. No `var()` fallbacks.

### `utils/localSettings/localSettings.ts`

1. Add to `FilterDefaults`, reusing the existing interfaces so `useFilterDefaults` writes them
   unchanged:
   - `'subscribed-podcasts'?: PodcastsFilterDefaults`
   - `'subscribed-episodes'?: EpisodesFilterDefaults`
   - `'subscribed-clips'?: ClipsFilterDefaults`
   - `'subscribed-artists'?: ArtistsFilterDefaults`
   - `'subscribed-albums'?: AlbumsFilterDefaults`
   - `'subscribed-tracks'?: TracksFilterDefaults`
   - `'browse-playlists'?: PlaylistsFilterDefaults`
   - `'browse-users'?: ProfilesFilterDefaults`
1. Replace the `FilterDefaultsPage` union with `export type FilterDefaultsPage = keyof
FilterDefaults;`.
1. Replace the conditional `FilterDefaultsForPage` chain with `export type FilterDefaultsForPage<T
extends FilterDefaultsPage> = NonNullable<FilterDefaults[T]>;`.
1. Update the comment above `updateFilterDefaults` so it no longer gives a count of lists.

The new names contain only letters and hyphens, so `getFilterDefaultsKey` accepts them.

### `utils/dropdownMenuItems.ts`

Add an optional `scope?: MediaListScope` (type import from `./mediaListChips`) to both argument
types of `buildSubscribedListFilterParams`. At the top of the implementation:

- `scope === 'subscribed'`: return at once with `currentType: 'subscribed'`, `currentSort:
getValidQueryParam(subscribedSortValues, sort, defaultSubscribedSort)`, `currentRange: range`,
  `currentPage: page`, and, when `supportsCategory`, `currentCategory: null`.
  `isValidAuthSession` is ignored; the list itself shows the sign-in state.
- `scope === 'browse'` and `type === 'subscribed'`: continue with `type` set to `'global'`,
  `sort` set to `defaultGlobalSort`, and `range` set to `null`.
- `scope` undefined: today's behavior. The livestream, playlist, and profile lists stay on it.

`'subscribed' as TType` and `'global' as TType` follow the existing `'category' as TType`.

### `hooks/useSubscribedListHeader.tsx`

Add `showTypeDropdown?: boolean` to `UseSubscribedListHeaderArgs`. Render the type `Dropdown` in
`buttonsNode` only when `showTypeDropdown !== false`, and add it to that memo's dependencies.

### `utils/categories.ts`

In `onClickCategory`, build the target as `${linkPath}${linkPath.includes('?') ? '&' : '?'}
category=${category.mapping_key}`. Browse passes `/browse?tab=episodes` as `linkPath`.

### i18n

**Consumer layer**, all four `consumer/originals/*.json`, at the same position in each:

- Insert `"subscribed": …` right after the `"subscriptions": "…",` line inside `subscriptions`.
- Insert a `"browse": { "browse": …, "users": … }` object inside `features`, right before the
  `"my_library":` line.

| Key                        | en-US      | es        | fr           | el-GR     |
| -------------------------- | ---------- | --------- | ------------ | --------- |
| `subscriptions.subscribed` | Subscribed | Suscritos | Abonnements  | Συνδρομές |
| `features.browse.browse`   | Browse     | Explorar  | Parcourir    | Περιήγηση |
| `features.browse.users`    | Users      | Usuarios  | Utilisateurs | Χρήστες   |

**Mobile layer**, all four `mobile/originals/*.json`: delete `"users": …` from `features.browse`,
and remove the trailing comma on the `"sort_popularity"` line above it. Mobile now reads that key
from the consumer layer, and `i18n:validate` rejects the same path in both layers. Do not edit
`overrides/`.

## Reuse

- `ButtonTabs` and the Search page's chip-row spacing.
- `pickSortPrefToken`, `getStoredSortPref`, `updateStoredSortPref` (the existing sort-pref store).
- Existing filter-default interfaces for the new keys.

## Tests

**Unit** — `utils/mediaListChips.test.ts`:

- `resolveMediaListChip`:
  - a valid URL value wins over a stored value, and `urlChip` is set;
  - an invalid URL value falls back to the stored value, with `urlChip` null;
  - a stored value that is not in `chips` (for example `playlists` against `SUBSCRIBED_CHIPS`)
    falls back to the default;
  - an array URL value uses its first entry;
  - nothing at all gives the default.
- `buildMediaListChipPath`: `('subscribed', 'podcasts')` gives `/`; `('browse', 'episodes')` gives
  `/browse?tab=episodes`; `('add-by-rss', 'podcasts')` gives `/add-by-rss`.
- The three chip lists equal mobile's `HOME_MEDIA_TYPE_ORDER` and `BROWSE_MEDIA_TYPE_ORDER` values
  (literal arrays in the test; the test does not import mobile).

**Unit** — add a `describe('scope')` block to the existing `utils/dropdownMenuItems.test.ts`:

- `scope: 'subscribed'` with `isValidAuthSession: false` still returns type `subscribed`.
- `scope: 'browse'` with type `subscribed` returns type `global` and the default global sort.

Playwright coverage is in plan 69.

## Release scratchpad

No entry. Nothing user-visible changes until plans 63, 64, and 67, which log the change.
