# Add by RSS parity, chips pages, livestreams, and web background activity — COPY-PASTA

How to use:

1. Select **Cursor model** and **Reasoning** in the Cursor UI (the line above each fence).
1. Copy the fenced block only, paste, and the agent runs it.
1. Tick the box when that prompt is done.

Request: [00-REQUEST.md](./00-REQUEST.md). Decisions and ledger: [00-SUMMARY.md](./00-SUMMARY.md).
Order and file ownership: [00-EXECUTION-ORDER.md](./00-EXECUTION-ORDER.md).

**Optional — run the set unattended (Root tab):** `./scripts/abcplan/run.sh run add-by-rss-parity`.
It runs one fresh agent per prompt on that prompt's model, stops at the first blocker, and resumes
with `./scripts/abcplan/run.sh run add-by-rss-parity --resume 'Your answer.'`. The script passes
`--parallel`, so the two prompts of a paired phase run at once. They share no file, and neither
writes the release scratchpad: each puts its entry in its final message, and prompt 53 appends
them. Running them one after the other is also correct.

**Optional — one chat runs the whole set:** paste
`Orchestrate .llm/plans/active/add-by-rss-parity/ with .cursor/prompts/plan-orchestrator.md.`
(Cursor Grok 4.7 · medium). It stops at the first blocker. Use the prompts below instead when
you want to read each result before the next prompt starts.

Before phase 31, start Docker: plan 80 regenerates the linear baseline archive.

Every prompt is **Cursor Grok 4.7** with Fast off, at the reasoning named above its fence:

- **extra high** — 22, 31, 35, 37, 66, 80, 82, 88, 90, 92, 93, 94, 95: credentials and their
  scope, offline and now-playing playback, stored-data retyping, SQL and SQLite migrations, merge
  and ordering rules, the follow-sync insert race, ids later prompts depend on, and the most-edited
  player files
- **medium** — 42, 43, 52, 53, 61, 62, 68, 69, 87, 97: module moves, E2E specs and flows,
  sidebar and guidance edits, small link and badge changes, archiving the set
- **high** — every other prompt

If one stalls or makes the same mistake twice, rerun it one reasoning level higher (after extra
high, **Codex 5.3 · high**), and record the change on the prompt here.

## Phase 1

- [x] **10 — Mobile item row type and new-content dot**

**Cursor model:** Cursor Grok 4.7 · **Reasoning:** high

```
Read and execute .llm/plans/active/add-by-rss-parity/10-item-row-type-and-dot.md
Follow 00-EXECUTION-ORDER.md and the operator answers in 00-REQUEST.md.
Mobile only; web item rows do not change. Keep the itemLastSeenAtMs prop later plans rely on.
Another prompt may run at the same time; edit only the files your plan lists, and scope any
type-check or formatter to them. Do not run tests. Do not edit release-notes/scratchpad.md: put
the plan's release scratchpad entry, if it has one, in your final message under
"Release notes entry". Prompt 53 appends it.
When the plan is done, move 10-item-row-type-and-dot.md to
.llm/plans/completed/add-by-rss-parity/.
End without a verification block: report what changed, self-check results, any blocker, and
anything a later prompt needs.
```

- [x] **60 — Web chip row foundation**

**Cursor model:** Cursor Grok 4.7 · **Reasoning:** high

```
Read and execute .llm/plans/active/add-by-rss-parity/60-web-chips-foundation.md
Follow 00-EXECUTION-ORDER.md and the operator answers in 00-REQUEST.md.
No page changes yet. Write every new catalog key in en-US, es, fr, and el-GR originals.
Another prompt may run at the same time; edit only the files your plan lists.
Do not run tests. This plan appends no scratchpad entry.
When the plan is done, move 60-web-chips-foundation.md to
.llm/plans/completed/add-by-rss-parity/.
End without a verification block: report what changed, self-check results, any blocker, and
anything a later prompt needs.
```

## Phase 2

- [x] **20 — Add by RSS channel detail on the shared channel shell**

**Cursor model:** Cursor Grok 4.7 · **Reasoning:** high

```
Read and execute .llm/plans/active/add-by-rss-parity/20-add-by-rss-detail-shell.md
Follow 00-EXECUTION-ORDER.md and the operator answers in 00-REQUEST.md.
Podcasts sort Recent or Oldest, music Forward or Backward, with no A-Z. Keep 'alphabetical' in
the sortAddByRssHomeEpisodes input type for the library.
Another prompt may run at the same time; edit only the files your plan lists, and scope any
type-check or formatter to them. Do not run tests. Do not edit release-notes/scratchpad.md: put
the plan's release scratchpad entry, if it has one, in your final message under
"Release notes entry". Prompt 53 appends it.
When the plan is done, move 20-add-by-rss-detail-shell.md to
.llm/plans/completed/add-by-rss-parity/.
End without a verification block: report what changed, self-check results, any blocker, and
anything a later prompt needs.
```

- [x] **61 — Web channel list modules gain a scope**

**Cursor model:** Cursor Grok 4.7 · **Reasoning:** medium

```
Read and execute .llm/plans/active/add-by-rss-parity/61-web-channel-lists-scope.md
Follow 00-EXECUTION-ORDER.md and the operator answers in 00-REQUEST.md.
Move modules with git mv. Leave app/podcasts/livestreams/ where it is.
Another prompt may run at the same time; edit only the files your plan lists.
Do not run tests. This plan appends no scratchpad entry.
When the plan is done, move 61-web-channel-lists-scope.md to
.llm/plans/completed/add-by-rss-parity/.
End without a verification block: report what changed, self-check results, any blocker, and
anything a later prompt needs.
```

## Phase 3

- [x] **21 — Add by RSS channel detail section chips**

**Cursor model:** Cursor Grok 4.7 · **Reasoning:** high

```
Read and execute .llm/plans/active/add-by-rss-parity/21-add-by-rss-detail-chips.md
Follow 00-EXECUTION-ORDER.md and the operator answers in 00-REQUEST.md.
A download whose episode left the feed stays off the Downloaded chip.
Another prompt may run at the same time; edit only the files your plan lists, and scope any
type-check or formatter to them. Do not run tests. Do not edit release-notes/scratchpad.md: put
the plan's release scratchpad entry, if it has one, in your final message under
"Release notes entry". Prompt 53 appends it.
When the plan is done, move 21-add-by-rss-detail-chips.md to
.llm/plans/completed/add-by-rss-parity/.
End without a verification block: report what changed, self-check results, any blocker, and
anything a later prompt needs.
```

