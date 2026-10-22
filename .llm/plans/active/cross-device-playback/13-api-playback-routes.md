**Cursor model:** Opus 5.5 · **Reasoning:** high

# 13 — API playback routes and request calls

The HTTP side of cross-device playback (R29): a device checks in, publishes its state or claims
the active slot, sends a target-state command to another device, and reports that it could not
start audio. Each route writes through plan 12's store and service, and the hub (plan 14) pushes
the resulting `playback.*` events down each device's account event stream. Plus the
`@podverse/helpers-requests` calls web and mobile use, OpenAPI, and integration tests.

Other work is landing in the tree. Before editing, confirm that:

- `apps/api/src/lib/auth/index.ts` `verifyTokenAndMembership` sets `req.user.session_id_text` from
  an active `checkAccountSession` result (auth-sessions plan 20), and `Express.User` in
  `apps/api/src/@types/express.d.ts` has `session_id_text`.
- `apps/api/src/lib/accountPlayback/playbackService.ts` and `playbackStore.ts` exist (plan 12).
- `/account/events` is in `apps/api/openapi.yml` (realtime plan 12).

If any is missing, stop and report.

## Rows

R1, R19, R20, R23, R24, R25, R26, R29, R30, R31, R32, R43, R54, R66, R68

## Runs after

10, 11, 12

## Files

apps/api/src/@types/express.d.ts
apps/api/src/lib/auth/index.ts
apps/api/src/routes/accountPlayback.ts
apps/api/src/controllers/account/accountPlayback.ts
apps/api/src/app.ts
apps/api/src/test/account-playback.test.ts
apps/api/openapi.yml
packages/helpers-requests/src/api/account/playback.ts
packages/helpers-requests/src/api/account/playback.test.ts
packages/helpers-requests/src/api/_request.ts
packages/helpers-requests/src/api/index.ts
release-notes/scratchpad.md

## Answers to the request's questions

- **R66, does it need a membership?** Yes. Every route here uses `ensureAuthenticated` with
  `skipMembershipStatus: false`, the gate the queue's now-playing routes use. Cross-device
  queue and history sync is already a membership feature (`MEMBERSHIP_COMPARISON_FEATURES` key
  `sync`, free false), and a remote item pick or a transfer needs the server queue the active
  device writes. Signed-in accounts without an active membership get the existing 403
  `membership_expired` body; clients read it with `parseMembershipGateError`, stop checking in,
  and show no device icon (areas B, C, D, E). The account event stream itself stays open to every
  signed-in account for notifications. Anonymous users have no stream and no session, so no
  device switching (R67 is area E's copy).
- **R68, how does a remote item pick meet the queue?** Commands never edit a queue on the
  server. The active device is the only writer of now-playing: it runs a `play_item` through its
  normal local play path, which calls the existing queue now-playing route for that resource
  (`POST /queue/:queue_id_text/item/:item_id_text/now-playing` and its clip, soundbite, and Add by
  RSS siblings). That route moves the previous now-playing row to history and marks that queue the
  account's active one (`_setQueueAsActiveTransactional` in
  `packages/orm/src/services/queue/queueResource.ts`), exactly as a local pick does. Queue edits
  from a non-playing device (play next, play last, reorder, remove) keep using the existing queue
  routes directly. Each device keeps its own local queue view and refetches from the server as it
  does today; the server's one active queue per account is unchanged. No queue-changed event is
  added: position saves also go through the now-playing routes, so hooking queue writes would fan
  out every few seconds. A playing device that auto-advances should refetch upcoming first so a
  remote "play next" is honored (note for areas B, C).

## `Express.User` and the auth middleware

Add to `Express.User`, next to plan 20's `session_id_text`:

```typescript
session_client_type?: AccountSessionClientType;
session_device_label?: string | null;
/** ISO 8601 */
session_created_at?: string;
```

