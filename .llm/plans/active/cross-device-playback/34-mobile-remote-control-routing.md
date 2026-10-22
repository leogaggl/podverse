**Cursor model:** Opus 5.5 · **Reasoning:** extra high

# 34 — Mobile controls another device and moves playback

When another device is active, the phone's controls drive that device: play, pause, seek, skip
forward and back, Next and Previous, speed, and picking an item. The phone can also move playback to another device
or bring it to itself. This plan does the routing and the transfer bookkeeping. Area E draws the
remote player, the device menu, and the failure messages from the store.

Before editing, confirm plan 33's `CrossDevicePlaybackLocalPort`, `playResourceForCrossDevice`, and
command runner exist. If not, stop and report.

## Rows

R11, R22, R28, R49, R78

## Runs after

33

## Files

apps/mobile/src/playback/crossDevice/crossDevicePlaybackRemoteControl.ts
apps/mobile/src/playback/crossDevice/crossDevicePlaybackRemoteControl.test.ts
apps/mobile/src/playback/crossDevice/useCrossDevicePlayback.ts
apps/mobile/src/playback/PlaybackProvider.tsx
apps/mobile/vitest.config.ts

## Decisions this plan fixes

- **Routing by role.** A control is remote only when the store's `availability === 'ready'` and
  `role === 'remote'`, and no authoring hold is on. Otherwise it is local, and a local start claims
  (plan 32). `idle` plays locally and claims, as plan 11 says.
- **What routes (R11, R28, R78).** The session context's `pause`, `resume`, `seekTo`, `jumpBy`,
  `setRate`, `skipToNext`, `skipToNextTrack`, `skipToPrevious`, `skipToPreviousTrack`, `playItem`,
  `playItemById`, `playClip`, `playClipById`, `playSoundbite`, `playChapter`,
  `playAddByRssResourceData`, `playQueueResourceFromQueue`, and `playPlaylistRowById`, and the row
  context's `pause`, `resume`, `playItemById`, and `playClipById`. Internal callers inside the
  provider keep calling the local functions.
- **What stays local.** `loadItemPausedAt` (clip screens load paused; it plays nothing),
  `previewWindow` and the authoring hold (making a clip is a local action and takes playback here
  when it plays), `retryPlayback`, `completeNowPlaying`, `switchEnclosureSelectedParams`, and
  `clearPauseBoundary`. Native lock-screen, headset, and car controls act on the local engine, as
  they do today; pressing play there plays locally and claims.
- **Next and Previous while remote (R78).** In the remote role the phone's Next sends the `next`
  command and its Previous sends `previous` (plan 10). The playing device runs each as a tap on its
  own Next or Previous button, on its own queue (plan 33 on a phone; web plan 23 in a browser), so
  what comes next is that device's decision. The phone does not look at its own queue or chapters
  first. The hold gestures (`skipToNextTrack`, `skipToPreviousTrack`) send the same two commands:
  the command has no hold variant, and a hold that did nothing would read as a dead control. Both
  commands are allowed for a live item (plan 11, `canTrackNext` and `canTrackPrevious` true), so
  they are sent for one too; the playing device's handler decides, and a phone that plays a live
  item does nothing. They are relative: two presses send two commands.
- **Skip forward and back while remote** are absolute `seek` commands from the estimated remote
  position (`resolveRemoteJumpSeekSeconds`, which stops at the shared `duration_seconds`). The
  playing device clamps a seek that lands past its own file's end (plan 33, R85). A live item has
  no seek or rate (plan 11): those controls do nothing while remote.
- **Seek coalescing.** At most one remote `seek` is in flight. A newer seek during it replaces the
  waiting one, and only the newest goes out when the first settles.
- **Item picks** become `play_item` with a resource ref and `start_seconds`: the caller's explicit
  position, a chapter's start, a queue row's saved position, or null (the active device's saved
  position, or the live point). Add by RSS carries its resource data with the canonical feed URL.
  A playlist row loses its auto-queue seed when it plays remotely, because a command never edits the
  queue (plan 13). The active device plays it as an explicit play.
- **When the remote device is gone.** `playback_no_active_device` or
  `playback_device_not_connected` on `play` brings playback here (the take-over-here path below),
  and on `play_item` plays the item here. On any other control, or on any other failure, nothing
  plays. The store records a command failure for area E, and the next stream event corrects the
  view.
- **Transfer (R22, R49).** Moving to another device sends `take_over` with that device as the
  target. It is pending until the target becomes active (success), a `playback.start_failed`
  for that command arrives, or `PLAYBACK_TAKE_OVER_RESULT_TIMEOUT_MS` passes. Each ends the pending
  transfer, and the last two record a failure. The phone keeps playing until the target claims;
  then plan 32 stops it. A failed transfer leaves the phone playing. `playback_target_already_active`
  counts as success. Moving to this device is a local play of the shared state, never a command
  (plan 13 refuses `take_over` to oneself). A live item starts at the live point either way.

