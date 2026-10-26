# Summary: browse responsiveness, mobile pagination, livestream order

Request: [00-REQUEST.md](00-REQUEST.md). Models per prompt: [COPY-PASTA.md](COPY-PASTA.md). Phases and file ownership:
[00-EXECUTION-ORDER.md](00-EXECUTION-ORDER.md).

## Requirement ledger

- **R1** (area A) "when I click the tracks chip on the browse page, it took a very long time before the track took the active state" / "clicking the tracks button should be immediate" — Plan: 10
- **R2** (area A) "some of them had very large images, and some even had GIFs" / "make sure that the loading of this content, which may be third-party content remotely hosted on someone else's server, does not block the UI behavior and make the UI itself slow" — Plan: 10, 11
- **R3** (area A) "we want the best user experience around that" — per the operator answer: client only; images lazy-load and decode asynchronously in fixed-size slots so they cannot block input or shift layout; no server-side proxy or resize; GIFs are not converted to stills — Plan: 10, 11
- **R4** (area C) "on the mobile app, pagination does not seem to be working on browse. Make sure that when you scroll near the bottom, we have an auto pagination, infinite scroll sort of behavior" — Plan: 30, 31 (Browse); 32–38 cover the other screens under R5
- **R5** (area C) "Check which screens may lack that currently" — per the operator answer: every other mobile list backed by a paginated API that lacks auto-pagination near the bottom; the plan lists the screens found and fixes them — Plan: 30, 31, 32, 33, 34, 35, 36, 37, 38 (Taste Profile and Profile left out, D15)
- **R6** (area B) "The live stream sorting for live on web at least is returning in the wrong order because we can see that it is an ascending date going back from 2024 to 2026. The live grouping should be in descending with the most recent content near the top" — per the operator answer: the Live now group sorts newest start first — Plan: 20, 21, 22
- **R7** (area B) Operator answer: "Scheduled (pending) livestream order: soonest upcoming start first" — Plan: 20, 21, 22
- **R8** (area B) Operator answer: "hide scheduled items whose start time is more than a set window in the past. The planner proposes the window and records it as a decision" — Plan: 20, 21, 22 (24-hour window, D3)
- **R9** (area B) "Confirm that mobile also displays live streams correctly" — Plan: 22
- **R10** (area B) "I'm unsure if this is something that the back end simply has to return in the correct order or if it gets sorted on the front end" — question row; the plan answers it from the code — Plan: 20
- **R11** (area A, step 05) "hide the old rows, show a spinner" — while the new list loads, the list area shows a spinner instead of the old rows; no old list under a transparent spinner and no chip-row skeleton; the clicked chip is selected immediately (R1) — Plan: 10
- **R12** (area A, step 05) "the chip row horizontally should not jump or move if it doesn't need to" — Plan: 10
- **R13** (area D, step 06) "Clips should never have an A-Z sorting. this should not even be an option in the api, web, or mobile, or anywhere." — Plan: 40 (mobile change), 41 (API and web tests; both already offer no A-Z)
- **R14** (area D, step 06) Operator answer: "Clips defaults to Recent" and a saved A-Z preference for clips falls back to Recent — Plan: 40, 41
- **R15** (area D, step 06) Operator answer: podcasts, episodes, and channels keep A-Z — Plan: 40, 41
- **R16** (area C, hand edit to plan 32) "Show More button should appear but only if there are more expected." — while a title filter is typed the button shows only when the feed has another page — Plan: 32
- **R17** (area E, step 07) Changing Home Clips between Recent and Popularity refetches page 1 now and replaces the saved list. A background sync still resets that list to page 1. — Plan: 50
- **R18** (area E, step 08) Sign-out clears the Home clips cache, the same way sign-out clears the Home livestreams cache. — Plan: 55
- **R19** (area B, step 09) The livestream training script matches the settled order: Live newest start first, scheduled soonest first on every list including channel pages, scheduled items hidden 24 hours after their start, Live items kept with no window. — Plan: 23

## Areas

### Area A — Web Browse chip responsiveness and remote images

- **Rows:** R1, R2, R3
- **Starts from:** `apps/web/src/components/MediaListChips/MediaListChips.tsx` (the selected chip
  comes from the server prop `selected` and only changes after `router.replace` finishes the
  server render); `packages/ui/src/components/navigation/Chip/ChipRow.tsx`;
  `apps/web/src/app/browse/page.tsx`; the shared image components under
  `packages/ui/src/components/image/` (`Image`, `ImageRuntime`, `SkeletonFlashImage`) and the list
  rows that render artwork on Browse (tracks list under `apps/web/src/app/_media-lists/tracks/`).
