# Web app bar and chips — COPY-PASTA

How to use:

1. Select **Cursor model** and **Reasoning** in the Cursor UI (the line above each fence).
1. Copy the fenced block only, paste, and the agent runs it.
1. Tick the box when that prompt is done.

Request and settled review answers (D1–D30): [00-REQUEST.md](./00-REQUEST.md). Ledger and
decisions: [00-SUMMARY.md](./00-SUMMARY.md). Order and file ownership:
[00-EXECUTION-ORDER.md](./00-EXECUTION-ORDER.md).

**Optional — run the set unattended (Root tab, in this worktree):**
`./scripts/abcplan/run.sh run web-app-bar-and-chips`. It runs one fresh agent per prompt on that
prompt's model, stops at the first blocker, and resumes with
`./scripts/abcplan/run.sh run web-app-bar-and-chips --resume 'Your answer.'`. The script passes
`--parallel`, so every prompt under one phase heading runs at once. The prompts in Phases 2, 3,
and 4 share no file. None of them writes the release scratchpad: each puts its entry in its final
message, and prompt 50 appends them. Running them one after the other is also correct.

Phases run in order; prompts inside a phase run at once.

| Phase | Prompts | Model and reasoning |
| --- | --- | --- |
| 1 | 20 | Opus 5.5 high |
| 2 | 10, 21 | Cursor Grok 4.7 medium (10), Cursor Grok 4.7 high (21) |
| 3 | 11, 30 | Opus 5.5 high |
| 4 | 12, 31 | Cursor Grok 4.7 high |
| 5 | 40 | Cursor Grok 4.7 high |
| 6 | 50 | Cursor Grok 4.7 high |

Why the expensive ones:

- 20 is the chip primitives every later chip prompt builds on, including the portaled menu
  anchoring and the sideways-scrolling row.
- 11 is the title-publishing contract between `MainHeader` and the NavBar, which every page uses.
- 30 replaces the list-header hook across seven lists and moves the category picker inline.

Fast stays off.

If a Cursor Grok 4.7 prompt stalls or makes the same mistake twice, rerun it one reasoning level
higher (after extra high, **Codex 5.3 · high**), and record the change on the prompt here.

## Phase 1

- [x] **20 — Chip primitives in @podverse/ui**

**Cursor model:** Opus 5.5 · **Reasoning:** high

```
Read and execute .llm/plans/active/web-app-bar-and-chips/20-ui-chip-primitives.md
Follow 00-EXECUTION-ORDER.md and the settled answers in 00-REQUEST.md (D7, D8, D10, D11 kept; D9
reversed: the row scrolls sideways on narrow screens and chip menus render in a portal).
Chip, ChipRow, MenuChip, SortChip, and the DropdownMenuPanel anchorRef portal are the contract
prompts 21, 30, 31, 40, and 50 build on; keep their names, props, and test ids exactly as the plan
states. DropdownMenuPanel callers that pass no anchorRef keep their current markup.
Do not run tests. The plan has no release scratchpad entry.
When the plan is done, move 20-ui-chip-primitives.md to
.llm/plans/completed/web-app-bar-and-chips/.
End without a verification block: report what changed, self-check results, any blocker, and
anything a later prompt needs.
```

## Phase 2

Two prompts at once. 10 owns the NavBar, `NavArrowButton`, `packages/ui/src/index.ts`,
`PACKAGES-UI.md`, and the consumer catalogs. 21 owns the web chip row, `ListSortChip`,
`ViewSelector`, and `dropdownMenuItems.ts`. Neither edits the other's files.

- [x] **10 — Remove the browser history arrows**

**Cursor model:** Cursor Grok 4.7 · **Reasoning:** medium

```
Read and execute .llm/plans/active/web-app-bar-and-chips/10-remove-history-arrows.md
Follow 00-EXECUTION-ORDER.md and the settled answers in 00-REQUEST.md (D4 kept: management-web
keeps its own layout). Player skip-back and skip-forward stay.
You own the files your plan lists, including packages/ui/src/index.ts, PACKAGES-UI.md, and the
consumer catalog originals (targeted key removals only). Then run npm run i18n:compile; you are
the only prompt in this phase that touches the catalogs. Prompt 21 edits the web chip row,
ListSortChip, ViewSelector, and dropdownMenuItems.ts at the same time; do not touch them.
Another prompt runs at the same time; edit only the files your plan lists, scope any type-check
or formatter to them, and do not rebuild shared packages. Report errors in files you do not own
instead of fixing them. Do not run tests. Do not edit release-notes/scratchpad.md: put the
plan's release scratchpad entry in your final message under "Release notes entry". Prompt 50
appends it.
When the plan is done, move 10-remove-history-arrows.md to
.llm/plans/completed/web-app-bar-and-chips/.
End without a verification block: report what changed, self-check results, any blocker, and
anything a later prompt needs.
```

