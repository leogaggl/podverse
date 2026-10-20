# 04 — Mobile records Add by RSS playback

**Cursor model:** Opus 5.5 · **Reasoning:** high

## Summary

Mobile plays Add by RSS episodes but never writes now-playing or position to the server, so web
cannot follow and a stale server row can win a later merge. Implement detail doc
[745](/docs/proposals/mobile/_master-plan_/phase-2/details/745-defer-mobile-add-by-rss-playback-recording.md)
on the new id from 03. Runs in parallel with 05. Edit only `apps/mobile/**`, doc 745, and the 745
row in `phase-2/001-MASTER-PLAN-PHASE-2.md`. Do not edit the catalog, the API, web, or `packages/`.

## The gate

`apps/mobile/src/playback/PlaybackProvider.tsx`, `writePlaybackEvent` (around line 973):

```ts
const target = activeTargetRef.current;
// Add-by-RSS plays from a device-local feed with no channel and no queue behind it, so
// there is no queue-scoped playback event to write.
if (target === null || target.kind === 'add-by-rss') { return false; }

const resource = nowPlayingResourceFromTarget(target);
...
const queueFromList = getQueueForMedium(queuesRef.current, target.channel.medium_id);
```

`nowPlayingResourceFromTarget` in `apps/mobile/src/playback/playbackEventSource.ts` returns null
for `add-by-rss` and `livestream`, and `PlaybackNowPlayingResource.resourceKind` is
`'clip' | 'item' | 'soundbite'`.

Everything downstream already handles `add_by_rss`: `PLAYBACK_OUTBOX_RESOURCE_KINDS`,
`playbackReconcile.ts` (around line 356), `drainPlaybackJournal.ts` (around line 36), and the
outbox replay in `playbackOutboxRepository.ts` (around lines 471, 514, and 1018), which calls
`reqQueueResourceItemAddByRSSAddNowPlaying` with `add_by_rss_resource_data` from the payload.

## Changes

### Resource data

- `toAddByRssItemPlaybackResourceData` in `apps/mobile/src/lib/addByRss/domain.ts` already sets
  `feed_url: record.feedUrl`. Canonicalize it with `canonicalAddByRSSFeedUrl` from
  `@podverse/helpers-validation` (userinfo never leaves the device). Same for the queue and
  playlist add calls in `queueRepository.ts` (around 676) and `playlistRepository.ts` (around 975).
- If 03's final message listed a mobile guid fallback form it did not cover, follow it.
- Confirm the md5 shim (`apps/mobile/src/shims/node-crypto.js`) hashes strings as UTF-8. Add a
  unit test that a non-ASCII guid gives the same id as `getAddByRSSHashId` under Node.

### Recording

- `nowPlayingResourceFromTarget` returns `{ resourceIdText: getAddByRSSHashId(resourceData),
  resourceKind: 'add_by_rss' }` for an `add-by-rss` target. Widen the `resourceKind` type.
  Livestream keeps returning null, including an Add by RSS livestream.
- Remove the `add-by-rss` early return in `writePlaybackEvent`.
- Choose the queue from the medium of the Add by RSS target (`resourceData.medium_id`), falling
  back to the podcast medium when it is null, the same way 01 does on web. Use the helpers
  constant, not a number. Do not read `target.channel` for this kind.
- The outbox payload carries the full `add_by_rss_resource_data` so replay can create the row.
  Check that the payload builder for this event kind includes it.
- Use the same meaningful-event rule as linked resources (start, pause, seek, periodic position,
  completion). Do not add an Add by RSS-only cadence.

### Reconciliation and handoff

- Later-wins merge: an Add by RSS event played on the phone wins against an older server row.
- Handoff prompt: when either side is Add by RSS, the title comes from the stored resource data
  or the local feed, never the bare hash.
- A server now-playing Add by RSS row written by web can be adopted on mobile: find the local feed
  by canonical `feed_url` and the item by guid. If the feed is not on this device, play from the
  row's resource data (`enclosure_url`, title, images, `playback_position`), the same fallback the
  outbox replay already trusts. Read the current adopt path before adding anything; extend it
  rather than adding a second one.

### Doc 745

Set status to done, note that the id is feed URL plus guid, and update the master plan row.
Keep the livestream note.

## Tests

Unit (`apps/mobile`):

- `nowPlayingResourceFromTarget`: Add by RSS returns the new id and kind; livestream returns null.
- `writePlaybackEvent`: an Add by RSS target enqueues an outbox row on the podcast queue when
  `medium_id` is null.
- Reconcile: later-wins with Add by RSS on either side; the prompt title is not a hash.
- Hash parity: non-ASCII guid.

Maestro: extend `apps/mobile/e2e/playback-multi-device-handoff.yaml` (or add a focused flow next
to it) so playing an Add by RSS episode makes it the server now-playing row. `make
mobile_e2e_seed` reuses the web seed (`tools/web/seed-e2e.mjs`), which 03 owns and which already
seeds an Add by RSS follow on the test-assets feed. Do not edit the seed here; if the flow needs
more, say so in your final message. Check `playback-offline-reconciliation.yaml` still passes
with Add by RSS now recorded.

## Scratchpad entry

```markdown
## Mobile records Add by RSS listening

- Surfaces: mobile
- Change: Playing an Add by RSS episode on the phone saves now-playing and position to the
  account, including when offline (sent after reconnect). Web and other devices can pick up where
  the phone left off. A now-playing Add by RSS episode from another device can be resumed on the
  phone even before this phone has parsed that feed.
- Who notices: anyone using Add by RSS on the phone and another device
- Operator steps: ships in the next store build
```

## Done when

- [ ] Add by RSS targets produce outbox events; livestream still records nothing
- [ ] Queue chosen by medium with podcast fallback
- [ ] `feed_url` canonical in every mobile resource data builder
- [ ] Reconcile, handoff title, and adopt-from-server handled
- [ ] Unit tests, Maestro flow, doc 745 and master plan row, scratchpad entry

## Operator verification

**Mobile**

```bash
npm run type-check:mobile
npm --prefix apps/mobile run test
make mobile_e2e_seed
```

**Mobile Maestro** (needs Mobile E2E Metro, Mobile E2E API, Mobile E2E test-assets, and Mobile E2E
iOS or Mobile E2E Android running; see `apps/mobile/e2e/HOW-TO-RUN.md`)

```bash
npm run mobile:e2e:test -- playback-multi-device-handoff
npm run mobile:e2e:test -- playback-offline-reconciliation
npm run mobile:e2e:test -- add-by-rss
open .artifacts/mobile-e2e-reports/latest/failures.json
open .artifacts/mobile-e2e-reports/latest/ios-phone/index.html
open .artifacts/mobile-e2e-reports/latest/android-phone/index.html
```
