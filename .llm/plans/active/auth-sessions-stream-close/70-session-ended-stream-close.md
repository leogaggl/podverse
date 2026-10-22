**Cursor model:** Opus 5.5 · **Reasoning:** high

# 70 — Ending a session closes its open account event streams

When a session ends on the server, every account event stream (`GET /account/events`) that
session holds closes at once, on whichever API pod holds it. Just before closing, the stream sends
one last `session.ended` event that carries the signed-out notice. The device does not wait for
its next request to learn it was signed out.

Plan numbers below 70 name plans of the `auth-sessions` set, now in
`.llm/plans/completed/auth-sessions/`; "realtime plan N" names plans of the
`realtime-banner-notifications` set, in `.llm/plans/completed/realtime-banner-notifications/`
once that set has closed. Both sets' code must already be merged into this branch.

Every session revocation goes through plan 10's ORM functions: the API session store
(plans 20–22), refresh-token reuse inside rotation (plan 10), and the management API's
`endUserAccountSessions` (plan 50). This plan publishes from those ORM functions, the same way the
`realtime-banner-notifications` set publishes notification changes from the ORM write methods
(its plan 11, decision D2). So no caller changes, and a future caller cannot forget to publish.

## Rows

R34, R35

## Runs after

The `auth-sessions` set (its plans 10, 20, 22, and 50 are the ones this plan builds on).

This plan also needs realtime plans 10, 11, 12, and 13 (the stream contract, the Redis fanout, the
API stream, and the API's Redis connections), plus realtime plan 14 (the management API's
publisher). If `apps/api/src/lib/accountEventStream/accountEventStreamHub.ts`
or `packages/orm/src/lib/accountEventPublisher.ts` does not exist, stop and report. Do not build
a substitute stream or publisher.

## Files

- packages/helpers/src/lib/authSessionNotice.ts
- packages/helpers/src/lib/authSessionNotice.test.ts
- packages/helpers/src/lib/accountEventStream.ts
- packages/helpers/src/lib/accountEventStream.test.ts
- packages/orm/src/lib/accountEventPublisher.ts
- packages/orm/src/services/account/accountSessionSignal.ts
- packages/orm/src/services/account/accountSessionSignal.test.ts
- packages/orm/src/services/account/accountSession.ts
- packages/orm/src/services/account/accountSession.test.ts
- packages/orm/src/index.ts
- apps/api/src/lib/auth/index.ts
- apps/api/src/lib/accountEventStream/accountEventStreamHub.ts
- apps/api/src/lib/accountEventStream/accountEventStreamHub.test.ts
- apps/api/src/controllers/account/accountEventStream.ts
- apps/api/src/test/account-events.test.ts
- apps/api/openapi.yml
- apps/api/APPS-API.md

## Before you start

Other work is landing in the tree. Confirm these exist and re-read them before editing:

- `@podverse/helpers`: `AUTH_SESSION_ENDED_NOTICES`, `AuthSessionEndedNotice`,
  `getAuthSessionEndedNotice`, and `parseAuthSessionEndedNotice` in `lib/authSessionNotice.ts`
  (plan 20). `isAccountSessionRevokeReason` and `AccountSessionRevokeReason` in
  `lib/accountSession.ts` (plan 10). `ACCOUNT_NOTIFICATION_STREAM_EVENT` and
  `parseAccountNotificationStreamEvent` in `lib/accountEventStream.ts` (realtime plan 10).
- `@podverse/orm`: `revokeAccountSession`, `revokeAccountSessions`, and
  `rotateAccountSessionRefreshToken` in `services/account/accountSession.ts` (plan 10).
  `AccountEventDataByType`, `AccountEvent`, and `publishAccountEvents` in
  `lib/accountEventPublisher.ts`, and `toAccountNotificationSignal` in
  `services/account/accountNotificationSignal.ts` (realtime plan 11).
- `apps/api`: `verifyTokenAndMembership`, the `AuthenticatedRequestOptions` type, and
  `clearAuthCookie` in `lib/auth/index.ts` (plan 20). `session_id_text` on `Express.User`
  (plan 20). The hub's `onEvent`, its per-account promise chain, and
  `ACCOUNT_EVENT_STREAM_MAX_LIFETIME_MS` in `accountEventStreamHub.ts`, and
  `AccountEventStreamController.stream` (realtime plan 12).

`apps/api/openapi.yml` is large. Find the `/account/events` operation by its `operationId`,
`apiGetAccountEvents`, and edit only that window and the component schemas next to
`ApiAccountNotificationStreamResync`.

## Decisions this plan fixes

