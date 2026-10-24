**Cursor model:** Opus 5.5 · **Reasoning:** high

# 30 — Subscribed and Browse media lists: Category, Sort, and gear as trailing chips

On Subscribed (`/`) and Browse (`/browse`), the seven media lists (Podcasts, Episodes, Clips,
Artists, Albums, Tracks, Livestreams) lose the type, sort, and range dropdowns in the page header.
Their controls move to the end of the media chip row, in mobile order: Categories (Browse
Podcasts, Episodes, and Clips only), then Sort, then the gear. The category modal goes away:
pressing Categories shows the category list in place of the media list and hides Sort and the gear
until a category (or All Categories) is chosen. The `Subscribed > News` / `Browse > News` title
suffix goes away; the Categories chip face names the category instead.

Browse's Playlists and Users chips, and the standalone `/playlists` and `/profiles` pages, are plan
31. This plan leaves them compiling unchanged.

Parity source: `apps/mobile/src/screens/browse/BrowseScreen.tsx` and `browseTypes.ts`
(`BROWSE_CATEGORY_MEDIA_TYPES`, `shouldShowBrowseCategoryChip`, `shouldShowBrowseSortChip`).

## Rows

R6, R21, R22, R23, R24, R26 (Subscribed, Browse media lists, Recommendations), R36

## Runs after

10, 21

- 21: `MediaListChipsConfig`, the `MediaListChips` `trailing` slot, `ListSortChip`, the gear as a
  `MenuChip`, and the `media-list-chips-items` / `media-list-chips-trailing` test ids.
- 10: both plans edit `packages/i18n-catalog/consumer/originals/*.json` and run
  `npm run i18n:compile`, so they cannot share a phase. Plan 50 edits the same originals, so this
  plan does not share a phase with 50 either (either order works).
- Plans 40 and 50 also edit `apps/web/e2e/media-list-chips.spec.ts` (different tests); do not share
  a phase with them.

## Files

