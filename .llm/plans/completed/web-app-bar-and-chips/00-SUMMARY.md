# Web app bar and chips — summary

Request: [00-REQUEST.md](00-REQUEST.md). Models per prompt: the set's `COPY-PASTA.md`.

## Requirement ledger

Close fills each Plan entry from the plans' `## Rows`. Quotes come from the request, the operator
answers, and the questions for the planning run in `00-REQUEST.md`.

- **R1** (area A) "We can get rid of the back and forward buttons that are within the app entirely." — Plan: 10
- **R2** (area A) "we only need one bar at the top of the page on the larger screen sizes" — Plan: 11
- **R3** (area A) "on the settings page, Settings will appear to the right of the brand element that appears on the page" — Plan: 11
- **R4** (area B) "We will also have to reconcile this experience with the chips layout on the website." — Plan: 21
- **R5** (area B) "We want the chips to follow as closely as possible the chips pattern of the mobile app, which generally involves chips you can press and then at the end of it, a sort option." — Plan: 20, 21
- **R6** (area C) "There is also a category chip that the browse screen uses differently than other screens on mobile, and we want to make that experience more consistent on web as well." — Plan: 30
- **R7** (area D) "The add by RSS screen may need different design patterns than the rest on web." — Plan: 40
- **R8** (area D) "We do want the add feed and check for updates buttons." — Plan: 40
- **R9** (area D) "The recent can just become a sort at the end of the medium chips." — Plan: 40
- **R10** (area B) "The gear icon, when it is relevant, can just always go on any screen to the right of the sort chip when it is needed." Answer: "when a screen has the grid/list gear, it sits to the right of the Sort chip in the chip row." — Plan: 21
- **R11** (area D) "on the add by RSS screen, we add add feed and check for updates as their own buttons above the chips row" — Plan: 40
- **R12** (area D) "and make them different buttons. They can be bigger buttons." Answer: "larger than today and a different button style" — Plan: 40
- **R13** (area D) "That are side by side above the chips." — Plan: 40
- **R14** (area D) "And then have the filtering buttons, sort, and grid view to the right of that." — Plan: 40
- **R15** (area D) "Row 2 holds the media chips (Podcasts, Episodes, Artists, Albums, Tracks, Livestreams), then a Sort chip (replacing the "Recent" dropdown), then the gear." — Plan: 40
- **R16** (area A) "the page title goes on the left, where back and forward are now." — Plan: 11
- **R17** (area A) "Search, the notification bell, and the account menu stay on the right." — Plan: 11
- **R18** (area A) "The sidebar brand stays where it is, so the title reads to the right of the brand." — Plan: 11
- **R19** (area A) "Page actions (such as Add Feed) do not move into the bar." — Plan: 11
- **R20** (area A) "Small screens: the bar keeps the logo and icons. The page title is its own row under the bar." — Plan: 11
- **R21** (area C) "the type, sort, and range dropdowns in today's second bar become trailing chips after the media chips, in mobile order: Category (where it applies), then Sort, then the gear." — Plan: 30, 31
- **R22** (area C) "on Browse, a Categories filter chip follows the media chips for podcasts, episodes, and clips." — Plan: 30
- **R23** (area C) "Pressing it opens the category list and hides Sort while that list is open." — Plan: 30
- **R24** (area C) "Subscribed has no category chip and no category title suffix (`Subscribed > News` goes away)." — Plan: 30
- **R25** (area A) "the app-bar change on every web page with app chrome" — Plan: 11, 12
- **R26** (area C) "chip rows on Subscribed, Browse, … Recommendations, and the other list pages" (Add by RSS is R15) — Plan: 30, 31
- **R27** (area E) "the section chips plus sort on podcast, episode, album, artist, and track detail pages" — Plan: 50
- **R28** (area A) "Player skip-back and skip-forward buttons are not affected. Only the browser history arrows leave." — Plan: 10
- **R29** (area A) "The sidebar shows a raw key: `SideBar.tsx` calls `tFeatures('recommendations.title')` … Fix it while in this area." — Plan: 12 (answered from the code: the key exists on this branch)
- **R30** (area A) "Detail-page titles. … Decide what the app bar shows there: nothing, or the entity name." — Plan: 12
- **R31** (area A) "Pages with a header but no list. Membership, legal pages, auth forms, and checkout: confirm the title moves into the bar on large screens and gets its own row on small screens" — Plan: 11, 12
- **R32** (area B) "Sort chip behavior on web. How the sort chip opens its options (menu or popover), and how range combines with sort when sort is Top, matching the mobile sort chips." — Plan: 20
- **R33** (area B) "Shared component. Whether the chip row and its filter variant belong in `@podverse/ui`" — Plan: 20
- **R34** (area A) "Management-web. Whether it shares the NavBar change, or keeps its own layout." and "Check whether management-web uses `backForward` before removing the prop." — Plan: 10
- **R35** (area A) "E2E. Specs that assert the second bar … and the screenshot report specs to update." — Plan: 11
- **R36** (area C) "E2E. Specs that assert … the dropdowns, or the category title suffix" (areas D and E update the dropdown specs for their own screens) — Plan: 30, 31
- **R37** (area B, step 07) "Sideways scrolling, like mobile." "On narrow screens the chip row scrolls sideways." (first review, D9) — Plan: 20
- **R38** (area B, step 07) "Menus render in a portal so they are not clipped." (first review, D9) — Plan: 20

