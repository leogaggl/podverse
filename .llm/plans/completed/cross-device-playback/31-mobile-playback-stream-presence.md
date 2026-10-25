**Cursor model:** Opus 5.5 · **Reasoning:** extra high

# 31 — Mobile playback events and presence

The phone joins the account's device list and keeps a live view of what plays elsewhere. This plan
routes `playback.*` events out of the account stream that realtime plan 40 built, checks in, and
tracks availability. It sends no state and obeys no command; plans 32–34 add those on the hook
this plan creates.

Before editing, confirm these exist, and stop and report if any is missing:

- Plan 30's `crossDevicePlaybackStore.ts` and `crossDevicePlaybackPolicy.ts`.
- Plan 13's `reqAccountPlaybackCheckIn`, `reqAccountPlaybackPublishState`,
  `reqAccountPlaybackSendCommand`, and `reqAccountPlaybackReportStartFailed` on
  `ApiRequestService` (`packages/helpers-requests/src/api/_request.ts`), and
  `parsePlaybackApiError`.
- Realtime plan 40's `apps/mobile/src/notifications/` files named under Files below, and
  `runWithMobileAuthRefresh`. This plan edits files that plan creates, not that plan.

## Rows

R60

## Runs after

30, realtime-banner-notifications 40

## Files

apps/mobile/src/notifications/notificationStreamClient.ts
apps/mobile/src/notifications/notificationStreamController.ts
apps/mobile/src/notifications/notificationStreamController.test.ts
apps/mobile/src/notifications/notificationStreamStore.ts
apps/mobile/src/data/repositories/crossDevicePlaybackRepository.ts
apps/mobile/src/data/repositories/index.ts
apps/mobile/src/playback/crossDevice/crossDevicePresenceController.ts
apps/mobile/src/playback/crossDevice/crossDevicePresenceController.test.ts
apps/mobile/src/playback/crossDevice/useCrossDevicePlayback.ts
apps/mobile/src/playback/PlaybackProvider.tsx
apps/mobile/src/sync/SyncProvider.tsx
apps/mobile/vitest.config.ts

## Decisions this plan fixes

- **One stream.** Playback events ride the account stream plan 40 opens. Nothing opens a second
  connection. The stream's run condition (`shouldRunNotificationStream`) is unchanged.
- **No background grace period (R60).** `NotificationsRuntime`'s `backgroundAudioActive` stays
  `usePlaybackIsPlaying()`. A phone in the background stays in the device list while it plays.
  When it pauses (locally or by a command), the stream closes and the phone leaves the list within
  `PLAYBACK_PRESENCE_LEAVE_GRACE_MS`. Its state stays on the server, paused at its last position
  with no active device, and any device can resume it (plan 12). The main alternative, keeping
  the stream open for a timed grace after pausing, was rejected: iOS suspends a backgrounded app
  within seconds of audio stopping, and Android does not fire JS timers in the background. The
  grace could not end on time, so the list would show a phone that cannot obey a command, or it
  would show no phone at all while the app reconnects in a loop.
- **Who takes part.** The feature runs when the person is signed in, their tier is known, the
  access tier allows `queue_history_sync` (the membership capability the server's playback routes
  require, plan 13), Offline Mode is off, and terms do not block account sync. A 403 on any
  playback route (`parseMembershipGateError`) latches it off until the access-tier answer changes
  or the person signs out. A device in Offline Mode neither claims nor loses the active role, as
  the 744 doc says.
- **Check-ins.** Only while the stream is `open`: one at once when it opens, then every
  `PLAYBACK_PRESENCE_CHECK_IN_INTERVAL_MS`. On Android a backgrounded phone's interval does not
  fire, so a native progress sample (about every 500 ms while audio plays, delivered from a native
  handler) also checks in when one is due. A phone in the background that is not playing has no
  open stream and does not check in. Plan 32 counts a successful state publish as a check-in,
  because the server refreshes presence on it.
- **Ready.** `ready` needs this session's id (only the presence response carries it) and a fresh
  view since the last `pending` (a snapshot or a presence response). The hub may fail to send a
  snapshot (plan 14), so the presence response alone is enough.

## Stream routing (realtime plan 40's files)

### `notificationStreamStore.ts`

Add a playback event channel beside `publishNotificationStreamEvent`:

```typescript
export function publishNotificationStreamPlaybackEvent(event: AccountPlaybackStreamEvent): void;
export function subscribeNotificationStreamPlaybackEvents(
  listener: (event: AccountPlaybackStreamEvent) => void
): () => void;
```

`resetNotificationStreamStore` leaves listeners subscribed, the same as the existing event channel.

### `notificationStreamController.ts`

