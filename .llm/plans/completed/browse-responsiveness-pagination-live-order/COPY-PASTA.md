# Browse responsiveness, mobile pagination, livestream order — COPY-PASTA

How to use:

1. Select **Cursor model** and **Reasoning** in the Cursor UI (the line above each fence).
1. Copy the fenced block only, paste, and the agent runs it.
1. Tick the box when that prompt is done.

Request and settled review answers: [00-REQUEST.md](./00-REQUEST.md). Ledger and decisions:
[00-SUMMARY.md](./00-SUMMARY.md). Order and file ownership:
[00-EXECUTION-ORDER.md](./00-EXECUTION-ORDER.md).

**Optional — run the set unattended (Root tab, in this worktree):**
`./scripts/abcplan/run.sh run browse-responsiveness-pagination-live-order`. It runs one fresh
agent per prompt on that prompt's model, stops at the first blocker, and resumes with
`./scripts/abcplan/run.sh run browse-responsiveness-pagination-live-order --resume 'Your answer.'`.
The script passes `--parallel`, so every prompt under one phase heading runs at once. Prompts in
one phase share no file. In Phases 1–3 no prompt writes the release scratchpad: each puts its
entry in its final message, and prompt 55 appends them. Prompts 40 and 50 run alone and append
their own. Running the prompts one after the other is also correct.

Phases run in order; prompts inside a phase run at once.

| Phase | Prompts | Model and reasoning |
| --- | --- | --- |
| 1 | 10, 11, 20, 30 | 10 Cursor Grok 4.7 extra high; 11 Cursor Grok 4.7 medium; 20 Opus 5.5 high; 30 Cursor Grok 4.7 medium |
| 2 | 21, 22, 23, 32, 33, 34, 35, 36, 37 | Cursor Grok 4.7 high, except 23 Cursor Grok 4.7 medium and 36 Opus 5.5 medium |
| 3 | 31, 38, 41 | 31 Opus 5.5 medium; 38 Opus 5.5 high; 41 Cursor Grok 4.7 medium |
| 4 | 40 | Cursor Grok 4.7 high |
| 5 | 50 | Opus 5.5 high |
| 6 | 55 | Cursor Grok 4.7 extra high |

Why the expensive ones: 20 sets the livestream order and stale-window contract that the API, web,
and mobile all build on. 31 joins paged livestream, media, playlist, and account feeds on Browse.
36 re-reads every shown History page when the queue changes. 38 rewrites the Home Clips and
Livestreams data stored on the device. 50 races a sort-change refetch against background sync and
sign-out on that stored data. Fast stays off.

If a Cursor Grok 4.7 prompt stalls or makes the same mistake twice, rerun it one reasoning level
higher (after extra high, **Codex 5.3 · high**), and record the change on the prompt here.

## Phase 1

Four prompts at once. Each owns only the files its plan lists (see 00-EXECUTION-ORDER.md
§ Phase 1). 10 and 11 both edit `packages/ui`, in different files; neither rebuilds it.

- [x] **10 — Media list chips select on click, the list area shows a spinner, the row stays still**

**Cursor model:** Cursor Grok 4.7 · **Reasoning:** extra high

```
Read and execute .llm/plans/active/browse-responsiveness-pagination-live-order/10-media-list-chip-immediate-selection.md
Follow 00-EXECUTION-ORDER.md and the settled answers in 00-REQUEST.md (D1 changed, D2 kept; the
second review kept the chip-row rebuild with restored sideways scroll and focus, and all five
loading details). Do not reopen them.
You own the files in the plan's ## Files list, including ChipRow.* in packages/ui and the two new
tests in apps/web/e2e/media-list-chips.spec.ts. Prompt 11 edits packages/ui Image.* at the same
time; do not touch it. Later prompts 21 and 41 edit other tests in media-list-chips.spec.ts; add
yours only where the plan says.
If the plan's Playwright test depends on how Next.js handles router.replace to the current URL
while another navigation is in flight, write it as the plan says and note the assumption.
Another prompt runs at the same time; edit only the files your plan lists, scope any type-check
or formatter to them, and do not rebuild shared packages. Report errors in files you do not own
instead of fixing them. Do not run tests. Do not edit release-notes/scratchpad.md: put the
plan's release scratchpad entry in your final message under "Release notes entry". Prompt 55
appends it.
When the plan is done, move 10-media-list-chip-immediate-selection.md to
.llm/plans/completed/browse-responsiveness-pagination-live-order/ (create the directory if
missing).
End without a verification block: report what changed, self-check results, any blocker, and
anything a later prompt needs.
```

