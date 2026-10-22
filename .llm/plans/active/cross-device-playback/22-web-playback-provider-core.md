**Cursor model:** Opus 5.5 · **Reasoning:** extra high

# 22 — Web cross-device playback provider: presence, publishing, claims, and stopping on loss

Wire plan 21's store to the account stream (plan 20), the playback routes (plan 13), and the web
player. After this plan a web tab:

- shows up as a device while the account stream is open (leader check-in every 15 s),
- becomes the active device when it starts playback, and publishes its state (R33),
- stops its own audio and clears its player when another device or tab becomes active (R2), and
- never writes queue or position data while another device is active (R52).

Commands (plan 23), transfer (plan 24), remote control routing (plan 25), and the handoff prompt
(plan 26) build on this. Area D builds the visible controls from the store.

Before editing, confirm plans 13, 20, and 21 have landed (`reqAccountPlaybackCheckIn` on
`ApiRequestService`, `parsePlaybackApiError` exported from `@podverse/helpers-requests`,
`subscribeToPlaybackStream` and `notificationStreamIsLeader` on the Notifications context,
`apps/web/src/lib/crossDevicePlayback/*`). If not, stop and report.

## Rows

R2, R33, R52, R61

## Runs after

13, 20, 21

## Files

apps/web/src/contexts/CrossDevicePlayback.tsx
apps/web/src/components/CrossDevicePlayback/CrossDevicePlaybackPublisher.tsx
apps/web/src/lib/crossDevicePlayback/crossDevicePlaybackCheckIn.ts
apps/web/src/lib/crossDevicePlayback/crossDevicePlaybackCheckIn.test.ts
apps/web/src/lib/crossDevicePlayback/playbackClaim.ts
apps/web/src/lib/crossDevicePlayback/playbackClaim.test.ts
apps/web/src/providers/Providers.tsx
apps/web/src/hooks/useQueueResourceUpdateNowPlaying.tsx
apps/web/src/hooks/useQueueResourceMoveNowPlayingToHistory.tsx
apps/web/src/hooks/useAddByRSSPositionSave.tsx
apps/web/src/hooks/__tests__/useQueueResourceUpdateNowPlaying.test.tsx
apps/web/src/hooks/__tests__/useQueueResourceMoveNowPlayingToHistory.test.tsx
apps/web/src/hooks/__tests__/useAddByRSSPositionSave.test.tsx

## Decisions this plan fixes

- **Who checks in.** Every tab checks in once each time the stream opens, to learn its session id
  and the current view. After that only the stream leader checks in, every
  `PLAYBACK_PRESENCE_CHECK_IN_INTERVAL_MS`, and only while the stream is open. A follower whose
  check-in failed retries on the same interval until one succeeds.
- **Availability.**
  - `off`: logged out, or an embed route (`useEmbedPlaybackGuardrails().isEmbedRoute`).
  - `pending`: logged in, no check-in answered yet. After 5 s still pending, it becomes
    `unavailable` (the stream may be disabled or down); a later success makes it `ready`.
  - `unavailable` on 403 (membership; `parseMembershipGateError` not null), 401, or any other
    failure before the first success. After a 403, check-ins stop until the `loggedInAccount`
    object changes (a membership purchase refreshes it). Other failures keep retrying.
  - Failures after `ready` (network, 503) keep the current view and retry; they do not leave
    `ready`. A 403 after `ready` makes it `unavailable` and stops.
- **Claim trigger.** This tab claims when availability is `ready`, the player is actually playing
  (`mpIsPlaying`, not just `mpShouldPlay`), a resource is loaded, the publisher has no claim
  request in flight, and either this tab does not hold audio or the server's active session is not
  this session. Becoming `ready` while already playing claims at once. The publisher calls
  `store.beginClaim()` when it sends the claim; plan 24 calls it earlier, when a transfer starts
  loading, so the role is `active` while the item loads. `claimPending` alone never blocks the
  trigger.
- **Only the audio tab publishes ordinary updates.** Non-claim publishes require
  `thisTabHoldsAudio`. A tab with `claimPending` that does not hold audio yet sends nothing until
  the claim trigger is met, so a transfer that is still loading never gets a 409 for a non-claim
  publish and drops its own load.
- **Claim outcomes.**
  - Success: `applyOwnPublish`, `confirmClaim`, announce this tab as audio tab.
  - 409 `playback_not_active_device` naming another session: should not happen for a claim (the
    server never refuses one); treat it as lost: `releaseAudio`.
  - 409 with `active_session_id_text: null`, network error, or 503: keep the claim pending and
    retry on the next publish tick (at most every `PLAYBACK_STATE_MIN_PUBLISH_GAP_MS`), up to 3
    tries; then `abandonClaim` (the tab goes back to `idle` and keeps playing locally).
- **Publish outcomes after a claim.** A non-claim publish answered 409 with another active session
  means another device took over: `releaseAudio` (role becomes `remote`, which stops audio). A 409
  with null active session means the claim lapsed (presence expired): claim again on the next tick
  when still playing, else `releaseAudio` silently.
