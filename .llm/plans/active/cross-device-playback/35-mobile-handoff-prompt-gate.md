**Cursor model:** Opus 5.5 · **Reasoning:** extra high

# 35 — The 744 prompt and live control never show together

The existing different-item prompt (`playback-handoff-dialog`, from the 744 work) asks "keep
playing here, or switch to what you played elsewhere?". With live control, another device that is
playing is shown and controlled directly, so the prompt must stay out of the way. When that device
stops being active, the phone's player picks up where it left off, paused.

Before editing, confirm plan 34's `CrossDevicePlaybackBindings` and the local port exist. If not,
stop and report.

## Rows

R53, R56

## Runs after

34

## Files

apps/mobile/src/playback/crossDevice/useCrossDevicePlayback.ts
apps/mobile/src/playback/crossDevice/crossDevicePlaybackCommandRunner.ts
apps/mobile/src/playback/crossDevice/crossDevicePlaybackPolicy.ts
apps/mobile/src/playback/crossDevice/crossDevicePlaybackPolicy.test.ts
apps/mobile/src/playback/PlaybackProvider.tsx
apps/mobile/e2e/playback-multi-device-handoff.yaml

## Decisions this plan fixes

- **The gate (R56)** is plan 30's `resolvePlaybackHandoffGate`:
  - **`defer`** while availability is `pending`. The app just opened, or came back, and has not
    yet learned whether another device is active. The conflict waits in
    `playbackReconcileConflicts` and is evaluated again once the gate changes.
  - **`suppress`** while another device is active (`remote`) or this one is (`active`). An open
    prompt closes without recording a dismissal. The conflict stays held. When the gate later
    becomes `allow` (this phone's presence grace ended and nobody else is active), evaluate that
    held conflict again, the same way a deferred conflict is evaluated when the gate changes. Do
    not record a dismissal for the time the prompt was held closed.
  - **`allow`** when nobody is active, and whenever this phone cannot see the other devices
    (`off` or `unavailable`: signed out, no membership, Offline Mode, stream down). In those cases
    the 744 rules apply unchanged, including the case where the other device is offline.
- **The prompt never offers the item already loaded.** A conflict whose server item is the item
  the local player has loaded is skipped: switching to it would change nothing. Without this, the
  adoption below could be followed by a prompt naming the item on screen.
- **When the other device stops being active (decision).** When the view goes from `remote` to
  `idle` while `ready` (the active device left, or its presence expired), and the shared state
  still names a non-live resource, the phone loads that resource **paused** at the shared position:
  the same paused load cold start uses (`autoPlayOverride: false`). It writes no outbox event, no
  queue or history change, and no position post (R53). It updates only the device-local
  last-playback snapshot that every load writes. When the item is already loaded, it moves the
  position with the existing silent `adoptRemotePlaybackPosition`. It does nothing while audio
  plays here, during an authoring hold, for a live item, or for a release (no resource). The main
  alternative was leaving the old local item in the player. That was rejected because the phone
  would show the item that played before the other device took over, and a tap on play would
  resume the wrong item.
- **A cold open in the `idle` role does not swap items.** Adoption needs the `remote` to `idle`
  transition in this session. On a cold open the 744 prompt (now allowed) handles a different
  server item, as today.

## `crossDevicePlaybackPolicy.ts`

```typescript
export type PlaybackIdleAdoption =
  | { type: 'none' }
  | { type: 'seek'; positionSeconds: number }
  | { type: 'load_paused'; ref: DTOPlaybackResourceRef; positionSeconds: number | null };

/** What the phone does with the shared state when another device stops being active. */
export function resolvePlaybackIdleAdoption(params: {
  previousRole: PlaybackRole;
  previousAvailability: CrossDevicePlaybackAvailability;
  view: Pick<CrossDevicePlaybackView, 'availability' | 'role' | 'state'>;
  loadedRef: DTOPlaybackResourceRef | null;
  isPlayingLocally: boolean;
  isAuthoringHold: boolean;
}): PlaybackIdleAdoption;
```

`none` unless the previous role was `remote` with availability `ready`, the view is `ready` and
`idle`, the state has a resource, it is not live, and nothing plays and no authoring hold is on.
Then `seek` when `loadedRef` matches (`isSamePlaybackResourceRef`) and the state has a position;
`none` when it matches without a position; otherwise `load_paused` with the state's position.
Paused states do not advance, so the stored position is the position.

## `crossDevicePlaybackCommandRunner.ts`

Add to `CrossDevicePlaybackLocalPort`:

```typescript
  /** Load without playing or writing playback events. */
  loadResourcePaused: (params: { ref: DTOPlaybackResourceRef; startSeconds: number | null }) => Promise<void>;
  /** Move the loaded item's position without writing playback events. */
  adoptPosition: (seconds: number) => void;
  loadedRef: () => DTOPlaybackResourceRef | null;
```

The runner does not call them; the hook does.

## `PlaybackProvider.tsx`

- Give `playResourceForCrossDevice` (plan 33) a second parameter `mode: 'play' | 'load_paused'`.
  `load_paused` passes `autoPlayOverride: false` and `autoQueue: { mode: 'preserve' }`, so no play
  event is written (`playTarget` writes one only when it auto-plays) and the auto-queue is left
  alone. The port's `playResource` passes `'play'`; `loadResourcePaused` passes `'load_paused'`
  with `addByRssResourceData: null`, so an Add by RSS item resolves through the same local feed
  and queue lookup as a take-over.
- Port additions: `adoptPosition: adoptRemotePlaybackPosition` and `loadedRef` from
  `playbackResourceRefFromTarget(activeTargetRef.current)` (null when nothing is loaded).
- Hand `crossDevice.handoffGate` into the handoff prompt effect (the `useEffect` that starts with
  `if (playbackHandoffPrompt !== null || playbackReconcileConflicts.length === 0)`):
  - return early when `handoffGate !== 'allow'`, and add `handoffGate` to its dependencies;
  - inside the conflict loop, skip a conflict whose `conflict.remote` matches the loaded target
    (`nowPlayingResourceFromTarget(activeTargetRef.current)`, same kind and id).
- Add an effect: when `handoffGate === 'suppress'` and `playbackHandoffPrompt !== null`, call
  `setPlaybackHandoffPrompt(null)` without `rememberPlaybackHandoffDismissal`.

## `useCrossDevicePlayback.ts`

- Add `handoffGate: PlaybackHandoffGate` to `CrossDevicePlaybackBindings`, computed from
  `useSyncExternalStore(subscribeCrossDevicePlaybackView, getCrossDevicePlaybackView)` with
  `resolvePlaybackHandoffGate`. The view changes on events, not on position ticks, so the provider
  re-renders only when the gate can change.
- In the `subscribeCrossDevicePlaybackView` listener, keep the previous role and availability in
  refs and call `resolvePlaybackIdleAdoption` with `localPort.loadedRef()`,
  `isPlayingRef.current`, and the authoring-hold ref. `seek` → `localPort.adoptPosition`;
  `load_paused` → `void localPort.loadResourcePaused({ ref, startSeconds })`, with failures to
  `console.warn`.

## Tests

- `crossDevicePlaybackPolicy.test.ts`, `resolvePlaybackIdleAdoption`:
  - `remote` to `idle` with a paused podcast item not loaded → `load_paused` at its position.
  - The same item loaded → `seek`.
  - Live state, null resource, local audio playing, authoring hold, `active` to `idle`, `idle` on
    a cold open (previous availability `pending`), and `remote` with `unavailable` → `none`.

The gate itself is covered by plan 30's `resolvePlaybackHandoffGate` table. Extend that table:
a conflict held while the gate is `suppress` is shown when the gate becomes `allow` and the
server item is still a different item.

`playback-multi-device-handoff.yaml` still expects `playback-handoff-dialog` after the phone
plays, pauses, seeds the other item, and relaunches. The relaunch is often faster than the 5 s
leave grace, and during that grace this phone is still the active device, so the prompt stays
closed. The existing `extendedWaitUntil` for `playback-handoff-dialog` keeps
`timeout: ${TIMEOUT_SLOWEST}` (20 s), which is longer than the grace. Add a comment above that
wait: the dialog appears after this phone stops being the active device, about 5 s after
relaunch. Do not shorten that timeout below the grace. The mobile E2E API keeps the 5 s grace
(plan 14).

## Release scratchpad

```markdown
## The switch-item prompt stays out of live control

- Surfaces: mobile
- Change: the prompt that offers to switch to the episode played on another device no longer
  appears while another of the member's devices is playing (that device is shown and controlled
  directly) or while the phone is the active device. It waits a moment at startup until the phone
  knows whether another device is active. When the other device stops, the phone's player loads
  what it was playing, paused at the same spot, without changing the queue or history. Without
  a membership, in Offline Mode, or when the other device is offline, the prompt works as before.
- Who notices: members who play on more than one device
- Operator steps: none
```
