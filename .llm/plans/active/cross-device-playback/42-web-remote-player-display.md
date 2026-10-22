**Cursor model:** Cursor Grok 4.7 · **Reasoning:** extra high

# 42 — Web player shows what another device or tab is playing

When another device (or another tab of this browser) plays for the account, this tab's role is
`remote` and plan 22 clears its local MediaPlayer context. Today that would hide the player bar.
This plan keeps the bar up and renders it from the cross-device store's `displayState`: the
remote item's title, show title, and artwork in the desktop, mobile-layout, and modal players; a
caption naming where it plays; only the controls that work remotely; and, for a livestream, the
Live label in place of the progress bar.

The progress bar's remote behavior is plan 43. The device button is plan 44. Prompts and notices
are plan 45. Item rows are plan 46.

Before editing, confirm these exist; if any is missing, stop and report:

- `apps/web/src/contexts/CrossDevicePlayback.tsx` exports `useCrossDevicePlaybackSnapshot`
  (plan 22).
- `apps/web/src/lib/crossDevicePlayback/crossDevicePlaybackStore.ts` exports
  `CrossDevicePlaybackSnapshot` with `role`, `availability`, `displayState`, `devices`,
  `thisSessionIdText`, and `pendingTransfer` (plan 21).
- `apps/web/src/hooks/usePlayerTransport.ts` exists and `PlayButton.tsx` uses it (plan 25).
- `packages/helpers/src/lib/crossDevicePlayback.ts` exports `getPlaybackRemoteControls`,
  `buildPlaybackDeviceList`, `shouldShowPlaybackDeviceSwitch`, and `PlaybackDeviceListEntry`
  (plan 11), re-exported from `@podverse/helpers`.
- `media_player.cross_device.*` keys exist in `packages/i18n-catalog/consumer/originals/en-US.json`
  (plan 40).

## Rows

R6, R16, R46, R58, R62

## Runs after

22, 24, 25, 26, 40

## Files

apps/web/src/lib/crossDevicePlayback/remotePlayerDisplay.ts
apps/web/src/lib/crossDevicePlayback/remotePlayerDisplay.test.ts
apps/web/src/lib/crossDevicePlayback/playbackDeviceName.ts
apps/web/src/lib/crossDevicePlayback/playbackDeviceName.test.ts
apps/web/src/hooks/useRemotePlayerDisplay.ts
apps/web/src/hooks/usePlaybackDevices.ts
apps/web/src/components/MediaPlayer/CrossDevice/PlayerDeviceCaption.tsx
apps/web/src/components/MediaPlayer/CrossDevice/RemoteLiveLabel.tsx
apps/web/src/styles/components/MediaPlayer/CrossDevice/PlayerDeviceCaption.module.scss
apps/web/src/styles/components/MediaPlayer/CrossDevice/RemoteLiveLabel.module.scss
apps/web/src/components/MediaPlayer/MediaPlayer.tsx
apps/web/src/components/MediaPlayer/Controller/MediaPlayerController.tsx
apps/web/src/components/MediaPlayer/Desktop/MediaPlayerInfoDesktop.tsx
apps/web/src/components/MediaPlayer/Desktop/MediaPlayerControlsDesktop.tsx
apps/web/src/components/MediaPlayer/Desktop/MediaPlayerButtonsDesktop.tsx
apps/web/src/components/MediaPlayer/Mobile/MediaPlayerInfoMobile.tsx
apps/web/src/components/MediaPlayer/Mobile/MediaPlayerControlsMobile.tsx
apps/web/src/components/MediaPlayer/Mobile/MediaPlayerButtonsMobile.tsx
apps/web/src/components/MediaPlayer/Modal/MediaPlayerInfoModal.tsx
apps/web/src/components/MediaPlayer/Modal/MediaPlayerControlsModal.tsx
apps/web/src/components/MediaPlayer/Modal/MediaPlayerButtonsModal.tsx

## Decisions this plan fixes

