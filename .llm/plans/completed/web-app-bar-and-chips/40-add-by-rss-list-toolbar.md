**Cursor model:** Cursor Grok 4.7 · **Reasoning:** high

# 40 — Add by RSS library: action buttons above the chips

The `/add-by-rss` library is the one list that keeps page actions out of the chip row. Row 1 is Add Feed and Check for Updates, side by side, in the content column. Row 2 is the media chips, then a Sort chip in place of the Recent dropdown, then the gear.

Add by RSS detail pages (podcast, album, artist, and the generic feed page) stay as they are. Area E owns their section chips and sort.

## Rows

R7, R8, R9, R11, R12, R13, R14, R15

## Runs after

11, 21

Plan 11 makes `MainHeader` publish the page title and turns `buttonsNode` into a right-aligned content row on large screens and a row under the title on small screens. These actions do not use that slot. Plan 21 supplies `MediaListChipsConfig`, the `trailing` slot, `ListSortChip`, and the gear as a `MenuChip`. Code against those APIs.

## Answer (R7)

This screen diverges from Subscribed and Browse on purpose. Those screens put every control in the chip row. Here the two library actions are buttons above that row, and only the sort and the gear join the chips.

## Layout

`AddByRSSListHeader` stays outside `MainWrapper` and renders `<MainHeader title={title} />` with no `buttonsNode`. The title string stays `tFeatures('add_by_rss.label')` ("Add by RSS"). On large screens that title is the bar heading. On small screens it is the title row under the bar. Do not add another `h1`.

Inside `MainColumnStack`, where `{chipsNode}` is rendered today, render `AddByRSSListToolbar`:

1. A left-aligned row, `data-testid="add-by-rss-list-actions"`, with Add Feed then Check for Updates.
2. `<MediaListChips {...chipsConfig} trailing={…} />`.

Both buttons use `Button` `variant="primary"` (the 44px filled button). They leave `variant="mini"`. Same labels as today: `tFeatures('add_feed.add_feed')` ("Add Feed") and `tFeatures('add_by_rss.check_updates')` ("Check for Updates"). Add Feed still `router.push(ROUTES.ADD_BY_RSS_ADD)`. Check for Updates still calls the client's `onCheckUpdates` and passes `isLoading={isUpdating}`.

The row is `display: flex; flex-wrap: wrap; align-items: center; justify-content: flex-start; gap: var(--spacing-md); margin-bottom: var(--spacing-2xl);`. The bottom margin matches `.chipRow` in `MediaListChips.module.scss`, so the space under the buttons matches the space under the chips. Buttons keep their own width. Do not set `block`.

Trailing order, mounted only when that chip uses the control:

1. `ListSortChip` when the caller passes `sort`.
2. `ViewSelector` when the caller passes `view`.

Pass `trailing={undefined}` when both are omitted, so `ChipRow` renders no `media-list-chips-trailing` wrapper. No disabled stand-in.

`ListSortChip` options, in this order, with no `rangeSort`:

- `{ value: 'recent', label: tFilters('sort.recent') }` ("Recent")
- `{ value: 'oldest', label: tFilters('sort.oldest') }` ("Oldest")

`testId="add-by-rss-sort"`. `onChange` receives `(next, range)`; call `sort.onChange(next)` and ignore `range`. The face's accessible name is `Sort: Recent` or `Sort: Oldest`. Menu rows are `menuitemradio`.

There is no Categories chip on this screen.

Sort values, the `?sort=` read on load, and the date or index ordering stay in each client. Do not write the sort into the URL, and do not add a sort-pref cookie. An inbound `?sort=oldest` still initializes state the way it does today. Choosing a sort still only updates that state.

## Toolbar and header

Both live in `apps/web/src/components/AddByRSS/List/AddByRSSListHeader.tsx`. Styles import last, from `apps/web/src/styles/components/AddByRSS/List/AddByRSSListToolbar.module.scss`.

```tsx
type AddByRSSListHeaderProps = {
  title: string;
};

type AddByRSSListToolbarProps = {
  chipsConfig: MediaListChipsConfig;
  isUpdating: boolean;
  onCheckUpdates: () => void;
  sort?: {
    value: AddByRSSListSortOrder;
    onChange: (value: AddByRSSListSortOrder) => void;
  };
  view?: {
    viewSelected: ViewSelectedOption;
    setViewSelected: (view: ViewSelectedOption) => void;
  };
};
```

`AddByRSSListSortOrder` is the existing `'recent' | 'oldest'` union in `apps/web/src/contexts/AddByRSSListContext.tsx`. `MediaListChipsConfig` is the type plan 21 exports from `MediaListChips.tsx`. `ViewSelectedOption` stays the type from `ViewSelector.tsx`.

Drop `extraButtons`, `showViewSelector`, `checkUpdatesLabel`, and the button markup from the header. The toolbar reads the two catalog keys itself.

## Page

`apps/web/src/app/add-by-rss/page.tsx` builds a serializable config and stops rendering `<MediaListChips>`:

```tsx
const chipsConfig: MediaListChipsConfig = {
  page: 'add-by-rss',
  chips: ADD_BY_RSS_CHIPS,
  selected: chip,
  urlChip,
};
```

Import `MediaListChipsConfig` as a type. Pass `chipsConfig` into every branch of the `switch` in place of `chipsNode`. The chip resolution (`resolveMediaListChip`, `ADD_BY_RSS_CHIPS`) stays.

## Clients