- [x] **11 — Shared Image: remote artwork loads lazily and decodes asynchronously**

**Cursor model:** Cursor Grok 4.7 · **Reasoning:** medium

```
Read and execute .llm/plans/active/browse-responsiveness-pagination-live-order/11-shared-image-remote-artwork-contract.md
Follow 00-EXECUTION-ORDER.md and the settled answers in 00-REQUEST.md.
You own packages/ui/src/components/image/Image/Image.tsx and Image.test.tsx only. Prompt 10 edits
packages/ui ChipRow.* at the same time; do not touch it.
Another prompt runs at the same time; edit only the files your plan lists, scope any type-check
or formatter to them, and do not rebuild shared packages. Report errors in files you do not own
instead of fixing them. Do not run tests. The plan has no release scratchpad entry.
When the plan is done, move 11-shared-image-remote-artwork-contract.md to
.llm/plans/completed/browse-responsiveness-pagination-live-order/ (create the directory if
missing).
End without a verification block: report what changed, self-check results, any blocker, and
anything a later prompt needs.
```

- [x] **20 — Livestream order and stale scheduled window: shared contract, ORM, API**

**Cursor model:** Opus 5.5 · **Reasoning:** high

```
Read and execute .llm/plans/active/browse-responsiveness-pagination-live-order/20-livestream-order-stale-window-server.md
Follow 00-EXECUTION-ORDER.md and the settled answers in 00-REQUEST.md (D3, D4, D5, D6, D7 kept).
You own the helpers, ORM, and API files in the plan's ## Files list. apps/api/openapi.yml is
large: Grep for the live-item route paths, then read a window. The exports
compareUpcomingLiveItems, LIVE_ITEM_PENDING_VISIBILITY_MAX_AGE_MS, and isPendingLiveItemStale
are the contract prompts 21, 22, 23, 31, and 38 build on; keep the names the plan states.
Another prompt runs at the same time; edit only the files your plan lists, scope any type-check
or formatter to them, and report errors in files you do not own instead of fixing them. When your
edits are done, run npm run build -w packages/helpers, then npm run build -w packages/orm, so
later phases type-check against the new exports. Build nothing else. Do not run tests. Do not
edit release-notes/scratchpad.md: put the plan's release scratchpad entry in your final message
under "Release notes entry". Prompt 55 appends it.
When the plan is done, move 20-livestream-order-stale-window-server.md to
.llm/plans/completed/browse-responsiveness-pagination-live-order/ (create the directory if
missing).
End without a verification block: report what changed, self-check results, any blocker, and
anything a later prompt needs, including the final export names if they differ from the plan.
```

- [x] **30 — Mobile paged-list helpers (has-more, append, end-reached guard)**

**Cursor model:** Cursor Grok 4.7 · **Reasoning:** medium