- **When the bar shows remote state.** Only in the `remote` role with a non-null
  `displayState.resource`. In `idle` and `active` roles the bar shows the local player exactly as
  today. A tab with no local item and no active device shows no bar, even when the server still
  holds a paused state: that state can name an item the queue no longer has.
- **The playing device pauses:** the bar stays, shows paused, and the position stops (plan 43).
- **It stops** (state with a null resource): the remote view ends; with the local player cleared,
  the bar hides.
- **It goes away** (presence expires, area A clears the active device): the role becomes `idle`,
  the remote view ends, and plan 26 loads the queue head paused, so the bar shows the same item
  locally, paused, with no caption.
- **Other tabs of this browser** while one tab plays: `remote` role, same view, caption
  "Playing in Another Tab". The device menu (plan 44) moves audio to this tab.
- **Remote controls shown:** play/pause always; jump back and forward and the Settings button
  (its only item is speed) when not live; nothing else. Next and previous track, volume, mute,
  clip, add to playlist, repeat, shuffle, and alternate enclosure are local-only and hidden.
  The mobile layout shows jump buttons for any medium in the remote view, like the desktop layout
  always does.
- **Livestream remote view:** title, artwork, caption, the Live label where the progress bar
  would be, and play/pause. The local livestream view is unchanged.
- **Modal titles are plain text** in the remote view: the state carries ids and display fields,
  not routes, and no medium to pick the route from. No like button, chapter link, subsection, or
  modal video.
- **Caption precedence:** a pending transfer ("Sending to {device}…") wins over "Playing in
  Another Tab" and "Playing on {device}". The sending caption shows in local views too, because
  the tab that sends usually is the one playing.

## `remotePlayerDisplay.ts`

```typescript
import type {
  DTOPlaybackResourceSummary,
  DTOPlaybackState,
  PlaybackDeviceListEntry,
  PlaybackRemoteControls,
} from '@podverse/helpers';

import type { CrossDevicePlaybackSnapshot } from './crossDevicePlaybackStore';

export type RemotePlayerDisplay = {
  state: DTOPlaybackState;
  resource: DTOPlaybackResourceSummary;
  controls: PlaybackRemoteControls;
};

/** The remote view's data, or null when this tab shows its local player. */
export function resolveRemotePlayerDisplay(params: {
  role: CrossDevicePlaybackSnapshot['role'];
  displayState: DTOPlaybackState | null;
}): RemotePlayerDisplay | null;

export type PlayerDeviceCaption =
  | { kind: 'sending'; entry: PlaybackDeviceListEntry | null }
  | { kind: 'other_tab' }
  | { kind: 'other_device'; entry: PlaybackDeviceListEntry | null };

export function resolvePlayerDeviceCaption(params: {
  availability: CrossDevicePlaybackSnapshot['availability'];
  role: CrossDevicePlaybackSnapshot['role'];
  thisSessionIdText: string | null;
  activeSessionIdText: string | null;
  pendingTransferTargetSessionIdText: string | null;
  entries: readonly PlaybackDeviceListEntry[];
}): PlayerDeviceCaption | null;
```

- `resolveRemotePlayerDisplay`: non-null only when `role === 'remote'`, `displayState !== null`,
  and `displayState.resource !== null`; `controls` is
  `getPlaybackRemoteControls({ isLive: displayState.is_live })`.
- `resolvePlayerDeviceCaption`, in order:
  1. `availability !== 'ready'` → null.
  2. `pendingTransferTargetSessionIdText` non-null and not equal to `thisSessionIdText` →
     `{ kind: 'sending', entry }`, `entry` = the entry whose `device.session_id_text` equals the
     target, else null.
  3. `role === 'remote'` and `activeSessionIdText === thisSessionIdText` (both non-null) →
     `{ kind: 'other_tab' }`.
  4. `role === 'remote'` → `{ kind: 'other_device', entry }`, `entry` looked up by
     `activeSessionIdText`.
  5. Otherwise null.

Use `===` only, no `as` (**avoid-type-assertions**).

## `playbackDeviceName.ts`

