**Cursor model:** Cursor Grok 4.7 · **Reasoning:** high

# 44 — Device button and menu on the web player

A small device icon on the player that appears only when two or more devices are connected for
the account. Tapping it opens a menu of the connected devices: this device first and marked
This Device, the playing device checked and labeled Playing. Choosing a device sends the audio
there (plan 24's `transferTo`); choosing This Device moves it here.

The menu is the shared `@podverse/ui` `DropdownMenuPanel` with plan 41's radio items, opened the
same way the player's Settings menu opens (`SettingsButton.tsx` is the parity source for markup,
keyboard handling, and styles).

Before editing, confirm plan 41's `checked`, `description`, and `key` fields exist on
`DropdownMenuPanelItem`, plan 42's `usePlaybackDevices` and `useRemotePlayerDisplay` exist, and
`useCrossDevicePlayback()` returns `transferTo` (plan 24). If not, stop and report.

## Rows

R8, R12, R37, R39, R62

## Runs after

40, 41, 42

## Files

apps/web/src/lib/crossDevicePlayback/playbackDeviceMenu.ts
apps/web/src/lib/crossDevicePlayback/playbackDeviceMenu.test.ts
apps/web/src/components/MediaPlayer/Buttons/PlaybackDevicesButton.tsx
apps/web/src/styles/components/MediaPlayer/Buttons/PlaybackDevicesButton.module.scss
apps/web/src/components/MediaPlayer/Desktop/MediaPlayerButtonsDesktop.tsx
apps/web/src/components/MediaPlayer/Mobile/MediaPlayerButtonsMobile.tsx
apps/web/src/components/MediaPlayer/Modal/MediaPlayerButtonsModal.tsx

## Decisions this plan fixes

- **When the icon shows:** availability `ready` and plan 11's `shouldShowPlaybackDeviceSwitch`
  (two or more connected devices), in every player variant, whether this tab plays or not. It
  is part of the player bar, so it shows only while the bar does.
- **Order:** plan 11's `buildPlaybackDeviceList` order (this device first, then by session
  creation). The playing device is checked in place, not moved.