- **Publish from the ORM revoke functions, not from the API session store or the management
  helper.** Rotation revokes a reused refresh token inside plan 10's transaction, so a store-level
  publish would miss it. The ORM functions are the one place every revocation passes through. The
  management API already registers a publisher (realtime plan 14), so `endUserAccountSessions`
  publishes with no change of its own.
- **The event names the ended sessions.** `revokeAccountSessions` returns the `id_text` of each
  row it changed (`RETURNING id_text`), and the event lists exactly those. It is not "every session
  of the account except X": a login that starts while the event is in flight must keep its new
  stream.
- **One new server-internal event type, `session.ended`**, carrying `session_id_texts` and the
  revoke `reason`. The reason crosses Redis between server processes only. Clients receive the
  mapped notice, never the reason (plan 20's rule).
- **One new client event, `session.ended`, with `{ notice }`.** It is the last event on the stream,
  and the server ends the response right after it. `notice` is null when the device signed itself
  out (`signed_out`, which also covers a second login in the same browser replacing its session).
  On a null notice clients reconnect as usual, and the reconnect succeeds or fails on its own.
  With a notice, clients stop reconnecting and sign out with that reason. The event carries no SSE
  `id:`, so it is never replayed.
- **The stream route keeps the cookie on a session-ended 401.** Plan 20 clears the cookie on every
  401 for a cookie-sourced token. `EventSource` cannot read a response body, so when the stream's
  reconnect is the first request to learn the session ended, clearing the cookie there would make
  the browser's next request a plain 401. The web page would then sign out without saying why.
  With the cookie kept, the web page's next ordinary request (the unread-count poll runs while the
  stream is down) gets the 401 with its notice. Plan 33's listener then signs the page out and
  shows the reason. An invalid JWT still clears the cookie.
- **A session that ended moments before its stream registers is still closed.** The session check
  runs in `verifyTokenAndMembership`, and the stream registers with the hub a few milliseconds
  later, after the account load. An event that lands in that gap would otherwise miss the stream.
  The hub remembers ended session ids for 60 seconds and closes a stream that registers for one
  of them.
- **The 30-minute stream cap stays (R35).** Revocation events now close streams at once in normal
  operation. The cap is still the backstop when no event arrives:
  - A revocation during a Redis outage is dropped. Publishing never fails the write, per realtime
    plan 11.
  - Account deletion ends sessions by cascade and publishes no event.
  - After a scale-out, the cap is what spreads clients across the new pods.

  Its cost stays one authenticated reconnect per client per 30 minutes. The hub does not re-check
  every open stream's session when Redis recovers. The cap bounds that gap, and a re-check would
  cost one query per open stream at the moment the pod is catching up.
- **Account deletion publishes nothing.** Plan 10's `ON DELETE CASCADE` removes the rows without a
  revoke call. A deleted account's streams carry no further events and close at the cap or token
  expiry. That device's next ordinary request is a plain 401.
- **Mobile needs no change.** The mobile stream (realtime plan 40) ignores event names it does not
  know. When the server ends the response, the controller reconnects through
  `runWithMobileAuthRefresh`. The refused access token triggers one refresh, and the refresh 401
  carries the notice that plan 41 shows. That happens within about a second of the revocation.

## Contract (`@podverse/helpers`)

### `lib/authSessionNotice.ts`

If plan 20 did not already add it, add and export:

```typescript
export function isAuthSessionEndedNotice(value: unknown): value is AuthSessionEndedNotice;
```

`typeof value === 'string' && AUTH_SESSION_ENDED_NOTICES.some((notice) => notice === value)`, with
no `as`. Make `parseAuthSessionEndedNotice` use it. Its behavior does not change.

### `lib/accountEventStream.ts`

- In the doc comment on `ACCOUNT_EVENTS_STREAM_API_PATH`, list the namespaces in use as
  `notification.*` and `session.*`, with `playback.*` reserved.
- Add:

```typescript
export const ACCOUNT_SESSION_STREAM_EVENT = {
  ended: 'session.ended',
} as const;

/**
 * Last event on a stream whose session was ended; the server closes the stream after it. A null
 * notice means this device signed itself out, and the client reconnects as usual. With a notice
 * the client stops reconnecting and signs out with that reason.
 */
export interface DTOAccountSessionStreamEnded {
  notice: AuthSessionEndedNotice | null;
}

export type AccountSessionStreamEvent = {
  type: 'session.ended';
  data: DTOAccountSessionStreamEnded;
};

/** Parses one received `session.*` event, or returns null for any other name or invalid data. */
export function parseAccountSessionStreamEvent(
  eventName: string,
  rawData: string
): AccountSessionStreamEvent | null;
```

