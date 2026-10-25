# Mobile auto-queue parity — COPY-PASTA

How to use:

1. Select **Cursor model** and **Reasoning** in the Cursor UI (the line above each fence).
1. Copy the fenced block only, paste, and the agent runs it.
1. Tick the box when that prompt is done.

Request and settled review answers: [00-REQUEST.md](./00-REQUEST.md). Ledger and decisions:
[00-SUMMARY.md](./00-SUMMARY.md). Order and file ownership:
[00-EXECUTION-ORDER.md](./00-EXECUTION-ORDER.md).

**Optional — run the set unattended (Root tab):**
`./scripts/abcplan/run.sh run mobile-auto-queue-parity`. It runs one fresh agent per prompt on that
prompt's model, stops at the first blocker, and resumes with
`./scripts/abcplan/run.sh run mobile-auto-queue-parity --resume 'Your answer.'`. The script passes
`--parallel`, so every prompt under one phase heading runs at once. Prompts in one phase share no
file, and none of them writes the release scratchpad: each puts its entry in its final message,
and prompt 43 appends them. Running them one after the other is also correct.

Phases run in order; prompts inside a phase run at once.

| Phase | Prompts | Model and reasoning |
| --- | --- | --- |
| 1 | 10, 41, 42 | 10 Codex 5.3 high; 41 Opus 5.5 high; 42 Opus 5.5 high |
| 2 | 11 | Cursor Grok 4.7 high |
| 3 | 20, 22, 30 | 20 Cursor Grok 4.7 high; 22 Cursor Grok 4.7 high; 30 Opus 5.5 extra high |
| 4 | 21, 31 | 21 Cursor Grok 4.7 high; 31 Opus 5.5 high |
| 5 | 23, 32 | 23 Cursor Grok 4.7 medium; 32 Opus 5.5 high |
| 6 | 33 | Cursor Grok 4.7 extra high |
| 7 | 34, 40 | 34 Cursor Grok 4.7 medium; 40 Opus 5.5 high |
| 8 | 44 | Opus 5.5 high |
| 9 | 35 | Cursor Grok 4.7 extra high |
| 10 | 43 | Cursor Grok 4.7 medium |

Why the expensive ones: 10 is the multi-package contract every later prompt builds on, with tricky
paging, repeat, and dedupe edge cases (Codex 5.3). 30 is the in-flight refill guard in the playback
provider, which is concurrency work (Opus 5.5 extra high). 31, 32, 40, and 44 change playback
advance and adoption in `PlaybackProvider.tsx`, and 41 and 42 are native engine work (Opus 5.5).
33 and 35 are fully specified playback edits in a large file many earlier prompts changed, so they
run on Cursor Grok 4.7 at extra high. Fast stays off.

Plans 10 and 11 each build `@podverse/playback-core` at the end. Web and mobile read its `dist`,
so no web or mobile TypeScript prompt shares a phase with them.

If a Cursor Grok 4.7 prompt stalls or makes the same mistake twice, rerun it one reasoning level
higher (after extra high, **Codex 5.3 · high**), and record the change on the prompt here.

## Phase 1

- [x] **10 — Auto-queue policy in `@podverse/playback-core`**

**Cursor model:** Codex 5.3 · **Reasoning:** high

```
Read and execute .llm/plans/active/mobile-auto-queue-parity/10-playback-core-auto-queue-policy.md
Follow 00-EXECUTION-ORDER.md and the settled answers in 00-REQUEST.md (D2, D3, D16).
Edit only packages/playback-core. It depends only on @podverse/helpers: every walk takes the
fetchers each surface passes in and imports no request package. Keep web's type names so callers
swap imports without renaming. When the code is done, run
npm run build -w packages/playback-core so later prompts type-check against the new exports.
Another prompt runs at the same time; edit only the files your plan lists, and scope any
type-check or formatter to them. Do not run tests. Do not edit release-notes/scratchpad.md: put
the plan's release scratchpad entry in your final message under "Release notes entry". Prompt 43
appends it.
When the plan is done, move 10-playback-core-auto-queue-policy.md to
.llm/plans/completed/mobile-auto-queue-parity/.
End without a verification block: report what changed, self-check results, any blocker, and
anything a later prompt needs.
```