- [x] **62 — Web item list modules gain a scope**

**Cursor model:** Cursor Grok 4.7 · **Reasoning:** medium

```
Read and execute .llm/plans/active/add-by-rss-parity/62-web-item-lists-scope.md
Follow 00-EXECUTION-ORDER.md and the operator answers in 00-REQUEST.md.
The unrouted Livestreams modules keep compiling; only their import paths change.
Another prompt may run at the same time; edit only the files your plan lists.
Do not run tests. This plan appends no scratchpad entry.
When the plan is done, move 62-web-item-lists-scope.md to
.llm/plans/completed/add-by-rss-parity/.
End without a verification block: report what changed, self-check results, any blocker, and
anything a later prompt needs.
```

## Phase 4

- [x] **22 — Add by RSS channel detail settings: feed check and credentials**

**Cursor model:** Cursor Grok 4.7 · **Reasoning:** extra high

```
Read and execute .llm/plans/active/add-by-rss-parity/22-add-by-rss-detail-settings.md
Follow 00-EXECUTION-ORDER.md and the operator answers in 00-REQUEST.md.
Credentials stay on the device (add-by-rss-client-held-credentials). Typed values stay in the
fields after Save and Check. Pull-to-refresh without membership only re-reads the device copy.
Do not run tests. Append the plan's release scratchpad entry, if it has one.
When the plan is done, move 22-add-by-rss-detail-settings.md to
.llm/plans/completed/add-by-rss-parity/.
End without a verification block: report what changed, self-check results, any blocker, and
anything a later prompt needs.
```

## Phase 5

- [x] **30 — Add by RSS item actions: queue, playlist, mark played, download**

**Cursor model:** Cursor Grok 4.7 · **Reasoning:** high

```
Read and execute .llm/plans/active/add-by-rss-parity/30-add-by-rss-item-actions.md
Follow 00-EXECUTION-ORDER.md and the operator answers in 00-REQUEST.md.
No UI in this plan. Tracks get the same actions as episodes.
Another prompt may run at the same time; edit only the files your plan lists.
Do not run tests. This plan appends no scratchpad entry.
When the plan is done, move 30-add-by-rss-item-actions.md to
.llm/plans/completed/add-by-rss-parity/.
End without a verification block: report what changed, self-check results, any blocker, and
anything a later prompt needs.
```

- [x] **63 — Web Browse chips page**

**Cursor model:** Cursor Grok 4.7 · **Reasoning:** high

```
Read and execute .llm/plans/active/add-by-rss-parity/63-web-browse-page.md
Follow 00-EXECUTION-ORDER.md and the operator answers in 00-REQUEST.md.
Server content only. Write catalog changes in en-US, es, fr, and el-GR originals.
Another prompt may run at the same time; edit only the files your plan lists, and scope any
type-check or formatter to them. Do not run tests. Do not edit release-notes/scratchpad.md: put
the plan's release scratchpad entry, if it has one, in your final message under
"Release notes entry". Prompt 53 appends it.
When the plan is done, move 63-web-browse-page.md to
.llm/plans/completed/add-by-rss-parity/.
End without a verification block: report what changed, self-check results, any blocker, and
anything a later prompt needs.
```

## Phase 6

- [x] **31 — Add by RSS episodes play their download from the device**

**Cursor model:** Cursor Grok 4.7 · **Reasoning:** extra high

```
Read and execute .llm/plans/active/add-by-rss-parity/31-add-by-rss-download-playback.md
Follow 00-EXECUTION-ORDER.md and the operator answers in 00-REQUEST.md.
With Offline Mode on, Add by RSS plays downloads only, including from the queue and playlists.
PlaybackProvider.tsx is large: Grep the plan's anchors and read a window around each.
Do not run tests. Append the plan's release scratchpad entry, if it has one.
When the plan is done, move 31-add-by-rss-download-playback.md to
.llm/plans/completed/add-by-rss-parity/.
End without a verification block: report what changed, self-check results, any blocker, and
anything a later prompt needs.
```

## Phase 7

- [x] **32 — Shared item detail header**

**Cursor model:** Cursor Grok 4.7 · **Reasoning:** high

```
Read and execute .llm/plans/active/add-by-rss-parity/32-item-detail-header.md
Follow 00-EXECUTION-ORDER.md and the operator answers in 00-REQUEST.md.
The podcast episode page looks and behaves exactly as before, with the same testIDs.
Another prompt may run at the same time; edit only the files your plan lists.
Do not run tests. This plan appends no scratchpad entry.
When the plan is done, move 32-item-detail-header.md to
.llm/plans/completed/add-by-rss-parity/.
End without a verification block: report what changed, self-check results, any blocker, and
anything a later prompt needs.
```

- [x] **64 — Web Subscribed chips page (Home)**

**Cursor model:** Cursor Grok 4.7 · **Reasoning:** high

```
Read and execute .llm/plans/active/add-by-rss-parity/64-web-subscribed-page.md
Follow 00-EXECUTION-ORDER.md and the operator answers in 00-REQUEST.md.
The medium dropdown goes away; there is no Music chip.
Another prompt may run at the same time; edit only the files your plan lists, and scope any
type-check or formatter to them. Do not run tests. Do not edit release-notes/scratchpad.md: put
the plan's release scratchpad entry, if it has one, in your final message under
"Release notes entry". Prompt 53 appends it.
When the plan is done, move 64-web-subscribed-page.md to
.llm/plans/completed/add-by-rss-parity/.
End without a verification block: report what changed, self-check results, any blocker, and
anything a later prompt needs.
```

## Phase 8

- [x] **33 — Add by RSS episode detail page**

**Cursor model:** Cursor Grok 4.7 · **Reasoning:** high

```
Read and execute .llm/plans/active/add-by-rss-parity/33-add-by-rss-episode-detail.md
Follow 00-EXECUTION-ORDER.md and the operator answers in 00-REQUEST.md.
Build the chip list so plan 36 can add Chapters and Transcript. Do not edit
fullPlayerContentLink.ts. navigation/index.tsx is large: Grep AddByRssPodcastDetail.
Do not run tests. Append the plan's release scratchpad entry, if it has one.
When the plan is done, move 33-add-by-rss-episode-detail.md to
.llm/plans/completed/add-by-rss-parity/.
End without a verification block: report what changed, self-check results, any blocker, and
anything a later prompt needs.
```

## Phase 9

- [x] **37 — Add by RSS music feeds are music on mobile; shared track header**

