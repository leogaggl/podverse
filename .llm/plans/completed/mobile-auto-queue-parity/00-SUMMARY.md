# Mobile auto-queue parity — summary

Request: [00-REQUEST.md](00-REQUEST.md). Models and prompts: see `COPY-PASTA.md` once Close writes
it.

Web behavior is the source of truth. iOS and Android match it, except where native playback,
CarPlay, Android Auto, or the lock screen need something different (Next enable state and the
native window below are the agreed differences).

## Requirement ledger

Quoted from the request and the operator answers. Close fills each Plan from the plans' `## Rows`.

- **R1** (area A) "the podverse web site should have a variety of automatic queue types of handling when you play a podcast or music. do you see it?" — Plan: 10
- **R2** (area A) "is it clear to you how it works?" — Plan: 10
- **R3** (area C) "does mobile have matching handling?" — Plan: 30, 34
- **R4** (area A) "is there opportunity for shared helpers to keep this behavior consistent between web, mobile, and potentially others?" — Plan: 10, 11
- **R5** (area D) "(perhaps mobile app needs to be different for the sake of native, car/auto play, and other potential clients)" — Plan: 40, 43
- **R6** (area C) "the forward fill does not seem to be working for me on mobile. are you sure it is setup properly?" — Plan: 30
- **R7** (area C) "the forward button is disabled even though i started playing an item in the middle of a series" — Plan: 33
- **R8** (area C) "so do you see bugs and issues that can be fixed so the mobile player has more parity with the web?" — Plan: 30
- **R9** (area D) "and can you make it support car/auto mobile and other potential clients?" — Plan: 40, 43
- **R10** (area C) "fixes for this." — Plan: 30
- **R11** (area C, D) "bear in mind ios and android must have more parity with the desired behavior which the web already handles" — Plan: 30, 33, 34, 40, 41, 42
- **R12** (all areas; Review step) "if you see issues and aren't sure what is best then ask" — Plan: met by each area step's `## Decisions` list and the Review step, not by a numbered plan
- **R13** (area C) "After Play, mobile fetches the next rows of the auto-queue." — Plan: 30
- **R14** (area C) "Next turns on once a later row is found and stays off at the true end of the series, playlist, or album. Next does not stay on all the time the way it does on web." — Plan: 33
- **R15** (area C) "Mobile does what web does. Chapters come first. Past 3 seconds, Previous restarts the item. Otherwise it steps back through the auto-queue rows already played." — Plan: 31
- **R16** (area C) "With none left, it fetches the previous playlist row, album track (season order), or episode (publish date). With shuffle on, it only restarts." — Plan: 31
- **R17** (area C) "Account queue history is no longer what Previous uses." — Plan: 31
- **R18** (area C) "Mobile Add by RSS items get next and previous through their feed, matching web." — Plan: 32
- **R19** (area D) "Write a bounded window of resolved auto-queue rows into the native queue snapshot, so the native engine can advance with the app closed." — Plan: 40, 41, 42
- **R20** (area D) "JS refills the window while it is running." — Plan: 40
- **R21** (area D) "Policy stays in shared TypeScript; native code only moves through the snapshot it was given." — Plan: 40, 41, 42
- **R22** (area A) "Move the auto-queue source choice, the forward and backward walks, row mapping, and dedupe into `@podverse/playback-core`." — Plan: 10, 11
- **R23** (area B) "this set refactors web's auto-queue loader and Previous to use it" — Plan: 20, 21, 22, 23
- **R24** (area C) "Web and mobile both call the shared helper" (the mobile side) — Plan: 30
- **R25** (area B, C) "Cross-device's plans 23, 25, 33, and 34 touch the same mobile skip next/previous code and web track-button hooks this set changes, so anchor by symbol and do not edit that set's plans." — Plan: 21, 30, 31, 32
- **R26** (area A) "`isPlayablePlaylistResource`. Mobile inlines a slightly different removed-source check." — Plan: 10
- **R27** (area C) "`DOCS-MOBILE-PROCESS-PLAYBACK-QUEUE-PARITY.md` — the mobile queue parity doc to update." — Plan: 34
- **R28** (area D) "the 'Known gap' about refilling the auto-queue while the app is closed" (`podverse-media-engine/README.md`) — Plan: 43
- **R29** (area D; planning step 06) "Include clip and soundbite rows in the advance window, with their start and end times, so iOS and Android play that range. Do not end the window at the first clip or soundbite." — Plan: 40, 41, 42, 43, 44
- **R30** (area D; planning step 06) "While JavaScript is running, pre-resolve the next Add by RSS episodes into the window as plain media URLs, using the shared walk. Livestreams stay manual-queue only. Do not copy feed passwords into the native cache. An enclosure that will not play as a plain URL ends the window." — Plan: 40, 41, 42, 43, 44
- **R31** (area D; planning step 06) "While the app is closed, an item the car starts that is not in the window still falls back to the account queue snapshot. When JavaScript returns, continue the saved playlist, album, or podcast if the playing item belongs to that source. Otherwise refill from that item own podcast or album." — Plan: 43, 44
- **R32** (area D; planning step 07) "When the app reopens on a manual-queue item the car started, keep the saved playlist behind that queue, the same as on the phone. A same-podcast episode outside the saved rows, and not in that manual queue, still refills from its own channel." — Plan: 44, 43
- **R33** (area C; planning step 07) "The chapter-end id mismatch gets a plan in this set. When an item ends, the phone compares the engine id with `playbackTargetRowMediaId`. For a chapter that is the chapter id, and the engine reports the item id, so the comparison never matches and `advance('complete')` does not run." — Plan: 35