- [x] **41 — iOS engine advances through the advance window when JS is not running**

**Cursor model:** Opus 5.5 · **Reasoning:** high

```
Read and execute .llm/plans/active/mobile-auto-queue-parity/41-ios-native-advance-window.md
Follow 00-EXECUTION-ORDER.md and the settled answers in 00-REQUEST.md (D11, D12, D15, D19, D20,
and the review answers R29 and R30).
Implement the advance-window.json payload exactly as the plan copies it; plan 40 writes it later
in this set and owns the TypeScript module files, so edit only the Swift files your plan lists.
Clip and soundbite entries play their clipStartSeconds to clipEndSeconds range and do not end the
window; Add by RSS entries are plain media URLs with no credentials. Native code only steps
through the entries it was given and makes no queue choice. The native cache schema version
stays 2.
Another prompt runs at the same time; edit only the files your plan lists. Do not run tests. Do
not edit release-notes/scratchpad.md: put the plan's release scratchpad entry in your final
message under "Release notes entry". Prompt 43 appends it.
When the plan is done, move 41-ios-native-advance-window.md to
.llm/plans/completed/mobile-auto-queue-parity/.
End without a verification block: report what changed, self-check results, any blocker, and
anything a later prompt needs.
```

- [x] **42 — Android engine advances through the advance window when JS is not running**

**Cursor model:** Opus 5.5 · **Reasoning:** high

```
Read and execute .llm/plans/active/mobile-auto-queue-parity/42-android-native-advance-window.md
Follow 00-EXECUTION-ORDER.md and the settled answers in 00-REQUEST.md (D11, D12, D15, D19, D20,
and the review answers R29 and R30).
Implement the advance-window.json payload exactly as the plan copies it and follow the same step
rule as plan 41 (iOS), which runs at the same time. Plan 40 owns the TypeScript module files, so
edit only the Kotlin files your plan lists. Clip and soundbite entries play their range and do not
end the window; Add by RSS entries are plain media URLs with no credentials. Native code only
steps through the entries it was given and makes no queue choice. The native cache schema version
stays 2.
Another prompt runs at the same time; edit only the files your plan lists. Do not run tests. Do
not edit release-notes/scratchpad.md: put the plan's release scratchpad entry in your final
message under "Release notes entry". Prompt 43 appends it.
When the plan is done, move 42-android-native-advance-window.md to
.llm/plans/completed/mobile-auto-queue-parity/.
End without a verification block: report what changed, self-check results, any blocker, and
anything a later prompt needs.
```

## Phase 2

- [x] **11 — Add by RSS adjacent-row walk in `@podverse/playback-core`**

**Cursor model:** Cursor Grok 4.7 · **Reasoning:** high

```
Read and execute .llm/plans/active/mobile-auto-queue-parity/11-playback-core-add-by-rss-list-walk.md
Follow 00-EXECUTION-ORDER.md and the settled answers in 00-REQUEST.md (D1).
Keep plan 10's edits in packages/playback-core/src/index.ts, package.json, and
PACKAGES-PLAYBACK-CORE.md; add your exports beside them. Names match web's
(AddByRSSListContextState, AddByRSSListSortOrder) so web swaps imports without renames. When the
code is done, run npm run build -w packages/playback-core so later prompts type-check against the
new exports.
Do not run tests. Append the plan's release scratchpad entry.
When the plan is done, move 11-playback-core-add-by-rss-list-walk.md to
.llm/plans/completed/mobile-auto-queue-parity/.
End without a verification block: report what changed, self-check results, any blocker, and
anything a later prompt needs.
```

## Phase 3

