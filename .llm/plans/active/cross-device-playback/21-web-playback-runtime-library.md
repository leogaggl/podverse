**Cursor model:** Opus 5.5 · **Reasoning:** high

# 21 — Web cross-device playback runtime library (store, tab role, tab channel, publish timing)

Framework-free modules under `apps/web/src/lib/crossDevicePlayback/` that hold this tab's view of
cross-device playback and decide its role. No React and no network here: plan 22 wires the store
to the stream, the API, and the player; plans 23–26 and area D read it.

Exclusive active-device handoff on web: a **device** is one login session, so every tab of one
browser profile is the same device (plan 10). Only one of those tabs holds audio at a time: the
**audio tab**. Tabs agree on which one it is over a `BroadcastChannel`, because the server cannot
tell tabs of one session apart.

Before editing, confirm `@podverse/helpers` exports plan 10's `DTOPlaybackState`,
`DTOPlaybackDevices`, `DTOPlaybackResourceRef`, `DTOPlaybackResourceSummary`,
`PlaybackStatePublishBody`, `PlaybackPresenceResponse`, `PlaybackStatePublishResponse`,
`AccountPlaybackStreamEvent`, `DTOPlaybackCommandEnvelope`, `DTOPlaybackStartFailed`, the
`PLAYBACK_*` constants and guards, and plan 11's `resolvePlaybackRole`, `isNewerPlaybackRevision`,
and `estimatePlaybackPositionSeconds`. If not, stop and report.

## Rows

R2, R52, R61

## Runs after

10, 11

## Files

apps/web/src/lib/crossDevicePlayback/crossDevicePlaybackStore.ts
apps/web/src/lib/crossDevicePlayback/crossDevicePlaybackStore.test.ts
apps/web/src/lib/crossDevicePlayback/tabPlaybackRole.ts
apps/web/src/lib/crossDevicePlayback/tabPlaybackRole.test.ts
apps/web/src/lib/crossDevicePlayback/playbackTabChannel.ts
apps/web/src/lib/crossDevicePlayback/playbackTabChannel.test.ts
apps/web/src/lib/crossDevicePlayback/playbackResource.ts
apps/web/src/lib/crossDevicePlayback/playbackResource.test.ts
apps/web/src/lib/crossDevicePlayback/playbackPublishScheduler.ts
apps/web/src/lib/crossDevicePlayback/playbackPublishScheduler.test.ts

## Decisions this plan fixes

