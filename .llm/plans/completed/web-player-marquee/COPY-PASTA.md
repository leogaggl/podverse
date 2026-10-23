# Web player marquee — COPY-PASTA

How to use:

1. Select **Cursor model** and **Reasoning** in the Cursor UI (the line above each fence).
1. Copy the fenced block only, paste, and the agent runs it.
1. Tick the box when that prompt is done.

Request and settled review answers: [00-REQUEST.md](./00-REQUEST.md). Ledger and decisions:
[00-SUMMARY.md](./00-SUMMARY.md). Order and file ownership:
[00-EXECUTION-ORDER.md](./00-EXECUTION-ORDER.md).

This set runs on its own sibling worktree, separate from `artist-album-attribution`. From the
main checkout (**Root** tab), create the worktree, copy this untracked plan set into it, set it
up, and start the run there:

```bash
git worktree add -b feature/web-player-marquee ../podverse_feature_web_player_marquee develop
cp -R .llm/plans/active/web-player-marquee ../podverse_feature_web_player_marquee/.llm/plans/active/
cd ../podverse_feature_web_player_marquee
make local_env_worktree_setup
npm install
npm run mobile:install
./scripts/abcplan/run.sh run web-player-marquee
```

`npm run mobile:install` is there because plan 10 repoints mobile imports, and the verification
runs mobile unit tests and the mobile type check in the worktree.

**Optional — run the set unattended (Root tab, in the worktree):**
`./scripts/abcplan/run.sh run web-player-marquee`. It runs one fresh agent per prompt on that
prompt's model, stops at the first blocker, and resumes with
`./scripts/abcplan/run.sh run web-player-marquee --resume 'Your answer.'`. The script passes
`--parallel`, so every prompt under one phase heading runs at once. The Phase 3 prompts share no
file, and none of them writes the release scratchpad: each puts its entry in its final message,
and prompt 40 appends them. Running them one after the other is also correct.

Phases run in order; prompts inside a phase run at once.

| Phase | Prompts | Model and reasoning |
| --- | --- | --- |
| 1 | 10 | Cursor Grok 4.7 high |
| 2 | 11 | Opus 5.5 high |
| 3 | 12, 20, 21, 30 | Cursor Grok 4.7 high |
| 4 | 40 | Cursor Grok 4.7 high |

Why the expensive one: 11 is the web `MarqueeText`, its turn hook, and the turn constants. It
carries open design (measurement, Web Animations, hover pause, reduced motion, `restInset` and
`align`), and every Phase 3 prompt builds on it. Fast stays off.

If a Cursor Grok 4.7 prompt stalls or makes the same mistake twice, rerun it one reasoning level
higher (after extra high, **Codex 5.3 · high**), and record the change on the prompt here.

## Phase 1

- [x] **10 — Move the marquee math and turn registry into @podverse/helpers**

**Cursor model:** Cursor Grok 4.7 · **Reasoning:** high

```
Read and execute .llm/plans/active/web-player-marquee/10-marquee-shared-logic.md
Follow 00-EXECUTION-ORDER.md and the settled answers in 00-REQUEST.md (D2 kept).
Mobile behavior does not change: only its imports move to @podverse/helpers/marquee. The worktree
commands in the plan are for the operator; do not run them.
Do not run tests. The plan has no release scratchpad entry.
When the plan is done, move 10-marquee-shared-logic.md to
.llm/plans/completed/web-player-marquee/.
End without a verification block: report what changed, self-check results, any blocker, and
anything a later prompt needs.
```

## Phase 2

- [x] **11 — Web MarqueeText in @podverse/ui, plus the player turn groups**

**Cursor model:** Opus 5.5 · **Reasoning:** high

```
Read and execute .llm/plans/active/web-player-marquee/11-web-marquee-text.md
Follow 00-EXECUTION-ORDER.md and the settled answers in 00-REQUEST.md (D1 and D3 kept; D5
changed: port both restInset and align; D6: player bar turns go title 0, segment 1, channel 2).
Build on plan 10's @podverse/helpers/marquee. The constants file is the contract plans 12, 20,
21, and 30 import; keep its names exactly as the plan states.
Do not run tests. The plan has no release scratchpad entry.
When the plan is done, move 11-web-marquee-text.md to .llm/plans/completed/web-player-marquee/.
End without a verification block: report what changed, self-check results, any blocker, and
anything a later prompt needs.
```

