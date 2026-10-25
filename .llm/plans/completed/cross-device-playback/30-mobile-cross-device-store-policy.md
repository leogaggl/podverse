**Cursor model:** Opus 5.5 · **Reasoning:** extra high

# 30 — Mobile cross-device playback store and policy (pure)

The read model and the decision rules every later area C plan and area E's UI build on. Two pure
modules under a new `apps/mobile/src/playback/crossDevice/` directory: no React Native, no Expo, no
requests, no `setTimeout` except the opt-in remote position clock. Later plans wire them to the
stream, the API, and `PlaybackProvider`.

Before editing, confirm `packages/helpers/src/lib/accountPlaybackStream.ts` (plan 10) and
`packages/helpers/src/lib/crossDevicePlayback.ts` (plan 11) exist and export the names used below.
If either is missing, stop and report.

## Rows

R53, R56

## Runs after

10, 11

## Files

apps/mobile/src/playback/crossDevice/crossDevicePlaybackStore.ts
apps/mobile/src/playback/crossDevice/crossDevicePlaybackStore.test.ts
apps/mobile/src/playback/crossDevice/crossDevicePlaybackPolicy.ts
apps/mobile/src/playback/crossDevice/crossDevicePlaybackPolicy.test.ts
apps/mobile/vitest.config.ts

## Imports

Use the subpaths, which mobile resolves through package exports (`metro.config.js` sets
`unstable_enablePackageExports`):

- `@podverse/helpers/accountPlaybackStream` for the DTOs, `PLAYBACK_*` constants, and
  `PlaybackStartFailedReason`.
- `@podverse/helpers/crossDevicePlayback` for `estimatePlaybackPositionSeconds`,
  `isNewerPlaybackRevision`, `isPlaybackCommandAllowed`, `resolvePlaybackRole`, and the
  `PlaybackRole` type.
- `@podverse/playback-core` for the `PlaybackTarget` type.
- `../playbackTransport` for the `PlaybackTransportState` type.
- `../../lib/addByRss/resourceData` for `addByRssPlaybackMediaId` and
  `isAddByRssLivestreamResourceData` (pure; `playbackEventSource.ts` already imports them under
  Vitest).

Do not re-implement anything plan 11 exports.

## Decisions this plan fixes

- **Remote state is display only (R53).** The store is the only place another device's playback
  lives on this phone. Nothing in it writes the outbox, the journal, history, a queue row, the
  device-local last-playback snapshot, or `playbackProgressStore`. Area E reads it; no repository
  reads it.
- **Availability.** `off` when the feature is not running for this account (signed out, no
  membership, Offline Mode, terms block sync, server refusal) or the account stream is not running.
  `pending` from the moment it is running until this device knows its own session id and has a
  view. `ready` after that, and it stays `ready` across a healthy reconnect (`connecting`).
  `unavailable` while the stream fails (`retrying` or `stopped`). Plan 31 computes the transitions;
  this plan stores them.
- **The view is never cleared on `off` or `unavailable`.** It goes stale and the next snapshot
  replaces it. A pause published just before the stream closes still sees this device as active.
  Only `resetCrossDevicePlaybackStore` (sign-out) clears it.
- **Own claims (`localClaim`).** A publish response carries a revision and the active id but no
  full state. The store records it as `localClaim` and the effective active device is the claim's
  while its revision is above the stored state's. The stream's echo of that state then applies
  normally and makes the claim obsolete. This prevents an older state from another device from
  undoing a claim this device just won.
- **Role.** `role` is `resolvePlaybackRole({ thisSessionIdText, activeSessionIdText })` over the
  effective active id, computed whatever the availability. Callers that route controls or gate the
  744 prompt also check `availability === 'ready'`; the publisher (plan 32) uses `role` alone.

## `crossDevicePlaybackStore.ts`

Module-level store, the same shape as `playbackProgressStore.ts`: a private snapshot, a listener
set, `get` and `subscribe` for `useSyncExternalStore`. Each change builds a new view object, so
identity changes only when something changed.