- **R61 — which tab is "this device".** The device is the browser profile's session, listed once
  in the device menu. Within it, the tab that most recently started playback locally is the audio
  tab. A tab's role is per tab:
  - `active`: this session is the active device **and** this tab holds audio, or this tab has a
    claim in flight.
  - `remote`: another session is active, **or** this session is active and another tab holds
    audio. A remote tab shows the active device's state and sends commands; tabs of the active
    session send commands to their own session, and the audio tab obeys (plan 13 allows a command
    to target the sender's own session).
  - `idle`: no device is active, or cross-device playback is not available in this tab. Local
    playback behaves as it does today.
- **A claim wins locally at once.** While this tab's claim is in flight its role is `active`, so a
  state event published before the claim (an older revision that may still name another device)
  never stops the playback the person just started.
- **Own publishes set the revision floor.** A successful publish response carries the revision the
  server wrote. The store keeps a state built from what this tab published at that revision, so a
  stream event with an older revision that arrives after the response is ignored.
- **Sender-side optimism.** A command this tab sends patches the displayed state at once (status,
  position, or rate), so a second skip tap computes from the first one's target. The patch drops
  when a state with a newer revision arrives, or after `PLAYBACK_COMMAND_TTL_MS + 1000` ms.
- **Availability gates everything.** Until this tab knows its session id (first check-in
  response), or when the account has no membership, role is `idle` and nothing is intercepted. A
  tab still `pending` 5 s after it started counts as settled for the handoff prompt (plan 26).

## `tabPlaybackRole.ts`

```typescript
import type { PlaybackRole } from '@podverse/helpers';

export type CrossDevicePlaybackAvailability = 'off' | 'pending' | 'ready' | 'unavailable';

export function resolveTabPlaybackRole(params: {
  availability: CrossDevicePlaybackAvailability;
  thisSessionIdText: string | null;
  activeSessionIdText: string | null;
  thisTabHoldsAudio: boolean;
  claimPending: boolean;
}): PlaybackRole;
```

Order: availability not `ready` → `idle`; `claimPending` → `active`; then
`resolvePlaybackRole({ thisSessionIdText, activeSessionIdText })` from plan 11; when that is
`active`, return `active` only if `thisTabHoldsAudio`, else `remote`. Otherwise return it.

## `playbackResource.ts`

Pure builders from the web player's state to plan 10's shapes. Inputs are typed with the existing
DTOs and `PlaybackTarget` from `../playback`.

```typescript
export type PlayerResourceInput = {
  mpAddByRSS: MediaPlayerAddByRSSState;
  mpChannel: DTOChannel | null;
  mpItem: DTOItem | null;
  mpClip: DTOClip | null;
  mpItemSoundbite: DTOItemSoundbite | null;
  mpItemChapter: DTOItemChapter | null;
  mpItemChapters: DTOItemChapter[] | null;
};

export function buildPlaybackResourceRefFromPlayer(player: PlayerResourceInput): DTOPlaybackResourceRef | null;
export function buildPlaybackResourceRefFromTarget(target: PlaybackTarget): DTOPlaybackResourceRef | null;
/** Start position a target asks for: an explicit value, else a chapter's start, else null. */
export function playbackStartSecondsFromTarget(target: PlaybackTarget, explicitSeconds: number | undefined): number | null;
export function isSamePlaybackResourceRef(a: DTOPlaybackResourceRef | null, b: DTOPlaybackResourceRef | null): boolean;
export function buildPlaybackResourceSummary(player: PlayerResourceInput, currentTimeSeconds: number): DTOPlaybackResourceSummary | null;
export function isPlayerResourceLive(player: Pick<PlayerResourceInput, 'mpItem' | 'mpAddByRSS'>): boolean;
export function buildPlaybackStatePublishBody(params: {
  player: PlayerResourceInput;
  isPlaying: boolean;
  shouldPlay: boolean;
  currentTimeSeconds: number;
  durationSeconds: number;
  rate: number;
  claim: boolean;
}): PlaybackStatePublishBody;
/** The web speed list value nearest `rate`; ties go to the lower value. */
export function nearestPlaybackSpeedValue(rate: number): PlaybackSpeedValue;
```

Rules:

- Ref from player, in order: `mpAddByRSS` → `{ kind: 'add_by_rss', add_by_rss_hash_id }` from
  `addByRSSPlaybackIdentity(mpAddByRSS.resourceData)` (from `../../hooks/playbackHandoffState`),
  null when that is null; `mpClip` → clip `id_text`; `mpItemSoundbite` → soundbite `id_text`;
  `mpItem` → item `id_text` (a chapter plays as its item). Null when nothing is loaded.
- Ref from target: `clip` → clip; `soundbite` → soundbite; `chapter`, `item-*`, `livestream` →
  item; `add-by-rss` → hash as above.
- Ref equality compares `kind` and the one id field.
- Summary: `title` = `getMediaPlayerInfoResolution(...).itemTitle` (from
  `../../utils/mediaPlayer/mediaPlayerInfoResolution`, with `currentTimeSeconds`), the episode or
  track title, never a chapter, clip, or soundbite title, matching what mobile publishes;
  `medium` follows plan 22's rule (`toPlaybackMedium(mpAddByRSS.resourceData.medium_id)` for Add
  by RSS, else `toPlaybackMedium(mpChannel?.medium_id)`, from
  `@podverse/helpers/accountPlaybackStream`); `channel_title`
  = its `channelTitle`; `image_url` = the first URL from
  `buildMediaPlayerArtworkImageCandidates` with the inputs `MediaPlayerInfoDesktop` uses
  (`getMediaPlayerArtworkSources`, chapter image when `shouldUseChapterArtwork`,
  `IMAGES.MEDIA_PLAYER.DESKTOP.MINI.SIZE_FIND_TARGET`, `'lesser'`, `artworkRole: 'list'`), or
  null. Truncate `title` and `channel_title` to `PLAYBACK_TEXT_FIELD_MAX_LENGTH`; drop an
  `image_url` longer than `PLAYBACK_IMAGE_URL_MAX_LENGTH` (null). Null summary when the ref is
  null.
- Live: `checkIsLiveItem(mpItem)` (from `../../utils/mediaPlayer/mediaPlayerItemEnclosureType`),
  or `mpAddByRSS` whose `resourceData.liveItem` is a non-null object.