```
Read and execute .llm/plans/active/browse-responsiveness-pagination-live-order/30-mobile-paged-list-helpers.md
Follow 00-EXECUTION-ORDER.md and the settled answers in 00-REQUEST.md (D15 kept: Taste Profile
and Profile are out of scope).
You own the mobile files in the plan's ## Files list. listResponseHasMore, fullPageHasMore,
appendUniqueBy, canLoadNextPage, and useLoadMoreOnEndReached are the contract prompts 31–38
import; keep the names and paths the plan states.
Another prompt runs at the same time; edit only the files your plan lists, scope any type-check
or formatter to them, and do not rebuild shared packages. Report errors in files you do not own
instead of fixing them. Do not run tests. The plan has no release scratchpad entry.
When the plan is done, move 30-mobile-paged-list-helpers.md to
.llm/plans/completed/browse-responsiveness-pagination-live-order/ (create the directory if
missing).
End without a verification block: report what changed, self-check results, any blocker, and
anything a later prompt needs.
```

## Phase 2

Nine prompts at once. Each owns only the files its plan lists (see 00-EXECUTION-ORDER.md
§ Phase 2). None edits `packages/helpers`, `packages/orm`, or plan 30's helpers; prompt 20 has
already built the packages.

- [x] **21 — Web: stale window on Add by RSS livestreams, order tests, Browse E2E**

**Cursor model:** Cursor Grok 4.7 · **Reasoning:** high

```
Read and execute .llm/plans/active/browse-responsiveness-pagination-live-order/21-web-livestream-order-stale-window.md
Follow 00-EXECUTION-ORDER.md and the settled answers in 00-REQUEST.md (D5, D7 kept).
Build on prompt 20's helpers exports; read
.artifacts/plan-runner/browse-responsiveness-pagination-live-order/20.md if a name differs from
the plan. tools/web/seed-e2e.mjs is large: search for the anchor async function insertLiveItem(
and make targeted edits. Mobile E2E reuses this seed, so keep every existing row. In
apps/web/e2e/media-list-chips.spec.ts edit only the Browse Livestreams test; prompt 10's tests are
already in the file.
Another prompt runs at the same time; edit only the files your plan lists, scope any type-check
or formatter to them, and do not rebuild shared packages. Report errors in files you do not own
instead of fixing them. Do not run tests. Do not edit release-notes/scratchpad.md: put the
plan's release scratchpad entry in your final message under "Release notes entry". Prompt 55
appends it.
When the plan is done, move 21-web-livestream-order-stale-window.md to
.llm/plans/completed/browse-responsiveness-pagination-live-order/.
End without a verification block: report what changed, self-check results, any blocker, and
anything a later prompt needs.
```

- [x] **22 — Mobile: stale window on livestream rows, order tests**

**Cursor model:** Cursor Grok 4.7 · **Reasoning:** high

```
Read and execute .llm/plans/active/browse-responsiveness-pagination-live-order/22-mobile-livestream-order-stale-window.md
Follow 00-EXECUTION-ORDER.md and the settled answers in 00-REQUEST.md (D5, D7 kept).
You own apps/mobile/src/lib/rows/liveItemRows.ts, apps/mobile/src/lib/addByRss/liveRows.ts, and
their tests. Build on prompt 20's helpers exports; read
.artifacts/plan-runner/browse-responsiveness-pagination-live-order/20.md if a name differs from
the plan. Prompts 31 and 38 rely on mapItemsToUpcomingLiveRows dropping stale rows.
Another prompt runs at the same time; edit only the files your plan lists, scope any type-check
or formatter to them, and do not rebuild shared packages. Report errors in files you do not own
instead of fixing them. Do not run tests. Do not edit release-notes/scratchpad.md: put the
plan's release scratchpad entry in your final message under "Release notes entry". Prompt 55
appends it.
When the plan is done, move 22-mobile-livestream-order-stale-window.md to
.llm/plans/completed/browse-responsiveness-pagination-live-order/.
End without a verification block: report what changed, self-check results, any blocker, and
anything a later prompt needs.
```

- [x] **23 — Livestream training script matches the settled order**

**Cursor model:** Cursor Grok 4.7 · **Reasoning:** medium