```typescript
export type CrossDevicePlaybackAvailability = 'off' | 'pending' | 'ready' | 'unavailable';

export type CrossDevicePlaybackTransfer = {
  commandIdText: string;
  targetSessionIdText: string;
  startedAtMs: number;
};

export type CrossDevicePlaybackTransferFailureReason =
  | PlaybackStartFailedReason
  | 'timeout'
  /** `playback_device_not_connected`: the target left before the command reached it. */
  | 'not_connected'
  | 'send_failed';

export type CrossDevicePlaybackTransferFailure = {
  targetSessionIdText: string;
  reason: CrossDevicePlaybackTransferFailureReason;
  atMs: number;
};

/** A remote control (play, pause, seek, rate, play item) that did not reach the active device. */
export type CrossDevicePlaybackCommandFailure = {
  commandType: PlaybackCommandType;
  atMs: number;
};

export type CrossDevicePlaybackView = {
  availability: CrossDevicePlaybackAvailability;
  /** This login session, from the presence response. Null until the first check-in succeeds. */
  thisSessionIdText: string | null;
  devices: DTOPlaybackDevices | null;
  state: DTOPlaybackState | null;
  /** Client clock when `state` arrived; the input to `estimatePlaybackPositionSeconds`. */
  stateReceivedAtMs: number | null;
  /** This device's newest accepted claim while it is newer than `state`. */
  localClaim: { revision: number; activeSessionIdText: string | null } | null;
  /** `localClaim`'s active id when it is newer than `state`, else `state?.active_session_id_text ?? null`. */
  activeSessionIdText: string | null;
  role: PlaybackRole;
  /** A take-over this device sent and is waiting on (plan 34). */
  transfer: CrossDevicePlaybackTransfer | null;
  /** The last take-over this device sent that did not start; area E shows it, then clears it. */
  transferFailure: CrossDevicePlaybackTransferFailure | null;
  /** The last remote control that failed to send; area E shows it, then clears it. */
  commandFailure: CrossDevicePlaybackCommandFailure | null;
};

export function getCrossDevicePlaybackView(): CrossDevicePlaybackView;
export function subscribeCrossDevicePlaybackView(listener: () => void): () => void;

export function setCrossDevicePlaybackAvailability(next: CrossDevicePlaybackAvailability): void;

/** `playback.snapshot`: replaces devices and state. Keeps `localClaim` only when it is newer than the snapshot's state. */
export function applyCrossDevicePlaybackSnapshot(snapshot: DTOPlaybackSnapshot, receivedAtMs: number): void;

/** Presence response: sets `thisSessionIdText`; devices and state apply by revision. */
export function applyCrossDevicePlaybackPresence(response: PlaybackPresenceResponse, receivedAtMs: number): void;

/** `playback.state`. Returns true when it was newer and applied. */
export function applyCrossDevicePlaybackState(state: DTOPlaybackState, receivedAtMs: number): boolean;

/** `playback.devices`. Returns true when it was newer and applied. */
export function applyCrossDevicePlaybackDevices(devices: DTOPlaybackDevices): boolean;

/** A successful publish response from this device. */
export function recordCrossDevicePlaybackPublish(response: PlaybackStatePublishResponse): void;

export function beginCrossDevicePlaybackTransfer(transfer: CrossDevicePlaybackTransfer): void;
/** Clears `transfer` when its command id matches; sets `transferFailure` when `failure` is given. */
export function settleCrossDevicePlaybackTransfer(params: {
  commandIdText: string;
  failure: CrossDevicePlaybackTransferFailure | null;
}): void;
/** A take-over that failed before any command id existed (the send itself failed). */
export function recordCrossDevicePlaybackTransferFailure(failure: CrossDevicePlaybackTransferFailure): void;
export function clearCrossDevicePlaybackTransferFailure(): void;
export function recordCrossDevicePlaybackCommandFailure(failure: CrossDevicePlaybackCommandFailure): void;
export function clearCrossDevicePlaybackCommandFailure(): void;

/** Estimated position of the shared state now; null when live, unknown, or nothing is shared. */
export function getCrossDevicePlaybackPositionSeconds(nowMs: number): number | null;
/**
 * Whole-second changes of that estimate, for area E's remote progress. Runs a 1 s interval only
 * while at least one listener is subscribed and the state is `playing` and not live.
 */
export function subscribeCrossDevicePlaybackPositionClock(listener: () => void): () => void;

export function resetCrossDevicePlaybackStore(): void;
```