## Areas

### Area A — App bar and page titles

- **Rows:** R1, R2, R3, R16, R17, R18, R19, R20, R25, R28, R29, R30, R31, R34, R35
- **Scope:** remove the history arrows; one bar on large screens with the page title on the left;
  the title as its own row under the bar on small screens; the `MainHeader` contract every page
  uses for its title and page actions; detail-page titles; management-web; the sidebar raw key.
- **Starts from:** `packages/ui/src/components/navigation/NavBar/NavBar.tsx` (`backForward`,
  `.leftCluster`, `brand.visibility`), `packages/ui/src/components/layout/MainHeader/MainHeader.tsx`
  and `MainSidebarLayout.module.scss` (`--header-desktop-height`), `apps/web/src/components/NavBar/NavBar.tsx`,
  `apps/web/src/components/App/AppChrome.tsx`, `apps/web/src/components/SideBar/SideBar.tsx`,
  `apps/management-web/src/components/ManagementNavBar/ManagementNavBar.tsx`, the 43
  `<MainHeader` call sites (`rg -l '<MainHeader' apps/web/src`), `apps/web/e2e/navbar-chrome.spec.ts`,
  `packages/ui/PACKAGES-UI.md`, `.cursor/rules/navbar-sticky-chrome.mdc`.
- **Boundary:** owns how a title and page actions reach the screen. Does not move list dropdowns
  into chips (areas C, D) or change detail section controls (area E).
- **Depends on:** none.
- **Shares files with:** C and D (`apps/web/src/app/_media-lists/*/*PageHeader.tsx`,
  `apps/web/src/app/playlists/PlaylistsPageHeader.tsx`, `apps/web/src/app/profiles/ProfilesPageHeader.tsx`,
  `apps/web/src/components/AddByRSS/List/AddByRSSListHeader.tsx`, when the `MainHeader` contract
  changes their calls); E (detail `*PageClient.tsx` files, when R30 puts the entity name in the
  bar); B (`packages/ui/src/index.ts`); all areas (i18n catalog originals, `release-notes/scratchpad.md`).
- **Plan number block:** 10–19

### Area B — Shared chip row and trailing controls

- **Rows:** R4, R5, R10, R32, R33, R37, R38
- **Scope:** the chip primitives every screen uses: media (pill) chips, a filter-chip variant, a
  sort chip with its options and the Top-plus-range combination, a trailing slot after the chips,
  and the gear (`ViewSelector`) placed after the sort chip. Decides `@podverse/ui` versus
  app-local placement. Plans the components and the `MediaListChips` trailing-slot contract, not
  the screen migrations.
