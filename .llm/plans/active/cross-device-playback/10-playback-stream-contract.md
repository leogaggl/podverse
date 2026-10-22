**Cursor model:** Codex 5.3 · **Reasoning:** high

# 10 — Cross-device playback contract (`@podverse/helpers`)

The client-facing contract for cross-device playback on the account event stream: the `playback.*`
event names, their data shapes, the request bodies of the API routes in plan 13, the timing
constants every side shares, and one pure parser plus payload guards. The API (plans 13, 14)
writes these shapes and the hub validates relayed events with the same guards; web (area B) and
mobile (area C) read them. No runtime code other than the guards, the parser, and constants.

Exclusive active-device handoff: one device per account plays at a time. That device is the
source of truth and publishes its state; every other connected device shows it and can send
target-state commands to it through the API.

Other work is landing in the tree. Before editing, confirm that:

- `packages/helpers/src/lib/accountEventStream.ts` exists and exports `ACCOUNT_EVENTS_STREAM_API_PATH`
  and `parseAccountNotificationStreamEvent` (realtime plan 10).
- `packages/helpers/src/lib/accountSession.ts` exists and exports the client type union
  (`AccountSessionClientType`, values `'web' | 'mobile'`) and a guard for it (auth-sessions plan
  10). If the guard has another name, import that one; if there is no guard, define
  `isPlaybackDeviceClientType` locally in this file from the exported values array.
- `packages/helpers/src/dtos/addByRSSResourceData.ts` still exports `AddByRSSResourceData`.

If the first two files are missing, stop and report: realtime and auth-sessions must land first.

## Rows

R14, R15, R18, R20, R23, R24, R25, R26, R30, R31, R32, R43, R54

## Runs after

none

## Files

packages/helpers/src/lib/accountPlaybackStream.ts
packages/helpers/src/lib/accountPlaybackStream.test.ts
packages/helpers/src/lib/accountEventStream.ts
packages/helpers/src/index.ts
packages/helpers/package.json

## Decisions this plan fixes

- **Device = login session.** A device is one `account_session` row (auth-sessions plan 10),
  named by its `session_id_text`. Several tabs in one browser profile share one session, so they
  are one device (area B decides which tab acts for it).
- **Target-state commands only** (R30). `play`, `pause`, `seek` to an absolute position,
  `set_rate` to a value, `play_item`, and `take_over`. No toggle. Skip forward and skip back are
  `seek` commands whose position the sender computes from its current estimate (R24), so two
  devices skipping at once land on the same target instead of stacking.
- **Commands are one-shot** (R31): the server stamps `command_id`, `issued_at_ms`, and
  `expires_at_ms = issued_at_ms + PLAYBACK_COMMAND_TTL_MS`. No SSE `id:`, never stored for replay.
  The hub drops a command that reaches it after `expires_at_ms` (server clocks). The receiving
  device never compares its own clock with `expires_at_ms`: it acts on a command at once, or drops
  it when it cannot act within `PLAYBACK_COMMAND_TTL_MS` of receiving it, and ignores a
  `command_id` it has already seen.
- **Transfer is `take_over` sent to the target device** (R20). It carries no item: the server
  attaches the current stored `playback.state` to the delivered command, and the target resumes
  that resource at the estimated position, or at the live point for a live item (R15). The target
  always starts playing. Choosing "this device" in the menu needs no command: the device takes
  over locally the same way and claims (plan 13).
- **Live items** (R14, R18): state carries `is_live: true`, `position_seconds: null`,
  `duration_seconds: null`, `rate: 1`. Allowed commands are `play`, `pause`, `play_item`,
  `take_over`; `seek` and `set_rate` are not (plan 11's `isPlaybackCommandAllowed`). Liveness is a
  flag on an item resource, never a resource kind or medium (**abcmemory-vocabulary** §
  livestreams).
- **Snapshots replace, revisions order the rest.** `playback.state` and `playback.devices` each
  carry a per-account `revision` that only grows, even after its Redis key expires: every write
  sets it to the larger of the previous revision + 1 and the server's current time in ms (plan
  12). On each stream connection, and again after the API's Redis subscriber recovers, the hub
  sends one `playback.snapshot` holding the device list and the state (or null). A client replaces
  its whole playback view with a snapshot, without a revision check; the hub holds back live
  playback events for that stream until the snapshot is written, so nothing older follows it.
  Every other event, and every HTTP response that carries devices or state, applies only when its
  revision is higher than the one the client holds.
