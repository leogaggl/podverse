**Cursor model:** Cursor Grok 4.7 · **Reasoning:** medium

# 15 — Cross-device playback docs

One place a contributor can read how exclusive active-device handoff works end to end, plus the
guidance agents load when they touch playback. Docs and guidance only; no product code.

Before editing, confirm that:

- `docs/architecture/ARCHITECTURE.md` has a `## Account events` section (realtime plan 16).
- `apps/api/APPS-API.md` has a `### Account event stream` subsection under `## API Endpoints`
  (realtime plan 12).
- Plans 10 to 14 have landed: `packages/helpers/src/lib/accountPlaybackStream.ts`,
  `packages/helpers/src/lib/crossDevicePlayback.ts`, `apps/api/src/lib/accountPlayback/`, and
  `apps/api/src/routes/accountPlayback.ts` exist.

If a section is missing, add it under the heading named here, in the document's style. If plans
10 to 14 have not landed, stop and report.

## Rows

R29, R36, R57, R66, R68

## Runs after

13, 14

## Files

docs/architecture/ARCHITECTURE.md
apps/api/APPS-API.md
.cursor/skills/media-player-architecture/SKILL.md

## Changes

Write in each file's existing style: short paragraphs and bullets, behavior in Podverse terms
(**no-third-party-media-player-style**), no plan or row numbers (**comments-future-forward**).

### `docs/architecture/ARCHITECTURE.md`

1. In `## Account events`, change the sentence that says `playback.*` is reserved: it is in use
   for cross-device playback, described in the next section.
1. Add `### Cross-device playback` at the end of `## Account events`. Cover:
   - **Model.** One device per account plays at a time (exclusive active-device handoff). A
     device is a login session. The playing device is the source of truth: it publishes its item,
     status, position, rate, and liveness on every change and every 10 seconds while playing.
     Other connected devices show that state and move their progress bar forward locally
     (`estimatePlaybackPositionSeconds`); what they show is display only and writes no history or
     position on them.
   - **Routes.** `POST /account/playback/presence` (check in every 15 seconds while the event
     stream is open), `POST /account/playback/state` (publish, claim, or release),
     `POST /account/playback/commands` (target-state commands), and
     `POST /account/playback/commands/{command_id}/start-failed`. All need a membership.
   - **Events.** `playback.snapshot` on connect and after the API recovers its Redis subscription,
     `playback.state` and `playback.devices` on change (ordered by `revision`),
     `playback.command` to the target device only, `playback.start_failed` to the sender only.
     None carries an SSE id. Commands expire after 5 seconds and are never replayed.
   - **Commands.** Play, pause, seek to a position, set a rate, play an item, and take over. Never
     a toggle, so two devices pressing at once agree. Skip forward and back are seeks the sender
     computes. Live items allow play, pause, play an item, and take over; take over starts a live
     item at the live point.
   - **Presence.** Short-lived Redis presence (40 seconds after the last check-in). A cleanly
     closed stream leaves the device list within about 5 seconds; a device that vanishes leaves
     within about 50. When the playing device leaves, the state stays, paused, with no active
     device.
   - **Queue.** Commands never edit a server queue. The playing device writes now-playing through
     the queue routes as it does for a local pick, which also makes that queue the account's
     active one. Queue edits from other devices use the queue routes directly.
   - **Where the code is.** Contract and shared helpers in `packages/helpers/src/lib/accountPlaybackStream.ts`
     and `crossDevicePlayback.ts`; request calls in `packages/helpers-requests/src/api/account/playback.ts`;
     the Redis store and service in `apps/api/src/lib/accountPlayback/`; delivery in the account
     event stream hub.

### `apps/api/APPS-API.md`

In `### Account event stream`, replace "`playback.*` reserved" with a short paragraph: the four
`/account/playback` routes (membership required, 240 requests per minute per account), the five
`playback.*` event names, and that playback presence and state live in Redis under
`podverse:playback:<account_id>:` on the API's `podverse-api-playback` connection.

### `.cursor/skills/media-player-architecture/SKILL.md`

Add a `## Cross-device playback` section before `## Related`:

- Route every play, pause, seek, skip, rate, and item pick by `resolvePlaybackRole` from
  `@podverse/helpers` (mobile: `@podverse/helpers/crossDevicePlayback`): `active` and `idle` play
  locally (`idle` claims), `remote` sends a command with the `@podverse/helpers-requests`
  playback calls.
- Commands name the target state; never add a toggle command.
- Remote state is display only: it never goes through the meaningful-playback path, the
  playback journal, history, or position saves.
- Gate controls for live items with `getPlaybackRemoteControls`; do not re-derive the rule.
- The event contract is `packages/helpers/src/lib/accountPlaybackStream.ts`; the architecture is
  in `docs/architecture/ARCHITECTURE.md` under Account events.

Update `## When to use` to add cross-device playback (publishing state, obeying or sending remote
commands, the device menu). Keep the title; the skill's other sections stay about the non-live
web stack.

## Tests

none (docs and guidance only)

## Release scratchpad

none
