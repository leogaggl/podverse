**Cursor model:** Cursor Grok 4.7 · **Reasoning:** extra high

# 42 — Web player shows what another device or tab is playing

When another device (or another tab of this browser) plays for the account, this tab's role is
`remote` and plan 22 clears its local MediaPlayer context. Today that would hide the player bar.
This plan keeps the bar up and renders it from the cross-device store's `displayState` and plan
49's resolved records: the remote item's title, show title, and artwork in the desktop,
mobile-layout, and modal players; a status caption ("Playing on …", "Paused on …", "Starting on
…"); the controls that work remotely, including Next and Previous, Add to Playlist, and Share;
title links in the full-screen player; the segment strip from web-player-marquee plan 21; and, for a
livestream, the Live label in place of the progress bar.

The progress bar's remote behavior is plan 43. The device button is plan 44. Prompts and notices
are plan 45. Item and chapter rows are plan 46.

**web-player-marquee lands first.** That set's plans 20 (bar title lines), 21 (segment strip),
and 30 (full-screen title lines) edit the same player files and create
`MediaPlayerSegmentStrip`, which this plan wires. Its plan 21 must be implemented before this
plan; plans 20 and 30 too, because this plan edits the files they rewrite. Do not edit that set's
plans.

Before editing, confirm these exist; if any is missing, stop and report:

- `apps/web/src/contexts/CrossDevicePlayback.tsx` exports `useCrossDevicePlaybackSnapshot`
  (plan 22).
- `apps/web/src/lib/crossDevicePlayback/crossDevicePlaybackStore.ts` exports
  `CrossDevicePlaybackSnapshot` with `role`, `availability`, `displayState`, `devices`,
  `thisSessionIdText`, and `pendingTransfer` (plan 21).
- `apps/web/src/hooks/usePlayerTransport.ts` exists and `PlayButton.tsx` uses it; the
  `TrackNextButton` and `TrackPreviousButton` hooks send `next` and `previous` in the remote role
  (plan 25).
- `apps/web/src/hooks/useRemotePlayerResource.ts`, `apps/web/src/hooks/useRemotePlaybackPositionSeconds.ts`,
  and `remotePlayerResourceStore` in
  `apps/web/src/lib/crossDevicePlayback/remotePlayerResourceStore.ts` (plan 49).
- `packages/helpers/src/lib/crossDevicePlayback.ts` exports `getPlaybackRemoteControls` (with
  `canTrackNext` and `canTrackPrevious`), `buildPlaybackDeviceList`,
  `shouldShowPlaybackDeviceSwitch`, and `PlaybackDeviceListEntry` (plan 11), re-exported from
  `@podverse/helpers`; `DTOPlaybackResourceSummary` has `medium` (plan 10).
- `apps/web/src/components/MediaPlayer/SegmentStrip/MediaPlayerSegmentStrip.tsx` and
  `resolveMediaPlayerSegmentStripSegment` in `apps/web/src/utils/mediaPlayer/mediaPlayerSegmentStrip.ts`
  (web-player-marquee plan 21).
- `media_player.cross_device.*` keys, including `paused_on_device` and `starting_on_device`, exist
  in `packages/i18n-catalog/consumer/originals/en-US.json` (plan 40).

## Rows

R6, R16, R46, R58, R62, R72, R74, R79, R81, R82, R89

## Runs after

22, 24, 25, 26, 40, 49, web-player-marquee 20, web-player-marquee 21, web-player-marquee 30

## Files

apps/web/src/lib/crossDevicePlayback/remotePlayerDisplay.ts
apps/web/src/lib/crossDevicePlayback/remotePlayerDisplay.test.ts
apps/web/src/lib/crossDevicePlayback/remotePlayerInfo.ts
apps/web/src/lib/crossDevicePlayback/remotePlayerInfo.test.ts
apps/web/src/lib/crossDevicePlayback/playbackDeviceName.ts
apps/web/src/lib/crossDevicePlayback/playbackDeviceName.test.ts
apps/web/src/hooks/useRemotePlayerDisplay.ts
apps/web/src/hooks/useRemotePlayerInfo.ts
apps/web/src/hooks/usePlaybackDevices.ts
apps/web/src/components/MediaPlayer/CrossDevice/PlayerDeviceCaption.tsx
apps/web/src/components/MediaPlayer/CrossDevice/RemoteLiveLabel.tsx
apps/web/src/styles/components/MediaPlayer/CrossDevice/PlayerDeviceCaption.module.scss
apps/web/src/styles/components/MediaPlayer/CrossDevice/RemoteLiveLabel.module.scss
apps/web/src/components/MediaPlayer/MediaPlayer.tsx
apps/web/src/components/MediaPlayer/Controller/MediaPlayerController.tsx
apps/web/src/components/MediaPlayer/SegmentStrip/MediaPlayerSegmentStrip.tsx
apps/web/src/components/MediaPlayer/Buttons/PlaylistAddToButton.tsx
apps/web/src/components/MediaPlayer/Buttons/ShareButton.tsx
apps/web/src/styles/components/MediaPlayer/Buttons/ShareButton.module.scss
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
- **The playing device pauses:** the bar stays, the caption reads "Paused on {device}", and the
  position stops (plan 43). While it loads or buffers (`status` `loading`), "Starting on
  {device}".
- **It stops** (state with a null resource): the remote view ends; with the local player cleared,
  the bar hides.
- **It goes away** (presence expires, area A clears the active device): the role becomes `idle`,
  the remote view ends, and plan 26 loads the queue head paused, so the bar shows the same item
  locally, paused, with no caption.
- **Other tabs of this browser** while one tab plays: `remote` role, same view, caption
  "Playing in Another Tab" for every status (the shared status set has no paused or starting
  variant for tabs). The device menu (plan 44) moves audio to this tab.
- **Remote controls shown** (R79, R74): play/pause always; Next and Previous when
  `remote.controls.canTrackNext` / `canTrackPrevious` (true for live items too, plan 11); jump back
  and forward and the Settings button (its only item is speed) when not live; Add to Playlist;
  Share.
  Next and Previous are always enabled: the playing device's own queue decides what they do, and a
  press with nothing ahead does what that press does there. Volume, mute, clip, repeat, shuffle,
  and alternate enclosure stay local-only and hidden.
- **Mobile layout splits by medium (R81),** as the local mobile layout does by queue medium:
  `getQueueMediumIdForChannelMediumId(remote.resource.medium) === MediumEnum.Music` → previous and
  next; any other medium → jump back and forward when not live. A live non-music item shows only
  play/pause there. The desktop and modal layouts show both pairs, as they do locally.
- **Add to Playlist while another device plays (R74).** The button opens the same playlist modal
  with plan 49's resolved records. It is disabled only for an Add by RSS item this browser cannot
  resolve (plan 49 state `missing` for an `add_by_rss` ref; also while that lookup is `loading`).
  For other items it is always enabled: a click while the records load waits for them, and a
  failed load shows the existing `features.playlist.add_error` toast. The local button is
  unchanged.
- **Share (R74).** The player shows a Share button in every role and every layout (desktop,
  mobile-width, and full-screen), including while this browser is the one playing. It is not
  limited to the remote view. The accessible name is the existing `features.share` ("Share").
  The button follows `PlaylistAddToButton`'s markup (a `type="button"` with `aria-label`, its
  own module using the same size and color tokens as that button) and uses `FaShare`.
  - **This browser is playing** (`remote === null`): `setModalShare` from `useModals` with
    `{ channel: mpChannel, item: mpItem, clip: mpClip, item_chapter: mpItemChapter, item_soundbite: mpItemSoundbite, playlist: null, playlist_item: null }`
    from `useMediaPlayer`. That is the same modal detail headers open. Disable the button when
    `mpChannel` and `mpItem` are both null (Add by RSS clears `mpItem` and has no public page).
  - **Another device is playing:** the click waits for plan 49's records the same way Add to
    Playlist does. A `database` resource calls `setModalShare` with that resource's `channel`,
    `item`, `clip`, and `itemSoundbite`, `item_chapter` set to the chapter whose `id_text` the
    segment strip names when `itemChapters` contains it, otherwise null, and playlist fields
    null. An `add_by_rss` ref disables Share (no public page), including while the lookup is
    `loading` or `missing`. A failed directory load shows the existing
    `features.playlist.add_error` toast, the same failure Add to Playlist already shows.
  - An in-flight ref guards the remote handler so a double click opens one modal
    (**input-rate-control**). The modal is unchanged.