apps/web/src/app/page.tsx
apps/web/src/app/browse/page.tsx
apps/web/src/app/_media-lists/MediaListPageHeader.tsx (new)
apps/web/src/app/_media-lists/podcasts/PodcastsPageClient.tsx
apps/web/src/app/_media-lists/podcasts/PodcastsPageHeader.tsx (delete)
apps/web/src/app/_media-lists/podcasts/PodcastsPageChipRow.tsx (new)
apps/web/src/app/_media-lists/podcasts/PodcastsPageDropdownConfig.ts
apps/web/src/app/_media-lists/podcasts/PodcastsPageContext.tsx
apps/web/src/app/_media-lists/podcasts/PodcastsPageList.tsx
apps/web/src/app/_media-lists/episodes/EpisodesPageClient.tsx
apps/web/src/app/_media-lists/episodes/EpisodesPageHeader.tsx (delete)
apps/web/src/app/_media-lists/episodes/EpisodesPageChipRow.tsx (new)
apps/web/src/app/_media-lists/episodes/EpisodesPageDropdownConfig.tsx
apps/web/src/app/_media-lists/episodes/EpisodesPageContext.tsx
apps/web/src/app/_media-lists/episodes/EpisodesPageList.tsx
apps/web/src/app/_media-lists/clips/ClipsPageClient.tsx
apps/web/src/app/_media-lists/clips/ClipsPageHeader.tsx (delete)
apps/web/src/app/_media-lists/clips/ClipsPageChipRow.tsx (new)
apps/web/src/app/_media-lists/clips/ClipsPageContext.tsx
apps/web/src/app/_media-lists/clips/ClipsPageList.tsx
apps/web/src/app/_media-lists/artists/ArtistsPageClient.tsx
apps/web/src/app/_media-lists/artists/ArtistsPageHeader.tsx (delete)
apps/web/src/app/_media-lists/artists/ArtistsPageChipRow.tsx (new)
apps/web/src/app/_media-lists/artists/ArtistsPageDropdownConfig.ts
apps/web/src/app/_media-lists/artists/ArtistsPageContext.tsx
apps/web/src/app/_media-lists/albums/AlbumsPageClient.tsx
apps/web/src/app/_media-lists/albums/AlbumsPageHeader.tsx (delete)
apps/web/src/app/_media-lists/albums/AlbumsPageChipRow.tsx (new)
apps/web/src/app/_media-lists/albums/AlbumsPageDropdownConfig.ts
apps/web/src/app/_media-lists/albums/AlbumsPageContext.tsx
apps/web/src/app/_media-lists/tracks/TracksPageClient.tsx
apps/web/src/app/_media-lists/tracks/TracksPageHeader.tsx (delete)
apps/web/src/app/_media-lists/tracks/TracksPageChipRow.tsx (new)
apps/web/src/app/_media-lists/tracks/TracksPageDropdownConfig.tsx
apps/web/src/app/_media-lists/livestreams/LivestreamsPageClient.tsx
apps/web/src/app/_media-lists/livestreams/LivestreamsPageHeader.tsx (delete)
apps/web/src/components/MediaListChips/MediaListTrailingChips.tsx (new)
apps/web/src/components/MediaListChips/MediaListTrailingChips.test.tsx (new)
apps/web/src/hooks/useSubscribedListHeader.tsx (delete)
apps/web/src/hooks/useSubscribedListHeader.test.tsx (delete)
apps/web/src/components/Category/CategoriesChip.tsx (new)
apps/web/src/components/Category/CategoriesList.tsx
apps/web/src/styles/components/Category/CategoriesList.module.scss
apps/web/src/components/Modal/ModalCategoriesSelect.tsx (delete)
apps/web/src/utils/categories.ts
packages/i18n-catalog/consumer/originals/en-US.json
packages/i18n-catalog/consumer/originals/es.json
packages/i18n-catalog/consumer/originals/fr.json
packages/i18n-catalog/consumer/originals/el-GR.json
packages/i18n-catalog/consumer/overrides/es.json
packages/i18n-catalog/consumer/overrides/fr.json
packages/i18n-catalog/consumer/overrides/el-GR.json
packages/i18n-catalog/mobile/originals/en-US.json
packages/i18n-catalog/mobile/originals/es.json
packages/i18n-catalog/mobile/originals/fr.json
packages/i18n-catalog/mobile/originals/el-GR.json
packages/i18n-catalog/mobile/overrides/es.json
packages/i18n-catalog/mobile/overrides/fr.json
packages/i18n-catalog/mobile/overrides/el-GR.json
apps/web/e2e/media-list-chips.spec.ts
release-notes/scratchpad.md

The six `overrides/` files change only through `npm run i18n:compile`.

Shared with other areas: `apps/web/src/app/browse/page.tsx` (plan 31 edits it next),
`media-list-chips.spec.ts` (21, 31, D, and E edit it; serialize), the consumer catalog originals
(every catalog-editing plan; never the same phase).

## Reuse

- `MediaListChips` and `MediaListChipsConfig` (plan 21), `ListSortChip` (plan 21), `ViewSelector`
  (plan 21, now a `MenuChip`), `Chip` from `@podverse/ui` (plan 20).
- `useListViewMode(scope | null)` from `apps/web/src/hooks/useListViewMode.ts`. `null` reads the
  app-wide `vs` setting, which is what Episodes and Tracks read through `useLocalSettings()` today.
- `onClickCategory` in `apps/web/src/utils/categories.ts` keeps its URL contract
  (`router.replace` to `<linkPath>?…&category=<key>`).
- Existing catalog keys: `subscriptions.subscribed`, `features.browse.browse`,
  `categories.categories`, `categories.<mapping_key>`, `filters.sort.*`. One key moves layers
  (section 8).

## 1. Server pages pass `chipsConfig`

`apps/web/src/app/page.tsx`:

- Replace the `chipsNode` element (lines 42–44) with
  `const chipsConfig: MediaListChipsConfig = { page: 'subscribed', chips: SUBSCRIBED_CHIPS, selected: chip, urlChip };`.