Prompt 20 owns the web auto-queue loader files, prompt 22 the web Add by RSS next and previous
files, and prompt 30 the mobile auto-queue files, `PlaybackProvider.tsx`, `FullPlayerScreen.tsx`,
and `apps/mobile/vitest.config.ts` (full lists in 00-EXECUTION-ORDER.md).

- [x] **20 — Web auto-queue loader calls `fillAutoQueueForward`**

**Cursor model:** Cursor Grok 4.7 · **Reasoning:** high

```
Read and execute .llm/plans/active/mobile-auto-queue-parity/20-web-auto-queue-loader.md
Follow 00-EXECUTION-ORDER.md and the settled answers in 00-REQUEST.md (D4).
Web behavior does not change. Pass a config copy with disabled: false. Do not edit
useMediaPlayerControllerQueueHeadLoading.ts, useTrackNextButtonActions.ts, or
useTrackPreviousButtonActions.ts, and leave playablePlaylistResource.ts in place (plan 21 deletes
it). Do not edit or build packages/playback-core. Anchor edits by symbol and do not edit
.llm/plans/active/cross-device-playback/.
Another prompt runs at the same time; edit only the files your plan lists, and scope any
type-check or formatter to them. Do not run tests. This plan appends no scratchpad entry.
When the plan is done, move 20-web-auto-queue-loader.md to
.llm/plans/completed/mobile-auto-queue-parity/.
End without a verification block: report what changed, self-check results, any blocker, and
anything a later prompt needs.
```

- [x] **22 — Web Add by RSS next and previous call the shared step**

**Cursor model:** Cursor Grok 4.7 · **Reasoning:** high

```
Read and execute .llm/plans/active/mobile-auto-queue-parity/22-web-add-by-rss-adjacent-step.md
Follow 00-EXECUTION-ORDER.md and the settled answers in 00-REQUEST.md (D1).
Web behavior does not change. Apply nextContext only after the item has loaded, and set the
context to null on clearContext. Do not edit useTrackNextButtonActions.ts,
useTrackPreviousButtonActions.ts, usePlayAddByRSS, or the IndexedDB helpers. Do not edit or build
packages/playback-core. Do not edit .llm/plans/active/cross-device-playback/.
Another prompt runs at the same time; edit only the files your plan lists, and scope any
type-check or formatter to them. Do not run tests. This plan appends no scratchpad entry.
When the plan is done, move 22-web-add-by-rss-adjacent-step.md to
.llm/plans/completed/mobile-auto-queue-parity/.
End without a verification block: report what changed, self-check results, any blocker, and
anything a later prompt needs.
```

- [x] **30 — Mobile auto-queue on the shared helper, with one guarded refill**

**Cursor model:** Opus 5.5 · **Reasoning:** extra high

```
Read and execute .llm/plans/active/mobile-auto-queue-parity/30-mobile-auto-queue-shared-fill.md
Follow 00-EXECUTION-ORDER.md and the settled answers in 00-REQUEST.md (D5, D9).
The fill runs after every load that has a seed and never blocks load or first paint. One gate
keeps one fill in flight, and a result applies only if the same seed is still playing. Mobile
keeps honoring disabled. PlaybackProvider.tsx is large: Grep its symbols, do not read it whole.
Add src/lib/autoQueue/autoQueue.test.ts and src/playback/autoQueueFillGate.test.ts to the
include list in apps/mobile/vitest.config.ts; the list is explicit and skips both today. Do not
edit or build packages/playback-core. Anchor edits by symbol and do not edit
.llm/plans/active/cross-device-playback/.
Another prompt runs at the same time; edit only the files your plan lists, and scope any
type-check or formatter to them. Do not run tests. Do not edit release-notes/scratchpad.md: put
the plan's release scratchpad entry in your final message under "Release notes entry". Prompt 43
appends it.
When the plan is done, move 30-mobile-auto-queue-shared-fill.md to
.llm/plans/completed/mobile-auto-queue-parity/.
End without a verification block: report what changed, self-check results, any blocker, and
anything a later prompt needs.
```