```typescript
import type { PlaybackDeviceListEntry } from '@podverse/helpers';

export type PlaybackDeviceNameLabels = {
  unnamedWebDevice: string;
  unnamedMobileDevice: string;
  withNumber: (name: string, number: number) => string;
};

export function formatPlaybackDeviceName(
  entry: Pick<PlaybackDeviceListEntry, 'device' | 'sameLabelNumber'>,
  labels: PlaybackDeviceNameLabels
): string;
```

Name = `device.device_label` trimmed when non-empty; else `labels.unnamedMobileDevice` when
`device.client_type === 'mobile'`, else `labels.unnamedWebDevice`. When `sameLabelNumber` is not
null, return `labels.withNumber(name, sameLabelNumber)`. The number already comes from plan 11's
grouping (label, or client type when unlabeled), so two unlabeled browsers read
"Web Browser (1)" and "Web Browser (2)".

## `usePlaybackDevices.ts`

```typescript
export type PlaybackDevicesView = {
  entries: PlaybackDeviceListEntry[];
  /** Availability is `ready` and at least two devices are connected. */
  showSwitch: boolean;
  /** Display name; null → `cross_device.unknown_device`. */
  formatName: (entry: PlaybackDeviceListEntry | null) => string;
};

export function usePlaybackDevices(): PlaybackDevicesView;
```

- Selects with `useCrossDevicePlaybackSnapshot`, one selector per value, each returning a
  primitive or an object the snapshot holds: `availability`, `devices`, `thisSessionIdText`, and
  `displayState?.active_session_id_text ?? null`.
- `entries` = `useMemo` of `buildPlaybackDeviceList({ devices: devices?.devices ?? [], thisSessionIdText, activeSessionIdText })`.
- `showSwitch` = `availability === 'ready' && shouldShowPlaybackDeviceSwitch(devices?.devices ?? [])`.
- `formatName` = `useCallback` using `useTranslations('media_player')`:
  `unnamedWebDevice: t('cross_device.unnamed_web_device')`,
  `unnamedMobileDevice: t('cross_device.unnamed_mobile_device')`,
  `withNumber: (name, number) => t('cross_device.device_with_number', { name, number })`;
  a null entry returns `t('cross_device.unknown_device')`.

## `useRemotePlayerDisplay.ts`

```typescript
export function useRemotePlayerDisplay(): RemotePlayerDisplay | null;
/** True when the player bar has something to show: a local item or the remote view. */
export function useMediaPlayerBarVisible(): boolean;
```

- `useRemotePlayerDisplay`: select `role` and `displayState`; return
  `useMemo(() => resolveRemotePlayerDisplay({ role, displayState }), [role, displayState])`.
- `useMediaPlayerBarVisible`: `!!mpChannel || !!mpAddByRSS || useRemotePlayerDisplay() !== null`
  (call the hook unconditionally first; read `mpChannel` and `mpAddByRSS` from `useMediaPlayer()`).

Both hooks work outside `CrossDevicePlaybackProvider` because the snapshot hook reads the module
singleton; there the role is `idle`, so they return null and the local value.

## `PlayerDeviceCaption.tsx`

```typescript
export const PlayerDeviceCaption: React.FC = () => { … };
```

- Selects `availability`, `role`, `thisSessionIdText`,
  `displayState?.active_session_id_text ?? null`, and `pendingTransfer?.targetSessionIdText ?? null`;
  reads `entries` and `formatName` from `usePlaybackDevices()`; calls
  `resolvePlayerDeviceCaption`.
- Null caption → return null (no empty element, so flex gaps stay as today).
- Text: `sending` → `t('cross_device.sending_to_device', { device: formatName(entry) })`;
  `other_tab` → `t('cross_device.playing_in_another_tab')`; `other_device` →
  `t('cross_device.playing_on_device', { device: formatName(entry) })`.
- Markup: `<div className={styles.caption} data-testid="media-player-device-caption">{text}</div>`.

`PlayerDeviceCaption.module.scss`:

```scss
@use '../../../mixins/lineClamp' as *;

.caption {
  @include line-clamp(1);
  font-size: var(--font-size-xs);
  color: var(--text-color-secondary);
}
```

