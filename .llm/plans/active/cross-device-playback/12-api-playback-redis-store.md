**Cursor model:** Opus 5.5 · **Reasoning:** extra high

# 12 — API playback store: presence, active device, and state in Redis

The API's shared memory for cross-device playback, held in Redis (Valkey) so every API pod sees
the same answer: which devices are connected now (presence), which one plays (the active device),
and the latest state it published. Plus the service functions that turn a change in that memory
into `playback.*` events on the existing account event fanout. Routes (plan 13) and the stream hub
(plan 14) call this module; neither touches the keys directly.

Several API pods and several devices write at once, so every read-modify-write is one Lua script
or a compare-and-set on a revision, and every presence removal is reported to exactly one caller.

Other work is landing in the tree. Before editing, confirm that:

- `apps/api/src/lib/accountEvents/accountEventRedis.ts` exists with its private connection factory
  and `ACCOUNT_EVENT_REDIS_RECONNECT_DELAY_MS` import (realtime plan 13).
- `packages/orm/src/lib/accountEventPublisher.ts` exports `AccountEventDataByType` and
  `publishAccountEvents` (realtime plan 11).
- `packages/helpers/src/lib/accountPlaybackStream.ts` (plan 10) and
  `packages/helpers/src/lib/crossDevicePlayback.ts` (plan 11) exist.

If any is missing, stop and report.

## Rows

R1, R19, R32, R36, R54, R57

## Runs after

10, 11

## Files

apps/api/src/lib/accountPlayback/playbackRedis.ts
apps/api/src/lib/accountPlayback/playbackRedis.test.ts
apps/api/src/lib/accountPlayback/playbackStoreScripts.ts
apps/api/src/lib/accountPlayback/playbackStore.ts
apps/api/src/lib/accountPlayback/playbackStatePolicy.ts
apps/api/src/lib/accountPlayback/playbackStatePolicy.test.ts
apps/api/src/lib/accountPlayback/playbackService.ts
apps/api/src/test/account-playback-store.test.ts
packages/orm/src/lib/accountEventPublisher.ts
apps/api/src/index.ts
apps/api/src/test/helpers/index.ts
apps/api/ENV.md

## Decisions this plan fixes

- **Presence is a check-in, not the stream's heartbeat** (R36). A device calls
  `POST /account/playback/presence` (plan 13) every `PLAYBACK_PRESENCE_CHECK_IN_INTERVAL_MS`
  (15 s) while its account event stream is open; each check-in, and each state publish from the
  active device, extends its presence to now + `PLAYBACK_PRESENCE_TTL_MS` (40 s). The stream's
  25-second heartbeat cannot prove liveness: a sleeping laptop's half-open socket keeps accepting
  writes for minutes. A client that does not open the stream never checks in, so the menu lists
  only devices with an open stream.
- **When a device leaves the menu** (R57):
  - Its stream closes cleanly (tab closed, app stopped, network change the server sees): plan 14
    shortens its presence to now + the configured leave grace. The product value is 5 s
    (`PLAYBACK_PRESENCE_LEAVE_GRACE_MS`), so a reconnect within 5 s keeps it listed without a
    flicker. The web E2E API sets that env to 500 ms (plan 14). Vitest and the mobile E2E API
    keep 5 s.
  - It vanishes silently (sleep, lost network): it leaves when its last check-in expires, at most
    about 40 s later, plus up to one sweep interval (plan 14, 10 s).
  - Its session ends (sign-out, password change, removed from the session list): removed at once.
  - Its stream ends for lifetime or token expiry, or the pod shuts down: presence is kept; the
    client reconnects and keeps checking in.
- **One active device per account** (R1). `active` holds one session id. A claim (plan 13's state
  publish with `claim: true`) always wins: last claimer is active. The device that loses sees a
  `playback.state` whose `active_session_id_text` is someone else and stops its audio (areas B,
  C). A publish without a claim from a device that is not active is refused, so a device that
  lost the claim cannot overwrite the winner's state.