Add `onPlaybackEvent: (event: AccountPlaybackStreamEvent) => void` to
`NotificationStreamConnectParams`. In `connectNow()`, pass a handler that first checks
`myAttempt === attempt` (as every other callback does) and then calls
`publishNotificationStreamPlaybackEvent(event)`. Playback events never move the connection to
`open`, raise `sessionMaxId`, or touch the unread count. Only `notification.state` opens.

### `notificationStreamClient.ts`

Add `onPlaybackEvent` to `OpenNotificationStreamParams`. In `readUntilEnd`, for each `event`
item: when `isAccountPlaybackStreamEventName(item.event)` (plan 10), call
`parseAccountPlaybackStreamEvent(item.event, item.data)` and pass a non-null result to
`onPlaybackEvent`. Otherwise keep the existing `parseAccountNotificationStreamEvent` path.
`onActivity()` still runs for every item. `NotificationsRuntime` spreads `params` into
`openNotificationStream`, so it needs no edit; if the implementation finds it lists fields one by
one, add `onPlaybackEvent` there and report it.

## `crossDevicePlaybackRepository.ts`

Follow `notificationsRepository.ts`: each method is
`requestWithMobileAuthRefresh(context, (apiRequestService) => apiRequestService.reqX(...))`.
Export it from `data/repositories/index.ts` beside `notificationsRepository`.

```typescript
export const crossDevicePlaybackRepository = {
  checkIn: (context: MobileAuthRequestContext): Promise<PlaybackPresenceResponse>,
  publishState: (context: MobileAuthRequestContext, body: PlaybackStatePublishBody): Promise<PlaybackStatePublishResponse>,
  sendCommand: (context: MobileAuthRequestContext, body: PlaybackCommandSendBody): Promise<PlaybackCommandSendResponse>,
  reportStartFailed: (
    context: MobileAuthRequestContext,
    params: { commandIdText: string; reason: PlaybackStartFailedReason }
  ): Promise<void>,
};
```

`reportStartFailed` calls `reqAccountPlaybackReportStartFailed({ commandIdText, body: { reason } })`.
No caching, no outbox: these are live signals, and a failed one is not replayed.

## `crossDevicePresenceController.ts` (pure, injected I/O)

```typescript
export type CrossDevicePresenceInputs = {
  /** Signed in, tier known, `queue_history_sync` allowed, Offline Mode off, terms not blocking. */
  featureEnabled: boolean;
  connection: NotificationStreamConnection;
};

export type CrossDevicePresenceControllerDeps = {
  checkIn: () => Promise<PlaybackPresenceResponse>;
  /** True for a 403 the membership gate parser recognizes. */
  isMembershipRefusal: (error: unknown) => boolean;
  now: () => number;
};

export function resolveCrossDevicePlaybackAvailability(params: {
  featureEnabled: boolean;
  refused: boolean;
  connection: NotificationStreamConnection;
  previous: CrossDevicePlaybackAvailability;
  hasFreshView: boolean;
  thisSessionIdText: string | null;
}): CrossDevicePlaybackAvailability;

export function createCrossDevicePresenceController(deps: CrossDevicePresenceControllerDeps): {
  setInputs: (inputs: CrossDevicePresenceInputs) => void;
  /** Snapshot, state, and devices events. Returns the applied state when a `playback.state` applied, else null. */
  applyStreamEvent: (event: AccountPlaybackStreamEvent) => DTOPlaybackState | null;
  /** A native progress sample: check in when one is due and the stream is open. */
  noteHeartbeat: () => void;
  /** A state publish succeeded, which refreshed presence on the server. */
  notePresenceRefreshed: () => void;
  /** A playback route answered 403 for membership. */
  noteMembershipRefusal: () => void;
  isRunning: () => boolean;
  dispose: () => void;
};
```

`resolveCrossDevicePlaybackAvailability`, in order:

1. `!featureEnabled || refused` → `off`.
1. `connection === 'idle'` → `off`.
1. `retrying` or `stopped` → `unavailable`.
1. `connecting` or `open`: `previous === 'ready'` → `ready`; `open` with a known session and a
   fresh view → `ready`; else `pending`.

Controller behavior (global `setInterval` / `setTimeout`; tests use Vitest fake timers):

- Keep `refused`, `hasFreshView`, `lastPresenceAtMs`, `checkInInFlight`, and the last inputs.
  After every input change, response, or event, compute the availability and call
  `setCrossDevicePlaybackAvailability` when it changed. Moving to `pending` from any other value
  sets `hasFreshView = false`.
- `featureEnabled` turning from false to true clears `refused`.
- `isRunning()` is `featureEnabled && !refused`.
- When the connection becomes `open` while running: check in at once, and start the interval.
  Leaving `open`, or stopping running, clears the interval. A check-in never runs while not
  `open`.
- A check-in is skipped while one is in flight. On success: `applyCrossDevicePlaybackPresence`,
  `hasFreshView = true`, `lastPresenceAtMs = now()`. On a membership refusal: `refused = true`.
  On any other error: `console.warn('[cross-device] check-in failed', error)`; keep the view and
  wait for the next tick.