- **Release.** When this tab holds audio and the player's resource becomes null, publish the
  release body (`claim: false`, `resource: null`) once, then `releaseAudio`. Pausing does not
  release; a paused active device stays active.
- **Stopping on loss (R2).** When role turns `remote` and the player holds a resource, call
  `useMediaPlayerClearNowPlaying()` (it pauses and empties the player). The store flips the role
  before the pause, so the write guards skip the pause write. A tab in the remote role holds no
  local item: area D renders the active device's state from the store.
- **Write guards (R52).** `crossDevicePlaybackStore.isLocalPlaybackWriteAllowed()` is checked
  synchronously at the start of the now-playing update, move-to-history, and Add by RSS
  position-save callbacks; when false they return without writing (server, anonymous snapshot,
  and handoff record alike).
- **Tabs.** Audio-tab heartbeat every 5 s while holding audio, carrying this tab's claim time
  (unchanged across heartbeats). An `audio-tab` message counts as newer when its `claimedAtMs` is
  greater than this tab's claim time, or equal with a larger `tabId`.
- **A closing audio tab.** On `pagehide` the audio tab sends `audio-tab-gone` with its last body
  set to `status: 'paused'`. The leader, when it receives that and this session is the active
  device, publishes that body with `claim: false`. With no other tab open, the session leaves
  presence on its own after the TTL (plan 12).
- **Leader reconciliation.** Every 5 s the leader checks: this session is active, the state's
  status is `playing` or `loading`, no tab of this session holds audio (no `audio-tab` message for
  12 s and this tab does not hold audio). Then it publishes the state paused at the estimated
  position with `claim: false`. This covers a reloaded or crashed audio tab. Skipped when the tab
  channel is unavailable (every tab is on its own then).
- **Last focused tab.** Each tab sends `tab-focused` on `focus` and on `visibilitychange` to
  visible, and records its own focus (`noteFocusedTab(tabId)`). At start, a tab that is visible and
  has focus (`document.hasFocus()`) records and announces itself. On `pagehide` every tab sends
  `tab-gone`; a tab receiving it calls `noteFocusedTab(null)` when the departed tab was the last
  focused one. Plan 24 uses it to pick the tab that takes over.

## `crossDevicePlaybackCheckIn.ts`

Framework-free loop, unit-tested with fakes:

```typescript
export function startPlaybackCheckInLoop(options: {
  store: CrossDevicePlaybackStore;
  checkIn: () => Promise<PlaybackPresenceResponse>;
  isLeader: () => boolean;
  now?: () => number;
  setTimer?: (callback: () => void, ms: number) => number;
  clearTimer?: (id: number) => void;
}): { stop(): void; checkInNow(): void };
```

It runs while the provider says the stream is open: one check-in at start, then every interval
while `isLeader()` (or until the first success for a follower). It applies results with
`store.applyPresenceResponse(response, now())`, maps errors as in **Availability**, owns the 5 s
`pending` timer, and never has two check-ins in flight. `checkInNow` runs one at once (plans 23–25
call it after `playback_no_active_device` or `playback_device_not_connected`).

## `playbackClaim.ts`

The publish request and its outcome handling, framework-free:

```typescript
export type PlaybackPublishOutcome =
  | { kind: 'published' }
  | { kind: 'lost' }
  | { kind: 'lapsed' }
  | { kind: 'retry' }
  | { kind: 'unavailable' };

export async function publishPlaybackState(params: {
  store: CrossDevicePlaybackStore;
  body: PlaybackStatePublishBody;
  publish: (body: PlaybackStatePublishBody) => Promise<PlaybackStatePublishResponse>;
}): Promise<PlaybackPublishOutcome>;
```

On success: `applyOwnPublish`, and for a claim `confirmClaim`. 409 not-active with a string active
id → `releaseAudio`, `lost`. 409 with null → `lapsed`. 403 → `markUnavailable`, `unavailable`.
Anything else → `retry`. The publisher counts retries and lapses.

## `CrossDevicePlayback.tsx`

```typescript
type CrossDevicePlaybackContextValue = {
  store: CrossDevicePlaybackStore;
  /** Runs one check-in now; no-op unless the stream is open. */
  checkInNow: () => void;
};

export function CrossDevicePlaybackProvider({ children }: { children: ReactNode }): JSX.Element;
export function useCrossDevicePlayback(): CrossDevicePlaybackContextValue;
/** Re-renders only when the selected value changes (`useSyncExternalStore` plus `Object.is`). */
export function useCrossDevicePlaybackSnapshot<T>(select: (snapshot: CrossDevicePlaybackSnapshot) => T): T;
```