**Cursor model:** Cursor Grok 4.7 · **Reasoning:** extra high

```
Read and execute .llm/plans/active/add-by-rss-parity/37-add-by-rss-music-type-and-track-header.md
Follow 00-EXECUTION-ORDER.md and the operator answers in 00-REQUEST.md.
Store the type from the parsed medium and never store 'livestreams'. Stored feeds are retyped
once from their stored bundle inside initialize(), after migrations, gated by a kv_meta marker,
with no network request. Leave isResourceType in addByRssRepository.ts alone; plan 88 edits it.
Plan 82 keeps mobile migration 24. The regular track page keeps every track-detail-* testID.
TrackDetailScreen.tsx is large: Grep function TrackPlayChrome.
Do not run tests. Append the plan's release scratchpad entry, if it has one.
When the plan is done, move 37-add-by-rss-music-type-and-track-header.md to
.llm/plans/completed/add-by-rss-parity/.
End without a verification block: report what changed, self-check results, any blocker, and
anything a later prompt needs.
```

## Phase 10

- [x] **38 — Add by RSS track page**

**Cursor model:** Cursor Grok 4.7 · **Reasoning:** high

```
Read and execute .llm/plans/active/add-by-rss-parity/38-add-by-rss-track-detail.md
Follow 00-EXECUTION-ORDER.md and the operator answers in 00-REQUEST.md.
The page opens through Go to Track; a track row tap still plays. No Share and no Funding.
navigation/index.tsx is large: Grep AddByRssEpisodeDetail and read a window around each hit.
Do not run tests. Append the plan's release scratchpad entry, if it has one.
When the plan is done, move 38-add-by-rss-track-detail.md to
.llm/plans/completed/add-by-rss-parity/.
End without a verification block: report what changed, self-check results, any blocker, and
anything a later prompt needs.
```

## Phase 11

- [x] **34 — Add by RSS item rows: open the page, show duration, add More**

**Cursor model:** Cursor Grok 4.7 · **Reasoning:** high

```
Read and execute .llm/plans/active/add-by-rss-parity/34-add-by-rss-item-rows.md
Follow 00-EXECUTION-ORDER.md and the operator answers in 00-REQUEST.md.
An episode row opens its page and its play button plays. A track row plays on tap and offers
Go to Track, Add to Playlist, and Mark as Played. In AddByRssRootScreen.tsx edit item rows only.
Do not run tests. Append the plan's release scratchpad entry, if it has one.
When the plan is done, move 34-add-by-rss-item-rows.md to
.llm/plans/completed/add-by-rss-parity/.
End without a verification block: report what changed, self-check results, any blocker, and
anything a later prompt needs.
```

## Phase 12

- [x] **35 — Add by RSS chapters and transcript: the mobile loading layer**

**Cursor model:** Cursor Grok 4.7 · **Reasoning:** extra high

```
Read and execute .llm/plans/active/add-by-rss-parity/35-add-by-rss-chapters-transcript-data.md
Follow 00-EXECUTION-ORDER.md and the operator answers in 00-REQUEST.md.
No UI. Web behavior stays the same when it moves onto hasUrlInCredentialScope.
Another prompt may run at the same time; edit only the files your plan lists.
Do not run tests. This plan appends no scratchpad entry.
When the plan is done, move 35-add-by-rss-chapters-transcript-data.md to
.llm/plans/completed/add-by-rss-parity/.
End without a verification block: report what changed, self-check results, any blocker, and
anything a later prompt needs.
```

- [x] **65 — Web Subscribed channel chips include Add by RSS follows**

**Cursor model:** Cursor Grok 4.7 · **Reasoning:** high

```
Read and execute .llm/plans/active/add-by-rss-parity/65-web-subscribed-add-by-rss-channels.md
Follow 00-EXECUTION-ORDER.md and the operator answers in 00-REQUEST.md.
Accounts with no Add by RSS follows get no extra reads or requests. Keep the hook name
useReadyAddByRSSFeeds; plans 66, 70, and 84 use it. A feed with livestreams stays on its
medium's chip.
Another prompt may run at the same time; edit only the files your plan lists, and scope any
type-check or formatter to them. Do not run tests. Do not edit release-notes/scratchpad.md: put
the plan's release scratchpad entry, if it has one, in your final message under
"Release notes entry". Prompt 53 appends it.
When the plan is done, move 65-web-subscribed-add-by-rss-channels.md to
.llm/plans/completed/add-by-rss-parity/.
End without a verification block: report what changed, self-check results, any blocker, and
anything a later prompt needs.
```

## Phase 13

- [x] **36 — Add by RSS episode page: Chapters and Transcript chips**

**Cursor model:** Cursor Grok 4.7 · **Reasoning:** high

```
Read and execute .llm/plans/active/add-by-rss-parity/36-add-by-rss-episode-chapters-transcript.md
Follow 00-EXECUTION-ORDER.md and the operator answers in 00-REQUEST.md.
Register add-by-rss-episode-sections in scripts/mobile/e2e-test.sh as the plan says. The API
fixture is E2E-only.
Do not run tests. Append the plan's release scratchpad entry, if it has one.
When the plan is done, move 36-add-by-rss-episode-chapters-transcript.md to
.llm/plans/completed/add-by-rss-parity/.
End without a verification block: report what changed, self-check results, any blocker, and
anything a later prompt needs.
```

## Phase 14

- [x] **66 — Web Subscribed Episodes and Tracks include Add by RSS items**

**Cursor model:** Cursor Grok 4.7 · **Reasoning:** extra high

```
Read and execute .llm/plans/active/add-by-rss-parity/66-web-subscribed-add-by-rss-items.md
Follow 00-EXECUTION-ORDER.md and the operator answers in 00-REQUEST.md.
Clips stays server only. Each source keeps its own newest 60. Under Recent, Add by RSS items mix
into page 1 by date; under Top, they come after the last server page.
Do not run tests. Append the plan's release scratchpad entry, if it has one.
When the plan is done, move 66-web-subscribed-add-by-rss-items.md to
.llm/plans/completed/add-by-rss-parity/.
End without a verification block: report what changed, self-check results, any blocker, and
anything a later prompt needs.
```

## Phase 15

- [x] **67 — Web Add by RSS chips page**

**Cursor model:** Cursor Grok 4.7 · **Reasoning:** high