## `crossDevicePlaybackRemoteControl.ts` (pure, injected I/O)

```typescript
export type RemoteControlOutcome = 'sent' | 'no_device' | 'failed' | 'refused';

export type CrossDevicePlaybackRemoteControlDeps = {
  send: (body: PlaybackCommandSendBody) => Promise<PlaybackCommandSendResponse>;
  now: () => number;
  parsePlaybackError: (error: unknown) => PlaybackApiError | null;
  isMembershipRefusal: (error: unknown) => boolean;
  onMembershipRefusal: () => void;
};

export function createCrossDevicePlaybackRemoteControl(deps: CrossDevicePlaybackRemoteControlDeps): {
  sendControl: (command: DTOPlaybackCommand) => Promise<RemoteControlOutcome>;
  sendSeek: (positionSeconds: number) => void;
  transferTo: (targetSessionIdText: string) => Promise<void>;
  noteStartFailed: (event: DTOPlaybackStartFailed) => void;
  /** Call after every store change: settles a transfer once the target is active. */
  noteViewChanged: () => void;
  dispose: () => void;
};
```

- `sendControl`: `send({ command })` (no target; the server sends it to the active device).
  `no_active_device` and `device_not_connected` → `'no_device'`. A membership refusal →
  `onMembershipRefusal()`, `'refused'`. Any other error → `console.warn`, `'failed'`. On
  `'no_device'` and `'failed'`, `recordCrossDevicePlaybackCommandFailure({ commandType, atMs })`,
  except that the caller handles `'no_device'` for `play` and `play_item` (it plays here instead),
  so record it only for the other types.
- `sendSeek`: the coalescing rule above, through `sendControl({ type: 'seek', position_seconds })`.
- `transferTo`:
  - Ignore it when the target is this session or a transfer to the same target is pending.
  - `send({ target_session_id_text, command: { type: 'take_over' } })`. On success,
    `beginCrossDevicePlaybackTransfer({ commandIdText: response.command_id, targetSessionIdText,
    startedAtMs: now() })` and arm a timeout that settles it with `reason: 'timeout'`.
  - On failure: `target_already_active` → nothing; `device_not_connected` →
    `recordCrossDevicePlaybackTransferFailure` with `'not_connected'`; membership refusal → as
    above; anything else → `'send_failed'`.
- `noteViewChanged`: when a transfer is pending and the store's `activeSessionIdText` equals its
  target, settle it with no failure and clear the timer.
- `noteStartFailed`: when `command_id` matches the pending transfer, settle it with
  `event.reason` and clear the timer. Other ids are ignored.
- `dispose` clears timers.

## `useCrossDevicePlayback.ts`

- Params gain `isAuthoringHold: boolean`.
- Create the remote control once (`send` through `crossDevicePlaybackRepository.sendCommand`;
  `onMembershipRefusal` through the presence controller). Subscribe it to
  `subscribeCrossDevicePlaybackView` for `noteViewChanged`. Route `playback.start_failed` events
  to `noteStartFailed`.
- Return the bindings the provider routes through:

```typescript
export type CrossDevicePlaybackBindings = {
  /** Read at call time, never captured: true when controls go to another device. */
  isRemote: () => boolean;
  sendControl: (command: DTOPlaybackCommand) => Promise<RemoteControlOutcome>;
  seekRemote: (positionSeconds: number) => void;
  jumpRemote: (deltaSeconds: number) => void;
  /** Area E: move playback to another device in the list. */
  transferTo: (targetSessionIdText: string) => Promise<void>;
  /** Area E and the `play` fallback: play the shared state here and claim. */
  takeOverHere: () => Promise<void>;
};
```

  - `isRemote`: the view's `availability === 'ready' && role === 'remote'`, and
    `!isAuthoringHold` (from a ref).
  - `seekRemote` does nothing when the shared state is live; otherwise `sendSeek`.
  - `jumpRemote`: `resolveRemoteJumpSeekSeconds` over the store's state, `stateReceivedAtMs`, and
    `Date.now()`; null does nothing.
  - `takeOverHere`: `resolvePlaybackTakeOverStart` over the store's state; null does nothing;
    otherwise `localPort.playResource({ ref, addByRssResourceData: null, startSeconds })`. The
    start path shows its own notice or error on failure.
- Expose `transferTo` and `takeOverHere` to area E through the session context (below).

## `PlaybackProvider.tsx`