- Every case passes `chipsConfig={chipsConfig}` instead of `chipsNode={chipsNode}`.
- Replace the `MediaListChips` value import with
  `import type { MediaListChipsConfig } from '../components/MediaListChips/MediaListChips';`.

`apps/web/src/app/browse/page.tsx`:

- Same `chipsConfig` constant with `page: 'browse'` and `chips: BROWSE_CHIPS`, replacing lines
  46–48.
- The seven media cases (`podcasts` through `livestreams`) pass `chipsConfig={chipsConfig}`.
- The `playlists` and `users` cases keep their `chipsNode` prop, now built inline:
  `chipsNode={<MediaListChips {...chipsConfig} />}`. Plan 31 converts them. Keep the
  `MediaListChips` value import and add `import type { MediaListChipsConfig } from …` on its own
  line.

## 2. One title-only header for the seven media lists

New `apps/web/src/app/_media-lists/MediaListPageHeader.tsx`:

```tsx
'use client';

import { useTranslations } from 'next-intl';

import { MainHeader } from '@podverse/ui';

import type { MediaListScope } from '../../utils/mediaListChips';

type MediaListPageHeaderProps = { scope: MediaListScope };

/** Subscribed or Browse title. The list's controls live in its chip row. */
export function MediaListPageHeader({ scope }: MediaListPageHeaderProps) {
  const tSubscriptions = useTranslations('subscriptions');
  const tFeatures = useTranslations('features');
  const title = scope === 'subscribed' ? tSubscriptions('subscribed') : tFeatures('browse.browse');
  return <MainHeader title={title} />;
}
```

Delete `PodcastsPageHeader.tsx`, `EpisodesPageHeader.tsx`, `ClipsPageHeader.tsx`,
`ArtistsPageHeader.tsx`, `AlbumsPageHeader.tsx`, `TracksPageHeader.tsx`, and
`LivestreamsPageHeader.tsx`. Nothing else imports them. No title suffix on either scope (R24): the
Categories chip face carries the category name on Browse.

## 3. `MediaListTrailingChips` — the trailing controls, once

New `apps/web/src/components/MediaListChips/MediaListTrailingChips.tsx` replaces
`useSubscribedListHeader` (delete the hook and its test). It is a component so a list's chip row
can drop it straight into `trailing`:

```tsx
'use client';

import type { SortPrefScope } from '@podverse/helpers';
import type { QueryParamsStatsRange } from '@podverse/helpers-requests';

import { useListViewMode } from '../../hooks/useListViewMode';
import { CategoriesChip } from '../Category/CategoriesChip';
import { ListSortChip } from '../ListSortChip/ListSortChip';
import { ViewSelector } from '../ViewSelector/ViewSelector';

export type MediaListSortFilter<TSort extends string> = {
  page: number;
  sort: TSort;
  range: QueryParamsStatsRange | null;
};

type MediaListTrailingChipsProps<TSort extends string, TFilter extends MediaListSortFilter<TSort>> = {
  filterParams: TFilter;
  setFilterParams: (next: TFilter) => void;
  /** Already-localized, in menu order. */
  sortOptions: readonly { label: string; value: TSort }[];
  /** Browse Podcasts, Episodes, and Clips. Sort and the gear unmount while the list is open. */
  category?: {
    value: string | null;
    isListOpen: boolean;
    setIsListOpen: (open: boolean) => void;
  };
  /** Lists that render one layout leave the gear out. */
  showViewSelector: boolean;
  /** List vs grid remembered for this list only. Omitted lists use the app-wide setting. */
  viewModeScope?: SortPrefScope;
};

/** Categories, then Sort, then the gear, for the end of a media chip row. */
export function MediaListTrailingChips<
  TSort extends string,
  TFilter extends MediaListSortFilter<TSort>,
>({ … }: MediaListTrailingChipsProps<TSort, TFilter>) {
  const { viewSelected, setViewSelected } = useListViewMode(viewModeScope ?? null);
  const rangeSort = sortOptions.find((option) => option.value === 'top')?.value;
  const isCategoryListOpen = category?.isListOpen === true;

  return (
    <>
      {category ? (
        <CategoriesChip
          category={category.value}
          isListOpen={category.isListOpen}
          onToggle={() => category.setIsListOpen(!category.isListOpen)}
        />
      ) : null}
      {isCategoryListOpen ? null : (
        <ListSortChip
          onChange={(sort, range) => setFilterParams({ ...filterParams, page: 1, sort, range })}
          options={sortOptions}
          range={filterParams.sort === rangeSort ? filterParams.range : null}
          rangeSort={rangeSort}
          testId="media-list-sort"
          value={filterParams.sort}
        />
      )}
      {showViewSelector && !isCategoryListOpen ? (
        <ViewSelector setViewSelected={setViewSelected} viewSelected={viewSelected} />
      ) : null}
    </>
  );
}
```