## Constraints every area carries

- Merge order: this set merges before `cross-device-playback`; whichever merges second rebases.
  Plans anchor edits by symbol, not line number, and never edit `.llm/plans/active/cross-device-playback/`.
- `@podverse/playback-core` depends only on `@podverse/helpers`. Shared walks cannot import
  `@podverse/helpers-requests` or either surface's request service; each surface passes its own
  fetch functions in. Storage and fetch stay per surface (**reuse-beyond-components**).
- Native code is transport only (**mobile-carplay-android-auto**): it advances through the
  snapshot JS wrote and makes no auto-queue choices.

## Areas

### Area A — Shared auto-queue policy in playback-core

- **Rows:** R1, R2, R4, R22, R26
- **Wave:** 1 · **Planning step:** 02 · **Plan number block:** 10–19
- **Starts from:** `packages/playback-core/src/resolveQueueAdvance.ts` and `index.ts`; the two
  loaders it collapses, `apps/web/src/hooks/useAutoQueueLoadResources.tsx` and
  `apps/mobile/src/hooks/useAutoQueueLoadResources.ts`; the backward walk in
  `runCorePreviousTrack` (`apps/web/src/hooks/useTrackPreviousButtonActions.ts`);
  `apps/web/src/lib/playlist/playablePlaylistResource.ts` and the mobile inline removed-source
  check; `AutoQueueConfig` in `apps/web/src/contexts/AutoQueue.tsx`;
  `apps/mobile/src/lib/autoQueue/autoQueue.ts`; `apps/mobile/src/data/repositories/autoQueueRepository.ts`.
- **Owns the contract:** source choice (sequential or shuffled playlist, music by season, podcast
  by publish date, shuffled channel), forward and backward walks, repeat wrap, row mapping to a
  playable target, shuffle dedupe, the playable-row check, and the fetcher interface each surface
  implements. It also decides whether the Add by RSS adjacent-row walk (web
  `useAddByRSSPlayNext` / `useAddByRSSPlayPrevious`, `resolveAddByRSSListContextFromCurrentItem`)
  belongs in the shared helper, and exposes a "resolve the next N rows" entry point area D can
  call for the native window.
- **Edits only** `packages/playback-core/**`. Callers on web and mobile move to the helper in
  areas B and C.
- **Depends on:** none.
- **Shares files with:** none (area B and C plans import its exports but do not edit its files).

### Area B — Web adopts the shared helper

- **Rows:** R23, R25 (web track-button hooks)
- **Wave:** 2 · **Planning step:** 03 · **Plan number block:** 20–29
- **Starts from:** `apps/web/src/hooks/useAutoQueueLoadResources.tsx`,
  `apps/web/src/hooks/useTrackPreviousButtonActions.ts`,
  `apps/web/src/hooks/useMediaPlayerControllerQueueHeadLoading.ts` (`fetchAutoQueueResources`),
  `apps/web/src/lib/playlist/playablePlaylistResource.ts` and its callers,
  `apps/web/src/hooks/useTrackNextButtonActions.ts`, the Add by RSS hooks if area A shares that
  walk, and `apps/web/src/components/MediaPlayer/MEDIA-PLAYER-DECISION-MATRIX.md`.
- **Behavior:** no change to web behavior. This is a refactor onto area A's helper; existing web
  tests are the guard.
- **Depends on:** area A (step 02, plans 10–19).
- **Shares files with:** none outside `apps/web`.

### Area C — Mobile in-app auto-queue parity

