**Cursor model:** Cursor Grok 4.7 · **Reasoning:** extra high

# 10 — In-field clear X for web and management-web search and filter inputs

Every web and management-web search or filter field renders through `TextInput` in
`@podverse/ui`. This plan gives `TextInput` an icon-only clear control at the right edge of the
field, shown only while the field has text. It then routes the three shared search and filter
fields through it (`SearchInput`, `TableFilterBar`, and the web subscribed-podcasts filter), and
removes the subscribed filter's text "Clear" button. The management table filter's X clears and
applies the empty filter at once, through a new `clearSearch` on `useTableFilterState`. The X's
accessible names come from two new shared catalog keys, `misc.clear_search` and
`misc.clear_filter`.

## Rows

R1, R2, R3, R6, R8, R10, R12, R15, R16, R17, R18

## Runs after

none

## Files

- packages/ui/src/components/form/TextInput/TextInput.tsx
- packages/ui/src/components/form/TextInput/TextInput.module.scss
- packages/ui/src/components/form/TextInput/TextInput.test.tsx
- packages/ui/src/components/form/SearchInput/SearchInput.tsx
- packages/ui/src/components/form/SearchInput/SearchInput.test.tsx
- packages/ui/src/hooks/useTableFilterState.ts
- packages/ui/src/hooks/useTableFilterState.test.tsx
- packages/ui/src/components/table/TableFilterBar/TableFilterBar.tsx
- packages/ui/src/components/table/TableWithFilter/TableWithFilter.tsx
- packages/ui/src/components/table/TableWithFilter/TableWithFilter.test.tsx
- packages/ui/src/components/table/ResourceTableWithFilter/ResourceTableWithFilter.test.tsx
- packages/ui/src/index.ts
- packages/ui/PACKAGES-UI.md
- apps/web/src/app/_media-lists/podcasts/PodcastsFilterInput.tsx
- apps/web/src/app/search/SearchPageListHeader.tsx
- apps/web/src/components/ItemTranscript/ItemTranscript.tsx
- apps/management-web/src/components/Table/managementTableChrome.tsx
- apps/management-web/src/app/(management)/workers/WorkersPageClient.tsx
- packages/i18n-catalog/shared/originals/en-US.json
- packages/i18n-catalog/shared/originals/es.json
- packages/i18n-catalog/shared/originals/fr.json
- packages/i18n-catalog/shared/originals/el-GR.json
- packages/i18n-catalog/management/originals/en-US.json
- packages/i18n-catalog/management/originals/es.json
- packages/i18n-catalog/management/originals/fr.json
- packages/i18n-catalog/management/originals/el-GR.json
- apps/web/e2e/podcasts-subscribed-filter.spec.ts
- apps/web/e2e/search-page.spec.ts
- apps/management-web/e2e/workers-page.spec.ts
- release-notes/scratchpad.md

Do not edit any `packages/i18n-catalog/*/overrides/*.json` file (**i18n-management**). The set's
verification runs `npm run i18n:compile` before `npm run i18n:validate`. Compile rebuilds every
override file from its originals: it adds empty `misc.clear_search` and `misc.clear_filter` slots
to `shared/overrides/*` and drops the `tableShared.searchClearLabel` slot from
`management/overrides/*`. Until compile runs, validate reports `override_key_mismatch` for those
layers.

## What the code does today

- `TextInput` (`packages/ui/src/components/form/TextInput/TextInput.tsx`) has a `button?:
  TextInputButton` prop that renders a text `Button variant="mini"` inside the field, and a
  `buttonIcon?: TextInputButtonIcon` prop (start or end, no accessible name). The plain input
  branch (no prefix, suffix, or native picker) has no `ref`, so the component cannot focus it.
- `SearchInput` keeps its own `inputValue` state, debounces `onSearch` by 1000 ms, and uses
  `buttonIcon` at `start` for the magnifying glass. Callers: `apps/web/src/app/search/SearchPageListHeader.tsx`
  and `apps/web/src/components/ItemTranscript/ItemTranscript.tsx`. Neither passes `onChange`.
  The transcript field has no `aria-label`.