- [x] **21 — Web chip row trailing slot, sort chip wrapper, and gear chip**

**Cursor model:** Cursor Grok 4.7 · **Reasoning:** high

```
Read and execute .llm/plans/active/web-app-bar-and-chips/21-web-chip-row-sort-and-gear.md
Follow 00-EXECUTION-ORDER.md and the settled answers in 00-REQUEST.md (D8, D10, D11, D12 kept;
D9 reversed).
Build on prompt 20's Chip, ChipRow, MenuChip, and SortChip from @podverse/ui; do not edit
packages/ui. If its names differ from your plan, use the ones in
.artifacts/plan-runner/web-app-bar-and-chips/20.md. MediaListChipsConfig, the trailing slot,
ListSortChip, STATS_RANGE_LABEL_KEYS, and the media-list-chips-items / media-list-chips-trailing
test ids are the contract prompts 30, 31, 40, and 50 use; keep them exactly as the plan states.
Use existing catalog keys only. Prompt 10 edits packages/ui NavBar, packages/ui/src/index.ts,
web NavBar.tsx, and the consumer catalogs at the same time; do not touch them.
Another prompt runs at the same time; edit only the files your plan lists, scope any type-check
or formatter to them, and do not rebuild shared packages. Report errors in files you do not own
instead of fixing them. Do not run tests. Do not edit release-notes/scratchpad.md: put the
plan's release scratchpad entry in your final message under "Release notes entry". Prompt 50
appends it.
When the plan is done, move 21-web-chip-row-sort-and-gear.md to
.llm/plans/completed/web-app-bar-and-chips/.
End without a verification block: report what changed, self-check results, any blocker, and
anything a later prompt needs.
```

## Phase 3

Two prompts at once. 11 owns `packages/ui` (`AppBarTitle`, `MainHeader`, NavBar, layout SCSS,
`index.ts`, `PACKAGES-UI.md`), web `NavBar.tsx`, `AppChrome.tsx`, the sticky-chrome rule, and
`navbar-chrome.spec.ts`. 30 owns `apps/web/src/app/page.tsx`, `browse/page.tsx`, the
`_media-lists/` files, the trailing-chip and category components, the catalogs, and
`media-list-chips.spec.ts`.

- [x] **11 — One app bar with the page title**

**Cursor model:** Opus 5.5 · **Reasoning:** high

```
Read and execute .llm/plans/active/web-app-bar-and-chips/11-app-bar-page-title.md
Follow 00-EXECUTION-ORDER.md and the settled answers in 00-REQUEST.md (D1, D2, D3, D5 kept).
Build on prompt 10's NavBar, which no longer has backForward. MainHeader keeps its title and
buttonsNode props and its call shape: prompt 30 adds <MainHeader title={title} /> at the same time
and relies on that. MainHeader stays a <header> element, and each width keeps one level-1
heading. Do not edit files under apps/web/src/app/ or any i18n catalog.
Another prompt runs at the same time; edit only the files your plan lists, scope any type-check
or formatter to them, and do not rebuild shared packages. Report errors in files you do not own
instead of fixing them. Do not run tests. Do not edit release-notes/scratchpad.md: put the
plan's release scratchpad entry in your final message under "Release notes entry". Prompt 50
appends it.
When the plan is done, move 11-app-bar-page-title.md to
.llm/plans/completed/web-app-bar-and-chips/.
End without a verification block: report what changed, self-check results, any blocker, and
anything a later prompt needs.
```

- [x] **30 — Subscribed and Browse: Category, Sort, and gear as trailing chips**

**Cursor model:** Opus 5.5 · **Reasoning:** high

```
Read and execute .llm/plans/active/web-app-bar-and-chips/30-media-list-trailing-chips.md
Follow 00-EXECUTION-ORDER.md and the settled answers in 00-REQUEST.md (D12–D23 kept).
Build on prompt 21's MediaListChipsConfig, trailing slot, ListSortChip, and gear MenuChip; do not
edit MediaListChips.tsx, ListSortChip.tsx, ViewSelector.tsx, or packages/ui. If names differ
from your plan, use the ones in .artifacts/plan-runner/web-app-bar-and-chips/21.md.
Prompt 11 changes MainHeader, the NavBar, and AppChrome at the same time; call MainHeader only as
<MainHeader title={title} /> as your plan states, and do not touch those files.
You own the consumer and mobile catalog originals (targeted insertions and moves only). Then run
npm run i18n:compile; you are the only prompt in this phase that touches the catalogs.
media-list-chips.spec.ts is large: edit only the tests your plan names. Prompts 31, 40, and 50
build on your chipTrailing and sortChip helpers there.
Another prompt runs at the same time; edit only the files your plan lists, scope any type-check
or formatter to them, and do not rebuild shared packages. Report errors in files you do not own
instead of fixing them. Do not run tests. Do not edit release-notes/scratchpad.md: put the
plan's release scratchpad entry in your final message under "Release notes entry". Prompt 50
appends it.
When the plan is done, move 30-media-list-trailing-chips.md to
.llm/plans/completed/web-app-bar-and-chips/.
End without a verification block: report what changed, self-check results, any blocker, and
anything a later prompt needs.
```