- Publish body: `resource` = summary; `status` = `playing` when `isPlaying`, else `loading` when
  `shouldPlay`, else `paused`; when live, `position_seconds: null`, `duration_seconds: null`,
  `rate: 1`; otherwise position = `max(0, currentTimeSeconds)`, duration = `durationSeconds > 0 ?
  durationSeconds : null`, rate clamped to `[PLAYBACK_RATE_MIN, PLAYBACK_RATE_MAX]`. A null
  resource gives the release body: `status: 'paused'`, `is_live: false`, nulls, `rate: 1`.
  Pass the body through `isDTOPlaybackResourceSummary` for the resource part in tests.
- Speed list: the values of `PlaybackSpeedValue` in `packages/helpers/src/dtos/mediaPlayer/playbackSpeed.ts`
  (`0.5, 0.75, 0.87, 1, 1.12, 1.25, 1.5, 1.75, 2, 2.5, 3`), kept as a local typed array.

## `playbackTabChannel.ts`

Same structural style as realtime plan 30's coordinator (`BroadcastChannelLike`, injected
`createChannel`, a private `read…Message` guard with no `as`).

```typescript
export type PlaybackTabMessage =
  | { kind: 'audio-tab'; accountId: number; tabId: string; claimedAtMs: number }
  | { kind: 'audio-tab-gone'; accountId: number; tabId: string; lastState: PlaybackStatePublishBody | null }
  | { kind: 'tab-focused'; accountId: number; tabId: string; atMs: number }
  | { kind: 'tab-gone'; accountId: number; tabId: string };

export function startPlaybackTabChannel(options: {
  accountId: number;
  tabId: string;
  createChannel: ((name: string) => BroadcastChannelLike) | null;
  onMessage: (message: PlaybackTabMessage) => void;
}): {
  available: boolean;
  announceAudioTab(claimedAtMs: number): void;
  announceAudioTabGone(lastState: PlaybackStatePublishBody | null): void;
  announceFocused(atMs: number): void;
  announceGone(): void;
  close(): void;
};
```

Channel name `podverse:playback-tabs`. Ignore messages whose `accountId` differs, and messages
from this `tabId`. `lastState` is validated in the guard: `claim` boolean, `resource` null or
`isDTOPlaybackResourceSummary`, `status` in `PLAYBACK_STATUSES`, `is_live` boolean, numbers finite
or null as plan 10 requires; an invalid `lastState` reads as null. When `createChannel` is null,
`available` is false and every method does nothing.

## `playbackPublishScheduler.ts`

Timing only; the caller supplies the body and the request.

```typescript
export type PublishInput = {
  /** Null stops scheduling (not the audio tab, or nothing to publish). */
  body: PlaybackStatePublishBody | null;
};

export function createPlaybackPublishScheduler(options: {
  publish: (body: PlaybackStatePublishBody) => Promise<void>;
  now?: () => number;
  setTimer?: (callback: () => void, ms: number) => number;
  clearTimer?: (id: number) => void;
}): {
  update(input: PublishInput): void;
  /** Publish the latest body as soon as the gap allows, regardless of what changed. */
  flush(): void;
  stop(): void;
};
```

Behavior:

- **Discrete change** when, compared with the last published body: `claim`, the resource ref
  (`isSamePlaybackResourceRef`), `status`, `is_live`, or `rate` differs; `duration_seconds`
  differs by more than 1; or the position drifts: expected = last position + (status was `playing`
  ? rate × elapsed seconds since that publish : 0), and `|position − expected| >
  PLAYBACK_STATE_DRIFT_TOLERANCE_SECONDS`.
- A discrete change publishes leading and trailing with at most one publish per
  `PLAYBACK_STATE_MIN_PUBLISH_GAP_MS`: at once when the gap has passed, otherwise once at the end
  of the gap with the newest body.
- While the last published status is `playing`, publish the newest body
  `PLAYBACK_STATE_PUBLISH_INTERVAL_MS` after the previous publish even with no change.
- At most one request in flight. A publish due while one is in flight runs after it settles
  (rejections included), still honoring the gap.
- `update({ body: null })` cancels pending timers and forgets the last body; the next non-null body
  publishes at once.
- `stop()` clears timers; later calls do nothing.

## `crossDevicePlaybackStore.ts`

One external store per page (`useSyncExternalStore`-compatible). Export the factory for tests and a
module singleton for the app:

