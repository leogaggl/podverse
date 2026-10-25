# Cross-device playback — execution order

Prompts and models: [COPY-PASTA.md](COPY-PASTA.md). Request and settled review answers:
[00-REQUEST.md](00-REQUEST.md). Ledger, areas, and decisions: [00-SUMMARY.md](00-SUMMARY.md).

Phases run one after another. Prompts inside one phase run at once and own disjoint files. In a
phase with several prompts, no prompt writes `release-notes/scratchpad.md`; each puts its entry
in its final message under "Release notes entry", and prompt 58 appends them all. Prompts that run
alone (59, 57, 58) append their own entry.

## Outside this set

These sets are planned but not implemented. All four must be complete on this branch before
Phase 1. Every prompt re-checks the paths it builds on and reports BLOCKED, naming the set and
plan, when one is missing.

- **`realtime-banner-notifications`** (whole set): the event contract
  `packages/helpers/src/lib/accountEventStream.ts` (plan 10), the Redis fanout (plans 11, 13–15),
  `GET /account/events` and `accountEventStreamHub.ts` (plan 12), the docs (plan 16), the web stream
  coordinator (plan 30), and the mobile stream runtime with `runWithMobileAuthRefresh` (plan 40).
- **`auth-sessions`** (whole set): `account_session` rows and the session id on the request
  (plans 10, 20), web device labels (plan 20), the session endpoints (plan 22), and mobile device
  labels on `POST /auth/mobile/token` (plan 42). Plan 57's Maestro script uses
  `GET /auth/sessions` and `DELETE /auth/sessions/:id_text`.
- **`auth-sessions-stream-close`** plan 70: the session id on each hub stream and `endStream`,
  which plan 14 uses for presence on `session.ended`.
- **`web-player-marquee`** plans 20, 21, and 30: the bar title on `itemTitle`, and
  `MediaPlayerSegmentStrip`, which plan 42 wires into the remote view. Needed by Phase 9; landing
  the whole set before Phase 1 is simplest.

## Dependency graph

From each plan's `## Runs after`, plus two orderings the planners named in notes: mobile plans
31–35 also need plan 13's request calls, and plan 50 needs plan 40's status keys.

| Plan | Runs after |
| --- | --- |
| 10 playback stream contract | none (realtime 10) |
| 11 shared helpers | 10 |
| 12 API Redis store | 10, 11 |
| 13 API routes and request calls | 10, 11, 12 |
| 14 stream delivery | 10, 11, 12 (realtime 12, stream-close 70) |
| 15 API docs | 13, 14 |
| 20 web stream events | 10 (realtime 30) |
| 21 web runtime library | 10, 11 |
| 22 web provider core | 13, 20, 21 |
| 23 web command executor | 22, 27 |
| 24 web transfer | 23 |
| 25 web remote control routing | 24 |
| 26 web handoff prompt yields | 22 |
| 27 playback-core start clamp | none |
| 30 mobile store and policy | 10, 11 |
| 31 mobile stream presence | 30, 13 (realtime 40) |
| 32 mobile state publish | 31 |
| 33 mobile commands | 32, 27 |
| 34 mobile remote control routing | 33 |
| 35 mobile handoff prompt gate | 34 |
| 36 mobile runtime docs | 35 |
| 40 player copy (consumer catalog) | none |
| 41 `@podverse/ui` dropdown radio items | none |
| 42 web remote player display | 22, 24, 25, 26, 40, 49 (marquee 20, 21, 30) |
| 43 web remote progress bar | 42 |
| 44 web devices button | 40, 41, 42 |
| 45 web tap-to-play and notice | 23, 24, 40, 42 |
| 46 web item rows | 42, 49 |
| 47 web Playwright spec | 13, 14, 22–26, 42–46, 49 |
| 48 web decision matrix | 42–47, 49 |
| 49 web remote resource data | 24 |
| 50 mobile player display model | 30, 33, 40 |
| 51 mobile mini player | 50, 34 |
| 52 mobile device sheet | 51, 34 |
| 53 mobile notices | 50, 34 |
| 54 mobile remote scrubber | 50 |
| 55 mobile full player | 34, 51, 52, 54 |
| 56 mobile rows and queue | 50, 34 |
| 57 mobile Maestro flow | 55, 56, 53, 59 |
| 58 mobile player docs, closes the set | 57, 59, 36 |
| 59 mobile chapter rows | 50, 55 |

## Shared files that set the order

- **`packages/helpers/src/index.ts` and `package.json`:** 10, then 11.
- **Consumer catalog originals:** 40 (Phase 1), then 50 (Phase 9). Overrides `es`, `fr`, `el-GR`:
  40, then 50; both mirror their keys with empty strings so `i18n:validate` passes.