- **Depends on:** none.
- **Shares files with:** area B may touch `apps/web/src/app/_media-lists/livestreams/*` and the
  livestream rows; area A should not need those beyond shared image components. `MediaListChips`
  also serves Subscribed (Home), Add by RSS, and Recommendations, so a chip fix there reaches all
  four pages. `packages/ui` image changes reach management-web too.
- **Plan number block:** 10–19

### Area B — Livestream order and stale scheduled items (API, web, mobile)

- **Rows:** R6, R7, R8, R9, R10, R19
- **Starts from:** `packages/orm/src/services/item/item.ts` `getManyUpcomingLiveItems` (Live
  before Pending, then `start_time ASC`, no start-time window);
  `packages/helpers/src/lib/liveItemVisibility.ts` `compareUpcomingLiveItems` (the same order,
  documented as matching the ORM query); `apps/api/src/controllers/liveItem.ts`; web
  `apps/web/src/app/_media-lists/livestreams/` and
  `apps/web/src/utils/subscribed/mergeSubscribedLivestreams.ts` (Home subscribed livestreams);
  mobile `apps/mobile/src/lib/rows/liveItemRows.ts` `sortUpcomingLiveRows`,
  `apps/mobile/src/screens/home/homeFeedData.ts` `mapItemsToUpcomingLiveRows`,
  `apps/mobile/src/screens/home/addByRssLiveRows.ts`, and the livestream branch of
  `apps/mobile/src/screens/browse/browseFeedData.ts`. Add by RSS live ordering on web
  (`apps/web/src/utils/addByRSS/channelLiveItems.ts`) and mobile
  (`apps/mobile/src/lib/addByRss/liveRows.ts`) follows the same rule per **add-by-rss-parity-sync**.
- **Depends on:** none.
- **Shares files with:** area C on `apps/mobile/src/screens/browse/browseFeedData.ts` (livestream
  fetch) and possibly `apps/mobile/src/screens/home/homeFeedData.ts`. Area A only through shared
  image components, if at all.
- **Plan number block:** 20–29

### Area C — Mobile infinite scroll on Browse and other paginated lists

- **Rows:** R4, R5
- **Starts from:** `apps/mobile/src/screens/browse/BrowseScreen.tsx` and `browseFeedData.ts`
  (every media type fetches only `BROWSE_FEED_PAGE`, with no next page); the existing
  `onEndReached` pattern in `apps/mobile/src/screens/library/LibraryPlaylistsScreen.tsx` and
  `PlaylistDetailScreen.tsx`; screens to audit include Home, Search, podcast sections
  (`apps/mobile/src/screens/podcast/sections/`), episode detail sections, profile content,
  notifications inbox, and the Add by RSS sections under `apps/mobile/src/screens/home/addByRss/`.
- **Depends on:** area B (step 03). Browse livestreams paginate on B's server order and stale
  window, and both areas edit the livestream branch of `browseFeedData.ts`.
- **Shares files with:** area B on `browseFeedData.ts` and possibly `homeFeedData.ts`.
- **Plan number block:** 30–39

### Area D — No A-Z sort on clip lists (API, web, mobile)

- **Rows:** R13, R14, R15
- **Starts from:** the clip list sort options on the API (clip list routes and their sort
  validation and OpenAPI), web (clip list sort controls and the table sort-preference cookies), and
  mobile (`apps/mobile/src/prefs/homeListPrefs.ts`, `apps/mobile/src/prefs/detailListPrefs.ts`,
  `apps/mobile/src/screens/home/homeFeedData.ts` `applyHomeSort`, `homeItemMerge.ts`, and the
  podcast and episode clip sections). Plan 38's "Clips A-Z does not extend" decision goes away.
- **Depends on:** area C plans 32, 33, 35 and 38 where they edit clip sort or clip list files.
- **Shares files with:** area C (plan 38 `homeFeedData.ts` and the Home clips cache; possibly
  plans 32, 33, 35 on clip sections and My Clips). Not area A's `MediaListChips.tsx`.
- **Plan number block:** 40–49

### Area E — Home clips freshness