Rules:

- Revision checks use `isNewerPlaybackRevision`. `applyCrossDevicePlaybackPresence` applies its
  `state` only when newer than both `state` and `localClaim`, and its `devices` only when newer
  than `devices`. A null `state` in a presence response changes nothing.
- `applyCrossDevicePlaybackState` compares with the stored `state` (not with `localClaim`), so the
  echo of this device's own claim applies. After any state applies, drop `localClaim` when
  `localClaim.revision <= state.revision`.
- `recordCrossDevicePlaybackPublish` sets `localClaim` to the response when its revision is above
  both `state?.revision` and `localClaim?.revision`; otherwise it does nothing.
- `activeSessionIdText` and `role` are recomputed on every change from the rules above.
- `settleCrossDevicePlaybackTransfer` with a non-matching command id does nothing, so a late
  answer for an earlier transfer cannot clear a newer one.
- The position clock reads `Date.now()` and compares `Math.floor` of the estimate with the last
  value it emitted; it starts and stops its interval from `subscribe`, the unsubscribe function,
  and every view change (state moves to `paused`, live, or null).
- `resetCrossDevicePlaybackStore` returns to `availability: 'off'`, every field null, role `idle`,
  stops the clock, and notifies listeners.

## `crossDevicePlaybackPolicy.ts`

```typescript
/** What the publisher reads from the local player at publish time (plan 32 builds it). */
export type LocalPlaybackPublishSnapshot = {
  target: PlaybackTarget | null;
  title: string | null;
  channelTitle: string | null;
  imageUrl: string | null;
  isPlaying: boolean;
  transportState: PlaybackTransportState;
  positionSeconds: number;
  durationSeconds: number;
  /** Effective engine rate. */
  rate: number;
};

export function playbackResourceRefFromTarget(target: PlaybackTarget): DTOPlaybackResourceRef | null;
export function isLivePlaybackTarget(target: PlaybackTarget): boolean;
export function isSamePlaybackResourceRef(a: DTOPlaybackResourceRef, b: DTOPlaybackResourceRef): boolean;

export function buildPlaybackStatePublishBody(
  snapshot: LocalPlaybackPublishSnapshot,
  claim: boolean
): PlaybackStatePublishBody;
```

- `playbackResourceRefFromTarget`: `clip` → `{ kind: 'clip', clip_id_text }`; `soundbite` →
  `{ kind: 'soundbite', item_soundbite_id_text }`; `chapter`, `item-podcast`, `item-video`,
  `item-music` → `{ kind: 'item', item_id_text: target.item.id_text }` (a chapter is its item at a
  position); `livestream` → the item ref when `target.item` is not null, else null; `add-by-rss` →
  `{ kind: 'add_by_rss', add_by_rss_hash_id: addByRssPlaybackMediaId(target.resourceData) }`,
  including Add by RSS livestreams. Unlike `nowPlayingResourceFromTarget`, live items get a ref:
  the shared state carries them with `is_live` (plan 10).
- `isLivePlaybackTarget`: `livestream`, or `add-by-rss` with
  `isAddByRssLivestreamResourceData`.
