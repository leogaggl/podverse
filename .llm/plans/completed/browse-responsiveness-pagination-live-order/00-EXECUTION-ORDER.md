# Browse responsiveness, mobile pagination, livestream order — execution order

Prompts and models: [COPY-PASTA.md](COPY-PASTA.md). Request and settled review answers:
[00-REQUEST.md](00-REQUEST.md). Ledger and decisions: [00-SUMMARY.md](00-SUMMARY.md).

Phases run one after another. Prompts inside one phase run at once and own disjoint files.

Release notes: in Phases 1–3 no prompt writes `release-notes/scratchpad.md`; each puts its entry
in its final message under "Release notes entry". Prompts 40 (Phase 4) and 50 (Phase 5) run alone
and append their own entries. Prompt 55 (Phase 6, alone, last) appends the Phase 1–3 entries and
its own. Plans 11, 23, 30, and 41 have no entry.

## Where it runs

The set runs in this worktree, `podverse_feature_browse_responsiveness_pagination_live_order`, on
branch `feature/browse-responsiveness-pagination-live-order`. Final messages land in
`.artifacts/plan-runner/browse-responsiveness-pagination-live-order/<NN>.md`.

## Dependency graph

From each plan's `## Runs after`:

| Plan | Runs after |
| --- | --- |
| 10 web media list chips select on click, list-area spinner, chip row stays still | none |
| 11 shared `Image`: remote artwork loads lazily and decodes asynchronously | none |
| 20 livestream order and stale scheduled window: helpers, ORM, API | none |
| 21 web: stale window on Add by RSS livestreams, order tests, E2E seed, Browse E2E | 20 (and 10, which shares `media-list-chips.spec.ts`) |
| 22 mobile: stale window on livestream rows, order tests | 20 |
| 23 livestream training script matches the settled order | 20 |
| 30 mobile paged-list helpers | none |
| 31 mobile Browse infinite scroll | 20, 22, 30 |
| 32 mobile podcast sections infinite scroll | 30 |
| 33 mobile episode detail and full player Clips infinite scroll | 30 |
| 34 mobile notifications inbox infinite scroll | 30 |
| 35 mobile My Clips and Add to Playlist sheet infinite scroll | 30 |
| 36 mobile History infinite scroll | 30 |
| 37 mobile album Tracks infinite scroll | 30 |
| 38 mobile Home Clips and Livestreams extend the stored window | 20, 22, 30 |
| 40 mobile Home Clips: no A-Z, Recent by default | 38 |
| 41 API and web tests that keep clip lists free of A-Z | 10, 21 |
| 50 mobile Home Clips: a sort change refetches page 1 now | 38, 40 |
| 55 sign-out clears the saved Home clips list; closes the set | 38, 50 |

## Shared files that set the order

- **`apps/web/e2e/media-list-chips.spec.ts`:** 10 (Phase 1) adds two tests after `'Browse chips
  keep the chosen chip in the URL and in this browser'`. 21 (Phase 2) edits the `'When Browse
  Livestreams is opened signed out, …'` test. 41 (Phase 3) adds one test between the
  Subscribed/Browse Sort test and the Browse Livestreams test. One prompt per phase touches it.
- **`packages/helpers/src/lib/liveItemVisibility.ts` and the ORM live-item files:** 20 only. Its
  exports (`compareUpcomingLiveItems`, `LIVE_ITEM_PENDING_VISIBILITY_MAX_AGE_MS`,
  `isPendingLiveItemStale`) are the contract that 21, 22, 23, 31, and 38 build on. Prompt 20 builds
  `packages/helpers` and `packages/orm` when done so later phases type-check against them.
- **`apps/mobile/src/lib/pagination/pagedList.ts` and `apps/mobile/src/hooks/useLoadMoreOnEndReached.ts`:**
  30 only. Plans 31–38 import them and do not edit them.
