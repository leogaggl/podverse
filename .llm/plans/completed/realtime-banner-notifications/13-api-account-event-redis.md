**Cursor model:** Codex 5.3 · **Reasoning:** high

# 13 — API account event Redis connections

Each API pod opens two Redis (Valkey) connections for account events, both separate from the
existing cache client in `apps/api/src/lib/keyvaldb/keyvaldb.ts`:

- a **publisher**, registered with plan 11's `registerAccountEventPublisher`, so Mark All as Read
  and plan 21's mark-one publish from the API;
- a **subscriber**, which plan 12's hub uses to receive every account event on
  `podverse:account-events`.

A connection in subscriber mode can run no other command, so it cannot be the cache client or the
publisher. The cache client is also unsuitable as the publisher: it waits 60 seconds between
reconnects, which would hold live events back for a minute after a Redis restart.

Both connections use the existing `config.keyvaldb` host, port, and password and the existing
`podverse-keyvaldb-opaque` secret, so the API needs no new env var or manifest change.

Other work is landing in the tree. Before editing, confirm these still exist: `config.keyvaldb`
in `apps/api/src/config/index.ts`, `waitForKeyvalPingReady` and `startApp` in
`apps/api/src/index.ts`, the `keyvaldb.quit()` block in its `shutdown`, `startTestApp` and
`stopTestApp` in `apps/api/src/test/helpers/index.ts`, and plan 11's
`registerAccountEventPublisher`, `warnIfNoAccountEventPublisher`, `parseAccountEventMessage`,
`ACCOUNT_EVENT_CHANNEL`, and `ACCOUNT_EVENT_REDIS_RECONNECT_DELAY_MS` exported from
`@podverse/orm`.

## Rows

R21, R41

## Runs after

11

## Files

apps/api/src/lib/accountEvents/accountEventRedis.ts
apps/api/src/lib/accountEvents/accountEventRedis.test.ts
apps/api/src/index.ts
apps/api/src/test/helpers/index.ts
apps/api/ENV.md

## Module

`apps/api/src/lib/accountEvents/accountEventRedis.ts`. Import `Redis` from `ioredis` as
`keyvaldb.ts` does, `config` from `@api/config/index.js`, and `loggerService` from
`@api/factories/loggerService.js`.

A private factory builds both connections the same way:

```typescript
new Redis({
  host: config.keyvaldb.host,
  port: config.keyvaldb.port,
  password: config.keyvaldb.password,
  connectionName,
  retryStrategy: () => ACCOUNT_EVENT_REDIS_RECONNECT_DELAY_MS,
  lazyConnect: true,
});
```

`retryStrategy` never returns null, so a connection keeps trying every 5 seconds for the life of
the pod. `connectionName` is `podverse-api-account-events-pub` or
`podverse-api-account-events-sub`, which makes them easy to find in `CLIENT LIST`.

Each connection logs its errors once per outage: the first `error` after a `ready` logs
`loggerService.warn('Account event Redis connection lost', { connection, error: message })`; the
next `ready` after that logs `info('Account event Redis connection restored', { connection })`.
Later errors in the same outage are quiet.

### Publisher

```typescript
/** Opens the publisher connection and registers it with `@podverse/orm`. */
export function startAccountEventPublisher(): void;

/** Unregisters the publisher and closes its connection. Safe to call twice. */
export async function closeAccountEventPublisher(): Promise<void>;
```

- `startAccountEventPublisher` creates the connection with `enableOfflineQueue: false` and
  `maxRetriesPerRequest: 1`, so a `publish` during an outage rejects at once instead of queuing.
  Plan 11's `publishAccountEvents` catches that rejection and logs it once. It calls
  `connect()` without awaiting it (catch and ignore the returned promise; the `error` handler
  logs), then `registerAccountEventPublisher(connection)`. Calling it twice does nothing the
  second time.
- `closeAccountEventPublisher` calls `unregisterAccountEventPublisher()`, then `quit()` when the
  connection status is `ready` or `connecting`, else `disconnect()`.

### Subscriber

```typescript
export type AccountEventSubscription = { close(): Promise<void> };

export function subscribeAccountEvents(handlers: {
  onEvent: (event: AccountEvent) => void;
  onRecovered: () => void;
}): AccountEventSubscription;
```

