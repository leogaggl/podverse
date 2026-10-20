# 06 — Web resumes an Add by RSS episode started on another device

**Cursor model:** Opus 5.5 · **Reasoning:** high

## Summary

When the server's now-playing row is an Add by RSS episode written by mobile, web must load it
in the mini player at the phone's position, even if this browser has never parsed the feed, then
fill in the metadata in place once it has. Depends on 03 (same id), 04 (mobile writes the row),
and 05 (change event, first parse). Web and parser-mapping only.

## Why it fails today

`handleLoadQueueItemAddByRSS` in `useMediaPlayerControllerQueueHeadLoading.ts` (around line 549)
calls `loadAddByRSSIndexItemFromResourceData` in
`apps/web/src/utils/addByRSS/playFromQueueResource.ts`, which tries:

1. IndexedDB by `resourceData.id_text`. That id is random per device, so a mobile row never
   matches.
2. `reconstructAddByRSSItemFromResourceData`, which needs the embedded `bundle`. Mobile's
   resource data (`toAddByRssItemPlaybackResourceData`) does not carry one.

Both miss, the function returns null, and nothing loads.

## Changes

### Identity

Change `addByRSSPlaybackIdentity(resourceData)` (added in 01) to return the Add by RSS hash. On a
server row use `resource.add_by_rss_hash_id` when present; locally use `getAddByRSSHashId` on the
resource data. Both sides hash the same canonical `feed_url` + guid after 03, so a phone row and a
web play of the same episode compare equal. Rows without `feed_url` compare by the legacy hash on
both sides. Update the 01 unit tests that assumed `id_text`.

### Lookup order in `loadAddByRSSIndexItemFromResourceData`

1. IndexedDB by `id_text` (same browser). Unchanged.
2. **By feed and episode.** Canonical `feed_url` → `getAddByRSSFeedByUrl` (`storage.ts`), then
   the item by guid (`getAddByRSSItemByGuid` / `findAddByRSSItemByGuid` in `itemIndex.ts`). When
   the guid is device-local (`isDeviceLocalAddByRSSGuid` from 03) or missing, match by
   `enclosure_url`.
3. Reconstruct from `bundle` (unchanged).
4. **Minimal item.** New `buildMinimalAddByRSSItemFromResourceData(resourceData)` in
   parser-mapping next to `reconstructAddByRSSItemFromResourceData`: enclosure URL, title,
   channel title, channel and item images, duration, pub date, medium, `feed_url`, guid. Returns
   null only when there is no `enclosure_url`.
5. Livestream rows (`start_time` set) keep the current livestream path and get no minimal
   fallback.

Return which step matched (for example `{ indexItem, source: 'local' | 'feed' | 'bundle' |
'minimal' }`) so the caller knows whether to upgrade in place.

### Upgrade in place

When the source is `'minimal'` or `'bundle'` and the row has a `feed_url`:

- If this browser has that feed (IndexedDB record or server follow), ask `firstParse.ts` (05) to
  parse it if it has never been parsed. Do not start a refresh of an already parsed feed here.
- Subscribe with `onAddByRSSFeedChanged` (05). When the feed changes, look the item up again
  (step 2). If found, and the same identity is still loaded, replace the metadata: title,
  artwork, chapters, transcript, notes, value tags.
- The media element must not reload. The source URL is the same enclosure, so keep the `src`,
  the position, and the playing state. Read how `NonLiveMediaOrchestrator.tsx` derives its `src`
  and what it keys effects on; if replacing `mpAddByRSS` would reload, add a metadata-only update
  path in the media player context instead of reloading.
- Unsubscribe when a different item loads.
- If the feed is not followed on this account, keep the minimal metadata. Do not follow or parse
  on the user's behalf.

### Position

`handleLoadQueueItemAddByRSS` already reads `nextResource.playback_position`. Confirm the minimal
path passes it through and that `pauseOnLoad` adoption (page load) does not autoplay.

### Handoff prompt title

When the prompt names an Add by RSS item, its title comes from the resource data (or the local
item when found), never the hash.

## Tests

Unit (`apps/web` and `packages/parser-mapping`):

- Lookup order: same-browser `id_text`, feed + guid, feed + enclosure for a device-local guid,
  bundle, minimal, and null without `enclosure_url`.
- `buildMinimalAddByRSSItemFromResourceData` maps every field it promises.
- Upgrade: a feed change replaces metadata for the loaded identity and does nothing after a
  different item loads.

E2E `apps/web/e2e/media-player-addbyrss-cross-device.spec.ts`. Top-level `describe`: "Add by RSS
resume from another device". Mock parse with `apps/web/e2e/helpers/addByRSSCredentials.ts`.

1. With `page.request`, post now-playing for an episode of the seeded test-assets feed the way
   mobile does: `feed_url`, guid, `enclosure_url`, title, `playback_position` 30, a random
   `channel_id_text`, no `bundle`, an `id_text` this browser has never seen.
2. Fresh context, sign in, load home. The mini player shows that title.
3. Press play. Audio time is near 30 s.
4. Let the mocked parse finish. The title and artwork update, and the audio keeps playing from
   where it was (`src` unchanged, time did not jump back).

## Scratchpad entry

```markdown
## Web picks up Add by RSS listening from the phone

- Surfaces: web, packages (parser-mapping)
- Change: When the account's now-playing episode is from an Add by RSS feed played on another
  device, web loads it in the player at the same position, even before this browser has parsed
  the feed. Title, artwork, and notes fill in once the feed is parsed, without restarting audio.
- Who notices: anyone switching from the phone to web with an Add by RSS episode
- Operator steps: none
```

## Done when

- [x] Identity is the Add by RSS hash on both sides
- [x] Lookup order with the feed + guid step and the minimal fallback
- [x] Metadata upgrades in place without reloading media
- [x] Unit tests, E2E spec, scratchpad entry

## Operator verification

**Root**

```bash
npm run build:packages
npm run test -w packages/parser-mapping
npm run test -w apps/web
make e2e_test_web_report_spec SPEC=e2e/media-player-addbyrss-cross-device.spec.ts,e2e/media-player-addbyrss-no-swap.spec.ts,e2e/media-player-addbyrss-resume.spec.ts
open .artifacts/e2e-reports/latest/index.html
```