```
Read and execute .llm/plans/active/add-by-rss-parity/67-web-add-by-rss-chips-page.md
Follow 00-EXECUTION-ORDER.md and the operator answers in 00-REQUEST.md.
Add by RSS feeds only. The old /add-by-rss/<list> pages are deleted; detail routes stay. Leave
the remaining livestreams resource-type branches to plan 88.
Do not run tests. Append the plan's release scratchpad entry, if it has one.
When the plan is done, move 67-web-add-by-rss-chips-page.md to
.llm/plans/completed/add-by-rss-parity/.
End without a verification block: report what changed, self-check results, any blocker, and
anything a later prompt needs.
```

## Phase 16

- [x] **68 — Web sidebar, removed list routes, and guidance**

**Cursor model:** Cursor Grok 4.7 · **Reasoning:** medium

```
Read and execute .llm/plans/active/add-by-rss-parity/68-web-sidebar-and-removed-routes.md
Follow 00-EXECUTION-ORDER.md and the operator answers in 00-REQUEST.md.
Edit only the sba parts of localSettings.ts; plan 71 adds bae. Library has no Profiles link;
profiles stay on Browse › Users and at /profiles.
Do not run tests. Append the plan's release scratchpad entry, if it has one.
When the plan is done, move 68-web-sidebar-and-removed-routes.md to
.llm/plans/completed/add-by-rss-parity/.
End without a verification block: report what changed, self-check results, any blocker, and
anything a later prompt needs.
```

## Phase 17

- [x] **40 — Mobile Home lists Add by RSS channels**

**Cursor model:** Cursor Grok 4.7 · **Reasoning:** high

```
Read and execute .llm/plans/active/add-by-rss-parity/40-home-add-by-rss-channels.md
Follow 00-EXECUTION-ORDER.md and the operator answers in 00-REQUEST.md.
Home shows no Needs username and password section. In the tab-stack rule and ADD-BY-RSS.md,
edit only the mobile sentences; plan 68 already rewrote the web ones.
Another prompt may run at the same time; edit only the files your plan lists, and scope any
type-check or formatter to them. Do not run tests. Do not edit release-notes/scratchpad.md: put
the plan's release scratchpad entry, if it has one, in your final message under
"Release notes entry". Prompt 53 appends it.
When the plan is done, move 40-home-add-by-rss-channels.md to
.llm/plans/completed/add-by-rss-parity/.
End without a verification block: report what changed, self-check results, any blocker, and
anything a later prompt needs.
```

- [x] **69 — Web chips pages: Playwright coverage**

**Cursor model:** Cursor Grok 4.7 · **Reasoning:** medium

```
Read and execute .llm/plans/active/add-by-rss-parity/69-web-chips-e2e.md
Follow 00-EXECUTION-ORDER.md and the operator answers in 00-REQUEST.md.
Plan 92 adds a console guard to add-by-rss-auto-parse.spec.ts later; change only that spec's
URL and step lines the plan names. The navbar check expects no #sidebar a[href="/profiles"].
Another prompt may run at the same time; edit only the files your plan lists.
Do not run tests. This plan appends no scratchpad entry.
When the plan is done, move 69-web-chips-e2e.md to
.llm/plans/completed/add-by-rss-parity/.
End without a verification block: report what changed, self-check results, any blocker, and
anything a later prompt needs.
```

## Phase 18

- [x] **41 — Mobile Home Episodes and Tracks include Add by RSS items**

**Cursor model:** Cursor Grok 4.7 · **Reasoning:** high

```
Read and execute .llm/plans/active/add-by-rss-parity/41-home-add-by-rss-items.md
Follow 00-EXECUTION-ORDER.md and the operator answers in 00-REQUEST.md.
Each source keeps its own newest 60; unranked Add by RSS items follow ranked items under
Popularity. Add by RSS track rows get Go to Track; a row tap still plays. Do not wire Mark as
Played, Download, or Share; plan 44 does. Rename fetchHomeFeedRows everywhere the plan lists.
Another prompt may run at the same time; edit only the files your plan lists, and scope any
type-check or formatter to them. Do not run tests. Do not edit release-notes/scratchpad.md: put
the plan's release scratchpad entry, if it has one, in your final message under
"Release notes entry". Prompt 53 appends it.
When the plan is done, move 41-home-add-by-rss-items.md to
.llm/plans/completed/add-by-rss-parity/.
End without a verification block: report what changed, self-check results, any blocker, and
anything a later prompt needs.
```

- [x] **70 — Web background activity store and Add by RSS tracking**

**Cursor model:** Cursor Grok 4.7 · **Reasoning:** high

```
Read and execute .llm/plans/active/add-by-rss-parity/70-web-background-activity-store.md
Follow 00-EXECUTION-ORDER.md and the operator answers in 00-REQUEST.md.
Nothing renders here. The store reports Add by RSS work only.
Another prompt may run at the same time; edit only the files your plan lists.
Do not run tests. This plan appends no scratchpad entry.
When the plan is done, move 70-web-background-activity-store.md to
.llm/plans/completed/add-by-rss-parity/.
End without a verification block: report what changed, self-check results, any blocker, and
anything a later prompt needs.
```

## Phase 19

- [x] **42 — Swipe to unsubscribe on Add by RSS library rows**

**Cursor model:** Cursor Grok 4.7 · **Reasoning:** medium

```
Read and execute .llm/plans/active/add-by-rss-parity/42-add-by-rss-library-swipe.md
Follow 00-EXECUTION-ORDER.md and the operator answers in 00-REQUEST.md.
Needs username and password rows get no swipe.
Do not run tests. Append the plan's release scratchpad entry, if it has one.
When the plan is done, move 42-add-by-rss-library-swipe.md to
.llm/plans/completed/add-by-rss-parity/.
End without a verification block: report what changed, self-check results, any blocker, and
anything a later prompt needs.
```

## Phase 20

- [x] **43 — Grid tiles: hold for the swipe action**

**Cursor model:** Cursor Grok 4.7 · **Reasoning:** medium

```
Read and execute .llm/plans/active/add-by-rss-parity/43-grid-long-press-menu.md
Follow 00-EXECUTION-ORDER.md and the operator answers in 00-REQUEST.md.
The sheet is MoreMenu with the action and Cancel. A Home Downloaded only tile offers Delete All.
Do not run tests. Append the plan's release scratchpad entry, if it has one.
When the plan is done, move 43-grid-long-press-menu.md to
.llm/plans/completed/add-by-rss-parity/.
End without a verification block: report what changed, self-check results, any blocker, and
anything a later prompt needs.
```

## Phase 21

- [x] **44 — Home Episodes and Tracks offer Mark as Played, Download, and Share**