- Keep the result: `const crossDevice = useCrossDevicePlayback({ ..., isAuthoringHold })`.
- Add, directly above `const sessionValue = useMemo<PlaybackSessionContextValue>(`, one routed
  `useCallback` per routed action, each named `routedX`. Each checks `crossDevice.isRemote()` at
  call time:
  - `routedPause` → `void crossDevice.sendControl({ type: 'pause' })`.
  - `routedResume` → `sendControl({ type: 'play' })`; on `'no_device'`, `takeOverHere()`.
  - `routedSeekTo` → `seekRemote`. `routedJumpBy` → `jumpRemote`.
  - `routedSetRate` → `sendControl({ type: 'set_rate', rate })` unless the shared state is live.
  - `routedSkipToNext` and `routedSkipToNextTrack` → `void crossDevice.sendControl({ type: 'next'
    })`. `routedSkipToPrevious` and `routedSkipToPreviousTrack` → `void crossDevice.sendControl({
    type: 'previous' })`. Each returns a resolved `Promise<void>` so the context signatures stay
    the same. On `'no_device'` or `'failed'`, `sendControl` records a command failure for area E
    (`commandType` `next` or `previous`); nothing plays locally.
  - Item picks → `sendRemotePlayItem(resource, addByRssResourceData, startSeconds, playLocally)`,
    a local helper that sends `play_item` and calls `playLocally()` on `'no_device'`:
    - `playItem(item, channel, options)` → `{ kind: 'item', item_id_text: item.id_text }`,
      `options?.explicitPlaybackSeconds ?? null`;
    - `playItemById(idText)` → item ref, null;
    - `playClip(clip, …)` and `playClipById(idText)` → clip ref, null;
    - `playSoundbite(soundbite, …)` → soundbite ref, null;
    - `playChapter(chapter, item, …)` → the item ref and the chapter's start seconds, parsed the
      same way `buildChapterPlaybackTarget` reads `chapter.start_time`;
    - `playAddByRssResourceData(data, options)` → `{ kind: 'add_by_rss', add_by_rss_hash_id:
      addByRssPlaybackMediaId(data) }`, `withCanonicalAddByRssFeedUrl(data)`, and
      `options?.explicitPlaybackSeconds ?? null`;
    - `playQueueResourceFromQueue(resource)` → the ref from the module-level
      `resolveQueueResourceRef(resource)` mapped to plan 10's ref kinds (Add by RSS uses the row's
      `add_by_rss_hash_id`), the row's `add_by_rss_resource_data` for Add by RSS, and
      `normalizePlaybackPosition(resource.playback_position) ?? null`;
    - `playPlaylistRowById(idText, kind)` → item or clip ref, null.
    - When no ref can be built, play locally.
  - When `isRemote()` is false, each calls the local function with the same arguments.
- In `sessionValue` and `rowValue`, use the routed functions for every routed name, and add
  `transferPlaybackTo: crossDevice.transferTo` and `takeOverPlaybackHere: crossDevice.takeOverHere`
  to `PlaybackSessionContextValue`. Update both `useMemo` dependency lists.

## `apps/mobile/vitest.config.ts`

Add `crossDevicePlaybackRemoteControl.test.ts` and a header clause ("the cross-device remote
control — seek coalescing, failure mapping, and the take-over result
(`src/playback/crossDevice/crossDevicePlaybackRemoteControl.ts`)").

## Tests

`crossDevicePlaybackRemoteControl.test.ts` (fake timers, deferred `send`, store reset per test):

- Three seeks during one in-flight seek send two requests: the first and the newest.
- `no_active_device` returns `'no_device'` and records no failure for `play`, and records one for
  `pause` and for `next` (with `commandType: 'next'`); a 503 returns `'failed'` and records one; a
  membership 403 calls `onMembershipRefusal`.
- `sendControl({ type: 'previous' })` sends `{ command: { type: 'previous' } }` with no target.
- `transferTo` begins a transfer with the server's command id; the target becoming active
  settles it with no failure; a matching `start_failed` (`load_failed`, `autoplay_blocked`) records
  that reason; another command id is ignored; 8 s with neither records `'timeout'`.
- `transferTo` this session does nothing; `target_already_active` records nothing;
  `device_not_connected` records `'not_connected'`.

The routing in `PlaybackProvider` is thin glue over these modules and plan 30's rules; area E's
Maestro flows cover it on device.

## Release scratchpad

```markdown
## Control another device from the phone

- Surfaces: mobile
- Change: while another of a member's devices is playing, the phone's play, pause, seek, skip
  forward and back, Next, Previous, and speed controls drive that device, and picking an episode,
  clip, track, or queue item plays it there. Next and Previous do what those buttons do on the
  playing device, using that device's queue. Livestreams offer play, pause, Next, and Previous; no
  seek, skip, or speed. A member can move playback from the phone to another device, or bring it
  to the phone, at the current position or the live point.
- Who notices: members who play on more than one device
- Operator steps: none
```
