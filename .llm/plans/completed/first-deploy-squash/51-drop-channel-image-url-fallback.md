**Cursor model:** Cursor Grok 4.7 · **Reasoning:** medium

Stop reading `channel_image_url` when reconstructing an Add by RSS index item. Channel art comes from `channel_images` only.

## Rows

R21

## Runs after

none

## Files

packages/parser-mapping/src/addByRSS/reconstruct.ts
packages/parser-mapping/src/addByRSS/reconstruct.test.ts

## Tests

Update `packages/parser-mapping/src/addByRSS/reconstruct.test.ts`.

In `describe('buildMinimalAddByRSSItemFromResourceData')`, add one test: a row whose `channel_images` is missing and whose `channel_image_url` is `https://cdn.example.com/old.jpg` still builds an item, and `channelImageUrl` is `undefined`. Build that row with the existing `phoneRow` helper. Do not add a second case for the livestream path; both paths call `channelImageUrlFromResourceData`.

The existing test `maps the enclosure, titles, artwork, duration, pub date, medium, feed URL, and guid` already expects `channelImageUrl` from `channel_images`. Leave it.

No API integration test, Playwright spec, or Maestro flow. The web seed and the web specs that still send `channel_image_url` also send `channel_images` with the same URL, so they keep their art. Those files belong to area G. Do not edit them.

## Release scratchpad

```markdown
## Add by RSS channel art reads channel_images

- Surfaces: parser-mapping (web and mobile reconstruct queue and playlist rows through this)
- Change: reconstructing an Add by RSS item no longer reads `channel_image_url`. Channel art comes from `channel_images` only. Current builders already send `channel_images`.
- Who notices: a stored queue or playlist payload that has only `channel_image_url` loses channel art on reconstruct. A first-deploy database wipe removes those server rows.
- Operator steps: none
```

## Why this is the only code removal

`buildAddByRSSResourceData` in `packages/parser-mapping/src/addByRSS/queuePlaylistHelpers.ts` writes `channel_images` from `channelImageUrl`. It does not write `channel_image_url`. The only reader in `packages/**` (outside `packages/ui`, `packages/i18n-catalog`, and `packages/worker-commands`) is `channelImageUrlFromResourceData` in `reconstruct.ts`. It prefers `channel_images`, then falls through to `channel_image_url`. That second read exists for payloads stored before `channel_images`.

`imageEntriesFromResourceData` already drops entries whose `url` is empty, so the first remaining entry's `url` is the channel image.

## Edit

In `channelImageUrlFromResourceData`, delete the `channel_image_url` read. Return the first `channel_images` URL, or `undefined` when there is none:

```typescript
function channelImageUrlFromResourceData(resourceData: AddByRSSResourceData): string | undefined {
  const [first] = imageEntriesFromResourceData(resourceData.channel_images);
  return first?.url;
}
```

Leave both call sites (`toItemIndexItem` and the livestream builder) on this function. Do not add a comment about the removed key.

## Leave these in place

These were checked and are current behavior, or they are owned by another area's callers. Do not edit them in this plan.

- `getLegacyAddByRSSHashId` and `getAddByRSSHashIdsForResourceData`. A payload with no `feed_url` still hashes `channel_id_text` plus guid or enclosure URL. That is how a new item with no feed URL is identified, including the E2E fresh Add by RSS row that omits `feed_url`. The second id, when the payload has `feed_url`, also names a row stored without it. Those rows can sit in web IndexedDB or on a device that was not deleted. Postgres rows go away with the database wipe. Do not drop the second id here.
- `migration_baseline` and `adoptCachedExpiryWithManager`. A cached `membership_expires_at` that no grant covers is adopted on the next ledger write. Seeds and the management API ledger test still hit that path. `legacy_import` is membership from the previous Podverse app and stays.
- `id_text`, `item_id_text`, `channel_id_text`, and `podcastId` in `resolveNotificationDestinationFromPayload`. Current senders in `packages/parser` and `packages/notifications` write `itemIdText`, `channelIdText`, and message types such as `new-episode`. `apps/mobile/src/push/notificationTarget.test.ts` (area C) still asserts `{ type: 'podcast', id_text }`.
- `packages/parser-mapping/src/compat/**`. That tree maps the parser's partytime feed shape. It is not an upgrade of an older v5 schema.
- `DATABASE_CONSTANTS.varchar_long` (2500). ORM columns and profile bio still use that width. The descriptions backfill in area F also reads it.
- `sortPrefs.ts` dropping an unrecognised stored preference. Storage outlives the build that wrote it; that is the contract of the helper, not a one-time schema repair.
- Factory proxies under `packages/parser/src/factories/` and `packages/orm/src/factories/`. Callers import them today. Comment edits for those files are plan 50.
- v4 compatibility: `legacy_import`, and any symbol whose only job is the previous Podverse app.