- **Rows:** R17, R18
- **Starts from:** a Home Clips sort change (`apps/mobile/src/screens/home/HomeScreen.tsx`,
  `apps/mobile/src/prefs/homeListPrefs.ts`, `createHomeClipsJob` in
  `apps/mobile/src/sync/syncJobs.ts`, `homeClipsCacheRepository`) and sign-out in
  `apps/mobile/src/auth/AuthProvider.tsx`, which clears `homeLivestreamsCacheRepository` and does
  not clear `homeClipsCacheRepository`.
- **Depends on:** plans 38 and 40.
- **Shares files with:** area C and area D on the Home clips cache and `homeFeedData.ts`.
- **Plan number block:** 50–59. Step 07 uses 50–54. Step 08 uses 55–59.

## Waves

- **Wave 1:** area A (step 02), area B (step 03)
- **Wave 2:** area C (step 04), after area B
- **Second pass after the first review:** step 05 revises plan 10 for D1 (R11, R12). Step 06 plans
  area D for D9 (R13–R15) and amends plan 38. They edit different plans and run at once. R16 is a
  hand edit to plan 32's `## Rows` and decision text; no behavior change.
- **Third pass after the second review:** step 07 plans R17 (block 50–54) and step 09 plans R19
  (plan 23). They edit different files and run at once. Step 08 plans R18 (block 55–59) after
  step 07, because both may amend the Home clips plans.

## Decisions to review

All settled through the second review. Answers are in `00-REQUEST.md`. The first pass changed D1
and D9, clarified D11, and kept the rest. The second review kept the chip-row restore, the five
plan 10 loading details, and the management Stats Title column, and asked for plans for the three
gaps (R17–R19).

### Area A (step 02)

- **D1** (step 02, plan 10) Feedback while the new list loads: the old list stays on screen under the existing spinner that lists already use for client fetches. Alternative: swap the list for a skeleton or dim it (a `loading.tsx` skeleton would also replace the chip row and lose the pressed chip).
- **D2** (step 02, plan 10) Clicks during loading: the chip clicked last wins, including going back to the starting chip. Alternative: ignore clicks until the first navigation finishes.

### Area B (step 03)

- **D3** (step 03, plan 20) Window length: scheduled items are hidden once their start is more than 24 hours past, the same length as the existing ended window. Alternative: 7 days.
- **D4** (step 03, plan 20) No window on Live items: a feed stuck on Live since 2024 sinks to the bottom of the Live group but stays listed. Alternative: hide Live items whose start is more than N days past.
- **D5** (step 03, plans 20, 21, 22) Where the window applies: every list that shows scheduled items, including channel livestream lists (API, plus web and mobile Add by RSS channel pages) and the API's `liveItemType=pending` lists. Alternative: the upcoming lists only.
- **D6** (step 03, plan 20) Channel order matches: channel livestream lists show scheduled items soonest first (they used to show the latest start first), so one rule holds everywhere. Alternative: leave channel pages as they were.
- **D7** (step 03, plans 20, 21, 22) Missing start time: a scheduled Add by RSS item with no start time is kept and sorts last. Alternative: hide it.

### Area C (step 04)

- **D8** (step 04, plan 38) Home Clips and Livestreams save each new page on the device; a scroll near the bottom fetches the next page, adds it to the saved list, and Home re-reads storage. Alternative: keep later pages only in screen memory (the device-read rule for subscribed content forbids it).
- **D9** (step 04, plan 38) Home Clips sorted A-Z does not load more, because the server cannot sort clips by title. Alternative: re-sort everything loaded on each page.
- **D10** (step 04, plan 38) A background sync resets Home's saved list to page 1. Alternative: re-read every saved page in each sync job.
- **D11** (step 04, plan 32) A typed title filter keeps the Show more button on podcast sections, since loading on reaching the bottom would pull the whole feed. Alternative: load on reaching the bottom even while filtering.
- **D12** (step 04, plan 36) History re-reads every page already shown when the queue changes. Alternative: re-read page 1 only (cuts a long list back to 60 rows after each queue action).
- **D13** (step 04, plan 31) Livestream pages on Browse are appended without re-sorting; a repeated id keeps its first position. Alternative: re-sort all loaded pages each time.
- **D14** (step 04, plans 32–34) Show more buttons become a loading row, and a failed page shows Retry under the rows that are already shown; Retry reloads the failed page. Alternative: keep the Show more buttons.
- **D15** (step 04, plan 30) Not planned: Taste Profile keeps its Load More buttons (its lists are not scrollable lists with a bottom to detect), and Profile stays at page 1 per section (paging its four stacked sections needs a per-type selector, a layout change Phase 2 takes from the operator). Alternative: plan infinite scroll for one or both.
