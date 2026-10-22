**Cursor model:** Cursor Grok 4.7 · **Reasoning:** extra high

# 11 — Cross-device playback shared helpers (`@podverse/helpers`)

Pure functions web (areas B, D), mobile (areas C, E), and the API (plans 13, 14) share, so both
clients show the same position, offer the same controls, and draw the same device menu. No
network, no timers, no platform code.

Before editing, confirm `packages/helpers/src/lib/accountPlaybackStream.ts` exists (plan 10) and
exports `DTOPlaybackState`, `DTOPlaybackDevice`, and `PlaybackCommandType`. If it does not, stop
and report.

## Rows

R14, R15, R18, R24, R35, R63

## Runs after

10

## Files

packages/helpers/src/lib/crossDevicePlayback.ts
packages/helpers/src/lib/crossDevicePlayback.test.ts
packages/helpers/src/index.ts
packages/helpers/package.json

## Decisions this plan fixes

- **Position estimate** (R35): a non-playing device advances the bar locally from the last state
  it received, at the published rate, only while status is `playing`, clamped to
  `[0, duration_seconds]`. It never advances for `paused` or `loading`, and returns null for a
  live item (no progress bar, R16, R17).
- **Live controls** (R14, R18, R24): a live item allows `play`, `pause`, `play_item`, `take_over`.
  It does not allow `seek` (so no skip forward or back) or `set_rate`, and shows no progress.
- **Transfer is always allowed** (R15), live or not.
- **Device menu order** (R39, R40, R63): this device first, then the other devices by
  `session_created_at` ascending, then `session_id_text` to break ties. The playing device is
  highlighted in place, not moved, so the list does not reorder when playback moves.
