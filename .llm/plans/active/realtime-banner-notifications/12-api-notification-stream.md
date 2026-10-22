**Cursor model:** Opus 5.5 · **Reasoning:** high

# 12 — API account event stream (`GET /account/events`)

An authenticated SSE endpoint that every web tab holds open, and that the mobile app holds open
in the foreground and while it plays audio in the background: the account's one event stream. It sends a notification state snapshot, then each new notification
and each read-state change for that account as it happens, with `Last-Event-ID` replay on
reconnect. Each API pod receives plan 11's account events through plan 13's Redis subscriber and
fans them out to the streams it holds.

The stream and its hub are generic over event types. This plan handles the `notification.*`
types. Events of any other type reach the hub and are ignored until a later set adds their
handler. That includes the reserved `playback.*` namespace for cross-device playback state and
control commands. The endpoint, the per-account limit, and the hub's fanout do not change when one
is added. Nothing in this set sends `playback.*`.

Other work is landing in the tree. Before editing, confirm these still exist and adjust anchors if
they moved: `AccountNotificationController` in
`apps/api/src/controllers/account/accountNotification.ts`, the `/notifications/unread-count`
route in `apps/api/src/routes/account.ts`, `verifyTokenAndMembership` and `ensureAuthenticated`
in `apps/api/src/lib/auth/index.ts`, `startApp` in `apps/api/src/app.ts`, `shutdown` in
`apps/api/src/index.ts`, `stopTestApp` in `apps/api/src/test/helpers/index.ts`,
`accountNotificationToJson` in `apps/api/src/lib/accountNotificationApiSerialization.ts`, and
`subscribeAccountEvents` in `apps/api/src/lib/accountEvents/accountEventRedis.ts` (plan 13).

## Rows

R18, R20, R21, R22, R23, R25, R42, R46

## Runs after

10, 11, 13

## Files

apps/api/src/lib/accountEventStream/sseWire.ts
apps/api/src/lib/accountEventStream/sseWire.test.ts
apps/api/src/lib/accountEventStream/accountEventStreamHub.ts
apps/api/src/lib/accountEventStream/accountEventStreamHub.test.ts
apps/api/src/controllers/account/accountEventStream.ts
apps/api/src/routes/account.ts
apps/api/src/@types/express.d.ts
apps/api/src/lib/auth/index.ts
apps/api/src/app.ts
apps/api/src/index.ts
apps/api/src/test/helpers/index.ts
apps/api/src/test/account-events.test.ts
apps/api/openapi.yml
apps/api/APPS-API.md
release-notes/scratchpad.md

## Answers to the request's questions

- **R18, is a realtime channel possible on both web and mobile?** Yes, while the app is in the
  foreground. A browser tab holds an `EventSource`. A foreground React Native app holds a plain
  HTTP streaming request (area D), which the OS keeps alive while the app is active. When the app
  is in the background, the OS may suspend it at any time, so push stays the delivery path for
  notifications there, as the operator settled. The mobile stream may also stay open in the
  background while the app plays audio, because the OS keeps a playing app running. A
  notification event received there updates the badge and the inbox but does not replace the
  push.
- **R20, SSE or WebSocket?** SSE, settled by the operator. Traffic is one-way (server to client),
  and SSE runs over ordinary HTTP through the existing Traefik ingress and CORS. It reuses cookie
  auth on web and bearer auth on mobile without a new handshake. Reconnect with `Last-Event-ID`
  is part of the protocol.
- **R21 and R22, how close to realtime?** The path is: row committed, the writing process
  publishes on the Redis channel `podverse:account-events`, the API pod's subscriber connection
  receives it, then one row load and count, then the stream. In normal operation that is well
  under a second from commit. Every created notification takes this path whatever its category
  (R22), because the event is published in `createMany` (plan 11), and every process that writes
  notifications registers a publisher (plans 13, 14, 15).

## Endpoint

`GET ${API_PREFIX}${API_VERSION}/account/events`, matching `ACCOUNT_EVENTS_STREAM_API_PATH` from
plan 10. Register it in `apps/api/src/routes/account.ts` directly after
`/notifications/unread-count`:

```typescript
router.get('/events', asyncHandler(AccountEventStreamController.stream));
```

`GET /:id_text` is registered near the end of the file and would match `/events`; keep the new
route above it.

### Auth and gating

