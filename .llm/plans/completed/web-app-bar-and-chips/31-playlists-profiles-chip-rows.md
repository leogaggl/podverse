**Cursor model:** Cursor Grok 4.7 · **Reasoning:** high

# 31 — Playlists and Users: chip rows with a trailing Sort chip

Browse's Playlists and Users chips, and the standalone `/playlists` and `/profiles` pages, lose
their type tabs, medium tabs, and sort and range dropdowns. Each gets one chip row:

| Screen | Items (pills) | Trailing |
| --- | --- | --- |
| Browse > Playlists | the Browse media chips | `Filter: Podcasts` / `Filter: Music` chip, then Sort (range only: public playlists sort by Top) |
| Browse > Users | the Browse media chips | Sort (Recent, Top) |
| `/playlists` | My Playlists, Subscribed, Global | the same Filter chip, then Sort |
| `/profiles` | Global, Subscribed | Sort |

None of these lists has a second layout, so there is no gear. The "Create Playlist" button stays in
the `/playlists` header (`MainHeader buttonsNode`, a page action under plan 11).

## Rows

R21, R26 (Browse Playlists and Users chips and their standalone pages), R36

## Runs after

30

Plan 30 adds `MediaListTrailingChips`, the `chipsConfig` constant in `browse/page.tsx`, and the
`chipTrailing` / `sortChip` helpers in `media-list-chips.spec.ts`. Plan 21 (before 30) adds
`ListSortChip`, `MediaListChipsConfig`, and `STATS_RANGE_LABEL_KEYS` in `dropdownMenuItems.ts`.

## Files

apps/web/src/app/browse/page.tsx
apps/web/src/app/playlists/PlaylistsPageClient.tsx
apps/web/src/app/playlists/PlaylistsPageListHeader.tsx (delete)
apps/web/src/app/playlists/PlaylistsPageChipRow.tsx (new)
apps/web/src/app/playlists/PlaylistsPageDropdownConfig.ts
apps/web/src/styles/app/playlists/PlaylistsListHeader.module.scss (delete)
apps/web/src/app/profiles/ProfilesPageClient.tsx
apps/web/src/app/profiles/ProfilesPageHeader.tsx
apps/web/src/app/profiles/ProfilesPageChipRow.tsx (new)
apps/web/src/app/profiles/ProfilesPageDropdownConfig.ts
apps/web/src/utils/dropdownMenuItems.ts
apps/web/src/utils/dropdownMenuItems.test.ts
apps/web/e2e/media-list-chips.spec.ts
apps/web/e2e/playlists-profiles-chips.spec.ts (new)
makefiles/local/e2e-spec-order-web.txt
release-notes/scratchpad.md

Shared with other areas: `dropdownMenuItems.ts` (plan 21 adds `STATS_RANGE_LABEL_KEYS` first),
`media-list-chips.spec.ts` (21, 30, 40, 50; do not share a phase with 40 or 50).
`PlaylistsPageListHeader.tsx` is the Playlists caller of `ListHeader`; plan 50 leaves
`ListHeader` unchanged, and this plan stops using it on Playlists.

## Reuse

- `MediaListTrailingChips` (plan 30) for Sort: it already spreads `filterParams`, resets the page,
  and passes the chosen range. Here `showViewSelector={false}` and no `category`.
- `MediaListChips` / `MediaListChipsConfig` (plan 21) on Browse; `ChipRow` and `MenuChip` from
  `@podverse/ui` (plan 20) on the standalone pages.
- The chip row spacing class `.chipRow` in
  `apps/web/src/styles/components/MediaListChips/MediaListChips.module.scss`
  (`margin-bottom: var(--spacing-2xl)`), so a standalone row sits like the Browse row.
- Existing catalog keys only: `features.playlist.my_playlists`, `filters.type.subscribed`,
  `filters.type.global`, `filters.screen.filter_heading` ("Filter"), `media.podcast.podcasts`,
  `media.music.music`, `filters.sort.*`. No catalog edit.

