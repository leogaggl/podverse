**Cursor model:** Opus 5.5 · **Reasoning:** high

# 11 — Account event fanout through Redis (`@podverse/orm`)

Every process that writes notification state tells every API pod about it by publishing an
account event on one Redis (Valkey) pub/sub channel, using the existing `podverse-keyvaldb`
instance. API pods hold one subscriber connection each (plan 13 opens it, plan 12's hub consumes
it). An event is small and internal to the server: it names an account and ids, and the API pod
loads rows and counts itself before it writes anything to a client.

The channel is the account's one event bus, not a notifications channel. Each event carries an
`account_id` and a namespaced `type`. `notification.*` types are defined here; `playback.*` is
reserved for cross-device playback, both latest-value state and one-shot control commands, which
a later set adds without changing the channel or the envelope.

Other work is landing in the tree. Before editing, confirm these still exist:
`AccountNotificationService.createMany` in
`packages/orm/src/services/account/accountNotification.ts`,
`AccountService.updateNotificationsLastReadAt` in `packages/orm/src/services/account/account.ts`,
`createInAppNotificationsForAccounts` in
`packages/parser/src/lib/notifications/sharedNotificationHelpers.ts`, and `getLoggerService` /
`getORMConfig` in `packages/orm/src/context.ts`.

## Rows

R21, R22, R41, R42

## Runs after

none

## Files

packages/orm/src/lib/accountEventPublisher.ts
packages/orm/src/lib/accountEventPublisher.test.ts
packages/orm/src/services/account/accountNotificationSignal.ts
packages/orm/src/services/account/accountNotificationSignal.test.ts
packages/orm/src/services/account/accountNotificationPublish.test.ts
packages/orm/src/services/account/accountNotification.ts
packages/orm/src/services/account/accountNotification.test.ts
packages/orm/src/services/account/account.ts
packages/orm/src/index.ts

## Where the publisher lives

