**Cursor model:** Cursor Grok 4.7 · **Reasoning:** high

# 45 — Tap-to-play prompt and the "could not start there" notice

Two pieces of feedback around a transfer:

- **On the receiving tab:** a browser can refuse to start audio until someone clicks the page.
  Plan 23 (commands) and plan 24 (local take over) detect that and set the store's `tapToPlay`.
  This plan shows a prompt, Ready to Play Here, whose Play Here button calls
  `confirmTapToPlay()` inside the click handler, so the browser counts the click as the gesture.
- **On the sending tab:** when the target reports it could not start, or never answers, plan 24
  sets `transferFailure`. This plan shows it as an error toast naming the device, then clears it.

Before editing, confirm `useCrossDevicePlayback()` in `apps/web/src/contexts/CrossDevicePlayback.tsx`
returns `confirmTapToPlay`, `dismissTapToPlay`, and `dismissTransferFailure` (plans 23 and 24),
the snapshot has `tapToPlay` and `transferFailure`, and plan 42's `usePlaybackDevices` exists. If
not, stop and report.

## Rows

R41, R44, R91

## Runs after

23, 24, 40, 42

## Files

apps/web/src/components/MediaPlayer/CrossDevice/CrossDevicePlaybackNotices.tsx
apps/web/src/components/MediaPlayer/Controller/MediaPlayerController.tsx

## Decisions this plan fixes

- **The prompt is a modal**, built like the existing handoff prompt in
  `MediaPlayerController.tsx` (`@podverse/ui` `Modal` with `Modal.Body` and `Modal.Actions`,
  Cancel-style action first, primary last, per **modal-layout-contract**). A modal gets focus,
  which a click-gesture prompt needs; a toast would not.
- **The failure is a toast** (`showToast(message, 'error')` from `components/Toast/Toast.tsx`).
  The store keeps no history of failures; showing it once and clearing it means a later transfer
  starts clean.
- **The prompt and the handoff prompt never both show:** `tapToPlay` is only set while this tab
  holds a pending claim (`active` role), and plan 26 shows the handoff prompt only in a settled
  `idle` role.
- **Mounted in `MediaPlayerController`,** which is always mounted with the app chrome, so the
  prompt works before the lazy player UI loads.

## Intentional divergence from mobile: toast here, dialog there (R91)