```
Read and execute .llm/plans/active/browse-responsiveness-pagination-live-order/23-livestream-training-script.md
Follow 00-EXECUTION-ORDER.md and the settled answers in 00-REQUEST.md (D3–D7 kept; do not reopen
the window length).
You own misc/aicasts/livestreams-1-a-flag-not-a-kind-of-show.md only. Read
.artifacts/plan-runner/browse-responsiveness-pagination-live-order/20.md and confirm the order and
window prompt 20 shipped match the plan's contract section; if they differ, stop and report the
difference instead of guessing. Do not regenerate audio.
Another prompt runs at the same time; edit only the file your plan lists. Report errors in files
you do not own instead of fixing them. Do not run tests. The plan has no release scratchpad entry.
When the plan is done, move 23-livestream-training-script.md to
.llm/plans/completed/browse-responsiveness-pagination-live-order/.
End without a verification block: report what changed, self-check results, any blocker, and
anything a later prompt needs.
```

- [x] **32 — Mobile podcast sections: load the next page near the bottom**

**Cursor model:** Cursor Grok 4.7 · **Reasoning:** high

```
Read and execute .llm/plans/active/browse-responsiveness-pagination-live-order/32-mobile-podcast-sections-infinite-scroll.md
Follow 00-EXECUTION-ORDER.md and the settled answers in 00-REQUEST.md (D11 clarified as R16: with
a typed title filter, no auto-load, and Show More only while the feed has another page; D14
kept).
You own the five apps/mobile/src/screens/podcast/sections/ files in the plan's ## Files list.
Prompt 30 already edited three of them; build on its changes and its helpers, and do not edit
plan 30's helper files.
Another prompt runs at the same time; edit only the files your plan lists, scope any type-check
or formatter to them, and do not rebuild shared packages. Report errors in files you do not own
instead of fixing them. Do not run tests. Do not edit release-notes/scratchpad.md: put the
plan's release scratchpad entry in your final message under "Release notes entry". Prompt 55
appends it.
When the plan is done, move 32-mobile-podcast-sections-infinite-scroll.md to
.llm/plans/completed/browse-responsiveness-pagination-live-order/.
End without a verification block: report what changed, self-check results, any blocker, and
anything a later prompt needs.
```

- [x] **33 — Mobile episode detail and full player Clips: load the next page near the bottom**

**Cursor model:** Cursor Grok 4.7 · **Reasoning:** high

```
Read and execute .llm/plans/active/browse-responsiveness-pagination-live-order/33-mobile-episode-clip-panes-infinite-scroll.md
Follow 00-EXECUTION-ORDER.md and the settled answers in 00-REQUEST.md (D14 kept).
You own useEpisodeSectionPanes.ts, EpisodeDetailScreen.tsx, and
apps/mobile/src/screens/player/FullPlayerScreen.tsx. Prompt 30 edited episodeSectionPaneLoaders.ts;
use it and do not edit it.
Another prompt runs at the same time; edit only the files your plan lists, scope any type-check
or formatter to them, and do not rebuild shared packages. Report errors in files you do not own
instead of fixing them. Do not run tests. Do not edit release-notes/scratchpad.md: put the
plan's release scratchpad entry in your final message under "Release notes entry". Prompt 55
appends it.
When the plan is done, move 33-mobile-episode-clip-panes-infinite-scroll.md to
.llm/plans/completed/browse-responsiveness-pagination-live-order/.
End without a verification block: report what changed, self-check results, any blocker, and
anything a later prompt needs.
```

- [x] **34 — Mobile notifications inbox: load the next page near the bottom**

**Cursor model:** Cursor Grok 4.7 · **Reasoning:** high

