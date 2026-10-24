**Cursor model:** Cursor Grok 4.7 · **Reasoning:** high

# 21 — Web chip row trailing slot, sort chip wrapper, and gear chip

Move the web's app-local chip pieces onto plan 20's `@podverse/ui` chip family:

- `MediaListChips` renders through `ChipRow` and gains a `trailing` slot. Areas C and D fill it.
- New `ListSortChip` binds the sort chip to the web catalog and the stats range values. Areas C,
  D, and E mount it.
- `ViewSelector` (the gear) becomes a `MenuChip`, so it matches the chips it will sit next to.

This plan changes no screen header. The gear stays where each header puts it today, and no sort
dropdown is replaced here. Areas C, D, and E move each screen's controls into the chip row.

## Rows

R4, R5, R10

## Runs after

20

## Files

apps/web/src/components/MediaListChips/MediaListChips.tsx
apps/web/src/styles/components/MediaListChips/MediaListChips.module.scss
apps/web/src/components/ListSortChip/ListSortChip.tsx
apps/web/src/components/ViewSelector/ViewSelector.tsx
apps/web/src/styles/components/ViewSelector/ViewSelector.module.scss (delete)
apps/web/src/utils/dropdownMenuItems.ts
apps/web/e2e/media-list-chips.spec.ts
apps/web/e2e/artists-list-date-and-view.spec.ts
release-notes/scratchpad.md

Shared with other areas: `MediaListChips.tsx` and `media-list-chips.spec.ts` (C, D),
`ViewSelector.tsx` (C, D, E import it; the props do not change), `dropdownMenuItems.ts` (C, E
edit the dropdown config builders in it), `artists-list-date-and-view.spec.ts` (C). This plan runs
before every area C, D, and E plan.

## 1. `MediaListChips` — `ChipRow` and the trailing slot (R4, R10)

`apps/web/src/components/MediaListChips/MediaListChips.tsx`:

- Export the serializable part of the props so a server `page.tsx` can hand it to a client
  component, and the client can add the trailing controls it owns:

```ts
/** What a server page knows about the chip row. Serializable; a client adds `trailing`. */
export type MediaListChipsConfig = {
  page: MediaListChipsPage;
  chips: readonly MediaListChip[];
  selected: MediaListChip;
  urlChip: MediaListChip | null;
};

type MediaListChipsProps = MediaListChipsConfig & {
  /**
   * Controls after the media chips, in this order: Category (Browse only, where it applies),
   * Sort, then the gear. Mount each only when the selected chip can use it.
   */
  trailing?: ReactNode;
};
```

- Keep the `useEffect` and `onSelect` logic exactly as they are.
- Replace the `<div className={styles.chipRow}>` + `ButtonTabs` markup with:

```tsx
<ChipRow
  className={styles.chipRow}
  items={chips.map((chip) => ({ key: chip, label: t(MEDIA_LIST_CHIP_LABEL_KEYS[chip]) }))}
  onSelect={onSelect}
  selectedKey={selected}
  testId="media-list-chips"
  trailing={trailing}
/>
```

- Import `ChipRow` from `@podverse/ui` (drop `ButtonTabs`), and `ReactNode` as a type import.
- Update the doc comment to say the row is the media chips plus the trailing controls.

`apps/web/src/styles/components/MediaListChips/MediaListChips.module.scss`: keep `.chipRow`
(`margin-bottom: var(--spacing-2xl)`); delete `.chips`, which only targeted `ButtonTabs`.

Existing callers (`app/page.tsx`, `app/browse/page.tsx`, `app/add-by-rss/page.tsx`,
`RecommendationsPageClient.tsx`) keep compiling unchanged: they pass the four config props and no
`trailing`.

### The contract areas C and D follow

- A server `page.tsx` builds a `MediaListChipsConfig` instead of a `chipsNode` element, and passes
  it to the client as a prop (for example `chipsConfig`).