Check the mixin path against `MediaPlayerInfoDesktop.module.scss`, which uses the same
`@use '../../../mixins/lineClamp' as *;` from the sibling `Desktop/` folder.

## `RemoteLiveLabel.tsx`

```tsx
export const RemoteLiveLabel: React.FC = () => {
  const tMedia = useTranslations('media');
  return (
    <div className={styles.remoteLiveLabel} data-testid="media-player-remote-live-label">
      <span className={styles.text}>{tMedia('livestream.live')}</span>
    </div>
  );
};
```

Reuses the existing `media.livestream.live` key ("Live"), the same text `LiveItemStatus` shows.
It is text, not a button (`LiveItemStatus` renders a non-interactive `Button`; this one is not
focusable at all).

`RemoteLiveLabel.module.scss`:

```scss
.remoteLiveLabel {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  min-height: 24px;
}

.text {
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-bold);
  color: var(--text-color-danger);
  text-transform: uppercase;
}
```

## Bar visibility

`MediaPlayer.tsx` and `Controller/MediaPlayerController.tsx` each have an effect calling
`updateLayoutForMediaPlayer(!!mpChannel || !!mpAddByRSS, { skipMainAppLayoutMutations })`. In both:

```typescript
const isBarVisible = useMediaPlayerBarVisible();
useEffect(() => {
  updateLayoutForMediaPlayer(isBarVisible, { skipMainAppLayoutMutations });
}, [isBarVisible, skipMainAppLayoutMutations]);
```

Drop `mpChannel` and `mpAddByRSS` from the `useMediaPlayer()` destructure in a file only when
nothing else in it reads them. In `MediaPlayerController.tsx` touch nothing else; plan 25 owns its
keydown listener and plan 45 adds a prompt beside the handoff `Modal`.

## Info sections

### `MediaPlayerInfoDesktop.tsx` and `MediaPlayerInfoMobile.tsx` (same edit)

- `const remote = useRemotePlayerDisplay();` next to the other hooks. Keep every existing
  computation; it is pure and cheap.
- `hasContent` becomes `remote !== null || !!mpChannel || !!mpAddByRSS`.
- `title`: `remote` → `remote.resource.title ?? tMisc('untitled')`; else as today.
- `subtitle`: `remote` → `remote.resource.channel_title ?? tMisc('untitled')`; else as today.
- Artwork list passed to `ImageNonReact`: `remote` →
  `remote.resource.image_url !== null ? [remote.resource.image_url] : []`; else the existing
  `artImageCandidates`. Name the chosen value `displayArtwork` and pass it to the same prop.
- After `<div className={styles.subtitle}>…</div>`, render `<PlayerDeviceCaption />`.

### `MediaPlayerInfoModal.tsx`

- `const remote = useRemotePlayerDisplay();` and `const tMisc = useTranslations('misc');`.
- `showModalVideo` becomes `remote === null && videoLocation === 'full-modal' && isVideoPlaying`.
- Artwork: `remote` → the same single-URL list as above; else the existing list.
- Title section: when `remote` is non-null, use

  ```tsx
  <div className={styles.titleSection} ref={titleRef}>
    <div className={styles.itemTitle}>{remote.resource.title ?? tMisc('untitled')}</div>
    {remote.resource.channel_title !== null ? (
      <div className={styles.channelTitle}>{remote.resource.channel_title}</div>
    ) : null}
    <PlayerDeviceCaption />
  </div>
  ```

  Otherwise the existing `titleSection`, with `<PlayerDeviceCaption />` added as its last
  element (after the like button block).
- Subtitle section: when `remote` is non-null, render
  `<div className={styles.subtitleSection} ref={subtitleRef} />` so
  `useModalArtworkSquareSize` keeps measuring the same three refs; otherwise the existing one.

## Controls and buttons

In each file: `const remote = useRemotePlayerDisplay();` then derive

```typescript
const showTrackButtons = remote === null;
const showJumpButtons = remote === null || remote.controls.canSkip;
const showProgress = remote === null || remote.controls.showsProgress;
const showSettings = remote === null || remote.controls.canSetRate;
```