```
Read and execute .llm/plans/active/browse-responsiveness-pagination-live-order/34-mobile-notifications-inbox-infinite-scroll.md
Follow 00-EXECUTION-ORDER.md and the settled answers in 00-REQUEST.md (D14 kept).
You own apps/mobile/src/screens/notifications/NotificationsInboxScreen.tsx only. Use prompt 30's
helpers; do not edit them.
Another prompt runs at the same time; edit only the files your plan lists, scope any type-check
or formatter to them, and do not rebuild shared packages. Report errors in files you do not own
instead of fixing them. Do not run tests. Do not edit release-notes/scratchpad.md: put the
plan's release scratchpad entry in your final message under "Release notes entry". Prompt 55
appends it.
When the plan is done, move 34-mobile-notifications-inbox-infinite-scroll.md to
.llm/plans/completed/browse-responsiveness-pagination-live-order/.
End without a verification block: report what changed, self-check results, any blocker, and
anything a later prompt needs.
```

- [x] **35 — Mobile My Clips and the Add to Playlist sheet: load the next page near the bottom**

**Cursor model:** Cursor Grok 4.7 · **Reasoning:** high

```
Read and execute .llm/plans/active/browse-responsiveness-pagination-live-order/35-mobile-my-clips-add-to-playlist-infinite-scroll.md
Follow 00-EXECUTION-ORDER.md and the settled answers in 00-REQUEST.md.
You own apps/mobile/src/screens/library/LibraryMyClipsScreen.tsx and useAddToPlaylist.tsx.
Prompt 36 edits other files in the same library folder at the same time; do not touch them. Use
prompt 30's helpers; do not edit them.
Another prompt runs at the same time; edit only the files your plan lists, scope any type-check
or formatter to them, and do not rebuild shared packages. Report errors in files you do not own
instead of fixing them. Do not run tests. Do not edit release-notes/scratchpad.md: put the
plan's release scratchpad entry in your final message under "Release notes entry". Prompt 55
appends it.
When the plan is done, move 35-mobile-my-clips-add-to-playlist-infinite-scroll.md to
.llm/plans/completed/browse-responsiveness-pagination-live-order/.
End without a verification block: report what changed, self-check results, any blocker, and
anything a later prompt needs.
```

- [x] **36 — Mobile History: load the next page near the bottom**

**Cursor model:** Opus 5.5 · **Reasoning:** medium

```
Read and execute .llm/plans/active/browse-responsiveness-pagination-live-order/36-mobile-history-infinite-scroll.md
Follow 00-EXECUTION-ORDER.md and the settled answers in 00-REQUEST.md (D12 kept: a queue change
re-reads every page already shown).
You own apps/mobile/src/screens/library/historyPages.ts, historyPages.test.ts, and
LibraryHistoryScreen.tsx. Prompt 35 edits other files in the same library folder at the same
time; do not touch them. Use prompt 30's helpers; do not edit them.
Another prompt runs at the same time; edit only the files your plan lists, scope any type-check
or formatter to them, and do not rebuild shared packages. Report errors in files you do not own
instead of fixing them. Do not run tests. Do not edit release-notes/scratchpad.md: put the
plan's release scratchpad entry in your final message under "Release notes entry". Prompt 55
appends it.
When the plan is done, move 36-mobile-history-infinite-scroll.md to
.llm/plans/completed/browse-responsiveness-pagination-live-order/.
End without a verification block: report what changed, self-check results, any blocker, and
anything a later prompt needs.
```

- [x] **37 — Mobile album Tracks: load the next page near the bottom**

**Cursor model:** Cursor Grok 4.7 · **Reasoning:** high

```
Read and execute .llm/plans/active/browse-responsiveness-pagination-live-order/37-mobile-album-tracks-infinite-scroll.md
Follow 00-EXECUTION-ORDER.md and the settled answers in 00-REQUEST.md.
You own apps/mobile/src/screens/album/AlbumDetailScreen.tsx only. Use prompt 30's helpers; do not
edit them.
Another prompt runs at the same time; edit only the files your plan lists, scope any type-check
or formatter to them, and do not rebuild shared packages. Report errors in files you do not own
instead of fixing them. Do not run tests. Do not edit release-notes/scratchpad.md: put the
plan's release scratchpad entry in your final message under "Release notes entry". Prompt 55
appends it.
When the plan is done, move 37-mobile-album-tracks-infinite-scroll.md to
.llm/plans/completed/browse-responsiveness-pagination-live-order/.
End without a verification block: report what changed, self-check results, any blocker, and
anything a later prompt needs.
```

