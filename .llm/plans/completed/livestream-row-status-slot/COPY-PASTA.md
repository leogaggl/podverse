# Livestream status badge in the duration slot — COPY-PASTA

How to use:

1. Select **Cursor model** and **Reasoning** in the Cursor UI (the line above each fence).
1. Copy the fenced block only, paste, and the agent runs it.
1. Tick the box when that prompt is done.

Request and settled review answers: [00-REQUEST.md](./00-REQUEST.md). Ledger:
[00-SUMMARY.md](./00-SUMMARY.md). Order and file ownership:
[00-EXECUTION-ORDER.md](./00-EXECUTION-ORDER.md).

**Run the set unattended (Root tab, in this worktree):**
`./scripts/abcplan/run.sh run livestream-row-status-slot`. It runs one fresh agent per prompt on
that prompt's model, stops at the first blocker, and resumes with
`./scripts/abcplan/run.sh run livestream-row-status-slot --resume 'Your answer.'`. The script
passes `--parallel`, so every prompt under one phase heading runs at once. Prompts under one
heading share no file, and none of them writes the release scratchpad: each puts its entry in its
final message, and Close appends them. Running them one after the other is also correct.

**Optional — one chat runs the whole set:** paste
`Orchestrate .llm/plans/active/livestream-row-status-slot/ with .cursor/prompts/plan-orchestrator.md.`
(Cursor Grok 4.7 · medium). It stops at the first blocker. Use the prompts below instead when
you want to read each result before the next prompt starts.

Phases run in order; prompts inside a phase run at once.

| Phase | Prompts | Model and reasoning |
| --- | --- | --- |
| 1 | 10, 20 | Cursor Grok 4.7 high |
| 1 | 11, 21, 30 | Cursor Grok 4.7 medium |
| 2 | 23 | Cursor Grok 4.7 high |
| 2 | 22 | Cursor Grok 4.7 medium |
| 3 | Close | Cursor Grok 4.7 low |

Every prompt is Cursor Grok 4.7: each follows an existing pattern with every choice settled in
its plan. 10, 20, and 23 run at high because they change UI across several files (20 also edits
the shared mobile row and three Maestro flows; 23 adds a tested row builder and a second row
branch). 11, 21, 22, and 30 are small changes in one or two files plus a test. Fast stays off.

If a Cursor Grok 4.7 prompt stalls or makes the same mistake twice, rerun it one reasoning level
higher (after extra high, **Codex 5.3 · high**), and record the change on the prompt here.

## Phase 1

Five prompts at once. Each owns only the files its plan lists (see 00-EXECUTION-ORDER.md
§ Phase 1). 10 and 11 are web; 20 and 21 are mobile; 30 is the parser. They share no file.

- [x] **10 — Web livestream rows: status badge before the date**

**Cursor model:** Cursor Grok 4.7 · **Reasoning:** high

```
Read and execute .llm/plans/active/livestream-row-status-slot/10-web-livestream-row-status-slot.md
Follow 00-EXECUTION-ORDER.md and the settled answers in 00-REQUEST.md (D1, D2, D7, D8).
You own ListLiveItemRow.tsx, AddByRSSLivestreamRow.tsx, ListLiveItemRow.module.scss, and
apps/web/e2e/media-list-chips.spec.ts. Keep the visible order (Play on Live only, then the badge,
then the date and start–end time); add the test ids live-item-row-date and live-item-row-status.
Do not edit EmbedListRow or any mobile file.
Another prompt runs at the same time; edit only the files your plan lists, scope any type-check
or formatter to them, and do not rebuild shared packages. Report errors in files you do not own
instead of fixing them. Do not run tests. The plan has no release scratchpad entry.
When the plan is done, move 10-web-livestream-row-status-slot.md to
.llm/plans/completed/livestream-row-status-slot/.
End without a verification block: report what changed, self-check results, any blocker, and
anything a later prompt needs.
```

- [x] **11 — Embed list row: Live badge before the date**

**Cursor model:** Cursor Grok 4.7 · **Reasoning:** medium

```
Read and execute .llm/plans/active/livestream-row-status-slot/11-web-embed-list-row-live-slot.md
Follow 00-EXECUTION-ORDER.md and the settled answers in 00-REQUEST.md (D1, D3, D7).
You own EmbedListRow.tsx, EmbedListRow.module.scss, and
apps/web/src/components/embed/__tests__/EmbedListRow.test.tsx. Do not edit ListLiveItemRow,
AddByRSSLivestreamRow, their stylesheet, or any mobile file.
Another prompt runs at the same time; edit only the files your plan lists, scope any type-check
or formatter to them, and do not rebuild shared packages. Report errors in files you do not own
instead of fixing them. Do not run tests. Do not edit release-notes/scratchpad.md even though the
plan lists it: put the plan's release scratchpad entry in your final message under "Release
notes entry". Close appends it.
When the plan is done, move 11-web-embed-list-row-live-slot.md to
.llm/plans/completed/livestream-row-status-slot/.
End without a verification block: report what changed, self-check results, any blocker, and
anything a later prompt needs.
```