- **Clock skew is removed by the server.** `updated_at_ms` is the server's clock when it accepted
  the position; `sent_at_ms` is the server's clock when the event was written to this stream or
  HTTP response. A client estimates with `sent_at_ms - updated_at_ms` plus its own time since it
  received the event (plan 11), so it never compares its clock with the server's.
- **Start failed** (R43): the target reports `playback.start_failed` back through the API; only
  the sender's session receives it. Success has no event of its own: the target's claim shows up
  as a `playback.state` whose `active_session_id_text` is the target.

## `packages/helpers/src/lib/accountPlaybackStream.ts`

Imports: `import type { AddByRSSResourceData } from '../dtos/addByRSSResourceData.js';`, the client
type union and guard from `./accountSession.js`. Nothing Node-only, nothing from the barrel; mobile
imports this file through a subpath.

### Event names

```typescript
export const ACCOUNT_PLAYBACK_STREAM_EVENT = {
  snapshot: 'playback.snapshot',
  state: 'playback.state',
  devices: 'playback.devices',
  command: 'playback.command',
  startFailed: 'playback.start_failed',
} as const;

export type AccountPlaybackStreamEventName =
  (typeof ACCOUNT_PLAYBACK_STREAM_EVENT)[keyof typeof ACCOUNT_PLAYBACK_STREAM_EVENT];

export function isAccountPlaybackStreamEventName(
  value: string
): value is AccountPlaybackStreamEventName;
```

### Constants

```typescript
/** A playing device publishes at least this often while status is `playing` (R32, R54). */
export const PLAYBACK_STATE_PUBLISH_INTERVAL_MS = 10_000;
/** Discrete changes publish at once, coalesced to at most one per this gap (leading and trailing). */
export const PLAYBACK_STATE_MIN_PUBLISH_GAP_MS = 500;
/** A periodic publish within this many seconds of the extrapolated position is not fanned out. */
export const PLAYBACK_STATE_DRIFT_TOLERANCE_SECONDS = 2;
/** A device with an open account event stream checks in this often (R36). */
export const PLAYBACK_PRESENCE_CHECK_IN_INTERVAL_MS = 15_000;
/** Presence lasts this long after the last check-in or state publish. */
export const PLAYBACK_PRESENCE_TTL_MS = 40_000;
/** After a stream closes, presence is kept this long so a quick reconnect does not flicker the menu. */
export const PLAYBACK_PRESENCE_LEAVE_GRACE_MS = 5_000;
/** A command not delivered and acted on within this window is dropped (R31). */
export const PLAYBACK_COMMAND_TTL_MS = 5_000;
/** A sender that sees neither the target's claim nor a start-failed report by then shows the failure notice. */
export const PLAYBACK_TAKE_OVER_RESULT_TIMEOUT_MS = 8_000;
export const PLAYBACK_RATE_MIN = 0.5;
export const PLAYBACK_RATE_MAX = 3;
export const PLAYBACK_TEXT_FIELD_MAX_LENGTH = 500;
export const PLAYBACK_IMAGE_URL_MAX_LENGTH = 2048;
```

`PLAYBACK_RATE_MIN` and `PLAYBACK_RATE_MAX` match the ends of `PlaybackSpeedValue` in
`packages/helpers/src/dtos/mediaPlayer/playbackSpeed.ts`. The contract accepts any finite number in
range rather than that union, so a client with a different speed list still validates.

### Resource reference and summary