- The client renders `<MediaListChips {...chipsConfig} trailing={…} />` from inside its page
  context provider, where the filter state lives.
- Trailing order is Category (Browse only), `ListSortChip`, then `ViewSelector`. A control is not
  mounted when the selected chip cannot use it; there is no disabled placeholder.
- The DOM test ids are `media-list-chips` (whole row), `media-list-chips-items` (media chips),
  `media-list-chips-<chip>` (one media chip), and `media-list-chips-trailing`.

## 2. `ListSortChip` — web wrapper for `SortChip` (R5)

Areas C, D, and E each mount a sort chip with the same headings, range values, and range labels.
Per **app-local-ui-wrappers**, that wiring lives once in
`apps/web/src/components/ListSortChip/ListSortChip.tsx`:

```tsx
'use client';

import { useTranslations } from 'next-intl';

import type { QueryParamsStatsRange } from '@podverse/helpers-requests';
import { QUERY_PARAMS_STATS_RANGE_VALUES } from '@podverse/helpers-requests';
import { SortChip } from '@podverse/ui';

import { STATS_RANGE_LABEL_KEYS } from '../../utils/dropdownMenuItems';

type ListSortChipProps<TSort extends string> = {
  /** Already-localized sort labels, in menu order. */
  options: readonly { value: TSort; label: string }[];
  value: TSort;
  /** The sort that takes a popularity range ('top'). Omit when no option takes one. */
  rangeSort?: TSort;
  /** Current range; `null` unless `value === rangeSort`. */
  range: QueryParamsStatsRange | null;
  /** `range` is non-null exactly when `sort === rangeSort`. */
  onChange: (sort: TSort, range: QueryParamsStatsRange | null) => void;
  testId: string;
};

/** List sort chip: the face is the current sort, or the range while Top is selected. */
export function ListSortChip<TSort extends string>({ … }: ListSortChipProps<TSort>) {
  const tFilters = useTranslations('filters');
  return (
    <SortChip
      heading={tFilters('screen.sort_heading')}
      onChange={onChange}
      options={options}
      range={
        rangeSort === undefined
          ? undefined
          : {
              sort: rangeSort,
              heading: tFilters('screen.range_heading'),
              options: QUERY_PARAMS_STATS_RANGE_VALUES.map((value) => ({
                value,
                label: tFilters(STATS_RANGE_LABEL_KEYS[value]),
              })),
              value: range,
            }
      }
      testId={testId}
      value={value}
    />
  );
}
```

- Use the existing catalog keys only: `filters.screen.sort_heading` ("Sort"),
  `filters.screen.range_heading` ("Range"), and `filters.range.day|week|month|all_time`. No new
  keys. The face while Top is selected reads the range label ("Week"), as on mobile.
- No `shortLabel`: the web range labels are already short.
- The accessible name of the face is `Sort: <face>`, for example `Sort: Recent` or `Sort: Week`.
- The wrapper does not persist anything. Callers keep writing sort and range through their
  existing filter-state and sort-pref code (**filter-sort-persistence**), and a caller choosing
  Top no longer forces `range: 'week'`, because the chip always returns the range the user chose.

`apps/web/src/utils/dropdownMenuItems.ts`: add, above `getRangeDropdownItems`,

```ts
/** `filters` catalog key for each popularity range. */
export const STATS_RANGE_LABEL_KEYS = {
  day: 'range.day',
  week: 'range.week',
  month: 'range.month',
  'all-time': 'range.all_time',
} as const satisfies Record<QueryParamsStatsRange, string>;
```

and make `getRangeDropdownItems` map `QUERY_PARAMS_STATS_RANGE_VALUES` through it
(`{ label: tFilters(STATS_RANGE_LABEL_KEYS[value]), param: 'range', value }`), so the dropdowns
and the chip read one table. Its output is unchanged. Import `QUERY_PARAMS_STATS_RANGE_VALUES`
from `@podverse/helpers-requests` beside the existing imports. Leave the rest of the file alone.