## Phase 3

Three prompts at once. Each owns only the files its plan lists (see 00-EXECUTION-ORDER.md
§ Phase 3). 31 and 38 build on prompts 20, 22, and 30; 41 builds on prompts 10 and 21.

- [x] **31 — Mobile Browse: load the next page near the bottom**

**Cursor model:** Opus 5.5 · **Reasoning:** medium

```
Read and execute .llm/plans/active/browse-responsiveness-pagination-live-order/31-mobile-browse-infinite-scroll.md
Follow 00-EXECUTION-ORDER.md and the settled answers in 00-REQUEST.md (D13 kept: livestream pages
append in server order, and a repeated id keeps its first position).
You own browseFeedData.ts, browseFeedPages.ts, browseFeedPages.test.ts, and BrowseScreen.tsx under
apps/mobile/src/screens/browse/. Decide whether a livestream page has more from the raw response
length, not the mapped row count, because prompt 22's mapping drops stale rows. Use prompt 30's
helpers and prompt 22's row functions; do not edit them.
Another prompt runs at the same time; edit only the files your plan lists, scope any type-check
or formatter to them, and do not rebuild shared packages. Report errors in files you do not own
instead of fixing them. Do not run tests. Do not edit release-notes/scratchpad.md: put the
plan's release scratchpad entry in your final message under "Release notes entry". Prompt 55
appends it.
When the plan is done, move 31-mobile-browse-infinite-scroll.md to
.llm/plans/completed/browse-responsiveness-pagination-live-order/.
End without a verification block: report what changed, self-check results, any blocker, and
anything a later prompt needs.
```

- [x] **38 — Mobile Home Clips and Livestreams: extend the stored window near the bottom**

**Cursor model:** Opus 5.5 · **Reasoning:** high

```
Read and execute .llm/plans/active/browse-responsiveness-pagination-live-order/38-mobile-home-clips-livestreams-infinite-scroll.md
Follow 00-EXECUTION-ORDER.md and the settled answers in 00-REQUEST.md (D8 and D10 kept; D9
changed: Home Clips extends under every sort it offers).
You own the two Home cache repositories and their tests, homeFeedData.ts,
homeFeedData.localPaint.test.ts, and HomeScreen.tsx. Keep calling applyHomeSort as the plan says;
prompt 40 deletes it afterwards and edits the same three Home files. Prompts 50 and 55 later build
on your clips repository (stored window, session-generation guard, write generation,
readSnapshot, extendFromAccount) and the livestreams clear(); keep the names the plan states.
Use prompt 30's helpers and prompt 22's row functions; do not edit them.
Another prompt runs at the same time; edit only the files your plan lists, scope any type-check
or formatter to them, and do not rebuild shared packages. Report errors in files you do not own
instead of fixing them. Do not run tests. Do not edit release-notes/scratchpad.md: put the
plan's release scratchpad entry in your final message under "Release notes entry". Prompt 55
appends it.
When the plan is done, move 38-mobile-home-clips-livestreams-infinite-scroll.md to
.llm/plans/completed/browse-responsiveness-pagination-live-order/.
End without a verification block: report what changed, self-check results, any blocker, and
anything prompts 40, 50, and 55 need about the clips branch of fetchHomeFeed, the clips
repository, and HomeScreen.tsx, including any name that differs from the plan.
```

- [x] **41 — API and web tests that keep clip lists free of A-Z**

**Cursor model:** Cursor Grok 4.7 · **Reasoning:** medium