```typescript
export type TransferFailureReason = PlaybackStartFailedReason | 'no_response' | 'not_connected' | 'request_failed';

export type CrossDevicePlaybackSnapshot = {
  availability: CrossDevicePlaybackAvailability;
  accountId: number | null;
  tabId: string;
  thisSessionIdText: string | null;
  streamOpen: boolean;
  isStreamLeader: boolean;
  devices: DTOPlaybackDevices | null;
  /** Last server state, or the state this tab's own publish wrote. */
  state: DTOPlaybackState | null;
  stateReceivedAtMs: number | null;
  /** `state` with the optimistic command patch applied; what remote views show. */
  displayState: DTOPlaybackState | null;
  claimPending: boolean;
  thisTabHoldsAudio: boolean;
  audioTab: { tabId: string; lastSeenMs: number } | null;
  lastFocusedTabId: string | null;
  role: PlaybackRole;
  pendingTransfer: { commandIdText: string; targetSessionIdText: string; sentAtMs: number } | null;
  transferFailure: { targetSessionIdText: string; reason: TransferFailureReason } | null;
  /** Set while a start this tab was asked to make is waiting for a tap. Null command id: local take-over. */
  tapToPlay: { commandIdText: string | null } | null;
  pendingCommandStart: { commandIdText: string; atMs: number } | null;
};

export type CrossDevicePlaybackStore = ReturnType<typeof createCrossDevicePlaybackStore>;
export function createCrossDevicePlaybackStore(options?: { now?: () => number; tabId?: string }): {
  getSnapshot(): CrossDevicePlaybackSnapshot;
  subscribe(listener: () => void): () => void;
  /** Commands and start-failed reports are signals, not state. */
  subscribeToSignals(listener: (signal: CrossDevicePlaybackSignal) => void): () => void;
  reset(params: { accountId: number | null; enabled: boolean }): void;
  setStream(params: { open: boolean; isLeader: boolean }): void;
  markPending(): void;
  markUnavailable(): void;
  applyPresenceResponse(response: PlaybackPresenceResponse, receivedAtMs: number): void;
  applyStreamEvent(event: AccountPlaybackStreamEvent, receivedAtMs: number): void;
  applyOwnPublish(body: PlaybackStatePublishBody, response: PlaybackStatePublishResponse): void;
  beginClaim(): void;
  confirmClaim(): void;
  abandonClaim(): void;
  /** This tab stops holding audio (lost to another device or tab, or released). */
  releaseAudio(): void;
  noteAudioTab(tabId: string, atMs: number): void;
  noteAudioTabGone(tabId: string): void;
  noteFocusedTab(tabId: string | null): void;
  setOptimisticPatch(patch: Partial<Pick<DTOPlaybackState, 'status' | 'position_seconds' | 'rate'>>): void;
  clearOptimisticPatch(): void;
  /** Estimated position of `displayState` now; null when live, unknown, or no state. */
  getEstimatedPositionSeconds(): number | null;
  setPendingTransfer(value: CrossDevicePlaybackSnapshot['pendingTransfer']): void;
  setTransferFailure(value: CrossDevicePlaybackSnapshot['transferFailure']): void;
  setTapToPlay(value: CrossDevicePlaybackSnapshot['tapToPlay']): void;
  setPendingCommandStart(commandIdText: string | null): void;
  /** Called by media controllers on any rejected `play()`; emits `local_play_blocked` for `NotAllowedError`. */
  notifyLocalPlayRejected(error: unknown): void;
  /** True unless this tab's role is `remote`. Save hooks call it synchronously. */
  isLocalPlaybackWriteAllowed(): boolean;
};

export type CrossDevicePlaybackSignal =
  | { kind: 'command'; envelope: DTOPlaybackCommandEnvelope; receivedAtMs: number }
  | { kind: 'start_failed'; report: DTOPlaybackStartFailed }
  | { kind: 'local_play_blocked' };

export const crossDevicePlaybackStore: CrossDevicePlaybackStore;
```

Rules (every mutation replaces the snapshot object and recomputes `role` and `displayState`, then
notifies; a call that changes nothing does not notify):

- `tabId`: `crypto.randomUUID()` when available, else a random base-36 string; fixed per page.
- `reset`: clears everything except `tabId`. `availability` = `off` when `!enabled` or
  `accountId` is null, else `pending` (records the time for the 5 s settle, which plan 22 times).
- `applyPresenceResponse`: sets `thisSessionIdText`; devices and state each replace only when
  `isNewerPlaybackRevision` says so (state stores `receivedAtMs`); `availability` → `ready`.
