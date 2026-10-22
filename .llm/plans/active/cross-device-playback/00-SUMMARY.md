# Cross-device playback — summary

Request and operator answers: [00-REQUEST.md](00-REQUEST.md). Prompts and models: `COPY-PASTA.md`
(written by the planning run's Close step).

## Planning notes

- This set builds on two sets that are planned but not implemented: `realtime-banner-notifications`
  (the account event stream `GET /account/events`, its Redis fanout, the reserved `playback.*`
  namespace, the web stream coordinator in plan 30, the mobile stream runtime in plan 40, which
  stays open in the background while audio plays) and `auth-sessions` (session rows with a stable
  id and a device label, plans 10, 20, 22, 42). Plans here name the files those sets create as
  inputs and **do not edit those sets' plans**. Each implementation plan starts by re-checking that
  the paths it builds on exist, because both sets must land first.
- Anchor by symbol, route, and key prefix rather than line numbers; other work is landing.
- The `live-playback-progress-deferred` placeholder is already gone from `.llm/plans/active/`; its
  content is in 00-REQUEST.md. Nothing here needs to remove it.
- Rows quoted from the operator answers are asks too. A "Settled" note means the answers already
  decide the row and the plan transcribes that decision.
- Rows that name a surface in parentheses split one ask by surface. The contract area (A) owns the
  shared rule; the runtime areas (B web, C mobile) own sending, obeying, and publishing; the UI
  areas (D web, E mobile) own what the user sees.
- Describe behavior in Podverse terms (**no-third-party-media-player-style**): "exclusive
  active-device handoff", never a comparison with another product.
- Remote state shown on a device that is not playing is display only (**playback-meaningful-events**).
- The web UI plans (40–48) also build on `web-player-marquee` plan
  `21-player-bar-segment-strip` (`MediaPlayerSegmentStrip`), which must land before them. Plan 42
  wires that strip into the remote view and does not edit that set's plans.

## Requirement ledger

- **R1** (area A) "you can only play from one device at a given time" (server: one active device per account, and the request that claims it) — Plan: 12, 13
- **R2** (area B) "you can only play from one device at a given time" (web: the playing tab stops its audio when another device becomes active) — Plan: 21, 22
- **R3** (area C) "you can only play from one device at a given time" (mobile: the app stops its audio when another device becomes active) — Plan: 32
- **R4** (area D) "you can see the progress bar ... change in real time across your devices" (web) — Plan: 43, 47
- **R5** (area E) "you can see the progress bar ... change in real time across your devices" (mobile) — Plan: 51, 54, 55, 57
- **R6** (area D) "and the currently playing item change in real time across your devices" (web) — Plan: 42, 47
- **R7** (area E) "and the currently playing item change in real time across your devices" (mobile) — Plan: 50, 51, 55, 57
- **R8** (area D) "some sort of button that the user can press on the media player that will allow them to switch which device is playing it" (web) — Settled: "a small icon on the media player that appears when multiple devices are connected" — Plan: 40, 44, 47
- **R9** (area E) "some sort of button that the user can press on the media player that will allow them to switch which device is playing it" (mobile) — Settled as R8 — Plan: 52, 57
- **R10** (area B) "The user should be able to press on client B player pause, and that will control client A's player pause as well." (web: a non-playing tab sends it, the playing tab obeys it) — Plan: 23, 25
- **R11** (area C) "The user should be able to press on client B player pause, and that will control client A's player pause as well." (mobile) — Plan: 33, 34
- **R12** (area D) "they'll have to press a button that will give them the option to switch between client A or client B" (web) — Settled: "you tap it and it displays a menu that displays the devices that are currently active and the user can choose between them" — Plan: 40, 41, 44, 47
- **R13** (area E) "they'll have to press a button that will give them the option to switch between client A or client B" (mobile) — Settled as R12 — Plan: 52, 57
- **R14** (area A) "we want whatever the minimal, non-problematic user experience is in the case of a live stream" (which state fields and commands apply to a live item) — Settled by the "Livestreams, minimal" answer (R46–R51) — Plan: 10, 11
- **R15** (area A) "I think it should still have the device switching" (livestream: the transfer command is valid for a live item) — Plan: 10, 11
- **R16** (area D) "there won't be the progress indicator in the same way" (web, livestream) — Plan: 42, 43, 47
- **R17** (area E) "there won't be the progress indicator in the same way" (mobile, livestream) — Plan: 51, 55
- **R18** (area A) "there could be a play and pause that it's working cross-device" (livestream: play and pause commands are valid for a live item) — Plan: 10, 11
- **R19** (area A) "Device names come from the `auth-sessions` set ... Each login session has a stable id and a device label." (the presence record and device list carry session id and label) — Plan: 12, 13
- **R20** (area A) "Choosing another device in the menu sends the audio there." (contract: the transfer command and what it carries) — Plan: 10, 13
- **R21** (area B) "Choosing another device in the menu sends the audio there." (web: sending a transfer, and a tab taking over audio when it is the target) — Plan: 24
- **R22** (area C) "Choosing another device in the menu sends the audio there." (mobile: sending a transfer, and the app taking over audio when it is the target) — Plan: 33, 34
- **R23** (area A) "Remote controls on a device that is not playing: play and pause" (command contract) — Plan: 10, 13
- **R24** (area A) "seek and skip forward/back (not for livestreams)" (command contract) — Plan: 10, 11, 13
- **R25** (area A) "picking a new item plays it on the active device" (command contract) — Plan: 10, 13
- **R26** (area A) "playback speed" (command contract) — Plan: 10, 13
- **R27** (area B) "Remote controls on a device that is not playing: play and pause; seek and skip forward/back (not for livestreams); picking a new item plays it on the active device; playback speed." (web: a non-playing tab routes these to the playing device, and the playing tab obeys them) — Plan: 23, 25
- **R28** (area C) "Remote controls on a device that is not playing: play and pause; seek and skip forward/back (not for livestreams); picking a new item plays it on the active device; playback speed." (mobile) — Plan: 33, 34
- **R29** (area A) "the controlling device sends an ordinary HTTP request to the API, and the API pushes it to the playing device through the account event stream (SSE over the existing Redis fanout). No WebSocket." — Plan: 13, 14, 15
- **R30** (area A) "Commands name the target state ("play", "pause", "seek to N", "set speed to N"), never "toggle", so two devices pressing at once cannot cancel each other." — Plan: 10, 13
- **R31** (area A) "Commands are one-shot: no SSE `id:`, never replayed, and they expire after a few seconds." — Plan: 10, 13, 14
- **R32** (area A) "The playing device is the source of truth. It publishes item, playing or paused, position, a timestamp, and rate on every change and every few seconds" (contract and API) — Plan: 10, 12, 13
- **R33** (area B) "It publishes item, playing or paused, position, a timestamp, and rate on every change and every few seconds" (web: the playing tab publishes) — Plan: 22
- **R34** (area C) "It publishes item, playing or paused, position, a timestamp, and rate on every change and every few seconds" (mobile: the playing app publishes, including in the background) — Plan: 32
- **R35** (area A) "other clients move their progress bar forward locally between updates, so the bar is smooth without constant events" (the shared position-estimate helper both clients use) — Plan: 11
- **R36** (area A) "The device menu lists only devices connected right now (an open account event stream), tracked as short-lived presence in Redis that expires when a device stops checking in." — Plan: 12, 14, 15
- **R37** (area D) "The icon appears only when two or more devices are connected." (web) — Plan: 44, 47
- **R38** (area E) "The icon appears only when two or more devices are connected." (mobile) — Plan: 52
- **R39** (area D) "This device is marked, and the playing device is highlighted." (web) — Plan: 40, 41, 44, 47
- **R40** (area E) "This device is marked, and the playing device is highlighted." (mobile) — Plan: 50, 52, 57
- **R41** (area D) "A device that cannot start audio when told to (a browser tab that blocks audio until someone clicks it) shows a tap-to-play prompt" (web: the prompt; area B detects the blocked start) — Plan: 40, 45, 47
- **R42** (area C) "A device that cannot start audio when told to ... shows a tap-to-play prompt" (mobile: whether and when the app can fail to start, for example from the background, and what it reports) — Plan: 33
- **R43** (area A) "and the device that sent the audio shows that it could not start there" (contract: the start-failed report) — Plan: 10, 13
- **R44** (area D) "and the device that sent the audio shows that it could not start there" (web) — Plan: 40, 45, 47
- **R45** (area E) "and the device that sent the audio shows that it could not start there" (mobile) — Plan: 53, 57
- **R46** (area D) "Livestreams, minimal: other clients show the item, the Live label, and play or pause, with no progress bar and no remote seek or skip." (web) — Plan: 42, 47
- **R47** (area E) "Livestreams, minimal: other clients show the item, the Live label, and play or pause, with no progress bar and no remote seek or skip." (mobile) — Plan: 51, 55
- **R48** (area B) "Moving a livestream to another device starts it at the current live point, not at a saved position." (web) — Plan: 24
- **R49** (area C) "Moving a livestream to another device starts it at the current live point, not at a saved position." (mobile) — Plan: 33, 34
- **R50** (area B) "Pause does what the player already does locally for a livestream." (web) — Plan: 23
- **R51** (area C) "Pause does what the player already does locally for a livestream." (mobile) — Plan: 33
- **R52** (area B) "Progress shown on a device that is not playing is display only. It is never a meaningful playback event on that device (**playback-meaningful-events**), so it writes no history or position there." (web) — Plan: 21, 22, 25
- **R53** (area C) "Progress shown on a device that is not playing is display only. It is never a meaningful playback event on that device (**playback-meaningful-events**), so it writes no history or position there." (mobile) — Plan: 30, 32, 35, 36
- **R54** (area A) Question 1: "How often the playing device publishes state while playing, and whether the server throttles fanout." — Plan: 10, 12, 13
- **R55** (area B) Question 2: "When both devices are connected, live control replaces the Switch or Continue prompt. Confirm the prompt still covers the case where the other device is offline or the app has just opened, and how the two never both appear." (web, `apps/web/src/hooks/playbackHandoffState.ts`) — Plan: 26
- **R56** (area C) Question 2: "When both devices are connected, live control replaces the Switch or Continue prompt. Confirm the prompt still covers the case where the other device is offline or the app has just opened, and how the two never both appear." (mobile, `apps/mobile/src/playback/playbackHandoff.ts`) — Plan: 30, 35, 36
- **R57** (area A) Question 3: "What other clients show when it pauses, stops, goes offline, or loses its stream, and how long before it leaves the menu." (server: the signals sent and the presence expiry) — Plan: 12, 14, 15
- **R58** (area D) Question 3: "What other clients show when it pauses, stops, goes offline, or loses its stream" (web display) — Plan: 42, 47, 48
- **R59** (area E) Question 3: "What other clients show when it pauses, stops, goes offline, or loses its stream" (mobile display) — Plan: 50, 51, 55
- **R60** (area C) Question 4: "Once a backgrounded phone is paused remotely, the OS may suspend it and close its stream, so it can no longer be resumed remotely. Decide whether a short grace period keeps it reachable (the realtime revision leaves one named input for this)." — Plan: 31, 36
- **R61** (area B) Question 5: "Several tabs in one browser profile share one stream and one session. Decide which tab is "this device"" — Plan: 20, 21, 22
- **R62** (area D) Question 5: "and what other tabs show" — Plan: 40, 42, 44, 47, 48
- **R63** (area A) Question 6: "Two devices with the same label ("iPhone · iOS" twice): how the menu tells them apart." (the shared rule both menus render) — Plan: 11
- **R64** (area D) Question 7: "Which views show remote state: mini player, full player, item rows, the queue" (web player variants, item rows, and the web queue) — Plan: 46, 47, 48
- **R65** (area E) Question 7: "Which views show remote state: mini player, full player, item rows, the queue, lock screen and media notification, CarPlay and Android Auto." (mobile) — Plan: 51, 55, 56, 57, 58
- **R66** (area A) Question 8: "Signed-in only (the stream needs an account). Whether it needs a membership" — Plan: 13, 15
- **R67** (area E) Question 8: "and what anonymous mobile users see" — Plan: 50, 58
- **R68** (area A) Question 9: "Picking a new item on a non-playing device plays it on the active device; confirm how that interacts with each device's queue." (the server's one active queue per account, `apps/api/src/routes/queue.ts`) — Plan: 13, 15
- **R69** (area A, step 07) Review: "Add medium to DTOPlaybackResourceSummary (plan 10)" — Plan: 10, 13
- **R70** (area B, step 08) Review: "filled by the publishing device (plans 22, 32)" (web, plan 22) — Plan: 22
- **R71** (area C, step 09) Review: "filled by the publishing device (plans 22, 32)" (mobile, plan 32) — Plan: 32
- **R72** (area D, step 10) Review: "use it to build share links and to restore title links in the remote view on web and mobile, which reverses D44" (web) — Plan: 42, 47, 48, 49
- **R73** (area E, step 11) Review: "use it to build share links and to restore title links in the remote view on web and mobile, which reverses ... the plain-text titles in plan 55" (mobile) — Plan: 55, 57, 58
- **R74** (area D, step 10) Review: "Add to Playlist and Share work on both surfaces while another device plays. ... Add to Playlist is disabled only for an Add by RSS item whose data this device lacks." (web) — Plan: 42, 47, 48, 49
- **R75** (area E, step 11) Review: "Add to Playlist and Share work on both surfaces while another device plays. ... Add to Playlist is disabled only for an Add by RSS item whose data this device lacks." (mobile) — Plan: 55, 57
- **R76** (area A, step 07) Review: "add next and previous commands" (contract, helpers, routes: plans 10, 11, 13) — Plan: 10, 11, 13
- **R77** (area B, step 08) Review: "the playing device runs them exactly as its own Next and Previous buttons, using its own queue" (web: plans 23, 25) — Plan: 23, 25
- **R78** (area C, step 09) Review: "the playing device runs them exactly as its own Next and Previous buttons, using its own queue" (mobile: plans 33, 34) — Plan: 33, 34
- **R79** (area D, step 10) Review: "show the buttons on both surfaces" (web, plan 42) — Plan: 42, 47, 48
- **R80** (area E, step 11) Review: "show the buttons on both surfaces" (mobile, plan 55) — Plan: 55, 57, 58
- **R81** (area D, step 10) Review: "the web mobile-width remote view follows the local split by medium (music: previous and next; others: skip back and forward)" — Plan: 42, 47, 48
- **R82** (area D, step 10) Review: "while another device plays, show the segment strip and highlight chapter rows on both surfaces, from the estimated position of the playing device" (web: plan 42 wires the web-player-marquee strip; chapter rows) — Plan: 42, 46, 47, 48, 49
- **R83** (area E, step 11) Review: "while another device plays, show the segment strip and highlight chapter rows on both surfaces, from the estimated position of the playing device" (mobile) — Plan: 50, 51, 55, 57, 58, 59
- **R84** (area B, step 08) Review: "when take_over, play_item, or seek lands at or past the duration of the local file on the receiving device, start at that duration minus 5 s" (web: plans 23, 24) — Plan: 23, 24, 27
- **R85** (area C, step 09) Review: "when take_over, play_item, or seek lands at or past the duration of the local file on the receiving device, start at that duration minus 5 s" (mobile: plan 33) — Plan: 33
- **R86** (area A, step 07) Review: "only the playing device fires end reached, auto-advance, history, and position events, and ... the remote view uses duration_seconds from the shared state" (plan 11) — Plan: 11
- **R87** (area B, step 08) Review: same statement (web, plan 23) — Plan: 23
- **R88** (area C, step 09) Review: same statement (mobile, plan 33) — Plan: 33
- **R89** (area D, step 10) Review: "one shared title-case status set on web and mobile: Playing on {device}, Paused on {device}, Starting on {device}, Sending to {device}…, plus web-only Playing in Another Tab" (web; plan 40 owns the keys) — Plan: 40, 42, 47, 48
- **R90** (area E, step 11) Review: same status set (mobile reads plan 40's keys) — Plan: 50, 51, 55, 57, 58
- **R91** (area D, step 10) Review: "keep the web toast ... record it as an intentional divergence in plans 45 and 53" (plan 45) — Plan: 45
- **R92** (area E, step 11) Review: "keep ... the mobile dialog; record it as an intentional divergence in plans 45 and 53" (plan 53) — Plan: 53, 58

## Areas

### A. Contract and API (plans 10–19)

- **Rows:** R1, R14, R15, R18, R19, R20, R23, R24, R25, R26, R29, R30, R31, R32, R35, R36, R43,
  R54, R57, R63, R66, R68
- **Scope:** the `playback.*` event types (state, command, presence or device list, start-failed)
  and their payload guards in `@podverse/helpers`, next to the realtime contract; the shared pure
  helpers both clients use (position estimate between updates, which commands a live item allows,
  device-list ordering and same-label disambiguation); the API routes a device calls to publish
  state, send a command, check in, and claim the active device, with their `@podverse/helpers-requests`
  calls; presence and latest state in Redis with expiry; whether a new stream gets the current
  state on connect; publish rate and any server throttle; command expiry; membership gating;
  how a remote item pick meets the server's one active queue; OpenAPI, integration tests, and the
  architecture doc (the realtime set's account events doc and **media-player-architecture**).
- **Starts from:** realtime plans 10 (`packages/helpers/src/lib/accountEventStream.ts`), 11 and
  13 (Redis fanout), 12 (`apps/api/src/lib/accountEventStream/accountEventStreamHub.ts`,
  `apps/api/src/controllers/account/accountEventStream.ts`), 16 (docs); auth-sessions plans 10
  and 20 (session id on the request, device label); `apps/api/src/lib/keyvaldb/keyvaldb.ts`;
  `apps/api/src/routes/queue.ts` and `apps/api/src/controllers/queue/queue.ts`;
  `packages/playback-core/src/`.
- **Depends on:** no area in this set. Outside the set: `realtime-banner-notifications` (plans
  10–16) and `auth-sessions` (plans 10, 20, 22) must land before its implementation runs.
- **Shared files:** with every other area — the event types, guards, helpers, and request calls it
  adds to `packages/helpers` and `packages/helpers-requests`. Other areas consume them and do not
  edit them; a missing helper goes back to this area's plans as a note for Close.

### B. Web playback runtime (plans 20–29)

- **Rows:** R2, R10, R21, R27, R33, R48, R50, R52, R55, R61
- **Scope:** routing `playback.*` events from the web stream coordinator to the player; which tab
  in a browser profile is "this device"; the playing tab publishing state and obeying commands;
  a non-playing tab sending remote controls and remote item picks instead of playing locally;
  transfer in both directions, including a livestream starting at the live point and livestream
  pause as the player does it today; stopping local audio when another device becomes active;
  detecting a blocked audio start and reporting start-failed; keeping remote state out of history
  and position writes; how the existing Switch or Continue prompt and live control never both
  appear; a remote-state store the web UI reads; Vitest coverage.
- **Starts from:** realtime plan 30 (`apps/web/src/lib/notifications/stream/notificationStreamCoordinator.ts`),
  `apps/web/src/contexts/MediaPlayer.tsx`, `apps/web/src/contexts/MediaPlayerControls.tsx`,
  `apps/web/src/contexts/MediaPlayerCurrentTime.tsx`, `apps/web/src/contexts/Queue.tsx`,
  `apps/web/src/components/MediaPlayer/Controller/MediaPlayerController.tsx`,
  `apps/web/src/hooks/playbackHandoffState.ts`, `apps/web/src/hooks/useQueueResourceUpdateNowPlaying.tsx`.
- **Depends on:** A (event types, request calls, helpers).
- **Shared files:** with D — the web player contexts and the remote-state store this area creates,
  which D reads. With A — consumes A's packages without editing them.

### C. Mobile playback runtime (plans 30–39)

- **Rows:** R3, R11, R22, R28, R34, R42, R49, R51, R53, R56, R60
- **Scope:** routing `playback.*` events from the mobile stream runtime to playback; the playing
  app publishing state (foreground and background) and obeying commands through the native bridge;
  a non-playing app sending remote controls and item picks; transfer in both directions, including
  the livestream live point and livestream pause; stopping local audio when another device becomes
  active; whether the app can fail to start audio when told to, and what it reports; the
  background grace period after a remote pause through the realtime set's run-condition input;
  keeping remote state out of the playback journal, history, and position writes; how the 744
  Switch or Continue prompt and live control never both appear; a remote-state store the mobile UI
  reads; Vitest coverage.
- **Starts from:** realtime plan 40 (`apps/mobile/src/notifications/notificationStreamController.ts`,
  `notificationStreamPolicy.ts`, `NotificationsRuntime.tsx`), `apps/mobile/src/playback/PlaybackProvider.tsx`,
  `apps/mobile/src/playback/playbackProgressStore.ts`, `apps/mobile/src/playback/playbackTransport.ts`,
  `apps/mobile/src/playback/playbackHandoff.ts`, `apps/mobile/src/playback/drainPlaybackJournal.ts`,
  `docs/proposals/mobile/_master-plan_/phase-2/details/744-multi-device-playback-handoff.md`.
- **Depends on:** A (event types, request calls, helpers).
- **Shared files:** with E — `PlaybackProvider.tsx`, `playbackProgressStore.ts`, and the
  remote-state store this area creates, which E reads. With A — consumes A's packages without
  editing them.

### D. Web player UI (plans 40–49)

- **Rows:** R4, R6, R8, R12, R16, R37, R39, R41, R44, R46, R58, R62, R64
- **Scope:** the device icon (shown only with two or more connected devices) and its menu in the
  desktop, mobile-layout, and modal players, with this device marked and the playing device
  highlighted; showing the remote item and a locally advancing progress bar on a non-playing tab;
  the livestream view (item, Live label, play or pause, no progress bar); the tap-to-play prompt
  and the "could not start there" notice; what other tabs and the item rows and queue show; what
  the player shows when the playing device pauses, stops, or goes away; i18n; Playwright coverage.
- **Starts from:** `apps/web/src/components/MediaPlayer/` (`Desktop/`, `Mobile/`, `Modal/`,
  `Buttons/`, `Sliders/MediaPlayerProgress.tsx`), `apps/web/src/components/MediaPlayer/MEDIA-PLAYER-DECISION-MATRIX.md`,
  and area B's remote-state store.
- **Depends on:** A (helpers for ordering, labels, position estimate) and B (remote-state store and
  the actions it exposes).
- **Shared files:** with B — listed above. With E — the shared i18n catalogs if both add keys to the
  same layer.

### E. Mobile player UI (plans 50–59)

- **Rows:** R5, R7, R9, R13, R17, R38, R40, R45, R47, R59, R65, R67
- **Scope:** the device icon and its menu (a sheet) on the mini and full player, with this device
  marked and the playing device highlighted; the remote item and locally advancing progress on a
  non-playing app; the livestream view; the "could not start there" notice; what item rows, the
  queue, the lock screen and media notification, and CarPlay and Android Auto show; what anonymous
  users see; what the player shows when the playing device pauses, stops, or goes away; i18n;
  Maestro coverage per **mobile-test-economics**.
- **Starts from:** `apps/mobile/src/components/player/MiniPlayer.tsx`, `MiniPlayerProgress.tsx`,
  `FullPlayerScrubber.tsx`, `FullPlayerUtilityRow.tsx`, `apps/mobile/src/screens/player/FullPlayerScreen.tsx`,
  `apps/mobile/src/sync/carBackgroundSync.ts` and the CarPlay and Android Auto wiring in
  `PlaybackProvider.tsx`, and area C's remote-state store.
- **Depends on:** A (helpers) and C (remote-state store and the actions it exposes).
- **Shared files:** with C — listed above. With D — the shared i18n catalogs if both add keys to
  the same layer.

## Order

First planning pass, three waves:

- **Wave 1:** A (step 02).
- **Wave 2:** B and C at once (steps 03, 04), after A.
- **Wave 3:** D and E at once (steps 05, 06), D after A and B, E after A and C.

Second pass after the first review (answers in 00-REQUEST.md § Review of the first planning
pass, rows R69–R92), three waves, revising the existing plans in each area's block:

- **Wave 1:** A (step 07): `medium` on the resource summary, next and previous commands, the
  playing-device-only events statement.
- **Wave 2:** B and C at once (steps 08, 09), after step 07.
- **Wave 3:** D and E at once (steps 10, 11), D after steps 07 and 08, E after steps 07 and 09.
  The shared status keys are fixed in both prompts, so D and E need not wait for each other.

Assembly: 40 plans in 15 phases ([00-EXECUTION-ORDER.md](00-EXECUTION-ORDER.md),
`COPY-PASTA.md`). Close made three small hand edits: plan 21's summary uses `itemTitle` and fills
`medium` by plan 22's rule; plan 36's mobile doc drops the stale "no next or previous commands"
line and describes Next and Previous, the 5 s end clamp, and the no-advance rule for a remote
phone; plan 50 mirrors its `media_player.devices` keys into the three consumer overrides so
`i18n:validate` passes.

## Settled after assembly

Recorded in 00-REQUEST.md § Review after assembly.

1. **Share on the web player.** Plan 42 adds a Share button in every player role (this browser
   playing, and another device playing). It opens the existing share modal. Plan 44's device icon
   still shows whenever two or more devices are connected.
1. **Web E2E presence grace.** The product leave grace stays 5 s. Plans 10, 14, and 47 set the web
   E2E API (`apiWebE2e`) to 500 ms. Vitest and the mobile E2E API stay at 5 s.
1. **Parallel Maestro.** Plan 57 stays as written: only its flow notes that it needs one phone at
   a time.
1. **The existing 744 handoff flow.** Plan 35 keeps the prompt closed while this phone is the
   active device, re-evaluates the conflict when the gate becomes `allow`, and
   `playback-multi-device-handoff.yaml` waits through the 5 s grace before expecting the prompt.

## Decisions to review

Product choices the area planners made that the request and answers did not settle, collected
from the `## Decisions` list of each area step's final message. Each item names the choice, the
main alternative, its step, and its plans. Answer by number (D1, D2, …); an item with no answer
stands as written.

Reviewed: the operator's answers are in 00-REQUEST.md § Review of the first planning pass. They
change D26, D35, D42, D43, D44, D46, D51, D56, D59, and D68, keep D41, D50, D58, and D63, and add
rows R69–R92. Every other item stands.

### Step 02 — Area A, contract and API (plans 10–15)

- **D1** Membership required for every playback route; queue sync is already a membership feature, and remote picks rely on the server queue. Alternative: any signed-in account. (Step 02, plan 13)
- **D2** Presence is a check-in: devices check in every 15 s while their stream is open, and presence lasts 40 s. Alternative: treat the stream's heartbeat as presence, which fails on half-open sockets such as a sleeping laptop. (Step 02, plan 12)
- **D3** How fast a device leaves the menu: about 5 s after its stream closes cleanly, about 50 s after it vanishes silently, and at once when its session ends. Stream lifetime or token expiry and pod shutdown keep presence. Alternative: remove at once on any close. (Step 02, plans 12, 14)
- **D4** The last claim wins the active slot, and a non-claim publish from a device that is not active gets a 409. Alternative: refuse a claim while another device is active. (Step 02, plans 12, 13)
- **D5** When the playing device leaves, the state stays, paused at its last published position, with no active device. Alternative: clear the state. (Step 02, plan 12)
- **D6** `take_over` carries no item. The server attaches the stored state, and the target always starts playing (at the live point for a live item). Choosing "this device" is a local play plus claim, with no command. Alternative: the sender sends the item and position. (Step 02, plans 10, 13)
- **D7** Skip is an absolute seek the sender computes, so two devices skipping at once land on the same spot. Alternative: a relative skip command. (Step 02, plan 10)
- **D8** Live items also disallow `set_rate`; the request only ruled out progress, seek, and skip. Alternative: allow speed changes on live items. (Step 02, plan 11)
- **D9** Publishing and throttling: the playing device publishes every 10 s while playing, plus each discrete change (coalesced to one per 500 ms). The server skips fanout when a periodic publish is within 2 s of the extrapolated position. Alternative: fan out every publish. (Step 02, plans 10, 12)
- **D10** Device menu order: this device first, then the others by session creation time; the playing device is highlighted where it sits rather than moved. Devices sharing a label are numbered by creation time, the same numbers on every device; devices without a label are grouped by client type. Alternative: tell them apart by last-seen time or a short id. (Step 02, plan 11)
- **D11** No queue-changed event. A remote pick plays through the playing device's normal now-playing path. Alternative: an event on queue writes, which would fire every few seconds because position saves use the same routes. (Step 02, plan 13)
- **D12** Every stream gets a `playback.snapshot`, members or not; for non-members it is an empty list and null state. (Step 02, plan 14)
- **D13** Remote control commands may target the sender's own session, because browser tabs share one session; `take_over` to itself is refused. (Step 02, plan 13)
- **D14** Start-failed reasons are `autoplay_blocked` and `load_failed`. The sender shows the failure notice if nothing comes back within 8 s. (Step 02, plan 10)

### Step 03 — Area B, web playback runtime (plans 20–26)

- **D15** A device is the browser profile's session; only the tab that last started playback holds audio, agreed over BroadcastChannel `podverse:playback-tabs`. Alternative: each tab as its own device (the server cannot tell tabs apart). (Step 03, plans 21, 22)
- **D16** A tab in the remote role pauses and clears its local player, with no write. Alternative: keep the local item loaded but silent. (Step 03, plan 22)
- **D17** Each tab checks in once when the stream opens; then only the leader checks in, every 15 s. Alternative: every tab checks in every 15 s. (Step 03, plan 22)
- **D18** Availability waits at most 5 s, then counts as unavailable; a 403 stops check-ins until the account object changes. Alternative: wait indefinitely for the first check-in. (Step 03, plan 22)
- **D19** A claim holds the role `active` while it is in flight; own publishes set a revision floor. Alternative: trust only stream events. (Step 03, plans 21, 22)
- **D20** A tab whose audio stops on its own (closed or crashed) is fixed by the leader: closing sends `audio-tab-gone`, and after 12 s with no heartbeat the leader publishes paused. Alternative: wait for presence to expire. (Step 03, plan 22)
- **D21** The take-over goes to the last focused tab, else the stream leader (any visible tab when there is no channel). Alternative: every tab of the session, or only the leader. (Step 03, plan 24)
- **D22** A transfer always starts playback and carries the speed over; livestreams start at the live point. Alternative: keep a paused state paused. (Step 03, plan 24)
- **D23** While tap-to-play shows, the tab keeps its claim (role `active`) for up to 60 s; dismissing abandons it. Alternative: drop the claim at once. (Step 03, plans 23, 24)
- **D24** `set_rate` snaps to the nearest web speed. Alternative: allow any rate on web. (Step 03, plans 21, 23)
- **D25** Remote item picks: the same item with no start position toggles play or pause on the active device; otherwise `play_item`; paused hydration sends nothing. Alternative: always `play_item`. (Step 03, plan 25)
- **D26** Next and Previous are not routed in the remote role (area D hides them). Alternative: add queue-advance commands. (Step 03, plan 25)
- **D27** Auto-advance needs no change: `onEnded` already refetches the server queue. Alternative: add a queue-changed event. (Step 03, plan 23)
- **D28** The Switch or Continue prompt is held while availability is pending and appears only in a settled idle role; an open prompt closes with no write when the role turns remote or active. Alternative: keep the prompt and suppress it per event. (Step 03, plan 26)

### Step 04 — Area C, mobile playback runtime (plans 30–36)

- **D29** No background grace period (R60). A phone in the background stays in the device list only while it plays. After a pause it leaves within about 5 s, and its state stays resumable on the server. Alternative: keep the stream open for a timed grace; rejected because iOS suspends the app and Android stops JS timers, so the grace could not end on time. (Step 04, plan 31)
- **D30** Stopping for another device is silent (R3). The phone pauses its engine and writes no outbox, queue, history, or position event. Alternative: a normal pause event; rejected because it would make this item the account's now-playing again, over the new device's item. (Step 04, plan 32)
- **D31** Auto-advance while already active does not claim. A device that lost the role gets a 409 and stops instead of taking playback back. Every other local start claims. Alternative: claim on every item change. (Step 04, plan 32)
- **D32** Publishing does not need the stream open; exclusivity still holds while the stream reconnects. Alternative: publish only while the stream is open. (Step 04, plan 32)
- **D33** Background publishing skips the 500 ms gap. Requests are chained one at a time; the gap timer applies only in the foreground. Alternative: always use the gap timer; rejected because it freezes on Android in the background and would hold back a pause. (Step 04, plan 32)
- **D34** The phone never reports `autoplay_blocked` and has no tap-to-play prompt (R42). It reports `load_failed` for the failure cases the plan lists. Alternative: mirror the web prompt. (Step 04, plan 33)
- **D35** No remote next or previous. Skip forward and back become absolute seeks; next and previous do nothing while remote. Alternative: add next and previous commands to the shared contract. (Step 04, plan 34)
- **D36** A playlist row played remotely loses its auto-queue seed; commands never edit the queue. Alternative: add a seed to `play_item`. (Step 04, plan 34)
- **D37** Some actions stay local while remote: making a clip (`previewWindow` and the authoring hold) and `loadItemPausedAt`, and so do the lock screen, headset, and car. Alternative: route them all. (Step 04, plan 34)
- **D38** 744 prompt gate (R56): the prompt waits while the view is `pending`; it closes, without recording a dismissal, while any device is active; it works as before when nobody is active or when the phone cannot see other devices (no membership, Offline Mode, stream down); it also skips an item that is already loaded. Alternative: suppress the prompt only while remote. (Step 04, plans 30, 35)
- **D39** When the playing device stops, the phone loads the shared item paused, with no events. On a cold open nothing is swapped. Alternative: leave the old local item in the player. (Step 04, plan 35)
- **D40** Membership gate: the feature uses the existing `queue_history_sync` capability, and a 403 turns it off until the access tier changes. Alternative: add a new capability to `@podverse/helpers`. (Step 04, plan 31)

### Step 05 — Area D, web player UI (plans 40–48)

- **D41** Remote view only in the remote role. A tab with no local item and no playing device shows no bar, even if the server still holds a paused state, which can name an item the queue no longer has. Alternative: show that paused state, with Play taking over here. (Step 05, plan 42)
- **D42** Local-only controls are hidden in the remote view: next and previous track, volume, mute, clip, add to playlist, repeat, shuffle, and alternate enclosure. Alternative: show them disabled. (Step 05, plan 42)
- **D43** Jump buttons on every medium in the mobile layout's remote view, matching the desktop layout. Alternative: keep the local split, where music shows previous and next track instead. (Step 05, plan 42)
- **D44** Modal titles are plain text in the remote view: no links, like button, chapter link, or modal video. Alternative: build links from the ref ids, but the state carries no medium to pick the route. (Step 05, plan 42)
- **D45** Live label only in the remote view; the local livestream view is unchanged. Alternative: also replace the local live progress bar. (Step 05, plan 42)
- **D46** Caption wording and placement: "Playing on {device}", "Playing in Another Tab", or "Sending to {device}…" under the subtitle in all three layouts; a pending transfer takes precedence. Alternative: an icon-only signal. (Step 05, plan 42)
- **D47** The remote bar seeks once on mouseup and shows no chapter marks. Alternative: continuous seeking while dragging, which would send many commands. (Step 05, plan 43)
- **D48** Device button placement and accent color: desktop at the start of the end section, before volume; mobile layout before Settings; modal after Settings. The icon uses the accent color while the remote view shows. (Step 05, plan 44)
- **D49** Choosing the device that is already playing does nothing. Alternative: send another take over. (Step 05, plan 44)
- **D50** Tap-to-play is a modal; a transfer failure is a one-time error toast. Alternative: an inline notice in the player. (Step 05, plan 45)
- **D51** Chapter rows never match remotely, and the queue page does not refetch live. Alternative: guess the chapter from the estimated position. (Step 05, plan 46)
- **D52** Copy text, including Greek: the Greek strings put `{device}` after a colon or in parentheses to avoid case agreement with device labels. (Step 05, plan 40)

### Step 06 — Area E, mobile player UI (plans 50–58)

- **D53** The player shows the other device only when the feature is ready, the role is remote, there is a shared item, and no clip authoring hold is on; otherwise it shows the phone's own player, matching plan 34's routing. Alternative: show the other device whenever the role is remote. (Step 06, plan 50)
- **D54** A remote role with no item shows the local player. Alternative: an empty remote player. (Step 06, plan 50)
- **D55** A dropped stream on this phone shows the local player. Alternative: keep showing the last remote state. (Step 06, plan 50)
- **D56** The status line reads "Playing on / Paused on / Starting on {device}", in sentence case. Alternative: title case, or keep the channel title. Note: web (D46) uses title-case "Playing in Another Tab" next to sentence-case "Playing on {device}"; the two surfaces should agree. (Step 06, plans 50, 51)
- **D57** An unlabeled device is named by client type, with a number for duplicate labels; an unknown active device is "Another Device". Alternative: show the raw session or client type. (Step 06, plan 50)
- **D58** The mini player shows remote state even when nothing is loaded locally, and the tab layout reserves its height. Alternative: show it only when a local item exists. Note: web (D41) shows no bar in the matching case. (Step 06, plan 51)
- **D59** The clip and chapter strip hides while remote. Alternative: keep the strip. (Step 06, plan 51)
- **D60** The device button sits in the mini player and in a utility-row slot before More, shown with two or more devices in both local and remote mode. Alternative: show it only while remote, or put it in the action row. (Step 06, plan 52)
- **D61** The device menu reuses `MoreMenu` and closes on choice; a spinner on the button shows a pending transfer. Alternative: a custom sheet that stays open until the result. (Step 06, plan 52)
- **D62** Device rows are disabled for the active device, while a transfer is pending, and when there is nothing to move. Alternative: all rows always enabled. (Step 06, plan 52)
- **D63** Failures show a dialog with one Dismiss button; transfer failures take priority; the last-known device name is kept. Alternative: a toast, or an inline row error. Note: web (D50) uses a toast for transfer failures. (Step 06, plan 53)
- **D64** Remote scrubbing is allowed; the released position holds until a newer state arrives or 5 s pass. Alternative: a read-only remote progress bar. (Step 06, plan 54)
- **D65** The remote full player keeps the fixed bands; the segment band carries the status line; no chips or pane. Alternative: a separate simplified screen. (Step 06, plan 55)
- **D66** Remote transport: skip back, play or pause, skip forward (no jumps for live); next and previous slots stay empty. Alternative: show next and previous disabled. (Step 06, plan 55)
- **D67** Remote utility row: speed (not for live) and the device button only. Alternative: keep the sleep timer and More. (Step 06, plan 55)
- **D68** Remote action row: Queue stays; Create Clip, Boost, and V4V hide; Add to Playlist and Share show disabled. Alternative: build share links from the shared ids. Note: web (D42) hides add to playlist rather than disabling it. (Step 06, plan 55)
- **D69** Rows mark the remote item; a tap on it pauses or resumes the other device; no inline progress on remote rows. Alternative: send `play_item` on every tap, or show remote progress. (Step 06, plan 56)
- **D70** Lock screen, media notification, CarPlay, and Android Auto show only the phone's own player. Alternative: mirror remote state natively. (Step 06, plans 56, 58)
- **D71** Anonymous users and non-members see today's player, checked by unit tests rather than Maestro. Alternative: an anonymous Maestro assertion. (Step 06, plans 50, 57)