## Phase 4

Two prompts at once. 12 owns the Recommendations client, the embed index and membership renew
pages, `AddByRSSDetailClient.tsx`, and four specs. 31 owns `browse/page.tsx`, the Playlists and
Profiles files, `dropdownMenuItems.ts` and its test, `media-list-chips.spec.ts`, the new
`playlists-profiles-chips.spec.ts`, and the web spec order file.

- [x] **12 — Page titles that bypass MainHeader, and detail-page titles**

**Cursor model:** Cursor Grok 4.7 · **Reasoning:** high

```
Read and execute .llm/plans/active/web-app-bar-and-chips/12-page-titles-outside-main-header.md
Follow 00-EXECUTION-ORDER.md and the settled answers in 00-REQUEST.md (D1, D3, D6 kept).
Build on prompt 11's MainHeader and app bar title; if anything differs from your plan, use
.artifacts/plan-runner/web-app-bar-and-chips/11.md. Detail pages get no bar title.
Prompt 31 edits browse/page.tsx, the Playlists and Profiles pages, dropdownMenuItems.ts,
media-list-chips.spec.ts, and the web spec order file at the same time; do not touch them.
Another prompt runs at the same time; edit only the files your plan lists, scope any type-check
or formatter to them, and do not rebuild shared packages. Report errors in files you do not own
instead of fixing them. Do not run tests. Do not edit release-notes/scratchpad.md: put the
plan's release scratchpad entry in your final message under "Release notes entry". Prompt 50
appends it.
When the plan is done, move 12-page-titles-outside-main-header.md to
.llm/plans/completed/web-app-bar-and-chips/.
End without a verification block: report what changed, self-check results, any blocker, and
anything a later prompt needs.
```

- [x] **31 — Playlists and Users: chip rows with a trailing Sort chip**

**Cursor model:** Cursor Grok 4.7 · **Reasoning:** high

```
Read and execute .llm/plans/active/web-app-bar-and-chips/31-playlists-profiles-chip-rows.md
Follow 00-EXECUTION-ORDER.md and the settled answers in 00-REQUEST.md (D24, D25, D26 kept).
Build on prompt 30's MediaListTrailingChips, the chipsConfig in browse/page.tsx, and the
chipTrailing / sortChip helpers in media-list-chips.spec.ts, and on prompt 21's ListSortChip and
STATS_RANGE_LABEL_KEYS. If names differ from your plan, use
.artifacts/plan-runner/web-app-bar-and-chips/30.md and 21.md. Chip menus render in a portal, so
find menus from page, never from a chip row.
Prompt 12 edits the Recommendations client, the embed and membership renew pages,
AddByRSSDetailClient.tsx, and four specs at the same time; do not touch them.
Another prompt runs at the same time; edit only the files your plan lists, scope any type-check
or formatter to them, and do not rebuild shared packages. Report errors in files you do not own
instead of fixing them. Do not run tests. Do not edit release-notes/scratchpad.md: put the
plan's release scratchpad entry in your final message under "Release notes entry". Prompt 50
appends it.
When the plan is done, move 31-playlists-profiles-chip-rows.md to
.llm/plans/completed/web-app-bar-and-chips/.
End without a verification block: report what changed, self-check results, any blocker, and
anything a later prompt needs.
```

## Phase 5

- [x] **40 — Add by RSS library: action buttons above the chips**

**Cursor model:** Cursor Grok 4.7 · **Reasoning:** high

```
Read and execute .llm/plans/active/web-app-bar-and-chips/40-add-by-rss-list-toolbar.md
Follow 00-EXECUTION-ORDER.md and the settled answers in 00-REQUEST.md (D27 kept: both buttons
primary).
Build on prompt 21's MediaListChipsConfig, trailing slot, ListSortChip, and gear MenuChip, and on
prompt 11's MainHeader. If names differ from your plan, use
.artifacts/plan-runner/web-app-bar-and-chips/21.md and 11.md. Do not edit MediaListChips.tsx,
ViewSelector.tsx, dropdownMenuItems.ts, packages/ui, or any catalog. In media-list-chips.spec.ts,
edit only the tests your plan names, and leave the step "Choosing Oldest leaves the livestream
rows in the same vertical order" for prompt 50.
Do not run tests. Append the plan's release scratchpad entry to release-notes/scratchpad.md.
When the plan is done, move 40-add-by-rss-list-toolbar.md to
.llm/plans/completed/web-app-bar-and-chips/.
End without a verification block: report what changed, self-check results, any blocker, and
anything a later prompt needs.
```