- `applyStreamEvent`:
  - `playback.snapshot`: replace devices and state (state may be null) with no revision check;
    also lowers the revision floor to the snapshot's.
  - `playback.state` / `playback.devices`: replace when newer than the current one and, for state,
    newer than the floor.
  - `playback.command` / `playback.start_failed`: emit a signal; store nothing.
  - Whenever the applied state's `active_session_id_text` equals `pendingTransfer.targetSessionIdText`,
    clear `pendingTransfer` and `transferFailure` for that target.
  - A newer state clears the optimistic patch.
- `applyOwnPublish`: when `response.revision` is newer than the floor, set the floor and replace
  `state` with one built from `body` (`revision` and `active_session_id_text` from the response;
  `updated_at_ms` and `sent_at_ms` 0; `stateReceivedAtMs` = now), so the estimate starts from the
  published position now.
- `beginClaim` sets `claimPending`. `confirmClaim` sets `thisTabHoldsAudio`, clears `claimPending`,
  and sets `audioTab` to this tab. `abandonClaim` clears `claimPending`. `releaseAudio` clears
  `thisTabHoldsAudio` and `claimPending`, and clears `audioTab` when it names this tab.
- `noteAudioTab` from another tab: set `audioTab`; when this tab holds audio or has a claim
  pending, call `releaseAudio` (the newer claim wins). Plan 22 passes only messages whose
  `claimedAtMs` is newer than this tab's own claim time, ties broken by the larger `tabId`.
- `getEstimatedPositionSeconds`: plan 11's `estimatePlaybackPositionSeconds` on `displayState`
  with `stateReceivedAtMs`; for the optimistic patch, use the patch time as `receivedAtMs` and
  treat `sent_at_ms − updated_at_ms` as 0.
- Optimistic patch expiry is evaluated on read (`getSnapshot` recomputes `displayState` lazily when
  the patch is older than `PLAYBACK_COMMAND_TTL_MS + 1000`), so the store needs no timer.
- `notifyLocalPlayRejected`: emit `local_play_blocked` only when the error is an object whose
  `name` is `'NotAllowedError'`.

Comments describe the code as it stands. No `any`, no `as` outside `as const`, `===` only.

## Must stay true

- Role is `idle` whenever availability is not `ready`.
- A claim in flight keeps role `active` until `confirmClaim`, `abandonClaim`, or `releaseAudio`.
- No state older than this tab's last accepted publish replaces it.
- `isLocalPlaybackWriteAllowed()` is false exactly when role is `remote`.

## Tests

Vitest, behavior-focused (**unit-test-design-no-overgranularity**), fake clock injected:

- `tabPlaybackRole.test.ts`: not ready → idle; claim pending → active even when another session
  is active; this session active and holding audio → active; this session active, not holding →
  remote; other session active → remote; none active → idle.
- `playbackResource.test.ts`: ref from an Add by RSS player uses the hash, a clip player uses the
  clip id, a chapter target uses the item id; `isSamePlaybackResourceRef` across kinds is false;
  a live item gives a body with null position and rate 1 even at speed 1.5; `shouldPlay` without
  `isPlaying` gives `loading`; a null resource gives the release body; a 600-character title is
  cut to 500; `nearestPlaybackSpeedValue(1.1)` is 1.12 and `(0.81)` is 0.75; the chapter target's
  start seconds is the chapter start when no explicit value is given.
- `playbackTabChannel.test.ts` (in-memory channel hub): messages from another account or from
  this tab are ignored; an `audio-tab-gone` with a malformed `lastState` reads `lastState: null`;
  with `createChannel: null`, `available` is false.
- `playbackPublishScheduler.test.ts` (fake timers, a `publish` mock resolving on demand): first
  body publishes at once; a status change 100 ms later publishes at 500 ms with the newest body;
  a steady playing body republishes every 10 s; a 5 s jump while playing publishes as discrete; a
  second publish waits for the first to settle; `update({ body: null })` cancels the trailing
  publish.
- `crossDevicePlaybackStore.test.ts`: presence response sets ready and session; an older
  `playback.state` is ignored; a snapshot replaces with a lower revision; an own publish at
  revision 9 makes a later revision 8 event ignored; a claim keeps role active while a newer event
  names another session, and after `abandonClaim` role is remote; `noteAudioTab` from another tab
  releases this tab's audio; a command event emits a signal and leaves state alone; an optimistic
  `paused` patch shows in `displayState` and disappears after 6 s; a state naming the pending
  transfer's target clears it; `isLocalPlaybackWriteAllowed` follows role.

## Release scratchpad

none (no behavior until plan 22 uses it)