- **Same labels:** plan 11's numbering through plan 42's `formatName` ("Chrome · macOS (2)").
- **Descriptions:** "This Device", then one of "Sending…" (the pending transfer's target),
  "Playing in Another Tab" (this device is active and this tab is in the `remote` role), or
  "Playing" (active), joined with " · ".
- **Choosing:**
  - another device that is not active → `transferTo(itsSessionIdText)`;
  - the active device (another device, already playing) → nothing;
  - this device while this tab already holds the audio (`role === 'active'` and
    `thisTabHoldsAudio`) → nothing;
  - this device otherwise → `transferTo(thisSessionIdText)`, which plan 24 runs as a local take
    over (from another device, or from another tab of this browser).
- **Placement:** desktop bar at the start of the end section, before volume; mobile layout after
  the alternate enclosure button and before Settings; modal after Settings. The menu opens above
  the button (`verticalPosition="above"`), anchored like Settings.
- **Remote hint:** while the remote view shows (plan 42), the icon uses the accent color.

## `playbackDeviceMenu.ts`

```typescript
import type { PlaybackDeviceListEntry } from '@podverse/helpers';

export type PlaybackDeviceMenuDescriptionPart =
  | 'this_device'
  | 'sending'
  | 'playing_in_another_tab'
  | 'playing';

export type PlaybackDeviceMenuEntry = {
  entry: PlaybackDeviceListEntry;
  descriptionParts: PlaybackDeviceMenuDescriptionPart[];
  checked: boolean;
  /** Session to pass to `transferTo`, or null when choosing it does nothing. */
  transferTargetSessionIdText: string | null;
};

export function buildPlaybackDeviceMenuEntries(params: {
  entries: readonly PlaybackDeviceListEntry[];
  role: 'active' | 'remote' | 'idle';
  thisTabHoldsAudio: boolean;
  pendingTransferTargetSessionIdText: string | null;
}): PlaybackDeviceMenuEntry[];
```

Use the store's role type (`CrossDevicePlaybackSnapshot['role']`) for `role` if it is a named
type other than this union. Per entry, in input order:

- `descriptionParts`: `'this_device'` when `entry.isThisDevice`; then `'sending'` when the
  entry's session equals the pending target; else, when `entry.isActive`,
  `'playing_in_another_tab'` if `entry.isThisDevice && role === 'remote'`, otherwise `'playing'`.
- `checked`: `entry.isActive`.
- `transferTargetSessionIdText`: per **Choosing** above (null for the two "nothing" cases).

## `PlaybackDevicesButton.tsx`

Two components in one file, so the context hook runs only when the menu can show:

```tsx
export const PlaybackDevicesButton: React.FC = () => {
  const { showSwitch } = usePlaybackDevices();
  return showSwitch ? <PlaybackDevicesMenu /> : null;
};
```

`PlaybackDevicesMenu` (file-local):

- `buttonRef`, `menuRef` as in `SettingsButton`.
- `const { entries, formatName } = usePlaybackDevices();`
- `const { transferTo } = useCrossDevicePlayback();`
- Snapshot selects: `role`, `thisTabHoldsAudio`, `pendingTransfer?.targetSessionIdText ?? null`.
- `const isRemoteView = useRemotePlayerDisplay() !== null;`
- `const tMediaPlayer = useTranslations('media_player');`
- `menuEntries = useMemo(() => buildPlaybackDeviceMenuEntries({ … }), […])`.
- `menuItems: DropdownMenuPanelItem[]` from `menuEntries`:
  - `key`: `entry.device.session_id_text`
  - `label`: `formatName(entry)`
  - `description`: the parts mapped to `tMediaPlayer('cross_device.this_device')`,
    `'cross_device.sending'`, `'cross_device.playing_in_another_tab'`, `'cross_device.playing'`,
    joined with `' · '`; `undefined` when there are none
  - `checked`: `checked`
  - `onClick`: when `transferTargetSessionIdText` is non-null,
    `void transferTo(transferTargetSessionIdText)`; otherwise do nothing.
- `useDropdownKeyboardNavigation({ itemCount: menuItems.length, onItemSelect: (idx) => menuItems[idx]?.onClick(), onClose: () => setOpen(false), buttonRef, menuRef })`
  exactly as `SettingsButton` does.
- Markup (parity with `SettingsButton`):

  ```tsx
  <div className={styles.devicesDropdownWrapper}>
    <button
      ref={buttonRef}
      className={styles.devicesButton}
      aria-expanded={open}
      aria-haspopup="menu"
      aria-label={tMediaPlayer('cross_device.devices_button')}
      data-remote-active={isRemoteView ? 'true' : undefined}
      data-testid="media-player-devices-button"
      onClick={() => setOpen((v) => !v)}
      onKeyDown={handleButtonKeyDown}
      type="button"
    >
      <FaComputer aria-hidden />
    </button>
    <DropdownMenuPanel
      menuItems={menuItems}
      open={open}
      menuRef={menuRef}
      focusedIndex={focusedIndex}
      setFocusedIndex={setFocusedIndex}
      handleMenuKeyDown={handleMenuKeyDown}
      setOpen={setOpen}
      verticalPosition="above"
    />
  </div>
  ```

  `FaComputer` comes from `react-icons/fa6` (the icon set the web app uses).

The component starts with `'use client'`. Styles import last (**styles-import-last**).

## `PlaybackDevicesButton.module.scss`

Copy `SettingsButton.module.scss`'s structure:

```scss
@use '../../../variables/breakpoints' as *;
@use '../../../mixins/buttons.scss' as *;

.devicesDropdownWrapper {
  position: relative;
}

.devicesButton {
  @include mediaPlayerButton;

  &[data-remote-active='true'] {
    color: var(--text-color-accent);
  }
}

@media (max-width: $breakpoint-md-max) {
  .devicesDropdownWrapper {
    width: 40px;
    height: 40px;
    display: flex;
    align-items: center;
    justify-content: center;
  }
}
```

## Placements

- `MediaPlayerButtonsDesktop.tsx`: first element of `endSection`, in both the local and remote
  branches plan 42 wrote: `<PlaybackDevicesButton />` before the volume controls.
- `MediaPlayerButtonsMobile.tsx`: right after the `AlternateEnclosureButton` line, before the
  Settings line, in both branches.
- `MediaPlayerButtonsModal.tsx`: last element of `startSection`, after `SettingsButton`, in both
  branches.

## Must stay true

- With one connected device, or availability other than `ready`, no device button renders and
  the player looks exactly as before.
- Choosing an entry never loads media in this tab by itself; plan 24 decides how a transfer runs.
- `useCrossDevicePlayback()` is only called inside `PlaybackDevicesMenu`.

## Tests

Vitest, `playbackDeviceMenu.test.ts`:

- This device first and not active, another device active → this device has `['this_device']`,
  target its own session; the other has `['playing']`, `checked: true`, target null.
- `role: 'remote'` with this device active (another tab plays) → this device has
  `['this_device', 'playing_in_another_tab']`, `checked: true`, target its session.
- `role: 'active'` and `thisTabHoldsAudio` → this device's target is null.
- Pending transfer to a third device → that entry has `['sending']` and its own target.
- Idle (no active entry) → nothing checked; every entry's target is its session.

Plan 47's Playwright spec covers the icon appearing with two devices, the menu's marks, and
transfers in both directions.

## Release scratchpad

```markdown
## Web player device switch

- Surfaces: web
- Change: When two or more devices are signed in and connected for the account, the web player
  (bar, mobile layout, and full-screen player) shows a Playback Devices button. Its menu lists
  the connected devices with this device first and marked This Device, and the playing device
  checked and marked Playing. Devices with the same name are numbered. Choosing another device
  moves playback there; choosing This Device moves it here, including from another tab of the
  same browser.
- Who notices: members signed in on more than one device
- Operator steps: none
```