Each list client takes `chipsConfig: MediaListChipsConfig` instead of `chipsNode: React.ReactNode`. The header call becomes `<AddByRSSListHeader title={tFeatures('add_by_rss.label')} />`. Replace `{chipsNode}` with the toolbar. Delete each local `sortMenuItems` array, the `Dropdown` import, and `useTranslations('filters')` (those four files use `tFilters` only for the dropdown labels).

| Client | `sort` | `view` |
| --- | --- | --- |
| `AddByRSSListClient` (`extraButtons` today) | When `resourceType` is `podcasts`, `albums`, or `tracks`. `value` is `listSort`. `onChange` is `handleListSortChange`, retargeted to `(value: AddByRSSListSortOrder) => void` and `setListSort(value)`. | Always. `{ viewSelected, setViewSelected }` from `useLocalSettings`. |
| `AddByRSSEpisodesPageClient` | Always. `handleSortChange` takes `AddByRSSListSortOrder`, sets sort, and sets page to 1. Keep `toSortOption` for `searchParams.get('sort')`. | Always. |
| `AddByRSSArtistsPageClient` | Always. `handleSortChange` takes `AddByRSSListSortOrder`, sets sort, and sets page to 1. Keep `toSortOption`. | Always. |
| `AddByRSSTracksPageClient` | Always. Same handler shape as episodes. Keep `toSortOption`. | Always. |
| `AddByRSSLivestreamsPageClient` | Omit. | Omit. Remove the `useLocalSettings` call; this file only used it to feed the header. The list still passes `viewSelected="rows"` to `AddByRSSLivestreamNodes`. |

Replace the local `SortOption` alias in the episodes, artists, and tracks clients with `AddByRSSListSortOrder`. Leave the sort comparisons, index queries, pagination, parse handlers, and empty states as they are.

`AddByRSSListClient` still date-sorts podcast and album feeds from `listSort`, and the tracks branch of that client still passes `listSort` into the items index. Do not move that logic into the toolbar.

## Files

apps/web/src/components/AddByRSS/List/AddByRSSListHeader.tsx
apps/web/src/styles/components/AddByRSS/List/AddByRSSListToolbar.module.scss
apps/web/src/app/add-by-rss/page.tsx
apps/web/src/components/AddByRSS/List/AddByRSSListClient.tsx
apps/web/src/components/AddByRSS/List/AddByRSSEpisodesPageClient.tsx
apps/web/src/components/AddByRSS/List/AddByRSSArtistsPageClient.tsx
apps/web/src/components/AddByRSS/List/AddByRSSTracksPageClient.tsx
apps/web/src/components/AddByRSS/List/AddByRSSLivestreamsPageClient.tsx
apps/web/e2e/media-list-chips.spec.ts
release-notes/scratchpad.md

Shared with other areas: `media-list-chips.spec.ts` (plan 21 edits the `chipRow` helper; area C edits the Subscribed and Browse dropdown steps in the same file). This plan does not edit `MediaListChips.tsx`, `ViewSelector.tsx`, `dropdownMenuItems.ts`, `packages/ui/src/index.ts`, or any i18n catalog. `AddByRSSListHeader.tsx` is not in an area A plan; this plan is the one that changes that call.

## Tests

Playwright, in `apps/web/e2e/media-list-chips.spec.ts`. Default viewport. Follow the spec's existing sentence-style steps. Pass the element a step is about to `capturePageLoad`.

In the test `The Add by RSS page has its own chips and Add Feed`, add a step after the library link opens Podcasts and before `Add Feed opens the add-feed page`:

- `#mainOuterWrapper` shows Add Feed and Check for Updates inside `getByTestId('add-by-rss-list-actions')`.
- `page.locator('header')` contains neither button.
- The actions row's bounding box sits above `getByTestId('media-list-chips')` (actions bottom at or above the chips' top). Add Feed's box is to the left of Check for Updates.
- `getByTestId('media-list-chips-trailing')` contains a button named `Sort: Recent` and, to its right, `Change Layout View`.
- `getByRole('button', { name: 'Recent', exact: true })` has count 0.
- Click `Sort: Recent`, then `page.getByRole('menuitemradio', { name: 'Oldest', exact: true })`. The menu renders in a portal on `body` (plan 20), so look it up from `page`, not from `media-list-chips-trailing`. The button name becomes `Sort: Oldest`.
- Capture that step with the actions row as the verified element.

Leave the following `Add Feed opens the add-feed page` step. `getByRole('button', { name: 'Add Feed', exact: true })` still finds the library button.

In `When an Add by RSS feed has a live item…`, the first step currently scopes Add Feed and Check for Updates to `page.locator('header')` and expects `Change Layout View` count 0. Point the two button assertions at `add-by-rss-list-actions`. Assert the header contains neither button. Assert `media-list-chips-trailing` is absent, `Sort: Recent` has count 0, and `Change Layout View` still has count 0.

Do not edit the later step `Choosing Oldest leaves the livestream rows in the same vertical order`. That `Recent` button is on the Add by RSS podcast detail page.

No unit test. The toolbar binds existing buttons and plan 21's chip to strings and callbacks the clients already own. No new catalog keys, so no `i18n:compile`.

## Release scratchpad

```markdown
## Add by RSS library puts its actions above the chips

- Surfaces: web
- Change: On the Add by RSS library, Add Feed and Check for Updates are large filled buttons side by side above the media chips. Recent and Oldest move into a Sort chip after those chips, and the grid/list gear sits to the right of Sort. The Livestreams chip still has no Sort chip and no gear. The page title stays Add by RSS in the top bar.
- Who notices: listeners using Add by RSS on the web
- Operator steps: none
```