- **Same label** (R63): devices that share a label get a number, 1, 2, 3 in `session_created_at`
  order, on every one of them, including this device. The number comes from the full list, so
  every device in the account shows the same number for the same device. Devices with no label
  group by client type (all label-less web sessions share a group). Each UI formats the number
  through its own i18n (`iPhone · iOS (2)` is a UI choice, not this helper's).
- **Icon visibility** (R37, R38): shown when two or more devices are present.

## `packages/helpers/src/lib/crossDevicePlayback.ts`

Imports types and `PLAYBACK_*` constants from `./accountPlaybackStream.js` only. Nothing Node-only.

```typescript
import type {
  DTOPlaybackDevice,
  DTOPlaybackState,
  PlaybackCommandType,
} from './accountPlaybackStream.js';

export type PlaybackPositionBase = Pick<
  DTOPlaybackState,
  'status' | 'is_live' | 'position_seconds' | 'duration_seconds' | 'rate' | 'updated_at_ms'
>;

/**
 * Server-side estimate: position at `atServerMs` on the server clock. The API uses it to compare
 * a periodic publish with the stored state and to freeze the position when the active device
 * leaves.
 */
export function estimatePlaybackPositionAtServerTime(
  state: PlaybackPositionBase,
  atServerMs: number
): number | null;

/**
 * Client estimate, free of clock skew: the age of the state when it was sent
 * (`sent_at_ms - updated_at_ms`, both server clock) plus the time since this client received it
 * (`nowMs - receivedAtMs`, both client clock).
 */
export function estimatePlaybackPositionSeconds(params: {
  state: PlaybackPositionBase & Pick<DTOPlaybackState, 'sent_at_ms'>;
  receivedAtMs: number;
  nowMs: number;
}): number | null;
```

Both return null when `is_live` or `position_seconds` is null. Otherwise elapsed milliseconds is
clamped to `>= 0`; the result is `position_seconds + (status === 'playing' ? rate * elapsed / 1000
: 0)`, clamped to `>= 0` and to `<= duration_seconds` when duration is a number. The client
function computes elapsed as `(sent_at_ms - updated_at_ms) + (nowMs - receivedAtMs)`, each part
clamped to `>= 0` first, and calls the shared math; keep one private function for the formula.

```typescript
export const PLAYBACK_COMMANDS_ALLOWED_FOR_LIVE: readonly PlaybackCommandType[] = [
  'play',
  'pause',
  'play_item',
  'take_over',
];

export function isPlaybackCommandAllowed(
  commandType: PlaybackCommandType,
  params: { isLive: boolean }
): boolean;

export interface PlaybackRemoteControls {
  canPlayPause: boolean;
  canSeek: boolean;
  canSkip: boolean;
  canSetRate: boolean;
  showsProgress: boolean;
  canTransfer: boolean;
}

export function getPlaybackRemoteControls(params: { isLive: boolean }): PlaybackRemoteControls;
```

`getPlaybackRemoteControls` derives every flag from `isPlaybackCommandAllowed` (`canSkip` and
`showsProgress` follow `seek`), so the two cannot disagree.

```typescript
/** 'active': this device plays. 'remote': another device plays. 'idle': no device is active. */
export type PlaybackRole = 'active' | 'remote' | 'idle';

export function resolvePlaybackRole(params: {
  thisSessionIdText: string | null;
  activeSessionIdText: string | null;
}): PlaybackRole;

/** True when `incoming` should replace `current` (no current, or a higher revision). */
export function isNewerPlaybackRevision(
  current: { revision: number } | null,
  incoming: { revision: number }
): boolean;
```

`resolvePlaybackRole` returns `idle` when `activeSessionIdText` is null, `active` when it equals a
non-null `thisSessionIdText`, else `remote`. Areas B and C route controls by it: `active` plays
locally, `remote` sends commands, `idle` plays locally and claims.

```typescript
export interface PlaybackDeviceListEntry {
  device: DTOPlaybackDevice;
  isThisDevice: boolean;
  isActive: boolean;
  /** 1-based number among devices sharing this label; null when the label is unique. */
  sameLabelNumber: number | null;
}

export function buildPlaybackDeviceList(params: {
  devices: readonly DTOPlaybackDevice[];
  thisSessionIdText: string | null;
  activeSessionIdText: string | null;
}): PlaybackDeviceListEntry[];

export function shouldShowPlaybackDeviceSwitch(devices: readonly DTOPlaybackDevice[]): boolean;
```

`buildPlaybackDeviceList`:

1. Drop duplicate `session_id_text` entries (keep the first).
1. Group key: `device_label` trimmed when non-empty, else `client_type` with a prefix no label can
   start with (for example `'\u0000'`), so a null-label web session never groups with a session
   labeled `web`.
1. Within each group of two or more, sort by `session_created_at` ascending (parse with
   `Date.parse`; an unparsable value sorts last), then `session_id_text`, and number 1 to n. Groups
   of one get null.
1. Output order: the entry for `thisSessionIdText` first when present, then the rest by the same
   sort as step 3.

`shouldShowPlaybackDeviceSwitch` is true when the de-duplicated count is at least 2.

## `packages/helpers/src/index.ts`

Add `export * from './lib/crossDevicePlayback.js';` next to plan 10's export.

## `packages/helpers/package.json`

Add the subpath `./crossDevicePlayback` in the same form as plan 10's `./accountPlaybackStream`.

## Tests

- `packages/helpers/src/lib/crossDevicePlayback.test.ts`:
  - Estimates: playing at rate 1 advances by the combined server age and client elapsed time;
    rate 2 doubles it; paused and loading do not advance; the result clamps at duration and at 0;
    a negative client elapsed time (clock moved back) counts as 0; live returns null; null
    position returns null. The server-time variant agrees with the client variant when
    `sent_at_ms` equals the server time and no client time has passed.
  - Live rules: `seek` and `set_rate` disallowed for live and allowed otherwise; `take_over`,
    `play`, `pause`, `play_item` allowed for both; `getPlaybackRemoteControls({ isLive: true })`
    has `showsProgress`, `canSeek`, `canSkip`, `canSetRate` false and `canTransfer` true.
  - Role: null active is `idle` even when this session is null; equal ids are `active`; different
    ids are `remote`.
  - Device list: this device first; others by `session_created_at`; the active device keeps its
    position and has `isActive`; two `iPhone · iOS` sessions get 1 and 2 by creation time and the
    same numbers regardless of which one is this device; a unique label gets null; two null-label
    web sessions are numbered while a null-label mobile session alone is not; a duplicate session
    id appears once.
  - `shouldShowPlaybackDeviceSwitch`: false for 0 and 1 devices and for two entries with the same
    session id; true for 2.

## Release scratchpad

none