```
Read and execute .llm/plans/active/browse-responsiveness-pagination-live-order/41-api-web-clip-list-no-alphabetical-coverage.md
Follow 00-EXECUTION-ORDER.md and the settled answers in 00-REQUEST.md (D9 changed: clips never
offer A-Z, and Clips defaults to Recent; the management Stats Title column is out of scope and
stays).
You own apps/api/src/test/clip.test.ts and one new test in apps/web/e2e/media-list-chips.spec.ts,
placed between the Subscribed/Browse Sort test and the Browse Livestreams test. Prompts 10 and 21
already edited that spec; leave their tests alone. This plan is tests only: if product code does
offer or keep A-Z for clips, stop and report the route or file instead of changing it.
Another prompt runs at the same time; edit only the files your plan lists, scope any type-check
or formatter to them, and do not rebuild shared packages. Report errors in files you do not own
instead of fixing them. Do not run tests. The plan has no release scratchpad entry.
When the plan is done, move 41-api-web-clip-list-no-alphabetical-coverage.md to
.llm/plans/completed/browse-responsiveness-pagination-live-order/.
End without a verification block: report what changed, self-check results, any blocker, and
anything a later prompt needs.
```

## Phase 4

- [x] **40 — Mobile Home Clips: no A-Z sort, Recent by default**

**Cursor model:** Cursor Grok 4.7 · **Reasoning:** high

```
Read and execute .llm/plans/active/browse-responsiveness-pagination-live-order/40-mobile-home-clips-no-alphabetical-sort.md
Follow 00-EXECUTION-ORDER.md and the settled answers in 00-REQUEST.md (D9 changed: Clips offers
Recent and Popularity, opens on Recent, and a saved A-Z reads as Recent; podcasts, episodes, and
channels keep A-Z).
Prompt 38 rewrote the clips branch of fetchHomeFeed, the clips cache repository, and the loadFeed
and listFooter parts of HomeScreen.tsx; read
.artifacts/plan-runner/browse-responsiveness-pagination-live-order/38.md first and build on its
code. Delete applyHomeSort as the plan says. In apps/mobile/e2e/home.yaml make the plan's
targeted insertion only. The plan says no other plan edits homeListPrefs.ts, syncJobs.ts, or
home.yaml; prompt 50 edits them after you. Do the plan as written and do not anticipate plan 50.
This prompt runs alone. Do not run tests. Append the plan's release scratchpad entry to the end of
release-notes/scratchpad.md.
When the plan is done, move 40-mobile-home-clips-no-alphabetical-sort.md to
.llm/plans/completed/browse-responsiveness-pagination-live-order/.
End without a verification block: report what changed, self-check results, any blocker, and
anything prompt 50 needs about homeClipSortToApiSort, resolveHomeSort, the Clips sort options, and
createHomeClipsJob, including any name that differs from the plan.
```

## Phase 5

- [x] **50 — Mobile Home Clips: a sort change refetches page 1 now**

**Cursor model:** Opus 5.5 · **Reasoning:** high

```
Read and execute .llm/plans/active/browse-responsiveness-pagination-live-order/50-mobile-home-clips-sort-change-refetch.md
Follow 00-EXECUTION-ORDER.md and the settled answers in 00-REQUEST.md (second review: a Home Clips
change between Recent and Popularity refetches page 1 now and replaces the saved list; D10 kept, a
background sync still resets that list to page 1).
Read .artifacts/plan-runner/browse-responsiveness-pagination-live-order/38.md and 40.md first and
build on the code they landed in homeClipsCacheRepository.ts, homeListPrefs.ts, syncJobs.ts,
HomeScreen.tsx, and apps/mobile/e2e/home.yaml. If a name the plan relies on differs, use the
landed name. In home.yaml make targeted edits only.
This prompt runs alone. Do not run tests. Append the plan's release scratchpad entry to the end of
release-notes/scratchpad.md.
When the plan is done, move 50-mobile-home-clips-sort-change-refetch.md to
.llm/plans/completed/browse-responsiveness-pagination-live-order/.
End without a verification block: report what changed, self-check results, any blocker, and
anything prompt 55 needs about homeClipsRefreshGeneration, the 'replaced' | 'stale' result of
refreshFromAccount, and the clips repository test.
```