Parsing uses `JSON.parse` in `try`, the file's existing `isRecord` guard, and `notice` must be
null or pass `isAuthSessionEndedNotice`. A missing `notice` key is invalid (null). Import the
notice type with `import type` and the guard by value from `./authSessionNotice.js`.
`parseAccountNotificationStreamEvent` already returns null for `session.ended`. Leave it as it is.

The barrel already exports the whole file. Mobile does not use the new parser (see Decisions).

## Server events (`@podverse/orm`)

### `lib/accountEventPublisher.ts`

Add to `AccountEventDataByType`:

```typescript
'session.ended': { session_id_texts: string[]; reason: AccountSessionRevokeReason };
```

`import type { AccountSessionRevokeReason } from '@podverse/helpers'`. Add `session.*` to the
namespace list in the type's doc comment.

### `services/account/accountSessionSignal.ts` (new)

```typescript
export type AccountSessionEndedSignal = {
  account_id: number;
  session_id_texts: string[];
  reason: AccountSessionRevokeReason;
};

/** Publishes one `session.ended` event. Call only after the revoke has committed. */
export async function publishAccountSessionsEnded(signal: AccountSessionEndedSignal): Promise<void>;

/** The signal a `session.ended` account event carries, or null for any other or malformed event. */
export function toAccountSessionEndedSignal(event: AccountEvent): AccountSessionEndedSignal | null;
```

- `publishAccountSessionsEnded` returns without publishing when `session_id_texts` is empty.
  Otherwise it calls `publishAccountEvents` with one event,
  `{ account_id, type: 'session.ended', data: { session_id_texts, reason } }`. The publisher's own
  rules apply unchanged: it never throws on a Redis failure, warns when nothing is registered, and
  throws in a test-env ORM with no publisher.
- `toAccountSessionEndedSignal`: `event.type === 'session.ended'`, `data` a record,
  `session_id_texts` a non-empty array of non-empty strings, and `reason` passing
  `isAccountSessionRevokeReason`. Otherwise null. Private guards, no `as`.

Export the file from `packages/orm/src/index.ts`, next to the `accountSession` service export.

### `services/account/accountSession.ts` (plan 10's service)

Publish after the write commits, never inside a transaction callback:

- `revokeAccountSession`: when it returns true, `await publishAccountSessionsEnded({ account_id:
  accountId, session_id_texts: [sessionIdText], reason })`. False publishes nothing.
- `revokeAccountSessions`: add `RETURNING id_text` to its `UPDATE` and read each row's `id_text`
  with the file's existing row-reading style (`Reflect.get` plus narrowing). Publish the list. The
  return value stays the count (the number of returned rows), so plan 20's store, plan 50's
  helper, and their tests do not change.
- `rotateAccountSessionRefreshToken`: when the outcome is `reused`, publish
  `{ session_id_texts: [sessionIdText], reason: 'refresh_reuse' }` after the transaction resolves
  and before returning. No other outcome publishes.
- `touchAccountSession`, `createAccountSession`, and `deleteAccountSessionsIdleExpiredBefore`
  (the idle purge) publish nothing.

Add one line to the doc comment of each publishing function saying that it publishes
`session.ended` after it commits.

Check callers: run `rg -n "revokeAccountSessions?\(|rotateAccountSessionRefreshToken\(" apps packages --glob '!*.md'`.
Every runtime caller is in a process that registers a publisher: the API (realtime plan 13) and
the management API (realtime plan 14). If a worker or tool calls one, stop and report. For each test
that reaches these functions unmocked in a test-env ORM, either register the no-op publisher
(`{ publish: async () => 0 }`) in its setup or mock `./accountSessionSignal.js`. `startTestApp`
already registers it for API integration tests. Plan 50's `users.integration.test.ts` spies on
`revokeAccountSessions`, so it does not reach the publisher.

## API

### Stream route keeps the cookie (`apps/api/src/lib/auth/index.ts`)

Add `keepCookieOnSessionEnded?: boolean` to `AuthenticatedRequestOptions`. In
`verifyTokenAndMembership`, the branch that answers a session-ended check with a 401 skips
`clearAuthCookie` when the option is true. Every other 401 behaves as plan 20 wrote it. Doc
comment on the option: for routes a browser reaches through `EventSource`, which cannot read the
401 body, so the cookie stays for the next request to report why the session ended.

### Controller (`apps/api/src/controllers/account/accountEventStream.ts`)

- Pass `keepCookieOnSessionEnded: true` alongside `skipMembershipStatus: true` in its
  `ensureAuthenticated` call.
