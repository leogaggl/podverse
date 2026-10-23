**Cursor model:** Opus 5.5 · **Reasoning:** extra high

# 40 — Mobile notification stream runtime

The mobile app holds plan 12's `GET /account/events` open while it is signed in and either in
the foreground or playing audio. It closes the stream in the background once audio is not
playing. A stream that stayed open through the background is kept when the app returns to the
foreground. Every stream event updates one in-memory notification store. The Notifications tab badge reads that store instead of polling.
The store also carries the in-app event channel that the inbox (plan 42) and the banner
notification (area E, plans 50–59) subscribe to. The 60-second unread-count poll runs only while
the stream is not open.

Other work is landing in the tree. Before editing, confirm these still exist and adjust anchors if
they moved:

- `useNotificationsUnreadCount` and `emitNotificationsReadEvent` in
  `apps/mobile/src/hooks/useNotificationsUnreadCount.ts`.
- `TabScaffold` and its `PlaybackE2eStatus` mount in `apps/mobile/src/navigation/index.tsx`.
- `loadFirstPageAndMarkRead` in `apps/mobile/src/screens/notifications/NotificationsInboxScreen.tsx`.
- `requestWithMobileAuthRefresh`, `withNetworkOutcomeReported`, and
  `AccessTokenRefreshUnavailableError` in `apps/mobile/src/auth/authRequestWithRefresh.ts`.
- The `status === 'anonymous'` reset effect in `apps/mobile/src/sync/SyncProvider.tsx`.
- `AppBody` in `apps/mobile/App.tsx`.
- `parseAccountNotificationStreamEvent` and `ACCOUNT_EVENTS_STREAM_API_PATH`, exported from
  `@podverse/helpers` by plan 10.
- `usePlaybackIsPlaying` in `apps/mobile/src/playback/PlaybackProvider.tsx`, and
  `<PlaybackProvider>` still wrapping `<AppBody>` in `App.tsx`.

## Rows

R2, R19, R24, R27, R38, R40, R44, R45

## Runs after

10, 12

## Files

apps/mobile/src/notifications/sseEventParser.ts
apps/mobile/src/notifications/sseEventParser.test.ts
apps/mobile/src/notifications/notificationStreamPolicy.ts
apps/mobile/src/notifications/notificationStreamPolicy.test.ts
apps/mobile/src/notifications/notificationStreamStore.ts
apps/mobile/src/notifications/notificationStreamStore.test.ts
apps/mobile/src/notifications/notificationStreamController.ts
apps/mobile/src/notifications/notificationStreamController.test.ts
apps/mobile/src/notifications/notificationStreamClient.ts
apps/mobile/src/notifications/NotificationsRuntime.tsx
apps/mobile/src/notifications/NotificationStreamE2eStatus.tsx
apps/mobile/src/auth/authRequestWithRefresh.ts
apps/mobile/src/hooks/useNotificationsUnreadCount.ts
apps/mobile/src/screens/notifications/NotificationsInboxScreen.tsx
apps/mobile/src/navigation/index.tsx
apps/mobile/src/sync/SyncProvider.tsx
apps/mobile/App.tsx
apps/mobile/vitest.config.ts
apps/mobile/e2e/notifications-inbox.yaml
apps/mobile/APPS-MOBILE.md
release-notes/scratchpad.md

## Answers to the request's questions

- **R2, what happens today on mobile when a notification arrives with the app open?** Nothing
  the user can see at that moment. `notificationRouting.ts` registers only a response (tap)
  listener and no `setNotificationHandler`, so expo-notifications does not present a push that
  arrives in the foreground. UnifiedPush has no receive path yet. The Notifications tab badge
  changes only on the 60-second poll in `useNotificationsUnreadCount`, on that hook's focus
  effect, or after the inbox marks everything read. The More screen's Notifications row has no
  badge. Notifications is not a visible tab in the factory layout (`DEFAULT_VISIBLE_TABS`), so in
  that layout no indicator is visible anywhere.