## Phase 3

Four prompts at once. Each owns only the files its plan lists (see 00-EXECUTION-ORDER.md
§ Phase 3); none edits `packages/ui`, `packages/helpers`, or
`apps/web/src/constants/mediaPlayerMarquee.ts`.

- [x] **12 — Embed player lines scroll with MarqueeText**

**Cursor model:** Cursor Grok 4.7 · **Reasoning:** high

```
Read and execute .llm/plans/active/web-player-marquee/12-embed-player-marquee.md
Follow 00-EXECUTION-ORDER.md and the settled answers in 00-REQUEST.md (D4 changed).
You own EmbedPlayerInfo.tsx, EmbedSegmentInfoBar.tsx, and their two SCSS modules. Use plan 11's
MarqueeText and the embedPlayer turn group; do not edit them.
Another prompt runs at the same time; edit only the files your plan lists, scope any type-check
or formatter to them, and do not rebuild shared packages. Report errors in files you do not own
instead of fixing them. Do not run tests. Do not edit release-notes/scratchpad.md: put the
plan's release scratchpad entry in your final message under "Release notes entry". Prompt 40
appends it.
When the plan is done, move 12-embed-player-marquee.md to
.llm/plans/completed/web-player-marquee/.
End without a verification block: report what changed, self-check results, any blocker, and
anything a later prompt needs.
```

- [x] **20 — Player bar title and channel each scroll on one line**

**Cursor model:** Cursor Grok 4.7 · **Reasoning:** high

```
Read and execute .llm/plans/active/web-player-marquee/20-player-bar-marquee.md
Follow 00-EXECUTION-ORDER.md and the settled answers in 00-REQUEST.md (D6 changed).
You own MediaPlayerInfoDesktop.tsx, MediaPlayerInfoMobile.tsx, and their two SCSS modules. The
title line shows itemTitle from getMediaPlayerInfoResolution; do not edit the resolver. Swap
elements in place: artist-album-attribution edits the same components on another branch. Prompt
21 mounts the segment strip in the parent components at the same time; do not touch them.
Another prompt runs at the same time; edit only the files your plan lists, scope any type-check
or formatter to them, and do not rebuild shared packages. Report errors in files you do not own
instead of fixing them. Do not run tests. Do not edit release-notes/scratchpad.md: put the
plan's release scratchpad entry in your final message under "Release notes entry". Prompt 40
appends it.
When the plan is done, move 20-player-bar-marquee.md to .llm/plans/completed/web-player-marquee/.
End without a verification block: report what changed, self-check results, any blocker, and
anything a later prompt needs.
```

- [x] **21 — Segment strip above the web player bar**

**Cursor model:** Cursor Grok 4.7 · **Reasoning:** high

```
Read and execute .llm/plans/active/web-player-marquee/21-player-bar-segment-strip.md
Follow 00-EXECUTION-ORDER.md and the settled answers in 00-REQUEST.md (D6 changed).
You own the strip files, MediaPlayerDesktop.tsx, MediaPlayerMobile.tsx, MediaPlayer.tsx,
mediaPlayerLayout.ts, pageAdjust.scss, both floating video portals,
media-player-floating-video-default.spec.ts, and the media_player.segment_strip_* keys in the
four consumer catalog originals (targeted insertions only). Then run npm run i18n:compile; you
are the only prompt in this set that touches the catalogs. Do not edit MediaPlayerInfoDesktop.tsx
or MediaPlayerInfoMobile.tsx: prompt 20 edits them at the same time.
Another prompt runs at the same time; edit only the files your plan lists, scope any type-check
or formatter to them, and do not rebuild shared packages. Report errors in files you do not own
instead of fixing them. Do not run tests. Do not edit release-notes/scratchpad.md: put the
plan's release scratchpad entry in your final message under "Release notes entry". Prompt 40
appends it.
When the plan is done, move 21-player-bar-segment-strip.md to
.llm/plans/completed/web-player-marquee/.
End without a verification block: report what changed, self-check results, any blocker, and
anything a later prompt needs.
```

- [x] **30 — Full-size player lines scroll with MarqueeText**

**Cursor model:** Cursor Grok 4.7 · **Reasoning:** high

