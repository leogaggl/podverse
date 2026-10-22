**Cursor model:** Opus 5.5 · **Reasoning:** high

# 24 — Web: sending audio to another device, and taking it over here

Choosing a device in the device menu (area D) moves playback there (R21). On web this has three
parts:

- **Sending a transfer** to another device: one `take_over` command, then watch for the result.
- **Taking over** when this browser is the target: one tab loads the stored item at the estimated
  position (the live point for a livestream, R48), at the same speed, starts it, and claims.
- **"This device"** chosen in the menu: this tab takes over locally, with no command.

The previous active device stops on its own when the claim lands (plan 22's stop on loss).

Before editing, confirm plans 22 and 23 have landed (`usePlaybackResourceLoader`,
`reportPlaybackStartFailed`, `stageCommandStartSeek` and the `onLoadedMetadata` seam, the executor's tap-to-play handling, `checkInNow` and
`confirmTapToPlay` on the context). If not, stop and report.

## Rows

R21, R48, R84

## Runs after

23

## Files

apps/web/src/lib/crossDevicePlayback/takeOverTabChoice.ts
apps/web/src/lib/crossDevicePlayback/takeOverTabChoice.test.ts
apps/web/src/lib/crossDevicePlayback/resolveTakeOverStart.ts
apps/web/src/lib/crossDevicePlayback/resolveTakeOverStart.test.ts
apps/web/src/hooks/useCrossDevicePlaybackTransfer.ts
apps/web/src/contexts/CrossDevicePlayback.tsx

## Decisions this plan fixes

- **Which tab takes over.** The take-over command reaches every tab of the target session. The
  last focused tab handles it (`lastFocusedTabId === tabId`). When no tab is recorded as last
  focused, the stream leader handles it. Without the tab channel (no `BroadcastChannel`), a tab
  handles it only when `document.visibilityState === 'visible'`.
- **A transfer always starts playback,** even when the stored state was paused: the person chose to
  send audio to that device. The claim (plan 22) needs actual playback anyway.
- **Start point.** Non-live: plan 11's `estimatePlaybackPositionSeconds({ state, receivedAtMs, nowMs })`
  on `envelope.state`, with this tab's receive time; null estimate → the item's saved position.
  Live: null, which loads the livestream at its live point (R48).
- **Landing past the end of this file (R84).** The estimate is clamped to the playing device's
  `duration_seconds` (plan 11), which can be longer than this tab's copy of the file (dynamic ad
  insertion). This plan does not clamp it again. It passes the estimate to plan 23's loader as
  `startSeconds`; the loader stages it, and when this tab's file reports its duration at
  `loadedmetadata` the orchestrator starts at `clampCommandStartToFileEnd` of it: the estimate
  as is below that duration, or that duration minus 5 s (never below 0) at or past it. This tab's
  file duration is never known when the command lands (the item is not loaded yet), which is why
  the clamp waits for metadata. When this tab already has the same item loaded, the loader's
  same-item branch clamps at once if the file has metadata, and stages it otherwise. A null
  estimate (saved position) is not a commanded position and loads through the normal path.
- **Speed carries over.** After a non-live load, `setMPPlaybackSpeed(nearestPlaybackSpeedValue(state.rate))`.
- **Add by RSS.** The take-over state carries only the hash. Resolve the resource data from this
  account's queues' now-playing rows (`reqQueueResourcesGetNowPlayingByQueueIdText` for each queue
  in `useQueues().queues`, in order), picking the first row whose
  `addByRSSPlaybackIdentity(row.add_by_rss_resource_data)` equals the hash. The previous active
  device wrote that row when it played. No match → report `load_failed`.
- **The claim is held from the start.** The receiving tab calls `beginClaim()` before loading, so
  its role is `active` while the item loads and plan 25 does not route the load as a remote
  command. On a failed load it calls `abandonClaim()`.
- **Blocked start.** Plan 23's start window handles `autoplay_blocked` and `load_failed` for the
  command id (note the pending start before loading). The claim stays pending while tap-to-play
  shows, so the tab stays `active` until the tap, a dismissal, or 60 s.
- **Sender result.** After `take_over` is accepted (202), the store holds the pending transfer for
  `PLAYBACK_TAKE_OVER_RESULT_TIMEOUT_MS`. It succeeds when a state names the target as active
  (plan 21 clears it). It fails with the reported reason on a matching `playback.start_failed`, or
  `no_response` at the timeout. Request errors: `playback_device_not_connected` → `not_connected`
  and `checkInNow()`; `playback_target_already_active` → no failure (it is already there);
  403 (`parseMembershipGateError`) → `markUnavailable()`; anything else → `request_failed`. A new
  transfer replaces the pending one and clears an old failure.
- **"This device".** `transferTo(thisSessionIdText)` and `takeOverHere()` take over locally from
  `displayState` (remote or idle role), with the same start point and speed rules and receive time
  `stateReceivedAtMs`, through the same loader, so the same file-end clamp applies. The load is async, so the browser may block audio. When a
  `local_play_blocked` signal arrives within 15 s of a local take-over, `setMPIsPlaying(false)` and
  `setTapToPlay({ commandIdText: null })`; there is no command to report. When this session is
  already active and another tab holds audio, the local claim's audio-tab announcement moves the
  audio here (plan 22).