- **Title links in the full-screen player (R72).** The remote modal renders the same title,
  channel, like, chapter or clip line, and chapter web link as the local modal, from a
  `MediaPlayerInfoResolution` built for the remote item (`remotePlayerInfo.ts`). The item link
  comes from `medium` and the ref at once (no request); once plan 49's records resolve, the full
  resolution adds the channel link, like target, and the chapter or clip line. No modal video.
- **Segment strip (R82).** While another device plays, the strip above the bar names that
  device's chapter, clip, or official clip, from plan 49's records and the estimated position
  (the local rules: `getMediaPlayerInfoResolution`, then `resolveMediaPlayerSegmentStripSegment`).
  It follows the estimate, not a drag on the remote bar (a drag only seeks on release, plan 43).
  Add by RSS and live items show no strip, as locally. Chapter marks on the remote progress bar
  stay off (plan 43).
- **Livestream remote view:** title, artwork, caption, the Live label where the progress bar
  would be, play/pause, Next and Previous where the layout shows them. The local livestream view is
  unchanged.
- **Caption precedence:** a pending transfer ("Sending to {device}…") wins over "Playing in
  Another Tab" and the status captions. The sending caption shows in local views too, because the
  tab that sends usually is the one playing.
- **Bar title.** The bar shows the item's own title (web-player-marquee plan 20 makes the local
  bar do the same): the resolved `itemTitle` once plan 49 resolves, the shared `resource.title`
  until then.