- **When the active device leaves presence** (R57): the active slot clears, and the stored state
  becomes `active_session_id_text: null`, `status: 'paused'` at the last position that device
  published (no extrapolation: it stopped somewhere after its last publish, and resuming a few
  seconds early is better than skipping ahead). Other devices show it paused with nothing active;
  any of them can play it locally, which claims.
- **Pausing or stopping** (R57) is ordinary state: the active device publishes `paused` and stays
  active while it is present. A release (resource null) clears the slot.
- **Fanout throttle** (R54). Discrete changes always fan out. A periodic publish whose resource,
  status, liveness, rate, duration, and display fields match the stored state, and whose position
  is within `PLAYBACK_STATE_DRIFT_TOLERANCE_SECONDS` (2 s) of the stored state extrapolated to now,
  is not stored and not fanned out; it only refreshes presence. Comparing with the last stored
  (last fanned-out) state, not with the last received, means small drifts cannot add up unseen.
  At 10-second periodic publishes this leaves steady playback at nearly zero events, and one
  correction event whenever the device drifts more than 2 s (a stall, a buffering wait).
- **Its own Redis connection.** Commands go on a dedicated connection
  (`podverse-api-playback`, same settings as the account event publisher: 5-second reconnect,
  `enableOfflineQueue: false`, `maxRetriesPerRequest: 1`). The cache client in
  `apps/api/src/lib/keyvaldb/keyvaldb.ts` reconnects every 60 s, too slow for presence, and the
  publisher connection belongs to realtime plan 13. A Redis outage makes the playback routes
  answer 503 and the hub skip playback snapshots; nothing else in the API is affected.

## Keys

All keys for one account share the prefix `podverse:playback:<account_id>:` (numeric account id,
as the account event fanout uses).

| Key | Type | Holds |
| --- | --- | --- |
| `presence` | sorted set | member session id, score presence expiry (ms) |
| `devices` | hash | session id → JSON `DTOPlaybackDevice` |
| `devices_rev` | string counter | `DTOPlaybackDevices.revision` |
| `state` | string | JSON `StoredPlaybackState` |
| `state_rev` | string counter | revision of `state` |
| `active` | string | the active session id |

Plus one key per command: `podverse:playback:command:<command_id>`, JSON
`StoredPlaybackCommand`, `PX` `PLAYBACK_COMMAND_RECORD_TTL_MS`.

Module constants in `playbackStore.ts` (API-only, not env vars):

```typescript
export const PLAYBACK_PRESENCE_KEY_TTL_MS = PLAYBACK_PRESENCE_TTL_MS * 3;
export const PLAYBACK_STATE_TTL_MS = 60 * 60 * 1000;
export const PLAYBACK_COMMAND_RECORD_TTL_MS = 60_000;
```

The `presence`, `devices`, and `devices_rev` keys get `PEXPIRE PLAYBACK_PRESENCE_KEY_TTL_MS` on
every touch, so an account nobody uses leaves nothing behind. `state`, `state_rev`, and `active`
get `PEXPIRE PLAYBACK_STATE_TTL_MS` on every state write and on every check-in by the active
device, so a long pause on a present device never expires the slot under it.

## `apps/api/src/lib/accountPlayback/playbackRedis.ts`

The connection, built like realtime plan 13's factory (`host`, `port`, `password` from
`config.keyvaldb`, `connectionName: 'podverse-api-playback'`,
`retryStrategy: () => ACCOUNT_EVENT_REDIS_RECONNECT_DELAY_MS`, `lazyConnect: true`,
`enableOfflineQueue: false`, `maxRetriesPerRequest: 1`), with the same once-per-outage warn and
restore logging (`'Playback Redis connection lost'`, `'Playback Redis connection restored'`).

```typescript
export function startPlaybackRedis(): void;
export async function closePlaybackRedis(): Promise<void>;
/** The open connection; throws `PlaybackStoreUnavailableError` when not started or not ready. */
export function getPlaybackRedis(): Redis;
export class PlaybackStoreUnavailableError extends Error {}
```

