**Cursor model:** Cursor Grok 4.7 · **Reasoning:** extra high

# 10 — Account event stream contract (`@podverse/helpers`)

The client-facing contract for the account event stream: the account's one server-sent event
stream, which notifications use first. It holds the API path, stream-level constants, the
notification event names and data shapes, and one pure parser that web (area C) and mobile
(area D) both use to turn a received SSE event into a typed value. The server (plan 12) writes
these shapes; clients read them. No runtime code other than the parser and constants.

Cross-device playback is planned separately: seeing and controlling playback on another signed-in
device. It will join this stream under the reserved `playback.*` namespace, with no rename of the
path or constants here. Nothing in this set sends `playback.*`.

Other work is landing in the tree. Before editing, confirm that
`packages/helpers/src/dtos/account/accountNotification.ts` still exports `DTOAccountNotification`
and that `packages/helpers/src/index.ts` still re-exports `./lib/notificationCategory.js`.

## Rows

R20, R25, R42, R46

## Runs after

none

## Files

packages/helpers/src/lib/accountEventStream.ts
packages/helpers/src/lib/accountEventStream.test.ts
packages/helpers/src/index.ts

## Decisions this plan fixes

- **Transport is SSE** (R20, settled by the operator). The contract names SSE event types and the
  `Last-Event-ID` rule; there is no WebSocket message envelope.
- **One stream per client carries every account event type** (R42). The path names an account
  event stream, not a notifications stream, so the per-account stream limit and the shared web
  stream hold unchanged when playback joins.
- **Event types are namespaced.** `notification.*` is defined here. `playback.*` is reserved for
  cross-device playback. It will hold two kinds of event: latest-value state, and one-shot
  control commands such as pause, play, or seek. Neither carries an SSE `id:` and neither is
  replayed. A stale command delivered after a reconnect would act for no reason; a pause would
  stop playback that nobody asked to stop. Nothing in this set sends `playback.*`. Clients ignore
  any name they do not know, which the parser below enforces by returning null.
- **Four notification event types.** New notifications and read state are the two the operator
  named (R25). Two more exist so clients never guess: a state snapshot sent first on every
  connection, and a resync signal when replay cannot cover the gap.
- **Replay is per event type: only events that carry an SSE `id:` replay.** Of the notification
  events, only `notification.created` carries one, and its id is the notification's database id
  (`DTOAccountNotification.id`). Per the SSE spec, an event without an `id:` field leaves the
  client's last event id unchanged, so `Last-Event-ID` on reconnect is always the newest
  notification the client received. Read and state events are never replayed; the state snapshot
  on reconnect covers them. A latest-value event type, such as cross-device playback state, never
  carries an id and never replays; it sends a snapshot on connect, as `notification.state` does.
  A one-shot command type, such as a cross-device playback control, never carries an id and never
  replays either. A client that was disconnected when a command was sent never receives it. The
  SSE id space is notification ids, so a later event type that needs replay requires a new id
  format, which is a contract change.
- **Every event that changes the badge carries `unread_count`.** Clients set the badge from the
  event and do not refetch. The server computes the count when it delivers the event.

## Contract

Create `packages/helpers/src/lib/accountEventStream.ts`. Import
`DTOAccountNotification` with `import type` from `'../dtos/account/accountNotification.js'`.

### API path

```typescript
/**
 * The account's one event stream, relative to the versioned API base
 * (`${API_PREFIX}${API_VERSION}`). Event names are namespaced: `notification.*` is in use and
 * `playback.*` is reserved for cross-device playback state and control commands. Only events
 * that carry an SSE `id:` replay; latest-value state and one-shot commands never carry one.
 */
export const ACCOUNT_EVENTS_STREAM_API_PATH = '/account/events';
```

### Query parameter

```typescript
/**
 * Used only when the request has no `Last-Event-ID` header, for a client that starts a new
 * connection itself and still wants replay.
 */
export const ACCOUNT_EVENTS_STREAM_LAST_EVENT_ID_QUERY_PARAM = 'last_event_id';
```

### Event names

```typescript
export const ACCOUNT_NOTIFICATION_STREAM_EVENT = {
  state: 'notification.state',
  created: 'notification.created',
  read: 'notification.read',
  resync: 'notification.resync',
} as const;

export type AccountNotificationStreamEventName =
  (typeof ACCOUNT_NOTIFICATION_STREAM_EVENT)[keyof typeof ACCOUNT_NOTIFICATION_STREAM_EVENT];
```

### Data shapes