```typescript
export type DTOPlaybackResourceRef =
  | { kind: 'item'; item_id_text: string }
  | { kind: 'clip'; clip_id_text: string }
  | { kind: 'soundbite'; item_soundbite_id_text: string }
  | { kind: 'add_by_rss'; add_by_rss_hash_id: string };

export interface DTOPlaybackResourceSummary {
  ref: DTOPlaybackResourceRef;
  title: string | null;
  channel_title: string | null;
  image_url: string | null;
}
```

The kinds are the server queue's resource kinds (`packages/helpers/src/dtos/queue/queueResourceAbridged.ts`):
item, clip, item soundbite, Add by RSS. A chapter plays as its item with a start position; a live
item is an `item` with `is_live` on the state. The display fields let a device that has never
loaded the item show its title and artwork (R6, R7) without a request; clients fetch more by id
when they need it.

### State

```typescript
export const PLAYBACK_STATUSES = ['playing', 'paused', 'loading'] as const;
export type PlaybackStatus = (typeof PLAYBACK_STATUSES)[number];

export interface DTOPlaybackState {
  revision: number;
  /** The device that plays; null when none does (it released, or it left presence). */
  active_session_id_text: string | null;
  /** Null after a release with nothing loaded. */
  resource: DTOPlaybackResourceSummary | null;
  status: PlaybackStatus;
  is_live: boolean;
  /** Null when `is_live` or nothing is loaded. */
  position_seconds: number | null;
  /** Null when unknown or `is_live`. */
  duration_seconds: number | null;
  rate: number;
  /** Server clock when the server accepted this position. */
  updated_at_ms: number;
  /** Server clock when this copy was written to the stream or response. */
  sent_at_ms: number;
}
```

### Devices

```typescript
export interface DTOPlaybackDevice {
  session_id_text: string;
  client_type: AccountSessionClientType;
  /** The session's device label; null when the session has none. */
  device_label: string | null;
  /** ISO 8601; orders the menu and numbers same-label devices (plan 11). */
  session_created_at: string;
}

export interface DTOPlaybackDevices {
  revision: number;
  devices: DTOPlaybackDevice[];
}
```

The list holds only devices present now (R36). The order on the wire is not meaningful; clients
order with plan 11's `buildPlaybackDeviceList`.

### Snapshot

```typescript
export interface DTOPlaybackSnapshot {
  devices: DTOPlaybackDevices;
  /** Null when nothing has been published for the account recently. */
  state: DTOPlaybackState | null;
}
```

Written only by the hub (plan 14), never published through Redis.

### Commands

```typescript
export type DTOPlaybackCommand =
  | { type: 'play' }
  | { type: 'pause' }
  | { type: 'seek'; position_seconds: number }
  | { type: 'set_rate'; rate: number }
  | {
      type: 'play_item';
      resource: DTOPlaybackResourceRef;
      /** Required when `resource.kind` is `add_by_rss`; null otherwise. */
      add_by_rss_resource_data: AddByRSSResourceData | null;
      /** Null plays from the item's saved position, or the live point for a live item. */
      start_seconds: number | null;
    }
  | { type: 'take_over' };

export type PlaybackCommandType = DTOPlaybackCommand['type'];

export interface DTOPlaybackCommandEnvelope {
  command_id: string;
  sender_session_id_text: string;
  target_session_id_text: string;
  issued_at_ms: number;
  expires_at_ms: number;
  command: DTOPlaybackCommand;
  /** For `take_over`: the stored state to resume. Null for every other type. */
  state: DTOPlaybackState | null;
}
```

`play_item` carries `add_by_rss_resource_data` because the active device may not have that Add by
RSS feed locally; the queue's Add by RSS routes require the same data
(`apps/api/src/controllers/queue/queueResourceItemAddByRSS.ts`). `take_over` of an Add by RSS item
gets only the hash in `state.resource.ref`; the target resolves the data from its own Add by RSS
store or from its server queue now-playing row, which the previous active device wrote.

### Start failed

```typescript
export const PLAYBACK_START_FAILED_REASONS = ['autoplay_blocked', 'load_failed'] as const;
export type PlaybackStartFailedReason = (typeof PLAYBACK_START_FAILED_REASONS)[number];

export interface DTOPlaybackStartFailed {
  command_id: string;
  sender_session_id_text: string;
  target_session_id_text: string;
  reason: PlaybackStartFailedReason;
}
```