- Read `req.user.session_id_text`. If it is not a non-empty string, answer 401
  `{ message: 'Unauthorized' }` before any stream bytes. After plan 20 every authenticated request
  has one, so this never answers a real client. It keeps an unbound stream from existing.
- Pass `sessionIdText` to the hub when registering.

### Hub (`apps/api/src/lib/accountEventStream/accountEventStreamHub.ts`)

- Each `AccountEventStream` gains `sessionIdText: string` and `ended: boolean`.
- Route every way a stream ends through one private `endStream(stream)`: set `ended`, clear its
  heartbeat and end timers, remove it from `streamsByAccount` (deleting an empty set), and call
  `res.end()` inside `try`. That covers token expiry, the 30-minute cap, a write failure or
  backpressure, client close, hub shutdown, and session end. `endStream` on an ended stream does
  nothing.
- Every write checks `stream.ended` first. The per-account chain reads the account's current set
  when it writes, not a copy taken before its query. So a stream ended while a notification query
  was in flight gets nothing more.
- **`onEvent`**: call `toAccountSessionEndedSignal(event)` first. A non-null signal is handled at
  once, outside the per-account chain, with no query:
  1. Record each id in `recentlyEndedSessions` (below) with its notice,
     `getAuthSessionEndedNotice(signal.reason)` from `@podverse/helpers`. This step runs whether
     or not this pod holds a stream for the account, because the stream may be registering.
  1. For each stream of `signal.account_id` whose `sessionIdText` is in the list: write
     `formatSseEvent({ event: ACCOUNT_SESSION_STREAM_EVENT.ended, data: { notice } })` (no id),
     then `endStream`. A write that throws still ends the stream.
  1. Streams of the same account on other sessions stay open.

  Otherwise fall through to the existing notification handling and the unknown-type `debug` log,
  unchanged.
- **`recentlyEndedSessions`**: a `Map<string, { notice: AuthSessionEndedNotice | null;
  expiresAtMs: number }>`, keyed by session id text. Entries live 60 seconds
  (`RECENTLY_ENDED_SESSION_TTL_MS = 60_000`). Prune expired entries on each insert. When the map
  holds more than 10,000 entries (`RECENTLY_ENDED_SESSION_MAX = 10_000`), drop the oldest
  insertions. A `Map` iterates in insertion order. `closeAccountEventStreamHub` clears it.
- **Registration**: before the hub sends `notification.state` or replay, look up the stream's
  `sessionIdText` in `recentlyEndedSessions`. On an unexpired hit, write the `session.ended` event
  with the stored notice and `endStream`, and send nothing else.
- **`ACCOUNT_EVENT_STREAM_MAX_LIFETIME_MS`** stays `30 * 60_000`. Rewrite its doc comment to give
  the reasons in the Decisions above. A session-ended event closes a stream at once, and the cap
  bounds a stream whose event never arrived: a revocation during a Redis outage, or account
  deletion. The cap also spreads clients across pods after a scale-out. Leave the token-expiry end
  as it is.

Comments describe the code as it stands (**comments-future-forward**). No plan numbers.

## OpenAPI (`apps/api/openapi.yml`, `apiGetAccountEvents`)

- Description: add `session.*` to the namespaces, and describe `session.ended` as the last event
  on a stream whose session was ended, sent with no `id:`. With a notice, clients stop
  reconnecting and sign out with that reason; with null, they reconnect as usual. Also say that a
  session-ended `401` on this route leaves the `jwt` cookie in place.
- Add component schema `ApiAccountSessionStreamEnded` (object, required `notice`, `notice`
  nullable string with the four-value enum `signed_out_elsewhere`, `password_changed`,
  `admin_force_logout`, `security`) next to `ApiAccountNotificationStreamResync`, and reference it
  from the description the way the notification schemas are referenced.
- The `401` response: add the `sessionEnded` example plan 20 added to `/auth/me`, if that example
  is a reusable component; otherwise leave the `401` as it is.

## Docs (`apps/api/APPS-API.md`, `### Account event stream`)

Add a short paragraph:

- Ending a session from anywhere closes that session's streams on every pod at once, through a
  `session.ended` event on `podverse:account-events`. The stream sends `session.ended` with the
  signed-out notice and then ends.
- Streams still end after 30 minutes. That is the backstop when the event is lost (Redis outage)
  and when an account is deleted.
- This route keeps the cookie on a session-ended 401.

## Must stay true