## Phase 4

Prompt 21 owns `useTrackPreviousButtonActions.ts` and the deletion of
`playablePlaylistResource.ts`; prompt 31 owns `autoQueue.ts` and its test, `useAutoQueueFill.ts`,
and `PlaybackProvider.tsx`.

- [x] **21 — Web Previous calls `resolveAutoQueuePrevious`**

**Cursor model:** Cursor Grok 4.7 · **Reasoning:** high

```
Read and execute .llm/plans/active/mobile-auto-queue-parity/21-web-previous-track-walk.md
Follow 00-EXECUTION-ORDER.md and the settled answers in 00-REQUEST.md (D4).
Web behavior does not change. Edit only the body of runCorePreviousTrack; leave handleClick, long
press, runPreviousTrack, runAddByRSSPreviousTrack, the returned fields, and any runLocalClick or
remote-role branch. Delete playablePlaylistResource.ts only after a Grep shows no importer is
left. Do not edit useTrackNextButtonActions.ts or .llm/plans/active/cross-device-playback/.
Another prompt runs at the same time; edit only the files your plan lists, and scope any
type-check or formatter to them. Do not run tests. This plan appends no scratchpad entry.
When the plan is done, move 21-web-previous-track-walk.md to
.llm/plans/completed/mobile-auto-queue-parity/.
End without a verification block: report what changed, self-check results, any blocker, and
anything a later prompt needs.
```

- [x] **31 — Mobile Previous through the auto-queue**

**Cursor model:** Opus 5.5 · **Reasoning:** high

```
Read and execute .llm/plans/active/mobile-auto-queue-parity/31-mobile-previous-through-auto-queue.md
Follow 00-EXECUTION-ORDER.md and the settled answers in 00-REQUEST.md (D10).
Chapters first, restart past 3 seconds, then step back through auto-queue rows, then walk the
source backward; with shuffle on, Previous only restarts. Account queue history is no longer
read. Keep plan 30's edits in autoQueue.ts, useAutoQueueFill.ts, and PlaybackProvider.tsx;
PlaybackProvider.tsx is large, so Grep its symbols. Anchor edits by symbol and do not edit
.llm/plans/active/cross-device-playback/.
Another prompt runs at the same time; edit only the files your plan lists, and scope any
type-check or formatter to them. Do not run tests. Do not edit release-notes/scratchpad.md: put
the plan's release scratchpad entry in your final message under "Release notes entry". Prompt 43
appends it.
When the plan is done, move 31-mobile-previous-through-auto-queue.md to
.llm/plans/completed/mobile-auto-queue-parity/.
End without a verification block: report what changed, self-check results, any blocker, and
anything a later prompt needs.
```

## Phase 5

Prompt 23 owns `MEDIA-PLAYER-DECISION-MATRIX.md`; prompt 32 owns the mobile Add by RSS feed walk
files, `PlaybackProvider.tsx`, and `apps/mobile/vitest.config.ts`.

- [x] **23 — Player matrix names where the walks live**

**Cursor model:** Cursor Grok 4.7 · **Reasoning:** medium

```
Read and execute .llm/plans/active/mobile-auto-queue-parity/23-web-player-matrix-walk-pointers.md
Follow 00-EXECUTION-ORDER.md.
Insert the three paragraphs only; change no table row. Read the code plans 20, 21, and 22
produced so the names match what is in the tree. Present tense, no plan or step numbers, no
other media player named.
Another prompt runs at the same time; edit only the file your plan lists. Do not run tests. This
plan appends no scratchpad entry.
When the plan is done, move 23-web-player-matrix-walk-pointers.md to
.llm/plans/completed/mobile-auto-queue-parity/.
End without a verification block: report what changed, self-check results, any blocker, and
anything a later prompt needs.
```

- [x] **32 — Mobile Add by RSS next and previous through the feed**