- **Rows:** R3, R6, R7, R8, R10, R11, R13, R14, R15, R16, R17, R18, R24, R25 (mobile skip code), R27
- **Wave:** 2 · **Planning step:** 04 · **Plan number block:** 30–39
- **Starts from:** `apps/mobile/src/playback/PlaybackProvider.tsx` (large; by symbol:
  `applyAutoQueueDirective`, `currentAutoQueueSeed`, `computeHasAutoQueueNext`,
  `advanceAutoQueue`, `resolveHasAutoQueueRow`, `probeHasQueueAhead`, `advance`,
  `resolvePreviousQueueResource`, `skipToPrevious`, `skipToPreviousTrack`, `skipToNext`,
  `skipToNextTrack`, remote track command handlers), `apps/mobile/src/screens/player/FullPlayerScreen.tsx`
  (`autoUpcomingCount`, `canSkipToNext`, `handleToggleShuffle`, `autoQueueSeedFromTarget`),
  `apps/mobile/src/components/player/FullPlayerTransportRow.tsx`,
  `apps/mobile/src/components/player/fullPlayerRows.ts`, `apps/mobile/src/playback/previousAction.ts`,
  `apps/mobile/src/hooks/useAutoQueueLoadResources.ts`, `apps/mobile/src/lib/autoQueue/autoQueue.ts`,
  `apps/mobile/src/data/repositories/autoQueueRepository.ts`, `apps/mobile/src/hooks/useAddByRssPlayback.ts`,
  and `docs/proposals/mobile/app-development-process/DOCS-MOBILE-PROCESS-PLAYBACK-QUEUE-PARITY.md`.
- **Covers:** the eager forward fill after an explicit play (web's
  `useMediaPlayerControllerQueueHeadLoading` is the parity source), the Next enable state per the
  operator answer, Previous per the operator answer (replacing account queue history), Add by RSS
  next and previous through the feed, and the mobile loader moving onto area A's helper. Answers
  R3 with a gap list in a plan.
- **Depends on:** area A (step 02, plans 10–19).
- **Shares files with:** area D (`PlaybackProvider.tsx`, the queue parity doc).

### Area D — Native auto-queue window for CarPlay, Android Auto, and the lock screen

- **Rows:** R5, R9, R11 (native side), R19, R20, R21, R28
- **Wave:** 3 · **Planning step:** 05 · **Plan number block:** 40–49
- **Starts from:** `apps/mobile/src/data/nativeCache/projection.ts` (`writeQueueSnapshotAv`,
  `writeQueueSnapshotMusic`) and `carCacheReproject.ts`;
  `apps/mobile/modules/podverse-media-engine/ios/PodverseAudioEngine.swift`,
  `PodverseNativeCache.swift`, `PodverseCarPlayCacheModel.swift`; Android
  `PodverseAudioEngine.kt`, `PodverseNativeCache.kt`, `PodverseNativeCacheModel.kt`,
  `PodverseMediaLibraryService.kt`, `PodverseCarHeadlessSyncService.kt` (`jsOwnsAdvance`,
  `handleItemEnded`, `advanceToNextCachedItem`); `apps/mobile/modules/podverse-media-engine/README.md`.
- **Covers:** a bounded window of resolved auto-queue rows appended to the native queue snapshot
  after the account queue, JS refilling it while running, the native engine advancing through it
  with the app closed, and how R9's "other potential clients" are served by the shared helper
  plus the snapshot contract.
- **Depends on:** area A (step 02, plans 10–19) for the window entry point, and area C (step 04,
  plans 30–39) for where mobile holds resolved auto-queue rows and refills them.
- **Shares files with:** area C (`PlaybackProvider.tsx`, the queue parity doc).

## Waves

| Wave | Step | Area | Rows | Planning model |
| --- | --- | --- | --- | --- |
| 1 | 02 | A — Shared auto-queue policy in playback-core | R1, R2, R4, R22, R26 | Opus 5.5 · high |
| 2 | 03 | B — Web adopts the shared helper | R23, R25 | Cursor Grok 4.7 · high |
| 2 | 04 | C — Mobile in-app auto-queue parity | R3, R6, R7, R8, R10, R11, R13–R18, R24, R25, R27 | Opus 5.5 · high |
| 3 | 05 | D — Native auto-queue window | R5, R9, R11, R19, R20, R21, R28 | Opus 5.5 · high |

Areas B and C plan in parallel: their files are disjoint (web versus mobile). Area D waits for C
because both edit `PlaybackProvider.tsx` and D's refill builds on where C keeps the rows.

## Order

- **First pass:** waves 1–3 (steps 02–05) wrote plans 10–11, 20–23, 30–34, and 40–43.
- **Second pass after the first review:** step 06 revises area D's plans 40–43 for R29 (clip and
  soundbite rows in the window), R30 (Add by RSS episodes in the window), and R31 (continue the
  saved source when JS returns). It may edit plan 30 only if R31 needs the saved auto-queue source
  to outlive an app restart. Close runs after step 06.