- The spread keeps every other filter field (type, category, medium) as it is, so no
  `preserveAcrossUpdates` and no type assertion: spreading a generic `TFilter` and overriding
  keys yields `TFilter & {…}`, which TypeScript accepts as `TFilter`. Each context's
  `filterParams.medium` already holds the list's medium from SSR, which the old hook re-set by hand.
- Choosing Top no longer forces `range: 'week'`; `ListSortChip` returns the range the user picked.
- Mount Sort whenever the list has a chip row: every list here offers at least Recent and Top.

## 4. Sort options per list

In each `*PageDropdownConfig` file, replace the `get*PageDropdownConfig` function with a sort-option
function. Keep the file names: they also hold the `get*PageFilterParams` resolvers SSR uses. Drop
the `buildSubscribedListDropdownConfig` import from each (keep `buildSubscribedListFilterParams`).
Do not edit `apps/web/src/utils/dropdownMenuItems.ts`; plan 31 deletes the old builder once
Profiles stops calling it.

| File | New function | Returns |
| --- | --- | --- |
| `podcasts/PodcastsPageDropdownConfig.ts` | `getPodcastsPageSortOptions({ type, tFilters })` | `{ label: string; value: QueryParamsSubscribedFullSort }[]`: `type === 'subscribed'` → A-Z, Recent, Top; otherwise Recent, Top |
| `episodes/EpisodesPageDropdownConfig.tsx` | `getEpisodesPageSortOptions(tFilters)` | `{ label: string; value: QueryParamsSubscribedPartialSort }[]`: Recent, Top (Clips calls it too) |
| `artists/ArtistsPageDropdownConfig.ts` | `getArtistsPageSortOptions({ type, tFilters })` | `QueryParamsSubscribedFullSort` options: `type === 'subscribed'` → A-Z, Recent, Top; otherwise Recent, Top |
| `albums/AlbumsPageDropdownConfig.ts` | `getAlbumsPageSortOptions({ type, tFilters })` | same as Artists |
| `tracks/TracksPageDropdownConfig.tsx` | `getTracksPageSortOptions(tFilters)` | `QueryParamsSubscribedPartialSort` options: Recent, Top |

Labels come from `tFilters('sort.a_z' | 'sort.recent' | 'sort.top')`, as today. Annotate each
return type as shown so the component's `TSort` matches the context's `sort` type. Drop the unused
`scope` parameter from the Artists and Albums functions, and drop imports each file no longer uses.

## 5. A chip row per list

Each new `*PageChipRow.tsx` is a `'use client'` named export that reads its page context and renders
`<MediaListChips {...chipsConfig} trailing={<MediaListTrailingChips … />} />`. Props:
`{ chipsConfig: MediaListChipsConfig }` (type import from
`../../../components/MediaListChips/MediaListChips`).