`ensureAuthenticated(req, res, handler, { skipMembershipStatus: true })`, the same options as
`getUnreadCount`. A cookie or a bearer token works, as on every other route. Terms acceptance is
enforced as on the other notification routes. Membership is not required. The inbox and
unread count are readable without a valid membership, and an expired account still needs live
read sync across its devices. 401 and 403 return the usual JSON before any stream bytes. Clients
must treat them as final and stop reconnecting (note for areas C and D).

### Token lifetime

Add `token_expires_at?: number` (epoch seconds) to `Express.User` in
`apps/api/src/@types/express.d.ts`. In `verifyTokenAndMembership`, set it from the decoded
payload's `exp` when that is a finite number. Narrow `exp` with `typeof`; do not widen the
existing assertion.

The stream ends itself at the earlier of `token_expires_at` and 30 minutes after it opened
(`ACCOUNT_EVENT_STREAM_MAX_LIFETIME_MS = 30 * 60_000`). Ending it at token expiry means a mobile
access token (900 seconds) never keeps a stream alive past its life. The client reconnects with a
refreshed token and `Last-Event-ID`, and replay covers the gap. The 30-minute cap bounds how long
a deleted account or a changed password can keep a stream. It also spreads clients across pods
after a scale-out. The cost is one auth query per client per 30 minutes.

### Response

- Headers, then `res.flushHeaders()`:
  `Content-Type: text/event-stream; charset=utf-8`, `Cache-Control: no-cache, no-transform`,
  `Connection: keep-alive`, `X-Accel-Buffering: no`.
- `req.socket.setNoDelay(true)` and `req.socket.setKeepAlive(true)`.
- First bytes: `retry: 5000\n\n`, which sets the browser's reconnect delay.
- Then `notification.state`, built from `account.notifications_last_read_at` and
  `countUnread(account_id, lastReadAt)`.
- Then replay (below), then live events.
- Every `ACCOUNT_EVENTS_STREAM_HEARTBEAT_MS` (25 s): an SSE comment line `: ping\n\n`.
  25 seconds is under the 60-second idle limits common in proxies and under Cloudflare's
  100-second limit.
- `req.on('close')` removes the stream from the hub and clears its timers.

### Replay (R23)

Replay is per event type: only events that carry an SSE `id:` replay, and in this set that is
`notification.created`. The reserved `playback.*` events, both latest-value state and one-shot
commands, never carry an `id:` and are never replayed. The last event id comes from the `Last-Event-ID` header, or else the
`ACCOUNT_EVENTS_STREAM_LAST_EVENT_ID_QUERY_PARAM` query param. Accept it only when it is a
positive safe integer; ignore anything else (no replay, no error).

- With an id: call
  `listForAccountAfterId(account_id, lastId, ACCOUNT_NOTIFICATIONS_REPLAY_LIMIT + 1)`.
  When it returns at most the limit, send each row as `notification.created` in id order. When it
  returns more, send no rows and send one `notification.resync` with `reason: 'replay_limit'`.
  The client refetches the inbox list; the badge already came from `notification.state`.
- Without an id: no replay. The stream's high-water mark starts at `getMaxIdForAccount`.
- Read events are not replayed. `notification.state` on every connection carries the current
  count and cutoff.

### Event wire format

`apps/api/src/lib/accountEventStream/sseWire.ts`, pure functions:

- `formatSseEvent({ event, data, id? })`: `id: <id>\n` only when given, then `event: <name>\n`,
  then `data: <JSON.stringify(data)>\n\n`. JSON never contains a raw newline, so one `data:`
  line is enough.
- `formatSseComment(text)` and `formatSseRetry(ms)`.

`notification.created` always carries `id: <notification.id>`. No other event carries an id.