- `buildPlaybackStatePublishBody`:
  - No target, or a target with no ref: `resource: null`, `status: 'paused'`, `is_live: false`,
    position and duration null, `rate: 1`. With `claim: true` this still makes this device active
    (exclusivity holds for a livestream the car started with no item), and other devices show
    nothing.
  - `status`: `'loading'` when `transportState === 'loading'`, else `'playing'` when `isPlaying`,
    else `'paused'` (`error` publishes `paused`).
  - Live: `is_live: true`, position and duration null, `rate: 1`.
  - Otherwise position `Math.max(0, positionSeconds)`, duration `durationSeconds > 0 ?
    durationSeconds : null`, rate clamped to `[PLAYBACK_RATE_MIN, PLAYBACK_RATE_MAX]`.
  - `resource.title`, `channel_title`, `image_url`: the snapshot's fields, each trimmed and cut to
    `PLAYBACK_TEXT_FIELD_MAX_LENGTH` (title, channel title) or set to null past
    `PLAYBACK_IMAGE_URL_MAX_LENGTH` (image), so the server's validation never rejects a publish.

```typescript
/**
 * Whether a publish claims. True when local audio just started (false → true, from any source:
 * the app, lock screen, headset, car, or a command), or when audio plays and this device is not
 * the active one. False while this device is active and was already playing, so an auto-advance
 * after another device took over gets a 409 and stops instead of taking playback back.
 */
export function resolvePlaybackPublishClaim(params: {
  role: PlaybackRole;
  wasPlayingLocally: boolean;
  isPlayingLocally: boolean;
}): boolean;

/** Whether this device publishes a non-claim change: only while it is the active device. */
export function shouldPublishPlaybackChange(params: { role: PlaybackRole; claim: boolean }): boolean;

export type PlaybackSupersedeAction = 'stop' | 'defer' | 'none';

/**
 * R3: an applied `playback.state` (or a 409 body) that names another device while this one plays
 * stops local audio. A claim still in flight defers the decision until its response is recorded.
 */
export function resolvePlaybackSupersedeAction(params: {
  thisSessionIdText: string | null;
  activeSessionIdText: string | null;
  isPlayingLocally: boolean;
  claimInFlight: boolean;
}): PlaybackSupersedeAction;
```

`resolvePlaybackSupersedeAction` returns `none` when this session is unknown, the active id is
null (the active device left; nobody stops), it equals this session, or nothing plays locally;
`defer` when a claim is in flight; otherwise `stop`. Callers pass the store's effective
`activeSessionIdText` after applying the event, so an older state that lost to this device's
recorded claim does not stop it.

```typescript
export function createSeenPlaybackCommandIds(limit: number): {
  has: (commandIdText: string) => boolean;
  add: (commandIdText: string) => void;
};

/** Measured on this device's clock only: never compare with `expires_at_ms` (plan 10). */
export function isPlaybackCommandStale(params: { receivedAtMs: number; nowMs: number }): boolean;

export type PlaybackTakeOverStart = {
  ref: DTOPlaybackResourceRef;
  /** Null for a live item: start at the live point. */
  startSeconds: number | null;
  isLive: boolean;
};

/** Where a take-over resumes: the estimated position now, or the live point. Null when nothing is shared. */
export function resolvePlaybackTakeOverStart(params: {
  state: DTOPlaybackState;
  receivedAtMs: number;
  nowMs: number;
}): PlaybackTakeOverStart | null;

/** Remote skip forward or back as an absolute seek from the estimate; null when not allowed (live, unknown position). */
export function resolveRemoteJumpSeekSeconds(params: {
  state: DTOPlaybackState;
  receivedAtMs: number;
  nowMs: number;
  deltaSeconds: number;
}): number | null;

export type PlaybackHandoffGate = 'defer' | 'suppress' | 'allow';

/** R56: whether the 744 different-item prompt may open (plan 35). */
export function resolvePlaybackHandoffGate(params: {
  availability: CrossDevicePlaybackAvailability;
  role: PlaybackRole;
}): PlaybackHandoffGate;
```

- `createSeenPlaybackCommandIds` follows plan 40's `createSeenNotificationIds`: insertion order,
  the oldest dropped past `limit`. Plan 33 uses a limit of 100.
