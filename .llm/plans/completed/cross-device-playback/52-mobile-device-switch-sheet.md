**Cursor model:** Cursor Grok 4.7 · **Reasoning:** high

# 52 — Device switch button and device menu

A small device button appears in the mini player and in the full player's utility row when two or
more of the member's devices are connected. It opens a menu listing those devices. This device is
marked, the playing device is highlighted, and choosing a device moves playback there.

Before editing, confirm plan 50's `usePlaybackDeviceSwitchVisible`, `useCrossDevicePlaybackView`,
`selectPlaybackDeviceEntries`, `selectCanTransferPlayback`, and `usePlaybackDeviceLabel` exist,
that plan 34 added `transferPlaybackTo` and `takeOverPlaybackHere` to
`PlaybackSessionContextValue`, and that plan 51's `MiniPlayer.tsx` changes are in. If not, stop and
report.

## Rows

R9, R13, R38, R40

## Runs after

51, 34

## Files

apps/mobile/src/components/player/PlaybackDeviceButton.tsx
apps/mobile/src/components/player/PlaybackDeviceSheet.tsx
apps/mobile/src/components/player/MiniPlayer.tsx
apps/mobile/src/components/player/FullPlayerUtilityRow.tsx

## Decisions this plan fixes

- **When the button shows (R38).** Only when `usePlaybackDeviceSwitchVisible()` is true: the
  feature is `ready` and at least two devices are connected. It shows in local and remote mode
  alike, so a member can move playback off the phone too.
- **Where (R9).** Mini player: between the text column and play/pause. Full player: its own
  equal-width slot in the utility row, just before More. Showing or hiding the slot changes slot
  widths only; the row height is fixed (**mobile-player-fixed-region**).
- **The menu reuses `MoreMenu` (R13).** It is the same bottom sheet as the speed menu, with a
  section title "Play On". One row per device, in `buildPlaybackDeviceList` order: this device first,
  then the rest by creation time.
- **Marking (R40).** This device's row reads "{device} (This Device)". The playing device's row is
  `selected`: `MoreMenu`'s check mark in the primary color plus the `selected` accessibility state.
  When nobody is active, no row is selected.
- **Choosing.** `MoreMenu` closes on every choice. Choosing this device calls
  `takeOverPlaybackHere()`; choosing another device calls `transferPlaybackTo(sessionIdText)`.
- **Disabled rows.** The active device's row, every row while a transfer is pending, and every row
  when there is nothing to move (`selectCanTransferPlayback(view)` is false).
- **Pending feedback.** While `view.transfer !== null`, the device button shows the `Button`
  `loading` spinner in the same bounds (**button-stable-bounds**), and its accessible name becomes
  "Moving Playback to {device}" for the target. Success shows as the player switching to "Playing on
  {device}"; failure is plan 53's dialog.

## `PlaybackDeviceSheet.tsx`

```typescript
type PlaybackDeviceSheetProps = {
  onCancel: () => void;
  testID: string;
  visible: boolean;
};
export function PlaybackDeviceSheet(props: PlaybackDeviceSheetProps): JSX.Element;
```

- `useCrossDevicePlaybackView()`, `usePlaybackDeviceLabel()`, `useTranslation()`, and
  `usePlaybackSession()` for `transferPlaybackTo` and `takeOverPlaybackHere`.
- `entries = useMemo(() => selectPlaybackDeviceEntries(view), [view])`;
  `canTransfer = selectCanTransferPlayback(view)`; `isPending = view.transfer !== null`.
- One `MoreMenuSection` (`key: 'devices'`, `title: t('media_player.devices.sheet_title')`) with one
  item per entry:
  - `key`: `entry.device.session_id_text`.
  - `label`: `entry.isThisDevice ? t('media_player.devices.this_device_entry', { device:
    deviceLabel(entry) }) : deviceLabel(entry)`.
  - `selected`: `entry.isActive`.
  - `disabled`: `entry.isActive || isPending || !canTransfer`.
  - `onPress`: this device → `void takeOverPlaybackHere()`; else `void
    transferPlaybackTo(entry.device.session_id_text)`.
  - `testID`: `${testID}-this-device` for this device, else `${testID}-device-${index}` where
    `index` counts the other devices from 0. Session ids are not stable across E2E runs, so they
    are not used in test ids.
- `<MoreMenu cancelLabel={t('misc.cancel')} onCancel={onCancel} sections={sections}
  testID={testID} visible={visible} />`.

## `PlaybackDeviceButton.tsx`

```typescript
type PlaybackDeviceButtonProps = {
  /** Icon size and button size follow the host row. */
  appearance: 'mini' | 'full';
  testID: string;
};
export function PlaybackDeviceButton(props: PlaybackDeviceButtonProps): JSX.Element | null;
```

- Returns null when `usePlaybackDeviceSwitchVisible()` is false.
- Owns `const [isSheetVisible, setIsSheetVisible] = useState(false)` and renders
  `<PlaybackDeviceSheet onCancel={…close…} testID={`${testID}-sheet`} visible={isSheetVisible} />`
  next to the button. `MoreMenu` renders through `AppOverlay`, so it is fine inside the mini player
  (**mobile-overlays-in-tree**).
- Button: `Button iconOnly variant="ghost"`, icon `Ionicons name="swap-horizontal-outline"` in
  `tokens.button.secondaryColor`. `appearance === 'full'`: `size="lg"` and
  `FULL_PLAYER_UTILITY_ICON_SIZE`, matching the utility row. `appearance === 'mini'`: the size and
  icon size `PlayerTransportButton appearance="bare"` uses in the mini player, read from that
  component, so both controls share one hit height.
- `loading={view.transfer !== null}`. Label and accessible name: when pending,
  `t('media_player.devices.switch_device_pending', { device: deviceLabel(targetEntry) })` where
  `targetEntry` is the entry whose session id is `view.transfer.targetSessionIdText` (null gives
  "Another Device"); otherwise `t('media_player.devices.switch_device')`.
- `onPress`: `stopPropagation(event)` (`../../lib/gesture/stopPropagation`), as the mini player's
  play button does, so the tap does not also expand the player; then open the sheet.

## `MiniPlayer.tsx`

Anchor: the `View` with `style={styles.transport}`. Directly before it, render
`<PlaybackDeviceButton appearance="mini" testID="mini-player-devices" />`. The text column keeps
`flex: 1`, so the title shortens when the button shows.

## `FullPlayerUtilityRow.tsx`

Anchor: the last slot (`testID="full-player-more"`). Read `const showDeviceSlot =
usePlaybackDeviceSwitchVisible();` and, directly before the More slot, render `{showDeviceSlot ?
<View style={styles.slot}><PlaybackDeviceButton appearance="full" testID="full-player-devices"
/></View> : null}`. Update the component comment to name the device slot.

## Tests

The visibility rule, the entry order, the marking, and the labels are plan 50's and plan 11's tested
pure functions; this plan is presentation. Plan 57's Maestro flow opens the menu from
`mini-player-devices` and asserts `mini-player-devices-sheet-this-device` and
`mini-player-devices-sheet-device-0`.

## Release scratchpad

```markdown
## Mobile device switch menu

- Surfaces: mobile
- Change: when two or more of a member's devices are connected, a device button appears in the
  mini player and in the full player's controls. It opens a "Play On" menu that lists the devices,
  marks this one, and checks the device that is playing. Choosing a device moves playback there at
  the current position (livestreams at the live point); choosing this device brings playback to the
  phone. The button shows a spinner while a move is pending.
- Who notices: members signed in on more than one device
- Operator steps: none
```
