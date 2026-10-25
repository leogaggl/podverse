**Cursor model:** Opus 5.5 · **Reasoning:** extra high

# 14 — Deliver `playback.*` on the account event stream

The stream hub's half of cross-device playback: send each new stream a playback snapshot, relay
`playback.*` events from the Redis fanout to the right streams (state and devices to every device
of the account, a command only to its target, a start-failed report only to its sender), drop
expired commands, and turn a stream ending into the right presence change so the device menu
stays honest (R36, R57). No database reads on this path.

Other work is landing in the tree. Before editing, confirm that in
`apps/api/src/lib/accountEventStream/accountEventStreamHub.ts`:

- `AccountEventStream` has `sessionIdText` and `ended`, and every end goes through one private
  `endStream(stream)` (auth-sessions-stream-close plan 70).
- `onEvent` handles `toAccountSessionEndedSignal` first, then notification signals, then the
  unknown-type `debug` log; registration writes `notification.state` and replay; `onRecovered`
  exists (realtime plan 12).
- `apps/api/src/lib/accountPlayback/playbackService.ts` exports `readPlaybackSnapshot` and
  `handlePlaybackPresenceChange`, and `playbackStore.ts` exports `shortenPlaybackPresence`,
  `removePlaybackPresence`, and `prunePlaybackPresence` (plan 12).

If any is missing, stop and report. If plan 70 has not landed but the realtime hub has, stop and
report as well: the session id on each stream is what targets commands.

## Rows

R29, R31, R36, R57

## Runs after

10, 11, 12

## Files

apps/api/src/lib/accountEventStream/accountEventStreamHub.ts
apps/api/src/lib/accountEventStream/accountEventStreamHub.test.ts
apps/api/src/test/account-events.test.ts
apps/api/src/config/index.ts
apps/api/src/lib/startup/validation.ts
apps/api/.env.example
infra/k8s/base/api/source/api.env
packages/helpers-config/src/podverseTestEnv.ts

## Decisions this plan fixes