- **R19, can a foreground app hold a reliable connection?** Yes. A foreground app keeps its
  sockets on iOS and Android, and `expo/fetch` streams a response body on both platforms with no
  read timeout (`readTimeout(0)` on Android's OkHttp client, `timeoutInterval = 0` on iOS). What
  breaks a connection is the network itself (a radio change, a proxy, the server ending the stream
  at token expiry or 30 minutes). The client treats every break as normal and reconnects. A
  heartbeat watchdog catches a connection that went silent without closing. In the background the
  connection holds only while audio plays, and the OS may still cut it (§ Background audio).

## Background audio (R44)

Another signed-in device must be able to reach a phone that is playing with its screen locked,
so the stream also runs in the background while local audio plays. The cross-device playback set
uses this stream for remote pause and play. This set only keeps the connection open.

### Where mobile knows audio is playing

`setPlaybackPlaying` in `PlaybackProvider.tsx` is the one writer of play state. It sets
`isPlayingRef`, `writeIsPlayingLocallyForSync`, `setPlaybackProgressPlaying`, and the
`isPlaying` React state behind `PlaybackIsPlayingContext`. The engine's `playing`, `paused`,
`ended`, and `error` state events call it, so a pause from the lock screen, the notification
shade, a car, or an audio interruption reaches it whenever JS is running. `reconcileFromNative`
runs again on every return to `active`.

- `playbackProgressStore.ts` keeps `playing` private. `setPlaybackProgressPlaying` notifies no
  one, and `subscribePlaybackProgress` fires on position and duration changes, once a second
  while playing. It cannot tell the runtime about a play or pause, and a once-a-second listener
  is the high-frequency channel a coarse consumer must not use
  (**mobile-progress-ux-and-notification-channels**).
- `playbackSyncState.ts` has a getter and no subscription.
- `usePlaybackIsPlaying()` changes only on play and pause, and `AppBody` renders inside
  `<PlaybackProvider>`. The runtime reads it. No playback file changes.

The runtime passes that value to the pure policy as one named input, `backgroundAudioActive`. A
later change can widen what counts as background audio, for example a grace period after a
remote pause. It changes how the runtime computes that one boolean. The policy and the
controller stay the same.

### Does JS keep running in the background?

- **iOS.** `UIBackgroundModes` in `apps/mobile/app.config.ts` includes `audio`. While the audio
  session plays, iOS does not suspend the process. React Native keeps JS timers firing in the
  background through a sleep timer (`appDidMoveToBackground` and `scheduleSleepTimer` in
  `RCTTiming.mm`). `expo/fetch` keeps reading (`ExpoURLSessionTask.swift` sets
  `timeoutInterval = 0`). Once audio stops, iOS suspends the app within seconds.
- **Android.** The media engine's Media3 service runs as a media-playback foreground service
  while it plays (`FOREGROUND_SERVICE_MEDIA_PLAYBACK` in `app.config.ts`), so the process keeps
  foreground priority. OkHttp reads the body on its own thread and hands chunks to JS. Native
  events (stream chunks, player state, settled promises) still run JS. React Native's
  `JavaTimerManager` stops JS timers on `onHostPause`, though, unless a headless JS task is
  running. The media engine's only headless task is the car sync service, which does not run
  during ordinary playback. So while the app is in the background on Android, `setTimeout` and
  `setInterval` do not fire: the open timeout, the idle watchdog, the retry backoff, and the poll
  wait until the app returns. Event delivery does not need a timer, and neither does the
  reconnect after a healthy clean end (mobile access tokens last 900 seconds, so the server ends
  the stream about every 15 minutes) or the stop when audio pauses.

### If the OS still suspends or freezes the stream

- While frozen, the app receives nothing. It is in the background, so OS push shows the
  notification, as when the stream is closed. The server's heartbeat writes fail once the socket
  is gone, or the token-expiry or 30-minute end closes the stream. Either way it leaves the
  per-account count.
- On iOS, a pause normally reaches JS before the suspension and stops the stream. When it does
  not, the next return to the foreground cleans up.
- On return to the foreground the controller checks the wall-clock time since the stream last
  sent any bytes, with no timer involved (`resumeForeground`, below). A connection that is not
  `open`, or that has been silent for `NOTIFICATION_STREAM_IDLE_TIMEOUT_MS` (two missed
  heartbeats) or longer, counts as closed. The session ends and a fresh one opens with no
  `Last-Event-ID`. This also covers an Android retry that waited in the background with its
  timer frozen.
- A connection that was silent for less than that is kept. If its socket did die, the read
  rejects or the idle watchdog fires within 60 seconds, and the ordinary reconnect sends
  `Last-Event-ID`. That replay can repeat a notification the OS already showed by push, inside
  that one-minute window. This is accepted.

## Decisions this plan fixes

- **Transport is `expo/fetch` streaming.** It is already installed with Expo SDK 58, needs no
  native rebuild, has no read timeout, and supports `AbortController`. Do not add an SSE or
  EventSource package. The repo rule against raw `fetch()` exists so ordinary requests share the
  axios helpers. axios in React Native cannot stream a response body, so this file is the
  exception. Say so in a one-line comment at the import.
- **A session opens fresh.** A session runs from the controller's `start()` to its `stop()`. It
  may span time in the background while audio plays. The first connection of a session sends no
  `Last-Event-ID`. That covers a cold start, a sign-in, and a return to the foreground after the
  stream closed. Reconnects inside the same session send the highest notification id received in
  that session. Notifications created while the stream was closed were delivered by OS push.
  Replaying them would repeat them in the inbox stream and as banners. The badge comes from
  `notification.state` on every connection. The inbox refetches from a `resync` app event that
  the controller publishes on each fresh open.
- **A return to the foreground keeps a stream that stayed open (R45).** When the session stayed
  started through the background and its connection is `open` and recently active, the
  connection is kept: no new connection, no replay, no `resync`, and no unread-count refetch. The
  kept stream delivered every count change while in the background, so there is no gap for
  R38's refetch to cover. An HTTP count that started before a live event could also land after
  it and show an older number. In every other case the session restarts and the fresh-open rule
  above applies, and its `notification.state` is R38's refetch. The test is
  `notificationStreamForegroundReturnAction` in the policy.
- **The stream is the only in-app source of new-notification events.** Foreground pushes stay
  unpresented. Do not add `setNotificationHandler` or a received listener. Nothing needs
  deduplicating between pushes and stream events. Stream events themselves are deduplicated by
  notification id within a session, because a reconnect can replay an id that arrived out of order.
- **Lifecycle (R24, R44).** The stream runs while every one of these holds: auth
  `status === 'authenticated'`, `accessToken !== null`, the app is active **or** local audio is
  playing (`backgroundAudioActive`), Offline Mode is off, and `termsBlocksAccountSync()` is false.
  A null `getMobileConfig().api` is handled in the client, which fails the connect as
  `poll_only`. The pure `shouldRunNotificationStream` in the policy owns this condition, and the
  runtime only gathers its inputs. On `AppState` `background` the stream closes when audio is not
  playing, and stays open when it is. When audio stops while the app is in the background, the
  stream closes. It stays open on `inactive` (Control Center, an incoming-call sheet). A token
  refresh never restarts the stream; the run condition reads `accessToken !== null`, not the
  token value.
- **Failure handling** follows plan 12's contract:
  - 401 after the auth gate is final; the gate has already refreshed once or cleared the session.
  - 403, 404, and 429 stop reconnecting for the rest of the session, and the poll runs. A return
    to the foreground restarts a stopped session once (`resumeForeground`). One attempt per
    return cannot loop.
  - Anything else retries with backoff, and the poll runs while the stream is down.
- **The poll runs only while the stream is not open (R40).** Every connection's
  `notification.state` event is the "refetch the unread count once" on reconnect and foreground
  (R38). When an attempt fails, the controller fetches the unread count over HTTP once at once,
  then every 60 seconds until a connection opens.
- **The stream and the poll are not sync-queue jobs.** The unread poll never was. Neither runs
  before first paint. Both start from an effect after the shell renders. This matches
  **mobile-sync-orchestration**: nothing network-bound blocks first paint, and a live channel is
  not reconciliation work.
- **Account scope.** The store holds account data. `resetNotificationStreamStore()` runs in the
  `status === 'anonymous'` effect in `SyncProvider.tsx` (**mobile-account-scoped-data**). The
  controller also stops when status leaves `authenticated`, and a late event from an aborted
  attempt is dropped by an attempt counter.

## Modules

All new runtime files go in a new directory, `apps/mobile/src/notifications/`. Keep the parser,
policy, store, and controller free of React Native and Expo imports so they run in the node
Vitest suite. Only `notificationStreamClient.ts`, `NotificationsRuntime.tsx`, and
`NotificationStreamE2eStatus.tsx` import React Native or Expo.

### `sseEventParser.ts` (pure)

An incremental parser for the SSE wire format. `createSseEventParser()` returns
`{ push(chunk: string): SseParsedItem[]; }`, where:

```typescript
export type SseParsedItem =
  | { kind: 'event'; event: string; data: string; id: string | null }
  | { kind: 'comment' }
  | { kind: 'retry'; ms: number };
```

Rules, per the SSE spec:

- Buffer partial lines across chunks.
- Accept `\n`, `\r\n`, and `\r` line endings.
- A line starting with `:` yields `{ kind: 'comment' }`.
- Fields are `event`, `data`, `id`, and `retry`. Strip one leading space after the colon.
- Several `data` lines join with `\n`.
- A blank line dispatches the pending event only when at least one `data` line arrived. The
  event name defaults to `message`.
- `retry` with a digits-only value yields `{ kind: 'retry' }`.
- Ignore unknown fields.
- `id` applies to the event it is in.

The controller ignores `retry`; the backoff ladder below owns reconnect timing.

### `notificationStreamPolicy.ts` (pure)

```typescript
export const NOTIFICATION_STREAM_RETRY_DELAYS_MS = [1_000, 2_000, 5_000, 10_000, 30_000] as const;
/** No state event this long after a connect starts: abort and retry. */
export const NOTIFICATION_STREAM_OPEN_TIMEOUT_MS = 15_000;
/** No bytes this long: the connection went silent without closing. Over two missed 25 s heartbeats. */
export const NOTIFICATION_STREAM_IDLE_TIMEOUT_MS = 60_000;
/** A connection that stayed open this long and then ended cleanly reconnects at once. */
export const NOTIFICATION_STREAM_HEALTHY_OPEN_MS = 10_000;
export const NOTIFICATION_UNREAD_POLL_INTERVAL_MS = 60_000;
/** Ids remembered per session to drop a replayed duplicate. */
export const NOTIFICATION_STREAM_SEEN_ID_LIMIT = 200;

export class NotificationStreamHttpError extends Error {
  readonly response: { status: number };
  // name 'NotificationStreamHttpError'; `response.status` lets getErrorResponseStatus and
  // classifySyncError read it like an axios error.
}

export type NotificationStreamFailureKind = 'final' | 'poll_only' | 'retry';
export function classifyNotificationStreamFailure(error: unknown): NotificationStreamFailureKind;
export function notificationStreamRetryDelayMs(failureCount: number, random: () => number): number;
export function createSeenNotificationIds(limit: number): {
  /** False when the id was already seen; records it otherwise. */
  add(id: number): boolean;
  clear(): void;
};

export type NotificationStreamRunInputs = {
  /** `status === 'authenticated'` and an access token is present. */
  signedIn: boolean;
  /** The app is in the foreground. `inactive` leaves the previous value. */
  appActive: boolean;
  /**
   * Local audio is playing. While true, the stream stays open in the background. Widening what
   * counts as background audio widens the run condition without a policy or controller change.
   */
  backgroundAudioActive: boolean;
  offlineModeEnabled: boolean;
  termsBlocksAccountSync: boolean;
};

export function shouldRunNotificationStream(inputs: NotificationStreamRunInputs): boolean;

export type NotificationStreamForegroundReturnAction = 'keep' | 'restart';

/**
 * The app returned to the foreground while the session stayed started. Keep a connection that
 * is open and was recently active; restart the session otherwise.
 */
export function notificationStreamForegroundReturnAction(params: {
  connection: NotificationStreamConnection;
  /** Wall-clock ms since the stream last sent any bytes, or null when it never has. */
  msSinceActivity: number | null;
}): NotificationStreamForegroundReturnAction;
```

Import `NotificationStreamConnection` with `import type` from `./notificationStreamStore`.

- `shouldRunNotificationStream`: `signedIn && (appActive || backgroundAudioActive) &&
  !offlineModeEnabled && !termsBlocksAccountSync`.
- `notificationStreamForegroundReturnAction`: `'keep'` only when `connection === 'open'`,
  `msSinceActivity !== null`, and `msSinceActivity < NOTIFICATION_STREAM_IDLE_TIMEOUT_MS`.
  Anything else is `'restart'`.
- `classifyNotificationStreamFailure`: read the status with `getErrorResponseStatus` from
  `@podverse/helpers/error`. 401 → `final`. 403, 404, 429 → `poll_only`. Any other status, or no
  status → `retry`.
- `notificationStreamRetryDelayMs(n)`: index `min(n - 1, last)` of the ladder, scaled by a jitter
  factor from 0.8 to 1.2 (`0.8 + random() * 0.4`), rounded.
- `createSeenNotificationIds`: a `Set` plus insertion-order eviction past the limit.

### `notificationStreamStore.ts` (pure)

This is the module that the inbox (plan 42), the badges (plan 43), and the banner (area E) read.
It holds module-level state with listener sets, the same shape as `downloadStore.ts` but smaller.
It does no coalescing; events are rare.

```typescript
export type NotificationStreamConnection = 'idle' | 'connecting' | 'open' | 'retrying' | 'stopped';

export type NotificationStreamAppEvent =
  | { type: 'created'; notification: DTOAccountNotification; unreadCount: number }
  | { type: 'read'; scope: 'all'; lastReadAt: string; unreadCount: number }
  | { type: 'read'; scope: 'one'; notificationId: number; unreadCount: number }
  /** Rows may have been missed: a fresh open, or the server's replay limit. Refetch lists. */
  | { type: 'resync' };

export function getNotificationUnreadCount(): number;
/** Clamps to a non-negative integer; notifies only when the value changes. */
export function setNotificationUnreadCount(count: number): void;
export function subscribeNotificationUnreadCount(listener: () => void): () => void;

export function getNotificationStreamConnection(): NotificationStreamConnection;
export function setNotificationStreamConnection(next: NotificationStreamConnection): void;
export function subscribeNotificationStreamConnection(listener: () => void): () => void;

export function publishNotificationStreamEvent(event: NotificationStreamAppEvent): void;
export function subscribeNotificationStreamEvents(
  listener: (event: NotificationStreamAppEvent) => void
): () => void;

/** The inbox calls this on focus and the returned function on blur. Counts, so two mounts nest. */
export function markNotificationsInboxFocused(): () => void;
export function isNotificationsInboxFocused(): boolean;

/** Session end: unread count 0, connection idle. Listeners and inbox focus stay. */
export function resetNotificationStreamStore(): void;
```

Import `DTOAccountNotification` with `import type` from `@podverse/helpers`.

- A listener that throws is caught and logged with `console.warn`, so one subscriber cannot break
  the others.
- The release function from `markNotificationsInboxFocused` is idempotent.

### `notificationStreamController.ts` (pure, injected I/O)

```typescript
export type NotificationStreamConnectParams = {
  lastEventId: number | null;
  signal: AbortSignal;
  onEvent: (event: AccountNotificationStreamEvent) => void;
  /** Any bytes: an event, a heartbeat comment, or a retry line. */
  onActivity: () => void;
};

export type NotificationStreamControllerDeps = {
  /**
   * Opens the stream and reads until the server ends it. Rejects with NotificationStreamHttpError
   * for a non-2xx status, or with the transport error.
   */
  connect: (params: NotificationStreamConnectParams) => Promise<void>;
  fetchUnreadCount: () => Promise<number>;
  now: () => number;
  random: () => number;
};

export function createNotificationStreamController(deps: NotificationStreamControllerDeps): {
  start: () => void;
  stop: () => void;
  /** The app returned to the foreground. Keeps a live connection; restarts the session otherwise. */
  resumeForeground: () => void;
};
```

Behavior. Use the global `setTimeout` / `setInterval`; tests use Vitest fake timers. On Android
those timers do not fire while the app is in the background (§ Background audio), so nothing that
must happen in the background may wait on one. `resumeForeground` reads `now()`, not a timer.

- **`start()`** while stopped begins a session: clear the seen ids, set `sessionMaxId = null`,
  `lastActivityAt = null`, `failures = 0`, `refetchedSinceOpen = false`, then `connectNow()`.
  Calling it while already started does nothing.
- **`stop()`** ends the session:
  - increment `attempt`;
  - abort the current `AbortController`;
  - clear the retry, open-timeout, idle, and poll timers;
  - set the connection to `idle`.

  A later `start()` is a fresh open, with no `Last-Event-ID`.
- **`resumeForeground()`**: when the session is not started, do nothing; the runtime's run effect
  starts it. Otherwise call `notificationStreamForegroundReturnAction` with the store's
  connection and `lastActivityAt === null ? null : now() - lastActivityAt`. On `'keep'`, do
  nothing: no new connection, no `resync`, and the attempt counter is unchanged. On `'restart'`,
  call `stop()` then `start()`.
- **`connectNow()`**:
  - capture `const myAttempt = ++attempt` and set the connection to `connecting`;
  - arm the open timeout and make sure the poll timer is running (below);
  - call `connect({ lastEventId: sessionMaxId, ... })`;
  - every callback and settle path first checks `myAttempt === attempt`, and returns otherwise.
- **`onActivity`** sets `lastActivityAt = now()` and re-arms the idle timer.
- **Events:**
  - `notification.state`:
    - On the first state of an attempt: set the connection to `open`, record `openedAt`, clear
      the open timeout and the poll timer, set `failures = 0` and `refetchedSinceOpen = false`.
    - If this is the session's first open, publish `{ type: 'resync' }`.
    - Always set the unread count from the event.
  - `notification.created`:
    - Skip it when the seen ids already hold `notification.id`.
    - Otherwise raise `sessionMaxId` to `max(sessionMaxId, id)`, set the unread count, then
      publish `created`.
  - `notification.read`: set the unread count, then publish `read` with the matching scope.
  - `notification.resync`: publish `{ type: 'resync' }`.
- **Clean end** (`connect` resolved):
  - If the attempt reached `open` and `now() - openedAt >= NOTIFICATION_STREAM_HEALTHY_OPEN_MS`,
    reconnect at once.
  - Otherwise handle it as a `retry` failure.
- **Open timeout or idle timeout:** abort this attempt's controller and handle it as a `retry`
  failure.
- **Rejection** (when not aborted by `stop()` or by a timeout already handled):
  - `final`: set the connection to `stopped`. Clear the poll timer. No reconnect.
  - `poll_only`: set the connection to `stopped`, refetch once (below), and keep the poll timer
    running. No reconnect until the next `start()`.
  - `retry`: set the connection to `retrying` and refetch once. Increment `failures` and schedule
    `connectNow()` after `notificationStreamRetryDelayMs(failures, deps.random)`. The poll timer
    keeps running.
- **Refetch once:** when `refetchedSinceOpen` is false, set it true and call
  `fetchUnreadCount()`. Apply the result with `setNotificationUnreadCount` only if the attempt is
  still current; log failures with `console.warn`.
- **Poll timer:** a `setInterval` at `NOTIFICATION_UNREAD_POLL_INTERVAL_MS` that does the same
  guarded fetch. It runs while the session is started and the connection is not `open`, except
  after a `final` failure. It is cleared on open, on `final`, and on `stop()`.

### `notificationStreamClient.ts` (React Native)

`openNotificationStream(params)` returns `{ readUntilEnd(): Promise<void> }` once the response
headers arrive with a 2xx status. Splitting open from read lets the auth wrapper below cover only
the open.

```typescript
type OpenNotificationStreamParams = {
  accessToken: string | null;
  lastEventId: number | null;
  signal: AbortSignal;
  onEvent: (event: AccountNotificationStreamEvent) => void;
  onActivity: () => void;
};
```

- **URL:** `${api.baseUrl.replace(/\/$/, '')}${ACCOUNT_EVENTS_STREAM_API_PATH}`, with
  `api` from `getMobileConfig().api` read at call time, so a custom API address applies. Throw
  `NotificationStreamHttpError(404)` when `api` is null; that classifies as `poll_only`, and the
  poll fails quietly the same way every other request does.
- **Request:**
  - `fetch` from `'expo/fetch'`, with `method: 'GET'`, `credentials: 'omit'`, and `signal`.
  - Headers: `Accept: text/event-stream` and `Cache-Control: no-cache`.
  - `Authorization: Bearer <token>` when the token is non-null.
  - `Last-Event-ID` when `lastEventId !== null`.
  - The client headers from `buildMobileClientHeaders(Constants.expoConfig?.version, Platform.OS)`,
    the same pair `createMobileApiRequestService` sends.
- **Bad response:** when it is not ok, cancel the body and throw `NotificationStreamHttpError`
  with the status. When the body is null, throw an `Error`.
- **`readUntilEnd`:** take `response.body.getReader()`, decode with the global `TextDecoder`
  (Expo's runtime installs it) using `{ stream: true }`, and push into `createSseEventParser()`.
  For each item:
  - call `onActivity()`;
  - for `event` items, `parseAccountNotificationStreamEvent(item.event, item.data)`, and call
    `onEvent` when the result is not null.

  Resolve when the reader reports done. Let an abort reject, and always release the reader lock
  in `finally`.

### Auth wrapper (`authRequestWithRefresh.ts`)

Extract the body of `requestWithMobileAuthRefresh` into:

```typescript
/**
 * The refresh-once-then-clear rules for any bearer call. `send` receives the access token to use
 * and must reject with a value whose `response.status` is 401 when the server refuses it.
 */
export const runWithMobileAuthRefresh = async <T>(
  deps: AuthRequestDeps,
  send: (accessToken: string | null) => Promise<T>
): Promise<T>
```

Its body is today's `requestWithMobileAuthRefresh`, with each `sendWithAccessToken(token,
runRequest)` replaced by `withNetworkOutcomeReported(() => send(token))`. Then
`requestWithMobileAuthRefresh` becomes a call to `runWithMobileAuthRefresh` whose `send` builds
the service with `createMobileApiRequestService(token)`. It throws the existing
`'Mobile API base URL is not configured'` error when that returns null, then runs `runRequest`.
Behavior for every existing caller is unchanged. Remove `sendWithAccessToken` only if nothing
else uses it. Export `AccessTokenRefreshUnavailableError`.

Every 401 path here still ends in valid credentials or `clearSession`
(**mobile-auth-refresh-terminates**). The stream gets that for free.

### `NotificationsRuntime.tsx` (React Native)

A component that renders `null`. Mount it once in `App.tsx` `AppBody`, inside the
`status === 'unknown' ? null : (…)` branch, directly before `<ForcedLogoutNotice />`.

- **Auth:** read `accessToken`, `clearSession`, `refreshToken`, `setTokens`, and `status` from
  `useAuth()`. Keep them in a ref updated every render, so `connect` reads the latest auth deps.
- **App state:** track `isAppActive` with `AppState.addEventListener('change', …)`. Start from
  `AppState.currentState !== 'background'`. `active` sets true, `background` sets false, and
  `inactive` leaves the value unchanged. Keep the last value in a ref as well. When `active`
  arrives and the ref was false (a return from the background), call
  `controllerRef.current.resumeForeground()` in the same handler. When the session had stopped,
  that does nothing, and the run effect's `start()` opens fresh once `isAppActive` turns true.
- **Background audio:** `const backgroundAudioActive = usePlaybackIsPlaying();` from
  `../playback/PlaybackProvider` (§ Background audio). Keep the name: this is the one input a
  later change widens.
- **Offline Mode:** read `useOfflineMode().enabled` from `apps/mobile/src/prefs/offlineMode.ts`.
- **Terms:** track `termsBlocksAccountSync()` with `subscribeTermsBlocksAccountSync`, as
  `SyncProvider` does.
- **Controller:** create it once with `useRef`. Its deps:
  - `connect`: call `runWithMobileAuthRefresh(authDepsRef.current, (token) =>
    openNotificationStream({ accessToken: token, ...params }))`, then `await
    handle.readUntilEnd()`. Catch `AccessTokenRefreshUnavailableError` and rethrow it as
    `new NotificationStreamHttpError(401)`, so it classifies as `final`.
  - `fetchUnreadCount`: `notificationsRepository.getUnreadCount(authDepsRef.current)`.
  - `now: Date.now` and `random: Math.random`.
- **Run effect:**

  ```typescript
  const shouldRun = shouldRunNotificationStream({
    signedIn: status === 'authenticated' && accessToken !== null,
    appActive: isAppActive,
    backgroundAudioActive,
    offlineModeEnabled,
    termsBlocksAccountSync: termsBlocked,
  });
  ```

  An effect keyed on `shouldRun` calls `start()` or `stop()`, and its cleanup calls `stop()`. Do
  not key it on the token value, `isAppActive`, or `backgroundAudioActive`. Only the policy's
  result decides. A move to the background while audio plays leaves `shouldRun` true, so the
  effect does not run and the connection stays.

### Badge hook (`useNotificationsUnreadCount.ts`)

Replace the file's body. Keep the named export so callers do not move.

```typescript
export const useNotificationsUnreadCount = (): number =>
  useSyncExternalStore(subscribeNotificationUnreadCount, getNotificationUnreadCount);
```

Delete `emitNotificationsReadEvent`, the listener set, the poll interval, and the focus effect.
The controller owns the poll.

- In `TabScaffold` (`navigation/index.tsx`), change `useNotificationsUnreadCount({ enabled: true })`
  to `useNotificationsUnreadCount()`.
- In `NotificationsInboxScreen.tsx` `loadFirstPageAndMarkRead`, replace
  `emitNotificationsReadEvent()` with `setNotificationUnreadCount(0)` from the store. The stream's
  `notification.read` `scope: 'all'` event follows with the server's count. Fix the import.

### Session reset (`SyncProvider.tsx`)

In the existing `status === 'anonymous'` effect, call `resetNotificationStreamStore()` beside
`syncQueue.reset()`.

### E2E marker

`NotificationStreamE2eStatus.tsx` copies `PlaybackE2eStatus`'s 1×1 absolute marker. When
`isMobileE2eFromEnv()` is true, it renders
`<Text testID="notification-stream-e2e">{connection}</Text>`. `connection` comes from
`useSyncExternalStore(subscribeNotificationStreamConnection, getNotificationStreamConnection)`.
Otherwise it renders null. Mount it in `TabScaffold` directly after `<PlaybackE2eStatus />`. It is
not part of the bottom-chrome height and takes no touches.

### Contributor note

In `apps/mobile/APPS-MOBILE.md`, add a short "Notification stream" subsection beside the
existing notifications or push notes. Cover:

- the stream runs while the app is in the foreground or local audio is playing, and closes in the
  background once audio stops (`shouldRunNotificationStream`, input `backgroundAudioActive`);
- on Android, JS timers do not fire in the background, so background behavior never waits on a
  timer;
- the store is the one source for the unread count and the in-app event channel;
- a session opens fresh, and a return to the foreground keeps a connection that stayed open and
  recently sent bytes;
- the poll runs only while the stream is down.

Name the store's subscribe functions. Comments and docs describe the code as it stands
(**comments-future-forward**).

## Must stay true

- No request runs before first paint. The runtime starts from an effect after the shell renders.
- The stream never stays open in the background while audio is not playing.
- The parser, policy, store, and controller import nothing from React Native or Expo. Play state
  reaches the policy only as the `backgroundAudioActive` boolean.
- A token refresh does not restart the stream. A 401 never loops.
- After sign-out, no event from an older attempt reaches the store, and the badge reads 0.
- No `as` outside the existing assertion inside plan 10's parser, and no `any`.
- `@podverse/ui`, `@podverse/orm`, and the other denylisted packages stay out of mobile.

## Tests

- `sseEventParser.test.ts`:
  - an event split across three chunks, including a split `\r\n`;
  - two `data` lines joined with `\n`;
  - a comment;
  - `retry: 5000`;
  - a blank line with no data dispatches nothing;
  - `id` attaches to its event only.
- `notificationStreamPolicy.test.ts`:
  - the status table (401, 403, 404, 429, 500, 503, no status);
  - the ladder with `random = () => 0.5` gives 1000, 2000, 5000, 10000, 30000, 30000;
  - the seen-ids window drops a repeat and evicts the oldest past the limit;
  - run condition, from a signed-in base with Offline Mode off and terms not blocking:
    - in the background with audio playing (`appActive: false`, `backgroundAudioActive: true`),
      the stream stays open;
    - in the background with audio stopped, it closes;
    - audio stopping while in the background closes it: the same inputs go from `true` to
      `false` with only `backgroundAudioActive` changing;
    - signed out, Offline Mode on, or terms blocking closes it even while audio plays;
  - return to the foreground with an open stream does not reopen: `appActive` false → true with
    audio playing keeps `shouldRunNotificationStream` true throughout, and
    `notificationStreamForegroundReturnAction({ connection: 'open', msSinceActivity: 5_000 })` is
    `'keep'`;
  - the foreground return restarts for `open` with `msSinceActivity: 60_000`, for `open` with
    `null`, and for `retrying`, `connecting`, and `stopped`.
- `notificationStreamStore.test.ts`:
  - the unread count clamps negatives and notifies only on change;
  - events reach every subscriber, and a throwing listener does not stop the rest;
  - inbox focus counts two nested holds, and a double release is harmless;
  - reset zeroes the count and leaves focus alone.
- `notificationStreamController.test.ts`, with Vitest fake timers and a fake `connect` that
  exposes its params and a deferred settle:
  - `start` connects with `lastEventId: null`.
  - A state event sets `open` and the count, and publishes one `resync`.
  - Created events publish once per id, and the next reconnect sends the highest id.
  - A clean end after 10 s open reconnects at once; a clean end before that waits 1 s.
  - A 503 sets `retrying`, refetches once at once, then reconnects at 1 s, then 2 s. The poll
    fires at 60 s while down and stops after the next state event.
  - A 429 sets `stopped`, refetches once, keeps polling, and never reconnects.
  - A 401 sets `stopped` with no poll.
  - No state within 15 s aborts and retries. No activity for 60 s after open aborts and retries.
  - `stop` aborts the signal and clears timers. Events delivered after `stop` change nothing.
    The next `start` sends `lastEventId: null`.
  - `resumeForeground` after a state event and activity 5 s earlier makes no new `connect` call,
    leaves the signal unaborted, and publishes no second `resync`.
  - `resumeForeground` with the injected `now` moved 61 s past the last activity, and the fake
    timers not advanced so the idle timer has not fired (as on Android in the background), aborts
    the signal and connects again with `lastEventId: null`.
  - `resumeForeground` before any `start` makes no `connect` call.
- `apps/mobile/vitest.config.ts`: add the four test files to `include`, and add one clause for
  them to the header comment's list of covered pure modules.
- `apps/mobile/e2e/notifications-inbox.yaml` (Maestro; proves the stream wiring on the device):
  - In the guest part, before login, assert `id: notification-stream-e2e` with `text: idle`.
  - After `shared/login-seeded-user.yaml`, `extendedWaitUntil` the marker with `text: open`
    (`${TIMEOUT_SLOW}`).
  - Background and foreground the app with `- pressKey: Home`, then
    `- launchApp: { clearState: false, stopApp: false }`. Wait for `text: open` again
    (`${TIMEOUT_SLOW}`) and take a screenshot.
  - Keep the rest of the flow as it is.

  This is the device-only claim: a real `expo/fetch` stream reaches its first event on both
  platforms and reopens after the foreground. Nothing plays in this flow, so the Home step
  covers the close-and-reopen path. The marker reads `open` whether a connection was kept or
  reopened, so Maestro cannot tell the background-audio path apart. The policy and controller
  unit cases above carry that claim (**mobile-test-economics**). Do not add a playback step here.

## Release scratchpad

```markdown
## Mobile live notification badge

- Surfaces: mobile
- Change: while the app is signed in and either in the foreground or playing audio, it holds the
  API's account event stream (`GET /account/events`) open with the bearer token. In the
  background it closes the stream once audio is not playing. The Notifications tab badge updates
  within about a second of a new notification or a read on any device, instead of on a 60-second
  poll. The poll runs only while the stream is down; after a failed connect the app refetches the
  unread count once, then every 60 seconds. A return to the foreground keeps a stream that stayed
  open through the background and is still sending its heartbeat. A stream that closed, or that
  went silent for a minute or more, is replaced by a fresh one. Pushes that arrive in the
  foreground stay unshown, as before. While audio plays in the background, the stream holds one
  more open connection to the API than before.
- Who notices: signed-in mobile users with the app open or playing in the background
- Operator steps: the API must serve the notification stream (see the live notification stream
  entry). No mobile env vars.
```