- [x] **20 — Mobile livestream item rows: status badge in the duration slot**

**Cursor model:** Cursor Grok 4.7 · **Reasoning:** high

```
Read and execute .llm/plans/active/livestream-row-status-slot/20-mobile-status-in-duration-slot.md
Follow 00-EXECUTION-ORDER.md and the settled answers in 00-REQUEST.md (D4, D5, D7, D8, E1, E2).
You own homeFeedRowLiveStatus.ts and its test (new), HomeFeedRow.tsx, MediaRowActions.tsx,
homeFeedData.ts, .cursor/rules/mobile-screen-layout.mdc,
.cursor/skills/mobile-reusable-components/SKILL.md, and the Maestro flows
add-by-rss-livestream.yaml, browse.yaml, and home.yaml. Other callers of MediaRowActions must
render as before. Do not edit liveItemRows.ts, liveRows.ts, PodcastEpisodesSection.tsx, or
AlbumDetailScreen.tsx: prompt 21 edits them at the same time.
Another prompt runs at the same time; edit only the files your plan lists, scope any type-check
or formatter to them, and do not rebuild shared packages. Report errors in files you do not own
instead of fixing them. Do not run tests. Do not edit release-notes/scratchpad.md: put the
plan's release scratchpad entry in your final message under "Release notes entry". Close
appends it.
When the plan is done, move 20-mobile-status-in-duration-slot.md to
.llm/plans/completed/livestream-row-status-slot/.
End without a verification block: report what changed, self-check results, any blocker, and
anything a later prompt needs.
```

- [x] **21 — Mobile livestream rows inside a channel: date from the start time**

**Cursor model:** Cursor Grok 4.7 · **Reasoning:** medium

```
Read and execute .llm/plans/active/livestream-row-status-slot/21-mobile-live-row-start-date.md
Follow 00-EXECUTION-ORDER.md and the settled answers in 00-REQUEST.md (D9, D10).
You own liveItemRows.ts and liveItemRows.test.ts, liveRows.ts and liveRows.test.ts,
PodcastEpisodesSection.tsx, and AlbumDetailScreen.tsx. Prompts 22 and 23 build on your
toChannelLiveRow signature (the start time as its third parameter); keep it exactly as the plan
states. Do not edit HomeFeedRow.tsx, MediaRowActions.tsx, homeFeedData.ts, or any Maestro flow:
prompt 20 edits them at the same time.
Another prompt runs at the same time; edit only the files your plan lists, scope any type-check
or formatter to them, and do not rebuild shared packages. Report errors in files you do not own
instead of fixing them. Do not run tests. Do not edit release-notes/scratchpad.md: put the
plan's release scratchpad entry in your final message under "Release notes entry". Close
appends it.
When the plan is done, move 21-mobile-live-row-start-date.md to
.llm/plans/completed/livestream-row-status-slot/.
End without a verification block: report what changed, self-check results, any blocker, and
anything a later prompt needs.
```

- [x] **30 — A liveItem without a status is not saved**

**Cursor model:** Cursor Grok 4.7 · **Reasoning:** medium

```
Read and execute .llm/plans/active/livestream-row-status-slot/30-parser-live-item-requires-status.md
Follow 00-EXECUTION-ORDER.md and the settled answers in 00-REQUEST.md (E3).
You own compatLiveItemsDtos and its new test, handleParsedLiveItems, and the new
liveItemArchive helper and its test. Do not edit mobile, web, or API files.
Another prompt runs at the same time; edit only the files your plan lists, scope any type-check
or formatter to them, and do not rebuild shared packages. Report errors in files you do not own
instead of fixing them. Do not run tests. Do not edit release-notes/scratchpad.md: put the
plan's release scratchpad entry in your final message under "Release notes entry". Close
appends it.
When the plan is done, move 30-parser-live-item-requires-status.md to
.llm/plans/completed/livestream-row-status-slot/.
End without a verification block: report what changed, self-check results, any blocker, and
anything a later prompt needs.
```

## Phase 2

Two prompts at once, both building on prompt 21's `toChannelLiveRow`. 22 owns the row builder and
the podcast list's comments; 23 owns the album screen and its new row builder.

- [x] **22 — Mobile channel livestream rows: only Live can start from the list**

**Cursor model:** Cursor Grok 4.7 · **Reasoning:** medium

```
Read and execute .llm/plans/active/livestream-row-status-slot/22-mobile-channel-live-rows-play-only-live.md
Follow 00-EXECUTION-ORDER.md and the settled answers in 00-REQUEST.md (D8, E3). Implement the
plan's Decisions as written. Share-only More menus are prompt 20's HomeFeedRow change.
You own liveItemRows.ts, liveItemRows.test.ts, and PodcastEpisodesSection.tsx (comments only).
Build on toChannelLiveRow as prompt 21 left it; read
.artifacts/plan-runner/livestream-row-status-slot/21.md if its signature differs from the plan.
Do not edit AlbumDetailScreen.tsx or albumTrackRows.ts: prompt 23 edits them at the same time.
Another prompt runs at the same time; edit only the files your plan lists, scope any type-check
or formatter to them, and do not rebuild shared packages. Report errors in files you do not own
instead of fixing them. Do not run tests. Do not edit release-notes/scratchpad.md: put the
plan's release scratchpad entry in your final message under "Release notes entry". Close
appends it.
When the plan is done, move 22-mobile-channel-live-rows-play-only-live.md to
.llm/plans/completed/livestream-row-status-slot/.
End without a verification block: report what changed, self-check results, any blocker, and
anything a later prompt needs.
```