Notifications are written in four kinds of process: API pods (Mark All as Read, and mark-one in
plan 21), the management API (admin campaign sends through `dispatchAdminNotificationCampaign`),
parser workers (`createInAppNotificationsForAccounts` from `packages/parser`), and the
scheduled-job runner (`scheduledJobsRunDue`, which dispatches campaigns and reparses feeds). All of
them reach the database through `@podverse/orm`, and every write funnels into
`AccountNotificationService.createMany` or `AccountService.updateNotificationsLastReadAt` (and
plan 21's mark-one method).

So the publish code lives in `@podverse/orm` (tier 2), which the parser (tier 3) and every app
(tier 5) already import. The ORM does not import a Redis client: no package under `packages/`
depends on `ioredis`, and adding it to a shared package would pull it into packages the web apps
also depend on. Instead the ORM defines a structural publish client, and each process that writes
notifications registers its own `ioredis` connection at startup (API in plan 13, management API in
plan 14, workers in plan 15). An `ioredis` `Redis` instance satisfies the type as it is. The
parser needs no change: it calls `createMany`, which publishes.

## Design

### Generic account event bus

New file `packages/orm/src/lib/accountEventPublisher.ts`.

```typescript
/**
 * Redis pub/sub channel for every account event. Pub/sub channels are shared across logical
 * databases, so the name carries the product prefix.
 */
export const ACCOUNT_EVENT_CHANNEL = 'podverse:account-events';

/** Most events in one published message; larger batches go out as several messages. */
export const ACCOUNT_EVENT_MAX_PER_MESSAGE = 500;

/** Fixed delay between reconnect attempts for every account event Redis connection. */
export const ACCOUNT_EVENT_REDIS_RECONNECT_DELAY_MS = 5_000;

/**
 * Data for each event type the server publishes. Types are namespaced: `notification.*` is in
 * use; `playback.*` is reserved for cross-device playback state and control commands.
 */
export type AccountEventDataByType = {
  'notification.created': { notification_ids: number[] };
  'notification.read_all': { last_read_at: string };
  'notification.read_one': { notification_id: number };
};

export type AccountEventType = keyof AccountEventDataByType;

/** An event a process may publish. */
export type PublishableAccountEvent = {
  [K in AccountEventType]: { account_id: number; type: K; data: AccountEventDataByType[K] };
}[AccountEventType];

/**
 * An event as received. `type` is any namespaced string and `data` is unchecked until the
 * handler for that type validates it, so a subscriber on an older build ignores newer types.
 */
export type AccountEvent = { account_id: number; type: string; data: unknown };

/** The part of an ioredis client the publisher uses. */
export type AccountEventPublishClient = {
  publish(channel: string, message: string): Promise<unknown>;
};
```

Wire format: each message is `JSON.stringify({ events })`, where `events` is an array of
`{ account_id, type, data }` with at most `ACCOUNT_EVENT_MAX_PER_MESSAGE` entries. Every event
carries its own `account_id`, so one message can serve a campaign batch across many accounts, and
a subscriber routes by account without knowing the type.

Functions, all exported:

```typescript
export function registerAccountEventPublisher(client: AccountEventPublishClient): void;
export function unregisterAccountEventPublisher(): void;
export function hasAccountEventPublisher(): boolean;

/** Startup check: logs a warning when this process has no publisher registered. */
export function warnIfNoAccountEventPublisher(processName: string): void;

export async function publishAccountEvents(events: PublishableAccountEvent[]): Promise<void>;

/** Parses one received message, or returns null when it is not an account event batch. */
export function parseAccountEventMessage(message: string): AccountEvent[] | null;
```

Module state: one `client: AccountEventPublishClient | null`, and one `publishFailing: boolean`
for outage logging. `registerAccountEventPublisher` replaces any earlier client.
`unregisterAccountEventPublisher` sets it to null.

`warnIfNoAccountEventPublisher(processName)`: when no client is registered,
`getLoggerService().warn('No account event publisher is registered; notification changes from this process will not reach open streams', { processName })`.

`publishAccountEvents(events)`:

1. An empty list returns without touching Redis.
1. **No publisher registered.** When `getORMConfig().nodeEnv === 'test'`, throw
   `new Error('Account events were written with no account event publisher registered')`. This is
   what makes a test fail when a write runs in a process that never registered (D2). Otherwise
   log `getLoggerService().warn('Account events dropped: no account event publisher is registered', { count: events.length })`
   on every call and return. This check sits outside the `try` below, so the error is not
   swallowed in tests.
1. Split `events` into chunks of `ACCOUNT_EVENT_MAX_PER_MESSAGE` and send them with
   `await Promise.all(chunks.map((chunk) => client.publish(ACCOUNT_EVENT_CHANNEL, JSON.stringify({ events: chunk }))))`.
1. **Publishing never fails the write it follows.** Wrap step 3 in `try`/`catch`. On the first
   failure after a success (or after startup), log once with
   `getLoggerService().warn('Account event publish failed; open streams catch up on their next connection', { error: message })`
   and set `publishFailing = true`. Later failures stay quiet. On the next success while
   `publishFailing` is true, log `info('Account event publishing recovered')` and clear the flag.
   Return normally either way. The row is already committed; a lost event costs only liveness,
   and clients recover through the state snapshot on their next connection (a stream lasts at
   most 30 minutes).

Doc comment on `publishAccountEvents`: call it only after the write that produced the events has
committed, never inside a transaction callback, because a subscriber loads the rows the moment it
receives the event.

`parseAccountEventMessage(message)`: `JSON.parse` in `try` (null on throw). The value must be a
record with an `events` array, else null. Keep each entry that is a record with a positive safe
integer `account_id`, a non-empty string `type`, and a `data` key; drop other entries. Return the
kept entries (possibly empty). Use small private guards (`isRecord`, `isPositiveSafeInteger`); no
`as` on parsed values.

### Notification signals

New file `packages/orm/src/services/account/accountNotificationSignal.ts`. The signal shapes stay
what callers and plan 21 already use:

```typescript
export type AccountNotificationSignal =
  | { kind: 'created'; pairs: Array<[account_id: number, notification_id: number]> }
  | { kind: 'read_all'; account_id: number; last_read_at: string }
  | { kind: 'read_one'; account_id: number; notification_id: number };

export async function publishAccountNotificationSignals(
  signals: AccountNotificationSignal[]
): Promise<void>;

export async function publishAccountNotificationCreated(
  rows: Array<{ id: number; account_id: number }>
): Promise<void>;

export async function publishAccountNotificationReadAll(
  account_id: number,
  last_read_at: Date
): Promise<void>;

export async function publishAccountNotificationReadOne(
  account_id: number,
  notification_id: number
): Promise<void>;

/** The notification signal an account event carries, or null for any other or malformed type. */
export function toAccountNotificationSignal(event: AccountEvent): AccountNotificationSignal | null;
```

`publishAccountNotificationSignals` turns signals into account events and calls
`publishAccountEvents` once:

- `created`: group `pairs` by `account_id` in first-seen order, keeping id order within each
  account, and emit one `notification.created` event per account with `{ notification_ids }`.
- `read_all`: one `notification.read_all` event with `{ last_read_at }`.
- `read_one`: one `notification.read_one` event with `{ notification_id }`.

An empty list publishes nothing. The three single-purpose helpers build signals and delegate:
`publishAccountNotificationCreated` maps rows to one `created` signal,
`publishAccountNotificationReadAll` formats the date with `toISOString()`.

`toAccountNotificationSignal(event)` validates `event.data` for the three notification types and
returns the matching signal (`notification.created` becomes `{ kind: 'created', pairs }` with
every pair on `event.account_id`; it requires a non-empty array of positive integers). Any other
type, including `playback.*`, returns null. Same guard style, no `as`.

These types are server-internal. The client contract is plan 10's, in `@podverse/helpers`; the
internal type names (`notification.read_all`, `notification.read_one`) are not SSE event names.

### Hooking the write methods

Publishing happens only after the database write commits. Each hooked call is a single repository
`save` outside any caller transaction, so the row is committed when `save` resolves.

- `AccountNotificationService.createMany`: after `save` returns, call
  `await publishAccountNotificationCreated(saved)` with the saved rows (they carry `id` and
  `account_id`), then return the rows. No change to the return value or signature.
- `AccountService.updateNotificationsLastReadAt`: after `save`, call
  `await publishAccountNotificationReadAll(account_id, readAt)`.
- `publishAccountNotificationReadOne` and `publishAccountNotificationSignals` have no caller in
  this plan. Plan 21's mark-one write method calls `publishAccountNotificationSignals` after its
  `UPDATE … RETURNING` resolves.

### Read helpers the API stream needs

Add to `AccountNotificationService` (read data source, ordered by `id`):

- `listForAccountAfterId(account_id: number, after_id: number, limit: number):
  Promise<AccountNotification[]>`: rows with `id > after_id`, `ORDER BY id ASC`, `take: limit`.
  Plan 12 calls it with `limit = replay limit + 1` to detect overflow.
- `getManyByIdsForAccount(account_id: number, ids: number[]): Promise<AccountNotification[]>`:
  `where: { account_id, id: In(ids) }`, `ORDER BY id ASC`. An empty `ids` returns `[]` without a
  query. Scoping by account means an event can never leak one account's row to another's stream.
- `getMaxIdForAccount(account_id: number): Promise<number | null>`: the highest id the account
  has, or null.

### Exports

In `packages/orm/src/index.ts`, export `./lib/accountEventPublisher.js` and
`./services/account/accountNotificationSignal.js`, placed beside the
`./services/account/accountNotification.js` line.

The subscriber is not in the ORM. Only API pods subscribe, and they own the `ioredis` connection
(plan 13). They decode messages with `parseAccountEventMessage` and `toAccountNotificationSignal`
from here, so encoding and decoding stay in one file each.

## Must stay true

- A notification row is committed before any API pod hears about it.
- A Redis failure never throws out of `createMany`, `updateNotificationsLastReadAt`, or plan 21's
  mark-one method.
- Outside a test-env ORM, a missing publisher never throws; it warns on every dropped batch.
- Callers of `createMany` (`createInAppNotificationsForAccounts`,
  `createAccountNotificationWithOptionalPush`) change nothing.
- No new dependency in any package. No new env var.

## Tests

Mock `@orm/context.js` in each file below so `getLoggerService()` returns `vi.fn` methods and
`getORMConfig()` returns `{ nodeEnv }` with the value the case needs.

- `packages/orm/src/lib/accountEventPublisher.test.ts`:
  - 1,100 events with a registered fake client send three messages on `podverse:account-events`
    (500, 500, 100 events), each parseable by `parseAccountEventMessage` back to its events.
  - A rejecting `publish` resolves, logs one warning, stays quiet on a second failure, and logs
    the recovery once a publish succeeds.
  - With no client and `nodeEnv: 'production'`: resolves and warns with the count.
  - With no client and `nodeEnv: 'test'`: rejects with the missing-publisher error.
  - `warnIfNoAccountEventPublisher` warns only when nothing is registered.
  - `parseAccountEventMessage` keeps valid entries, drops an entry with a non-integer
    `account_id`, and returns null for malformed JSON or a value without `events`.
- `packages/orm/src/services/account/accountNotificationSignal.test.ts` (mock
  `@orm/lib/accountEventPublisher.js`'s `publishAccountEvents` only, via `importOriginal`):
  - A `created` signal with pairs for accounts 1, 2, 1 publishes two events: account 1 with both
    of its ids in order, then account 2.
  - `read_all` and `read_one` map to `notification.read_all` and `notification.read_one`.
  - `toAccountNotificationSignal` round-trips each of the three, returns null for
    `playback.progress`, and returns null for `notification.created` with an empty id list.
- `packages/orm/src/services/account/accountNotificationPublish.test.ts`: the write-path test
  D2 asks for. Mock only `@orm/db/index.js` (repositories) and `@orm/context.js`; use the real
  publisher and signal modules.
  - With `nodeEnv: 'test'` and no publisher registered, `createMany` with one DTO rejects with
    the missing-publisher error.
  - With a fake client registered, `createMany` resolves with the saved rows, and the fake
    client's `publish` runs after `save` resolved (record call order) with one
    `notification.created` event for the saved ids.
  - With a fake client registered, `AccountService.updateNotificationsLastReadAt` publishes one
    `notification.read_all` event after `save`.
  - With `nodeEnv: 'production'`, no publisher, `createMany` still resolves with the saved rows.
  - `afterEach` calls `unregisterAccountEventPublisher()`.
- `packages/orm/src/services/account/accountNotification.test.ts`: mock
  `./accountNotificationSignal.js` with `vi.mock` (plans 20 and 21 extend this mock). Assert
  `createMany` publishes the saved rows and still returns them, and that
  `getManyByIdsForAccount` with `[]` makes no query.

## Release scratchpad

none (plan 12's entry covers the stream and how API pods hear about changes; plans 14 and 15
carry the management API and worker env and secret changes)
