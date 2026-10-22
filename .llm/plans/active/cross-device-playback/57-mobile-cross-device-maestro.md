**Cursor model:** Cursor Grok 4.7 · **Reasoning:** high

# 57 — Maestro flow for the phone with another device playing

One Maestro flow covers area E on a device. Maestro drives a single phone, so a host script acts
as the second device: it signs in with its own device label, checks in, and claims playback through
the API. The flow checks the mini player and its chapter strip, the device menu, the full player
(title link, status line under the chapter, previous and next, Share, Add to Playlist), the
playing chapter on the episode screen, a list row, bringing playback to the phone, and the notice
when a transfer does not start.

Before editing, confirm:

- Plans 51, 52, 53, 55, 56, and 59 are in (the test ids below exist in `apps/mobile/src`).
- `POST /auth/mobile/token` accepts `device_label`, and `GET /auth/sessions` and
  `DELETE /auth/sessions/:id_text` exist (auth-sessions plans 20 and 22), and
  `POST /account/playback/presence` and `POST /account/playback/state` exist (plan 13).

If any is missing, stop and report.

## Rows

R5, R7, R9, R13, R40, R45, R65, R73, R75, R80, R83, R90

## Runs after

55, 56, 53, 59

## Files

apps/mobile/e2e/scripts/playback-other-device.js
apps/mobile/e2e/playback-cross-device.yaml
scripts/mobile/e2e-test.sh
apps/mobile/e2e/HOW-TO-RUN.md

## Decisions this plan fixes

- **One label, sequential slots.** The other device is always named `E2E Other Device`. The flow
  needs the default sequential slot run: in a `--parallel` run both phones sign in to the same
  seeded account, see each other in the device list, and take playback from each other. The flow's
  header comment says so.
- **Rows are chosen by name, not position.** A phone session from an earlier flow can stay in the
  device list for a few seconds after its app closes, so the flow taps the row whose text is
  `E2E Other Device`.
- **Presence is refreshed by the script.** The script's session leaves the list about 40 s after
  its last check-in. The flow calls the script's `check-in` action before each step that needs the
  other device present.
- **Anonymous users (R67) are covered by unit tests**, not by this flow: plan 50's selectors return
  local and hide the button whenever `availability` is not `ready`, and plan 31 keeps it `off` when
  signed out.
- **The chaptered episode, paused first.** The other device claims `e2ePodChap0001` paused at 30 s,
  inside the seeded "Topic A" chapter (21–60 s). A paused estimate does not move, so the strip,
  the band, and the marked chapter row name "Topic A" however long the earlier steps take. The
  script then publishes `playing` near the start for the list-row step, which needs a playing
  remote item.
- **"Sending to {device}…" is asserted during the transfer that never starts.** The script never
  claims, so the pending transfer lasts until its timeout (about 8 s), long enough for one
  assertion right after the tap. The match ends in `.*` so the ellipsis character does not have
  to be typed.
- **Not covered here:** the remote speed sheet, seeking, and the share sheet itself; they are left
  to the unit tests and the screenshots.

## `apps/mobile/e2e/scripts/playback-other-device.js`

Host-JVM script modeled on `scripts/seed-playback-now-playing.js`: same header comment style,
`optional` helper, `API_BASE_URL`, `LOGIN_EMAIL`, `LOGIN_PASSWORD`, `postJson`, `failOn`, and
`json(...)` parsing. Deletes use `http.request(url, { method: 'DELETE', headers })`.

Env:

- `E2E_OTHER_DEVICE_ACTION` — `claim`, `publish`, `check-in`, or `end`. Required.
- `E2E_ITEM_ID_TEXT`, `E2E_ITEM_TITLE` — required for `claim` and `publish`.
- `E2E_CHANNEL_TITLE` — optional for `claim` and `publish`, default `E2E Podcast`.
- `E2E_PLAYBACK_STATUS` (default `playing`), `E2E_PLAYBACK_POSITION` (default `30`), and
  `E2E_PLAYBACK_DURATION` (default `600`) — for `claim` and `publish`.

The label is the constant `const OTHER_DEVICE_LABEL = 'E2E Other Device';`.