## `remotePlayerDisplay.ts`

```typescript
import type {
  DTOPlaybackResourceSummary,
  DTOPlaybackState,
  PlaybackDeviceListEntry,
  PlaybackRemoteControls,
  PlaybackStatus,
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
  | { kind: 'other_device'; entry: PlaybackDeviceListEntry | null; status: PlaybackStatus };

export function resolvePlayerDeviceCaption(params: {
  availability: CrossDevicePlaybackSnapshot['availability'];
  role: CrossDevicePlaybackSnapshot['role'];
  thisSessionIdText: string | null;
  activeSessionIdText: string | null;
  status: PlaybackStatus | null;
  pendingTransferTargetSessionIdText: string | null;
  entries: readonly PlaybackDeviceListEntry[];
}): PlayerDeviceCaption | null;
```

(Import `PlaybackStatus` from wherever plan 10 exports it; it is the union of
`PLAYBACK_STATUSES`.)

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
  4. `role === 'remote'` and `status !== null` → `{ kind: 'other_device', entry, status }`,
     `entry` looked up by `activeSessionIdText`.
  5. Otherwise null.

Use `===` only, no `as` (**avoid-type-assertions**).

## `remotePlayerInfo.ts`

```typescript
import type { MediaPlayerInfoResolution } from '../../utils/mediaPlayer/mediaPlayerInfoResolution';
import type { MediaPlayerSegmentStripSegment } from '../../utils/mediaPlayer/mediaPlayerSegmentStrip';

import type { RemotePlayerDisplay } from './remotePlayerDisplay';
import type { RemotePlayerResource } from './remotePlayerResourceStore';

export type RemotePlayerInfo = {
  display: RemotePlayerDisplay;
  /** Same shape the local player computes, so the same markup renders both. */
  resolution: MediaPlayerInfoResolution;
  segment: MediaPlayerSegmentStripSegment | null;
};

/** Item page for a ref, from `medium` alone; '' when the ref alone cannot name it. */
export function remoteItemLinkUrlFromSummary(resource: DTOPlaybackResourceSummary): string;

export function resolveRemotePlayerInfo(params: {
  display: RemotePlayerDisplay;
  resource: RemotePlayerResource | null;
  positionSeconds: number | null;
}): RemotePlayerInfo;
```