- **`apps/web/src/lib/crossDevicePlayback/playbackResource.ts` and its test:** 21, then 22.
- **`apps/web/src/contexts/CrossDevicePlayback.tsx`:** 22, 23, 24, 25.
- **`useTrackNextButtonActions.ts`, `useTrackPreviousButtonActions.ts`:** 23, then 25.
- **`usePlaybackResourceLoader.ts`:** 23, then 49. **`useCrossDevicePlaybackTransfer.ts`:** 24,
  then 49.
- **`MediaPlayerController.tsx`:** 25, 42, then 45.
- **`MediaPlayerButtonsDesktop.tsx`, `MediaPlayerButtonsMobile.tsx`, `MediaPlayerButtonsModal.tsx`:**
  42, then 44.
- **`apps/mobile/vitest.config.ts`:** 30, 31, 32, 33, 34, 50, 59, each in its own phase.
- **`apps/mobile/src/playback/PlaybackProvider.tsx` and `crossDevice/useCrossDevicePlayback.ts`:**
  31 through 35, in sequence.
- **`crossDevice/crossDevicePlaybackPolicy.ts`:** 30, 32, 35. **`crossDevicePlaybackCommandRunner.ts`:**
  33, then 35.
- **`MiniPlayer.tsx`:** 51, then 52. **`FullPlayerUtilityRow.tsx`:** 52, then 55.
  **`FullPlayerScreen.tsx`:** 55, then 59.
- **`apps/mobile/APPS-MOBILE.md` and `.cursor/skills/mobile-playback/SKILL.md`:** 36, then 58.
- **`release-notes/scratchpad.md`:** written only by 59 and 58, which run alone.

## Phases

### Phase 1 — contract, start clamp, player copy, dropdown radio items

- **10** owns `packages/helpers/src/lib/accountPlaybackStream.ts` and its test,
  `accountEventStream.ts`, `medium.ts` and its test, `packages/helpers/src/index.ts`, and
  `packages/helpers/package.json`.
- **27** owns `packages/playback-core/src/clampNearEndSeconds.ts`, `src/index.ts`, and
  `src/__tests__/clampNearEndSeconds.test.ts`.
- **40** owns the four consumer catalog originals and the `es`, `fr`, `el-GR` consumer overrides.
- **41** owns `packages/ui/src/components/navigation/DropdownMenu/DropdownMenuPanel.tsx`, its
  `.module.scss`, and its test.

### Phase 2 — shared helpers, web stream events

- **11** owns `packages/helpers/src/lib/crossDevicePlayback.ts` and its test,
  `packages/helpers/src/index.ts`, and `packages/helpers/package.json`.
- **20** owns `apps/web/src/lib/notifications/stream/notificationStreamConnection.ts`,
  `notificationStreamCoordinator.ts`, their tests, and `apps/web/src/contexts/Notifications.tsx`.

### Phase 3 — API Redis store, web runtime library, mobile store and policy

- **12** owns `apps/api/src/lib/accountPlayback/` (`playbackRedis`, `playbackStoreScripts`,
  `playbackStore`, `playbackStatePolicy`, `playbackService`, and tests),
  `apps/api/src/test/account-playback-store.test.ts`, `packages/orm/src/lib/accountEventPublisher.ts`,
  `apps/api/src/index.ts`, `apps/api/src/test/helpers/index.ts`, and `apps/api/ENV.md`.
- **21** owns `apps/web/src/lib/crossDevicePlayback/` `crossDevicePlaybackStore`,
  `tabPlaybackRole`, `playbackTabChannel`, `playbackResource`, `playbackPublishScheduler`, and
  their tests.
- **30** owns `apps/mobile/src/playback/crossDevice/crossDevicePlaybackStore.ts`,
  `crossDevicePlaybackPolicy.ts`, their tests, and `apps/mobile/vitest.config.ts`.

### Phase 4 — API routes, stream delivery

- **13** owns `apps/api/src/@types/express.d.ts`, `apps/api/src/lib/auth/index.ts`,
  `routes/accountPlayback.ts`, `controllers/account/accountPlayback.ts`, `app.ts`,
  `src/test/account-playback.test.ts`, `apps/api/openapi.yml`, and
  `packages/helpers-requests/src/api/account/playback.ts`, its test, `_request.ts`, and
  `api/index.ts`. Its release entry goes in its final message.
- **14** owns `apps/api/src/lib/accountEventStream/accountEventStreamHub.ts`, its test, and
  `apps/api/src/test/account-events.test.ts`.

### Phase 5 — API docs, web provider core, mobile stream presence

- **15** owns `docs/architecture/ARCHITECTURE.md`, `apps/api/APPS-API.md`, and
  `.cursor/skills/media-player-architecture/SKILL.md`.
