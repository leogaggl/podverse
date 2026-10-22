# abctestall deferred

## iOS `add-by-rss`

- Command: `npm run mobile:e2e:test -- --platform ios add-by-rss`
- First failure: `assertVisible id: home-feed-row-duration-.*-progress` (sequence 106). The playing row showed Pause and `home-feed-row-duration-<id>` ("1 min"). The progress track was on screen but had no id. `MediaRowActiveProgress` passed the id only as `fillTestID` (`…-progress-fill`), and `ProgressTrack` documents the track `testID` as the element that stays Maestro-visible.
- Tried: set `testID` on that `ProgressTrack` in `apps/mobile/src/components/player/MediaRowActions.tsx`. Rerun got past the progress assertion and failed later.
- Later failure: `assertVisible id: add-by-rss-home-detail-screen` (sequence 124), after the title link, Back, and a tap on `tab-my-library`. The screen was the My Library hub. The flow comment says the title opens the episode on Home and the library detail stays put so Remove can run there.
- Competing explanations:
  1. The title link never focused Home, so the My Library tap was a press on the already-selected tab. `focusedTabPop` then pops that stack to the hub.
  2. The title link did focus Home, and the library stack was already back at the hub, so the tab switch revealed the hub instead of the detail left earlier in the flow.
- Operator decision: which stack the player title should leave focused, and whether a press on the already-selected My Library tab may pop that stack. Do not weaken the assertion until that is settled.

## iOS `make-clip`

- Command: `npm run mobile:e2e:test -- --platform ios make-clip`
- Assertion: `assertVisible id: full-player-screen` (sequence 77), after `make-clip-close` on the second Create visit. The screen was episode detail for `e2ePodChap0001`, with the mini player still showing that episode. `full-player-screen` and `make-clip-screen` were both absent. The created-dialog Close earlier in the same run did return to the full player (sequence 65 passed, then Create was tapped).
- Tried: read the command log and the failure hierarchy. Reran the flow once. Same assertion, same sequence.
- Competing explanations:
  1. The header back pops the full player along with Make clip. Both are root slide-up cards (`gestureDirection: vertical`). The dialog Close is not on that edge and only pops Make clip.
  2. The full player dismisses itself when it regains focus (`shouldDismissFullPlayerOnEmptySession`), and the session is back before the failure screenshot. The first return did not dismiss, so this needs a second-visit-only empty session.
- Operator decision: header back from Make clip must land on the full player, or the flow's expectation is wrong. Do not weaken the assertion until that is settled.

## iOS `add-by-rss-livestream`

- Command: `npm run mobile:e2e:test -- --platform ios add-by-rss-livestream`
- Assertion: `assertVisible id: rss-root-screen` (sequence 73), after the full-player title opened the livestream on Home, two header backs reached `home-screen` (sequence 71), and a tap on `tab-my-library` (sequence 72). The screen was the My Library hub. The mini player still showed `E2E Add-by-RSS Live Now`.
- Tried: read the command log and the failure screenshot. Did not edit the flow. The same return-to-library question is already deferred on iOS `add-by-rss`.
- Competing explanations:
  1. The title link's Home navigation popped the My Library stack back to the hub, so the later tab switch reveals the hub instead of the Add by RSS list left earlier.
  2. The My Library stack was still on the Add by RSS list, and the tab press popped it anyway even though Home was the focused tab.
- Operator decision: same as iOS `add-by-rss` — which stack the player title should leave in place, and whether a My Library tab press may pop that stack. Do not weaken the assertion until that is settled.