- `TableFilterBar` renders `TextInput type="search"`. Chrome and Safari paint their own cancel
  glyph on `type="search"` (`::-webkit-search-cancel-button`), and `all: unset` on `.input` does
  not remove it. It is rendered only by `TableWithFilter` (two branches) and management-web
  `WorkersPageClient`.
- `TableWithFilter` passes `labels.searchPlaceholder`, `filterColumnsLabel`, and
  `funnelAriaLabel` to `TableFilterBar`, and `filter.setSearch` as `onSearchChange`. The `filter`
  prop is a `TableWithFilterFilterBag`. `ResourceTableWithFilter` types its `labels` as
  `TableWithFilterProps<TRow>['labels'] & { actionsColumn?: ReactNode }` and builds its `filter`
  from `useTableFilterState`, so it inherits a new label and a new bag field with no code change.
- Every production filter bag comes from `useTableFilterState`: `ResourceTableWithFilter`,
  `WorkersPageClient`, `StatsPageClient`, `ProductMembershipsPageClient`, and
  `TableBrowserPageClient`. Only `TableWithFilter.test.tsx` builds bag literals by hand (five).
- Every management-web table page builds its labels from `useManagementTableChrome().filterLabels`
  (`managementTableChrome.tsx`), either directly or by spreading it (Users, Storage, Stats,
  Product Memberships, Feed Flag Status directory, Database table browser, Admins).
  `WorkersPageClient` renders `TableFilterBar` itself and passes the labels one by one.
- `useTableFilterState` debounces by 400 ms (`TABLE_SEARCH_DEBOUNCE_MS`): an effect on `search`
  clears `debounceRef`, returns when `search === initialSearch`, and otherwise schedules a timer
  that either merges the table cookie and refreshes (cookie mode) or pushes the URL with or
  without `search`. It has no way to apply a term at once.
- `PodcastsFilterInput` passes `button={{ label: tSubscriptions('filter.clear'), onClick: () =>
  onChange('') }}` while the value is non-empty. That text button is the only search or filter
  "Clear" button on web or management-web, and it is the only web caller of
  `subscriptions.filter.clear`.
- `tableShared.searchClearLabel` exists in all four management originals and has no caller.
- The shared layer has a `misc` block (`loading`, `faq`, `try_again`, `reload_page`,
  `return_to_home_page`) in all four locales. No layer has `misc.clear_search` or
  `misc.clear_filter`. Web and management-web both already read `useTranslations('misc')`, and
  the management layer has no `misc` block of its own.

## Decisions

- **Accessible names (R15, `00-SUMMARY.md` § Clear labels).** The X is icon-only, so it carries an
  `aria-label` from a new shared key:
  - `misc.clear_search` ("Clear Search"): the web Search page field and the web item transcript
    search, both through `SearchInput`.
  - `misc.clear_filter` ("Clear Filter"): the web subscribed-podcasts filter, and every
    management table filter (`TableFilterBar`, through `TableWithFilter` and the Workers page).
  - No X uses `subscriptions.filter.clear`, `filters.list.clear`, or
    `tableShared.searchClearLabel`.
- **Prop names follow the label.** `TableFilterBar` takes `clearFilterAriaLabel` and
  `onSearchClear`. `TableWithFilter`'s `labels` gets `clearFilterAriaLabel`. `SearchInput` takes
  `clearButtonAriaLabel`.
- **When the X shows (R6):** `clearButton` is set, `value !== ''`, and the field is neither
  `disabled` nor `readOnly`. Whitespace counts as text.
- **What pressing it does (R18):** call `onClear`, then focus the input, so the field stays
  focused and keyboard focus does not fall to `<body>` when the X unmounts. The operator confirmed
  this ("Keep the keyboard up on mobile and on web.").
- **`SearchInput` clears immediately.** Pressing the X cancels any pending debounce and calls
  `onSearch('')` once, right away. It does not call `onChange`, because there is no native change
  event; `onSearch('')` is the clear signal, and no caller passes `onChange`.
