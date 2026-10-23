**Cursor model:** Cursor Grok 4.7 · **Reasoning:** high

# 97 — Maestro: the unsubscribe-from-artist dialog on mobile

A new flow drives the dialog on the directory artist screen (Cancel, then Artist and Albums), and
plan 88's `add-by-rss-artist.yaml` cleanup step learns to answer the dialog when it appears.

## Rows

R8, R55, R58

## Runs after

41, 88, 95

Plan 41 edits `artist.yaml` and the Maestro wiring for the artist screen; plan 88 adds
`add-by-rss-artist.yaml` and its `e2e-test.sh` and README lines.

## Files

apps/mobile/e2e/artist-unsubscribe.yaml
apps/mobile/e2e/add-by-rss-artist.yaml
scripts/mobile/e2e-test.sh
apps/mobile/e2e/README.md

## Reuses

- `shared/launch-and-connect.yaml`, `shared/login-seeded-user.yaml`,
  `shared/confirm-ios-open-dialog.yaml`, and the deep links `artist.yaml` and `album.yaml` open
  (`podverse-next://artist/e2eMusicChnl01`, `podverse-next://album/e2eMusicAlbm01`).
- Test ids: `artist-detail-screen`, `artist-detail-subscribe-toggle`, `artist-album-row-0`,
  `album-detail-screen`, `album-detail-subscribe-toggle`; plan 94's `artist-unsubscribe-dialog`,
  `artist-unsubscribe-dialog-cancel`, `artist-unsubscribe-dialog-artist-and-albums`,
  `artist-unsubscribe-dialog-artist-only`.
- The `TIMEOUT_*` ladder (**mobile-maestro-timeouts**): the fastest rung that holds each wait.

## Decisions this plan fixes

- **The flow starts from whatever follow state a previous run left.** Before each subscribe tap it
  checks for the `Subscribe` label (`runFlow` with `when: visible: "Subscribe"`), so a rerun after
  a failure still reaches the dialog. It ends with both unsubscribed.
- **Artist Only is not driven on mobile.** Plan 94 unit-tests what each choice ends, and the web
  spec drives all three buttons. One Maestro pass through Cancel and Artist and Albums proves the
  dialog, its copy, and the bulk write on the device.
- **`add-by-rss-artist.yaml` answers Artist Only** when the dialog appears, so the album follow
  `add-by-rss-track.yaml` leaves on the shared account stays as that flow expects. It waits for
  either the dialog or the screen behind with one id regex, because whether the dialog appears
  depends on suite order.

## `apps/mobile/e2e/artist-unsubscribe.yaml` (new)

Header in the style of `artist.yaml`: `appId: com.podverse.app.next`,
`name: Artist Unsubscribe Flow`, and a comment saying the flow follows the seeded artist and its
verified album, checks the unsubscribe dialog, and ends with neither followed.

Steps:

1. `runFlow: shared/launch-and-connect.yaml`, `runFlow: shared/login-seeded-user.yaml`.
2. `openLink: podverse-next://album/e2eMusicAlbm01`, `runFlow: shared/confirm-ios-open-dialog.yaml`,
   wait for `album-detail-screen` (`TIMEOUT_SLOWEST`). `runFlow` when `visible: "Subscribe"`:
   `tapOn: id: album-detail-subscribe-toggle`. Then wait for `text: "Unsubscribe"`
   (`TIMEOUT_SLOW`).
3. `openLink: podverse-next://artist/e2eMusicChnl01`, confirm dialog, wait for
   `artist-detail-screen` (`TIMEOUT_SLOWEST`) and `artist-album-row-0` (`TIMEOUT_SLOW`). The same
   conditional subscribe tap on `artist-detail-subscribe-toggle`, then wait for
   `text: "Unsubscribe"`.
4. `tapOn: id: artist-detail-subscribe-toggle`. Wait for `artist-unsubscribe-dialog`
   (`TIMEOUT_FAST`). `assertVisible: "Unsubscribe from E2E Music Artist?"` and
   `assertVisible: "You also follow 1 album by this artist."`.
   `takeScreenshot: artist-unsubscribe-dialog`.
5. `tapOn: id: artist-unsubscribe-dialog-cancel`. `assertNotVisible: id: artist-unsubscribe-dialog`,
   `assertVisible: "Unsubscribe"`.
6. Tap the toggle again, wait for the dialog (`TIMEOUT_FAST`), `tapOn: id: artist-unsubscribe-dialog-artist-and-albums`.
   Wait for `text: "Subscribe"` (`TIMEOUT_SLOW`). `takeScreenshot: artist-unsubscribe-done`.
7. `openLink: podverse-next://album/e2eMusicAlbm01`, confirm dialog, wait for
   `album-detail-screen`, then wait for `text: "Subscribe"` (`TIMEOUT_SLOW`).

Maestro `text` selectors match the whole string, so `"Unsubscribe"` never matches the dialog
title.

## `apps/mobile/e2e/add-by-rss-artist.yaml` (step 11)

Replace the cleanup step's body after `tapOn: id: add-by-rss-home-remove` with:

```yaml
- extendedWaitUntil:
    visible:
      id: "artist-unsubscribe-dialog|add-by-rss-track-detail-screen"
    timeout: ${TIMEOUT_FAST}
- runFlow:
    when:
      visible:
        id: artist-unsubscribe-dialog
    commands:
      - tapOn:
          id: artist-unsubscribe-dialog-artist-only
- extendedWaitUntil:
    visible:
      id: add-by-rss-track-detail-screen
    timeout: ${TIMEOUT_FAST}
```

Update the step's comment: the artist leaves this account's follows; when the account follows an
album the artist lists, the dialog appears and Artist Only keeps that album.

## `scripts/mobile/e2e-test.sh`

Add `artist-unsubscribe` to the `flow_needs_e2e_api` case list, directly after `artist`.

## `apps/mobile/e2e/README.md`

In **Current flows**, add `` `artist-unsubscribe` `` after `` `add-by-rss-artist` ``.

## Must stay true

- `artist.yaml` is unchanged and its asserts still hold (the flow never subscribes there).
- Every wait uses a `TIMEOUT_*` rung.

## Tests

This plan is the test.

## Release scratchpad

none
