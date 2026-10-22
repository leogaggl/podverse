**Cursor model:** Cursor Grok 4.7 · **Reasoning:** extra high

# 20 — Web: `playback.*` events and stream leadership through the shared account stream

The web account event stream (realtime-banner-notifications plans 30 and 31) listens only for
`notification.*` event names and hands tabs only parsed notification events. Cross-device
playback needs three more things from it, and nothing else in this set touches the stream:

1. The `EventSource` listens for the `playback.*` names too, so the browser delivers them.
1. Every tab receives parsed `playback.*` events, with the time this tab received them.
1. Every tab knows whether it is the stream leader (the tab holding the one stream for the
   browser profile). The leader checks in for the whole session (plan 22, R61).

No playback logic here. Plans 21–24 consume what this plan exposes.

Other work is landing in the tree. Before editing, confirm these exist and adjust anchors if they
moved; if any is missing, stop and report (realtime-banner-notifications plans 30 and 31, and this
set's plan 10, must land first):

- `apps/web/src/lib/notifications/stream/notificationStreamConnection.ts` with
  `openNotificationStreamConnection` and its "one listener per value of
  `ACCOUNT_NOTIFICATION_STREAM_EVENT`" loop.
- `apps/web/src/lib/notifications/stream/notificationStreamCoordinator.ts` with
  `startNotificationStreamCoordinator`, `NotificationStreamCoordinatorOptions`,
  `NotificationStreamEnvironment`, and its local delivery through
  `parseAccountNotificationStreamEvent`.
- `apps/web/src/contexts/Notifications.tsx` with `notificationStreamStatus` and
  `subscribeToNotificationStream` on `NotificationsContextType`.
- `@podverse/helpers` exports `ACCOUNT_PLAYBACK_STREAM_EVENT`, `isAccountPlaybackStreamEventName`,
  `parseAccountPlaybackStreamEvent`, and `AccountPlaybackStreamEvent` (plan 10).

## Rows

R61

## Runs after

10

## Files

apps/web/src/lib/notifications/stream/notificationStreamConnection.ts
apps/web/src/lib/notifications/stream/notificationStreamConnection.test.ts
apps/web/src/lib/notifications/stream/notificationStreamCoordinator.ts
apps/web/src/lib/notifications/stream/notificationStreamCoordinator.test.ts
apps/web/src/contexts/Notifications.tsx

## Decisions this plan fixes

- **One stream carries both namespaces.** No second `EventSource`, no second leader lock. The
  realtime set's one-stream-per-browser-profile rule holds for playback too.
- **Followers parse relayed playback events themselves.** The leader already relays every raw
  event `(eventName, rawData)` over the `BroadcastChannel`. Each tab parses with
  `parseAccountPlaybackStreamEvent`, as it does for notifications, so no tab trusts an unchecked
  object.
- **Received time is this tab's clock at local delivery.** Plan 11's position estimate compares
  only this tab's own clock readings, so relay latency between tabs (well under a millisecond)
  does not matter.
- **Leadership in the fallback.** When Web Locks or `BroadcastChannel` is missing, every tab opens
  its own stream; each such tab reports itself as leader.
- **The context keeps its name.** `NotificationsContext` already owns the account stream; this
  plan adds playback fields to it rather than renaming it or adding a second context.

## `notificationStreamConnection.ts`

Replace the listener loop's source list with a module constant covering both namespaces:

```typescript
const ACCOUNT_STREAM_EVENT_NAMES: readonly string[] = [
  ...Object.values(ACCOUNT_NOTIFICATION_STREAM_EVENT),
  ...Object.values(ACCOUNT_PLAYBACK_STREAM_EVENT),
];
```

Add one listener per name, forwarding `{ eventName, rawData: event.data, lastEventId }` exactly as
today. `lastEventId` stays set only for `notification.created`; `playback.*` events never carry an
SSE id. Update the doc comment on `RawNotificationStreamEvent` to say it covers every account
stream event name. Nothing else changes.

## `notificationStreamCoordinator.ts`

Add to `NotificationStreamCoordinatorOptions`:

```typescript
/** Parsed `playback.*` events in this tab, whether it leads or follows, with this tab's receive time. */
onPlaybackEvent?: (event: AccountPlaybackStreamEvent, receivedAtMs: number) => void;
/** True while this tab holds the stream. In the fallback (no Web Locks or BroadcastChannel) every tab holds its own. */
onLeadership?: (isLeader: boolean) => void;
```

Add to `NotificationStreamEnvironment` (default `() => Date.now()`):

```typescript
now: () => number;
```

Local delivery becomes:

- When `isAccountPlaybackStreamEventName(eventName)` is true: parse with
  `parseAccountPlaybackStreamEvent(eventName, rawData)`; when not null, call
  `options.onPlaybackEvent?.(parsed, environment.now())`. Do not call `onEvent`.
- Otherwise: the existing notification path, unchanged.

Leadership:

- Call `onLeadership(false)` once at start.
- Call `onLeadership(true)` at the top of the lock callback, before opening the connection.
- In the fallback path, call `onLeadership(true)` when opening the connection directly.
- In `stop()`, call `onLeadership(false)` if it had reported true. Keep `stop()` safe to call
  twice: report `false` at most once.

Relay is unchanged: the leader already posts every raw event the connection forwards, so playback
events reach followers with no new message kind.

## `Notifications.tsx`

Add to `NotificationsContextType` and its default value:

```typescript
/** True while this tab holds the account stream for the browser profile. */
notificationStreamIsLeader: boolean; // default false
/** Subscribe to parsed playback stream events in this tab. Returns the unsubscribe function. */
subscribeToPlaybackStream: (
  listener: (event: AccountPlaybackStreamEvent, receivedAtMs: number) => void
) => () => void; // default () => () => {}
```

In `NotificationsProvider`, beside the existing `streamListenersRef` and
`subscribeToNotificationStream`:

- `const [notificationStreamIsLeader, setNotificationStreamIsLeader] = useState(false);`
- `const playbackStreamListenersRef = useRef(new Set<(event: AccountPlaybackStreamEvent, receivedAtMs: number) => void>());`
- `subscribeToPlaybackStream`: a `useCallback` that adds to the set and returns a function that
  deletes it, written like `subscribeToNotificationStream`.
- In the coordinator effect, pass `onPlaybackEvent: (event, receivedAtMs) => { for (const listener of playbackStreamListenersRef.current) { listener(event, receivedAtMs); } }`
  and `onLeadership: setNotificationStreamIsLeader`.
- When `accountId` is null, also `setNotificationStreamIsLeader(false)`.
- Pass both new values in the provider `value`.

Import `AccountPlaybackStreamEvent` with `import type` from `@podverse/helpers`.

## Must stay true

- Still at most one stream per account per browser profile when Web Locks and `BroadcastChannel`
  exist.
- A `playback.*` event never reaches `onEvent` or changes the unread count.
- A follower never applies a relayed message tagged with another account id (unchanged).
- Exactly one tab per profile reports `notificationStreamIsLeader: true` while the stream runs,
  except in the fallback.

## Tests

Extend the existing Vitest files from realtime plan 30 (same fakes):

- `notificationStreamConnection.test.ts`: the fake `EventSource` receives a `playback.state`
  message; `onRawEvent` gets `{ eventName: 'playback.state', rawData, lastEventId: null }`, and
  `getLastEventId()` is unchanged.
- `notificationStreamCoordinator.test.ts`:
  - Two coordinators for account 1 with an injected `now`: a valid `playback.state` raw event from
    the leader's connection reaches `onPlaybackEvent` in both tabs, parsed, with each tab's `now()`
    value; `onEvent` is not called.
  - A raw `playback.state` with invalid data reaches neither callback.
  - Leadership: the first coordinator reports `false` then `true`; the second reports only `false`;
    after the leader's `stop()`, the second reports `true` and the first reports `false` once.
  - With `locks: null`, each coordinator reports `true`.

## Release scratchpad

none (no behavior until plan 22 uses it)
