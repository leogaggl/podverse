**Cursor model:** Cursor Grok 4.7 · **Reasoning:** extra high

# 25 — Web: controls in a tab that is not playing go to the playing device

In the `remote` role (another device, or another tab of this browser, holds the audio), the web
player's controls and item picks send commands instead of acting locally (R10, R27):

- play and pause → `play` / `pause` (target state, never a toggle on the wire),
- seek, skip forward and back, keyboard arrows → `seek` to an absolute position (not for live),
- playback speed → `set_rate`,
- picking an item anywhere (rows, headers, queue, playlists) → `play_item` on the active device,
  or play/pause when it is the item already playing there.

Nothing in this tab writes playback data in the remote role (R52, plan 22's guards). In `idle`
and `active` roles everything behaves exactly as today.

Area D decides which controls are visible in the remote role and renders progress from the store.
Next and previous track are not routed; area D hides them in the remote role.

Before editing, confirm plans 21–24 have landed (`crossDevicePlaybackStore`, `setOptimisticPatch`,
`getEstimatedPositionSeconds`, `nearestPlaybackSpeedValue`, `buildPlaybackResourceRefFromTarget`,
`playbackStartSecondsFromTarget`, and the final `CrossDevicePlaybackContextValue` from plan 24). If
not, stop and report.

## Rows

R10, R27, R52

## Runs after

24

## Files

apps/web/src/lib/crossDevicePlayback/playbackCheckInRequest.ts
apps/web/src/lib/crossDevicePlayback/sendPlaybackCommand.ts
apps/web/src/lib/crossDevicePlayback/sendPlaybackCommand.test.ts
apps/web/src/lib/crossDevicePlayback/remotePlaybackRouting.ts
apps/web/src/lib/crossDevicePlayback/remotePlaybackRouting.test.ts
apps/web/src/contexts/CrossDevicePlayback.tsx
apps/web/src/hooks/usePlayerTransport.ts
apps/web/src/hooks/useMediaPlayerResourceUpdate.tsx
apps/web/src/hooks/usePlayAddByRSS.tsx
apps/web/src/hooks/__tests__/useMediaPlayerResourceUpdate.nearEndClamp.test.tsx
apps/web/src/hooks/__tests__/usePlayAddByRSS.test.tsx
apps/web/src/components/MediaPlayer/Buttons/PlayButton.tsx
apps/web/src/components/MediaPlayer/Buttons/PlayButtonMobile.tsx
apps/web/src/components/MediaPlayer/Buttons/JumpBackButton.tsx
apps/web/src/components/MediaPlayer/Buttons/JumpBackButtonMobile.tsx
apps/web/src/components/MediaPlayer/Buttons/JumpForwardButton.tsx
apps/web/src/components/MediaPlayer/Buttons/JumpForwardButtonMobile.tsx
apps/web/src/components/MediaPlayer/Buttons/IncrementBackButton.tsx
apps/web/src/components/MediaPlayer/Buttons/IncrementForwardButton.tsx
apps/web/src/components/MediaPlayer/Buttons/PlaybackSpeedButton.tsx
apps/web/src/components/MediaPlayer/Buttons/SettingsButton.tsx
apps/web/src/components/MediaPlayer/Controller/MediaPlayerController.tsx
apps/web/src/components/MediaPlayer/Controller/mediaPlayerWindowKeyDown.ts
apps/web/src/components/MediaPlayer/Controller/mediaPlayerWindowKeyDown.test.ts

## Decisions this plan fixes

- **Routing reads the role at call time** from `crossDevicePlaybackStore.getSnapshot().role`, so a
  click right after the role changes goes the right way.
- **Item picks in the remote role.**
  - A pick that loads paused (`shouldPlay === false`, `skipNowPlayingWrite === true`, or
    `PlayAddByRSSOptions.shouldPlay === false`) does nothing and sends nothing. Paused hydration
    never controls another device.
  - The picked item is the one already playing there (`isSamePlaybackResourceRef` against
    `displayState.resource.ref`) and no start position was asked for → `pause` when the displayed
    status is `playing` or `loading`, else `play`.
  - Otherwise → `play_item` with `resource` from `buildPlaybackResourceRefFromTarget`,
    `add_by_rss_resource_data` (the target's `resourceData` for Add by RSS, else null), and
    `start_seconds` from `playbackStartSecondsFromTarget(target, input.explicitPlaybackSeconds)`
    (explicit seconds, else a chapter's start, else null).
- **Optimistic display.** Before sending, the sender patches the displayed state (plan 21):
  `play` → status `playing`, `pause` → `paused`, `seek` → position, `set_rate` → rate. `play_item`
  has no patch. Any failure clears the patch.
- **Errors.** `playback_no_active_device` or `playback_device_not_connected` → clear the patch and
  request an immediate check-in. `playback_command_not_allowed_for_live` → clear the patch. 403
  (`parseMembershipGateError`) → `markUnavailable()`. Anything else → clear the patch. Nothing is
  logged (these are expected outcomes) and nothing is shown; the displayed state corrects itself.
- **Relative moves become absolute.** Skip and arrow keys compute from the estimated position
  (`getEstimatedPositionSeconds()`, 0 when null), clamp to `[0, duration_seconds]` (no upper bound
  when duration is null), and send `seek`. Two quick skips build on the first one's optimistic
  position.
- **Speed.** Cycling uses `getNextPlaybackSpeed(nearestPlaybackSpeedValue(displayState.rate))`.
- **The keyboard helper takes relative moves.** `handleMediaPlayerWindowKeyDown` now receives
  `jumpBy(deltaSeconds)` instead of an absolute `seek`, and its state is
  `{ hasResource: boolean; isLiveItem: boolean }`. Locally, the bridge's `jumpBy` already clamps to
  `[0, duration]`, so arrow keys behave as before.

## `playbackCheckInRequest.ts`

```typescript
/** The provider registers its check-in trigger; returns the unregister function. */
export function registerPlaybackCheckInHandler(handler: () => void): () => void;
/** Runs the registered check-in now; no-op when none is registered. */
export function requestPlaybackCheckIn(): void;
```

`CrossDevicePlayback.tsx`: register `checkInNow` in an effect. This module exists so hooks the
provider itself uses (`useMediaPlayerResourceUpdate` inside the plan 23 loader) need no context.

## `sendPlaybackCommand.ts`

```typescript
export async function sendPlaybackCommand(command: DTOPlaybackCommand): Promise<void>;
```

Uses `crossDevicePlaybackStore`, `getApiRequestService().reqAccountPlaybackSendCommand({ command })`
(no `target_session_id_text`), `parsePlaybackApiError`, `parseMembershipGateError`, and
`requestPlaybackCheckIn`, per **Optimistic display** and **Errors**. Never throws.

## `remotePlaybackRouting.ts`

```typescript
/** The command a pick sends in the remote role, or null to send nothing. */
export function resolveRemotePickCommand(params: {
  pickedRef: DTOPlaybackResourceRef | null;
  addByRSSResourceData: AddByRSSResourceData | null;
  startSeconds: number | null;
  loadsPaused: boolean;
  remoteState: DTOPlaybackState | null;
}): DTOPlaybackCommand | null;

/** Absolute seek for a relative move, or null when seeking is not allowed (live or no state). */
export function resolveRemoteJumpTarget(params: {
  remoteState: DTOPlaybackState | null;
  estimatedPositionSeconds: number | null;
  deltaSeconds: number;
}): number | null;
```

## `usePlayerTransport.ts`

```typescript
export type PlayerTransport = {
  isRemote: boolean;
  isPlaying: boolean;
  isLive: boolean;
  playbackSpeed: PlaybackSpeedValue;
  hasResource: boolean;
  togglePlayPause: () => void;
  seekTo: (seconds: number) => void;
  jumpBy: (deltaSeconds: number) => void;
  cyclePlaybackSpeed: () => void;
};

export function usePlayerTransport(): PlayerTransport;
```

Reads `useCrossDevicePlaybackSnapshot` for `role` and `displayState`.

- Not remote (local): `isPlaying: mpIsPlaying`; `isLive: isPlayerResourceLive(...)`;
  `playbackSpeed: mpPlaybackSpeed`; `hasResource: !!mpChannel || !!mpAddByRSS`;
  `togglePlayPause` → `setMPIsPlaying(!mpIsPlaying)`; `seekTo(t)` → `controls.seek(t)` and
  `setMPCurrentTime(t)`; `jumpBy(d)` → `setMPCurrentTime(controls.jumpBy(d))`;
  `cyclePlaybackSpeed` → `setMPPlaybackSpeed(getNextPlaybackSpeed(mpPlaybackSpeed))`.
- Remote: from `displayState` (all actions are no-ops when it or its `resource` is null):
  `isPlaying: status !== 'paused'`; `isLive: is_live`; `playbackSpeed:
  nearestPlaybackSpeedValue(rate)`; `hasResource: resource !== null`; `togglePlayPause` → send
  `pause` or `play`; `seekTo(t)` → not live: send `seek` clamped as above; `jumpBy(d)` →
  `resolveRemoteJumpTarget`, then send `seek`; `cyclePlaybackSpeed` → send `set_rate`.

The local branch must not read the store on every time tick; the hook re-renders on the same
MediaPlayer context changes the buttons already re-render on.

## Buttons and keyboard

Each button switches its action and state to `usePlayerTransport()`, keeping markup, classes,
labels, and `data-*` attributes:

- `PlayButton`, `PlayButtonMobile`: `isPlaying` drives the icon, `aria-label`, and
  `data-media-player-playing`; click → `togglePlayPause()`. The playback-error branch stays as is.
- `JumpBackButton`, `JumpBackButtonMobile`, `JumpForwardButton`, `JumpForwardButtonMobile`,
  `IncrementBackButton`, `IncrementForwardButton`: click → `jumpBy(±seconds)` with the existing
  constant.
- `PlaybackSpeedButton`, and the speed item in `SettingsButton`: label from `playbackSpeed`, click
  → `cyclePlaybackSpeed()`.
- `mediaPlayerWindowKeyDown.ts`: new signature
  `(e, target, state: { hasResource: boolean; isLiveItem: boolean }, jumpBy: (deltaSeconds: number) => void, togglePlayPause: () => void)`;
  ArrowLeft → `jumpBy(-10)`, ArrowRight → `jumpBy(10)`; the Space check uses `state.hasResource`.
  Every other guard stays.
- `MediaPlayerController.tsx`: the keydown listener reads the transport through a ref and passes
  `{ hasResource, isLiveItem: isLive }`, `jumpBy`, and `togglePlayPause`. Remove `seekWithUiSync`
  and the time and duration refs when nothing else uses them.

## `useMediaPlayerResourceUpdate.tsx` and `usePlayAddByRSS.tsx`

- `useMediaPlayerResourceUpdate`: the returned function's type becomes
  `(input: MediaPlayerPlaybackLoadInput) => PlaybackLoadDecision | null`. First statement: when
  the role is `remote`, resolve the pick command (`loadsPaused` = `input.shouldPlay === false ||
  input.skipNowPlayingWrite === true`), `void sendPlaybackCommand(command)` when not null, and
  return null. No caller reads the return value today; keep it that way.
- `usePlayAddByRSS`: first statement of the returned function, same rule. The picked ref is
  `{ kind: 'add_by_rss', add_by_rss_hash_id }` from
  `addByRSSPlaybackIdentity(buildAddByRSSResourceData(indexItem))` (null identity → send nothing);
  `addByRSSResourceData` is that built data; `startSeconds` is `playbackPosition ?? null`;
  `loadsPaused` = `options?.shouldPlay === false || options?.recordNowPlaying === false`. Return
  without loading.

## Must stay true

- In `idle` and `active` roles every control and pick behaves exactly as before this plan.
- A remote-role tab never loads media from a control or pick.
- No command is a toggle on the wire.
- No seek is sent for a live item.

## Tests

Vitest:

- `remotePlaybackRouting.test.ts`: same item, no start, remote playing → `pause`; remote paused →
  `play`; same item with a start → `play_item` with that start; another item → `play_item` with
  `start_seconds: null`; Add by RSS pick carries its data; `loadsPaused` → null; jump +30 from an
  estimate of 100 with duration 110 → 110; jump −30 from 10 → 0; live → null.
- `sendPlaybackCommand.test.ts` (mock `getApiRequestService`): `pause` patches status before the
  request resolves; `playback_no_active_device` clears the patch and calls the registered check-in
  handler; 403 marks the store unavailable.
- `mediaPlayerWindowKeyDown.test.ts`: update to the new signature; arrows call `jumpBy(∓10)`;
  arrows do nothing when live; Space does nothing without a resource.
- `useMediaPlayerResourceUpdate.nearEndClamp.test.tsx` and `usePlayAddByRSS.test.tsx`: one case
  each with the store in the remote role (drive it as plan 22's save-hook tests do): the pick sends
  `play_item` and sets no player state.

## Release scratchpad

```markdown
## Web player controls the playing device from any tab

- Surfaces: web
- Change: While another device or another tab is playing for the account, this tab's play,
  pause, skip, seek, arrow keys, and speed controls, and picking an item anywhere on the site,
  control the playing device instead of starting audio here. Picking the item that is already
  playing there toggles play and pause; another item plays there from its saved position, or
  from the chosen chapter. Seeking and skipping are not offered for livestreams.
- Who notices: members with more than one device or tab open
- Operator steps: none
```
