# Mobile auto-queue parity — execution order

Prompts and models: [COPY-PASTA.md](COPY-PASTA.md). Request and settled review answers (first
pass D1–D20 with R29–R31, second pass R32 and R33): [00-REQUEST.md](00-REQUEST.md). Ledger and
decisions: [00-SUMMARY.md](00-SUMMARY.md).

Phases run one after another. Prompts inside one phase run at once and own disjoint files,
counting the shared files in **parallel-plan-execution** § Shared files (the mobile E2E YAML,
`apps/mobile/vitest.config.ts`, and the scratchpad). In a phase with several prompts, no prompt
writes `release-notes/scratchpad.md`; each puts its entry in its final message under "Release
notes entry", and prompt 43 appends them all. Prompts that run alone (11, 33, 44, 35) append their
own entry. Plan 43 has no entry of its own.

Web and mobile import `@podverse/playback-core` through its built `dist` (`exports` point at
`dist/`; mobile links it with `file:../../packages/playback-core`). Prompts 10 and 11 each end by
building the package. Prompt 10 shares Phase 1 only with the Swift and Kotlin prompts, and prompt
11 runs alone, so no consumer type-checks against `dist` while it is being rewritten. No later
prompt edits or builds `packages/playback-core`.

Every prompt anchors edits by symbol and leaves `.llm/plans/active/cross-device-playback/`
untouched. That set edits the same mobile skip code and web track-button hooks and merges after
this one.

## Dependency graph

From each plan's `## Runs after`:

| Plan | Runs after |
| --- | --- |
| 10 playback-core auto-queue policy | none |
| 11 playback-core Add by RSS list walk | 10 |
| 20 web loader calls `fillAutoQueueForward` | 10 |
| 21 web Previous calls `resolveAutoQueuePrevious` | 10, 20 |
| 22 web Add by RSS calls the shared step | 11 |
| 23 web player matrix pointers | 20, 21, 22 |
| 30 mobile shared fill and refill guard | 10 |
| 31 mobile Previous through the auto-queue | 30 |
| 32 mobile Add by RSS feed walk | 11, 31 |
| 33 mobile full player Next state | 30, 32 |
| 34 mobile parity doc and playback skill | 33 |
| 40 mobile writes the native advance window | 33 |
| 41 iOS engine walks the advance window | none |
| 42 Android engine walks the advance window | none |
| 44 mobile adopts the saved advance source | 40 |
| 35 mobile chapter end advances | 40, 44 |
| 43 native advance window docs, closes the set | 34, 40, 41, 42, 44 |

Plan 43 also runs after 35: it is the set's last prompt and must run alone.

## Phases

### Phase 1 — shared policy, native engines

- **10** owns `packages/playback-core/src/autoQueue.ts`, `autoQueueWalk.ts`, their tests in
  `src/__tests__/`, `src/index.ts`, `package.json`, and `PACKAGES-PLAYBACK-CORE.md`. It builds
  the package at the end.
- **41** owns `apps/mobile/modules/podverse-media-engine/ios/PodverseNativeCache.swift`,
  `PodverseCarPlayCacheModel.swift`, `PodverseMediaEngineModule.swift`, and
  `PodverseAudioEngine.swift`.
- **42** owns the Android `PodverseNativeCache.kt`, `PodverseNativeCacheModel.kt`,
  `PodverseMediaEngineModule.kt`, and `PodverseAudioEngine.kt` under
  `apps/mobile/modules/podverse-media-engine/android/src/main/java/expo/modules/podversemediaengine/`.

The native prompts implement the `advance-window.json` payload (clip and soundbite ranges, plain
Add by RSS media URLs) their plans copy from plan 40; the JS writer lands in Phase 7.

### Phase 2 — shared Add by RSS walk

- **11**, alone. It edits `packages/playback-core/src/index.ts`, `package.json`, and
  `PACKAGES-PLAYBACK-CORE.md` after plan 10, adds `addByRSSListWalk.ts` and its test, builds the
  package, and appends its own scratchpad entry.

### Phase 3 — web loader, web Add by RSS step, mobile fill

- **20** owns `apps/web/src/hooks/useAutoQueueLoadResources.tsx`,
  `apps/web/src/lib/autoQueue/webAutoQueueSourceFetchers.ts` and its test,
  `apps/web/src/contexts/AutoQueue.tsx`, and `ShuffleButton.tsx` and `RepeatButton.tsx` under
  `apps/web/src/components/MediaPlayer/Buttons/`.
- **22** owns `apps/web/src/hooks/useAddByRSSPlayNext.tsx`, `useAddByRSSPlayPrevious.tsx`,
  `apps/web/src/utils/addByRSS/resolveListContextFromCurrentItem.ts`, and
  `apps/web/src/contexts/AddByRSSListContext.tsx`.
- **30** owns `apps/mobile/src/data/repositories/autoQueueRepository.ts`,
  `apps/mobile/src/lib/autoQueue/autoQueue.ts` and its test,
  `apps/mobile/src/contexts/AutoQueueProvider.tsx`, the deletion of
  `apps/mobile/src/hooks/useAutoQueueLoadResources.ts`, the new
  `apps/mobile/src/playback/autoQueueFillGate.ts` and its test and `useAutoQueueFill.ts`,
  `PlaybackProvider.tsx`, `apps/mobile/src/screens/player/FullPlayerScreen.tsx`, and
  `apps/mobile/vitest.config.ts`.