`autoplay_blocked`: the target cannot start audio without a tap (a browser tab); it shows a
tap-to-play prompt and claims when the person taps. `load_failed`: the media did not load.

### Request bodies and responses (plan 13's routes)

```typescript
/** POST /account/playback/state */
export interface PlaybackStatePublishBody {
  /** True makes the caller the active device (it started playing locally or took over). */
  claim: boolean;
  /** Null with `claim: false` releases the active device. */
  resource: DTOPlaybackResourceSummary | null;
  status: PlaybackStatus;
  is_live: boolean;
  position_seconds: number | null;
  duration_seconds: number | null;
  rate: number;
}

export interface PlaybackStatePublishResponse {
  revision: number;
  active_session_id_text: string | null;
}

/**
 * POST /account/playback/presence response. Its devices and state apply by revision, not as a
 * replacing snapshot: the response can be older than an event the stream already delivered.
 */
export interface PlaybackPresenceResponse extends DTOPlaybackSnapshot {
  /** The caller's own session: "this device". */
  session_id_text: string;
}

/** POST /account/playback/commands */
export interface PlaybackCommandSendBody {
  /** Required for `take_over`; omitted for every other type, which goes to the active device. */
  target_session_id_text?: string;
  command: DTOPlaybackCommand;
}

export interface PlaybackCommandSendResponse {
  command_id: string;
  target_session_id_text: string;
  expires_at_ms: number;
}

/** POST /account/playback/commands/:command_id/start-failed */
export interface PlaybackStartFailedBody {
  reason: PlaybackStartFailedReason;
}

export const PLAYBACK_ERROR_CODES = {
  notActiveDevice: 'playback_not_active_device',
  noActiveDevice: 'playback_no_active_device',
  deviceNotConnected: 'playback_device_not_connected',
  targetAlreadyActive: 'playback_target_already_active',
  nothingToTransfer: 'playback_nothing_to_transfer',
  commandNotAllowedForLive: 'playback_command_not_allowed_for_live',
  takeOverSelf: 'playback_take_over_self',
  unavailable: 'playback_unavailable',
} as const;

export type PlaybackErrorCode = (typeof PLAYBACK_ERROR_CODES)[keyof typeof PLAYBACK_ERROR_CODES];
```

The 409 body for `playback_not_active_device` also carries `active_session_id_text` (string or
null), so the caller knows whether another device took over (stop local audio) or the claim lapsed
(claim again).

### Guards and parser

```typescript
export function isDTOPlaybackResourceRef(value: unknown): value is DTOPlaybackResourceRef;
export function isDTOPlaybackResourceSummary(value: unknown): value is DTOPlaybackResourceSummary;
export function isDTOPlaybackCommand(value: unknown): value is DTOPlaybackCommand;
export function isDTOPlaybackState(value: unknown): value is DTOPlaybackState;
export function isDTOPlaybackDevice(value: unknown): value is DTOPlaybackDevice;
export function isDTOPlaybackDevices(value: unknown): value is DTOPlaybackDevices;
export function isDTOPlaybackSnapshot(value: unknown): value is DTOPlaybackSnapshot;
export function isDTOPlaybackCommandEnvelope(value: unknown): value is DTOPlaybackCommandEnvelope;
export function isDTOPlaybackStartFailed(value: unknown): value is DTOPlaybackStartFailed;

export type AccountPlaybackStreamEvent =
  | { type: 'playback.snapshot'; data: DTOPlaybackSnapshot }
  | { type: 'playback.state'; data: DTOPlaybackState }
  | { type: 'playback.devices'; data: DTOPlaybackDevices }
  | { type: 'playback.command'; data: DTOPlaybackCommandEnvelope }
  | { type: 'playback.start_failed'; data: DTOPlaybackStartFailed };

/** Validates already-parsed data; the hub uses it on events relayed from Redis. */
export function toAccountPlaybackStreamEvent(
  eventName: string,
  data: unknown
): AccountPlaybackStreamEvent | null;

/** JSON.parse plus `toAccountPlaybackStreamEvent`; clients call it with the SSE event name and data string. */
export function parseAccountPlaybackStreamEvent(
  eventName: string,
  rawData: string
): AccountPlaybackStreamEvent | null;
```

