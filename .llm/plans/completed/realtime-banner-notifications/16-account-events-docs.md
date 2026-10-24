**Cursor model:** Cursor Grok 4.7 · **Reasoning:** medium

# 16 — Account events architecture doc

One place a contributor can read how account events move from a database write to an open
client stream, and which processes need Redis for it. Per-app details already live in the files
plans 12–15 edit (`apps/api/APPS-API.md`, `apps/api/ENV.md`, `apps/management-api/ENV.md`,
`apps/workers/ENV.md`); this plan adds the cross-app picture and links to them.

Other work is landing in the tree. Before editing, confirm `docs/architecture/ARCHITECTURE.md`
still has its `### Caching` subsection under `## Database` and its `## Message Queue` section.

## Rows

R41, R42, R46

## Runs after

11, 12, 13, 14, 15

## Files

docs/architecture/ARCHITECTURE.md

## Changes

1. In `### Caching`, change the first bullet so it no longer says Valkey is only a cache: Valkey
   (Redis) holds the API and worker caches and carries account events over pub/sub (see Account
   events below).
1. Add a `## Account events` section after `## Message Queue`, before `## Add-by-RSS`. Write it in
   the document's existing style (short paragraphs and bullets, no plan references). Cover:
   - **What it is.** `GET /account/events` is the account's one SSE stream. Web tabs share one
     stream per browser profile. The mobile app holds one in the foreground, and in the
     background while it plays audio. Event names are namespaced: `notification.*` today;
     `playback.*` is reserved for cross-device playback, both latest-value state and one-shot
     control commands. Neither kind carries an SSE id or replays. Clients ignore names they do
     not know. The client contract is in `packages/helpers/src/lib/accountEventStream.ts`.
   - **Path of an event.** A process writes notification state through `@podverse/orm`
     (`createMany`, `updateNotificationsLastReadAt`, mark-one). After the write commits, the ORM
     publishes a small account event (account id, type, ids) on the Redis channel
     `podverse:account-events` through the publisher the process registered. Each API pod holds
     one subscriber connection, loads the rows and unread count for accounts with open streams,
     and writes SSE events to them.
   - **Who publishes.** API pods, the management API, and the worker commands that write
     notifications (listed in `apps/workers/ENV.md`). Each opens one dedicated publisher
     connection, separate from any cache connection, and registers it at startup; a process that
     writes notifications with none registered logs a warning at startup and on every dropped
     batch, and fails in tests.
   - **Failure behavior.** A publish failure never fails the write. Redis being down does not stop
     the management API or the writing workers. Clients catch up on reconnect: the stream sends a
     state snapshot on every connection, and only events with an SSE id (`notification.created`)
     replay from `Last-Event-ID`, up to 50.
   - **Adding an event type.** Add its data to `AccountEventDataByType` in
     `packages/orm/src/lib/accountEventPublisher.ts`, publish it after the write commits, and add
     its handler to the API hub in `apps/api/src/lib/accountEventStream/`. Latest-value types
     carry no SSE id and send a snapshot on connect instead of replaying. One-shot command types
     carry no SSE id either and are never replayed, so a client that was disconnected never acts
     on a stale command. A type that needs replay needs a new SSE id format, because ids are
     notification ids.
   - Links to `apps/api/APPS-API.md` (proxy requirements) and the three `ENV.md` files.

## Release scratchpad

none (docs only)