The access token is shared between actions through Maestro's `output` object, which persists across
`runScript` steps in one flow: `claim` sets `output.otherDeviceAccessToken` and
`output.otherDeviceSessionIdText`; `check-in` and `end` throw a clear error when they are missing.

Actions:

- `claim`:
  1. `POST /auth/mobile/token` with `{ email, password, device_label: OTHER_DEVICE_LABEL }`; read
     `access_token`.
  2. `GET /auth/sessions` with that token. Remember the `is_current` row's `id_text` as
     `output.otherDeviceSessionIdText`. `DELETE /auth/sessions/<id_text>` for every non-current row
     whose `device_label` equals `OTHER_DEVICE_LABEL` (left over from an earlier failed run).
  3. `POST /account/playback/presence` with `{}`.
  4. `POST /account/playback/state` with `{ claim: true, resource: { ref: { kind: 'item',
     item_id_text: E2E_ITEM_ID_TEXT }, medium: 2, title: E2E_ITEM_TITLE, channel_title:
     E2E_CHANNEL_TITLE, image_url: null }, status: E2E_PLAYBACK_STATUS, is_live: false,
     position_seconds: Number(E2E_PLAYBACK_POSITION), duration_seconds:
     Number(E2E_PLAYBACK_DURATION), rate: 1 }`. `2` is `MediumEnum.Podcast`; the script runs in
     Maestro's JavaScript and cannot import the enum, so name it in a `const PODCAST_MEDIUM = 2;`
     with a one-line comment. Match the field names to `PlaybackStatePublishBody` and
     `DTOPlaybackResourceSummary` in `packages/helpers/src/lib/accountPlaybackStream.ts`; when they
     differ from this list, the helper file wins.
- `publish`: step 4 again with the stored token and `claim: false` (this session is already the
  active device).
- `check-in`: `POST /account/playback/presence` with `{}` and the stored token.
- `end`: `DELETE /auth/sessions/<output.otherDeviceSessionIdText>` with the stored token. Ending the
  session removes the device from the list at once.

Every request throws on a non-2xx with the label, status, and body, as `failOn` does.

## `apps/mobile/e2e/playback-cross-device.yaml`

`appId: com.podverse.app.next`, `name: Playback Cross Device`. Header comment: what the flow
covers, that the host script is the second device, that it needs `flow_needs_e2e_api` and
`flow_needs_test_assets`, and the sequential-slots note. Use `${TIMEOUT_*}` from
`shared/timeouts.env` (**mobile-maestro-timeouts**). Steps:

1. `runFlow: shared/launch-and-connect.yaml`, then `runFlow: shared/login-seeded-user.yaml`.
1. `runScript` the script with `E2E_OTHER_DEVICE_ACTION: claim`, `E2E_ITEM_ID_TEXT: e2ePodChap0001`,
   `E2E_ITEM_TITLE: "E2E Podcast With Chapters"`, `E2E_PLAYBACK_STATUS: paused`,
   `E2E_PLAYBACK_POSITION: "30"`, `E2E_PLAYBACK_DURATION: "60"`.
1. **Mini player.** `extendedWaitUntil` visible `id: mini-player-remote-status`, timeout
   `${TIMEOUT_SLOWEST}`. `assertVisible` `{ id: mini-player-remote-status, text: "Paused on E2E
   Other Device" }`, `{ id: mini-player-title, text: "E2E Podcast With Chapters" }`, `{ id:
   now-playing-segment-title, text: "Topic A" }`, and `id: mini-player-devices`.
   `takeScreenshot: playback-cross-device-mini-player`.
1. **Device menu.** `tapOn: id: mini-player-devices`. `assertVisible` `id:
   mini-player-devices-sheet`, `id: mini-player-devices-sheet-this-device`, and `text: "E2E Other
   Device"`. `takeScreenshot: playback-cross-device-menu`. `tapOn: id:
   mini-player-devices-sheet-cancel`.