- A revocation is committed before any API pod hears about it.
- A Redis failure never throws out of `revokeAccountSession`, `revokeAccountSessions`, or
  `rotateAccountSessionRefreshToken`, and never changes their return values.
- A session-ended event closes only streams of the listed sessions on the listed account.
- The raw revoke reason never reaches a client. The client event carries only the notice.
- No stream receives a write after it ended.
- No new dependency, env var, or manifest change.

## Tests

- `packages/helpers/src/lib/accountEventStream.test.ts`:
  - `parseAccountSessionStreamEvent('session.ended', …)` returns the event for each of the four
    notices and for `null`;
  - an unknown notice string, a missing `notice` key, malformed JSON, and the name
    `notification.state` each return null;
  - `parseAccountNotificationStreamEvent('session.ended', '{"notice":null}')` returns null.
- `packages/helpers/src/lib/authSessionNotice.test.ts`: `isAuthSessionEndedNotice` accepts each
  notice and rejects `'signed_out'`, `''`, and a number.
- `packages/orm/src/services/account/accountSessionSignal.test.ts`: mock
  `@orm/lib/accountEventPublisher.js` `publishAccountEvents` through `importOriginal`.
  - A two-id signal publishes one `session.ended` event with both ids and the reason.
  - An empty list publishes nothing.
  - `toAccountSessionEndedSignal` round-trips a published event. It returns null for
    `notification.created`, an empty id list, a non-string id, and an unknown reason.
- `packages/orm/src/services/account/accountSession.test.ts` (extend plan 10's file): mock
  `./accountSessionSignal.js`.
  - `revokeAccountSession` returning true publishes once with its id and reason. Returning false
    publishes nothing.
  - `revokeAccountSessions` with two returned rows publishes both ids and returns 2. Zero rows
    publishes nothing and returns 0.
  - A reused refresh token publishes `refresh_reuse` for that session after the transaction
    resolves. A rotated token publishes nothing.
- `apps/api/src/lib/accountEventStream/accountEventStreamHub.test.ts` (extend realtime plan 12's
  file). Keep the real `toAccountSessionEndedSignal` in the `@podverse/orm` mock.
  - Account 1 has streams on sessions A and B. A `session.ended` event for A with reason
    `admin_force_logout` writes `session.ended` with notice `admin_force_logout` to A and ends it,
    leaves B open, and runs no query.
  - Reason `signed_out` writes `notice: null`.
  - A `session.ended` for account 1 does not touch account 2's stream that happens to use the same
    session id text.
  - A `notification.created` whose row query resolves after A ended writes nothing to A and still
    reaches B.
  - Registering a stream for a session ended 30 seconds earlier (fake timers) writes only
    `session.ended` and ends. Registering one 61 seconds after the event behaves normally.
  - Every end path calls `res.end()` once and leaves no timer.
- `apps/api/src/test/account-events.test.ts` (extend realtime plan 12's file, stub session store):
  - The captured `onEvent` with `{ account_id: <test account>, type: 'session.ended', data: {
    session_id_texts: [TEST_ACCOUNT_SESSION_ID_TEXT], reason: 'signed_out_elsewhere' } }` yields a
    `session.ended` event with `{ "notice": "signed_out_elsewhere" }`, and then the response ends.
  - With `accountSessionStoreStub.checkAccountSession` resolving once to `{ kind: 'ended', notice:
    'signed_out_elsewhere' }` and the token sent as the `jwt` cookie, `GET /account/events` is 401
    with `code: 'session_ended'` and has no `Set-Cookie` that clears `jwt`. The same stubbed check
    on `GET /auth/me` still clears it, which is plan 20's behavior.

The full path through Redis is covered by plan 71's Playwright case.

## Release scratchpad

```markdown
## Ending a session closes its live account event streams

- Surfaces: api, management-api, helpers, orm
- Change: when a session ends (sign out of one device, Sign Out of All Other Devices, a password
  change or reset, admin Force Logout, admin password set, or a reused refresh token), every open
  `GET /account/events` stream of that session closes at once on every API pod. Before closing,
  the stream sends a last `session.ended` event with `{ notice }`: the same notice the
  session-ended 401 carries, or null when the device signed itself out. Revocations publish a
  `session.ended` event on the Redis channel `podverse:account-events` after they commit. A
  session-ended 401 on `GET /account/events` no longer clears the `jwt` cookie, so the browser's
  next request can report why the session ended. The 30-minute stream lifetime stays as the
  backstop when an event is lost during a Redis outage, and for deleted accounts.
- Who notices: web users see the signed-out dialog right away (separate entry); mobile apps sign
  out with the reason within about a second instead of on their next request
- Operator steps: none
```