- **The table filter clears immediately (R16).** `useTableFilterState` gets `clearSearch()`. It
  cancels any pending delayed apply, sets the term to `''`, and applies the empty filter in the
  same call: a URL push without `search` (plus `searchSyncParams`), or a cookie merge with
  `search: ''` and `page: 1` plus a refresh. A last-applied guard stops the debounce effect from
  scheduling a second apply of `''` afterwards. The table X calls it through `onSearchClear`.
  Backspacing to empty keeps the 400 ms path.
- **One X only.** Hide the browser's native search cancel glyph on every `TextInput`.
- **`button` stays.** `TextInputButton` and the `button` prop stay for the copy and add fields
  (`ModalShare`, `ModalClipCreated`, `AddByRSSAddFeedPageClient`). Only `PodcastsFilterInput`
  stops using it.
- **Out of scope (R17):** the Feed Flag Status "Find Feed" lookup (`FlagStatusPageClient.tsx`, the
  `feed-flag-lookup-value` field) gets no X. It is a form field with an eyebrow and a separate
  Search submit button, not a live search or filter. The operator confirmed this ("Leave Find
  Feed without an X.").

## Catalog keys

Keys this plan adds, in the **shared** layer, all four locales:

| Key path | en-US | es | fr | el-GR |
| --- | --- | --- | --- | --- |
| `misc.clear_search` | Clear Search | Borrar búsqueda | Effacer la recherche | Εκκαθάριση αναζήτησης |
| `misc.clear_filter` | Clear Filter | Borrar filtro | Effacer le filtre | Εκκαθάριση φίλτρου |

Keys this plan removes, from the **management** layer, all four locales:

- `tableShared.searchClearLabel` (no caller before or after this plan).

### Consumer keys this plan stops using

These keep their catalog entries; this plan removes no consumer key. Plan 20 decides their
removal once both plans land (`00-SUMMARY.md` § Clear labels).

- `subscriptions.filter.clear` — its only web caller, `PodcastsFilterInput.tsx`, stops using it.
  Mobile callers today: `HomeScreen.tsx` and `AddByRssRootScreen.tsx` (`clearLabel`).

`filters.list.clear` has no web caller before or after this plan, so it is not on the list. Its
callers today are mobile only: `PodcastDetailScreen.tsx` and `AddByRssHomeDetailScreen.tsx`.

## Steps

### 1. `TextInput` gets `clearButton`

In `packages/ui/src/components/form/TextInput/TextInput.tsx`:

- Import `FaXmark` from `react-icons/fa6`, added to the existing `FaCalendarDays, FaCircleQuestion,
  FaClock` import. Import `IconButton` from `'../../button/IconButton/IconButton'`
  (extensionless, Tier C).
- Add the type after `TextInputButtonIcon`:

```tsx
export type TextInputClearButton = {
  ariaLabel: string;
  onClear: () => void;
};
```

- Add `clearButton?: TextInputClearButton;` to `TextInputProps`, after `className`, with a
  short doc comment: "Icon-only clear control at the end of the field, shown while `value` is
  non-empty and the field is editable."
- Destructure `clearButton` beside `button` and `buttonIcon`.
- Add `ref={inputRef}` to the plain `<input>` in the last branch (the one with
  `className={classNames(styles.input, type === 'number' && styles.numberInput)}`).
- Compute, near `hasAffixes`:

```tsx
const activeClearButton =
  clearButton !== undefined && value !== '' && !disabled && !readOnly ? clearButton : undefined;
```

- Render it right after the closing `</div>` of `styles.textInnerInputWrapper`, before the
  native picker affix, number stepper, `button`, and end `buttonIcon`:

```tsx
{activeClearButton !== undefined ? (
  <IconButton
    appearance="ghost"
    aria-label={activeClearButton.ariaLabel}
    className={styles.clearButton}
    onClick={() => {
      activeClearButton.onClear();
      inputRef.current?.focus();
    }}
  >
    <FaXmark aria-hidden className={styles.clearButtonIcon} />
  </IconButton>
) : null}
```

In `TextInput.module.scss`:

- Inside `.input`, after the `&:focus, &:focus-visible` block, hide the native search glyphs:

```scss
  &::-webkit-search-cancel-button,
  &::-webkit-search-decoration {
    appearance: none;
    display: none;
    -webkit-appearance: none;
  }
```

- After `.buttonIconEnd`, add the X's styles. The wrapper prefix outranks `IconButton`'s
  `.base` color, whatever order the two modules load in:

```scss
.textInputWrapper .clearButton {
  color: var(--text-color-secondary);
  height: 28px;
  margin-left: var(--spacing-md);
  width: 28px;

  &:hover,
  &:focus-visible {
    color: var(--text-color-primary);
  }
}

.clearButtonIcon {
  font-size: var(--font-size-md);
}
```

In `packages/ui/src/index.ts`, in the `export type { TextInputButton, TextInputButtonIcon,
TextInputProps } from './components/form/TextInput/TextInput';` block (around line 387), add
`TextInputClearButton` after `TextInputButtonIcon`.

### 2. `SearchInput` gets the X

In `packages/ui/src/components/form/SearchInput/SearchInput.tsx`:

- Add a required `clearButtonAriaLabel: string;` as the first field of `SearchInputProps`, and
  destructure it.
- Add `const lastSearchedRef = useRef<string | null>(null);` beside `debounceTimeout`. It holds
  the last value passed to `onSearch`.
- In the debounce effect, return early when `inputValue === null || inputValue ===
  lastSearchedRef.current`, so a value that was already searched is not searched again. Inside
  the timeout, set `lastSearchedRef.current = inputValue;` before calling `onSearchRef.current`.
- In `handleButtonClick` (the glass), set `lastSearchedRef.current = inputValue;` before calling
  `onSearchRef.current(inputValue)`.
- Add the clear handler:

```tsx
const handleClear = useCallback(() => {
  if (debounceTimeout.current) {
    clearTimeout(debounceTimeout.current);
  }
  lastSearchedRef.current = '';
  setInputValue('');
  onSearchRef.current('');
}, []);
```

- Pass `clearButton={{ ariaLabel: clearButtonAriaLabel, onClear: handleClear }}` to `TextInput`.

### 3. `useTableFilterState` gets `clearSearch`

In `packages/ui/src/hooks/useTableFilterState.ts`:

- Add `clearSearch: () => void;` to `UseTableFilterStateReturn`, first field, with the doc
  comment: "Clears the term and applies the empty filter at once. Cancels any pending delayed
  apply."
- Add `const lastAppliedSearchRef = useRef<string | null>(null);` beside `debounceRef`. It holds
  the last term the hook applied to the URL or cookie.
- In the `initialSearch` sync effect, inside the `if`, add
  `lastAppliedSearchRef.current = initialSearch;` before `setSearch(initialSearch)`. A Back
  navigation or server refresh resets what counts as applied.
- Move the body of the current timer callback (everything after `debounceRef.current = null;`)
  into a callback above the debounce effect. It takes the term as a parameter, records it, and
  keeps the `if (cookieRefreshMode)` shape unchanged:

```ts
const applySearch = useCallback(
  (term: string) => {
    lastAppliedSearchRef.current = term;
    if (cookieRefreshMode) {
      mergeTableListStateInBrowserCookie(tableListStateCookieName, tableListStateListKey, {
        search: term.trim(),
        page: 1,
      });
      void (afterCookieListMutation !== undefined
        ? afterCookieListMutation()
        : Promise.resolve(router.refresh()));
      return;
    }
    const params = new URLSearchParams(currentQueryParams);
    if (term.trim() !== '') {
      params.set('search', term.trim());
    } else {
      params.delete('search');
    }
    if (searchSyncParams !== undefined) {
      for (const [k, v] of Object.entries(searchSyncParams)) {
        params.set(k, v);
      }
    }
    const query = params.toString();
    router.push(query !== '' ? `${basePath}?${query}` : basePath);
  },
  [
    afterCookieListMutation,
    basePath,
    cookieRefreshMode,
    currentQueryParams,
    router,
    searchSyncParams,
    tableListStateCookieName,
    tableListStateListKey,
  ]
);
```

- Rewrite the debounce effect to use it. The early return also skips a term that was already
  applied, which is what stops a second apply of `''` after `clearSearch`:

```ts
useEffect(() => {
  if (debounceRef.current !== null) {
    clearTimeout(debounceRef.current);
  }
  if (search === initialSearch || search === lastAppliedSearchRef.current) {
    return;
  }
  debounceRef.current = setTimeout(() => {
    debounceRef.current = null;
    applySearch(search);
  }, TABLE_SEARCH_DEBOUNCE_MS);
  return () => {
    if (debounceRef.current !== null) {
      clearTimeout(debounceRef.current);
    }
  };
}, [applySearch, initialSearch, queryParamsKey, search]);
```

- Add the clear function after the effect:

```ts
const clearSearch = useCallback(() => {
  if (debounceRef.current !== null) {
    clearTimeout(debounceRef.current);
    debounceRef.current = null;
  }
  setSearch('');
  applySearch('');
}, [applySearch]);
```

- Return `clearSearch` first in the returned object.

Why the guard holds: `applySearch('')` sets `lastAppliedSearchRef.current = ''` before React
re-renders, so the effect run caused by `setSearch('')` sees `search === ''` equal to the applied
term and schedules nothing. When the URL catches up, `initialSearch` becomes `''` and the sync
effect sets the ref to `''` again. A later term (`'news'`) differs from the ref, so it debounces
and applies as before. After a term is applied and the URL carries it, backspacing to empty
differs from the ref and applies `''` through the debounce, as before.

### 4. `TableFilterBar` and `TableWithFilter`

- `TableFilterBar.tsx`: add two required props first in `TableFilterBarProps`:
  `clearFilterAriaLabel: string;` and `onSearchClear: () => void;`. Destructure both, and pass
  `clearButton={{ ariaLabel: clearFilterAriaLabel, onClear: onSearchClear }}` to its `TextInput`.
  Keep `type="search"`, because `workers-page.spec.ts` finds the field by the `searchbox` role.
- `TableWithFilter.tsx`:
  - Add `clearSearch: () => void;` as the first field of `TableWithFilterFilterBag`.
  - Add `clearFilterAriaLabel: string;` as the first field of the `labels` object type.
  - On both `TableFilterBar` renders (the `bodyRender` branch and the default branch), add
    `clearFilterAriaLabel={labels.clearFilterAriaLabel}` and
    `onSearchClear={filter.clearSearch}`.
- `ResourceTableWithFilter.tsx`: no change. Its `filter` comes from `useTableFilterState`, which
  now returns `clearSearch`, and its `labels` inherit `clearFilterAriaLabel` through
  `TableWithFilterProps<TRow>['labels']`.

### 5. Catalog

Use Grep to find each anchor, then StrReplace; do not rewrite a catalog file
(**large-file-reading**). Each language keeps its own capitalization (**ui-copy-casing**).

- `packages/i18n-catalog/shared/originals/{en-US,es,fr,el-GR}.json`: inside the `misc` block,
  after `"return_to_home_page": …`, add a comma and the two keys from § Catalog keys, in the
  order `clear_search`, `clear_filter`. For en-US:

```json
    "return_to_home_page": "Return to Home Page",
    "clear_search": "Clear Search",
    "clear_filter": "Clear Filter"
```

  es: `"Borrar búsqueda"`, `"Borrar filtro"`. fr: `"Effacer la recherche"`,
  `"Effacer le filtre"`. el-GR: `"Εκκαθάριση αναζήτησης"`, `"Εκκαθάριση φίλτρου"`.
- `packages/i18n-catalog/management/originals/{en-US,es,fr,el-GR}.json`: under `tableShared`,
  delete the `"searchClearLabel": …,` line (line 45 in each, after `searchSubmitLabel`). The
  following `filterColumnsLabel` line keeps its comma.
- Do not touch `overrides/` (see § Files).

### 6. Management-web wiring

- `apps/management-web/src/components/Table/managementTableChrome.tsx`: add
  `const tMisc = useTranslations('misc');` after `const tc = useTranslations('common');`, and add
  `clearFilterAriaLabel: tMisc('clear_filter'),` as the first field of `filterLabels`. Every page
  that passes or spreads `chrome.filterLabels` picks it up.
- `apps/management-web/src/app/(management)/workers/WorkersPageClient.tsx`: on the
  `<TableFilterBar` render (around line 312), add
  `clearFilterAriaLabel={chrome.filterLabels.clearFilterAriaLabel}` and
  `onSearchClear={filter.clearSearch}`.

### 7. Web callers

- `PodcastsFilterInput.tsx`: add `const tMisc = useTranslations('misc');` after
  `tSubscriptions`. Delete the `button={...}` prop. Add
  `clearButton={{ ariaLabel: tMisc('clear_filter'), onClear: () => onChange('') }}`.
  `TextInput` hides it while the value is empty, so the caller does not branch on `value`.
- `SearchPageListHeader.tsx`: add `const tMisc = useTranslations('misc');` after `tMedia`, and
  add `clearButtonAriaLabel={tMisc('clear_search')}` to `SearchInput`. `tFilters` stays; it still
  labels the type chips.
- `ItemTranscript.tsx`: add `const tMisc = useTranslations('misc');` after `tInfo`. On
  `SearchInput`, add `aria-label={tInfo('transcript.search_transcript')}`, which gives the field a
  name that lasts after the placeholder disappears (**screen-reader-accessibility**), and add
  `clearButtonAriaLabel={tMisc('clear_search')}`.

### 8. Docs

`packages/ui/PACKAGES-UI.md`, under `### Composites`:

- `useTableFilterState` bullet (line 190): change "debounced search, URL or cookie sync,
  optional funnel columns." to "debounced search, URL or cookie sync, optional funnel columns;
  **`clearSearch`** empties the term and applies it at once."
- `TableFilterBar` bullet (line 197): change "search field + funnel" to "search field with an
  in-field clear X (**`clearFilterAriaLabel`**, **`onSearchClear`**; `TableWithFilter` passes
  `labels.clearFilterAriaLabel` and `filter.clearSearch`) + funnel".

The doc has no `TextInput` props bullet, so add nothing else.

## Tests

Unit (Vitest, `packages/ui`):

- `TextInput.test.tsx`, add three cases:
  - With `clearButton` set and `value=""`, no button named by its `ariaLabel` renders.
  - With `value="abc"`, the button renders with that name. Clicking it calls `onClear` once, and
    `document.activeElement` is the input (`screen.getByRole('textbox')`).
  - With `value="abc"` and `disabled`, no clear button renders. Repeat with `readOnly`, in the
    same test.
- `SearchInput.test.tsx` (new, same imports and `afterEach(cleanup)` as `TextInput.test.tsx`;
  pass `clearButtonAriaLabel="Clear Search"`):
  - No clear button before typing. After `fireEvent.change` to `'abc'`, the button named
    `Clear Search` shows.
  - With `vi.useFakeTimers()`: type `'abc'`, click the X before 1000 ms pass, then advance
    2000 ms. `onSearch` was called exactly once, with `''`. The input value is `''`, and the X
    is gone. Restore real timers at the end.
  - Type `'abc'`, advance 1000 ms (`onSearch('abc')`), then click the X. `onSearch` calls are
    `[['abc'], ['']]`, with no second `''` after another 2000 ms.
- `useTableFilterState.test.tsx`, add three cases with `vi.useFakeTimers()`, restoring real
  timers at the end of each like the existing cases:
  - "clearSearch applies the empty filter at once and nothing fires afterwards": default mode,
    `initialSearch: 'rss'`. Call `result.current.clearSearch()` inside `act`. Without advancing
    timers, expect `mockPush` called once with `'/feeds'` and `result.current.search` to be `''`.
    Advance `TABLE_SEARCH_DEBOUNCE_MS * 2`; `mockPush` still has one call. Then
    `setSearch('news')` and advance `TABLE_SEARCH_DEBOUNCE_MS`; the last call is
    `'/feeds?search=news'`, so the guard does not block a new term.
  - "clearSearch cancels a pending delayed apply": default mode, `initialSearch: ''`.
    `setSearch('rss')`, advance `TABLE_SEARCH_DEBOUNCE_MS / 2`, then `clearSearch()`. Advance
    `TABLE_SEARCH_DEBOUNCE_MS * 2`. `mockPush.mock.calls` equals `[['/feeds']]`; no call carries
    `search=rss`.
  - "clearSearch writes the cookie and refreshes at once in cookie mode": cookie mode with
    cookie name `test_table_state_clear` and list key `feeds`, `initialSearch: 'podcast'`. Call
    `clearSearch()`. Without advancing timers, the decoded cookie contains `"search":""` and
    `mockRefresh` has one call. After `TABLE_SEARCH_DEBOUNCE_MS * 2`, still one call.
- `TableWithFilter.test.tsx`: add `clearFilterAriaLabel: 'Clear Filter'` to every `labels`
  object and `clearSearch: vi.fn()` to every `filter` bag literal (five places each). Add one
  case: with `filter.search: 'abc'`, a button named `Clear Filter` renders, and clicking it calls
  `filter.clearSearch` once and `filter.setSearch` not at all.
- `ResourceTableWithFilter.test.tsx`: add `clearFilterAriaLabel: 'Clear Filter'` to its
  `labels` (line 51).

Playwright (follow **e2e-readability**, **e2e-screenshot-verified-element**, and the 10 s budget
in **test-timeout-budget**):

- `apps/web/e2e/podcasts-subscribed-filter.spec.ts`, first test:
  - Add `const clearFilterButton = (page: Page) => page.getByRole('button', { name: 'Clear
    Filter', exact: true });` beside `filterInput`.
  - In "The subscribed list arrives unfiltered", expect `clearFilterButton(page)` to have count 0.
  - In "Typing a title narrows the list…", expect it to be visible, and point the existing
    `captureVerifiedElement` at the filter input, so the screenshot shows the X inside the field.
  - In "Clearing the term restores the list and the plain URL", click `clearFilterButton(page)`.
    Keep the existing assertions, and add: the filter input has value `''`, it is focused
    (`toBeFocused()`), and the X has count 0. Rename the step to "Pressing the X in the filter
    clears the term and restores the list and the plain URL".
- `apps/web/e2e/search-page.spec.ts`: after the "Typing the fixture term…" capture, add an
  `actionAndCapture` step, "Pressing the X in the search field clears the term and the results.".
  It clicks `page.getByRole('button', { name: 'Clear Search', exact: true })`, then expects the
  field to have value `''` and be focused, the fixture row to have count 0, and the X to have
  count 0. Capture on `searchField`.
- `apps/management-web/e2e/workers-page.spec.ts`, first test, after the existing
  `capturePageLoad`:
  - Fill `workerSearch` with `zzz-no-such-command`. Expect `No commands match the filter.` to be
    visible and the URL to match `/search=zzz-no-such-command/`, so the debounced URL write lands
    before the clear.
  - Expect `page.getByRole('button', { name: 'Clear Filter', exact: true })` to be visible, and
    capture it with `actionAndCapture` while clicking it.
  - After the click, expect `workerSearch` to have value `''` and be focused, the X to have count
    0, the no-match message to have count 0, and the URL to not match `/search=/`.

No API integration test: no API route changes.

## Release scratchpad

```markdown
## Search and filter fields clear with an X inside the field

- Surfaces: web, management-web, packages/ui, i18n catalog (shared, management)
- Change: Once a search or filter field has text, an X appears at its right edge. Pressing it
  empties the field and keeps focus in it. On web this covers the Search page field, the episode
  transcript search, and the subscribed podcasts title filter. The filter's separate "Clear" text
  button is gone. On management-web it covers every table search field (Users, Admins, Storage,
  Stats, Product Memberships, Feed Flag Status directory, Database table browser, Workers). The
  browser's own search-field X no longer appears beside it. Clearing applies at once, without
  the typing delay: the Search page and transcript search rerun for the empty term, and a
  management table drops its `search` URL parameter (or table cookie term) and reloads straight
  away. Screen readers name the X "Clear Search" on search fields and "Clear Filter" on filter
  fields, from new shared catalog keys `misc.clear_search` and `misc.clear_filter`, translated
  into Spanish, French, and Greek. The unused management key `tableShared.searchClearLabel` is
  removed. The transcript search field now has an accessible name. `useTableFilterState` in
  `@podverse/ui` gains `clearSearch`, and `TableFilterBar` requires `clearFilterAriaLabel` and
  `onSearchClear`.
- Who notices: everyone who searches or filters lists on web, operators filtering management
  tables, and screen reader users
- Operator steps: none
```