## Phase 6

- [x] **50 — Detail section chips and sort; then close the set**

**Cursor model:** Cursor Grok 4.7 · **Reasoning:** high

```
Read and execute .llm/plans/active/web-app-bar-and-chips/50-detail-section-chips-and-sort.md
Follow 00-EXECUTION-ORDER.md and the settled answers in 00-REQUEST.md (D28, D29, D30 kept).
Build on prompt 20's ChipRow and SortChip and prompt 21's ListSortChip; this plan extends them.
If names differ from your plan, use .artifacts/plan-runner/web-app-bar-and-chips/20.md and 21.md.
Do not edit ListHeader.tsx or AddByRSSDetailClient.tsx. media-list-chips.spec.ts is large: edit
only the step your plan names. The consumer catalog originals take targeted insertions only;
then run npm run i18n:compile.
Do not run tests. Append the plan's release scratchpad entry to release-notes/scratchpad.md
after the entries below.

Before your own entry, append to release-notes/scratchpad.md every "Release notes entry" from the
final messages of prompts 10, 21, 11, 30, 12, and 31 in
.artifacts/plan-runner/web-app-bar-and-chips/ (10.md, 21.md, 11.md, 30.md, 12.md, 31.md), in that
order, unchanged. Skip one that already appears in the scratchpad. If a final message has no
entry, use the ## Release scratchpad block from that prompt's plan in
.llm/plans/completed/web-app-bar-and-chips/. Prompt 40 already wrote its own; plan 20 has none.

Then close the set. Move 50-detail-section-chips-and-sort.md to
.llm/plans/completed/web-app-bar-and-chips/ and confirm every other numbered plan (10, 11, 12,
20, 21, 30, 31, 40) is there. Move 00-REQUEST.md, 00-SUMMARY.md, 00-EXECUTION-ORDER.md, and
COPY-PASTA.md there, and remove the empty active directory.

End with the cumulative verification for the whole set, assuming no earlier prompt was tested.
One fenced bash block per tab, fish-safe, labeled with the tab name, all run in the
../podverse_feature_web_app_bar_and_chips worktree. Tell the operator that Docker must be running
for the web reports, and that for the Mobile Maestro block Mobile E2E Metro, Mobile E2E API, and
Mobile E2E iOS or Mobile E2E Android must be running from the worktree. Do not put leave-running
commands in the blocks. Note that no dependency changed (plan 20 only adds an export subpath to
packages/helpers/package.json), so there is no lockfile step. Add any spec or unit test the set
created that the list below misses (check git status).

Root:
npm run i18n:compile
npm run i18n:validate
npm run build:packages
npm run lint
npm run type-check
npm run type-check:mobile
npm run test -w packages/helpers
npm run test -w packages/ui
npm run test -w apps/web
npm --prefix apps/mobile run test
make e2e_test_report_scoped WEB_SPEC=e2e/navbar-chrome.spec.ts,e2e/focus-states.spec.ts,e2e/media-list-chips.spec.ts,e2e/playlists-profiles-chips.spec.ts,e2e/artists-list-date-and-view.spec.ts,e2e/podcasts-subscribed-filter.spec.ts,e2e/recommendations.spec.ts,e2e/detail-section-chips.spec.ts,e2e/detail-sort-persistence.spec.ts,e2e/artist-page-albums-and-tracks.spec.ts,e2e/add-by-rss-artist-albums.spec.ts,e2e/embed-demo-index.spec.ts,e2e/membership-page-trial-limitations.spec.ts,e2e/terms-version-acceptance.spec.ts,e2e/notifications-inbox.spec.ts,e2e/web-session-ended-notice.spec.ts MGMT_SPEC=e2e/navbar-chrome.spec.ts
open .artifacts/e2e-reports/latest/index.html

Mobile Maestro:
npm run mobile:e2e:test -- browse
open .artifacts/mobile-e2e-reports/latest/failures.json
open .artifacts/mobile-e2e-reports/latest/ios-phone/index.html
open .artifacts/mobile-e2e-reports/latest/android-phone/index.html
```

- [ ] **abcaicast** (optional)

After this set, do you want an abcaicast for this work?
