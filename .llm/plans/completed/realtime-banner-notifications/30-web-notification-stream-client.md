**Cursor model:** Opus 5.5 · **Reasoning:** high

# 30 — Web notification stream client (one stream per browser, shared across tabs)

A framework-free web library that holds the notification stream (plan 12) open with
`EventSource`, parses each event with plan 10's `parseAccountNotificationStreamEvent`, and shares
one stream across every tab of the same account. Plan 31 wires it into the Notifications context;
this plan adds no React and changes no screen.

Other work is landing in the tree. Before editing, confirm these still exist and adjust anchors if
they moved: `getApiRequestService` in `apps/web/src/factories/apiRequestService.ts`,
`config.public.api.client` and `config.public.api.prefix` / `version` in
`apps/web/src/config/index.ts`, and plan 10's exports from `@podverse/helpers`
(`ACCOUNT_EVENTS_STREAM_API_PATH`, `ACCOUNT_EVENTS_STREAM_LAST_EVENT_ID_QUERY_PARAM`,
`ACCOUNT_NOTIFICATION_STREAM_EVENT`, `AccountNotificationStreamEvent`,
`parseAccountNotificationStreamEvent`).

## Rows

R26, R37, R39 (the transport half; plan 31 covers the badge and polling half)

## Runs after

10

