**Cursor model:** Opus 5.5 · **Reasoning:** extra high

# 32 — Mobile publishes its playback and stops when another device takes over

The phone becomes a source of truth while it plays. It publishes its state to the server, claims
the active role whenever its audio starts, and stops its own audio, without writing anything, when
another device claims.

Before editing, confirm plan 31's `useCrossDevicePlayback.ts`, `crossDevicePresenceController.ts`,
and `crossDevicePlaybackRepository.ts` exist. If not, stop and report.

## Rows

R3, R34, R53

## Runs after

31

## Files

apps/mobile/src/playback/crossDevice/crossDevicePlaybackPublisher.ts
apps/mobile/src/playback/crossDevice/crossDevicePlaybackPublisher.test.ts
apps/mobile/src/playback/crossDevice/useCrossDevicePlayback.ts
apps/mobile/src/playback/PlaybackProvider.tsx
apps/mobile/vitest.config.ts

## Decisions this plan fixes

- **What publishes (R34).** Discrete changes publish at once: play, pause, loading, a new item, a
  seek, and a rate change. While audio plays, a periodic publish goes out every
  `PLAYBACK_STATE_PUBLISH_INTERVAL_MS`. Clearing the player (`clearNowPlaying`) publishes
  `resource: null` while this device is active, which releases the role.
- **Every local start claims.** It does not matter whether audio started from the app, the lock
  screen, a headset, CarPlay, Android Auto, or a command; all of them pass through
  `setPlaybackPlaying(true)`. Plan 30's `resolvePlaybackPublishClaim` decides. A claim that fails
  on the network stays owed and retries while audio still plays. Pausing drops the claim, so a
  paused phone never becomes active.
- **Publishing does not wait for the stream.** It needs the feature running (plan 31's
  `isRunning()`), not an open stream. A phone that plays while its stream reconnects still claims
  and stops other devices.
- **Coalescing on a phone.** Requests are chained: one in flight. A change during a request marks
  the state dirty, and the newest local state goes out when that request settles. In the
  foreground, consecutive requests also keep `PLAYBACK_STATE_MIN_PUBLISH_GAP_MS` apart with a
  timer (leading and trailing, as plan 10 says). In the background the gap is skipped, because
  Android does not fire JS timers there and a trailing pause publish would wait until the app
  returns. A request's own settle is a native callback and always runs.
- **Periodic publishes are driven by progress samples.** The publisher checks on each
  `playbackProgressStore` change, not on its own interval. In the foreground that change comes
  from the 1 Hz interpolator; in the Android background it comes from native progress about every
  500 ms. Either way a publish goes out every 10 s while audio plays.
- **Stopping for another device is silent (R3, R53).** When the effective active device in the
  store becomes another session while audio plays here, the provider pauses the native engine and
  updates its own state, and writes the device-local last-playback snapshot. It writes no outbox
  event, no now-playing or history change, and no position post. A `pause` event for this item
  would make it the account's now-playing again, over the item the new device just started. That is
  the same rule `adoptRemotePlaybackPosition` follows. The new active device's own play event is
  what moves the queue.
- **409 `playback_not_active_device`.** With `active_session_id_text` set: another device took
  over, so stop local audio as above. With it null: the claim lapsed (presence expired), so claim
  again when audio still plays, and do nothing when it does not.
- **403 for membership** latches the feature off through plan 31's controller. Other failures go
  to `console.warn` and are not shown, like every background sync failure.

## `crossDevicePlaybackPublisher.ts` (pure, injected I/O)

```typescript
export type LocalPlaybackChangeKind = 'playing' | 'target' | 'transport' | 'seek' | 'rate';

export type CrossDevicePlaybackPublisherDeps = {
  publish: (body: PlaybackStatePublishBody) => Promise<PlaybackStatePublishResponse>;
  readLocal: () => LocalPlaybackPublishSnapshot;
  isRunning: () => boolean;
  isAppActive: () => boolean;
  now: () => number;
  /** Record the response in the store and count it as a check-in. */
  onPublished: (response: PlaybackStatePublishResponse) => void;
  /** 409 naming another active device. */
  onSuperseded: (activeSessionIdText: string) => void;
  onMembershipRefusal: () => void;
  /** Runs after any request settles; the hook re-runs a deferred supersede check here. */
  onSettled: () => void;
  isMembershipRefusal: (error: unknown) => boolean;
  parsePlaybackError: (error: unknown) => PlaybackApiError | null;
};

export function createCrossDevicePlaybackPublisher(deps: CrossDevicePlaybackPublisherDeps): {
  noteLocalChange: (params: { kind: LocalPlaybackChangeKind; wasPlayingLocally: boolean }) => void;
  noteHeartbeat: () => void;
  isClaimInFlight: () => boolean;
  dispose: () => void;
};
```