- **Starts from:** `apps/web/src/components/MediaListChips/MediaListChips.tsx`,
  `apps/web/src/utils/mediaListChips.ts`, `apps/web/src/styles/components/MediaListChips/`,
  `apps/web/src/components/ViewSelector/ViewSelector.tsx`, `@podverse/ui` `ButtonTabs`, `Tabs`,
  and `Dropdown`; mobile parity in `apps/mobile/src/components/form/SectionChipRow.tsx`,
  `apps/mobile/src/screens/home/HomeSortChip.tsx`, `apps/mobile/src/screens/browse/BrowseSortChip.tsx`.
- **Boundary:** does not edit screen headers (`*PageHeader.tsx`, `*PageListHeader.tsx`,
  `AddByRSSListHeader.tsx`, `useSubscribedListHeader.tsx`); areas C, D, and E adopt the components.
- **Depends on:** none.
- **Shares files with:** C and D (`MediaListChips.tsx`, `apps/web/e2e/media-list-chips.spec.ts`);
  C, D, and E (`ViewSelector.tsx`); A (`packages/ui/src/index.ts`); all areas (i18n catalog
  originals, `release-notes/scratchpad.md`).
- **Plan number block:** 20–29

### Area C — Media-list pages: Subscribed, Browse, Recommendations

- **Rows:** R6, R21, R22, R23, R24, R26, R36
- **Scope:** replace the type, sort, and range dropdowns with trailing chips on Subscribed (`/`),
  Browse (`/browse`, including its Playlists and Profiles chips and their standalone pages), and
  Recommendations; the Browse-only Categories chip that hides Sort while the category list is
  open; drop the category title suffix and Subscribed's category type.
- **Starts from:** `apps/web/src/hooks/useSubscribedListHeader.tsx` (and its test),
  `apps/web/src/app/_media-lists/*/` (headers and `*PageDropdownConfig` files),
  `apps/web/src/app/page.tsx`, `apps/web/src/app/browse/page.tsx`,
  `apps/web/src/app/playlists/PlaylistsPageHeader.tsx` and `PlaylistsPageListHeader.tsx`,
  `apps/web/src/app/profiles/ProfilesPageHeader.tsx`,
  `apps/web/src/app/recommendations/RecommendationsPageClient.tsx`; mobile parity in
  `apps/mobile/src/screens/browse/BrowseScreen.tsx` and `browseTypes.ts`
  (`shouldShowBrowseCategoryChip`, `shouldShowBrowseSortChip`); specs
  `media-list-chips.spec.ts`, `recommendations.spec.ts`, `podcasts-subscribed-filter.spec.ts`,
  `artists-list-date-and-view.spec.ts`.
- **Depends on:** A (the `MainHeader` contract its headers call) and B (the chip components and
  the `MediaListChips` trailing slot).
- **Shares files with:** A (the headers listed under A); B and D (`MediaListChips.tsx`,
  `media-list-chips.spec.ts`); all areas (i18n catalog originals, `release-notes/scratchpad.md`).
- **Plan number block:** 30–39

### Area D — Add by RSS list screen

- **Rows:** R7, R8, R9, R11, R12, R13, R14, R15
- **Scope:** row 1 with Add Feed and Check for Updates, side by side, larger and in a different
  button style; row 2 with the media chips, a Sort chip in place of the "Recent" dropdown, and the
  gear. The `/add-by-rss` list only; Add by RSS detail pages are area E.
- **Starts from:** `apps/web/src/components/AddByRSS/List/AddByRSSListHeader.tsx`,
  `apps/web/src/app/add-by-rss/page.tsx`, the `AddByRSS*PageClient.tsx` list clients under
  `apps/web/src/components/AddByRSS/List/`, and the `add-by-rss-*` specs that open the list.
- **Depends on:** A (the `MainHeader` contract and where page actions sit) and B (the sort chip,
  trailing slot, and gear placement).
- **Shares files with:** A (`AddByRSSListHeader.tsx`); B and C (`MediaListChips.tsx`,
  `media-list-chips.spec.ts`); all areas (i18n catalog originals, `release-notes/scratchpad.md`).
- **Plan number block:** 40–49

### Area E — Detail pages: section chips and sort