## 1. `browse/page.tsx`

The `playlists` and `users` cases pass `chipsConfig={chipsConfig}` in place of
`chipsNode={<MediaListChips {...chipsConfig} />}`. Remove the `MediaListChips` value import; keep
the `MediaListChipsConfig` type import.

## 2. Playlists

### `PlaylistsPageDropdownConfig.ts`

Replace `getPlaylistsPageDropdownConfig` with:

```ts
export function getPlaylistsPageSortOptions({
  type,
  tFilters,
}: {
  type: QueryParamsPlaylistsType;
  tFilters: (key: string) => string;
}): { label: string; value: QueryParamsSubscribedFullSort }[] {
  if (type === 'public') {
    return [{ label: tFilters('sort.top'), value: 'top' }];
  }
  return [
    { label: tFilters('sort.top'), value: 'top' },
    { label: tFilters('sort.a_z'), value: 'a_z' },
    { label: tFilters('sort.recent'), value: 'recent' },
    { label: tFilters('sort.oldest'), value: 'oldest' },
  ];
}
```

Delete the `GetPlaylistsPageDropdownConfig` type and the `getRangeDropdownItems` import. Leave
`getPlaylistsPageFilterParams` and its types alone. With only Top, `ListSortChip` is range-only:
every open shows the range menu.

### `PlaylistsPageChipRow.tsx` (new; replaces `PlaylistsPageListHeader.tsx`)

`'use client'`; `export function PlaylistsPageChipRow({ chipsConfig }: { chipsConfig?: MediaListChipsConfig })`.
Read `filterParams` and `setFilterParams` from `usePlaylistsPageContext()`.

- Type change, kept from the deleted header: choosing the current type does nothing; `public` sets
  `{ ...filterParams, type, sort: 'top', range: 'week', page: 1 }`; `private` and
  `private_followed` set `{ ...filterParams, type, sort: 'a_z', range: null, page: 1 }`.
- Medium: `const medium = filterParams.medium === 'music' ? 'music' : 'av';`,
  `const mediumLabel = medium === 'music' ? tMedia('music.music') : tMedia('podcast.podcasts');`,
  and options
  `[{ value: 'av', label: tMedia('podcast.podcasts') }, { value: 'music', label: tMedia('music.music') }]`.
- Trailing:

```tsx
const trailing = (
  <>
    <MenuChip
      faceLabel={mediumLabel}
      label={tFilters('screen.filter_heading')}
      onSelect={(nextMedium) => setFilterParams({ ...filterParams, medium: nextMedium, page: 1 })}
      options={mediumOptions}
      selected
      testId="playlists-medium"
      value={medium}
    />
    <MediaListTrailingChips
      filterParams={filterParams}
      setFilterParams={setFilterParams}
      showViewSelector={false}
      sortOptions={getPlaylistsPageSortOptions({ type: filterParams.type, tFilters })}
    />
  </>
);
```

  Type `mediumOptions` as `MenuChipOption<'av' | 'music'>[]` (type import from `@podverse/ui`).
  The accessible name is `Filter: Podcasts` or `Filter: Music`, which never matches the
  `Podcasts` media chip by exact name.
- Render, on Browse (`chipsConfig !== undefined`):
  `<MediaListChips {...chipsConfig} trailing={trailing} />`. No type chips (Browse lists public
  playlists only).
- Otherwise:

```tsx
<ChipRow
  className={chipRowStyles.chipRow}
  items={[
    { key: 'private', label: tFeatures('playlist.my_playlists') },
    { key: 'private_followed', label: tFilters('type.subscribed') },
    { key: 'public', label: tFilters('type.global') },
  ]}
  onSelect={handleTypeChange}
  selectedKey={filterParams.type}
  testId="playlists-type-chips"
  trailing={trailing}
/>
```

  with `import chipRowStyles from '../../styles/components/MediaListChips/MediaListChips.module.scss';`
  last among the imports (**styles-import-last**).