- **Podcast sections (`PodcastClipsSection.tsx`, `PodcastOfficialClipsSection.tsx`,
  `usePodcastSectionRows.ts`):** 30 swaps in `sectionResponseHasMore` in Phase 1. 32 edits the
  same files in Phase 2.
- **`HomeScreen.tsx`, `homeFeedData.ts`, `homeFeedData.localPaint.test.ts`:** 38 (Phase 3), then 40
  (Phase 4). 50 (Phase 5) edits `HomeScreen.tsx` again. Plan 38 still calls `applyHomeSort`; plan 40
  deletes it.
- **`homeListPrefs.ts` and its test, `syncJobs.ts`, `apps/mobile/e2e/home.yaml`:** 40 (Phase 4),
  then 50 (Phase 5). Plan 40's note that no other plan edits them predates plan 50; 50 builds on
  40's code.
- **`homeClipsCacheRepository.ts` and its test:** 38 (Phase 3), then 50 (Phase 5), then 55
  (Phase 6).
- **`tools/web/seed-e2e.mjs` and `apps/web/e2e/helpers/seedConstants.ts`:** 21 only. Mobile E2E
  reuses this seed, so the Maestro flows see plan 21's new rows.
- **`apps/api/openapi.yml`:** 20 only.
- **i18n catalogs:** no plan in the set adds or edits a string.
- **`packages/ui`:** 10 edits `Chip/ChipRow.*`; 11 edits `image/Image/Image.*`. Different files in
  one phase; neither rebuilds the package.
- **`misc/aicasts/livestreams-1-a-flag-not-a-kind-of-show.md`:** 23 only.

## Phases

### Phase 1 — foundations (4 prompts at once)

- **10** owns `apps/web/src/components/MediaListChips/MediaListChips.tsx`,
  `apps/web/src/components/MediaListChips/MediaListLoadingSpinner.tsx`,
  `apps/web/src/styles/components/MediaListChips/MediaListChips.module.scss`,
  `packages/ui/src/components/navigation/Chip/ChipRow.tsx`, `ChipRow.module.scss`,
  `ChipRow.test.tsx`, `apps/web/src/app/recommendations/RecommendationsPageClient.tsx`, the five
  `apps/web/src/components/AddByRSS/List/` clients its plan lists, and its two new tests in
  `apps/web/e2e/media-list-chips.spec.ts`.
- **11** owns `packages/ui/src/components/image/Image/Image.tsx` and `Image.test.tsx`.
- **20** owns `packages/helpers/src/lib/liveItemVisibility.ts` and its test,
  `packages/orm/src/lib/liveItemWhere.ts`, `upcomingLiveItemsPage.ts`, and their tests,
  `packages/orm/src/services/item/item.ts`,
  `packages/orm/src/services/stats/popularity/statsPopularityItem.ts`,
  `apps/api/src/controllers/liveItem.ts`, `apps/api/src/test/category-channel-item-read.test.ts`,
  and `apps/api/openapi.yml`.
- **30** owns `apps/mobile/src/lib/pagination/pagedList.ts` and its test,
  `apps/mobile/src/hooks/useLoadMoreOnEndReached.ts`, and under
  `apps/mobile/src/screens/podcast/sections/`: `sectionResponseHasMore.ts`,
  `PodcastClipsSection.tsx`, `PodcastOfficialClipsSection.tsx`, `usePodcastSectionRows.ts`,
  `index.ts`; plus `apps/mobile/src/screens/episode/episodeSectionPaneLoaders.ts`.

### Phase 2 — livestream clients, training script, mobile list screens (9 prompts at once)

- **21** owns `apps/web/src/utils/subscribed/mergeSubscribedLivestreams.ts` and its test,
  `apps/web/src/utils/addByRSS/channelLiveItems.ts` and its test, `tools/web/seed-e2e.mjs`,
  `apps/web/e2e/helpers/seedConstants.ts`, and the Browse Livestreams test in
  `apps/web/e2e/media-list-chips.spec.ts`.