- **22** owns `apps/web/src/contexts/CrossDevicePlayback.tsx`,
  `components/CrossDevicePlayback/CrossDevicePlaybackPublisher.tsx`, `crossDevicePlaybackCheckIn`,
  `playbackClaim`, `playbackResource` (and tests), `providers/Providers.tsx`, and the
  `useQueueResourceUpdateNowPlaying`, `useQueueResourceMoveNowPlayingToHistory`, and
  `useAddByRSSPositionSave` hooks with their tests.
- **31** owns `apps/mobile/src/notifications/notificationStreamClient.ts`,
  `notificationStreamController.ts` and its test, `notificationStreamStore.ts`,
  `data/repositories/crossDevicePlaybackRepository.ts`, `data/repositories/index.ts`,
  `crossDevice/crossDevicePresenceController.ts` and its test, `crossDevice/useCrossDevicePlayback.ts`,
  `PlaybackProvider.tsx`, `sync/SyncProvider.tsx`, and `apps/mobile/vitest.config.ts`.

### Phase 6 — web command executor, web handoff prompt, mobile publish

- **23** owns the files in plan 23's `## Files`: `playbackCommandInbox`,
  `reportPlaybackStartFailed`, `commandStartSeek` (and tests), `lib/playback/index.ts`,
  `usePlaybackResourceLoader.ts`, `useCrossDevicePlaybackCommandExecutor.ts`,
  `useMediaElementBridge.ts` and its test, the two track-button hooks, `MediaPlayerControls.tsx`,
  `CrossDevicePlayback.tsx`, `CrossDevicePlaybackTrackCommands.tsx`,
  `NonLiveMediaOrchestrator.tsx`, and `MediaPlayerControllerLiveStreamAV.tsx`.
- **26** owns `apps/web/src/hooks/useMediaPlayerControllerQueueHeadLoading.ts` and its test.
- **32** owns `crossDevice/crossDevicePlaybackPublisher.ts` and its test,
  `crossDevicePlaybackPolicy.ts` and its test, `useCrossDevicePlayback.ts`, `PlaybackProvider.tsx`,
  and `apps/mobile/vitest.config.ts`.

### Phase 7 — web transfer, mobile commands

- **24** owns `takeOverTabChoice`, `resolveTakeOverStart` (and tests),
  `useCrossDevicePlaybackTransfer.ts`, and `CrossDevicePlayback.tsx`.
- **33** owns `crossDevicePlaybackCommandRunner.ts`, `commandedStartClamp.ts` (and tests),
  `useCrossDevicePlayback.ts`, `apps/mobile/src/lib/addByRss/localResourceData.ts` and its test,
  `PlaybackProvider.tsx`, and `apps/mobile/vitest.config.ts`.

### Phase 8 — web remote routing, web remote resource data, mobile remote routing

- **25** owns the files in plan 25's `## Files`: `playbackCheckInRequest`, `sendPlaybackCommand`,
  `remotePlaybackRouting` (and tests), `CrossDevicePlayback.tsx`, `usePlayerTransport.ts`, the two
  track-button hooks, `useMediaPlayerResourceUpdate.tsx`, `usePlayAddByRSS.tsx` and their tests,
  the `PlayButton`, `PlayButtonMobile`, jump, increment, `PlaybackSpeedButton`, and
  `SettingsButton` components, `MediaPlayerController.tsx`, and `mediaPlayerWindowKeyDown.ts` and
  its test.
- **49** owns `fetchPlaybackResourceDtos`, `addByRSSResourceDataForHash`,
  `remotePlayerResourceStore`, `remotePlaybackClock` (and tests), `useRemotePlayerResource.ts`,
  `useRemotePlaybackPositionSeconds.ts`, `usePlaybackResourceLoader.ts`, and
  `useCrossDevicePlaybackTransfer.ts`.
- **34** owns `crossDevicePlaybackRemoteControl.ts` and its test, `useCrossDevicePlayback.ts`,
  `PlaybackProvider.tsx`, and `apps/mobile/vitest.config.ts`.

### Phase 9 — mobile handoff gate, web remote display, mobile display model

- **35** owns `useCrossDevicePlayback.ts`, `crossDevicePlaybackCommandRunner.ts`,
  `crossDevicePlaybackPolicy.ts` and its test, and `PlaybackProvider.tsx`.
- **42** owns the files in plan 42's `## Files`: `remotePlayerDisplay`, `remotePlayerInfo`,
  `playbackDeviceName` (and tests), `useRemotePlayerDisplay.ts`, `useRemotePlayerInfo.ts`,
  `usePlaybackDevices.ts`, `CrossDevice/PlayerDeviceCaption.tsx` and `RemoteLiveLabel.tsx` with
  their styles, `MediaPlayer.tsx`, `MediaPlayerController.tsx`, `MediaPlayerSegmentStrip.tsx`,
  `PlaylistAddToButton.tsx`, and the Desktop, Mobile, and Modal `Info`, `Controls`, and `Buttons`
  components.