## `takeOverTabChoice.ts`

```typescript
export function shouldThisTabHandleTakeOver(params: {
  snapshot: Pick<CrossDevicePlaybackSnapshot, 'tabId' | 'lastFocusedTabId' | 'isStreamLeader'>;
  tabChannelAvailable: boolean;
  isVisible: boolean;
}): boolean;
```

Rules as in **Which tab takes over**. Plan 22's provider knows whether the tab channel is
available; expose it to this hook through the context value as `tabChannelAvailable: boolean`.

## `resolveTakeOverStart.ts`

```typescript
export type TakeOverStart = {
  resource: DTOPlaybackResourceRef;
  /** Null: saved position, or the live point. */
  startSeconds: number | null;
  /** Null when live. */
  rate: PlaybackSpeedValue | null;
};

export function resolveTakeOverStart(params: {
  state: DTOPlaybackState;
  receivedAtMs: number;
  nowMs: number;
}): TakeOverStart | null;
```

Null when `state.resource` is null. Uses plan 11's estimate and plan 21's
`nearestPlaybackSpeedValue`.

## `useCrossDevicePlaybackTransfer.ts`

```typescript
export function useCrossDevicePlaybackTransfer(params: { checkInNow: () => void; tabChannelAvailable: boolean }): {
  transferTo: (targetSessionIdText: string) => Promise<void>;
  takeOverHere: () => Promise<void>;
  dismissTransferFailure: () => void;
};
```

- Subscribes to signals with its own `createPlaybackCommandInbox()`. For a `take_over` command
  targeting `thisSessionIdText`, when `shouldThisTabHandleTakeOver` is true and the command is
  fresh (within `PLAYBACK_COMMAND_TTL_MS` of receipt): `beginClaim()`,
  `setPendingCommandStart(command_id)`, resolve the start, resolve Add by RSS data when needed,
  check freshness again, then `loader({ resource, addByRSSResourceData, startSeconds })`. On false:
  `reportPlaybackStartFailed(command_id, 'load_failed')`, `abandonClaim()`,
  `setPendingCommandStart(null)`. On true and a non-null rate: `setMPPlaybackSpeed(rate)`.
  A stale command at the second check reports `load_failed` and abandons the claim.
- For a `start_failed` signal whose `command_id` matches the pending transfer:
  `setTransferFailure({ targetSessionIdText, reason })` and `setPendingTransfer(null)`.
- `transferTo` sends `{ target_session_id_text, command: { type: 'take_over' } }` with
  `getApiRequestService().reqAccountPlaybackSendCommand`, then applies **Sender result**. The
  timeout compares the pending transfer's command id before failing, so a newer transfer is not
  failed by an older timer.
- `dismissTransferFailure` → `setTransferFailure(null)`.

## `CrossDevicePlayback.tsx`

The provider calls the hook and adds `transferTo`, `takeOverHere`, `dismissTransferFailure`, and
`tabChannelAvailable` to the context value. Final context value:

```typescript
type CrossDevicePlaybackContextValue = {
  store: CrossDevicePlaybackStore;
  checkInNow: () => void;
  tabChannelAvailable: boolean;
  confirmTapToPlay: () => void;
  dismissTapToPlay: () => void;
  transferTo: (targetSessionIdText: string) => Promise<void>;
  takeOverHere: () => Promise<void>;
  dismissTransferFailure: () => void;
};
```

## Must stay true

- Exactly one tab of the target browser takes over when the tab channel works.
- A livestream transfer never seeks to a stored position.
- A take-over never seeks this tab's media at or past the end of its own file when that file
  reports a duration (plan 23's seam); `resolveTakeOverStart` itself never reads a local duration.
- A failed take-over leaves this tab's claim abandoned, so the previous device keeps playing.
- The sender shows at most one pending transfer and one failure at a time.

## Tests

Vitest:

- `takeOverTabChoice.test.ts`: last focused tab handles it and the leader does not; no focused tab
  → leader; no channel → only a visible tab.
- `resolveTakeOverStart.test.ts`: playing state 10 s old at rate 1.5 → position + 15 (plan 11's
  estimate); live → `startSeconds: null` and `rate: null`; rate 1.1 → 1.12; null resource → null;
  a playing state at 595 with `duration_seconds` 600, 10 s old at rate 1 → 600 (clamped to the
  shared duration only; the file-end clamp is plan 23's and is covered in
  `commandStartSeek.test.ts`).

The full transfer (two browser contexts, sender and target) is area D's Playwright spec.

## Release scratchpad

```markdown
## Send web playback to another device

- Surfaces: web
- Change: Choosing a device for playback sends one transfer command. The target browser's most
  recently focused tab loads the item where the other device was (livestreams at the live point),
  at the same speed, starts it, and becomes the active device; the old device stops. When that
  position is at or past the end of the target's copy of the file (copies can differ in length
  with dynamic ads), it starts 5 s before that file's end. Choosing this device does the same
  locally. The sender sees a failure when the target reports it could
  not start, is not connected, or does not respond within 8 s. Add by RSS items resolve from the
  account's server queue.
- Who notices: members moving playback between devices
- Operator steps: none
```