- **22** owns `apps/mobile/src/lib/rows/liveItemRows.ts`, `apps/mobile/src/lib/addByRss/liveRows.ts`,
  and their tests.
- **23** owns `misc/aicasts/livestreams-1-a-flag-not-a-kind-of-show.md`.
- **32** owns `apps/mobile/src/screens/podcast/sections/PodcastSectionList.tsx`,
  `usePodcastSectionRows.ts`, `PodcastEpisodesSection.tsx`, `PodcastOfficialClipsSection.tsx`, and
  `PodcastClipsSection.tsx`.
- **33** owns `apps/mobile/src/screens/episode/useEpisodeSectionPanes.ts`,
  `apps/mobile/src/screens/episode/EpisodeDetailScreen.tsx`, and
  `apps/mobile/src/screens/player/FullPlayerScreen.tsx`.
- **34** owns `apps/mobile/src/screens/notifications/NotificationsInboxScreen.tsx`.
- **35** owns `apps/mobile/src/screens/library/LibraryMyClipsScreen.tsx` and
  `apps/mobile/src/screens/library/useAddToPlaylist.tsx`.
- **36** owns `apps/mobile/src/screens/library/historyPages.ts` and its test, and
  `apps/mobile/src/screens/library/LibraryHistoryScreen.tsx`.
- **37** owns `apps/mobile/src/screens/album/AlbumDetailScreen.tsx`.

### Phase 3 — Browse, Home, and clip-sort coverage (3 prompts at once)

- **31** owns `apps/mobile/src/screens/browse/browseFeedData.ts`, `browseFeedPages.ts`,
  `browseFeedPages.test.ts`, and `BrowseScreen.tsx`.
- **38** owns `apps/mobile/src/data/repositories/homeClipsCacheRepository.ts`,
  `homeLivestreamsCacheRepository.ts`, and their tests,
  `apps/mobile/src/screens/home/homeFeedData.ts`, `homeFeedData.localPaint.test.ts`, and
  `HomeScreen.tsx`.
- **41** owns `apps/api/src/test/clip.test.ts` and its one new test in
  `apps/web/e2e/media-list-chips.spec.ts`.

### Phase 4 — Home Clips without A-Z (alone)

- **40** owns `apps/mobile/src/prefs/homeListPrefs.ts` and its test,
  `apps/mobile/src/screens/home/HomeSortChip.tsx`, `HomeScreen.tsx`, `homeFeedData.ts`,
  `homeFeedData.localPaint.test.ts`, `apps/mobile/src/sync/syncJobs.ts`, and
  `apps/mobile/e2e/home.yaml`. Appends its own release entry.

### Phase 5 — Home Clips sort change refetches (alone)

- **50** owns `apps/mobile/src/prefs/homeListPrefs.ts` and its test,
  `apps/mobile/src/sync/syncJobs.ts`,
  `apps/mobile/src/data/repositories/homeClipsCacheRepository.ts` and its test,
  `apps/mobile/src/screens/home/HomeScreen.tsx`, and `apps/mobile/e2e/home.yaml`. Appends its own
  release entry.

### Phase 6 — sign-out clears Home clips, then close the set (alone)

- **55** owns `apps/mobile/src/data/repositories/homeClipsCacheRepository.ts` and its test,
  `apps/mobile/src/auth/AuthProvider.tsx`, and `apps/mobile/src/data/README.md`. Appends the
  Phase 1–3 release entries and its own, archives the set, and carries the cumulative
  verification.

## Release entries collected by prompt 55

From `.artifacts/plan-runner/browse-responsiveness-pagination-live-order/<NN>.md`, in this order:
10, 20, 21, 22, 31, 32, 33, 34, 35, 36, 37, 38. Then prompt 55's own entry. Prompts 40 and 50
appended theirs already. Plans 11, 23, 30, and 41 have none.
