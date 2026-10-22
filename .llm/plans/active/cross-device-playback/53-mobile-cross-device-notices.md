**Cursor model:** Cursor Grok 4.7 · **Reasoning:** high

# 53 — Mobile notices when playback could not start on another device

When the phone asks another device to play and it does not start there, the phone says so and
names the device. When a play, pause, seek, speed, or item command does not reach the playing
device, the phone says that too. One app-wide component reads plan 30's store and shows a dialog
the person dismisses.

Before editing, confirm plan 50's `transferFailureMessageKey`, `selectPlaybackDeviceEntries`,
`usePlaybackDeviceLabel`, and `useCrossDevicePlaybackView`, and plan 30's
`clearCrossDevicePlaybackTransferFailure` and `clearCrossDevicePlaybackCommandFailure`, exist. If
not, stop and report.

## Rows

R45

## Runs after

50, 34

## Files

apps/mobile/src/components/feedback/CrossDevicePlaybackNotice.tsx
apps/mobile/App.tsx

## Decisions this plan fixes

- **A dialog, not a toast.** The failure arrives up to 8 s after the tap, often after the menu has
  closed, so it must stay until read. It is `ConfirmDialog` with one Dismiss action, the same
  component as the 744 prompt.
- **One at a time.** A transfer failure shows first. A command failure shows only when no transfer
  failure is showing. Dismissing clears that failure in the store.
- **The device's name survives its departure.** For `not_connected` the target has usually left the
  device list. The component remembers the last label it saw for each session id and uses it;
  "Another Device" only when it never saw one.
- **Copy per reason (R45).** Each `CrossDevicePlaybackTransferFailureReason` has its own body
  (plan 50's `transferFailureMessageKey`). A command failure has one body; it does not name a device
  because the active device may have changed since.
- **Signed out.** Plan 31 resets the store on sign-out, which clears both failures, so no dialog
  outlives the account.

## `CrossDevicePlaybackNotice.tsx`

```typescript
export function CrossDevicePlaybackNotice(): JSX.Element;
```

- `useCrossDevicePlaybackView()`, `usePlaybackDeviceLabel()`, `useTranslation()`.
- `entries = useMemo(() => selectPlaybackDeviceEntries(view), [view])`.
- `knownLabelsRef = useRef(new Map<string, string>())`. In a `useEffect` on `[entries,
  deviceLabel]`, set `knownLabelsRef.current.set(entry.device.session_id_text, deviceLabel(entry))`
  for each entry.
- `transferFailure = view.transferFailure`. Its device label: the current entry with that session
  id through `deviceLabel`, else `knownLabelsRef.current.get(id)`, else `deviceLabel(null)`.
- Render two `ConfirmDialog`s:
  1. `testID="playback-transfer-failed-dialog"`, `title={t('media_player.devices.transfer_failed_title')}`,
     `body={transferFailure === null ? '' : t(transferFailureMessageKey(transferFailure.reason), {
     device })}`, `cancelLabel={t('misc.dismiss')}`,
     `cancelTestID="playback-transfer-failed-dismiss"`,
     `onCancel={clearCrossDevicePlaybackTransferFailure}`, `visible={transferFailure !== null}`.
  2. `testID="playback-command-failed-dialog"`, `title={t('media_player.devices.command_failed_title')}`,
     `body={t('media_player.devices.command_failed_body')}`, `cancelLabel={t('misc.dismiss')}`,
     `cancelTestID="playback-command-failed-dismiss"`,
     `onCancel={clearCrossDevicePlaybackCommandFailure}`,
     `visible={transferFailure === null && view.commandFailure !== null}`.
- A one-line doc comment: app-wide notices for cross-device transfers and remote controls that did
  not reach the other device.

## `App.tsx`

Anchor: `<ForcedLogoutNotice />` inside `AppBody`. Render `<CrossDevicePlaybackNotice />` directly
after it, and import it next to the `ForcedLogoutNotice` import. It sits inside
`OverlayHostProvider` and inside `PlaybackProvider`, which `AppBody` already is.

## Tests

The reason-to-copy mapping is plan 50's tested `transferFailureMessageKey`. Plan 57's Maestro flow
times out a transfer to a device that never starts and asserts `playback-transfer-failed-dialog`,
its text, and that `playback-transfer-failed-dismiss` closes it.

## Release scratchpad

```markdown
## Mobile says when another device did not start

- Surfaces: mobile
- Change: when a member moves playback from the phone to another device and it does not start
  there, the phone shows a dialog naming the device and the reason: it could not load the media, it
  needs a tap first, it did not respond, it disconnected, or it could not be reached. When a play,
  pause, seek, speed, or episode choice does not reach the playing device, the phone says so.
- Who notices: members signed in on more than one device
- Operator steps: none
```
