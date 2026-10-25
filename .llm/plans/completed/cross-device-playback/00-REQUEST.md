# Cross-device playback

## Request

We had talked about a feature where you can only play from one device at a given time, but you can see the progress bar and the currently playing item change in real time across your devices.

When multiple clients have the player open, it seems like we will need some sort of button that the user can press on the media player that will allow them to switch which device is playing it. For example, pressing if client A is playing it and has control of the audio. The user should be able to press on client B player pause, and that will control client A's player pause as well. However, if the user wants to switch the audio to play to client B, they'll have to press a button that will give them the option to switch between client A or client B.

It is a little unclear to me how this will work in the best way when the content is a live stream. So, we want whatever the minimal, non-problematic user experience is in the case of a live stream. I think it should still have the device switching, but there won't be the progress indicator in the same way, although there could be a play and pause that it's working cross-device.

## Operator answers

- **How audio moves between devices:** "Is it possible that it can be a small icon on the media player that appears when multiple devices are connected and you tap it and it displays a menu that displays the devices that are currently active and the user can choose between them? I am not sure how you would get the device information, so that may be an issue, but I think in the worst case you could call it Device A and Device B or something if there is at least some stable identifier that will be recognized between the two devices or more devices."
  - Device names come from the `auth-sessions` set (see Orientation), so the "Device A / Device B" fallback is not needed. Each login session has a stable id and a device label.
  - Choosing another device in the menu sends the audio there. The menu is not limited to a "Play Here" button on the target device.
- **Remote controls on a device that is not playing:** play and pause; seek and skip forward/back (not for livestreams); picking a new item plays it on the active device; playback speed.
- **Set name:** `cross-device-playback`. It replaces the `live-playback-progress-deferred` placeholder, whose content is folded into this file.
- **The realtime notifications set is revised first.** The operator chose to revise `realtime-banner-notifications` after its first planning pass finished, instead of having this set undo its plans later. That revision (its 00-REQUEST.md § Review of the second planning pass) keeps the mobile account event stream open in the background while audio is playing, keeps banners from showing for events received in the background, and reserves `playback.*` for cross-device state and commands, neither replayed. This set builds on that; it does not edit the realtime plans.
- **Recommendations the operator accepted ("do what you recommend"):**
  - Control goes over the existing design: the controlling device sends an ordinary HTTP request to the API, and the API pushes it to the playing device through the account event stream (SSE over the existing Redis fanout). No WebSocket.
  - Commands name the target state ("play", "pause", "seek to N", "set speed to N"), never "toggle", so two devices pressing at once cannot cancel each other. Commands are one-shot: no SSE `id:`, never replayed, and they expire after a few seconds.
  - The playing device is the source of truth. It publishes item, playing or paused, position, a timestamp, and rate on every change and every few seconds; other clients move their progress bar forward locally between updates, so the bar is smooth without constant events.
  - The device menu lists only devices connected right now (an open account event stream), tracked as short-lived presence in Redis that expires when a device stops checking in. The icon appears only when two or more devices are connected. This device is marked, and the playing device is highlighted.
  - A device that cannot start audio when told to (a browser tab that blocks audio until someone clicks it) shows a tap-to-play prompt, and the device that sent the audio shows that it could not start there.
  - **Livestreams, minimal:** other clients show the item, the Live label, and play or pause, with no progress bar and no remote seek or skip. Moving a livestream to another device starts it at the current live point, not at a saved position. Pause does what the player already does locally for a livestream.
  - Progress shown on a device that is not playing is display only. It is never a meaningful playback event on that device (**playback-meaningful-events**), so it writes no history or position there.

## Glossary

- **Client / device:** one signed-in app instance with its own login session: a mobile app install, or a web browser profile. Session ids and device labels come from `auth-sessions`.
- **Active device / playing device:** the one device whose audio is playing.
- **Live stream / livestream:** item-level live content (`live_item`), not a feed type or medium (**abcmemory-vocabulary** § livestreams). Not to be confused with the realtime account event stream.
- **Account event stream:** `GET /account/events`, the SSE endpoint from `realtime-banner-notifications`.

## Orientation

Checked while writing this file. Other sets are landing; re-verify.

- `.llm/plans/active/realtime-banner-notifications/`: plans 10 (event contract, `playback.*` reserved, unknown types ignored), 11 and 13–15 (Redis fanout, keyed by account, carrying any account event type), 12 (the `GET /account/events` endpoint: 30-minute stream cap, 10 streams per account per API pod, one shared stream per web browser profile), 40 (mobile stream runtime), 16 (architecture doc). Not implemented yet; a third planning pass is revising 10, 12, 16, 40, and 53 for background audio.
- `.llm/plans/active/auth-sessions/`: plan 10 adds `account_session` rows (client type, device label, last seen); plan 20 derives web labels with `deviceLabelFromUserAgent`; plan 42 has the app send labels such as "iPhone · iOS" and "<model> · Android"; plans 32 and 42 add Signed-In Devices lists that mark This Device. Not implemented yet. Two devices can share a label.
- `docs/proposals/mobile/_master-plan_/phase-2/details/744-multi-device-playback-handoff.md`: what shipped. When the server's now-playing item differs from the local one, the device asks Switch or Continue (`apps/mobile/src/playback/playbackHandoff.ts`, `shouldPromptForPlaybackHandoffConflict`). It rejected an exclusive active-device handoff only because device identity, a device registry, and a realtime channel did not exist; those are what the two sets above provide. There is no exclusive handoff today.
- `apps/api/src/routes/queue.ts`: queue now-playing routes and `update-is-active` (controller `apps/api/src/controllers/queue/queue.ts`). The server keeps one active queue per account.
- `apps/mobile/src/playback/playbackProgressStore.ts`: mobile playing flag, position, rate, and position clock (`setPlaybackProgressPlaying`, `subscribePlaybackPositionClock`).
- `apps/mobile/app.config.ts`: iOS `UIBackgroundModes` includes `audio`.
- Guidance to read: **media-player-architecture**, **mobile-playback**, **playback-meaningful-events**, **cross-surface-change-impact**, **no-third-party-media-player-style** (describe the behavior; never name another product as the design).