- `isPlaybackCommandStale`: `nowMs - receivedAtMs > PLAYBACK_COMMAND_TTL_MS`.
- `resolvePlaybackTakeOverStart`: null when `state.resource` is null; `startSeconds` is
  `estimatePlaybackPositionSeconds(...)` (null when live). A take-over resumes where the active
  device is now, not where it last published.
- `resolveRemoteJumpSeekSeconds`: null when `!isPlaybackCommandAllowed('seek', { isLive })` or
  the estimate is null; otherwise estimate plus delta, clamped to `[0, duration_seconds]` (no upper
  clamp when the duration is null).
- `resolvePlaybackHandoffGate`: `pending` → `defer`; `ready` with role `remote` or `active` →
  `suppress`; everything else (`ready` and `idle`, `off`, `unavailable`) → `allow`. This is how the
  744 prompt and the live control never show together: while another device plays, the live
  control owns the conversation; when nobody is active, or this device cannot see the others (no
  membership, Offline Mode, stream down), the 744 prompt works as it does today.

## `apps/mobile/vitest.config.ts`

Add both test files to `include` beside `'src/playback/playbackHandoff.test.ts'`, and one clause to
the header comment listing what is covered: "the cross-device playback read model and its rules —
revision ordering, own-claim precedence, role, the publish body and claim rule, the supersede rule,
command dedupe and staleness, take-over start, and the 744 prompt gate
(`src/playback/crossDevice/crossDevicePlaybackStore.ts`, `crossDevicePlaybackPolicy.ts`)".

## Tests

- `crossDevicePlaybackStore.test.ts` (reset in `beforeEach`; fake timers for the clock):
  - A snapshot replaces devices and state even when its revision is lower than the stored one.
  - A state event applies only when newer; an equal or older one returns false and keeps the view.
  - Devices events apply by revision, independent of state.
  - Presence sets `thisSessionIdText`; its state applies by revision and never over a newer
    `localClaim`; a null state changes nothing.
  - Role: no session → `idle` when nothing is active, `remote` when a device is; this session
    active → `active`; null active → `idle`.
  - Own claim: after `recordCrossDevicePlaybackPublish` at revision 20 while state is 10 naming
    another device, role is `active`; a state at 15 naming the other device applies but role stays
    `active`; the echo at 20 applies and clears `localClaim`; a later state at 30 naming the other
    device makes role `remote`.
  - A snapshot keeps a newer `localClaim` and drops an older one.
  - Transfer: settle with a different command id leaves `transfer`; the matching one clears it
    and records the failure; `clearCrossDevicePlaybackTransferFailure` clears it;
    `recordCrossDevicePlaybackTransferFailure` sets a failure without touching `transfer`.
  - Command failure: record, then clear.
  - Position clock: emits once per whole second while playing; no interval runs while paused,
    live, or with no listeners; unsubscribing the last listener stops it.
  - Reset returns to `off`, clears every field, and notifies.
- `crossDevicePlaybackPolicy.test.ts`:
  - Refs for each target kind, including a chapter (its item), a livestream with and without an
    item, and an Add by RSS livestream (hash ref, live).
  - Publish body: playing, paused, loading, error → paused; live body has null position and
    duration and rate 1; rate clamps to 0.5 and 3; null duration when 0; no target or no ref gives
    the null-resource body; long title and image URL are cut or nulled.
  - Claim rule: false → true claims for every role; already playing as `active` does not claim;
    playing as `remote` or `idle` claims; paused never claims.
  - `shouldPublishPlaybackChange`: claims always publish; non-claims only as `active`.
  - Supersede: `none` for null active, own session, unknown session, and paused; `defer` with a
    claim in flight; `stop` otherwise.
  - Seen ids drop the oldest past the limit. Staleness: 5000 ms is fresh, 5001 ms is stale.
  - Take-over start: estimated position for a playing state after elapsed time; null start for
    live; null for a null resource.
  - Remote jump: clamps at 0 and at duration; null for live.
  - Handoff gate: every availability against every role.

## Release scratchpad

none