- **Third pass after the second review:** step 07 revises plan 44 for R32 (a manual-queue item
  keeps the saved playlist behind it) and adds a plan for R33 (the chapter-end id mismatch).
  Close runs again after step 07 and rewrites the set files from scratch.
- **Close:** after step 07, the set is 17 plans in 10 phases. Plan 35 (R33) runs alone after
  plan 44, and plan 43 still closes the set. See `00-EXECUTION-ORDER.md`.

## Decisions to review

Collected from the `## Decisions` list of each area step's final message. Each item gives the
choice made and the main alternative.

**Outcome of the first review** (answers in `00-REQUEST.md` § Review of the first planning pass):
every decision is accepted except D13, D14, and D18, which change as R29, R30, and R31.

### Step 02 — Area A (shared policy in playback-core)

- **D1** (step 02, plan 11) The Add by RSS walk is shared. Only the pure stepping, context building, and episode ordering move into playback-core. Alternative: keep it per surface and have mobile copy web's hooks.
- **D2** (step 02, plan 10) Podcast repeat keeps web's wrap: at the end of a podcast, repeat starts again from the newest episode. Alternative: wrap to the oldest episode, which changes web.
- **D3** (step 02, plan 10) Shuffle plus repeat keeps web's one-pass stop: dedupe spans the whole buffer, so after every row has played the repeat wrap adds nothing and playback stops. Alternative: reset dedupe at the wrap so repeat actually repeats, which changes web.

### Step 03 — Area B (web adopts the shared helper)

- **D4** (step 03, plans 20 and 21) Web walks ignore the stored `disabled` flag. They pass a config copy with `disabled: false`, so livestream plays and the clip editor (which store `disabled: true`) still get forward and backward fills, as today. Alternative: pass the stored flag through, so those plays seed only the current row and fetch nothing. Mobile keeps honoring `disabled` either way.

### Step 04 — Area C (mobile in-app parity)

- **D5** (step 04, plan 30) The forward fill runs after every load that has a seed, including resume on launch and queue-head adoption, without blocking load or first paint. Alternative: fill only after the user presses Play, leaving Next off on a resumed item.
- **D6** (step 04, plan 33) Next stays off while a fill is running and after a fill fails. Alternative: show Next on while unknown and let the press confirm.
- **D7** (step 04, plan 32) Add by RSS Next checks the manual queue first, the same as `ended`, keeping one advance path. Alternative: web's split, where the Next button skips the manual queue and `ended` checks it first.
- **D8** (step 04, plan 32) The Add by RSS walk is built from the playing item's feed on this device; items with no enclosure URL are left out. Alternative: pass the list the user tapped from each screen, as web does. For a single feed both give the same result.
- **D9** (step 04, plan 30) A load from the manual queue keeps the auto-queue buffer (`preserve`, unchanged), so the earlier auto-queue source continues after the manual queue empties. Alternative: clear the buffer on every manual-queue load.
- **D10** (step 04, plan 31) Previous does not move the item being left to history, matching web. Alternative: reuse the history write from `advance('skip')`.

### Step 05 — Area D (native auto-queue window)

- **D11** (step 05, plans 40, 41, 42) Rows go in a separate `advance-window.json` file, because two existing writers rewrite the account queue snapshot and would wipe appended rows. Alternative: append them to the snapshot, as R19's wording says.
- **D12** (step 05, plans 41, 42) The car Queue tab is unchanged and lists only the account queue. Alternative: show the window rows there.
- **D13** (step 05, plan 40) Clip and soundbite rows end the window. Alternative: pass clip start and end times through for native to play.
- **D14** (step 05, plan 40) Add by RSS items and livestreams get only the manual-queue part of the window, since native has no Add by RSS credentials or feed walk.
- **D15** (step 05, plans 41, 42) Previous with the app closed still only restarts the track.
- **D16** (step 05, plan 40) The window holds 10 rows, and the in-app fill target rises from 1 to 10 to keep it full, so mobile fetches more rows ahead than web. Alternative: keep the target at 1 and accept a short or empty window after the last fetched row.
- **D17** (step 05, plan 40) Auto rows start from saved progress unless the item was already played, matching car lists today. Alternative: always start at 0.
- **D18** (step 05, plans 40, 43) The window only helps items the phone started. An item the car starts that is not in the window falls back to the account snapshot; when JS returns, it refills from that item's own podcast or album, so a playlist walk does not continue.
- **D19** (step 05, plan 40) A row in both the manual queue and the auto-queue plays once, at its manual position.
- **D20** (step 05, plans 41, 42) Native takes advance back when the JS module goes away, by resetting `jsOwnsAdvance` when the event sink is cleared. Today the flag can stay true with nobody listening.