| Chip row | `sortOptions` | `category` | `showViewSelector` | `viewModeScope` |
| --- | --- | --- | --- | --- |
| `PodcastsPageChipRow` | `getPodcastsPageSortOptions({ type: filterParams.type, tFilters })` | Browse only (below) | `true` | `podcastsListViewModeScope(scope)` |
| `EpisodesPageChipRow` | `getEpisodesPageSortOptions(tFilters)` | Browse only | `true` | omitted (app-wide) |
| `ClipsPageChipRow` | `getEpisodesPageSortOptions(tFilters)` | Browse only | `false` (the clip list has one layout) | omitted |
| `ArtistsPageChipRow` | `getArtistsPageSortOptions({ type: filterParams.type, tFilters })` | none | `true` | `artistsListViewModeScope(scope)` |
| `AlbumsPageChipRow` | `getAlbumsPageSortOptions({ type: filterParams.type, tFilters })` | none | `true` | `albumsListViewModeScope(scope)` |
| `TracksPageChipRow` | `getTracksPageSortOptions(tFilters)` | none | `true` | omitted |

"Browse only" means
`category={scope === 'browse' ? { value: filterParams.category, isListOpen: isCategoryListOpen, setIsListOpen: setIsCategoryListOpen } : undefined}`,
matching mobile `shouldShowBrowseCategoryChip` (Podcasts, Episodes, Clips on Browse) and R24 (no
Categories chip on Subscribed).

Each `*PageClient.tsx` (Podcasts, Episodes, Clips, Artists, Albums, Tracks):

- Prop `chipsNode: ReactNode` becomes `chipsConfig: MediaListChipsConfig`; the exported
  `*ListProps` type omits `'chipsConfig'`. Drop the `ReactNode` import.
- Replace `<XPageHeader />` with `<MediaListPageHeader scope={scope} />` (import from
  `../MediaListPageHeader`).
- Replace `{chipsNode}` with `<XPageChipRow chipsConfig={chipsConfig} />`, in the same place inside
  `MainColumnStack`, so it renders inside the context provider.

`LivestreamsPageClient.tsx`: same prop change and header swap; replace `{chipsNode}` with
`<MediaListChips {...chipsConfig} />`. Livestreams has no trailing controls (mobile
`shouldShowBrowseSortChip` is false for livestreams; its list has one layout).

## 6. Categories chip and the inline category list (R6, R22, R23)

### `apps/web/src/components/Category/CategoriesChip.tsx` (new)

```tsx
'use client';

import { useTranslations } from 'next-intl';

import { Chip } from '@podverse/ui';

import { MEDIA_LIST_CATEGORIES_LIST_ID } from './CategoriesList';

type CategoriesChipProps = {
  /** Mapping key of the chosen category, or `null` for all categories. */
  category: string | null;
  isListOpen: boolean;
  onToggle: () => void;
};

/** Browse filter chip that shows or hides the category list. */
export function CategoriesChip({ category, isListOpen, onToggle }: CategoriesChipProps) {
  const tCategories = useTranslations('categories');
  const heading = tCategories('categories');
  const hasCategory = category !== null && category !== '';
  const faceLabel = hasCategory ? tCategories(category) : heading;

  return (
    <Chip
      aria-controls={isListOpen ? MEDIA_LIST_CATEGORIES_LIST_ID : undefined}
      aria-expanded={isListOpen}
      aria-label={hasCategory ? `${heading}: ${faceLabel}` : undefined}
      data-testid="media-list-category-chip"
      onClick={onToggle}
      selected={isListOpen || hasCategory}
      variant="filter"
    >
      {faceLabel}
    </Chip>
  );
}
```

- It is a disclosure button, not a menu: pass `aria-expanded` through the rest props and do not
  set `menuExpanded` (that adds `aria-haspopup="menu"` and a caret). No `pressed`.
- Accessible name: `Categories` with nothing chosen, `Categories: Arts` once Arts is chosen, the
  same `heading: face` shape `ListSortChip` uses.

### `apps/web/src/components/Category/CategoriesList.tsx` (rewrite)

The list now renders inline, in place of the media list, with All Categories first and the current
choice marked:

```tsx
export const MEDIA_LIST_CATEGORIES_LIST_ID = 'media-list-categories';

type CategoriesListProps = {
  onAllCategoriesClick: () => void;
  onCategoryClick: (category: DTOCategory) => void;
  /** Mapping key of the current category; `null` marks All Categories as current. */
  selectedCategory: string | null;
};
```