(declare only the ones the file uses).

- `MediaPlayerControlsDesktop.tsx` and `MediaPlayerControlsModal.tsx`: wrap `TrackPreviousButton`
  and `TrackNextButton` in `showTrackButtons &&`, `JumpBackButton` and `JumpForwardButton` in
  `showJumpButtons &&`; keep `PlayButton` unconditional. Render
  `showProgress ? <MediaPlayerProgress … /> : <RemoteLiveLabel />` in place of the progress bar
  (keep the modal's `includeMobileTime`). Both files need `'use client'` (already there).
- `MediaPlayerControlsMobile.tsx`: `showProgress ? <MediaPlayerProgress /> : <RemoteLiveLabel />`.
- `MediaPlayerButtonsDesktop.tsx`: `startSection` → when `remote` is null, the current buttons;
  else `{showSettings && <SettingsButton />}`. `endSection` → `{remote === null && (<><VolumeSlider /><MuteButton /></>)}`.
  Keep both section `div`s in both cases (plan 44 adds the device button to `endSection`).
- `MediaPlayerButtonsModal.tsx`: `startSection` → when `remote` is null, the current buttons;
  else `{showSettings && <SettingsButton />}`.
- `MediaPlayerButtonsMobile.tsx`:

  ```tsx
  {remote === null && <AlternateEnclosureButton />}
  {showSettings && <SettingsButton />}
  {remote !== null
    ? showJumpButtons && (
        <>
          <JumpBackButtonMobile />
          <JumpForwardButtonMobile />
        </>
      )
    : /* the existing AV and Music medium branches, unchanged */}
  <PlayButtonMobile />
  ```

  Add `'use client'`-safe imports only; the file already has `'use client'`.

`ButtonsDesktop` and `ButtonsModal` have no `'use client'` today and become hook users through
`useRemotePlayerDisplay`, as they already are through `useMediaPlayer`; no directive change.

Display code never writes to the MediaPlayer context, never calls `setMPCurrentTime`, and writes
no history or position (**playback-meaningful-events**).

## Must stay true

- In `idle` and `active` roles every player variant renders exactly as before this plan, except
  for the sending caption while a transfer is pending.
- The remote view never shows a control whose command the playing device would refuse for the
  item (no jump or speed for live, per `getPlaybackRemoteControls`).
- Embedded players (availability `off`) never show the remote view.

## Tests

Vitest:

- `remotePlayerDisplay.test.ts`: `resolveRemotePlayerDisplay` → null for `idle` and `active`
  roles, null for `remote` with a null `displayState` or null resource, controls with
  `canSkip: false` and `showsProgress: false` for a live state. `resolvePlayerDeviceCaption` →
  null when not ready; sending wins over remote; sending to this session is ignored; remote with
  this session active → `other_tab`; remote with another session → `other_device` with its
  entry; unknown active session → `other_device` with a null entry; `active` role with no pending
  transfer → null.
- `playbackDeviceName.test.ts`: label used and trimmed; null or whitespace label on web → web
  fallback; mobile → mobile fallback; `sameLabelNumber: 2` → `withNumber` result.

Plan 47's Playwright spec covers the rendered remote view, the live view, other tabs, and the
playing device going away.

## Release scratchpad

```markdown
## Web player shows what another device is playing

- Surfaces: web
- Change: When another signed-in device or another tab of this browser is playing for the
  account, the web player bar, its mobile layout, and the full-screen player stay visible and
  show that item's title, show title, and artwork, with a caption "Playing on <device>" or
  "Playing in Another Tab". Only the controls that work remotely appear: play and pause, jump
  back and forward, and speed in Settings. Next and previous track, volume, mute, clip, add to
  playlist, repeat, shuffle, and alternate enclosure are hidden there. For a livestream the
  progress bar is replaced by a Live label and only play and pause appear. When the playing
  device goes away, the player returns to the queue's item, paused, on this device. While a
  transfer is pending, the player shows "Sending to <device>…".
- Who notices: members signed in on more than one device or tab
- Operator steps: none
```