- **Rows:** R27
- **Scope:** section chips plus a trailing sort chip (and range where it applies) on podcast,
  episode, album, artist, track, and livestream detail pages, and the Add by RSS podcast, album,
  and artist detail counterparts (parity source: the non-Add-by-RSS page). Owns the shared
  `ListHeader` and `CommonDetailListHeader` and therefore their other callers (History, Queues).
- **Starts from:** `apps/web/src/components/Common/List/CommonDetailListHeader.tsx`,
  `apps/web/src/components/List/ListHeader.tsx`, `apps/web/src/app/podcast/[channel_id]/PodcastPageListHeader.tsx`
  and the sibling `*PageListHeader.tsx` files (episode, album, artist, track, livestream, and
  `apps/web/src/app/add-by-rss/*/AddByRSS*PageListHeader.tsx`), `detail-sort-persistence.spec.ts`.
- **Depends on:** A (detail-page title choice, which may touch the detail `*PageClient.tsx`
  files) and B (the chip and sort-chip components).
- **Shares files with:** A (detail `*PageClient.tsx` files); B, C, and D (`ViewSelector.tsx`);
  all areas (i18n catalog originals, `release-notes/scratchpad.md`).
- **Plan number block:** 50–59

## Waves

- **Wave 1:** A (step 02), B (step 03). Neither builds on the other's plan; A owns the title and
  bar, B owns the chip primitives.
- **Wave 2:** C (step 04), D (step 05), E (step 06). Each adopts B's components; C and D edit
  headers whose `MainHeader` calls A's contract may change; E builds on A's detail-title choice.

## Order

First planning pass: step 01 split the request into areas A–E across two waves.

Second pass after the first review: the operator kept D1–D8 and D10–D30 and reversed D9 (rows R37 and R38). Step 07 revises plan 20 so the chip row scrolls sideways on narrow screens and chip menus render in a portal, and corrects plans 21, 30, 31, 40, and 50 where they assume a wrapping row or a menu inside the row.

Close assembled the set into six phases ([00-EXECUTION-ORDER.md](00-EXECUTION-ORDER.md)). It added
`makefiles/local/e2e-spec-order-web.txt` to plan 50, which creates `detail-section-chips.spec.ts`.

## Decisions to review

Product choices the area steps made that the request did not settle. Each item names its step and
plan, the choice made, and the main alternative. Answer by number; an item left unanswered keeps
the choice made.

### Step 02 — Area A, app bar and page titles

- **D1** (step 02, plan 11) How the title reaches the bar: pages publish it through a context, so titles stay in the pages and every `MainHeader` call site is unchanged. Cost: after a full page load on large screens the bar title appears only once scripts load (the small-screen row is in the server HTML; client-side navigation shows no gap). Alternative: a central path-to-title table, which shows the title on first paint but moves titles out of the pages and changes the area C and D headers.
- **D2** (step 02, plan 11) Page actions on large screens sit in a right-aligned row at the top of the page content, on the content background. Alternative: inside the content column next to each page's own controls, which moves every caller of `buttonsNode`.
- **D3** (step 02, plans 11 and 12) Detail-page titles (R30): the bar shows nothing on podcast, episode, album, artist, track, and other detail pages, including Add by RSS feed detail, because the large header already shows the entity name. Alternative: the entity name in the bar, repeated directly above the header.
- **D4** (step 02, plan 10) Management-web (R34) keeps its own layout and gets no page title in its bar. Alternative: show management page titles in its NavBar too.
- **D5** (step 02, plan 11) Title size is `--font-size-2xl` in both the bar and the small-screen row, down from today's 2.5rem heading, so it fits the 62px bar.
- **D6** (step 02, plan 12) `/account-access` (a gate panel that also shows without chrome) and the dev harnesses `/test-error-boundaries` and `/e2e/media-player-foundation` keep their in-page heading. Alternative: move them onto `MainHeader` too.

### Step 03 — Area B, shared chip row and trailing controls