- [x] **23 — Mobile album livestreams use the podcast livestream row**

**Cursor model:** Cursor Grok 4.7 · **Reasoning:** high

```
Read and execute .llm/plans/active/livestream-row-status-slot/23-mobile-album-livestream-episode-row.md
Follow 00-EXECUTION-ORDER.md and the settled answers in 00-REQUEST.md (D6, D8, D9, D10, E1).
Implement the plan's Decisions as written. The album livestream More menu is Share only.
You own albumTrackRows.ts and albumTrackRows.test.ts (both new) and AlbumDetailScreen.tsx. Call
toChannelLiveRow as prompt 21 left it; read
.artifacts/plan-runner/livestream-row-status-slot/21.md if its signature differs from the plan.
Render through HomeFeedRow with its existing props; do not edit HomeFeedRow.tsx,
MediaRowActions.tsx, liveItemRows.ts, or PodcastEpisodesSection.tsx (prompt 22 edits the last
two at the same time). The player does not change.
Another prompt runs at the same time; edit only the files your plan lists, scope any type-check
or formatter to them, and do not rebuild shared packages. Report errors in files you do not own
instead of fixing them. Do not run tests. Do not edit release-notes/scratchpad.md: put the
plan's release scratchpad entry in your final message under "Release notes entry". Close
appends it.
When the plan is done, move 23-mobile-album-livestream-episode-row.md to
.llm/plans/completed/livestream-row-status-slot/.
End without a verification block: report what changed, self-check results, any blocker, and
anything a later prompt needs.
```

## Phase 3

- [x] **Close — release entries, archive the set, cumulative verification**

**Cursor model:** Cursor Grok 4.7 · **Reasoning:** low

```
Close the plan set .llm/plans/active/livestream-row-status-slot/.
Change no product, test, or guidance code. Do not run tests.

Append to the end of release-notes/scratchpad.md every "Release notes entry" from the final
messages of prompts 11, 20, 21, 22, 23, and 30 in
.artifacts/plan-runner/livestream-row-status-slot/
(11.md, 20.md, 21.md, 22.md, 23.md, 30.md), in that order, unchanged, one blank line between
entries.
Skip an entry whose title already appears in the scratchpad. When a final message has no entry,
use the ## Release scratchpad block of that plan in
.llm/plans/completed/livestream-row-status-slot/. Plan 10 has no entry. Never edit or remove
another change's entry.

Grep every final message in .artifacts/plan-runner/livestream-row-status-slot/ for blockers and
for errors reported in files the prompt did not own, and list them in your final message.

Confirm 10, 11, 20, 21, 22, 23, and 30 are in .llm/plans/completed/livestream-row-status-slot/.
If one is still in active/, stop and report BLOCKED naming it. Then move 00-REQUEST.md,
00-SUMMARY.md,
00-EXECUTION-ORDER.md, and COPY-PASTA.md there, and remove the empty active directory.

End with the cumulative verification for the whole set, assuming no earlier prompt was tested.
One fenced bash block per tab, fish-safe, labeled with the tab name, all run in the
../podverse_feature_livestream_row_status_slot worktree. Tell the operator that Docker must be
running for the web report, and that for the Mobile Maestro block Mobile E2E Metro, Mobile E2E
API, Mobile E2E test-assets, and Mobile E2E iOS or Mobile E2E Android must already be running
from the worktree. Do not put leave-running commands in the blocks. Note that there is no
dependency change, so no lockfile step, and no catalog change, so no i18n compile; that no Maestro
flow covers album livestreams (the E2E seed has no music-medium live item), so a device look at an
album with a livestream is the only visual check for prompt 23; and that the main checkout's
.llm/plans/active/abcplan-livestream-row-status-slot/ can be deleted by hand if it still exists.

Root:
npm run build:packages
npm run lint
npm run type-check -w apps/web
npm run test -w apps/web
npm run test -w @podverse/parser-mapping
npm run test -w @podverse/parser
make e2e_test_web_report_spec SPEC=e2e/media-list-chips.spec.ts,e2e/embed-routes.spec.ts
open .artifacts/e2e-reports/latest/index.html

Mobile:
npm run type-check:mobile
npm --prefix apps/mobile run test

Mobile Maestro:
npm run mobile:e2e:test -- home,browse,add-by-rss-livestream,album
open .artifacts/mobile-e2e-reports/latest/failures.json
open .artifacts/mobile-e2e-reports/latest/ios-phone/index.html
open .artifacts/mobile-e2e-reports/latest/android-phone/index.html
```