`startPlaybackRedis` calls `connect()` without awaiting (catch and ignore; the error handler
logs). Twice does nothing the second time. `closePlaybackRedis` does `quit()` when `ready` or
`connecting`, else `disconnect()`; twice is safe. `getPlaybackRedis` throws
`PlaybackStoreUnavailableError` when the status is not `ready`, so callers fail fast during an
outage instead of waiting.

Do not export the factory from `accountEventRedis.ts`; copying its eight lines keeps that
realtime file unchanged.

## `apps/api/src/lib/accountPlayback/playbackStoreScripts.ts`

Lua source strings, run with `connection.eval(script, numKeys, ...keysAndArgs)`. Do not use
`defineCommand`: its methods are added at run time and would need a type assertion. Redis caches
scripts sent with `EVAL`. Each script returns an array of strings and integers; parse every reply
in `playbackStore.ts` with a small guard and throw on an unexpected shape.

1. `PRESENCE_TOUCH` — keys `presence`, `devices`, `devices_rev`, `state`, `state_rev`, `active`;
   args `sessionId`, `deviceJson`, `expiresAtMs`, `nowMs`, `presenceKeyTtlMs`, `stateTtlMs`.
   1. `ZADD presence expiresAtMs sessionId`; `added` is its reply (1 when new). Adding first
      means the caller's new future score keeps it out of the prune below, even when its old
      score had already passed.
   1. `HSET devices sessionId deviceJson`.
   1. `ZRANGEBYSCORE presence -inf nowMs` → `removed`; `ZREMRANGEBYSCORE` the same range; `HDEL
      devices` each removed id.
   1. `PEXPIRE` the three presence keys.
   1. When `added == 1` or `#removed > 0`: bump `devices_rev` (below), else `rev = GET
      devices_rev` (0 when missing).
   1. When `GET active == sessionId`: `PEXPIRE` `state`, `state_rev`, `active` by `stateTtlMs`.
   1. Return `{ changed (0|1), rev, removed... }`.
1. `PRESENCE_PRUNE` — keys `presence`, `devices`, `devices_rev`; arg `nowMs`. The prune step of
   `PRESENCE_TOUCH`; bump `devices_rev` when anything was removed. Return `{ rev, removed... }`.
1. `PRESENCE_SHORTEN` — keys `presence`; args `sessionId`, `expiresAtMs`.
   `ZADD presence XX LT expiresAtMs sessionId`: only lowers an existing score, so a check-in that
   already arrived from a reconnected stream is not cut short. No revision change; the next prune
   removes it.
1. `PRESENCE_REMOVE` — keys `presence`, `devices`, `devices_rev`; args `sessionId`, `nowMs`.
   `ZREM`; when it removed one, `HDEL` and bump `devices_rev`. Return `{ removed (0|1), rev }`.
1. `STATE_COMPARE_AND_SET` — keys `state`, `state_rev`, `active`; args `expectedRev`, `newRev`,
   `expectedActive`, `newActive`, `stateJson`, `stateTtlMs`.
   - `expectedActive` is a session id, `''` for "no active device", or `'*'` for any.
   - When `GET state_rev` (0 when missing) is not `expectedRev`, or the active check fails, return
     `{ 0, currentRev, currentActive or '' }`.
   - Else `SET state stateJson`, `SET state_rev newRev`, then `SET active newActive` or `DEL
     active` when `newActive` is `''`, `PEXPIRE` all three, return `{ 1, newRev }`.
   - The state JSON is opaque to the script (no `cjson`): the API builds it with `newRev` as its
     `revision`, and the script keeps `state_rev` equal to it.

**Revisions never go backwards** (plan 10). Bumping `devices_rev` sets it to
`math.max(previous + 1, nowMs)` where `previous` is the stored value or 0; the API computes a new
state revision the same way (`playbackStatePolicy.ts`). After a key expires, its next revision is
the current time in ms, which is above anything a client saw before. Write numbers to Redis with
`string.format('%d', n)` so a large Lua number is never written in exponent form, and return them
as strings that `playbackStore.ts` parses with `Number` and checks with `Number.isSafeInteger`.

Every script touches only keys named in `KEYS`.

## `apps/api/src/lib/accountPlayback/playbackStore.ts`

Typed wrappers; no event publishing here.