Event data is plan 10's types, with `notification` serialized by `accountNotificationToJson(row,
cutoff)`. The cutoff is the stream's copy of the account's `notifications_last_read_at` (below).
Area B extends that serializer and `countUnread` for per-notification read state. When it changes
their signatures, it updates the calls in the hub.

## Hub

`apps/api/src/lib/accountEventStream/accountEventStreamHub.ts`, one instance per process.

### State

- `streamsByAccount: Map<number, Set<AccountEventStream>>`.
- Each `AccountEventStream` holds `account_id`, the response, `cutoff: Date | null`,
  `highWaterId: number`, `recentIds` (a bounded set of the last 200 delivered notification ids,
  for dedupe), a heartbeat interval, and an end timer.

### Lifecycle

- `startAccountEventStreamHub()`: calls plan 13's `subscribeAccountEvents` with `onEvent` and
  `onRecovered`, and keeps the returned subscription. Called from `startApp` in
  `apps/api/src/app.ts` after the route imports and before `app.listen`. It does not block
  startup when Redis is down: `subscribeAccountEvents` returns at once and connects in the
  background.
- `closeAccountEventStreamHub()`: ends every open response, clears every timer, closes the
  subscription. Safe to call twice.
- In `apps/api/src/index.ts` `shutdown`, call `closeAccountEventStreamHub()` **before**
  `server.close`. `server.close` waits for open connections, so a held stream would otherwise
  keep the pod from stopping until the kubelet kills it.
- In `apps/api/src/test/helpers/index.ts` `stopTestApp`, call it the same way, before
  `server.close`, through a dynamic import in a `try`, the way `closeTestKeyvaldb` is written.

### Per-account cap

At most `ACCOUNT_EVENT_STREAM_MAX_PER_ACCOUNT = 10` streams per account per pod. An eleventh
returns `429` JSON `{ message: 'Too many open account event streams.', code:
'account_event_stream_limit' }` before any stream bytes. Rejecting the newest connection avoids a
reconnect loop between tabs. Ten covers a person with several tabs and devices. Web (area C) is
expected to share one stream across tabs, so the cap is a guard, not the normal path.

### Event handling

`onEvent(event: AccountEvent)` receives one event per account from the subscriber. Skip it before
any query when `streamsByAccount` has no stream for `event.account_id`. Otherwise convert it with
`toAccountNotificationSignal(event)` from `@podverse/orm`. A null result means a type this build
has no handler for (any `playback.*` type, or a newer notification type); drop it with one
`debug` log per distinct type per process.

Process signals for one account in order: keep a per-account promise chain
(`Map<number, Promise<void>>`) and append each signal's work to it. Delete the entry when the
chain is idle.

- `created`: load the rows once with `getManyByIdsForAccount` and the count once with
  `countUnread`. Then, for each stream of that account, send each row not already in
  `recentIds`, raise `highWaterId`, and record the id. Rows may commit out of id order across
  workers. Live delivery uses the ids in the event, not `id > highWaterId`, so a late-committing
  lower id is still delivered.
- `read_all`: set each stream's `cutoff` to `last_read_at`, compute the count once, and send
  `notification.read` `{ scope: 'all', last_read_at, unread_count }`.
- `read_one`: compute the count once, send `notification.read`
  `{ scope: 'one', notification_id, unread_count }`. Area B publishes this signal; the hub
  already handles it.
- `onRecovered` (the subscriber finished subscribing after connecting or reconnecting to Redis):
  for each stream, run the replay path from its `highWaterId`. Then send a fresh
  `notification.state`, because read changes during the outage were missed. With no streams it
  does nothing, which is the case at startup.

A failed query for one account is logged with `loggerService.logError` and skips that account's
delivery for that event. It never ends other streams.

### Writes

`res.write` returns false under backpressure. If a stream's response is not writable or a write
throws, end that stream and remove it. The client reconnects with `Last-Event-ID`.

## Controller

`apps/api/src/controllers/account/accountEventStream.ts`:
`AccountEventStreamController.stream`. Keep it separate from `accountNotification.ts` so area B's
edits to that controller do not collide with this one. It parses the last event id, loads the
account (404 JSON when missing, as `getUnreadCount` does), checks the cap, writes headers, and
registers with the hub.

## Ingress and proxies

No manifest change. The base and alpha `podverse-ingress` route `api.*` to `podverse-api:3000`
through Traefik with no buffering middleware, and Traefik streams `text/event-stream` responses.
There is no compression middleware in `apps/api/src/app.ts`. The 25-second heartbeat keeps idle
timers from firing.

Add a short `### Account event stream` subsection under `## API Endpoints` in
`apps/api/APPS-API.md`. It names the route, says that event names are namespaced
(`notification.*` in use; `playback.*` reserved for cross-device playback state and control
commands, which carry no SSE id) and that only events with an SSE id replay, and
says that API pods receive changes through the Redis channel `podverse:account-events`. It states
what a proxy in front of the API must do: no response buffering for `text/event-stream`, an idle
timeout above 25 seconds, and HTTP/2 to browsers where possible, so tabs do not use up the
per-origin connection limit.

## OpenAPI

Add `/account/events` `get` beside `/account/notifications/unread-count` in
`apps/api/openapi.yml`:

- `operationId: apiGetAccountEvents`, tags `account`, security bearer and cookie.
- Parameters: header `Last-Event-ID` (string, optional) and query `last_event_id` (integer,
  optional), with the replay rule in the description.