## Phase 6

- [x] **55 — Sign-out clears the saved Home clips list; then close the set**

**Cursor model:** Cursor Grok 4.7 · **Reasoning:** extra high

```
Read and execute .llm/plans/active/browse-responsiveness-pagination-live-order/55-mobile-home-clips-cache-sign-out.md
Follow 00-EXECUTION-ORDER.md and the settled answers in 00-REQUEST.md (second review: sign-out
clears the Home clips cache the way it already clears the Home livestreams cache).
Read .artifacts/plan-runner/browse-responsiveness-pagination-live-order/38.md and 50.md first.
Copy homeLivestreamsCacheRepository.clear onto the clips repository as the plan says (advance
the write generation before the first await, then delete the kv row), and build on plan 50's
changes to homeClipsCacheRepository.ts and its test.
This prompt runs alone. Do not run tests.

Release notes: append to the end of release-notes/scratchpad.md every "Release notes entry" from
the final messages of prompts 10, 20, 21, 22, 31, 32, 33, 34, 35, 36, 37, and 38 in
.artifacts/plan-runner/browse-responsiveness-pagination-live-order/ (10.md, 20.md, …), in that
order, unchanged. Skip one that already appears in the scratchpad. If a final message has no
entry, use the ## Release scratchpad block from that prompt's plan in
.llm/plans/completed/browse-responsiveness-pagination-live-order/. Prompts 40 and 50 appended
theirs already; plans 11, 23, 30, and 41 have none. Then append this plan's own entry.

Then close the set. Move 55-mobile-home-clips-cache-sign-out.md to
.llm/plans/completed/browse-responsiveness-pagination-live-order/ and confirm the other eighteen
numbered plans are there (10, 11, 20, 21, 22, 23, 30–38, 40, 41, 50). Move 00-REQUEST.md,
00-SUMMARY.md, 00-EXECUTION-ORDER.md, and COPY-PASTA.md there, and remove the empty active
directory.

End with the cumulative verification for the whole set, assuming no earlier prompt was tested.
One fenced bash block per tab, fish-safe, labeled with the tab name. Tell the operator that Docker
must be running for make test_deps and the web report. For the Mobile Maestro block, Mobile E2E
Metro, Mobile E2E API, and Mobile E2E iOS or Mobile E2E Android must be running from this
worktree, with Mobile E2E API started (or restarted) after the set so it serves the new livestream
order and plan 21's seed rows. Do not put leave-running commands in the blocks. Note that there is
no dependency change, so no lockfile step, and that the livestream training script changed
(plan 23) but its audio is regenerated separately, not by this set.

Root:
npm run build:packages
npm run lint
npm run type-check
npm run test -w packages/helpers
npm run test -w packages/orm
npm run test -w packages/ui
npm run test -w apps/web
npm --prefix apps/mobile run test
make test_deps
npm run test -w apps/api
make e2e_test_web_report_spec SPEC=e2e/media-list-chips.spec.ts,e2e/recommendations.spec.ts,e2e/add-by-rss-auto-parse.spec.ts,e2e/add-by-rss-artist-albums.spec.ts,e2e/background-activity-overlay.spec.ts
open .artifacts/e2e-reports/latest/index.html

Mobile Maestro:
npm run mobile:e2e:test -- browse,home,podcast-episode,add-by-rss-episode-sections,player-screen,notifications-inbox,library-playlists,make-clip,history-screen,album,detail-sort-prefs,auth-logout
open .artifacts/mobile-e2e-reports/latest/failures.json
open .artifacts/mobile-e2e-reports/latest/ios-phone/index.html
open .artifacts/mobile-e2e-reports/latest/android-phone/index.html
```

- [ ] **abcaicast** (optional)

After this set, do you want an abcaicast for this work?