Delete `PlaylistsPageListHeader.tsx` and
`apps/web/src/styles/app/playlists/PlaylistsListHeader.module.scss` (only that file imported it).
`PlaylistsHeader.module.scss` stays (the Create Playlist icon uses it).

### `PlaylistsPageClient.tsx`

- `chipsNode?: ReactNode` becomes `chipsConfig?: MediaListChipsConfig`; `PlaylistsListProps` omits
  `'chipsConfig'`; drop the `ReactNode` import and the `chipsNode = null` default.
- Replace `{chipsNode}` and `<PlaylistsPageListHeader />` with
  `<PlaylistsPageChipRow chipsConfig={chipsConfig} />`.

`PlaylistsPageHeader.tsx` is unchanged.

## 3. Profiles

### `ProfilesPageDropdownConfig.ts`

Replace `getProfilesPageDropdownConfig` with:

```ts
export function getProfilesPageSortOptions({
  type,
  tFilters,
}: {
  type: QueryParamsSubscribedType;
  tFilters: (key: string) => string;
}): { label: string; value: QueryParamsSubscribedFullSort }[] {
  const recentAndTop: { label: string; value: QueryParamsSubscribedFullSort }[] = [
    { label: tFilters('sort.recent'), value: 'recent' },
    { label: tFilters('sort.top'), value: 'top' },
  ];
  return type === 'subscribed'
    ? [{ label: tFilters('sort.a_z'), value: 'a_z' }, ...recentAndTop]
    : recentAndTop;
}
```

Drop the `buildSubscribedListDropdownConfig` import; keep `buildSubscribedListFilterParams`.

### `ProfilesPageHeader.tsx`

Title only: keep the `title` line, return `<MainHeader title={title} />`. Delete the three type
guards, the three handlers, `buttonsNode`, and the imports they used (`Dropdown`, the
`@podverse/helpers-requests` imports, `getProfilesPageDropdownConfig`, `useTranslations('filters')`).

### `ProfilesPageChipRow.tsx` (new)

`'use client'`; `export function ProfilesPageChipRow({ chipsConfig }: { chipsConfig?: MediaListChipsConfig })`.

- `const trailing = <MediaListTrailingChips filterParams={filterParams}
  setFilterParams={setFilterParams} showViewSelector={false}
  sortOptions={getProfilesPageSortOptions({ type: filterParams.type, tFilters })} />;`
- On Browse (`chipsConfig !== undefined`): `<MediaListChips {...chipsConfig} trailing={trailing} />`.
- Otherwise a `ChipRow` with `className={chipRowStyles.chipRow}`, items
  `[{ key: 'global', label: tFilters('type.global') }, { key: 'subscribed', label: tFilters('type.subscribed') }]`
  typed `ChipRowItem<'global' | 'subscribed'>[]`,
  `selectedKey={filterParams.type === 'subscribed' ? 'subscribed' : 'global'}`,
  `testId="profiles-type-chips"`, and `trailing={trailing}`.
- Type change, kept from the old header: choosing the current type does nothing; `global` sets
  `{ ...filterParams, page: 1, type: 'global', sort: 'recent', range: null }`; `subscribed` sets
  `{ ...filterParams, page: 1, type: 'subscribed', sort: 'a_z', range: null }`.

### `ProfilesPageClient.tsx`

Same prop change as Playlists (`chipsConfig?: MediaListChipsConfig`, `ProfilesListProps` omits it,
drop `ReactNode` and the `null` default). Replace `{chipsNode}` with
`<ProfilesPageChipRow chipsConfig={chipsConfig} />`.

## 4. Remove the old dropdown builder