- **50** owns `crossDevicePlayerDisplay.ts` and its test, `useCrossDevicePlayerDisplay.ts`,
  `useDisplayedAddByRssResourceData.ts`, `apps/mobile/vitest.config.ts`, the four consumer catalog
  originals, and the `es`, `fr`, `el-GR` consumer overrides (`media_player.devices` only).

### Phase 10 — web player pieces, mobile player pieces, mobile runtime docs

Nine prompts, each in its own files.

- **36** owns `apps/mobile/APPS-MOBILE.md` and `.cursor/skills/mobile-playback/SKILL.md`.
- **43** owns `Sliders/MediaPlayerProgress.tsx` and `Sliders/RemoteMediaPlayerProgress.tsx`.
- **44** owns `playbackDeviceMenu.ts` and its test, `Buttons/PlaybackDevicesButton.tsx` and its
  style, and the three `MediaPlayerButtons*` components.
- **45** owns `CrossDevice/CrossDevicePlaybackNotices.tsx` and `MediaPlayerController.tsx`.
- **46** owns `remotePlaybackRowMatch.ts` and its test, `useRemoteRowPlayback.ts`,
  `PlayButtonRow.tsx`, `PlayButtonLarge.tsx`, `ListItemChapterRow.tsx`,
  `ItemChapterHeaderPlaySection.tsx`, and the Add by RSS item, episode, track, and livestream rows
  and headers in plan 46's `## Files`.
- **51** owns `MiniPlayer.tsx`, `MiniPlayerRemote.tsx`, `useMiniPlayerVisible.ts`,
  `NowPlayingSegmentBar.tsx`, `useBottomChromeOverlayInsetSource.ts`, `nowPlayingSegment.ts` and
  its test, and `useNowPlayingChapters.ts`.
- **53** owns `components/feedback/CrossDevicePlaybackNotice.tsx` and `apps/mobile/App.tsx`.
- **54** owns `FullPlayerScrubber.tsx`.
- **56** owns `MediaRowActions.tsx`, `useHomeRowPlayback.ts`, `useAddByRssPlayback.ts`, and
  `LibraryQueueScreen.tsx`.

### Phase 11 — web Playwright spec, mobile device sheet

- **47** owns `apps/web/e2e/media-player-cross-device-remote.spec.ts`,
  `e2e/helpers/crossDevicePlayback.ts`, `e2e/helpers/mediaPlayerAssertions.ts`,
  `e2e/media-player-music-playback.spec.ts`, and `makefiles/local/e2e-spec-order-web.txt`.
- **52** owns `PlaybackDeviceButton.tsx`, `PlaybackDeviceSheet.tsx`, `MiniPlayer.tsx`, and
  `FullPlayerUtilityRow.tsx`.

### Phase 12 — web decision matrix, mobile full player

- **48** owns `apps/web/src/components/MediaPlayer/MEDIA-PLAYER-DECISION-MATRIX.md`.
- **55** owns the files in plan 55's `## Files`: `FullPlayerRemoteRegion.tsx`,
  `FullPlayerScreen.tsx`, `FullPlayerSpeedControl.tsx`, `fullPlayerContentLink` and its test,
  `FullPlayerSegmentBand.tsx`, `FullPlayerTransportRow.tsx`, `FullPlayerUtilityRow.tsx`,
  `fullPlayerRows` and its test, and `apps/mobile/src/lib/share/` `shareUrl` (and test) and
  `shareNowPlaying.ts`.

### Phase 13 — mobile chapter rows

- **59**, alone (it edits `FullPlayerScreen.tsx` after 55 and `apps/mobile/vitest.config.ts`).

### Phase 14 — mobile Maestro flow

- **57**, alone. Owns `apps/mobile/e2e/scripts/playback-other-device.js`,
  `apps/mobile/e2e/playback-cross-device.yaml`, `scripts/mobile/e2e-test.sh`, and
  `apps/mobile/e2e/HOW-TO-RUN.md`.

### Phase 15 — mobile player docs, then close the set

- **58**, alone. Owns `apps/mobile/APPS-MOBILE.md`, `.cursor/skills/mobile-playback/SKILL.md`, and
  `.cursor/rules/mobile-player-fixed-region.mdc`. Appends every parallel prompt's release entry,
  archives the set, and carries the cumulative verification.

## Release entries collected by prompt 58

From `.artifacts/plan-runner/cross-device-playback/<NN>.md`, in phase order. Plans with an entry:
13, 22, 31, 23, 26, 32, 24, 33, 25, 34, 35, 42, 43, 44, 45, 46, 51, 53, 56, 52, 55. Plan 59
appends its own. Every other plan has none.