**Cursor model:** Cursor Grok 4.7 · **Reasoning:** high

```
Read and execute .llm/plans/active/add-by-rss-parity/44-home-item-row-actions.md
Follow 00-EXECUTION-ORDER.md and the operator answers in 00-REQUEST.md.
Every Home Episodes and Tracks row, directory and Add by RSS, gets Mark as Played and Download;
directory rows also get Share and Add by RSS rows do not. Keep plan 43's unsubscribeAction. Do
not edit HomeFeedRow.tsx. HomeScreen.tsx is large: Grep the plan's anchors. The Maestro step
asserts the Download control and the More menu's Download entry and taps neither.
Do not run tests. Append the plan's release scratchpad entry, if it has one.
When the plan is done, move 44-home-item-row-actions.md to
.llm/plans/completed/add-by-rss-parity/.
End without a verification block: report what changed, self-check results, any blocker, and
anything a later prompt needs.
```

## Phase 22

- [x] **71 — Web background activity overlay**

**Cursor model:** Cursor Grok 4.7 · **Reasoning:** high

```
Read and execute .llm/plans/active/add-by-rss-parity/71-web-background-activity-overlay.md
Follow 00-EXECUTION-ORDER.md and the operator answers in 00-REQUEST.md.
Collapsed by default, remembered in bae, above the player plus the 28px strip, z-index 150,
hidden for accounts with no Add by RSS follows. Edit only the bae parts of localSettings.ts.
Keep plan 69's line in e2e-spec-order-web.txt.
Do not run tests. Append the plan's release scratchpad entry, if it has one.
When the plan is done, move 71-web-background-activity-overlay.md to
.llm/plans/completed/add-by-rss-parity/.
End without a verification block: report what changed, self-check results, any blocker, and
anything a later prompt needs.
```

## Phase 23

- [x] **92 — Web follow syncs never collide on the feed URL index**

**Cursor model:** Cursor Grok 4.7 · **Reasoning:** extra high

```
Read and execute .llm/plans/active/add-by-rss-parity/92-web-add-by-rss-stub-insert.md
Follow 00-EXECUTION-ORDER.md and the operator answers in 00-REQUEST.md.
Leave plan 70's trackBackgroundActivity wrapper in sync.ts as it is. Keep plan 69's URL and step
lines in add-by-rss-auto-parse.spec.ts.
Do not run tests. Append the plan's release scratchpad entry, if it has one.
When the plan is done, move 92-web-add-by-rss-stub-insert.md to
.llm/plans/completed/add-by-rss-parity/.
End without a verification block: report what changed, self-check results, any blocker, and
anything a later prompt needs.
```

## Phase 24

- [x] **50 — Player item title opens the channel, then the item**

**Cursor model:** Cursor Grok 4.7 · **Reasoning:** high

```
Read and execute .llm/plans/active/add-by-rss-parity/50-player-item-title-stack.md
Follow 00-EXECUTION-ORDER.md and the operator answers in 00-REQUEST.md.
The channel title link and the Home versus Browse choice stay as they are. Add by RSS titles
stay unlinked here; plan 51 links episodes, plan 39 tracks, and plan 52 livestreams. Keep the
getChannelActionChrome follow check in openLinkedContent; plan 53 relies on it.
Do not run tests. Append the plan's release scratchpad entry, if it has one.
When the plan is done, move 50-player-item-title-stack.md to
.llm/plans/completed/add-by-rss-parity/.
End without a verification block: report what changed, self-check results, any blocker, and
anything a later prompt needs.
```

## Phase 25

- [x] **51 — Add by RSS episode title uses the player stack**

**Cursor model:** Cursor Grok 4.7 · **Reasoning:** high

```
Read and execute .llm/plans/active/add-by-rss-parity/51-player-add-by-rss-episode-link.md
Follow 00-EXECUTION-ORDER.md and the operator answers in 00-REQUEST.md.
Music titles, livestreams, and items this device cannot match stay plain text here; plan 39
links Add by RSS tracks and plan 52 links Add by RSS livestreams later.
Do not run tests. Append the plan's release scratchpad entry, if it has one.
When the plan is done, move 51-player-add-by-rss-episode-link.md to
.llm/plans/completed/add-by-rss-parity/.
End without a verification block: report what changed, self-check results, any blocker, and
anything a later prompt needs.
```

## Phase 26

- [x] **39 — Add by RSS track page: Lyrics, player title link, and device proof**

**Cursor model:** Cursor Grok 4.7 · **Reasoning:** high

```
Read and execute .llm/plans/active/add-by-rss-parity/39-add-by-rss-track-lyrics-and-player-link.md
Follow 00-EXECUTION-ORDER.md and the operator answers in 00-REQUEST.md.
Register add-by-rss-track in scripts/mobile/e2e-test.sh after add-by-rss-episode-sections. The
API fixture is E2E-only. Do not link livestream titles here; plan 52 does that later.
Do not run tests. Append the plan's release scratchpad entry, if it has one.
When the plan is done, move 39-add-by-rss-track-lyrics-and-player-link.md to
.llm/plans/completed/add-by-rss-parity/.
End without a verification block: report what changed, self-check results, any blocker, and
anything a later prompt needs.
```

## Phase 27

- [x] **90 — A playing Add by RSS row shows pause and progress**

**Cursor model:** Cursor Grok 4.7 · **Reasoning:** extra high

```
Read and execute .llm/plans/active/add-by-rss-parity/90-add-by-rss-playing-row.md
Follow 00-EXECUTION-ORDER.md and the operator answers in 00-REQUEST.md.
addByRssPlaybackMediaId feeds both playbackTargetRowMediaId and idTextFromTarget; they must stay
equal. Compute playbackMediaId when data loads, never during render.
Do not run tests. Append the plan's release scratchpad entry, if it has one.
When the plan is done, move 90-add-by-rss-playing-row.md to
.llm/plans/completed/add-by-rss-parity/.
End without a verification block: report what changed, self-check results, any blocker, and
anything a later prompt needs.
```

## Phase 28

- [x] **91 — The full player marks Add by RSS items played and unplayed**

**Cursor model:** Cursor Grok 4.7 · **Reasoning:** high