Behavior:

- **State:** `inFlight` (with whether it claims), `dirty`, `claimOwed`, `lastStartedAtMs`,
  `lastClaimFailedAtMs`, and a trailing timer.
- **`noteLocalChange`:** do nothing unless `isRunning()`. Read `readLocal()` and the store's role.
  When `resolvePlaybackPublishClaim({ role, wasPlayingLocally, isPlayingLocally })` is true, set
  `claimOwed`. When local audio is not playing, clear `claimOwed`. Then, when `claimOwed` or
  `shouldPublishPlaybackChange({ role, claim: false })`, request a publish.
- **Request a publish:** when a request is in flight, set `dirty` and return. In the foreground,
  when less than the gap has passed since `lastStartedAtMs`, arm the trailing timer for the rest
  (once) and return. Otherwise send.
- **Send:** read `readLocal()` again at send time and build the body with
  `buildPlaybackStatePublishBody(snapshot, claimOwed)`. Record `lastStartedAtMs`.
- **On success:** `onPublished(response)`. When the request claimed, clear `claimOwed`.
- **On failure**, in order:
  - Membership refusal → `onMembershipRefusal()`; clear `claimOwed` and `dirty`.
  - `parsePlaybackError` gives `playback_not_active_device` with a non-null
    `activeSessionIdText` → `onSuperseded(id)`; clear `claimOwed`.
  - The same code with a null id → when local audio plays, set `claimOwed` and mark `dirty`.
  - Otherwise `console.warn('[cross-device] publish failed', error)`; when the request claimed,
    keep `claimOwed` and set `lastClaimFailedAtMs`.
- **After every settle:** clear `inFlight`, call `onSettled()`, and when `dirty`, clear it and
  request a publish (the gap rule applies in the foreground; in the background send at once).
- **`noteHeartbeat`:** when running, nothing in flight, and local audio plays:
  - with `claimOwed` and at least 2 s since `lastClaimFailedAtMs` (a local
    `PLAYBACK_CLAIM_RETRY_MS = 2_000`), send;
  - otherwise, when the role is `active` and `now() - lastStartedAtMs >=
    PLAYBACK_STATE_PUBLISH_INTERVAL_MS`, send.
- **`dispose`** clears the timer and ignores later settles.

## `useCrossDevicePlayback.ts`

Give the hook a parameter object. Plans 33–35 add fields to it.

```typescript
export type UseCrossDevicePlaybackParams = {
  activeTarget: PlaybackTarget | null;
  nowPlaying: PlaybackNowPlaying | null;
  isPlaying: boolean;
  transportState: PlaybackTransportState;
  playbackRate: number;
  isPlayingRef: RefObject<boolean>;
  readPositionSeconds: () => number;
  readDurationSeconds: () => number;
  readEffectiveRate: () => number;
  /** The provider calls `current` from `seekTo` and `setRate`; the hook assigns it. */
  localChangeSignalRef: RefObject<(kind: LocalPlaybackChangeKind) => void>;
  /** Pause local audio without writing any playback event (R3). */
  stopForOtherDevice: () => void;
};
```

- Track `isAppActive` with `AppState` (`active` → true, `background` → false, `inactive`
  unchanged), in a ref.
- Create the publisher once. `readLocal` builds a `LocalPlaybackPublishSnapshot` from the latest
  params (keep them in a ref updated every render): title and channel title from `nowPlaying`,
  `imageUrl` from `nowPlaying.viewerImageUrl ?? nowPlaying.imageUrl`, position, duration, and rate
  from the readers. `publish` uses `crossDevicePlaybackRepository.publishState`. `onPublished`
  calls `recordCrossDevicePlaybackPublish(response)` and the presence controller's
  `notePresenceRefreshed()`. `onMembershipRefusal` calls the presence controller's
  `noteMembershipRefusal()`.