- Root: `<section aria-label={tCategories('categories')} className={styles.categories}
  data-testid="media-list-categories" id={MEDIA_LIST_CATEGORIES_LIST_ID}>`.
- Inside, one top-level `<ul className={styles.categoryList}>`: its first `<li>` is All Categories
  (`tFeatures('browse.category_all')`, current when `selectedCategory` is `null` or `''`), followed
  by one `<li>` per top-level category. Nested categories keep the existing recursive
  `CategoryListItems` `<ul>` under their parent `<li>`; the whole tree shows, as today (no
  expand/collapse).
- Each row is `<button type="button" className={styles.categoryButton}
  aria-current={isCurrent ? 'true' : undefined} onClick={…}>{label}</button>`. A category is
  current when `category.mapping_key === selectedCategory`. Plain buttons because the shared
  `Link` has no `aria-current` prop. Drop the `Link` import and the unused click `event` argument.
- Hooks: `useCategories()`, `useTranslations('categories')`, `useTranslations('features')`. Add
  `'use client'` at the top.

`apps/web/src/styles/components/Category/CategoriesList.module.scss`: keep `.categoryList` and its
nested rules; add:

```scss
@use '../../mixins/focus';

.categoryButton {
  padding: var(--spacing-none);
  border: none;
  background: none;
  color: var(--text-color-link);
  font: inherit;
  text-align: left;
  cursor: pointer;

  &:hover {
    color: var(--text-color-link-hover);
  }

  &:focus-visible {
    outline: none;
    @include focus.focus-ring;
  }

  &[aria-current='true'] {
    color: var(--text-color-primary);
    font-weight: var(--font-weight-bold);
  }
}
```

Put the `@use` line first in the file. Add `.categories {}` only if a rule is needed; otherwise drop
the `className` from the section.

Delete `apps/web/src/components/Modal/ModalCategoriesSelect.tsx`: its three callers are the lists
below, and nothing else imports it or `CategoriesList`.

### `apps/web/src/utils/categories.ts`

- Rename the `setShowCategoriesModal` parameter of `onClickCategory` to `setIsCategoryListOpen`
  (type and destructuring). Behavior unchanged.
- Add below it:

```ts
type OnClickAllCategoriesParams<T extends { category: string | null; page: number; type: string }> = {
  filterParams: T;
  setFilterParams: (params: T) => void;
  setIsCategoryListOpen: (isOpen: boolean) => void;
};

/** Clears the category: the list returns to the global directory on page 1. */
export const onClickAllCategories = <T extends { category: string | null; page: number; type: string }>({
  filterParams,
  setFilterParams,
  setIsCategoryListOpen,
}: OnClickAllCategoriesParams<T>) => {
  setFilterParams({ ...filterParams, type: 'global', category: null, page: 1 });
  setIsCategoryListOpen(false);
};
```

No router call: the Podcasts context rewrites the URL from `filterParams` with
`history.replaceState`, and the Episodes and Clips contexts already drop `?category` with
`router.replace` once the category is `null`.

### The three lists

`PodcastsPageList.tsx`, `EpisodesPageList.tsx`, `ClipsPageList.tsx`:

- Read `isCategoryListOpen` and `setIsCategoryListOpen` from the context instead of the modal
  state; pass `setIsCategoryListOpen` to `onClickCategory`.
- Add `handleOnClickAllCategories` calling `onClickAllCategories({ filterParams, setFilterParams,
  setIsCategoryListOpen })`.
- Immediately before the final `return (`, after every hook and handler:

```tsx
if (isCategoryListOpen) {
  return (
    <CategoriesList
      onAllCategoriesClick={handleOnClickAllCategories}
      onCategoryClick={handleOnClickCategory}
      selectedCategory={filterParams.category}
    />
  );
}
```

- Remove the `<ModalCategoriesSelect … />` element and its import.

Choosing the selected media chip does not close the list (`MediaListChips` returns early on the
selected chip, and this plan does not change it); the Categories chip closes it. Choosing another
media chip mounts a fresh page client with the list closed.