- `remoteItemLinkUrlFromSummary`: only for `ref.kind === 'item'`, the same medium mapping as
  `resolveDefaultLinks` in `mediaPlayerInfoResolution.ts`: `MediumEnum.Podcast` or
  `MediumEnum.Video` → `buildEpisodePath(ref.item_id_text)`; `MediumEnum.Music` →
  `buildTrackPath(ref.item_id_text)`; anything else → ''. Other ref kinds → '' (their item id is
  not in the ref; the resolved records supply it).
- `resolveRemotePlayerInfo`:
  - `resource === null` (still loading, missing, or nothing resolved):
    `resolution = { itemTitle: display.resource.title, displayItemTitle: display.resource.title, channelTitle: display.resource.channel_title, channelLinkUrl: '', itemLinkUrl: remoteItemLinkUrlFromSummary(display.resource), subsectionTitle: null, subsectionUrl: '', subsectionStartTime: null, subsectionEndTime: null, chapterWebUrl: null, resolvedLikeTarget: null }`;
    `segment = null`.
  - `resource.kind === 'database'`:
    `resolution = getMediaPlayerInfoResolution({ mpChannel: resource.channel, mpItem: resource.item, mpAddByRSS: null, mpClip: resource.clip, mpItemSoundbite: resource.itemSoundbite, mpItemChapter: null, mpItemChapters: resource.itemChapters, currentTimeSeconds: positionSeconds ?? 0 })`.
  - `resource.kind === 'add_by_rss'`:
    `getMediaPlayerInfoResolution({ mpChannel: null, mpItem: null, mpAddByRSS: { idText: resource.idText, resourceData: resource.resourceData }, mpClip: null, mpItemSoundbite: null, mpItemChapter: null, mpItemChapters: null, currentTimeSeconds: positionSeconds ?? 0 })`.
  - When `resolution.itemTitle` or `resolution.channelTitle` is null after resolving, fall back
    to `display.resource.title` / `display.resource.channel_title`.
  - `segment`: null when `display.state.is_live`; otherwise
    `resolveMediaPlayerSegmentStripSegment({ hasContent: true, mpClip: resource?.kind === 'database' ? resource.clip : null, mpItemSoundbite: resource?.kind === 'database' ? resource.itemSoundbite : null, subsectionTitle: resolution.subsectionTitle })`.

No new resolution rules: chapter choice, link building, and clip precedence all come from
`getMediaPlayerInfoResolution` and the strip helper, which the local player uses.

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

## `useRemotePlayerInfo.ts`

```typescript
export function useRemotePlayerInfo(): RemotePlayerInfo | null;
```

- `const display = useRemotePlayerDisplay();`
- `const resourceState = useRemotePlayerResource();` (plan 49)
- `const position = useRemotePlaybackPositionSeconds(display !== null && display.controls.showsProgress);` (plan 49)
- Return `useMemo(() => display === null ? null : resolveRemotePlayerInfo({ display, resource: resourceState.status === 'ready' ? resourceState.resource : null, positionSeconds: position }), [display, resourceState, position])`.

It re-renders its caller once per whole second while the other device plays, the same rate the
local info sections re-render from `mpCurrentTime`.

## `PlayerDeviceCaption.tsx`

```typescript
export const PlayerDeviceCaption: React.FC = () => { … };
```

- Selects `availability`, `role`, `thisSessionIdText`,
  `displayState?.active_session_id_text ?? null`, `displayState?.status ?? null`, and
  `pendingTransfer?.targetSessionIdText ?? null`; reads `entries` and `formatName` from
  `usePlaybackDevices()`; calls `resolvePlayerDeviceCaption`.