- `noteHeartbeat()`: when open, running, nothing in flight, and `now() - lastPresenceAtMs >=
  PLAYBACK_PRESENCE_CHECK_IN_INTERVAL_MS`, check in. `notePresenceRefreshed()` sets
  `lastPresenceAtMs = now()`.
- `applyStreamEvent`: ignore everything while not running. `playback.snapshot` →
  `applyCrossDevicePlaybackSnapshot` and `hasFreshView = true`. `playback.devices` →
  `applyCrossDevicePlaybackDevices`. `playback.state` → `applyCrossDevicePlaybackState`, returning
  the state when it applied. `playback.command` and `playback.start_failed` return null here;
  plans 33 and 34 handle them in the hook.
- `dispose()` clears every timer and ignores responses that arrive later.

## `useCrossDevicePlayback.ts` (React Native)

```typescript
export function useCrossDevicePlayback(): void;
```

Plans 32–35 add parameters and a return value; keep the body organized so each later plan adds a
block. In this plan:

- Read `accessToken`, `account`, `clearSession`, `refreshToken`, `setTokens`, and `status` from
  `useAuth()` into a ref updated every render, and build a `MobileAuthRequestContext` from it for
  each request, as `NotificationsRuntime` does.
- `featureEnabled = status === 'authenticated' && accessToken !== null && isTierKnown &&
  canUse('queue_history_sync') && !offlineModeEnabled && !termsBlocked`, with `useAccessTier()`,
  `useOfflineMode().enabled`, and `termsBlocksAccountSync()` / `subscribeTermsBlocksAccountSync`
  from `terms/termsSyncGate.ts`.
- `connection` from `useSyncExternalStore(subscribeNotificationStreamConnection,
  getNotificationStreamConnection)`.
- Create the controller once with `useRef`. Deps: `checkIn` via
  `crossDevicePlaybackRepository.checkIn`, `isMembershipRefusal: (error) =>
  parseMembershipGateError(error) !== null`, `now: Date.now`. Dispose on unmount.
- An effect calls `setInputs({ featureEnabled, connection })` whenever either changes.
- Subscribe once to `subscribeNotificationStreamPlaybackEvents` and pass each event to
  `applyStreamEvent`.
- Subscribe once to `subscribePlaybackProgress` from `../playbackProgressStore` and call
  `noteHeartbeat()`. That listener only compares two numbers; it renders nothing, so it is not the
  ticking-state subscription the row rules forbid.

## `PlaybackProvider.tsx`

Call `useCrossDevicePlayback()` once in `PlaybackProvider`, directly above
`const sessionValue = useMemo<PlaybackSessionContextValue>(`. Nothing else changes in this plan.

## `SyncProvider.tsx`

In the `status === 'anonymous'` effect, call `resetCrossDevicePlaybackStore()` beside
`resetNotificationStreamStore()`. The device list and the other device's state are account data.

## `apps/mobile/vitest.config.ts`

Add `crossDevicePresenceController.test.ts` to `include` and a clause to the header comment ("the
cross-device presence rules — availability, check-in timing on the stream and on progress
samples, and the membership latch (`src/playback/crossDevice/crossDevicePresenceController.ts`)").

## Tests

- `crossDevicePresenceController.test.ts` (fake timers, fake `checkIn`, store reset per test):
  - Availability table: feature off, refused, `idle` → `off`; `retrying`/`stopped` →
    `unavailable`; `connecting` from `off` → `pending`; `open` with a presence response → `ready`;
    `ready` stays `ready` through `connecting`; back to `pending` after `off` needs a new presence
    or snapshot before `ready`.
  - Opening checks in at once and then every 15 s; leaving `open` stops the interval; no check-in
    while `connecting`.
  - `noteHeartbeat` checks in only when 15 s have passed since the last presence and the stream
    is open; `notePresenceRefreshed` pushes the next one out.
  - A membership refusal turns availability `off` and stops check-ins; turning the feature off and
    on again clears it.
  - A non-membership failure keeps the view and retries on the next tick.
  - Events are ignored while not running; a state event returns the applied state; an older state
    returns null.
- `notificationStreamController.test.ts`: add a case that a playback event from the current
  attempt is published to the playback channel and does not open the connection, and that one
  from an aborted attempt is dropped.

## Release scratchpad

```markdown
## Mobile joins the cross-device device list

- Surfaces: mobile
- Change: a signed-in member's phone checks in to cross-device playback over the account event
  stream and keeps a live view of what plays on their other devices. It appears in the device list
  while the app is open, or in the background while it plays audio, and leaves within about five
  seconds after it pauses in the background. Offline Mode and a lapsed membership keep it out.
- Who notices: members with the web app open on another device see the phone in its device list
- Operator steps: none
```