**Cursor model:** Opus 5.5 · **Reasoning:** high

```
Read and execute .llm/plans/active/mobile-auto-queue-parity/32-mobile-add-by-rss-feed-walk.md
Follow 00-EXECUTION-ORDER.md and the settled answers in 00-REQUEST.md (D7, D8).
Next checks the manual queue first, the same path as ended, so the phone, lock screen, CarPlay,
and Android Auto share one advance. The walk is built from the playing item's feed on this
device. Apply nextContext only after the item has loaded. Keep plans 30 and 31's edits in
PlaybackProvider.tsx; Grep its symbols. Add src/lib/addByRss/feedWalk.test.ts to the include list
in apps/mobile/vitest.config.ts. Anchor edits by symbol and do not edit
.llm/plans/active/cross-device-playback/.
Another prompt runs at the same time; edit only the files your plan lists, and scope any
type-check or formatter to them. Do not run tests. Do not edit release-notes/scratchpad.md: put
the plan's release scratchpad entry in your final message under "Release notes entry". Prompt 43
appends it.
When the plan is done, move 32-mobile-add-by-rss-feed-walk.md to
.llm/plans/completed/mobile-auto-queue-parity/.
End without a verification block: report what changed, self-check results, any blocker, and
anything a later prompt needs.
```

## Phase 6

- [x] **33 — Full player Next turns on when a next row exists**

**Cursor model:** Cursor Grok 4.7 · **Reasoning:** extra high

```
Read and execute .llm/plans/active/mobile-auto-queue-parity/33-mobile-full-player-next-state.md
Follow 00-EXECUTION-ORDER.md and the settled answers in 00-REQUEST.md (D6).
Every either/or in the plan is decided; follow it as written. Next stays off while a fill runs
and after a fill fails. Keep plans 30, 31, and 32's edits in PlaybackProvider.tsx and
FullPlayerScreen.tsx; Grep their symbols. In auto-queue-advance.yaml use the shared TIMEOUT_*
ladder (mobile-maestro-timeouts). Anchor edits by symbol and do not edit
.llm/plans/active/cross-device-playback/.
Do not run tests. Append the plan's release scratchpad entry.
When the plan is done, move 33-mobile-full-player-next-state.md to
.llm/plans/completed/mobile-auto-queue-parity/.
End without a verification block: report what changed, self-check results, any blocker, and
anything a later prompt needs.
```

## Phase 7

Prompt 34 owns the queue parity doc and `.cursor/skills/mobile-playback/SKILL.md`; prompt 40 owns
the mobile TypeScript files its plan lists, including `PlaybackProvider.tsx` and
`apps/mobile/vitest.config.ts`.

- [x] **34 — Mobile queue parity doc and playback skill describe the shared auto-queue**

**Cursor model:** Cursor Grok 4.7 · **Reasoning:** medium

```
Read and execute .llm/plans/active/mobile-auto-queue-parity/34-mobile-auto-queue-parity-docs.md
Follow 00-EXECUTION-ORDER.md and the settled answers in 00-REQUEST.md.
Describe the code plans 30–33 produced as it stands in the tree; read their code, not only the
plans. Leave the native car sections alone: plan 43 rewrites them after plans 40–44. No plan or
step numbers in the docs.
Another prompt runs at the same time; edit only the files your plan lists. Do not run tests.
This plan appends no scratchpad entry.
When the plan is done, move 34-mobile-auto-queue-parity-docs.md to
.llm/plans/completed/mobile-auto-queue-parity/.
End without a verification block: report what changed, self-check results, any blocker, and
anything a later prompt needs.
```

- [x] **40 — Mobile writes a native advance window of resolved next rows**

**Cursor model:** Opus 5.5 · **Reasoning:** high