1. **Full player.** `tapOn: id: mini-player`. `assertVisible` `id: full-player-remote-region`,
   `id: full-player-remote-title-link`, `{ id: full-player-remote-title, text: "E2E Podcast With
   Chapters" }`, `{ id: full-player-segment-title, text: "Topic A" }`, `{ id:
   full-player-remote-status, text: "Paused on E2E Other Device" }`, `id:
   full-player-skip-previous`, `id: full-player-skip-next`, `{ id: full-player-share, enabled:
   true }`, `{ id: full-player-add-to-playlist, enabled: true }`, `id: full-player-devices`, and
   `id: full-player-speed`. `assertNotVisible: id: full-player-sleep-timer`.
   `takeScreenshot: playback-cross-device-full-player`. `tapOn: id: full-player-close`.
1. **Playing chapter on the episode screen.** `openLink:
   podverse-next://podcast/e2ePodChnl001/episode/e2ePodChap0001`, `runFlow:
   shared/confirm-ios-open-dialog.yaml`, `extendedWaitUntil` visible `id: episode-detail-screen`
   (timeout `${TIMEOUT_SLOWER}`), `tapOn: id: episode-detail-tab-chapters`, then `assertVisible: {
   id: episode-detail-chapter-row, selected: true, containsDescendants: [{ text: "Topic A" }] }`.
   `takeScreenshot: playback-cross-device-chapter-row`. When Maestro does not report `selected`
   for the row on a platform, report it in the final message and keep the screenshot as the
   check; do not drop the rest of the flow.
1. `runScript` with `E2E_OTHER_DEVICE_ACTION: publish`, the same item, title, and duration,
   `E2E_PLAYBACK_STATUS: playing`, and `E2E_PLAYBACK_POSITION: "5"`. The seeded file is 60 s long
   and the phone takes over at the estimated position, so starting near the beginning leaves the
   take-over and failed-transfer steps time to finish before the episode ends.
1. **List row.** On the same episode screen, `extendedWaitUntil` visible `{ id: "home-row-play-.*",
   text: "Pause" }` (the row's accessible name while its item plays), timeout `${TIMEOUT_SLOW}`.
   `takeScreenshot: playback-cross-device-row`.
1. `runScript` with `E2E_OTHER_DEVICE_ACTION: check-in`.
1. **Bring playback here.** `tapOn: id: mini-player-devices`, `tapOn: id:
   mini-player-devices-sheet-this-device`. `extendedWaitUntil` visible `id: playback-active-e2e`,
   timeout `${TIMEOUT_SLOWEST}`. `assertNotVisible: id: mini-player-remote-status`.
   `takeScreenshot: playback-cross-device-taken-over`.
1. `runScript` with `E2E_OTHER_DEVICE_ACTION: check-in`.
1. **Transfer that does not start.** `tapOn: id: mini-player-devices`, then `tapOn: text: "E2E Other
   Device"`. `assertVisible: { id: mini-player-remote-status, text: "Sending to E2E Other
   Device.*" }`. `takeScreenshot: playback-cross-device-sending`. The script never claims, so the
   transfer times out. `extendedWaitUntil` visible `id:
   playback-transfer-failed-dialog`, timeout `${TIMEOUT_SLOWEST}`. `assertVisible: text: "E2E
   Other Device didn't respond.*"`. `takeScreenshot: playback-cross-device-transfer-failed`.
   `tapOn: id: playback-transfer-failed-dismiss`. `assertNotVisible: id:
   playback-transfer-failed-dialog`. `assertVisible: id: playback-active-e2e` (the phone kept
   playing).
1. **Clean up.** `tapOn: id: mini-player-play-pause` (pause here), then `runScript` with
   `E2E_OTHER_DEVICE_ACTION: end`.

## `scripts/mobile/e2e-test.sh`

Add `playback-cross-device` to `flow_needs_e2e_api` (after `perf-scroll | play-mini-player |`,
before `playback-multi-device-handoff`) and to `flow_needs_test_assets` (before
`playback-offline-reconciliation`), keeping each list alphabetical.

## `apps/mobile/e2e/HOW-TO-RUN.md`

Add `playback-cross-device` in alphabetical position to the iOS list, the Android list, and the
"API + test-assets areas" list (anchor: the existing `playback-multi-device-handoff` lines show the
format of the first two lists). In the "API + test-assets areas" entry, add one sentence: the flow
uses a host script as a second device on the seeded account and needs the default sequential slots.

## Tests

This plan is the test. It adds no unit test.

## Release scratchpad

none