### Phase 4 — web Previous, mobile Previous

- **21** owns `apps/web/src/hooks/useTrackPreviousButtonActions.ts` (the body of
  `runCorePreviousTrack` only) and the deletion of
  `apps/web/src/lib/playlist/playablePlaylistResource.ts`.
- **31** owns `apps/mobile/src/lib/autoQueue/autoQueue.ts` and its test,
  `apps/mobile/src/playback/useAutoQueueFill.ts`, and `PlaybackProvider.tsx`.

### Phase 5 — web matrix pointers, mobile Add by RSS walk

- **23** owns `apps/web/src/components/MediaPlayer/MEDIA-PLAYER-DECISION-MATRIX.md`.
- **32** owns `apps/mobile/src/lib/addByRss/feedWalk.ts` and its test,
  `apps/mobile/src/lib/addByRss/localResourceData.ts`,
  `apps/mobile/src/hooks/useAddByRssPlayback.ts`, the new
  `apps/mobile/src/playback/useAddByRssFeedWalk.ts`, `PlaybackProvider.tsx`, and
  `apps/mobile/vitest.config.ts`.

### Phase 6 — mobile Next state

- **33**, alone. It edits `PlaybackProvider.tsx`, `FullPlayerScreen.tsx`, and
  `apps/mobile/e2e/auto-queue-advance.yaml` after plans 30 and 32, and appends its own scratchpad
  entry.

### Phase 7 — mobile parity docs, native advance window writer

- **34** owns
  `docs/proposals/mobile/app-development-process/DOCS-MOBILE-PROCESS-PLAYBACK-QUEUE-PARITY.md` and
  `.cursor/skills/mobile-playback/SKILL.md`.
- **40** owns the `apps/mobile/src/data/nativeCache/` files it lists (`projection.ts` and its
  test, `index.ts`, the new `queueEntryMapping.ts` and `advanceWindow.ts` and their tests,
  `carCacheReproject.ts`), `queueRepository.ts`, `queueProjectionHelpers.ts`,
  `apps/mobile/src/lib/playback/mediaEngineSourceMeta.ts` and its test, the new
  `apps/mobile/src/lib/addByRss/playbackUrl.ts` and its test,
  `apps/mobile/src/playback/addByRssMediaAuth.ts`, `apps/mobile/src/bridge/nativePlaybackBridge.ts`,
  `apps/mobile/modules/podverse-media-engine/src/PodverseMediaEngineModule.ts` and
  `NativePlaybackBridge.ts`, the new `apps/mobile/src/playback/useNativeAdvanceWindow.ts`,
  `useAutoQueueFill.ts`, `useAddByRssFeedWalk.ts`, `PlaybackProvider.tsx`, and
  `apps/mobile/vitest.config.ts`.

Plan 43 edits the two docs plan 34 owns, three phases later.

### Phase 8 — adopt the saved advance source

- **44**, alone. It edits `queueRepository.ts`, `useNativeAdvanceWindow.ts`, and
  `PlaybackProvider.tsx` after plan 40, adds `nativeAdvanceSource.ts` and its test and
  `nativeAdvanceSourceRepository.ts`, edits `engineSourceAdoption.ts` and its test and
  `apps/mobile/src/lib/addByRss/feedWalk.ts` and its test, and `apps/mobile/vitest.config.ts`, and
  appends its own scratchpad entry. It covers R31 and R32: a manual-queue item the car started
  keeps the saved buffer behind that queue.

### Phase 9 — chapter end advances

- **35**, alone. It edits `apps/mobile/src/lib/playback/mediaEngineSourceMeta.ts` and its test
  after plan 40, `apps/mobile/src/lib/playback/buildPlaybackTarget.ts` (doc comment only), and the
  `ended` and `progress` handlers in `PlaybackProvider.tsx` after plan 44, and appends its own
  scratchpad entry. It is the last edit to `PlaybackProvider.tsx` in the set.

Mobile's Vitest `include` is an explicit list. Plans 30, 32, 40, and 44 each add their new test
files to it (plan 30 also adds the existing `src/lib/autoQueue/autoQueue.test.ts`, which the list
skips today). Plan 35 adds cases to `mediaEngineSourceMeta.test.ts`, which is already listed.
Each is the only mobile prompt in its phase.

### Phase 10 — native window docs, then close the set

- **43**, alone. It edits the media-engine `README.md`, `CARPLAY-SIMULATOR-CHECKLIST.md`,
  `ANDROID-AUTO-DHU-CHECKLIST.md`, the queue parity doc, `.cursor/rules/mobile-carplay-android-auto.mdc`,
  and the **mobile-playback** skill, after plans 34, 40, 41, 42, and 44. It appends every parallel
  prompt's release entry, archives the set, and carries the cumulative verification.

## Release entries collected by prompt 43

From `.artifacts/plan-runner/mobile-auto-queue-parity/<NN>.md`, in this order: 10, 41, 42, 30,
31, 32, 40. Plans 20, 21, 22, 23, and 34 carry no entry; plans 11, 33, 44, and 35 append their
own; plan 43 has none.
