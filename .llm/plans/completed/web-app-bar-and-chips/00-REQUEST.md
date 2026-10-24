# Web app bar and chips

## Request

We want to change the web experience significantly. We can get rid of the back and forward buttons that are within the app entirely. And we only need one bar at the top of the page on the larger screen sizes. So, for example, on the settings page, Settings will appear to the right of the brand element that appears on the page.

We will also have to reconcile this experience with the chips layout on the website. We want the chips to follow as closely as possible the chips pattern of the mobile app, which generally involves chips you can press and then at the end of it, a sort option. There is also a category chip that the browse screen uses differently than other screens on mobile, and we want to make that experience more consistent on web as well. Ask if you have any questions.

The add by RSS screen may need different design patterns than the rest on web. We do want the add feed and check for updates buttons. The recent can just become a sort at the end of the medium chips. The gear icon, when it is relevant, can just always go on any screen to the right of the sort chip when it is needed. But I think on the add by RSS screen, we add add feed and check for updates as their own buttons above the chips row and make them different buttons. They can be bigger buttons. That are side by side above the chips. And then have the filtering buttons, sort, and grid view to the right of that. Ask me any questions if you are unsure about what to do.

## Operator answers

- **Add by RSS layout:** Row 1 holds Add Feed and Check for Updates, side by side, larger than today and a different button style. Row 2 holds the media chips (Podcasts, Episodes, Artists, Albums, Tracks, Livestreams), then a Sort chip (replacing the "Recent" dropdown), then the gear. The gear is the grid/list view menu (`ViewSelector`).
- **The gear on every screen:** when a screen has the grid/list gear, it sits to the right of the Sort chip in the chip row.
- **The one top bar on large screens:** the page title goes on the left, where back and forward are now. Search, the notification bell, and the account menu stay on the right. The sidebar brand stays where it is, so the title reads to the right of the brand. Page actions (such as Add Feed) do not move into the bar.
- **Small screens:** the bar keeps the logo and icons. The page title is its own row under the bar.
- **Other list pages (Subscribed, Browse, Recommendations, and the other media-list pages):** the type, sort, and range dropdowns in today's second bar become trailing chips after the media chips, in mobile order: Category (where it applies), then Sort, then the gear.
- **Category, Browse only, as on mobile:** on Browse, a Categories filter chip follows the media chips for podcasts, episodes, and clips. Pressing it opens the category list and hides Sort while that list is open. Subscribed has no category chip and no category title suffix (`Subscribed > News` goes away).
- **Scope, everything:** the app-bar change on every web page with app chrome; chip rows on Subscribed, Browse, Add by RSS, Recommendations, and the other list pages; and the section chips plus sort on podcast, episode, album, artist, and track detail pages.
- Player skip-back and skip-forward buttons are not affected. Only the browser history arrows leave.

## Glossary

- **Brand element:** the logo. On large screens it is in the sidebar (`SideBarBrand`); on small screens it is in the nav bar (`NavBarBrand`).
- **Medium chips / media chips:** the media-type pill row (Podcasts, Episodes, …).
- **Gear:** the grid/list view menu, `ViewSelector`.
- **Recent:** the sort dropdown on Add by RSS, whose current value is "Recent".

## Orientation

Checked while writing this file. The `develop` checkout this came from has a lot of uncommitted web work that touches these files (Recommendations page, `MediaListChips`, `SideBar`, Settings panels). Re-verify against the worktree.

- `packages/ui/src/components/navigation/NavBar/NavBar.tsx`: shared NavBar. `backForward` (`NavArrowButton` ×2, `.leftCluster`, hidden on mobile) is the history control to remove. `brand.visibility: 'mobileOnly'` hides the logo on large screens. Sticky chrome rules: `.cursor/rules/navbar-sticky-chrome.mdc`. Check whether management-web uses `backForward` before removing the prop.
- `apps/web/src/components/NavBar/NavBar.tsx`: web wiring. Passes `backForward` with `router.back()` / `router.forward()` and the `misc.browser_back` / `misc.browser_forward` catalog keys.
- `apps/web/src/components/App/AppChrome.tsx`: `SideBar` + `PageWrapper` → `NavBar`, banners, `PageWrapperMain`.
- `packages/ui/src/components/layout/MainHeader/MainHeader.tsx`: the second bar (title + `buttonsNode`), `--header-desktop-height`. About 43 call sites in `apps/web/src` (`rg '<MainHeader' apps/web/src`). This is what the title moves out of.
- `apps/web/src/app/settings/SettingsClient.tsx`: `MainHeader title={tSettings('settings')}`; the request's example page. Settings tabs (`components/Settings/Settings.tsx`, `ListHeader` + `Tabs`) stay in the page.
- `apps/web/src/hooks/useSubscribedListHeader.tsx`: builds the type, sort, and range `Dropdown`s and `ViewSelector` for list pages. Type value `category` opens the categories modal through `setShowCategoriesModal`.
- `apps/web/src/app/_media-lists/podcasts/PodcastsPageHeader.tsx`: Subscribed and Browse title, including the `${pageTitle} > ${category}` suffix. Sibling headers under `apps/web/src/app/_media-lists/*/`.
- `apps/web/src/components/MediaListChips/MediaListChips.tsx`: chip row for Subscribed, Browse, Add by RSS, and Recommendations (`ButtonTabs`). Chip set and persistence: `apps/web/src/utils/mediaListChips.ts`.
- `apps/web/src/components/AddByRSS/List/AddByRSSListHeader.tsx`: Add by RSS list header (`MainHeader` with Add Feed, Check for Updates, the Recent dropdown, and the gear).
- `apps/web/src/components/ViewSelector/ViewSelector.tsx`: the gear (`FaGear`, `layouts.change_layout_view`).
- `apps/web/src/app/podcast/[channel_id]/PodcastPageListHeader.tsx`: detail section `Tabs` plus sort and range `Dropdown`s, through `components/Common/List/CommonDetailListHeader`. The episode, album, artist, and track `*PageListHeader.tsx` files follow it.
- Mobile parity sources:
  - `apps/mobile/src/components/form/SectionChipRow.tsx`: `SectionChip` with `pill` (media type) and `filter` (sort, category) variants, and a `trailing` slot.
  - `apps/mobile/src/screens/browse/BrowseScreen.tsx` (around the `MediaTypeSelector` `trailing` prop): Categories chip, then `BrowseSortChip`.
  - `apps/mobile/src/screens/browse/browseTypes.ts`: `shouldShowBrowseCategoryChip` (podcasts, episodes, clips), and `shouldShowBrowseSortChip`, which hides sort while the category list is open and for livestreams.
  - `apps/mobile/src/screens/home/HomeSortChip.tsx`, `apps/mobile/src/screens/browse/BrowseSortChip.tsx`: sort chips.