The operator kept both forms after review ("keep the web toast and the mobile dialog; record it
as an intentional divergence in plans 45 and 53"), per **cross-surface-change-impact**.

- **Web (this plan):** a one-time error toast (`showToast(message, 'error')`) with the reason's
  copy and the device's name. It shows once, the store clears the failure at once, and the toast
  goes away on its own. A device that already left the list reads as "Another Device".
- **Mobile (plan 53):** a `ConfirmDialog` with one Dismiss action. It stays until the person
  dismisses it, a transfer failure shows before a command failure, and it keeps the last name it
  saw for a device that has left.
- **Why they need not match:** each surface uses the notice it already has for errors that
  arrive after the action. Web has a toast system the player and playlist actions already use,
  and the browser tab that sent the transfer is normally still the one in view. The phone has no
  toast system; its late notices are single-acknowledge dialogs, and the failure can arrive up to
  8 s after the tap, often after the device menu has closed, so a notice that disappears on its
  own would often go unseen there. What matters for parity matches: the same failure reasons,
  the device named, and copy with the same meaning.

When either side changes its notice, it updates this section and plan 53's matching section
rather than converging the two.

## `CrossDevicePlaybackNotices.tsx`

`'use client'`. Two components in the file:

```tsx
export const CrossDevicePlaybackNotices: React.FC = () => {
  const availability = useCrossDevicePlaybackSnapshot((s) => s.availability);
  return availability === 'ready' ? <CrossDevicePlaybackNoticesReady /> : null;
};
```

The outer component reads only the singleton snapshot, so `useCrossDevicePlayback()` (context)
runs only where the provider has reached `ready`.

`CrossDevicePlaybackNoticesReady` (file-local):

- `const { confirmTapToPlay, dismissTapToPlay, dismissTransferFailure } = useCrossDevicePlayback();`
- `const tapToPlay = useCrossDevicePlaybackSnapshot((s) => s.tapToPlay);`
- `const transferFailure = useCrossDevicePlaybackSnapshot((s) => s.transferFailure);`
- `const { entries, formatName } = usePlaybackDevices();`
- `const tMediaPlayer = useTranslations('media_player');` and `const tMisc = useTranslations('misc');`
- Failure effect, on `[transferFailure]` (read `entries`, `formatName`, and `tMediaPlayer`
  through a ref updated each render so they are not dependencies):

  ```typescript
  useEffect(() => {
    if (transferFailure === null) {
      return;
    }
    const entry =
      entriesRef.current.find(
        (e) => e.device.session_id_text === transferFailure.targetSessionIdText
      ) ?? null;
    showToast(
      tRef.current(`cross_device.transfer_failed.${transferFailure.reason}`, {
        device: formatNameRef.current(entry),
      }),
      'error'
    );
    dismissTransferFailure();
  }, [transferFailure, dismissTransferFailure]);
  ```

  `dismissTransferFailure` is a stable callback from the provider. A device that already left
  the list reads as `cross_device.unknown_device` through `formatName(null)`.
- Prompt:

  ```tsx
  <Modal
    ariaLabel={tMediaPlayer('cross_device.tap_to_play.title')}
    closeButtonAriaLabel={tMisc('close_modal')}
    header={tMediaPlayer('cross_device.tap_to_play.title')}
    isOpen={tapToPlay !== null}
    onClose={dismissTapToPlay}
  >
    <Modal.Body>
      <p>{tMediaPlayer('cross_device.tap_to_play.body')}</p>
    </Modal.Body>
    <Modal.Actions>
      <Button onClick={dismissTapToPlay} type="button" variant="secondary">
        {tMediaPlayer('cross_device.tap_to_play.dismiss_action')}
      </Button>
      <Button onClick={confirmTapToPlay} type="button" variant="primary">
        {tMediaPlayer('cross_device.tap_to_play.play_action')}
      </Button>
    </Modal.Actions>
  </Modal>
  ```

  `onClick={confirmTapToPlay}` passes the function directly: nothing async runs before it, so
  the click still counts as the gesture when `setMPIsPlaying(true)` starts the media element.
  Plan 23 dismisses a prompt older than 60 s; this component only renders the store's value.

Imports: `Button`, `Modal` from `@podverse/ui`; `showToast` from `../../Toast/Toast`.

## `MediaPlayerController.tsx`

Render `<CrossDevicePlaybackNotices />` right after the handoff `<Modal>…</Modal>` inside the
returned fragment. Touch nothing else in this file (plans 25 and 42 edit other parts).

## Must stay true

- The prompt's Play Here click calls `confirmTapToPlay` synchronously in the handler.
- Each `transferFailure` value produces exactly one toast, then the store holds null.
- Outside `ready` availability nothing renders and the context hook is not called.

## Tests

No unit test: the component is wiring over plan 23's and 24's store values, which their own tests
cover, and web component tests here do not load the translation catalog. Plan 47's Playwright
spec covers both: a target tab whose `play()` is refused shows Ready to Play Here and plays after
Play Here, and the sender shows the "needs a tap first" toast.

## Release scratchpad

```markdown
## Web asks for a tap when a browser blocks audio after a transfer

- Surfaces: web
- Change: When playback is moved to a web browser that will not start audio until the page is
  clicked, that browser shows a Ready to Play Here prompt; Play Here starts playback and Not Now
  dismisses it. The device that sent playback shows an error naming the device when playback
  could not start there, did not respond, could not be reached, or the request failed.
- Who notices: members moving playback between devices
- Operator steps: none
```