```
Read and execute .llm/plans/active/web-player-marquee/30-full-size-player-marquee.md
Follow 00-EXECUTION-ORDER.md and the settled answers in 00-REQUEST.md.
You own MediaPlayerInfoModal.tsx and MediaPlayerInfoModal.module.scss. Links stay around the
scrolling text, use the fullPlayer turn group (title 0, channel 1, subsection 2), and leave
useModalArtworkSquareSize.ts alone. Swap elements in place: artist-album-attribution edits the
same component on another branch.
Another prompt runs at the same time; edit only the files your plan lists, scope any type-check
or formatter to them, and do not rebuild shared packages. Report errors in files you do not own
instead of fixing them. Do not run tests. Do not edit release-notes/scratchpad.md: put the
plan's release scratchpad entry in your final message under "Release notes entry". Prompt 40
appends it.
When the plan is done, move 30-full-size-player-marquee.md to
.llm/plans/completed/web-player-marquee/.
End without a verification block: report what changed, self-check results, any blocker, and
anything a later prompt needs.
```

## Phase 4

- [x] **40 — Playwright coverage for scrolling player titles; then archive the set**

**Cursor model:** Cursor Grok 4.7 · **Reasoning:** high

```
Read and execute .llm/plans/active/web-player-marquee/40-player-marquee-e2e.md
Follow 00-EXECUTION-ORDER.md and the settled answers in 00-REQUEST.md (D7, D8, D9).
tools/web/seed-e2e.mjs is large: search for the plan's anchors and make targeted edits. Do not
edit player components, packages/ui, the marquee constants, catalogs, the embed specs, or
media-player-floating-video-default.spec.ts. Use the test ids from the final messages of prompts
12, 20, 21, and 30 in .artifacts/plan-runner/web-player-marquee/ if they differ from the plan.
Do not run tests. The plan has no release scratchpad entry of its own.

Append to release-notes/scratchpad.md every "Release notes entry" from the final messages of
prompts 12, 20, 21, and 30 in .artifacts/plan-runner/web-player-marquee/ (12.md, 20.md, 21.md,
30.md), in that order, unchanged. Skip one that already appears in the scratchpad. If a final
message has no entry, use the ## Release scratchpad block from that prompt's plan in
.llm/plans/completed/web-player-marquee/.

Then close the set. Move 40-player-marquee-e2e.md to .llm/plans/completed/web-player-marquee/
and confirm every other numbered plan is there. Move 00-REQUEST.md, 00-SUMMARY.md,
00-EXECUTION-ORDER.md, and COPY-PASTA.md there, and remove the empty active directory.

End with the cumulative verification for the whole set, assuming no earlier prompt was tested.
One fenced bash block per tab, fish-safe, labeled with the tab name, all run in the
../podverse_feature_web_player_marquee worktree. Tell the operator that Docker must be running
for the web reports, and that for the Mobile Maestro block Mobile E2E Metro, Mobile E2E API, and
Mobile E2E iOS or Mobile E2E Android must be running from the worktree. Do not put leave-running
commands in the blocks. Note that there is no dependency change, so no lockfile step, and that
the main checkout's .llm/plans/active/abcplan-web-player-marquee/ can be deleted by hand.

Root:
npm run i18n:compile
npm run i18n:validate
npm run build:packages
npm run lint
npm run type-check
npm run test -w packages/helpers
npm run test -w packages/ui
npm run test -w apps/web
npm --prefix apps/mobile run test
make e2e_test_web_report_spec SPEC=e2e/media-player-marquee.spec.ts,e2e/media-player-floating-video-default.spec.ts,e2e/media-player-modal-video.spec.ts,e2e/media-player-chapter-seek.spec.ts,e2e/media-player-clip-soundbite-end-pause.spec.ts,e2e/media-player-alt-enclosure-load.spec.ts,e2e/embed-routes.spec.ts,e2e/embed-clip-soundbite-end.spec.ts,e2e/embed-responsive-player.spec.ts,e2e/embed-share-builder.spec.ts
open .artifacts/e2e-reports/latest/index.html

Mobile Maestro:
npm run mobile:e2e:test -- player-screen,play-mini-player
open .artifacts/mobile-e2e-reports/latest/failures.json
open .artifacts/mobile-e2e-reports/latest/ios-phone/index.html
open .artifacts/mobile-e2e-reports/latest/android-phone/index.html
```

- [ ] **abcaicast** (optional)

After this set, do you want an abcaicast for this work?