With Profiles off it, `buildSubscribedListDropdownConfig` has no caller. In
`apps/web/src/utils/dropdownMenuItems.ts` delete `buildSubscribedListDropdownConfig`,
`toTypeMenuItems`, `toSortMenuItems`, `SubscribedListDropdownSortOption`,
`SubscribedListDropdownTypeOption`, and the `DropdownOption` import. Keep `getRangeDropdownItems`
and `STATS_RANGE_LABEL_KEYS` (detail pages still use them) and `buildSubscribedListFilterParams`.
In `dropdownMenuItems.test.ts` delete the `describe('buildSubscribedListDropdownConfig', …)` block
and its now-unused imports.

Before deleting, Grep `apps/web/src` for each removed name; if anything outside this file still
imports one, stop and report it.

## Tests

Playwright, `apps/web/e2e/media-list-chips.spec.ts`, test `Browse Playlists and Users chips show
public lists without type tabs` (keep its existing assertions):

- Playlists step: the trailing `Filter: Podcasts` button (exact) is visible and `sortChip(page)` has
  the accessible name `Sort: Week`. Click `sortChip(page)`:
  `page.getByRole('menu', { name: 'Range' })` is visible (no Sort step); press Escape. Chip menus
  render in a portal on `body` (plan 20), so every menu and `menuitemradio` lookup in these steps
  and in the new spec below starts from `page`, never from a chip row or its trailing test id.
- Users step: `sortChip(page)` has the accessible name `Sort: Recent`.

New `apps/web/e2e/playlists-profiles-chips.spec.ts`, top-level
`test.describe('Playlists and Profiles chip rows', …)`, signed out, using `capturePageLoad` from
`./helpers/stepScreenshots` and the readable step style of `media-list-chips.spec.ts`:

1. `The playlists page shows type chips, then the Filter and Sort chips`: open `/playlists`. The
   `Playlists` heading (exact) and the `Create Playlist` button are visible.
   `page.getByTestId('playlists-type-chips-items').getByRole('button')` has the texts
   `My Playlists`, `Subscribed`, `Global`; `Global` has `aria-pressed="true"`. Inside
   `page.getByTestId('playlists-type-chips-trailing')`, `Filter: Podcasts` is visible and the
   `/^Sort: /` button reads `Sort: Week`. Click `My Playlists`: it is pressed and the sort button
   reads `Sort: A-Z`. Capture the type chips.
2. `Choosing Music in the Filter chip keeps the type chips and names the medium`: from `/playlists`,
   click `Filter: Podcasts`, then `page.getByRole('menuitemradio', { name: 'Music', exact: true })`.
   The trailing button
   `Filter: Music` is visible and `Global` is still pressed. Capture the Filter chip.
3. `The profiles page shows Global and Subscribed chips, then Sort`: open `/profiles`. The type
   chips (`profiles-type-chips-items`) read `Global`, `Subscribed`, with `Global` pressed; the
   trailing sort button reads `Sort: Recent`. Click it, choose
   `page.getByRole('menuitemradio', { name: 'Top', exact: true })`, then `Week` in
   `page.getByRole('menu', { name: 'Range' })`; it reads `Sort: Week`. Capture the sort chip.

`makefiles/local/e2e-spec-order-web.txt`: add `apps/web/e2e/playlists-profiles-chips.spec.ts` on
the line after `apps/web/e2e/media-list-chips.spec.ts`.

Vitest: no new cases. `dropdownMenuItems.test.ts` only loses the deleted builder's block; the
trailing chips are covered by plan 30's `MediaListTrailingChips.test.tsx`.

## Release scratchpad

```markdown
## Playlists and Users list controls become chips

- Surfaces: web
- Change: Browse > Playlists and Browse > Users show their Sort control at the end of the Browse
  chip row instead of dropdowns. Playlists also get a "Filter" chip (Podcasts or Music) in place of
  the Podcasts/Music tabs. On the standalone Playlists page, My Playlists, Subscribed, and Global
  are pill chips followed by Filter and Sort; on the standalone Profiles page, Global and
  Subscribed are pill chips followed by Sort. Choosing Top asks for the range in the same menu.
  Changing the Podcasts/Music filter returns to page 1.
- Who notices: web listeners browsing playlists and profiles
- Operator steps: none
```