## 3. `ViewSelector` — the gear as a chip (R10)

`apps/web/src/components/ViewSelector/ViewSelector.tsx` keeps its exported name, its
`ViewSelectedOption` type, and its props, so every caller compiles unchanged. Replace the body:

```tsx
export function ViewSelector({ viewSelected, setViewSelected }: ViewSelectorProps) {
  const tLayouts = useTranslations('layouts');

  return (
    <MenuChip
      icon={<FaGear />}
      label={tLayouts('change_layout_view')}
      onSelect={setViewSelected}
      options={[
        { value: 'grid', label: tLayouts('grid_view') },
        { value: 'rows', label: tLayouts('list_view') },
      ]}
      position="right"
      testId="view-selector"
      value={viewSelected}
    />
  );
}
```

- Import `MenuChip` from `@podverse/ui`; drop `DropdownMenuPanel`, `useDropdownKeyboardNavigation`,
  `useRef`, and the styles import.
- The `✓ ` text prefix goes away; the menu marks the current view as a checked radio item.
- The button keeps the accessible name and title `Change Layout View`.
- Its menu now renders in a portal on `document.body` (plan 20, `MenuChip`), wherever the gear
  sits. `position="right"` lines the menu's right edge up with the gear's right edge.
- Delete `apps/web/src/styles/components/ViewSelector/ViewSelector.module.scss` and its now-empty
  folder.

Until areas C, D, and E move it, the gear chip renders in each header's `buttonsNode` where the
old gear was.

## Tests

Playwright, following each spec's existing style:

- `apps/web/e2e/media-list-chips.spec.ts`: change the `chipRow` helper (line 142) to
  `page.getByTestId('media-list-chips-items')`, so the label-order assertions
  (`chipRow(page).getByRole('button')).toHaveText(...)`) keep counting only media chips once
  trailing controls join the row.
- Same spec, add the test `On a narrow screen the Browse chips stay on one line and the chosen
  chip is scrolled into view`: `page.setViewportSize({ width: 390, height: 844 })`, open
  `/browse?tab=users`. `media-list-chips-users` has `aria-pressed="true"`. The bounding boxes of
  `media-list-chips-podcasts` and `media-list-chips-users` have the same `y` (one line, no wrap).
  The `media-list-chips-users` box lies horizontally inside the `media-list-chips` box (left edge
  at or right of the row's left, right edge at or left of the row's right). Capture the chip row,
  passing `media-list-chips-users` as the verified element.
- `apps/web/e2e/artists-list-date-and-view.spec.ts`:
  - `gridViewItem` becomes `page.getByRole('menuitemradio', { name: 'Grid View', exact: true, checked: true })`.
  - Line 67 clicks `page.getByRole('menuitemradio', { name: 'Grid View', exact: true })`.
  - Line 85 clicks `page.getByRole('menuitemradio', { name: 'List View', exact: true })`.
  - `layoutButton` (`Change Layout View`) and the `media-list-chips` button lookups stay as they
    are.

Unit coverage of the chip behavior is in plan 20. No web unit test: the app has no `next-intl`
component test setup, and the wrappers only bind strings.

## Release scratchpad

```markdown
## Web chip row and gear restyle

- Surfaces: web
- Change: The media chips on Subscribed, Browse, Add by RSS, and Recommendations are round pills
  that fill with the primary color when selected. When the chips do not fit, the row stays on one
  line and scrolls sideways (no visible scrollbar) instead of wrapping, and the selected chip is
  scrolled into view. The grid/list gear is a square chip with the
  same height, and its menu marks the current view with a check (announced as checked to screen
  readers) instead of a "✓" text prefix. Adds the shared sort chip used by later list changes.
- Who notices: everyone using list pages on the web
- Operator steps: none
```
