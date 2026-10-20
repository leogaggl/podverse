# 745-defer-mobile-add-by-rss-playback-recording

**Master step:** P2.3.17
**Model (author + implement):** Opus 5
**Status:** done

## Scope

Mobile records playback for add-by-RSS episodes the same way it records linked resources. Playing
one on the phone enqueues outbox rows, saves now-playing and position to the account (after
reconnect when offline), and takes part in reconciliation and multi-device handoff.

**Livestream records nothing, and that is correct.** A livestream has no meaningful resume
position. `nowPlayingResourceFromTarget` returns `null` for the `livestream` kind and for an
add-by-RSS target whose resource data is a livestream (`liveItem` or `livestream_item`).

## Identity

The resource id is the add-by-RSS hash of **feed URL plus guid**: `getAddByRSSHashId` over resource
data whose `feed_url` is canonical (userinfo removed). An item with no RSS guid, or a guid made up
on the device, falls back to feed URL plus enclosure URL. Every device and the API compute the same
id for the same episode, so a row written on web matches the episode on the phone. The md5 shim
(`apps/mobile/src/shims/node-crypto.js`) hashes UTF-8 bytes and matches Node, including for
non-ASCII guids.

Every mobile resource data builder canonicalizes `feed_url` (`withCanonicalAddByRssFeedUrl` in
`apps/mobile/src/lib/addByRss/resourceData.ts`): playback resource data, queue adds, playlist adds,
history moves, and the outbox payload. Credentials never leave the device.

## Recording

- `nowPlayingResourceFromTarget` (`apps/mobile/src/playback/playbackEventSource.ts`) returns
  `{ resourceKind: 'add_by_rss', resourceIdText: <hash> }`.
- `writePlaybackEvent` (`apps/mobile/src/playback/PlaybackProvider.tsx`) picks the queue from the
  resource data `medium_id`, or the podcast queue when it is null (`playbackMediumIdFromTarget`).
  Queue advance after an add-by-RSS episode reads the same queue.
- The outbox payload carries the full `add_by_rss_resource_data` next to any stats payload
  (`playbackEventPayloadForTarget`), so replay can create the server row.
- The meaningful-event rule is the one linked resources use: play, pause, seek, periodic position,
  and completion.
- Ended or skipped add-by-RSS episodes move to history through
  `POST /queue/:queue_id_text/item-add-by-rss/history` (`playbackTargetToHistoryTarget`).

## Reconciliation and handoff

- Later-wins applies with add-by-RSS on either side (`playbackReconcile.ts` is kind-agnostic).
- The handoff prompt names an add-by-RSS side by its episode title: the server row's resource data,
  the active player, or the newest pending outbox payload. When none has a title it shows the Add by
  RSS label, never the hash.
- Switching to, or adopting at startup, a server add-by-RSS row goes through `playQueueResource`.
  When this device has parsed the same feed, it plays its own copy of the episode, matched by
  canonical feed URL and then guid or enclosure, and confirmed by hash
  (`resolveLocalAddByRssResourceData`). Otherwise it plays from the row's resource data, falling back
  to its `enclosure_url` when the row has no parsed bundle. A startup adopt loads paused.

## Acceptance criteria

- Playing an add-by-RSS episode on mobile enqueues outbox events with the same meaningful-event rule
  as linked resources, using the resource kind `add_by_rss` and the feed URL plus guid id.
- Offline add-by-RSS listening drains to the API after reconnect and lands in history in
  chronological order alongside linked-resource listening.
- An add-by-RSS episode played on mobile wins a later-wins merge against an older server row.
- A different-item handoff conflict where either side is add-by-RSS prompts with a usable title, not
  a bare hash id.
- Livestream targets still record nothing.

## Web parity references

- `apps/web/src/hooks/useAddByRSSPositionSave.tsx`
- `apps/mobile/src/playback/playbackEventSource.ts`
- `apps/mobile/src/playback/PlaybackProvider.tsx`
- `apps/mobile/src/hooks/useAddByRssPlayback.ts`
- `apps/mobile/src/lib/addByRss/localResourceData.ts`
- `apps/mobile/src/data/repositories/playbackOutbox.ts`
- `apps/mobile/src/data/repositories/playbackReconcile.ts`
- [743-offline-playback-reconciliation](/docs/proposals/mobile/_master-plan_/phase-2/details/743-offline-playback-reconciliation.md)
- [744-multi-device-playback-handoff](/docs/proposals/mobile/_master-plan_/phase-2/details/744-multi-device-playback-handoff.md)

## Verification

Unit coverage: `playbackEventSource.test.ts`, `playbackHandoffTitle.test.ts`,
`playbackReconcile.test.ts`, `localResourceData.test.ts`, and `nodeCryptoShim.test.ts`.
`add-by-rss.yaml` asserts the server now-playing row after the phone plays an add-by-RSS episode,
and `playback-multi-device-handoff.yaml` switches to an add-by-RSS row another device wrote.

```bash
npm --prefix apps/mobile run test
npm run mobile:e2e:test -- playback-multi-device-handoff
npm run mobile:e2e:test -- playback-offline-reconciliation
npm run mobile:e2e:test -- add-by-rss
open .artifacts/mobile-e2e-reports/latest/failures.json
open .artifacts/mobile-e2e-reports/latest/ios-phone/index.html
open .artifacts/mobile-e2e-reports/latest/android-phone/index.html
```