Field names are snake_case to match the existing DTOs.

```typescript
/**
 * First event on every connection, and again whenever the server recovers its own event feed.
 * Clients set the badge from it; it stands in for refetching the unread count on reconnect.
 */
export interface DTOAccountNotificationStreamState {
  unread_count: number;
  /** ISO timestamp of the account's Mark All as Read cutoff, or null if never set. */
  last_read_at: string | null;
}

/** One new notification. The SSE `id:` of this event equals `notification.id`. */
export interface DTOAccountNotificationStreamCreated {
  notification: DTOAccountNotification;
  unread_count: number;
}

/** Mark All as Read moved the cutoff. */
export interface DTOAccountNotificationStreamReadAll {
  scope: 'all';
  last_read_at: string;
  unread_count: number;
}

/** One notification was marked read on its own. */
export interface DTOAccountNotificationStreamReadOne {
  scope: 'one';
  notification_id: number;
  unread_count: number;
}

export type DTOAccountNotificationStreamRead =
  | DTOAccountNotificationStreamReadAll
  | DTOAccountNotificationStreamReadOne;

/** Replay could not cover the gap. Clients refetch the inbox list; the badge comes from `state`. */
export interface DTOAccountNotificationStreamResync {
  reason: 'replay_limit';
}

export type AccountNotificationStreamEvent =
  | { type: 'notification.state'; data: DTOAccountNotificationStreamState }
  | { type: 'notification.created'; data: DTOAccountNotificationStreamCreated }
  | { type: 'notification.read'; data: DTOAccountNotificationStreamRead }
  | { type: 'notification.resync'; data: DTOAccountNotificationStreamResync };
```

Use the `ACCOUNT_NOTIFICATION_STREAM_EVENT` constants for the `type` literals if TypeScript
accepts `typeof ACCOUNT_NOTIFICATION_STREAM_EVENT.state` in the union; otherwise keep the string
literals shown, which equal the constants.

### Server limits clients may rely on

```typescript
/** The server sends an SSE comment at this interval so proxies keep the connection open. */
export const ACCOUNT_EVENTS_STREAM_HEARTBEAT_MS = 25_000;

/** Most notifications the server replays from `Last-Event-ID` before it sends `notification.resync`. */
export const ACCOUNT_NOTIFICATIONS_REPLAY_LIMIT = 50;
```

### Parser

```typescript
/**
 * Turns one received notification event into a typed value, or null when the name is unknown or
 * the data does not match. Clients ignore null, so a newer server can add event types, including
 * cross-device playback state and commands in the reserved `playback.*` namespace, without
 * breaking older clients.
 */
export function parseAccountNotificationStreamEvent(
  eventName: string,
  rawData: string
): AccountNotificationStreamEvent | null;
```

Rules:

- `JSON.parse` inside `try`; return null on throw.
- Narrow with type guards; no `as` on the parsed value. Write small private guards
  (`isRecord`, `isFiniteNonNegativeInteger`, `isIsoStringOrNull`) in the same file.
- `notification.state`: `unread_count` is a non-negative integer; `last_read_at` is a string or
  null.
- `notification.created`: `unread_count` is a non-negative integer; `notification` is a record
  whose `id` and `account_id` are positive integers, `title` and `created_at` are strings, and
  `is_unread` is a boolean. Return the record as `DTOAccountNotification` after these checks; the
  guard is the one place an assertion is allowed, with a short comment that the server serializes
  the full DTO.
- `notification.read`: `scope` is `'all'` (requires string `last_read_at`) or `'one'` (requires
  positive integer `notification_id`); both require `unread_count`.
- `notification.resync`: `reason` is `'replay_limit'`.
- Any other name: null.

Export everything above from `packages/helpers/src/index.ts` with
`export * from './lib/accountEventStream.js';`, placed beside the
`./lib/notificationCategory.js` line.

Comments follow **comments-future-forward**: describe the contract, no plan references.

## Tests

`packages/helpers/src/lib/accountEventStream.test.ts` (Vitest, behavior-focused per
**unit-test-design-no-overgranularity**):

- Each of the four notification event types parses from a realistic JSON string to the expected
  typed value.
- Unknown event name returns null, including a reserved name such as `playback.progress` with
  valid JSON.
- Malformed JSON returns null.
- `notification.read` with `scope: 'one'` and no `notification_id` returns null.
- `notification.created` with a negative `unread_count` returns null.

## Release scratchpad

none (no shipped behavior until plan 12 serves these events; plan 12's entry covers the contract)