- Null caption → return null (no empty element, so flex gaps stay as today).
- Text, through a file-local function with an exhaustive `switch` on `caption.kind`, and for
  `other_device` an exhaustive `switch` on `caption.status` (**i18n-user-facing-strings**,
  reason-mapped copy, no fallback branch):
  - `sending` → `t('cross_device.sending_to_device', { device: formatName(entry) })`
  - `other_tab` → `t('cross_device.playing_in_another_tab')`
  - `other_device` + `playing` → `t('cross_device.playing_on_device', { device })`
  - `other_device` + `paused` → `t('cross_device.paused_on_device', { device })`
  - `other_device` + `loading` → `t('cross_device.starting_on_device', { device })`
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
nothing else in it reads them. In `MediaPlayer.tsx` keep the segment-strip spacer effect
web-player-marquee plan 21 added. In `MediaPlayerController.tsx` touch nothing else; plan 25 owns
its keydown listener and plan 45 adds a prompt beside the handoff `Modal`.

## Segment strip

`SegmentStrip/MediaPlayerSegmentStrip.tsx` (web-player-marquee plan 21): keep its local
resolution, presence store, markup, and test ids. Add `const remoteInfo = useRemotePlayerInfo();`
with the other hooks (before any early return), rename the existing computed segment to
`localSegment`, and use

```typescript
const segment = remoteInfo !== null ? remoteInfo.segment : localSegment;
```

Everything after (presence effects, `null` return, icon, `MarqueeText`, label span) reads
`segment` as before, so the page spacer and floating video follow the remote strip too.

## Info sections

### `MediaPlayerInfoDesktop.tsx` and `MediaPlayerInfoMobile.tsx` (same edit)

- `const remoteInfo = useRemotePlayerInfo();` next to the other hooks. Keep the existing local
  computation (rename it `localResolution`); it is pure and cheap.
- `const infoResolution = remoteInfo?.resolution ?? localResolution;` and read every field the
  file already reads from `infoResolution`.
- `hasContent` becomes `remoteInfo !== null || !!mpChannel || !!mpAddByRSS`.
- The title line keeps reading `infoResolution.itemTitle` (web-player-marquee plan 20) and the
  subtitle `infoResolution.channelTitle`, with the existing `tMisc('untitled')` fallbacks.
- Artwork list passed to `ImageNonReact`: `remoteInfo` →
  `remoteInfo.display.resource.image_url !== null ? [remoteInfo.display.resource.image_url] : []`;
  else the existing `artImageCandidates`. Name the chosen value `displayArtwork` and pass it to
  the same prop.
- After the subtitle line (inside the same column, after any `MarqueeText` wrapper plan 20
  added), render `<PlayerDeviceCaption />`.

### `MediaPlayerInfoModal.tsx`

- `const remoteInfo = useRemotePlayerInfo();`. Rename the existing `infoResolution` computation
  to `localResolution` and set `const infoResolution = remoteInfo?.resolution ?? localResolution;`.
  The existing `titleSection` and `subtitleSection` JSX (with web-player-marquee plan 30's
  wrappers and test ids) then render the remote item unchanged: item title link, channel link
  when `channelLinkUrl` is set, like button when `resolvedLikeTarget` is set, the chapter or clip
  line with its time range, and the chapter web link.
- `showModalVideo` becomes `remoteInfo === null && videoLocation === 'full-modal' && isVideoPlaying`.
- Artwork: `remoteInfo` → the same single-URL list as the bar; else the existing list.
- Add `<PlayerDeviceCaption />` as the last element of `titleSection`.
- Remove nothing from the local branches.

## Controls and buttons

In each file: `const remote = useRemotePlayerDisplay();` then derive

```typescript
const showTrackPrevious = remote === null || remote.controls.canTrackPrevious;
const showTrackNext = remote === null || remote.controls.canTrackNext;
const showJumpButtons = remote === null || remote.controls.canSkip;
const showProgress = remote === null || remote.controls.showsProgress;
const showSettings = remote === null || remote.controls.canSetRate;
```

(declare only the ones the file uses).