```
Read and execute .llm/plans/active/add-by-rss-parity/91-full-player-add-by-rss-mark-played.md
Follow 00-EXECUTION-ORDER.md and the operator answers in 00-REQUEST.md.
No API change. Queue Next and Queue Last never appear on the full player, for any item.
FullPlayerScreen.tsx is large: Grep the plan's anchors.
Do not run tests. Append the plan's release scratchpad entry, if it has one.
When the plan is done, move 91-full-player-add-by-rss-mark-played.md to
.llm/plans/completed/add-by-rss-parity/.
End without a verification block: report what changed, self-check results, any blocker, and
anything a later prompt needs.
```

## Phase 29

- [x] **93 — Now-playing chapters and transcript for Add by RSS items**

**Cursor model:** Cursor Grok 4.7 · **Reasoning:** extra high

```
Read and execute .llm/plans/active/add-by-rss-parity/93-add-by-rss-now-playing-chapters.md
Follow 00-EXECUTION-ORDER.md and the operator answers in 00-REQUEST.md.
The store is cleared on sign-out and nothing is persisted. No player component gains an Add by
RSS branch. PlaybackProvider.tsx is large: Grep const resolveChaptersForTarget.
Do not run tests. Append the plan's release scratchpad entry, if it has one.
When the plan is done, move 93-add-by-rss-now-playing-chapters.md to
.llm/plans/completed/add-by-rss-parity/.
End without a verification block: report what changed, self-check results, any blocker, and
anything a later prompt needs.
```

## Phase 30

- [x] **94 — Full player: Add by RSS Summary, Chapters, Transcript, and People**

**Cursor model:** Cursor Grok 4.7 · **Reasoning:** extra high

```
Read and execute .llm/plans/active/add-by-rss-parity/94-full-player-add-by-rss-sections.md
Follow 00-EXECUTION-ORDER.md and the operator answers in 00-REQUEST.md.
Livestreams keep no sections. Feeds this device has not parsed get no Chapters or Transcript; a
time in Summary seeks playback; music feeds use the episode chip labels. FullPlayerScreen.tsx is
large: Grep the plan's anchors; plans 50, 51, 90, and 91 moved lines.
Do not run tests. Append the plan's release scratchpad entry, if it has one.
When the plan is done, move 94-full-player-add-by-rss-sections.md to
.llm/plans/completed/add-by-rss-parity/.
End without a verification block: report what changed, self-check results, any blocker, and
anything a later prompt needs.
```

## Phase 31

Start Docker before this prompt.

- [x] **80 — Channel "may have livestreams" flag (server)**

**Cursor model:** Cursor Grok 4.7 · **Reasoning:** extra high

```
Read and execute .llm/plans/active/add-by-rss-parity/80-channel-may-have-livestreams.md
Follow 00-EXECUTION-ORDER.md and the operator answers in 00-REQUEST.md.
The flag never changes a channel's medium. Use the next unused app migration number (0021
unless the tree moved on) and move every readiness marker to it. Run make
db_regen_linear_baseline and make db_verify_linear_baseline yourself. If Docker is not
available, finish the rest of the plan, leave the archives untouched, and report BLOCKED asking
the operator to start Docker.
Do not run tests. Append the plan's release scratchpad entry, if it has one.
When the plan is done, move 80-channel-may-have-livestreams.md to
.llm/plans/completed/add-by-rss-parity/.
End without a verification block: report what changed, self-check results, any blocker, and
anything a later prompt needs.
```

## Phase 32

- [x] **81 — Upcoming livestreams endpoints**

**Cursor model:** Cursor Grok 4.7 · **Reasoning:** high

```
Read and execute .llm/plans/active/add-by-rss-parity/81-upcoming-livestreams-endpoint.md
Follow 00-EXECUTION-ORDER.md and the operator answers in 00-REQUEST.md.
Live now first, then scheduled; no ended items. Add the OpenAPI paths and API integration cases.
Do not run tests. Append the plan's release scratchpad entry, if it has one.
When the plan is done, move 81-upcoming-livestreams-endpoint.md to
.llm/plans/completed/add-by-rss-parity/.
End without a verification block: report what changed, self-check results, any blocker, and
anything a later prompt needs.
```

## Phase 33

- [x] **82 — Add by RSS "may have livestreams" flag (web and mobile devices)**

**Cursor model:** Cursor Grok 4.7 · **Reasoning:** extra high

```
Read and execute .llm/plans/active/add-by-rss-parity/82-add-by-rss-may-have-livestreams.md
Follow 00-EXECUTION-ORDER.md and the operator answers in 00-REQUEST.md.
Use the next free mobile SQLite migration (24 unless the tree moved on). The flag is sticky:
once set it stays set (dto-changes-are-device-data-migrations). It sits beside resourceType and
never changes it. Keep plan 37's upsertFeed resource-type line.
Do not run tests. Append the plan's release scratchpad entry, if it has one.
When the plan is done, move 82-add-by-rss-may-have-livestreams.md to
.llm/plans/completed/add-by-rss-parity/.
End without a verification block: report what changed, self-check results, any blocker, and
anything a later prompt needs.
```

## Phase 34

- [x] **88 — Livestreams are not an Add by RSS feed type**

**Cursor model:** Cursor Grok 4.7 · **Reasoning:** extra high

```
Read and execute .llm/plans/active/add-by-rss-parity/88-add-by-rss-livestreams-not-a-feed-type.md
Follow 00-EXECUTION-ORDER.md and the operator answers in 00-REQUEST.md.
A stored unknown type reads as podcasts; no IndexedDB or SQLite migration. Delete the four
feed-level web livestream components; keep the item-level ones plan 84 uses and the live-item
lists on web's Add by RSS feed pages (plan 96 reorders them later).
Do not run tests. Append the plan's release scratchpad entry, if it has one.
When the plan is done, move 88-add-by-rss-livestreams-not-a-feed-type.md to
.llm/plans/completed/add-by-rss-parity/.
End without a verification block: report what changed, self-check results, any blocker, and
anything a later prompt needs.
```

## Phase 35

- [x] **83 — Web Livestreams chip on Browse and Subscribed**

**Cursor model:** Cursor Grok 4.7 · **Reasoning:** high

```
Read and execute .llm/plans/active/add-by-rss-parity/83-web-livestreams-chip.md
Follow 00-EXECUTION-ORDER.md and the operator answers in 00-REQUEST.md.
One chip for every medium, right after Tracks, with no sort, range, category, or view controls.
Leave ADD_BY_RSS_CHIPS alone; plan 84 adds livestreams there.
Do not run tests. Append the plan's release scratchpad entry, if it has one.
When the plan is done, move 83-web-livestreams-chip.md to
.llm/plans/completed/add-by-rss-parity/.
End without a verification block: report what changed, self-check results, any blocker, and
anything a later prompt needs.
```