- Creates the connection with `autoResubscribe: false`. The module subscribes itself on every
  `ready` so that `onRecovered` runs after the subscription is in place, not before.
- On every `ready`, including the first: `await connection.subscribe(ACCOUNT_EVENT_CHANNEL)`, then
  call `onRecovered()`. A failed `subscribe` logs once and waits for the next `ready`.
- On `message` for `ACCOUNT_EVENT_CHANNEL`: `parseAccountEventMessage(message)`. A null result
  logs `warn('Ignoring malformed account event message')` once per process. Otherwise call
  `onEvent(event)` for each event in order.
- A throwing `onEvent` or `onRecovered` is caught and logged with `loggerService.logError`; it
  never stops later events.
- Calls `connect()` without awaiting, as the publisher does, so `startApp` never waits on Redis.
- `close()` removes the listeners, then `quit()` or `disconnect()` as above. Safe to call twice.

Startup already waits for KeyValDB through `waitForKeyvalPingReady`. Both connections start
after that check and reconnect on their own afterwards, so a later Redis restart never stops the
API or its streams. Import `AccountEvent` with `import type` from `@podverse/orm`.

## Startup and shutdown

In `apps/api/src/index.ts`:

- After `loggerService.info('Connected to KeyValDB')` and before `startApp`: dynamically import
  this module, call `startAccountEventPublisher()`, then call
  `warnIfNoAccountEventPublisher('api')` from `@podverse/orm`. The warning cannot fire here unless
  registration broke, and the check stays so every writing process runs the same one (D2).
- In `shutdown`, call `closeAccountEventPublisher()` in its own `try`, after the database close
  and before the `keyvaldb.quit()` block, logging failures as the neighboring blocks do. Plan 12
  closes the subscriber through its hub before `server.close`. Writes that finish during shutdown
  after the publisher closes are dropped with the warning plan 11 defines; their clients catch up
  on reconnect.

## Tests harness

API integration tests run a real ORM context with `nodeEnv` `test`, where plan 11 makes a write
with no publisher throw. In `apps/api/src/test/helpers/index.ts`:

- In `startTestApp`, after the ORM context initializes and before `startApp`, import
  `registerAccountEventPublisher` from `@podverse/orm` (the same dynamic import that provides
  `createORMContext`, so it shares the module instance the app uses) and register
  `{ publish: async () => 0 }`. Tests that assert on publishing mock the signal module instead.
- In `stopTestApp`, call `unregisterAccountEventPublisher()` first, in a `try` like
  `closeTestKeyvaldb`.

Then search `apps/api/src` for other tests that build a real ORM context without `startTestApp`
(`rg -n "createORMContext" apps/api/src --glob '*.test.ts'`) and that reach `createMany` or
`updateNotificationsLastReadAt` unmocked; register the same no-op publisher in each.

## Unit test

`apps/api/src/lib/accountEvents/accountEventRedis.test.ts`. Mock `ioredis` with a fake `Redis`
class that extends `EventEmitter` and records `connect`, `subscribe`, `publish`, `quit`, and
`disconnect`. Mock `@api/config/index.js`, `@api/factories/loggerService.js`, and `@podverse/orm`
with `importOriginal` (keep the real `parseAccountEventMessage` and channel constant; make
`registerAccountEventPublisher` and `unregisterAccountEventPublisher` `vi.fn`).

- `startAccountEventPublisher` registers a connection named
  `podverse-api-account-events-pub`, and a second call creates nothing new.
- `subscribeAccountEvents`: emitting `ready` subscribes to `podverse:account-events` and then
  calls `onRecovered`; emitting `ready` again after an `error` subscribes and calls it again.
- A `message` with two events calls `onEvent` twice in order; a malformed message calls nothing
  and warns once across two malformed messages.
- An `onEvent` that throws on the first event still receives the second.
- Two `error` events between `ready`s log one warning; the next `ready` logs one recovery.
- `close()` twice calls `quit` once.

## Docs

In `apps/api/ENV.md`, under the `KEYVALDB_*` rows, add one sentence: the API opens a cache
connection, plus one publisher and one subscriber connection for account events on the channel
`podverse:account-events`, all with these values.

## Release scratchpad

none (plan 12's entry covers the API's connections)