```
Read and execute .llm/plans/active/mobile-auto-queue-parity/40-mobile-native-advance-window-js.md
Follow 00-EXECUTION-ORDER.md and the settled answers in 00-REQUEST.md (D11, D12, D16, D17, D19,
and the review answers R29 and R30).
The payload must match what plans 41 and 42 implemented; read their final messages in
.artifacts/plan-runner/mobile-auto-queue-parity/41.md and 42.md and the Swift and Kotlin readers
before writing it. Clip and soundbite rows carry their range and do not end the window. Add by
RSS episodes go in as plain media URLs; never write feed passwords or auth headers to the native
cache; an enclosure that will not play as a plain URL ends the window; livestreams stay
manual-queue only. Keep plans 30–33's edits in PlaybackProvider.tsx, useAutoQueueFill.ts, and
useAddByRssFeedWalk.ts; Grep their symbols. Add the new advanceWindow, queueEntryMapping, and
playbackUrl tests to the include list in apps/mobile/vitest.config.ts. Anchor edits by symbol and
do not edit .llm/plans/active/cross-device-playback/.
Another prompt runs at the same time; edit only the files your plan lists, and scope any
type-check or formatter to them. Do not run tests. Do not edit release-notes/scratchpad.md: put
the plan's release scratchpad entry in your final message under "Release notes entry". Prompt 43
appends it.
When the plan is done, move 40-mobile-native-advance-window-js.md to
.llm/plans/completed/mobile-auto-queue-parity/.
End without a verification block: report what changed, self-check results, any blocker, and
anything a later prompt needs.
```

## Phase 8

- [x] **44 — Mobile continues the saved advance source when it adopts a native-started item**

**Cursor model:** Opus 5.5 · **Reasoning:** high

```
Read and execute .llm/plans/active/mobile-auto-queue-parity/44-mobile-adopt-native-advance-source.md
Follow 00-EXECUTION-ORDER.md and the settled answers in 00-REQUEST.md (the review answers R31 and
R32).
With the app closed, an item the car starts outside the window still falls back to the account
queue snapshot. When JS adopts the playing item: if it is in the account queue, keep the saved
playlist, album, or podcast behind that queue, the same as on the phone; otherwise continue the
saved source if the item belongs to it; otherwise refill from the item's own podcast or album. A
same-podcast episode outside the saved rows and not in the manual queue refills from its own
channel. The saved source lives in SQLite and sign-out deletes it. Keep plan 40's edits in
PlaybackProvider.tsx, useNativeAdvanceWindow.ts, and queueRepository.ts, and plan 32's in
feedWalk.ts; Grep their symbols. Add src/lib/playback/nativeAdvanceSource.test.ts to the include
list in apps/mobile/vitest.config.ts. Anchor edits by symbol and do not edit
.llm/plans/active/cross-device-playback/.
Do not run tests. Append the plan's release scratchpad entry.
When the plan is done, move 44-mobile-adopt-native-advance-source.md to
.llm/plans/completed/mobile-auto-queue-parity/.
End without a verification block: report what changed, self-check results, any blocker, and
anything a later prompt needs. Plan 35 runs next and edits the ended and progress handlers in
PlaybackProvider.tsx.
```

## Phase 9

- [x] **35 — A chapter that reaches its end advances like any other item**

**Cursor model:** Cursor Grok 4.7 · **Reasoning:** extra high

```
Read and execute .llm/plans/active/mobile-auto-queue-parity/35-mobile-chapter-end-advance.md
Follow 00-EXECUTION-ORDER.md and the settled answer R33 in 00-REQUEST.md.
Every either/or in the plan is decided; follow it as written. Add engineSourceMatchesTarget next
to engineSourceIdentityFromTarget in mediaEngineSourceMeta.ts and use it in both the ended and
progress handlers of PlaybackProvider.tsx; an event for a different item is still ignored. Leave
isAdoptedSourceCurrent and adoptEngineSource on playbackTargetRowMediaId. buildPlaybackTarget.ts
gets a doc comment sentence only. PlaybackProvider.tsx is large and plans 30–33, 40, and 44
changed it: Grep its symbols, keep their edits, and keep any cross-device branches in those
handlers. Anchor edits by symbol and do not edit .llm/plans/active/cross-device-playback/.
Do not run tests. Append the plan's release scratchpad entry.
When the plan is done, move 35-mobile-chapter-end-advance.md to
.llm/plans/completed/mobile-auto-queue-parity/.
End without a verification block: report what changed, self-check results, any blocker, and
anything a later prompt needs. Plan 43 runs next and closes the set.
```