- `MediaPlayerControlsDesktop.tsx` and `MediaPlayerControlsModal.tsx`: wrap `TrackPreviousButton`
  in `showTrackPrevious &&`, `TrackNextButton` in `showTrackNext &&`, `JumpBackButton` and
  `JumpForwardButton` in `showJumpButtons &&`; keep `PlayButton` unconditional. Render
  `showProgress ? <MediaPlayerProgress … /> : <RemoteLiveLabel />` in place of the progress bar
  (keep the modal's `includeMobileTime`). The track buttons are the existing components; their
  hooks send `next` / `previous` in the remote role (plan 25). Never call `runLocalClick` from UI.
- `MediaPlayerControlsMobile.tsx`: `showProgress ? <MediaPlayerProgress /> : <RemoteLiveLabel />`.
- `MediaPlayerButtonsDesktop.tsx`: `startSection` includes `<ShareButton />` immediately after
  `<PlaylistAddToButton />` in both branches (the local buttons, and the remote branch). Remote
  `startSection` is `<PlaylistAddToButton />`, `<ShareButton />`, then
  `{showSettings && <SettingsButton />}`. `endSection` →
  `{remote === null && (<><VolumeSlider /><MuteButton /></>)}`. Keep both section `div`s in both
  cases (plan 44 adds the device button to `endSection`).
- `MediaPlayerButtonsModal.tsx`: same Share placement as desktop. Remote `startSection` is
  `<PlaylistAddToButton />`, `<ShareButton />`, then `{showSettings && <SettingsButton />}`.
  The local branch keeps its current buttons and adds `<ShareButton />` after
  `<PlaylistAddToButton />`.
- `MediaPlayerButtonsMobile.tsx` (no Add to Playlist here, as locally): `<ShareButton />` is
  unconditional, after the Settings conditional, so it shows while this browser plays and while
  another device plays. The track and jump split is unchanged.

  ```tsx
  const remoteIsMusic =
    remote !== null &&
    getQueueMediumIdForChannelMediumId(remote.resource.medium) === MediumEnum.Music;
  …
  {remote === null && <AlternateEnclosureButton />}
  {showSettings && <SettingsButton />}
  <ShareButton />
  {remote !== null ? (
    remoteIsMusic ? (
      <>
        {showTrackPrevious && <TrackPreviousButtonMobile />}
        {showTrackNext && <TrackNextButtonMobile />}
      </>
    ) : (
      showJumpButtons && (
        <>
          <JumpBackButtonMobile />
          <JumpForwardButtonMobile />
        </>
      )
    )
  ) : (
    /* the existing AV and Music branches, unchanged */
  )}
  <PlayButtonMobile />
  ```

  `getQueueMediumIdForChannelMediumId` and `MediumEnum` from `@podverse/helpers`. The file
  already has `'use client'`.

`ButtonsDesktop` and `ButtonsModal` have no `'use client'` today and become hook users through
`useRemotePlayerDisplay`, as they already are through `useMediaPlayer`; no directive change.

### `PlaylistAddToButton.tsx`

```tsx
const remote = useRemotePlayerDisplay();
const remoteResource = useRemotePlayerResource();
const isRemoteAddByRSSUnavailable =
  remote !== null &&
  remote.resource.ref.kind === 'add_by_rss' &&
  remoteResource.status !== 'ready';
```

- Local click (`remote === null`): exactly as today.
- Remote click: an `async` handler.
  1. `const settled = remoteResource.status === 'loading' ? await remotePlayerResourceStore.whenSettled() : remoteResource;`
  2. When `settled.status !== 'ready'` or its key differs from the current ref's key (the item
     changed while waiting): `showToast(tFeatures('playlist.add_error'), 'error')` and return.
  3. `database` → `setModalPlaylistAddTo({ channel, item, clip, item_soundbite: itemSoundbite, addByRSSResourceData: null, addByRSSHashId: null })`.
  4. `add_by_rss` → `setModalPlaylistAddTo({ channel: null, item: null, clip: null, item_soundbite: null, addByRSSResourceData: resource.resourceData, addByRSSHashId: resource.hashId })`.