Guard rules, so every side rejects the same bad shapes:

- Strings that are ids (`*_id_text`, `add_by_rss_hash_id`, `command_id`) are non-empty and at most
  `PLAYBACK_TEXT_FIELD_MAX_LENGTH`.
- `title`, `channel_title`: string at most `PLAYBACK_TEXT_FIELD_MAX_LENGTH`, or null.
  `image_url`: string at most `PLAYBACK_IMAGE_URL_MAX_LENGTH`, or null.
- Numbers are finite. `position_seconds`, `duration_seconds`, `start_seconds` are `>= 0`.
  `rate` is in `[PLAYBACK_RATE_MIN, PLAYBACK_RATE_MAX]`. `revision` and `*_ms` are non-negative
  safe integers.
- `isDTOPlaybackState`: when `is_live` is true, `position_seconds` and `duration_seconds` are null
  and `rate` is 1. When `resource` is null, `status` is `paused` and `position_seconds` is null.
- `isDTOPlaybackCommand`: `play_item` with an `add_by_rss` resource requires an object
  `add_by_rss_resource_data` (check it is a non-null object; its own shape is validated where it is
  used, as the queue routes do); any other kind requires null.
- `isDTOPlaybackCommandEnvelope`: `state` is a valid state when `command.type` is `take_over`, and
  null otherwise. `expires_at_ms > issued_at_ms`.
- Unknown `kind`, `type`, `status`, or `reason` values fail. Extra properties are allowed and
  ignored, so a newer server can add fields.
- `parseAccountPlaybackStreamEvent` returns null for an unknown event name, invalid JSON, or data
  that fails its guard. It never throws.

## `packages/helpers/src/lib/accountEventStream.ts`

Only the doc comment on `ACCOUNT_EVENTS_STREAM_API_PATH` (or the file header, wherever realtime
plan 10 put the namespace list): `playback.*` is in use, defined in `./accountPlaybackStream.ts`,
with `playback.snapshot`, `playback.state`, and `playback.devices` as latest-value events and
`playback.command` and `playback.start_failed` as one-shot events, none with an SSE `id:`. No
code change.

## `packages/helpers/src/index.ts`

Add `export * from './lib/accountPlaybackStream.js';` next to the realtime contract's export.

## `packages/helpers/package.json`

Add an `exports` subpath in the same form as `./playbackEvents`:

```json
"./accountPlaybackStream": {
  "types": "./dist/lib/accountPlaybackStream.d.ts",
  "default": "./dist/lib/accountPlaybackStream.js"
}
```

Mobile cannot import values from the barrel; it imports `@podverse/helpers/accountPlaybackStream`.

## Tests

- `packages/helpers/src/lib/accountPlaybackStream.test.ts` (Vitest, the package's existing
  runner):
  - Each event name parses a valid sample into the matching typed value.
  - Unknown name (`notification.state`, `playback.progress`), invalid JSON, and an empty string
    each return null.
  - State: a live state with a number `position_seconds` fails; a live state with rate 1.5 fails; a
    null resource with `playing` fails; a valid paused item state passes; `rate` 0.25 and 3.5 fail.
  - Command: each of the six types passes with valid fields; `seek` with a negative position
    fails; `play_item` with `add_by_rss` and null data fails, and with an `item` and non-null data
    fails; `{ type: 'toggle' }` fails.
  - Envelope: `take_over` with null `state` fails; `pause` with a non-null `state` fails;
    `expires_at_ms` equal to `issued_at_ms` fails.
  - Start failed: an unknown reason fails.
  - Snapshot: an empty device list with null state passes; a snapshot whose state fails the state
    guard fails.
  - Extra unknown properties on state still pass.

## Release scratchpad

none