- **D7** (step 03, plan 20) R33: generic chip pieces go in `@podverse/ui`; pieces that use routing or `next-intl` stay in the web app as thin wrappers. Alternative: keep all of it in the web app.
- **D8** (step 03, plans 20 and 21) R32: one Sort chip opens a popover menu; choosing Top swaps the menu to the range list and the chip face then shows the range, as on mobile. Alternatives: a separate range chip (today's web) or a "Top · Week" face.
- **D9** (step 03, plan 20) Narrow screens: the chip row wraps onto a second line, with Sort and the gear moving together. Alternative: sideways scrolling like mobile, which would clip the menus unless they render in a portal. **Operator reversed this:** the row scrolls sideways and menus render in a portal (R37, R38; step 07).
- **D10** (step 03, plan 20) Screen-reader roles: chips stay buttons with `aria-pressed` inside a group, matching today's web markup and specs. Alternative: tab roles, as mobile uses.
- **D11** (step 03, plans 20 and 21) The Sort chip always has the accent outline, matching mobile; the gear uses the plain chip look with no caret.
- **D12** (step 03, plan 21) The server page passes `MediaListChipsConfig` down and the client renders `MediaListChips` with `trailing` from inside its page context. Alternative: a portal or a separate context.

### Step 04 — Area C, Subscribed, Browse, Recommendations

- **D13** (step 04, plan 30) Pressing Categories shows the category list in place of the results and the modal is removed, matching mobile. Alternative: keep the modal.
- **D14** (step 04, plan 30) The Categories chip is a disclosure button with `aria-expanded` and `aria-controls`; its name becomes "Categories: Arts" once a category is chosen. Alternative: plan 21's `aria-pressed`.
- **D15** (step 04, plan 30) The "All Categories" row reuses the mobile string, moved to the consumer catalog layer. Alternative: a separate web-only key.
- **D16** (step 04, plan 30) The category title suffix is removed on Browse as well as Subscribed, because the chip face names the category. Alternative: keep it on Browse.
- **D17** (step 04, plan 30) Web keeps its full nested category tree. Alternative: mobile's collapsible top-level categories.
- **D18** (step 04, plan 30) Only the Categories chip closes the category list; tapping the already-selected media chip does not. Alternative: mobile's behavior, which needs a `MediaListChips` change.
- **D19** (step 04, plan 30) No gear on Clips or Livestreams, because those lists have one layout. Alternative: show it everywhere.
- **D20** (step 04, plan 30) One component holds the trailing controls and one shared title header serves all seven lists. Alternative: keep the hook and the seven header files.
- **D21** (step 04, plan 30) Each list builds its own sort options in its existing config file, keeping the file names. Alternative: a shared generic builder.
- **D22** (step 04, plan 30) Choosing Top uses the range the user picks. Alternative: keep the forced Week default.
- **D23** (step 04, plan 30) Recommendations gets no trailing controls, matching mobile (answered from the code).
- **D24** (step 04, plan 31) The Playlists medium toggle becomes a trailing Filter chip before Sort. Alternatives: drop it to "all" like mobile, or a second pill row.
- **D25** (step 04, plan 31) The `/playlists` tabs and the `/profiles` type dropdown become pill chips. Alternative: keep the tabs.
- **D26** (step 04, plan 31) Browse Users sort keeps both Recent and Top. Alternative: mobile's range-only chip.

### Step 05 — Area D, Add by RSS list

- **D27** (step 05, plan 40) Add Feed and Check for Updates both use `Button` `variant="primary"`. Alternative: Add Feed primary and Check for Updates secondary.

### Step 06 — Area E, detail pages

- **D28** (step 06, plan 50) About, Podroll, and People stay off the chip row from 1200px up, because the side column already shows them; narrower widths keep the chips. Alternative: show those chips at every width, duplicating the side column.
- **D29** (step 06, plan 50) Settings stays a section chip on the channel pages that already have it. Alternative: move it onto the channel header.
- **D30** (step 06, plan 50) Directory artist, track, and livestream pages, and the Add by RSS episode, track, and livestream pages, do not gain a sort chip (they have no sort dropdown today), although the request names sort together with those pages. Alternative: add one.