- `200` with `text/event-stream`, schema `type: string`. The description says this is the
  account's one event stream with namespaced event names (`notification.*`; `playback.*`
  reserved for cross-device playback state and control commands, which never carry `id:` and
  never replay; clients ignore unknown names), lists the four notification event names, says
  only `notification.created` carries `id:` and only events with an id replay, and gives the
  heartbeat and the lifetime rule. Add component schemas
  `ApiAccountNotificationStreamState`, `ApiAccountNotificationStreamCreated`,
  `ApiAccountNotificationStreamRead`, and `ApiAccountNotificationStreamResync` matching plan 10,
  and reference them from the description so clients can find the data shapes.
- `401` (`AuthenticationErrorResponse`), `403` (terms), `429` (stream limit), `500`.

## Tests

- `apps/api/src/lib/accountEventStream/sseWire.test.ts`: event with and without id, comment,
  retry.
- `apps/api/src/lib/accountEventStream/accountEventStreamHub.test.ts`. Use fake responses that
  record writes; mock `@api/lib/accountEvents/accountEventRedis.js` so `subscribeAccountEvents`
  captures the handlers and returns a subscription with a `close` spy; mock `@podverse/orm` with
  `importOriginal`, keeping the real `toAccountNotificationSignal` and making the service methods
  `vi.fn`; use fake timers.
  - A `notification.created` event reaches both streams of that account and no stream of another
    account.
  - A duplicate id in a second event is not sent twice.
  - Two events for one account deliver in order even when the first query resolves last.
  - A `playback.progress` event for an account with a stream writes nothing and runs no query.
  - The eleventh stream for one account is refused.
  - The heartbeat comment is written every 25 s; the stream ends at token expiry, or at
    30 minutes when that comes first.
  - `onRecovered` replays rows after `highWaterId` and sends a fresh state event.
  - `closeAccountEventStreamHub` ends every stream and closes the subscription.
- `apps/api/src/test/account-events.test.ts`: integration, following
  `account-notifications.test.ts`'s `@podverse/orm` mock and `startTestApp`, and mocking
  `@api/lib/accountEvents/accountEventRedis.js`'s `subscribeAccountEvents` to capture handlers.
  Supertest buffers whole responses, so open the stream with Node `http.get` against the test
  server's port and read chunks until the expected event arrives, then destroy the request.
  - No auth returns 401 JSON.
  - With auth: `200`, `content-type` starts with `text/event-stream`, and the first event is
    `notification.state` with the mocked count.
  - Invoking the captured `onEvent` with
    `{ account_id: <test account>, type: 'notification.created', data: { notification_ids: [<id>] } }`
    yields `notification.created` with `id:` equal to the notification id and the serialized DTO.
  - `Last-Event-ID: 100` with three mocked rows after it replays those three in order. With
    limit + 1 mocked rows it sends `notification.resync` instead.
  - A `notification.read_all` event yields `notification.read` with `scope: 'all'`.

## Release scratchpad

```markdown
## Live account event stream

- Surfaces: api, workers, management-api, ops
- Change: new `GET /account/events` (SSE, cookie or bearer auth), the account's one event stream.
  Event names are namespaced: `notification.*` now; `playback.*` reserved for cross-device
  playback state and control commands, which never carry an SSE id and never replay. Clients
  ignore names they do not know. It sends a state snapshot with the unread count, then each new notification
  (`notification.created`, with the notification id as the SSE event id) and each read-state
  change (`notification.read`) for the account within about a second. Only events with an SSE id
  replay: reconnecting with `Last-Event-ID` replays up to 50 missed notifications; beyond that it
  sends `notification.resync`. A 25-second heartbeat keeps proxies open. Streams end at the auth
  token's expiry or after 30 minutes, and clients reconnect. At most 10 streams per account per
  API pod; more get 429. The API, management API, and parser and scheduled-job workers publish
  account events on the Redis (Valkey) channel `podverse:account-events` after they write
  notifications or read state, and each API pod holds one subscriber connection to it. A failed
  publish never fails the write; clients catch up on their next connection.
- Who notices: no one until web and mobile use the stream. Operators see more Redis connections:
  two per API pod, one per management API pod, and one per notification-writing worker.
- Operator steps: a proxy in front of the API must not buffer `text/event-stream` and must allow
  idle connections longer than 25 seconds. The bundled Traefik ingress needs no change. The
  management API and worker env and secret changes are in their own entries.
```