In `verifyTokenAndMembership`, where plan 20 sets `session_id_text` from the active session row,
set these three from the same row (`client_type`, `device_label`, `created_at.toISOString()`;
use the row's actual field names from auth-sessions plan 10). No new query. Optional because
other request paths that build `req.user` (tests, mocks) may not set them; the playback
controller treats a missing value as a 401, below.

## Router

`apps/api/src/routes/accountPlayback.ts`, exporting `accountPlaybackRouter`, mounted on
`${config.api.prefix}${config.api.version}/account/playback` the way `queue.ts` mounts itself.
Register it in `apps/api/src/app.ts` with the other dynamic route imports, immediately before
`accountRouter` (the account router's `GET /:id_text` catch-all matches single segments only, so
order is not load-bearing; placing it first keeps that obvious).

All routes share one per-account limiter defined in the router file:

```typescript
const playbackRateLimit = rateLimitAuthEndpoint({ windowMs: 60_000, max: 240 });
```

240 per minute per account per pod covers several devices checking in every 15 s, a playing
device publishing every 10 s plus discrete changes, and a person scrubbing or tapping skip
repeatedly. It is a code constant like `strikeCheckoutPollRateLimit` in `billing.ts`, not an env
var.

| Method and path | Handler |
| --- | --- |
| `POST /presence` | `AccountPlaybackController.checkIn` |
| `POST /state` | `AccountPlaybackController.publishState` |
| `POST /commands` | `AccountPlaybackController.sendCommand` |
| `POST /commands/:command_id/start-failed` | `AccountPlaybackController.reportStartFailed` |

Each wrapped in `asyncHandler`, after `playbackRateLimit`.

## Controller

`apps/api/src/controllers/account/accountPlayback.ts`, class `AccountPlaybackController`, each
method inside `ensureAuthenticated(req, res, handler, { skipMembershipStatus: false })`, with
bodies validated by Joi through `validateBodyObject` as `apps/api/src/controllers/queue/queue.ts`
does.

Shared steps:

- `getPlaybackCaller(req)`: `getAuthenticatedUser(req)`; when `session_id_text`,
  `session_client_type`, or `session_created_at` is missing, respond 401
  `{ message: 'Unauthorized' }`. Returns `{ accountId, device: DTOPlaybackDevice }`.
- `nowMs = Date.now()` once per request; pass it everywhere.
- `PlaybackStoreUnavailableError` (plan 12) → 503 `{ message: 'Playback is unavailable.', code:
  'playback_unavailable' }`. Other errors → `handleGenericErrorResponse`.
- Joi schemas mirror plan 10's guards exactly (same limits, same live rules); keep them in one
  `playbackSchemas` object at the top of the controller. After Joi, run plan 10's guard on the
  body as a second check so the two can never drift; a guard failure is a 400.

### `checkIn` — `POST /account/playback/presence`

1. `touchPlaybackPresence({ accountId, device, nowMs })`.
1. `handlePlaybackPresenceChange({ accountId, result, nowMs })` (publishes `playback.devices` when
   the device joined or others were pruned, and clears the active slot when its device left).
1. Respond 200 `PlaybackPresenceResponse`: `session_id_text` = caller, plus `devices` and `state`
   from `readPlaybackDevices` and `readPlaybackState` (as a DTO with `sent_at_ms = nowMs`, or
   null). The touch already pruned, so do not call `readPlaybackSnapshot` here.

The response gives a device everything it needs on start without waiting for the stream
snapshot: who it is, who else is here, and what is playing.

### `publishState` — `POST /account/playback/state`

Body `PlaybackStatePublishBody`.

1. `touchPlaybackPresence` for the caller (a state publish is also a check-in), then
   `handlePlaybackPresenceChange`.
1. `readPlaybackState`, then `decidePlaybackStatePublish`.
1. `not_active` → 409 `{ message, code: 'playback_not_active_device', active_session_id_text }`.
1. `unchanged` → 200 `{ revision, active_session_id_text }` from the read. Nothing published.
1. `write` → `compareAndSetPlaybackState` with the read revision; `expectedActive` is `any` for a
   claim and the caller for every other write. On `conflict`, re-read and decide again, up to 3
   attempts; the third conflict is a 409 `playback_not_active_device` with the latest active id.
   On `written`, `publishPlaybackState` and respond 200 `{ revision, active_session_id_text }`.

A claim by a device that is already active is an ordinary write. A claim is never refused because
another device is active (it can only lose three revision races in a row, and then the client
claims again); the previous active device learns it lost from the `playback.state` event.

### `sendCommand` — `POST /account/playback/commands`

Body `PlaybackCommandSendBody`.

1. `readPlaybackState` → `current`.
1. Resolve the target:
   - `take_over`: `target_session_id_text` is required (400 without it). When it equals the
     caller → 400 `{ code: 'playback_take_over_self' }` (taking over on this device is a local
     play and claim). When it equals `current.activeSessionIdText` → 409
     `playback_target_already_active`. When `current.state` is null or its `resource` is null →
     409 `playback_nothing_to_transfer`.
   - Every other type: `target_session_id_text` must be absent (400 otherwise). Target =
     `current.activeSessionIdText`; null → 409 `playback_no_active_device`. The target may be the
     caller's own session: tabs that share one session coordinate through their own stream
     (area B).
1. `isPlaybackSessionPresent` for the target; false → 409 `playback_device_not_connected`.
1. When `current.state?.is_live` and `!isPlaybackCommandAllowed(command.type, { isLive: true })` →
   409 `playback_command_not_allowed_for_live`.
1. `command_id = randomUUID()` from `node:crypto`, `issued_at_ms = nowMs`, `expires_at_ms = nowMs +
   PLAYBACK_COMMAND_TTL_MS`.
1. `savePlaybackCommand(command_id, { account_id, sender_session_id_text, target_session_id_text,
   expires_at_ms })`.
1. Publish `playback.command` with a `DTOPlaybackCommandEnvelope`; `state` is
   `toPlaybackStateDto(current.state, nowMs)` for `take_over`, else null.
1. Respond 202 `PlaybackCommandSendResponse`.

The server never stores a command for delivery and never retries it. When the target's stream is
not on any pod at that moment, the command is lost, which is the one-shot rule (R31). The sender
sees the outcome in state: a `seek` moves the position, a `pause` changes status, a `take_over`
changes the active device. A `take_over` with no claim and no start-failed report within
`PLAYBACK_TAKE_OVER_RESULT_TIMEOUT_MS` is shown as not started (areas D, E).

### `reportStartFailed` — `POST /account/playback/commands/:command_id/start-failed`

Body `PlaybackStartFailedBody`. Param `command_id`: a UUID string (Joi `.guid()`).

1. `readPlaybackCommand(command_id)`; null, a different `account_id`, or a
   `target_session_id_text` that is not the caller → 404 `{ message: 'Command not found' }`.
1. Publish `playback.start_failed` with `{ command_id, sender_session_id_text,
   target_session_id_text, reason }`.
1. Respond 204.

Any command that asks the target to start audio can fail this way (`play`, `play_item`,
`take_over`); the record lives 60 s, longer than the command, because a tap-to-play prompt can
take a while to fail visibly.

## `@podverse/helpers-requests`

`packages/helpers-requests/src/api/account/playback.ts`, following `account/contentLog.ts`
(`api.apiRequest`, `withCredentials: true`):

```typescript
export const reqAccountPlaybackCheckIn = (api: ApiRequestService): Promise<PlaybackPresenceResponse>;
export const reqAccountPlaybackPublishState = (
  api: ApiRequestService,
  body: PlaybackStatePublishBody
): Promise<PlaybackStatePublishResponse>;
export const reqAccountPlaybackSendCommand = (
  api: ApiRequestService,
  body: PlaybackCommandSendBody
): Promise<PlaybackCommandSendResponse>;
export const reqAccountPlaybackReportStartFailed = (
  api: ApiRequestService,
  params: { commandIdText: string; body: PlaybackStartFailedBody }
): Promise<void>;

export interface PlaybackApiError {
  code: PlaybackErrorCode;
  /** Present on `playback_not_active_device`. */
  activeSessionIdText?: string | null;
}

/** Reads a thrown request error (axios-style `error.response`), or null when it is not a playback error. */
export function parsePlaybackApiError(error: unknown): PlaybackApiError | null;
```

`PlaybackErrorCode` and `PLAYBACK_ERROR_CODES` come from plan 10. `parsePlaybackApiError` is
written like
`parseMembershipGateError` (a local `isRecord`, status 409, 400, or 503, and a `code` string it
knows). Add the four methods to `ApiRequestService` in `_request.ts` next to
`reqAccountContentLog`, and export `parsePlaybackApiError` and `PlaybackApiError` from
`packages/helpers-requests/src/api/index.ts` next to `parseMembershipGateError`.

## OpenAPI

`apps/api/openapi.yml`, next to `/account/events`:

- `/account/playback/presence` post, `operationId: apiPostAccountPlaybackPresence`.
- `/account/playback/state` post, `operationId: apiPostAccountPlaybackState`.
- `/account/playback/commands` post, `operationId: apiPostAccountPlaybackCommand`.
- `/account/playback/commands/{command_id}/start-failed` post,
  `operationId: apiPostAccountPlaybackStartFailed`.

All tagged `account`, security bearer and cookie, with `400`, `401`, `403` (membership and terms),
`429`, `503`, and the route's `409` codes. Component schemas matching plan 10:
`ApiPlaybackResourceRef`, `ApiPlaybackResourceSummary`, `ApiPlaybackState`, `ApiPlaybackDevice`,
`ApiPlaybackDevices`, `ApiPlaybackSnapshot`, `ApiPlaybackCommand` (`oneOf` with a `type`
discriminator),
`ApiPlaybackCommandEnvelope`, `ApiPlaybackStartFailed`, and the request and response bodies.

On `/account/events`, update the description: `playback.*` is in use, list `playback.snapshot`
(devices and state, sent after the notification snapshot on connect and after the API recovers
its Redis subscription; it replaces the client's playback view), `playback.state` and
`playback.devices` (latest-value, on change, ordered by `revision`), `playback.command` (only to
the target device's streams) and
`playback.start_failed` (only to the sender's streams), none with an `id:`, and reference the
component schemas. Plan 14 implements that delivery; this plan owns every `openapi.yml` edit so the
two plans do not collide.

## Tests

- `apps/api/src/test/account-playback.test.ts` (integration; `startTestApp` with the account and
  membership mocks `queue.test.ts` uses, real test Valkey through plan 12's harness, and a
  capturing publisher registered with `registerAccountEventPublisher` after `startTestApp`; mock
  `checkAccountSession` the way auth-sessions plan 20's tests do so two different session ids can
  call as one account). Delete `podverse:playback:<id>:*` keys after each test.
  - No auth → 401; expired membership → 403 `membership_expired`; a valid member → 200.
  - Check-in by device A returns `session_id_text` A, one device, null state, and publishes
    `playback.devices`. Check-in by B returns both devices; A's second check-in publishes nothing.
  - A publishes without a claim before anything is active → 409 `playback_not_active_device`
    with `active_session_id_text: null`.
  - A claims → 200 revision 1, `playback.state` published with A active. B claims → A is no
    longer active; A's next non-claim publish → 409 with B's id.
  - A periodic publish within the drift tolerance → 200 with the same revision and no event; a
    seek → a new revision and an event.
  - `pause` from B with A active → 202 and a `playback.command` envelope targeting A with
    `expires_at_ms - issued_at_ms` equal to `PLAYBACK_COMMAND_TTL_MS` and null `state`.
  - `{ type: 'toggle' }` → 400; `seek` with a negative position → 400; `target_session_id_text`
    on `pause` → 400.
  - `seek` while the stored state is live → 409 `playback_command_not_allowed_for_live`; `pause`
    while live → 202.
  - `take_over` to B with A active → envelope targeting B whose `state` is the stored state;
    to A (already active) → 409; to the caller itself → 400; to an absent session → 409
    `playback_device_not_connected`; with nothing loaded → 409 `playback_nothing_to_transfer`.
  - `play` with nothing active → 409 `playback_no_active_device`.
  - Start failed from the target → 204 and a `playback.start_failed` event naming the sender;
    from another session → 404; an unknown id → 404.
  - A release (`resource: null`) by A → state with no active device; B's `pause` → 409
    `playback_no_active_device`.
  - Redis unavailable (close the playback connection in the test) → 503
    `playback_unavailable`; reopen it afterwards.
- `packages/helpers-requests/src/api/account/playback.test.ts` (unit):
  `parsePlaybackApiError` reads a 409 with `playback_not_active_device` and its active id, a 503
  `playback_unavailable`, and returns null for a 403 membership body, a 409 with an unknown code,
  and a non-object.

## Release scratchpad

```markdown
## Cross-device playback API

- Surfaces: api, ops
- Change: new membership-gated routes under `/account/playback` for exclusive active-device
  handoff. `POST /account/playback/presence` checks a device in (a device is a login session) and
  returns this device's session id, the connected devices, and the current playback state.
  `POST /account/playback/state` lets the playing device publish its item, status, position, and
  rate, or claim the active slot (one playing device per account; the last claim wins).
  `POST /account/playback/commands` sends a target-state command (`play`, `pause`, `seek`,
  `set_rate`, `play_item`, or `take_over` to move playback to another device) to the playing
  device through the account event stream; commands expire after 5 seconds and are never
  replayed. Live items accept only play, pause, play item, and take over.
  `POST /account/playback/commands/{command_id}/start-failed` lets the target report that it could
  not start audio, and the sending device is told. The account event stream now carries
  `playback.snapshot` (on connect), `playback.state`, `playback.devices`, `playback.command` (only
  to the target device), and `playback.start_failed` (only to the sender). Presence,
  the active device, and the latest state live in Redis (Valkey) with short expiry, on a new
  connection named `podverse-api-playback` per API pod. A device that stops checking in leaves
  the device list within about 50 seconds; a cleanly closed stream within about 5 seconds.
- Who notices: no one until web and mobile use it. Members on several devices then see and
  control playback across them. Operators see one more Redis connection per API pod.
- Operator steps: none; it uses the existing `KEYVALDB_*` settings.
```