(The library is tested with fakes, so it does not wait for plan 12's endpoint.)

## Files

apps/web/src/factories/apiRequestService.ts
apps/web/src/lib/notifications/stream/notificationStreamUrl.ts
apps/web/src/lib/notifications/stream/notificationStreamUrl.test.ts
apps/web/src/lib/notifications/stream/notificationStreamConnection.ts
apps/web/src/lib/notifications/stream/notificationStreamConnection.test.ts
apps/web/src/lib/notifications/stream/notificationStreamCoordinator.ts
apps/web/src/lib/notifications/stream/notificationStreamCoordinator.test.ts

## Decisions this plan fixes

- **One stream per browser profile and account, not one per tab.** Plan 12 caps streams at 10 per
  account per API pod, and browsers allow 6 connections per host over HTTP/1.1 (local dev, and any
  proxy without HTTP/2). A user with several tabs open would otherwise hit the cap or starve the
  tab's ordinary API requests. Tabs elect one leader with the Web Locks API
  (`navigator.locks.request`), and the leader relays what it receives over a `BroadcastChannel`.
  When the leader tab closes, the browser releases its lock and the next waiting tab takes over.
  SharedWorker was not chosen: Chrome on Android does not support it.
- **Fallback when Web Locks or `BroadcastChannel` is missing:** every tab opens its own stream.
  The server cap still guards.
- **Tabs relay the raw SSE event, not the parsed object.** Each receiving tab re-parses
  `(eventName, rawData)` with `parseAccountNotificationStreamEvent`, so no tab trusts an unchecked
  object from the channel and no type assertion is needed.
- **Fatal failures retry with backoff.** `EventSource` reconnects by itself after a dropped
  connection (it honors the server's `retry: 5000`, and sends `Last-Event-ID`). It gives up for
  good (`readyState === CLOSED`) on an HTTP error status or a wrong content type, and does not
  expose which status it got. On that, the connection reports `down` and opens a fresh
  `EventSource` after 30 s, doubling each failure up to 5 minutes, reset after the next `open`.
  Polling (plan 31) runs while the status is not `open`, so a 401, 403, or 429 degrades to the
  60-second poll rather than to a reconnect loop.
- **The server's `notification.state` event is the "refetch once on reconnect" (R37).** Plan 12
  sends it first on every connection with the current unread count. The client adds no separate
  unread-count request on reconnect.

## API base URL

Add to `apps/web/src/factories/apiRequestService.ts`, above `getSSRApiRequestService`:

```typescript
/** Browser-facing API base, e.g. `https://api.example.com/api/v2`. Composed the same way `ApiRequestService` composes its own base. */
export function getClientApiBaseUrl(): string {
  const config = getConfig();
  const protocol = config.public.api.client.protocol || '';
  const host = config.public.api.client.host || '';
  const port = config.public.api.client.port || '';
  const prefix = (config.public.api.prefix || '').replace(/\/$/, '');
  const version = config.public.api.version || '';
  return `${protocol}://${host}${port ? `:${port}` : ''}${prefix}${version}`;
}
```

`ApiRequestService` keeps its base private, and area D may touch `_request.ts` for mobile, so web
composes its own here rather than adding a getter to the shared class. Plan 33 uses this function
too.

## `notificationStreamUrl.ts`

```typescript
export function buildNotificationStreamUrl(apiBaseUrl: string, lastEventId: number | null): string;
```

Returns `${apiBaseUrl}${ACCOUNT_EVENTS_STREAM_API_PATH}`, plus
`?${ACCOUNT_EVENTS_STREAM_LAST_EVENT_ID_QUERY_PARAM}=<id>` when `lastEventId` is a positive
safe integer. Build with `URL` and `searchParams.set`, not string concatenation, for the query.

Also export `readSseLastEventId(value: string): number | null`: a positive safe integer parsed
from a `MessageEvent.lastEventId` string (digits only), otherwise null.

## `notificationStreamConnection.ts`

One `EventSource` and its retry policy. No tab coordination.

```typescript
export type NotificationStreamStatus = 'off' | 'connecting' | 'open' | 'down';

/** One received SSE event, before parsing. `lastEventId` is set only on `notification.created`. */
export type RawNotificationStreamEvent = {
  eventName: string;
  rawData: string;
  lastEventId: number | null;
};

export type EventSourceLike = {
  readonly readyState: number;
  onopen: ((event: Event) => void) | null;
  onerror: ((event: Event) => void) | null;
  addEventListener(type: string, listener: (event: MessageEvent<string>) => void): void;
  close(): void;
};

export type NotificationStreamConnectionOptions = {
  apiBaseUrl: string;
  initialLastEventId: number | null;
  onRawEvent: (event: RawNotificationStreamEvent) => void;
  onStatus: (status: NotificationStreamStatus) => void;
  createEventSource?: (url: string) => EventSourceLike;
  setTimer?: (callback: () => void, ms: number) => number;
  clearTimer?: (id: number) => void;
};

export type NotificationStreamConnection = {
  getLastEventId(): number | null;
  close(): void;
};

export function openNotificationStreamConnection(
  options: NotificationStreamConnectionOptions
): NotificationStreamConnection;
```

Behavior:

- Default `createEventSource` is `(url) => new EventSource(url, { withCredentials: true })`.
  Cookies authenticate the stream; the API's CORS already allows credentials from the web origin.
  `EventSource.CLOSED` is `2`; compare against the constant on the global when present, else `2`.
- Status goes `connecting` on create, `open` on `onopen`.
- Add one listener per value of `ACCOUNT_NOTIFICATION_STREAM_EVENT`. Each forwards
  `{ eventName, rawData: event.data, lastEventId }`. For `notification.created`, read
  `readSseLastEventId(event.lastEventId)`; when not null, store it as the connection's last id.
- `onerror` with `readyState !== CLOSED`: report `connecting` (the browser is retrying).
- `onerror` with `readyState === CLOSED`: report `down`, close it, and schedule a fresh
  `EventSource` with `buildNotificationStreamUrl(apiBaseUrl, lastEventId)` after the backoff
  (30 000 ms, then 60 000, 120 000, 240 000, capped at 300 000). An `open` resets the backoff.
- `close()` clears any pending timer, closes the `EventSource`, removes handlers, and reports
  `off`. Calls after `close()` do nothing.
- The first `EventSource` uses `buildNotificationStreamUrl(apiBaseUrl, initialLastEventId)`.

## `notificationStreamCoordinator.ts`

Leader election and relay. This is the module plan 31 calls.

```typescript
export type NotificationStreamCoordinatorOptions = {
  accountId: number;
  apiBaseUrl: string;
  /** Parsed events, in this tab, whether this tab leads or follows. */
  onEvent: (event: AccountNotificationStreamEvent) => void;
  onStatus: (status: NotificationStreamStatus) => void;
  environment?: Partial<NotificationStreamEnvironment>;
};

export type NotificationStreamEnvironment = {
  locks: LockManagerLike | null;
  createChannel: ((name: string) => BroadcastChannelLike) | null;
  openConnection: (options: NotificationStreamConnectionOptions) => NotificationStreamConnection;
};

export function startNotificationStreamCoordinator(
  options: NotificationStreamCoordinatorOptions
): { stop(): void };
```

`LockManagerLike` and `BroadcastChannelLike` are the minimal structural types the module uses
(`request(name, { signal }, callback)`; `postMessage`, `onmessage`, `close`). Defaults:
`navigator.locks` when `'locks' in navigator`, else null; `(name) => new BroadcastChannel(name)`
when `typeof BroadcastChannel === 'function'`, else null; `openNotificationStreamConnection`.

Names: lock `podverse:notification-stream:${accountId}`, channel `podverse:notification-stream`.

### Channel messages

Every message carries `accountId`. A tab ignores messages whose `accountId` differs from its own,
so a tab still showing another account never applies them. Messages:

- `{ kind: 'event', accountId, eventName, rawData, lastEventId }` — leader to all.
- `{ kind: 'status', accountId, status }` — leader to all, on every status change.
- `{ kind: 'hello', accountId }` — a tab that starts as a follower asks for the current state.
- `{ kind: 'snapshot', accountId, status, lastEventId }` — leader's reply to `hello`.

Read incoming `MessageEvent.data` as `unknown` and narrow with a private `readChannelMessage`
guard (`typeof`, `in`, literal checks on `kind`, `status` in the four status values). No `as`.

### Each tab

- Keeps `lastEventId` from its own connection when leading, or from relayed `event` messages and
  `snapshot` replies when following.
- Delivers an event locally by calling `parseAccountNotificationStreamEvent(eventName, rawData)`
  and, when not null, `onEvent(parsed)`. The leader delivers locally and posts the same raw event.
- Starts with status `connecting`, posts `hello`, then requests the lock with an `AbortController`
  signal.

### Leader

Inside the lock callback: open the connection with `initialLastEventId` = this tab's
`lastEventId`, forward its raw events (deliver locally, post `event`) and statuses (report
locally, post `status`), answer `hello` with `snapshot`, and hold the lock by awaiting a promise
that `stop()` resolves.

### `stop()`

Aborts a pending lock request (catch the `AbortError` rejection quietly), resolves the held
promise if leading, closes the connection, posts `status: 'connecting'` if it was leading (the
next leader takes over), closes the channel, and reports `off`. Safe to call twice.

### Fallback

When `locks` or `createChannel` is null, open the connection directly in this tab with no relay.

Comments describe the code as it stands (**comments-future-forward**). No `any`, no `as` outside
`as const`, `===` only.

## Must stay true

- At most one stream per account per browser profile when Web Locks and `BroadcastChannel` exist.
- A follower never applies a message tagged with another account id.
- A reconnect after a leader change carries the newest `notification.created` id any tab saw, so
  plan 12's replay fills the gap.
- `stop()` leaves no timer, `EventSource`, lock, or channel behind.

## Tests

Vitest (jsdom), behavior-focused per **unit-test-design-no-overgranularity**. Inject fakes through
the options; do not depend on jsdom having `EventSource`, `navigator.locks`, or
`BroadcastChannel`.

- `notificationStreamUrl.test.ts`: no id gives the bare path; id 42 adds `last_event_id=42`;
  `readSseLastEventId` accepts `'42'` and rejects `''`, `'0'`, `'-1'`, `'4.2'`, `'abc'`.
  `getClientApiBaseUrl` with a mocked config (`vi.mock('../../../config')`) composes
  `http://localhost:4030/api/v2` and drops a trailing slash on the prefix.
- `notificationStreamConnection.test.ts` with a fake `EventSourceLike` and fake timers:
  - `open` reports `open`; a `notification.created` message with `lastEventId: '7'` forwards the
    raw event and `getLastEventId()` returns 7.
  - An error with `readyState` connecting reports `connecting` and creates no new source.
  - An error with `readyState` closed reports `down`, then after 30 s creates a new source whose
    URL has `last_event_id=7`; a second failure waits 60 s; an `open` resets to 30 s.
  - `close()` reports `off`, and a pending retry never fires.
- `notificationStreamCoordinator.test.ts` with an in-memory lock manager (one holder, FIFO
  waiters, released when the holder's promise settles or its signal aborts), an in-memory channel
  hub delivering to every other channel of the same name, and a fake `openConnection`:
  - Two coordinators for account 1: only one opens a connection; an event from that connection
    reaches `onEvent` in both, parsed.
  - The leader's `stop()` makes the follower open a connection with `initialLastEventId` equal to
    the last relayed created id.
  - A coordinator for account 2 on the same channel ignores account 1's events and statuses.
  - A follower started after the leader is `open` receives `open` through `snapshot`.
  - With `locks: null`, each coordinator opens its own connection.
  - `stop()` twice is harmless and reports `off`.

## Release scratchpad

none (plan 31 makes this visible and its entry covers it)