## Phase 10

- [x] **43 — Docs and checklists describe the native advance window; then archive the set**

**Cursor model:** Cursor Grok 4.7 · **Reasoning:** medium

```
Read and execute .llm/plans/active/mobile-auto-queue-parity/43-native-advance-window-docs.md
Follow 00-EXECUTION-ORDER.md and the settled answers in 00-REQUEST.md (R29–R32).
Describe the code plans 40, 41, 42, and 44 produced as it stands in the tree; read their code,
not only the plans. Keep plan 34's edits in the queue parity doc and the mobile-playback skill.
No plan or step numbers in docs, rules, or skills, and no other media player named.
Do not run tests. This plan has no scratchpad entry of its own.

Append to release-notes/scratchpad.md every "Release notes entry" from the final messages of
prompts 10, 41, 42, 30, 31, 32, and 40 in .artifacts/plan-runner/mobile-auto-queue-parity/
(10.md, 41.md, …), in that order, unchanged. Skip one that already appears in the scratchpad.

Then close the set. Confirm every other numbered plan (10, 11, 20–23, 30–35, 40–42, 44) is in
.llm/plans/completed/mobile-auto-queue-parity/. Move 43-native-advance-window-docs.md,
00-REQUEST.md, 00-SUMMARY.md, 00-EXECUTION-ORDER.md, and COPY-PASTA.md there, and remove the
empty active directory. Leave .llm/plans/active/cross-device-playback/ where it is; it rebases
onto this set.

End with the cumulative verification for the whole set, assuming no earlier prompt was tested.
One fenced bash block per tab, fish-safe, labeled with the tab name. Tell the operator that
Docker, Mobile E2E Metro, Mobile E2E API, Mobile E2E test-assets, and Mobile E2E iOS or Mobile
E2E Android must be running, and that the Mobile E2E iOS and Mobile E2E Android installs rebuild
the native app so the Swift and Kotlin engine changes are in it. Do not put leave-running
commands in the blocks. Say that the app-closed advance has no automated test: the operator
proves it with the new rows in CARPLAY-SIMULATOR-CHECKLIST.md (Mobile CarPlay tab) and
ANDROID-AUTO-DHU-CHECKLIST.md (Mobile Android Auto tab). Name the checklist rows the plan added.
Say that the chapter-end advance is held by the mediaEngineSourceMeta unit tests, with no Maestro
flow.

Root:
npm run build:packages
npm run lint
npm run type-check
npm run test -w @podverse/playback-core
npm run test -w apps/web
npm --prefix apps/mobile run test
make e2e_test_web_report_spec SPEC=e2e/media-player-music-playback.spec.ts,e2e/media-player-music-queue-restore.spec.ts,e2e/playlist-edit-play.spec.ts,e2e/media-player-addbyrss-resume.spec.ts
open .artifacts/e2e-reports/latest/index.html

Mobile E2E iOS:
npm run mobile:e2e:ios

Mobile E2E Android:
npm run mobile:e2e:android

Mobile Maestro:
npm run mobile:e2e:test -- auto-queue-advance,player-screen,add-by-rss,add-by-rss-track
open .artifacts/mobile-e2e-reports/latest/failures.json
open .artifacts/mobile-e2e-reports/latest/ios-phone/index.html
open .artifacts/mobile-e2e-reports/latest/android-phone/index.html
```

- [ ] **abcaicast** (optional)

After this set, do you want an abcaicast for this work?