- Guidance to read: **mobile-screen-layout** § Podcast detail filter visibility (sort and category chips mount only when the current chip can use them; filter chrome), **filter-sort-persistence**, **routing-url-params**, **prefer-shared-ui-web-management**, **shared-ui-i18n**, **ui-copy-casing**, **screen-reader-accessibility**, **e2e-page-tests**.
- The sidebar shows a raw key: `SideBar.tsx` calls `tFeatures('recommendations.title')`, but the consumer catalog has `features.recommendations.recommendations` and no `title`. Fix it while in this area.

## Questions for the planning run

Settle these from the code where you can. Ask the operator only about product choices the answers above leave open.

1. **Detail-page titles.** Podcast, episode, album, artist, and track pages have their own large headers and no `MainHeader`. Decide what the app bar shows there: nothing, or the entity name.
2. **Pages with a header but no list.** Membership, legal pages, auth forms, and checkout: confirm the title moves into the bar on large screens and gets its own row on small screens, the same as everywhere else.
3. **Sort chip behavior on web.** How the sort chip opens its options (menu or popover), and how range combines with sort when sort is Top, matching the mobile sort chips.
4. **Shared component.** Whether the chip row and its filter variant belong in `@podverse/ui`, per **prefer-shared-ui-web-management**.
5. **Management-web.** Whether it shares the NavBar change, or keeps its own layout.
6. **E2E.** Specs that assert the second bar, the dropdowns, or the category title suffix, and the screenshot report specs to update.

### Review of the first planning pass

The operator answered D1–D30. "Keep" means the planner's choice stands. The quote is the option they picked.

- **D1** Keep. "Context from each page."
- **D2** Keep. "Right-aligned row at the top of the content."
- **D3** Keep. "No title in the bar on detail pages."
- **D4** Keep. "Keep management-web's own layout, no bar title."
- **D5** Keep. "--font-size-2xl in the bar and the small-screen row."
- **D6** Keep. "Keep their in-page heading."
- **D7** Keep. "Generic pieces in @podverse/ui, wrappers in the web app."
- **D8** Keep. "One Sort chip that swaps to the range list."
- **D9** Reverse plan 20. "Sideways scrolling, like mobile." On narrow screens the chip row scrolls sideways. Menus render in a portal so they are not clipped.
- **D10** Keep. "Buttons with aria-pressed."
- **D11** Keep. "Accent outline on Sort; plain gear, no caret."
- **D12** Keep. "Server passes the config; the client fills the trailing slot."
- **D13** Keep. "Category list in place of the results; remove the modal."
- **D14** Keep. "Disclosure button; name becomes Categories: Arts."
- **D15** Keep. "Reuse the mobile string in the consumer catalog."
- **D16** Keep. "Remove the suffix on Browse and Subscribed."
- **D17** Keep. "Keep web's full nested category tree."
- **D18** Keep. "Only the Categories chip closes the list."
- **D19** Keep. "No gear on Clips or Livestreams."
- **D20** Keep. "One trailing component and one shared header."
- **D21** Keep. "Each list keeps its own config file."
- **D22** Keep. "Use the range the user picks."
- **D23** Keep. "No trailing controls on Recommendations."
- **D24** Keep. "A Filter chip before Sort."
- **D25** Keep. "Turn them into pill chips."
- **D26** Keep. "Keep Recent and Top."
- **D27** Keep. "Both primary."
- **D28** Keep. "Hide those chips from 1200px up."
- **D29** Keep. "Keep Settings as a section chip."
- **D30** Keep. "No new sort chip on those pages."

### Review of the chip-row revision

Step 07 settled the details D9 left open. The operator kept each choice. Plan 20 already matches them.

- **D31** Keep. "The row scrolls at every width and never wraps." On a wide screen where every chip fits, nothing moves.
- **D32** Keep. "An open chip menu follows its chip." It closes without a selection only once the chip is fully off screen.
- **D33** Keep. "The scrollbar stays hidden at every width."
- **D34** Keep. "The portal is opt-in." Only the chip menus pass `anchorRef`. Other dropdowns stay in place.