`useCrossDevicePlaybackSnapshot` reads the module singleton directly, not the context, so it works
outside the provider (the provider's own hooks, unit tests). Selectors return primitives or
objects held in the snapshot, never new objects, so `Object.is` holds. The server snapshot
(`getServerSnapshot`) is the store's initial snapshot (`availability: 'off'`, role `idle`).

The provider uses the module singleton `crossDevicePlaybackStore` so the save hooks can read it
without context. It:

1. Calls `store.reset({ accountId: loggedInAccount?.id ?? null, enabled })` when the account id or
   `enabled` changes (`enabled` = logged in and not an embed route).
1. Subscribes to `subscribeToPlaybackStream` → `store.applyStreamEvent`.
1. Calls `store.setStream({ open: notificationStreamStatus === 'open', isLeader: notificationStreamIsLeader })`.
1. Runs `startPlaybackCheckInLoop` while the stream is open and availability is not `off`;
   restarts it after a 403 when `loggedInAccount` changes identity.
1. Starts `startPlaybackTabChannel` per account (`createChannel: typeof BroadcastChannel ===
   'function' ? (name) => new BroadcastChannel(name) : null`) and routes messages to the store as in
   **Tabs**; owns the focus listeners, the heartbeat, `pagehide`, and leader reconciliation.
1. Runs the stop effect (**Stopping on loss**) with `useMediaPlayerClearNowPlaying`.
1. Renders `<CrossDevicePlaybackPublisher />`, then the `children` prop.

Keep the provider value stable (`useMemo`); it never holds the snapshot, so a store change does
not re-render the whole tree.

## `CrossDevicePlaybackPublisher.tsx`

A headless component rendered inside the provider, so current-time updates re-render only it. It
reads `useMediaPlayer()` (resource fields, `mpIsPlaying`, `mpShouldPlay`, `mpDuration`,
`mpPlaybackSpeed`), `useMediaPlayerCurrentTime().mpCurrentTime`, and
`useMediaPlayerControls().readCurrentTimeSeconds()` (preferred; falls back to `mpCurrentTime` when
it returns undefined). It builds the body with plan 21's `buildPlaybackStatePublishBody` and drives
`createPlaybackPublishScheduler`:

- `body` is a claim body (`claim: true`) while the claim trigger is met, an ordinary body
  (`claim: false`) while this tab holds audio, and null otherwise.
- The scheduler's `publish` calls `publishPlaybackState` with
  `getApiRequestService().reqAccountPlaybackPublishState`, then applies the outcome rules above.
- Release runs outside the scheduler (one direct publish) so the scheduler's null body does not
  swallow it.
- Returns null.

## `Providers.tsx`

Mount `<CrossDevicePlaybackProvider>` inside `<AutoQueueProvider>` and around `<ModalsProvider>`
(currently lines 91–97), so it sits under Account, Notifications, Queues, every MediaPlayer
context, and AutoQueue, and the modal layer can read it.

## Save hooks

At the top of the returned callback in each, before any other check:

```typescript
if (!crossDevicePlaybackStore.isLocalPlaybackWriteAllowed()) {
  return;
}
```

- `useQueueResourceUpdateNowPlaying.tsx`: the `updateNowPlaying` callback.
- `useQueueResourceMoveNowPlayingToHistory.tsx`: the returned callback.
- `useAddByRSSPositionSave.tsx`: `savePosition` and `handleEnded`.

## Must stay true

- Logged-out pages, embeds, and accounts without membership behave exactly as today.
- A tab never publishes unless it holds audio or has a claim in flight.
- At most one tab per browser profile holds audio once tab messages settle; two tabs never keep
  playing at once.
- A pause caused by losing the active role writes nothing.
- No check-in, publish, or tab message blocks first paint or awaits in render.

## Tests

Vitest:

- `crossDevicePlaybackCheckIn.test.ts`: first check-in at start sets ready; a follower stops
  after its first success, the leader keeps a 15 s cadence; 403 → unavailable and no further
  check-ins; a 503 before ready → unavailable, then a later success → ready; still pending at 5 s →
  unavailable; no overlap when a check-in is slow.
- `playbackClaim.test.ts`: success applies the publish and confirms a claim; 409 with another
  session releases audio; 409 with null returns `lapsed`; 403 marks unavailable.
- Save-hook tests (existing files, extend): with the store's role set to `remote` (drive
  `crossDevicePlaybackStore` through `reset`, `applyPresenceResponse`, and an event naming another
  session; `reset` in `afterEach`), each callback makes no request; with role `idle`, behavior is
  unchanged.

The provider and publisher wiring is covered by area D's Playwright specs.

## Release scratchpad

```markdown
## Web player becomes a cross-device playback device

- Surfaces: web
- Change: A logged-in web tab with an active membership checks in as a playback device while the
  account event stream is open. Starting playback makes that browser the active device and
  publishes its play state, position, and speed (at most every 10 s while playing, at once on
  pause, seek, speed, or item changes). When another device or another tab of the same browser
  starts playing, this tab stops its audio and clears its player, and stops writing queue and
  position updates. Tabs of one browser count as one device; the tab that last started playback
  holds the audio. Closing the playing tab marks playback paused.
- Who notices: members who play on more than one device or tab
- Operator steps: none; needs the account event stream and the playback routes deployed
```