## Phase 36

- [x] **84 — Web Add by RSS livestreams: Subscribed merge and the Add by RSS chip**

**Cursor model:** Cursor Grok 4.7 · **Reasoning:** high

```
Read and execute .llm/plans/active/add-by-rss-parity/84-web-add-by-rss-livestreams.md
Follow 00-EXECUTION-ORDER.md and the operator answers in 00-REQUEST.md.
Read only feeds whose device flag from plan 82 is set, across ADD_BY_RSS_RESOURCE_TYPES, never by
a resource type. Subscribed merges Add by RSS livestreams into page 1 only. A flagged feed stays
on its medium's chip. The chip stays upcoming-only.
Do not run tests. Append the plan's release scratchpad entry, if it has one.
When the plan is done, move 84-web-add-by-rss-livestreams.md to
.llm/plans/completed/add-by-rss-parity/.
End without a verification block: report what changed, self-check results, any blocker, and
anything a later prompt needs.
```

## Phase 37

- [x] **85 — Mobile livestream rows and the Browse Livestreams chip**

**Cursor model:** Cursor Grok 4.7 · **Reasoning:** high

```
Read and execute .llm/plans/active/add-by-rss-parity/85-mobile-livestream-rows-and-browse.md
Follow 00-EXECUTION-ORDER.md and the operator answers in 00-REQUEST.md.
Make HomeFeedRow.onQueuePress optional; plans 86 and 95 rely on it. A livestream row's More
offers Share only. Compare Add by RSS playback ids through addByRssPlaybackMediaId. Keep
liveStatusId and lib/rows/liveItemRows.ts as the plan names them; plans 95 and 97 build on them.
Do not run tests. Append the plan's release scratchpad entry, if it has one.
When the plan is done, move 85-mobile-livestream-rows-and-browse.md to
.llm/plans/completed/add-by-rss-parity/.
End without a verification block: report what changed, self-check results, any blocker, and
anything a later prompt needs.
```

## Phase 38

- [x] **89 — Mobile Add by RSS livestream page**

**Cursor model:** Cursor Grok 4.7 · **Reasoning:** high

```
Read and execute .llm/plans/active/add-by-rss-parity/89-add-by-rss-livestream-detail.md
Follow 00-EXECUTION-ORDER.md and the operator answers in 00-REQUEST.md.
Play only while live; no More actions and no Share. Do not link livestream titles in the full
player; plan 52 does that later and rewrites the doc comment then. navigation/index.tsx is
large: Grep AddByRssEpisodeDetail.
Do not run tests. Append the plan's release scratchpad entry, if it has one.
When the plan is done, move 89-add-by-rss-livestream-detail.md to
.llm/plans/completed/add-by-rss-parity/.
End without a verification block: report what changed, self-check results, any blocker, and
anything a later prompt needs.
```

## Phase 39

- [x] **86 — Mobile Home and Add by RSS library Livestreams chips**

**Cursor model:** Cursor Grok 4.7 · **Reasoning:** high

```
Read and execute .llm/plans/active/add-by-rss-parity/86-mobile-home-and-library-livestreams.md
Follow 00-EXECUTION-ORDER.md and the operator answers in 00-REQUEST.md.
The home-livestreams job runs in the sync queue behind the indicator (mobile-sync-orchestration).
Rows get no Queue, Add to Playlist, Mark as Played, or Download. Home's directory rows offer
Share; Add by RSS rows, live or scheduled, open plan 89's page. Keep directoryItemsById on
HomeFeedRead. Plan 95 later splits toAddByRssLiveRows in lib/addByRss/liveRows.ts and reuses it.
Do not run tests. Append the plan's release scratchpad entry, if it has one.
When the plan is done, move 86-mobile-home-and-library-livestreams.md to
.llm/plans/completed/add-by-rss-parity/.
End without a verification block: report what changed, self-check results, any blocker, and
anything a later prompt needs.
```

## Phase 40

- [x] **95 — Livestreams on the mobile Add by RSS feed page**

**Cursor model:** Cursor Grok 4.7 · **Reasoning:** extra high

```
Read and execute .llm/plans/active/add-by-rss-parity/95-add-by-rss-feed-page-livestreams.md
Follow 00-EXECUTION-ORDER.md and the operator answers in 00-REQUEST.md.
Live, scheduled, and recently ended rows sit above Episodes or Tracks in the channel order from
compareChannelLiveItems; getManyByChannel keeps its exact output. Rows open plan 89's page, play
only while live, and have no More. Use the test ids add-by-rss-home-live-${row.id} and
add-by-rss-home-play-live-${row.id}; plan 87 relies on them. Episode rows keep their own index.
Add no Scheduled or Ended word; plan 97 does that. No web change; plan 96 reorders web's lists.
Do not run tests. Append the plan's release scratchpad entry, if it has one.
When the plan is done, move 95-add-by-rss-feed-page-livestreams.md to
.llm/plans/completed/add-by-rss-parity/.
End without a verification block: report what changed, self-check results, any blocker, and
anything a later prompt needs.
```

## Phase 41

- [x] **87 — Livestreams E2E (Playwright and Maestro)**

**Cursor model:** Cursor Grok 4.7 · **Reasoning:** medium

```
Read and execute .llm/plans/active/add-by-rss-parity/87-livestreams-e2e.md
Follow 00-EXECUTION-ORDER.md and the operator answers in 00-REQUEST.md.
Register add-by-rss-livestream in scripts/mobile/e2e-test.sh after add-by-rss-episode-sections
(and after add-by-rss-track if plan 39 put it there). Confirm plan 95's row and play test ids in
AddByRssEpisodesSection.tsx before writing step 7. Keep the add-by-rss-livestream-playing
screenshot name; plan 52 inserts its steps right after it. The Add by RSS Playwright test clicks
the Podcasts chip after the Livestreams step. Plan 96 later extends PARSED_FEED's
podcastLiveItems in media-list-chips.spec.ts, and plan 97 adds asserts to step 7.
Do not run tests. This plan appends no scratchpad entry.
When the plan is done, move 87-livestreams-e2e.md to
.llm/plans/completed/add-by-rss-parity/.
End without a verification block: report what changed, self-check results, any blocker, and
anything a later prompt needs.
```

## Phase 42

- [x] **96 — Web Add by RSS feed pages use the channel livestream order**

**Cursor model:** Cursor Grok 4.7 · **Reasoning:** high