- An effect keyed on `isPlaying`, `activeTarget`, `transportState`, and `playbackRate` calls
  `noteLocalChange` with the kind that changed and `wasPlayingLocally`, the `isPlaying` value the
  previous run saw (kept in a ref). The first run only records values.
- Assign `localChangeSignalRef.current = (kind) => publisher.noteLocalChange({ kind,
  wasPlayingLocally: isPlayingRef.current })`.
- The existing `subscribePlaybackProgress` listener also calls `publisher.noteHeartbeat()`.
- **Supersede check** (`runSupersedeCheck`): read the store view and call
  `resolvePlaybackSupersedeAction({ thisSessionIdText, activeSessionIdText, isPlayingLocally:
  isPlayingRef.current, claimInFlight: publisher.isClaimInFlight() })`. On `stop`, call
  `stopForOtherDevice()`. On `defer`, set a pending flag. Run it when `applyStreamEvent` returns an
  applied state, after `recordCrossDevicePlaybackPublish`, and from `onSettled` when the flag is set
  (clear it first).
- `onSuperseded(id)` calls `stopForOtherDevice()` when `isPlayingRef.current`; the server is
  authoritative, and the stream will deliver the state that names `id`.

## `PlaybackProvider.tsx`

- Near the other refs, add `const crossDeviceLocalChangeRef = useRef<(kind:
  LocalPlaybackChangeKind) => void>(() => {});`.
- In `seekTo`, after `setPlaybackPositionSeconds(seconds)`, call
  `crossDeviceLocalChangeRef.current('seek')`. In `setRate`, after the rate is applied, call it
  with `'rate'`. Do not call it from `adoptRemotePlaybackPosition`, which stays silent.
- Add `stopPlaybackForOtherDevice` next to `pause`: `nativePlaybackBridge.pause()`,
  `releasePendingStart()`, `setPlaybackPlaying(false)`, `setTransportState('paused')`, and
  `writeLastPlaybackSnapshotForTarget(target, positionRef.current)` when a target is loaded. It
  never calls `writePlaybackEvent`. The engine's later `paused` event only calls
  `setPlaybackPlaying(false)` (`useNativePlaybackBridge` `playbackState` handler), so nothing else
  writes.
- Change the plan 31 call to `useCrossDevicePlayback({ ... })` with the params above:
  `readPositionSeconds: () => positionRef.current`, `readDurationSeconds: () =>
  durationRef.current`, `readEffectiveRate: () => playbackRateRef.current`, and `isPlayingRef`.

## `apps/mobile/vitest.config.ts`

Add `crossDevicePlaybackPublisher.test.ts` and a header clause ("the cross-device state
publisher — claim rule, chaining, the foreground gap and background skip, periodic publishing from
progress samples, and 409/403 handling (`src/playback/crossDevice/crossDevicePlaybackPublisher.ts`)").

## Tests

`crossDevicePlaybackPublisher.test.ts` (fake timers, a fake `publish` returning deferred promises,
the store set up per test):

- Starting audio from paused sends `claim: true`; a pause while active sends `claim: false` with
  `status: 'paused'`.
- A change while a request is in flight sends once more on settle, with the newest local state.
- Foreground: two changes 100 ms apart send at 0 ms and at 500 ms. Background: the second change
  sends on settle with no timer.
- While playing as `active`, heartbeats send once every 10 s and not more often.
- Not running sends nothing; `idle` or `remote` role with paused audio sends nothing.
- A failed claim stays owed: the next heartbeat after 2 s sends `claim: true`; pausing clears it.
- 409 with another active id calls `onSuperseded` and drops the owed claim; 409 with null while
  playing sends a claim; while paused it sends nothing.
- A membership 403 calls `onMembershipRefusal` and sends nothing more.
- `isClaimInFlight` is true only while a claiming request is pending; `onSettled` runs after
  success and failure.
- A clear (`target: null`) while active sends `resource: null`.

## Release scratchpad

```markdown
## Mobile shares its playback and yields to the device you start

- Surfaces: mobile
- Change: while a member's phone plays, it publishes what it plays, its position, rate, and
  status to their other devices (on every play, pause, seek, rate change, and item change, and every
  10 seconds while playing, including in the background). Starting audio on the phone from the
  app, the lock screen, a headset, or the car makes it the active device. When another device starts
  playing, the phone's audio stops on its own, without changing the queue or history.
- Who notices: members who play on more than one device
- Operator steps: none
```