```typescript
/** `DTOPlaybackState` as stored: everything but the per-write `sent_at_ms`. */
export type StoredPlaybackState = Omit<DTOPlaybackState, 'sent_at_ms'>;

export interface StoredPlaybackCommand {
  account_id: number;
  sender_session_id_text: string;
  target_session_id_text: string;
  expires_at_ms: number;
}

export interface PlaybackPresenceResult {
  devicesChanged: boolean;
  devicesRevision: number;
  removedSessionIdTexts: string[];
}

export async function touchPlaybackPresence(params: {
  accountId: number;
  device: DTOPlaybackDevice;
  nowMs: number;
}): Promise<PlaybackPresenceResult>;

export async function prunePlaybackPresence(params: {
  accountId: number;
  nowMs: number;
}): Promise<PlaybackPresenceResult>;

export async function shortenPlaybackPresence(params: {
  accountId: number;
  sessionIdText: string;
  expiresAtMs: number;
}): Promise<void>;

export async function removePlaybackPresence(params: {
  accountId: number;
  sessionIdText: string;
  nowMs: number;
}): Promise<PlaybackPresenceResult>;

export async function isPlaybackSessionPresent(params: {
  accountId: number;
  sessionIdText: string;
  nowMs: number;
}): Promise<boolean>;

/**
 * `ZRANGEBYSCORE presence (nowMs +inf`, then `HMGET devices` for those ids and `GET devices_rev`
 * (0 when missing) for the revision. Skips ids whose JSON fails `isDTOPlaybackDevice`.
 */
export async function readPlaybackDevices(params: {
  accountId: number;
  nowMs: number;
}): Promise<DTOPlaybackDevices>;

export interface PlaybackStateRead {
  state: StoredPlaybackState | null;
  revision: number;
  activeSessionIdText: string | null;
}

/** One `MGET state state_rev active`. A state whose JSON fails the guard reads as null. */
export async function readPlaybackState(accountId: number): Promise<PlaybackStateRead>;

export type PlaybackStateWriteResult =
  | { kind: 'written'; revision: number }
  | { kind: 'conflict'; revision: number; activeSessionIdText: string | null };

/** Writes `params.state`; its `revision` is the new revision. */
export async function compareAndSetPlaybackState(params: {
  accountId: number;
  expectedRevision: number;
  expectedActive: { kind: 'session'; sessionIdText: string } | { kind: 'none' } | { kind: 'any' };
  newActiveSessionIdText: string | null;
  state: StoredPlaybackState;
}): Promise<PlaybackStateWriteResult>;

export async function savePlaybackCommand(commandIdText: string, record: StoredPlaybackCommand): Promise<void>;
export async function readPlaybackCommand(commandIdText: string): Promise<StoredPlaybackCommand | null>;
```

`isDTOPlaybackState` from plan 10 validates stored JSON after adding `sent_at_ms: 0` for the
check; `isDTOPlaybackDevice` from plan 10 validates each device JSON.

## `apps/api/src/lib/accountPlayback/playbackStatePolicy.ts`

Pure decisions, unit tested without Redis.

```typescript
export type PlaybackStateDecision =
  | { kind: 'not_active'; activeSessionIdText: string | null }
  | { kind: 'unchanged' }
  | { kind: 'write'; state: StoredPlaybackState; newActiveSessionIdText: string | null };

export function decidePlaybackStatePublish(params: {
  current: PlaybackStateRead;
  callerSessionIdText: string;
  body: PlaybackStatePublishBody;
  nowMs: number;
}): PlaybackStateDecision;

export function buildPlaybackStateAfterActiveLeft(params: {
  current: StoredPlaybackState;
  nowMs: number;
}): StoredPlaybackState;

export function toPlaybackStateDto(state: StoredPlaybackState, sentAtMs: number): DTOPlaybackState;
```

`decidePlaybackStatePublish`, in this order:

1. `body.claim` true → `write`, `newActiveSessionIdText` = caller.
1. `current.activeSessionIdText` is not the caller → `not_active` with the current active id.
1. `body.resource` null → `write` a released state (`resource: null`, `status: 'paused'`,
   `is_live: false`, `position_seconds: null`, `duration_seconds: null`, `rate: 1`,
   `active_session_id_text: null`) and `newActiveSessionIdText: null`.
1. `current.state` exists and `isSamePlaybackState(current.state, body, nowMs)` → `unchanged`.
1. Else `write`, active stays the caller.

Every written state has `revision = Math.max(current.revision + 1, nowMs)`, `updated_at_ms = nowMs`, and
`active_session_id_text` equal to `newActiveSessionIdText`. A live body is normalized before
comparing and writing: `position_seconds` and `duration_seconds` null, `rate` 1 (plan 10's guard
rules; plan 13's validation already rejects anything else, so this is belt and braces only for the
comparison).

`isSamePlaybackState` (private): same `ref` (same kind and same id field), same `title`,
`channel_title`, `image_url`, same `status`, `is_live`, `rate`, `duration_seconds` equal or both
null (within 0.5 s, since media durations refine while loading), and position: both null, or
`Math.abs(body.position_seconds - estimatePlaybackPositionAtServerTime(current.state, nowMs)) <
PLAYBACK_STATE_DRIFT_TOLERANCE_SECONDS`. A claim never reaches this comparison.

`buildPlaybackStateAfterActiveLeft`: copies `current`, sets `active_session_id_text: null`,
`status: 'paused'` (from `playing` or `loading`; `paused` stays), keeps `position_seconds` as
last published, sets `updated_at_ms = nowMs` and `revision = Math.max(current.revision + 1,
nowMs)`.

## `apps/api/src/lib/accountPlayback/playbackService.ts`

The functions routes and the hub call. They combine the store, the policy, and publishing.
Publishing uses `publishAccountEvents` from `@podverse/orm`, which never throws outside tests.

```typescript
export async function publishPlaybackDevices(accountId: number, nowMs: number): Promise<void>;
export async function publishPlaybackState(accountId: number, state: StoredPlaybackState, nowMs: number): Promise<void>;

/** After a prune, touch, or remove reported removals: publish devices, and clear the active slot when its device left. */
export async function handlePlaybackPresenceChange(params: {
  accountId: number;
  result: PlaybackPresenceResult;
  nowMs: number;
}): Promise<void>;

/** Prune (handling any removals), then read devices and state; `sent_at_ms` is `nowMs`. */
export async function readPlaybackSnapshot(params: {
  accountId: number;
  nowMs: number;
}): Promise<DTOPlaybackSnapshot>;
```

- `publishPlaybackDevices` reads `readPlaybackDevices` and publishes `playback.devices` with that
  list. Reading at publish time, not reusing a list from the script, means the event always holds
  the newest membership; its `revision` comes from the read.
- `publishPlaybackState` publishes `playback.state` with `toPlaybackStateDto(state, nowMs)`; the hub
  replaces `sent_at_ms` at write time (plan 14).
- `handlePlaybackPresenceChange`: when `result.devicesChanged` is false, return. Else publish
  devices. Then, when `removedSessionIdTexts` is non-empty: `readPlaybackState`; when its
  `activeSessionIdText` is in the removed list and a state exists, build the after-left state and
  `compareAndSetPlaybackState` with `expectedRevision` = the read revision, `expectedActive` =
  that session, `newActiveSessionIdText: null`. On `written`, publish the state. On `conflict`,
  do nothing: someone claimed or wrote in between, and their write already fanned out.

Exactly-one delivery: only the caller whose script removed a member gets it in
`removedSessionIdTexts`, so one pod publishes per removal, and the compare-and-set makes the
active-slot clear happen once even if two pods raced.

## `packages/orm/src/lib/accountEventPublisher.ts`

Add the four playback types to `AccountEventDataByType`, importing the DTO types with
`import type` from `@podverse/helpers`:

```typescript
'playback.state': DTOPlaybackState;
'playback.devices': DTOPlaybackDevices;
'playback.command': DTOPlaybackCommandEnvelope;
'playback.start_failed': DTOPlaybackStartFailed;
```

Update the type's doc comment: `playback.*` is in use for cross-device playback; its events are
relayed by the API hub without database reads. No runtime change; `toAccountNotificationSignal`
still returns null for these types.

## Startup and shutdown

- `apps/api/src/index.ts`: next to `startAccountEventPublisher()` (after KeyValDB is reachable,
  before `startApp`), dynamically import `playbackRedis.ts` and call `startPlaybackRedis()`. In
  `shutdown`, call `closePlaybackRedis()` in its own `try` next to `closeAccountEventPublisher()`.
- `apps/api/src/test/helpers/index.ts`: in `startTestApp`, after the publisher registration
  realtime plan 13 adds, call `startPlaybackRedis()` and wait until `getPlaybackRedis()` stops
  throwing (poll like `waitForTestKeyvaldbReady`, same timeout). In `stopTestApp`, call
  `closePlaybackRedis()` in a `try` like `closeTestKeyvaldb`. The test Valkey on port 6679 is
  already part of `make test_deps`.

## Docs

`apps/api/ENV.md`, in the sentence realtime plan 13 adds under the `KEYVALDB_*` rows: the API also
opens one connection (`podverse-api-playback`) for cross-device playback presence and state, with
the same values. No new env vars.

## Tests

- `apps/api/src/lib/accountPlayback/playbackStatePolicy.test.ts` (unit, no Redis):
  - A claim writes with the caller active even when another device is active.
  - A non-claim from a non-active device returns `not_active` with the current id, including
    when nothing is active.
  - A release clears the active device and the resource.
  - A periodic publish 10 s later at position + 10 (rate 1, playing) is `unchanged`; at position
    + 13 it writes; at rate 2 and position + 20 it is `unchanged`.
  - A status change, a different item, a rate change, and a title change each write.
  - Paused: position equal is `unchanged`; a seek of 5 s writes.
  - Live: two publishes with null positions and the same item are `unchanged`.
  - A written revision is the larger of the previous + 1 and `nowMs` (previous 5 with `nowMs`
    1000 gives 1000; previous 2000 with `nowMs` 1000 gives 2001); `updated_at_ms` is `nowMs`.
  - `buildPlaybackStateAfterActiveLeft` turns `playing` into `paused` with the last position and
    no active device.
- `apps/api/src/lib/accountPlayback/playbackRedis.test.ts` (unit, fake `ioredis` like realtime
  plan 13's test): the connection is named `podverse-api-playback`; a second start creates nothing;
  `getPlaybackRedis` throws `PlaybackStoreUnavailableError` before `ready`; close twice quits once.
- `apps/api/src/test/account-playback-store.test.ts` (integration against the test Valkey,
  through `startTestApp` so the connection is up; each test uses its own account id and deletes
  `podverse:playback:<id>:*` and the command keys it made afterwards):
  - Touch adds a device (`devicesChanged`, revision equal to `nowMs`); a second touch of the same
    device is not a change and keeps the revision. After deleting the keys, the next join's
    revision is again at least `nowMs`.
  - A device whose expiry passed is removed by the next touch of another device and reported
    once; a second prune reports nothing.
  - Two concurrent prunes (`Promise.all`) of one expired device: exactly one reports it.
  - `shortenPlaybackPresence` lowers the expiry and a later touch raises it again; shortening never
    raises it.
  - `removePlaybackPresence` reports the removal once.
  - `compareAndSetPlaybackState` with a stale revision returns `conflict` with the current
    revision and active id; with `expectedActive` a different session returns `conflict`; with
    `any` writes.
  - The active device's touch extends the state keys' TTL (`PTTL` grows); another device's touch
    does not.
  - `handlePlaybackPresenceChange` with the active device removed writes a paused state with no
    active device and publishes `playback.devices` then `playback.state` (register a capturing
    publisher with `registerAccountEventPublisher` after `startTestApp` and parse its messages
    with `parseAccountEventMessage`).
  - A saved command record reads back, its `PTTL` is positive and at most
    `PLAYBACK_COMMAND_RECORD_TTL_MS`, and an unknown command id reads as null.

## Release scratchpad

none (plan 13's entry describes the feature's server side, including this store)