```
Read and execute .llm/plans/active/add-by-rss-parity/96-web-add-by-rss-channel-live-order.md
Follow 00-EXECUTION-ORDER.md and the operator answers in 00-REQUEST.md.
Web only. Import plan 95's compareChannelLiveItems and isLiveItemEndedAndStale from
@podverse/helpers; do not edit liveItemVisibility.ts or filter inside
buildAddByRSSLivestreamIndex. The sort control still orders episodes, tracks, and albums only,
and the Livestreams chip stays upcoming-only. Extend plan 87's PARSED_FEED in
media-list-chips.spec.ts; add no spec file.
Do not run tests. Append the plan's release scratchpad entry.
When the plan is done, move 96-web-add-by-rss-channel-live-order.md to
.llm/plans/completed/add-by-rss-parity/.
End without a verification block: report what changed, self-check results, any blocker, and
anything a later prompt needs.
```

## Phase 43

- [x] **97 — Scheduled and Ended on mobile livestream rows inside a channel**

**Cursor model:** Cursor Grok 4.7 · **Reasoning:** medium

```
Read and execute .llm/plans/active/add-by-rss-parity/97-mobile-channel-live-status-label.md
Follow 00-EXECUTION-ORDER.md and the operator answers in 00-REQUEST.md.
Mobile only. A neutral Badge starts the date line only when the context line is hidden; Live
keeps its danger badge. Keep plan 10's, 85's, and 90's edits in HomeFeedRow.tsx. Scheduled and
ended rows keep today's play and tap behavior. No i18n, vitest.config.ts, DTO, or API change.
In e2e/add-by-rss-livestream.yaml add only the two asserts in step 7; plan 52 inserts its steps
after step 5 later.
Do not run tests. Append the plan's release scratchpad entry.
When the plan is done, move 97-mobile-channel-live-status-label.md to
.llm/plans/completed/add-by-rss-parity/.
End without a verification block: report what changed, self-check results, any blocker, and
anything a later prompt needs.
```

## Phase 44

- [x] **52 — Full player livestream titles open the livestream page**

**Cursor model:** Cursor Grok 4.7 · **Reasoning:** medium

```
Read and execute .llm/plans/active/add-by-rss-parity/52-player-livestream-title-link.md
Follow 00-EXECUTION-ORDER.md and the operator answers in 00-REQUEST.md.
Directory livestream titles already open EpisodeDetail; only strengthen that unit assertion. No
restyle, no new catalog key, no web change. Leave the livestream channel link on the podcast
page; plan 53 opens an album feed's channel line on the album. Insert the player round trip into
e2e/add-by-rss-livestream.yaml directly after the add-by-rss-livestream-playing screenshot, and
leave plan 97's step 7 asserts as they are.
FullPlayerScreen.tsx and navigation/index.tsx are large: Grep the plan's anchors.
Do not run tests. Append the plan's release scratchpad entry.
When the plan is done, move 52-player-livestream-title-link.md to
.llm/plans/completed/add-by-rss-parity/.
End without a verification block: report what changed, self-check results, any blocker, and
anything a later prompt needs. Plan 53 runs next and closes the set.
```

## Phase 45

- [x] **53 — Album livestream channel line opens the album, then archive the set**

**Cursor model:** Cursor Grok 4.7 · **Reasoning:** medium

```
Read and execute .llm/plans/active/add-by-rss-parity/53-player-album-livestream-channel-link.md
Follow 00-EXECUTION-ORDER.md and the operator answers in 00-REQUEST.md.
Album mediums are Music and MusicL (isAlbumMediumId). Publisher feeds stay on the podcast page.
Do not call musicChannelKind or getChannelRouteKind. Do not edit FullPlayerScreen.tsx or
navigation/index.tsx: confirm case 'album' and the existing follow check, then stop BLOCKED if
either is missing. No Maestro flow, no web change, no new catalog key.
Do not run tests. Append the plan's release scratchpad entry.

Before your own entry, append to release-notes/scratchpad.md every "Release notes entry" from
the final messages of prompts 10, 20, 21, 63, 64, 65, 40, and 41 in
.artifacts/plan-runner/add-by-rss-parity/ (10.md, 20.md, …), in that order, unchanged. Skip one
that already appears in the scratchpad.

Then close the set. Confirm every other numbered plan is in
.llm/plans/completed/add-by-rss-parity/. Move 53-player-album-livestream-channel-link.md,
00-REQUEST.md, 00-SUMMARY.md, 00-EXECUTION-ORDER.md, and COPY-PASTA.md there, and remove the
empty active directory. If any earlier prompt reported the linear baseline archive was not
regenerated, put make db_regen_linear_baseline first in the Root block.

End with the cumulative verification for the whole set, assuming no earlier prompt was tested.
One fenced bash block per tab, fish-safe, labeled with the tab name. Tell the operator that
Docker, Mobile E2E Metro, Mobile E2E API, Mobile E2E test-assets, and Mobile E2E iOS or Mobile
E2E Android must be running, and that Mobile E2E API must be restarted after the package build
so it serves the upcoming livestream endpoints and the Add by RSS sections, music, and live
fixtures. Do not put leave-running commands in the blocks. Note that the plan 41 Home Episodes
Maestro step assumes the fixture episode is among the 60 newest Add by RSS items; if it fails,
that step is the suspect.

Root:
npm run i18n:compile
npm run i18n:validate
npm run build:packages
npm run lint
npm run type-check
npm run test:unit
npm --prefix apps/mobile run test
make db_verify_linear_baseline
make test_deps
npm run test:e2e:api
kustomize build --load-restrictor LoadRestrictionsNone infra/k8s/base/api
kustomize build --load-restrictor LoadRestrictionsNone infra/k8s/base/db
kustomize build --load-restrictor LoadRestrictionsNone infra/k8s/base/ops
kustomize build --load-restrictor LoadRestrictionsNone infra/k8s/base/web
make e2e_test_report
open .artifacts/e2e-reports/latest/index.html

Mobile Maestro:
npm run mobile:e2e:test -- add-by-rss,add-by-rss-credentials,add-by-rss-episode-sections,add-by-rss-track,add-by-rss-livestream,podcast-episode,track,album,player-screen,subscriptions-anonymous,browse,home
open .artifacts/mobile-e2e-reports/latest/failures.json
open .artifacts/mobile-e2e-reports/latest/ios-phone/index.html
open .artifacts/mobile-e2e-reports/latest/android-phone/index.html
```

- [ ] **abcaicast** (optional)

After this set, do you want an abcaicast for this work?