## 7. Context state renames

- `PodcastsPageContext.tsx`, `EpisodesPageContext.tsx`, `ClipsPageContext.tsx`: rename
  `showCategoriesModal` / `setShowCategoriesModal` to `isCategoryListOpen` /
  `setIsCategoryListOpen` in the context type, the `useState`, and the provider value.
- `ArtistsPageContext.tsx`, `AlbumsPageContext.tsx`: delete the unused `showCategoriesModal` state
  (type lines 30–31, `useState` line 71, provider value lines 141–142). Keep the `useState` import;
  other state uses it.

## 8. Catalog: All Categories for web

`features.browse.category_all` lives in the mobile layer only. Web needs it, and one key path may
not sit in two layers, so move it to the consumer layer (mobile merges consumer, so mobile's
`t('features.browse.category_all')` keeps working):

- `packages/i18n-catalog/consumer/originals/{en-US,es,fr,el-GR}.json`: in `features.browse` (about
  line 131), add `"category_all"` after `"browse"`: en-US `All Categories`, es
  `Todas las categorías`, fr `Toutes les catégories`, el-GR `Όλες οι κατηγορίες` (the values the
  mobile layer has today).
- `packages/i18n-catalog/mobile/originals/{en-US,es,fr,el-GR}.json`: delete the
  `"category_all"` line from `features.browse` (en-US about line 41, the others about line 37).
- Grep each key and edit with StrReplace; never rewrite a whole catalog file. Keep the JSON valid.
- Then run `npm run i18n:compile` from the repo root (agent shell: `eval "$(direnv export zsh)"`
  first). It moves the empty override slots from the mobile overrides to the consumer overrides. Do
  not hand-edit `overrides/`.

`filters.type.category` loses its last web caller; leave it in the catalog.

## 9. Recommendations (R26)

No change in this plan. Mobile `RecommendationsScreen` has the media chips and no sort or layout
control (the list is ranked by strength and has one layout), and web matches that already. Plan 21
restyles its chip row; plan 12 owns its title.

## Tests

Vitest, `apps/web/src/components/MediaListChips/MediaListTrailingChips.test.tsx`, in the style of
the deleted `useSubscribedListHeader.test.tsx`:

- Mock `../ListSortChip/ListSortChip` with a stub (`data-testid="sort-stub"`) that renders one
  `button` per option, whose click calls `onChange(option.value, option.value === 'top' ? 'month' :
  null)`; mock `../ViewSelector/ViewSelector` with `<span data-testid="view-selector-stub" />`; mock
  `../Category/CategoriesChip` with a `button` (`data-testid="categories-stub"`) whose click calls
  `onToggle`; mock `../../hooks/useListViewMode` to return
  `{ viewSelected: 'grid', setViewSelected: vi.fn() }`. Type each stub's props; no `any`.
- Choosing Recent from `{ category: 'arts', medium: 'av', page: 3, range: 'week', sort: 'top',
  type: 'category' }` calls `setFilterParams` with exactly `{ category: 'arts', medium: 'av', page:
  1, range: null, sort: 'recent', type: 'category' }`.
- Choosing Top from a Recent filter passes the range the chip returned (`range: 'month'`), not
  `week`.