- `disabled={isRemoteAddByRSSUnavailable}` on the `button`. The label stays
  `features.playlist.add_to_playlist`; a disabled native button already reports its state.
- An in-flight ref guards the remote handler so a double click opens one modal
  (**input-rate-control**).

`showToast` from `../../Toast/Toast`. The modal itself is unchanged; it adds the item to a
playlist through the API on this browser, which never touches playback.

Display code never writes to the MediaPlayer context, never calls `setMPCurrentTime`, and writes
no history or position (**playback-meaningful-events**).

## Must stay true

- In `idle` and `active` roles every player variant renders exactly as before this plan, except
  for the sending caption while a transfer is pending.
- The remote view never shows a control whose command the playing device would refuse for the
  item (no jump or speed for live, per `getPlaybackRemoteControls`).
- Duration anywhere in the remote view comes from `displayState.duration_seconds` (plans 11, 43),
  never this tab's media element.
- Embedded players (availability `off`) never show the remote view.

## Tests

Vitest:

- `remotePlayerDisplay.test.ts`: `resolveRemotePlayerDisplay` → null for `idle` and `active`
  roles, null for `remote` with a null `displayState` or null resource, controls with
  `canSkip: false`, `showsProgress: false`, and `canTrackNext: true` for a live state.
  `resolvePlayerDeviceCaption` → null when not ready; sending wins over remote; sending to this
  session is ignored; remote with this session active → `other_tab` for any status; remote with
  another session → `other_device` with its entry and the state's status (`playing`, `paused`,
  `loading` each passed through); unknown active session → `other_device` with a null entry;
  `active` role with no pending transfer → null.
- `remotePlayerInfo.test.ts`: `remoteItemLinkUrlFromSummary` → episode path for a podcast or
  video `item` ref, track path for music, '' for a clip ref and for an Add by RSS ref.
  `resolveRemotePlayerInfo` with no resource → summary title and channel title, the medium link,
  no channel link, null segment; with a database resource carrying two chapters (1–20 s and
  21–60 s) at position 25 → `subsectionTitle` of the second chapter, the channel link, and a
  `chapter` segment; at position 25 with a clip resource → a `clip` segment with the clip title;
  a live state → null segment; an Add by RSS resource → the Add by RSS item path from `idText`.
- `playbackDeviceName.test.ts`: label used and trimmed; null or whitespace label on web → web
  fallback; mobile → mobile fallback; `sameLabelNumber: 2` → `withNumber` result.

Plan 47's Playwright spec covers the rendered remote view, the status captions, Next, Add to
Playlist, the modal title link, the strip, the mobile-width split, the live view, other tabs, and
the playing device going away.

## Release scratchpad

```markdown
## Web player shows what another device is playing

- Surfaces: web
- Change: When another signed-in device or another tab of this browser is playing for the
  account, the web player bar, its mobile layout, and the full-screen player stay visible and
  show that item's title, show title, and artwork, with a status line "Playing on <device>",
  "Paused on <device>", "Starting on <device>", or "Playing in Another Tab". The controls that
  work remotely appear: play and pause, Next and Previous (run by the playing device on its own
  queue), jump back and forward, speed in Settings, Add to Playlist, and Share. Share is also
  on the player while this browser is the one playing, and it opens the same share dialog detail
  pages use. Share is unavailable for an Add by RSS item. The narrow layout shows
  Previous and Next for music and the jump buttons for other media, as it does locally. Volume,
  mute, clip, repeat, shuffle, and alternate enclosure are hidden there. The full-screen player
  links the title and show name and shows the current chapter or clip; the strip above the bar
  names the chapter, clip, or official clip playing on the other device, following its position.
  Add to Playlist is unavailable only for an Add by RSS item this browser has not loaded. For a
  livestream the progress bar is replaced by a Live label and the jump and speed controls are
  hidden. When the playing device goes away, the player returns to the queue's item, paused, on
  this device. While a transfer is pending, the player shows "Sending to <device>…".
- Who notices: members signed in on more than one device or tab
- Operator steps: none
```
