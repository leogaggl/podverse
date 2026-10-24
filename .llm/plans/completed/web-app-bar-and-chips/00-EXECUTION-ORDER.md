# Web app bar and chips — execution order

Request and settled review answers (D1–D30): [00-REQUEST.md](00-REQUEST.md). Ledger and areas:
[00-SUMMARY.md](00-SUMMARY.md). Prompts and models: [COPY-PASTA.md](COPY-PASTA.md).

Phases run in order. Prompts inside one phase run at once and edit disjoint files. Run every
prompt in this worktree (`../podverse_feature_web_app_bar_and_chips`).

## Why six phases

Two dependency lines run side by side:

- Area A, the app bar: 10 removes the history arrows, then 11 puts the page title in the bar,
  then 12 handles the pages that bypass `MainHeader`.
- The chip work: 20 adds the chip primitives, then 21 adds the web chip row, sort chip, and gear,
  then the screen plans 30, 31, 40, and 50 adopt them.

`apps/web/e2e/media-list-chips.spec.ts` is edited by 21, 30, 31, 40, and 50, so each of those
plans gets its own phase. Area A fills the gaps beside them.

These pairs are what keep plans out of the same phase:

- 10 and 20 both edit `packages/ui/src/index.ts` and `packages/ui/PACKAGES-UI.md`. 11 edits the
  same two files, so 11 does not share a phase with 20 either.
- 10, 30, and 50 edit the consumer catalog originals, and 10 and 30 run `npm run i18n:compile`.
  No two of them share a phase.
- 50 edits `ChipRow` and `SortChip` (from 20), `ListSortChip.tsx` (from 21), and
  `PACKAGES-UI.md` (from 11 and 20).
- 31 and 50 both edit `makefiles/local/e2e-spec-order-web.txt`.
- 21 and 31 both edit `apps/web/src/utils/dropdownMenuItems.ts`. 30 and 31 both edit
  `apps/web/src/app/browse/page.tsx`.

## Phase 1

- **20 — Chip primitives in `@podverse/ui`** (Opus 5.5 · high). Owns `Chip`, `ChipRow`,
  `MenuChip`, `SortChip`, `DropdownMenuPanel` (portal when given `anchorRef`),
  `useAnchoredDropdownPosition`, `packages/ui/src/index.ts`, `PACKAGES-UI.md`, the
  `chipRowReveal` move into `@podverse/helpers`, and the mobile files that import it.

## Phase 2 (two prompts at once)

- **10 — Remove the browser history arrows** (Cursor Grok 4.7 · medium). Owns:
  - `packages/ui` NavBar (`NavBar.tsx`, `.module.scss`, `.test.tsx`, `index.ts`) and the deleted
    `NavArrowButton` folder
  - `packages/ui/src/index.ts`, `packages/ui/PACKAGES-UI.md`
  - `apps/web/src/components/NavBar/NavBar.tsx`
  - the four consumer catalog originals, plus the three consumer overrides through
    `npm run i18n:compile`
  - `apps/web/e2e/navbar-chrome.spec.ts`, `apps/web/e2e/focus-states.spec.ts`
- **21 — Web chip row trailing slot, sort chip wrapper, gear chip** (Cursor Grok 4.7 · high).
  Owns:
  - `MediaListChips.tsx` and its SCSS module
  - `ListSortChip.tsx` (new)
  - `ViewSelector.tsx`, and deleting its SCSS module
  - `apps/web/src/utils/dropdownMenuItems.ts`
  - `apps/web/e2e/media-list-chips.spec.ts`, `apps/web/e2e/artists-list-date-and-view.spec.ts`

21 adds no catalog keys and does not touch `packages/ui`. 10 does not touch the chip or list files.

## Phase 3 (two prompts at once)

- **11 — One app bar with the page title** (Opus 5.5 · high). Owns:
  - `packages/ui` `AppBarTitle` (new), `MainHeader` (component, SCSS, test), the
    `MainSidebarLayout` SCSS, NavBar (`.tsx`, `.module.scss`, `.test.tsx`), and
    `_variables-root.scss`
  - `packages/ui/src/index.ts`, `PACKAGES-UI.md`
  - `apps/web/src/components/NavBar/NavBar.tsx`, `apps/web/src/components/App/AppChrome.tsx`
  - `.cursor/rules/navbar-sticky-chrome.mdc`, `apps/web/e2e/navbar-chrome.spec.ts`
- **30 — Subscribed and Browse: Category, Sort, and gear as trailing chips** (Opus 5.5 · high).
  Owns:
  - `apps/web/src/app/page.tsx`, `apps/web/src/app/browse/page.tsx`
  - everything under `apps/web/src/app/_media-lists/` that its plan lists, including the new
    `MediaListPageHeader.tsx` and the deleted `*PageHeader.tsx` files
  - `MediaListTrailingChips.tsx` and its test (new)
  - deleting `useSubscribedListHeader.tsx` and its test
  - `CategoriesChip.tsx` (new), `CategoriesList.tsx` and its SCSS, deleting
    `ModalCategoriesSelect.tsx`
  - `apps/web/src/utils/categories.ts`
  - the consumer and mobile catalog originals, plus their overrides through
    `npm run i18n:compile`
  - `apps/web/e2e/media-list-chips.spec.ts`

30's new `MediaListPageHeader` renders `<MainHeader title={title} />`. 11 keeps the `title` prop
and its call shape, so the two do not need each other's edits. 11 edits no file under
`apps/web/src/app/` and no catalog.

## Phase 4 (two prompts at once)

- **12 — Page titles that bypass MainHeader, and detail-page titles** (Cursor Grok 4.7 · high).
  Owns:
  - `RecommendationsPageClient.tsx`, `apps/web/src/app/embed/page.tsx`,
    `apps/web/src/app/membership/renew/page.tsx`, `AddByRSSDetailClient.tsx`
  - the specs `recommendations`, `embed-demo-index`, `membership-page-trial-limitations`, and
    `add-by-rss-artist-albums`
- **31 — Playlists and Users chip rows with a trailing Sort chip** (Cursor Grok 4.7 · high). Owns:
  - `apps/web/src/app/browse/page.tsx`
  - `apps/web/src/app/playlists/` and `apps/web/src/app/profiles/` files its plan lists, and
    deleting `PlaylistsListHeader.module.scss`
  - `dropdownMenuItems.ts` and its test
  - `media-list-chips.spec.ts`, `playlists-profiles-chips.spec.ts` (new)
  - `makefiles/local/e2e-spec-order-web.txt`

## Phase 5

- **40 — Add by RSS library: action buttons above the chips** (Cursor Grok 4.7 · high).

## Phase 6

- **50 — Detail section chips and sort; then close the set** (Cursor Grok 4.7 · high). Also
  appends the release-notes entries from the Phase 2–4 prompts, archives the set, and ends with
  the cumulative verification.

## Release notes

Prompts in Phases 2, 3, and 4 (10, 21, 11, 30, 12, 31) put their release scratchpad entry in their
final message. Prompt 40 writes its own entry. Prompt 50 appends the six saved entries, then its
own. Plan 20 has no entry.