- With a closed category and `showViewSelector`, the stubs render in the order categories, sort,
  view selector (compare the `data-testid` order of the container's descendants).
- With `category.isListOpen` true, only the categories stub renders; clicking it calls
  `setIsListOpen(false)`.
- With `showViewSelector={false}`, no view-selector stub.

Playwright, `apps/web/e2e/media-list-chips.spec.ts` (after plan 21's `chipRow` change):

- Add helpers below `chipButton`:
  `const chipTrailing = (page: Page) => page.getByTestId('media-list-chips-trailing');` and
  `const sortChip = (page: Page) => chipTrailing(page).getByRole('button', { name: /^Sort: / });`.
- Replace the test `A Browse category link keeps the chip` (lines 276–299) with
  `On Browse, the Categories chip shows the category list in place of the list and hides Sort until
  a category is chosen`:
  1. Open `/browse?tab=episodes`. Episodes is pressed. The trailing category chip
     (`chipTrailing(page).getByTestId('media-list-category-chip')`) has the accessible name
     `Categories` and `aria-expanded="false"`; `sortChip(page)` is visible. Click the category chip:
     `aria-expanded="true"`, `page.getByTestId('media-list-categories')` is visible, and
     `sortChip(page)` and the trailing `Change Layout View` button have count 0. Capture the
     category list.
  2. Click `Arts` inside the category list. The path is `/browse?tab=episodes&category=arts`,
     Episodes is still pressed, the category chip's accessible name is `Categories: Arts` with
     `aria-expanded="false"`, the category list has count 0, and `sortChip(page)` is visible.
     Capture the category chip.
  3. Click the category chip again. Inside the list, the `Arts` button has `aria-current="true"`.
     Click `All Categories`. The path is `/browse?tab=episodes` and the category chip's accessible
     name is `Categories`. Capture the category chip.
- Add the test `Subscribed and Browse lists put Sort and the gear after the media chips, and only
  where the list uses them`:
  1. Open `/?tab=episodes&category=arts` (signed out). The `Subscribed` heading (exact) is visible,
     a heading matching `/Subscribed >/` has count 0, the trailing category chip has count 0,
     `sortChip(page)` has the accessible name `Sort: Recent`, and the trailing `Change Layout View`
     button is visible. Capture the sort chip.
  2. Open `/browse`. Click `sortChip(page)`. The menu renders in a portal on `body` (plan 20), so
     find it from the page: `page.getByRole('menu', { name: 'Sort' })` is visible and
     `page.getByTestId('media-list-chips').getByRole('menu')` has count 0. Click
     `page.getByRole('menuitemradio', { name: 'Top', exact: true })`.
     `page.getByRole('menu', { name: 'Range' })` is visible; click its `menuitemradio` named
     `Month`. `sortChip(page)` has the accessible name `Sort: Month`. Capture the sort chip.
  3. Open `/browse?tab=clips`: the category chip and `sortChip(page)` are visible and the trailing
     `Change Layout View` button has count 0. Open `/browse?tab=artists`: the category chip has
     count 0, and `sortChip(page)` and the trailing `Change Layout View` button are visible. Capture
     the Artists sort chip.
- Leave the Livestreams assertions (no `Global` in the header, no `Change Layout View`) as they
  are; they still hold.

Specs checked and left alone: `recommendations.spec.ts` (plan 12 owns it; no sort or category
there), `podcasts-subscribed-filter.spec.ts` (uses the filter field only, which stays on the
Subscribed Podcasts list), `artists-list-date-and-view.spec.ts` (plan 21 updates the gear menu
roles; its `Change Layout View` and `media-list-chips` lookups still resolve with the gear in the
chip row). No other spec clicks the area C dropdowns or asserts the title suffix.

## Release scratchpad

```markdown
## Subscribed and Browse list controls move into the chip row

- Surfaces: web, mobile (catalog key moved layers only)
- Change: On Subscribed and Browse, the type, sort, and range dropdowns in the page header are
  gone. Sort is a chip at the end of the media chips; choosing Top asks for the range (Day, Week,
  Month, All Time) in the same menu instead of defaulting to Week. The grid/list gear follows Sort
  on lists that have two layouts (not Clips or Livestreams). On Browse Podcasts, Episodes, and
  Clips, a Categories chip comes first: pressing it shows the category list in place of the
  results (Sort and the gear hide while it is open), with All Categories at the top and the current
  choice marked. The chip then shows the chosen category ("Categories: Arts" to screen readers).
  The category modal is removed, and the page title no longer adds "> Category". The
  `features.browse.category_all` string moved from the mobile catalog layer to the consumer layer.
- Who notices: everyone using Subscribed or Browse on the web; translators see the All Categories
  string under consumer instead of mobile
- Operator steps: none
```