## Questions for the planning run

Settle from the code where possible; ask the operator for product choices the answers above leave open.

1. **Rate.** How often the playing device publishes state while playing, and whether the server throttles fanout.
2. **The 744 prompt.** When both devices are connected, live control replaces the Switch or Continue prompt. Confirm the prompt still covers the case where the other device is offline or the app has just opened, and how the two never both appear.
3. **The playing device goes away.** What other clients show when it pauses, stops, goes offline, or loses its stream, and how long before it leaves the menu.
4. **Mobile after a remote pause.** Once a backgrounded phone is paused remotely, the OS may suspend it and close its stream, so it can no longer be resumed remotely. Decide whether a short grace period keeps it reachable (the realtime revision leaves one named input for this).
5. **Web tabs.** Several tabs in one browser profile share one stream and one session. Decide which tab is "this device" (for example the tab whose player is playing) and what other tabs show.
6. **Same labels.** Two devices with the same label ("iPhone · iOS" twice): how the menu tells them apart.
7. **Surfaces.** Which views show remote state: mini player, full player, item rows, the queue, lock screen and media notification, CarPlay and Android Auto.
8. **Who gets it.** Signed-in only (the stream needs an account). Whether it needs a membership, and what anonymous mobile users see.
9. **Remote item changes.** Picking a new item on a non-playing device plays it on the active device; confirm how that interacts with each device's queue.

### Review of the first planning pass

The operator reviewed the planner decisions D1–D71 in 00-SUMMARY.md § Decisions to review.
"All other decisions stand as written."

- **Status copy (D46, D56), changed:** "one shared title-case status set on web and mobile: Playing on {device}, Paused on {device}, Starting on {device}, Sending to {device}…, plus web-only Playing in Another Tab."
- **No local item (D41, D58), kept:** "keep both as written; they agree."
- **Failure notice (D50, D63), kept:** "keep the web toast and the mobile dialog; record it as an intentional divergence in plans 45 and 53."
- **Add to Playlist and Share (D42, D68), changed:** "Add to Playlist and Share work on both surfaces while another device plays. Add medium to DTOPlaybackResourceSummary (plan 10), filled by the publishing device (plans 22, 32); use it to build share links and to restore title links in the remote view on web and mobile, which reverses D44 and the plain-text titles in plan 55. Add to Playlist is disabled only for an Add by RSS item whose data this device lacks."
- **Next and previous (D26, D35), changed:** "add next and previous commands; the playing device runs them exactly as its own Next and Previous buttons, using its own queue; show the buttons on both surfaces (plans 10, 11, 13, 23, 25, 33, 34, 42, 55)."
- **Web mobile-width remote controls (D43), changed:** "the web mobile-width remote view follows the local split by medium (music: previous and next; others: skip back and forward)."
- **Segment strip and chapter rows (D51, D59), changed:** "while another device plays, show the segment strip and highlight chapter rows on both surfaces, from the estimated position of the playing device. The web strip comes from the web-player-marquee set (plan 21-player-bar-segment-strip), which must run before the web UI plans of this set; plan 42 wires it."
- **New, landing past the end:** "when take_over, play_item, or seek lands at or past the duration of the local file on the receiving device, start at that duration minus 5 s, on web and mobile (plans 23, 24, 33)."
- **New, one device owns playback events:** "state explicitly in plans 11, 23, and 33 that only the playing device fires end reached, auto-advance, history, and position events, and that the remote view uses duration_seconds from the shared state, because dynamic ads can give devices different file lengths."

### Review after assembly

Settled after Close. These replace the open questions in 00-SUMMARY.md.

- **Share on the web player:** The web player has a Share button while this browser plays and while another device plays. It opens the existing share modal. It is not limited to remote playback. The device icon still appears whenever two or more devices are connected, including while this browser plays. Plan 44 is unchanged.
- **Web end-to-end presence grace:** Real users, local API, vitest, and the mobile E2E API keep the leave grace at 5 seconds. The web E2E API (`apiWebE2e`) uses 500 ms, so a later web spec does not open as the non-playing device.
- **Parallel Maestro:** Plan 57 stays as written. Only that flow notes it needs one phone at a time. This set does not add an account per phone.
- **Handoff flow:** `playback-multi-device-handoff.yaml` still expects the switch-item prompt. After relaunch the prompt stays closed while this phone is the active device, and it shows once the 5-second grace has passed.