- **Snapshot on connect** (the request's "whether a new stream gets the current state"): yes.
  After `notification.state` and replay, the hub writes one `playback.snapshot` (plan 10) with the
  current device list and state. The same on `onRecovered`, since events were lost while the
  subscriber was down. Every stream gets it, member or not; a non-member's snapshot is an empty
  list and null state, a few bytes.
- **Nothing older than the snapshot follows it.** Live playback events that reach a stream while
  its snapshot read is in flight are held on that stream and written after the snapshot, in
  arrival order. The client's revision check then drops any that the snapshot already covers.
- **Relayed events skip the notification chain.** Playback events need no query, so they are
  written at once, like `session.ended`. Holding them behind a slow notification query would make
  the progress bar and remote controls lag.
- **Commands go only to the target's streams, and only before they expire** (R31). A command
  whose `expires_at_ms` has passed when it reaches the hub is dropped with a `debug` log.
- **Leave grace comes from env, not the helper constant.** `PLAYBACK_PRESENCE_LEAVE_GRACE_MS` in
  `@podverse/helpers` stays `5_000` (the product value, plan 10). The hub timer reads
  `config.playback.presenceLeaveGraceMs`, parsed from the required env
  `PLAYBACK_PRESENCE_LEAVE_GRACE_MS` with no code fallback (`process.env.PLAYBACK_PRESENCE_LEAVE_GRACE_MS!`,
  validated at startup as a positive integer). Set `"5000"` in `apps/api/.env.example` (double
  quotes) and `5000` in `infra/k8s/base/api/source/api.env` (unquoted). Push `validateRequired`
  in the same order as `.env.example` (**startup-validation-env-order**). In
  `packages/helpers-config/src/podverseTestEnv.ts`, export
  `WEB_E2E_PLAYBACK_PRESENCE_LEAVE_GRACE_MS = 500` and set the env to `'500'` on `apiWebE2e`
  only. `apiVitest` and `apiMobileE2e` set `'5000'`. The mobile handoff flow waits out the
  product grace, so the mobile E2E API keeps 5 s.
- **How a stream's end changes presence** (R57):

| Why the stream ended | Presence |
| --- | --- |
| client closed the connection, or a write failed or hit backpressure | shortened to now + `config.playback.presenceLeaveGraceMs` |
| its session ended (`session.ended`) | removed at once, and devices published |
| 30-minute cap, token expiry, hub shutdown | unchanged (the client reconnects and keeps checking in) |

  Only when no other open stream on this pod has the same session: several tabs share one
  session, and closing one tab must not remove the device.
- **Sweep for silent leaves.** Every `PLAYBACK_PRESENCE_SWEEP_INTERVAL_MS = 10_000`, each pod
  prunes presence for each account that has an open stream on that pod and whose last known
  device list had at least two devices. One device alone has nobody to show the change to. The
  prune script reports each removal to one caller, so pods sweeping the same account publish once.
  A device that vanishes without closing its stream (laptop sleep, lost network) leaves the menu
  within the 40-second presence TTL plus up to 10 s.

## Hub changes (`accountEventStreamHub.ts`)

### State

- Each `AccountEventStream` gains `playbackSnapshotPending: boolean` (true from registration
  until its snapshot is written) and `pendingPlaybackEvents: AccountPlaybackStreamEvent[]`
  (bounded at 50; on overflow drop the oldest).
- `knownPlaybackDeviceCountByAccount: Map<number, number>`, set from each snapshot and each
  `playback.devices` event; deleted when the account's last local stream ends.
- One sweep interval, started in `startAccountEventStreamHub` and cleared in
  `closeAccountEventStreamHub`.

### `endStream(stream, reason)`

Add a `reason` parameter, `AccountEventStreamEndReason = 'client_closed' | 'write_failed' |
'lifetime' | 'token_expiry' | 'session_ended' | 'shutdown'`, and pass the right value from every
existing call site (the close listener, the write-failure and backpressure paths, the two timers,
`closeAccountEventStreamHub`, and plan 70's session-ended handling). After the existing work, when
the reason is `client_closed` or `write_failed` and no other non-ended stream of that account on
this pod has the same `sessionIdText`:

1. `shortenPlaybackPresence({ accountId, sessionIdText, expiresAtMs: now + config.playback.presenceLeaveGraceMs })`.
1. A one-shot `setTimeout` at `config.playback.presenceLeaveGraceMs + 250` ms that runs
   `prunePlaybackPresence` then `handlePlaybackPresenceChange` for the account, so the departure
   is published promptly even if no sweep covers the account (the timer is `unref`'d and tracked
   so `closeAccountEventStreamHub` clears it).

For `session_ended`, run `removePlaybackPresence` then `handlePlaybackPresenceChange` once per
session (not per stream) after the session's streams end.

All of these are fire-and-forget from `endStream`'s point of view: `void` the promise, catch,
and log `PlaybackStoreUnavailableError` once per outage and other errors with
`loggerService.logError`. `endStream` stays synchronous.

### Registration

After `notification.state` and replay (and after plan 70's recently-ended check, which sends
nothing else on a hit):

1. `readPlaybackSnapshot({ accountId, nowMs: Date.now() })`.
1. If the stream ended meanwhile, stop.
1. Write `playback.snapshot` with `sent_at_ms` on its state set to `Date.now()` at write time.
1. Set `playbackSnapshotPending = false`, then write each held event in order (through the same
   per-type write function as live delivery below, so expiry and targeting still apply), and clear
   the list.

A failed read (Redis down) still clears `playbackSnapshotPending` and flushes held events; log as
above. The client then has no snapshot until its next connection, which matches what it would see
with Redis down anyway.

### `onEvent`

After the session-ended branch and before notification handling:

```typescript
if (event.type.startsWith('playback.')) {
  const playbackEvent = toAccountPlaybackStreamEvent(event.type, event.data);
  // null: unknown playback type or bad data → one warn per distinct type per process, drop
  // else: deliverPlaybackEvent(event.account_id, playbackEvent)
  return;
}
```

Skip it when the account has no local streams, before any work. `playback.snapshot` arriving from
Redis is not expected (only the hub writes it); treat it as unknown and drop it.

`deliverPlaybackEvent(accountId, playbackEvent)`, per type, over the account's non-ended streams:

- `playback.state`: every stream; copy the data with `sent_at_ms = Date.now()` at write time.
- `playback.devices`: every stream; update `knownPlaybackDeviceCountByAccount`.
- `playback.command`: streams whose `sessionIdText` equals `data.target_session_id_text`, and
  only when `Date.now() < data.expires_at_ms`.
- `playback.start_failed`: streams whose `sessionIdText` equals `data.sender_session_id_text`.

A stream with `playbackSnapshotPending` gets the event appended to its held list instead of a
write. Writes use `formatSseEvent({ event: playbackEvent.type, data })` with no `id`, and the same
ended and backpressure checks as every other write.

### `onRecovered`

After the existing notification replay and state, for each account with streams, read one
snapshot per account and write it to each of that account's streams (mark them pending during
the read so live events hold, as at registration).

### Sweep

Every `PLAYBACK_PRESENCE_SWEEP_INTERVAL_MS` (`unref`'d), for each account in `streamsByAccount`
whose known device count is at least 2: `prunePlaybackPresence`, then
`handlePlaybackPresenceChange` when it reports a change. Run accounts one after another (a `for`
loop with `await`), and skip a tick while the previous tick is still running. The publish from a
removal comes back through Redis like every other event.

## Reuse

`formatSseEvent` from `sseWire.ts` (realtime plan 12); `toAccountPlaybackStreamEvent` and the
`PLAYBACK_*` constants from `@podverse/helpers` (plan 10) except the leave grace, which is
`config.playback.presenceLeaveGraceMs`; `readPlaybackSnapshot`,
`handlePlaybackPresenceChange`, and the presence functions from plan 12. Do not query the
database.

## Tests

- `apps/api/src/lib/accountEventStream/accountEventStreamHub.test.ts` (extend realtime plan 12's
  harness; mock `@api/lib/accountPlayback/playbackService.js` and
  `@api/lib/accountPlayback/playbackStore.js` with `vi.fn`; fake timers):
  - Registration writes `notification.state`, then `playback.snapshot` with the mocked devices
    and state, with `sent_at_ms` equal to the fake clock at write time.
  - A `playback.state` event delivered while the snapshot read is pending is written after the
    snapshot, not before.
  - `playback.state` reaches both streams of the account and no stream of another account.
  - `playback.command` reaches only the target session's streams (two streams on the target
    session both get it; a stream on another session does not), and an expired command reaches
    none.
  - `playback.start_failed` reaches only the sender session's streams.
  - A `playback.state` with invalid data and a `playback.progress` event write nothing and warn
    once per type.
  - A playback event is written while a notification query for the same account is still
    pending.
  - Client close of the only stream on a session shortens presence and, after the grace timer,
    prunes and handles the change; client close of one of two streams on the same session does
    neither.
  - The 30-minute cap and `closeAccountEventStreamHub` do not touch presence.
  - A `session.ended` event removes presence once for that session and handles the change.
  - The sweep prunes an account whose last devices event listed two devices and skips one that
    listed one.
  - `onRecovered` writes a fresh `playback.snapshot` to each stream.
  - A snapshot read that throws `PlaybackStoreUnavailableError` still flushes held events.
- `apps/api/src/test/account-events.test.ts` (extend realtime plan 12's integration test, using
  plan 12's real test Valkey): after `notification.state`, the stream receives
  `playback.snapshot` with an empty device list and null state for a fresh account. A second
  connection after `touchPlaybackPresence` (plan 12, called directly so this plan does not wait
  for plan 13's routes) for that session gets a snapshot listing it. Invoking the captured
  `onEvent` with a `playback.devices` event for the account delivers it on the open stream.
  Delete the account's `podverse:playback:<id>:*` keys afterwards.

## Release scratchpad

none (plan 13's entry covers the stream's playback events)
