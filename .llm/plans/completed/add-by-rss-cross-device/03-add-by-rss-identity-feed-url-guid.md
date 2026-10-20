# 03 — Same Add by RSS id on every device

**Cursor model:** Opus 5.5 · **Reasoning:** high

## Summary

`add_by_rss_hash_id` is the MD5 of `{ channel_id_text, guid }`. `channel_id_text` is a random id
each device creates for its local copy of the feed, so the same episode gets a different id on
every device. Change the hash input to `{ feed_url, guid }` (or `{ feed_url, enclosure_url }` with
no guid), canonicalize `feed_url` at every boundary, and rehash stored rows in migration 0020.
Depends on 01 and 02 being done. Do not touch `apps/mobile` (04 owns it).

## Hash contract

`packages/helpers/src/lib/addByRSSHash.ts`, `extractAddByRSSHashInput`:

1. `feed_url` present and non-empty after trim: the input starts with `feed_url`. Otherwise it
   starts with `channel_id_text` (legacy input, unchanged).
2. Then `guid`, unless missing or empty, or **device-local** in the `feed_url` form. Otherwise
   `enclosure_url`. The legacy form keeps its current guid handling byte for byte, so existing
   legacy ids do not change.
3. Key insertion order is exactly `feed_url` (or `channel_id_text`), then `guid` or
   `enclosure_url`. `getMd5Hash` hashes `JSON.stringify`, so order is part of the contract.

**Device-local guid.** For an item with no RSS guid, `toIndexItem` in
`packages/parser-mapping/src/addByRSS/itemIndex.ts` (and the web copy in
`apps/web/src/utils/addByRSS/itemIndex.ts`) sets `itemGuid = ${feed.idText}-${fallbackId}`, and
`feed.idText` is the device's random channel id. Add `isDeviceLocalAddByRSSGuid(guid,
channelIdText)` in helpers: true when `guid` is `${channelIdText}-` followed by digits only. A
device-local guid is treated as no guid, so the hash falls back to `enclosure_url`. Read mobile's
guid fallback in `apps/mobile/src/lib/addByRss/` and confirm it has the same form; if it differs,
cover that form too and list it in your final message for 04.

`feed_url` must already be canonical when it reaches the hash. `helpers` cannot import
`helpers-validation`, so canonicalization happens where resource data is built (below). State
that in the function's doc comment.

## Where `feed_url` is set and canonicalized

- **parser-mapping.** Add `feedUrl` to `AddByRSSItemIndexItem` and `AddByRSSLivestreamIndexItem`
  (`types.ts`), set from `feed.feedUrl` in `toIndexItem` and `toLiveIndexItem`.
  `buildAddByRSSResourceData` adds `feed_url: canonicalAddByRSSFeedUrl(item.feedUrl)`.
  `buildAddByRSSHashInput` follows the contract above. Add `getAddByRSSHashIds(item)`: the new
  hash first, then the legacy one, for matching rows written before this change.
- **Web IndexedDB.** Index items already stored lack `feedUrl`. Make the field optional in the
  type, and fill it from the owning feed record on read in `apps/web/src/utils/addByRSS/` (or
  rebuild the index on next load). Never compute the new hash without it; with no `feedUrl` the
  hash is the legacy one.
- **API.** Add `apps/api/src/lib/addByRSSResourceData.ts` with
  `normalizeAddByRSSResourceData(data)`: when `feed_url` is a string, replace it with
  `canonicalAddByRSSFeedUrl(feed_url)` (userinfo removed); drop it when that returns null. Call
  it in every controller that accepts `add_by_rss_resource_data`:
  - `apps/api/src/controllers/queue/queueResourceItemAddByRSS.ts`
  - `apps/api/src/controllers/playlist/playlistResourceItemAddByRSS.ts`
  - `apps/api/src/controllers/playlist/playlist.ts` (create with a first resource, around line 735)
  - the playback event route that uses `apps/api/src/lib/validation/querySchemas.ts` line 36
- **ORM recomputes.** In `packages/orm/src/services/queue/queueResource.ts`, the hash always
  comes from the resource data when data is present. Change the playback event path (around
  line 582) from `event.add_by_rss_hash_id ?? compute(data)` to `data ? compute(data) :
  event.add_by_rss_hash_id`. Lines 1492, 1591, and 1662 already compute from data; keep them.
  Check `packages/orm/src/services/playlist/playlistResource.ts` the same way.

## Same episode added from two devices

With one id, a second device's add hits UNIQUE `(queue_id, add_by_rss_hash_id)`. Read the comment
near `queueResource.ts` line 1612 and the add paths. Adding an existing row to now-playing,
next, or last moves that row and updates its resource data. It never inserts a duplicate and
never returns a 409 to the client. Same for playlists: adding an existing entry is a no-op that
returns success.

Removing by a hash the server does not have (an older client sends the legacy id after the
rehash) returns success, not 404, so a mobile outbox entry cannot retry forever. Check the queue
and playlist remove handlers.

## Migration 0020

`infra/k8s/base/ops/source/database/linear-migrations/app/0020_add_by_rss_feed_identity.sql`.
Greenfield-only (no `IF EXISTS` guards).

1. `CREATE FUNCTION public.add_by_rss_hash_id_from_feed(feed_url text, guid text, enclosure_url
   text) RETURNS text LANGUAGE sql IMMUTABLE` that reproduces `JSON.stringify` exactly:

```sql
SELECT md5(
  '{"feed_url":' || to_json(btrim(feed_url))::text ||
  CASE
    WHEN NULLIF(btrim(guid), '') IS NOT NULL
      THEN ',"guid":' || to_json(btrim(guid))::text
    WHEN NULLIF(btrim(enclosure_url), '') IS NOT NULL
      THEN ',"enclosure_url":' || to_json(btrim(enclosure_url))::text
    ELSE ''
  END || '}'
)
```

2. For `queue_resource` rows whose `add_by_rss_resource_data->>'feed_url'` is non-empty, compute
   the new hash. Pass NULL for `guid` when it is device-local (`guid ~ ('^' || channel_id_text ||
   '-[0-9]+$')`; nano ids contain no regex metacharacters).
3. Delete duplicates first: per `(queue_id, new hash)` keep the row closest to now-playing
   (`abs(list_position)` ascending), then the larger `playback_position`, then the larger `id`.
4. Update the remaining rows' `add_by_rss_hash_id`.
5. Same for `playlist_resource`, partitioned by `(playlist_id, new hash)`, keeping the smallest
   `list_position`.
6. Rows without `feed_url` are left alone.

Then, yourself, in this turn:

```bash
make db_regen_linear_baseline
make db_verify_linear_baseline
```

Set `API_EXPECTED_MIGRATION_FILENAME` in `infra/k8s/base/api/source/api.env` and
`MANAGEMENT_API_EXPECTED_MIGRATION_FILENAME` in
`infra/k8s/base/management-api/source/management-api.env` to the new filename
(**migration-readiness-marker-sync**).

## Web callers

Every web call of `getAddByRSSHashId(indexItem)` that matches server rows switches to
`getAddByRSSHashIds(indexItem)` and matches any of them: `usePlayAddByRSS.tsx`,
`AddByRSSEpisodeRow`, `AddByRSSEpisodeDetailHeader`, `AddByRSSEpisodeNodes`, `AddByRSSTrackRow`,
`AddByRSSTrackDetailHeader`. When a server row is in hand, use its own `add_by_rss_hash_id` for
remove and reorder calls instead of recomputing.

## Seeds and E2E

- `tools/web/seed-e2e.mjs`: seeded Add by RSS queue and playlist rows carry `feed_url` (the test
  feed URL on test-assets) and the new hash. Keep one row without `feed_url` so the legacy path
  stays covered. The mobile E2E seed reuses this file, and 04 and 05 do not edit it, so seed
  what they need now: an Add by RSS follow on the test-assets feed for the E2E user, with a real
  `title` and `image_url`, if none exists.
- `apps/web/e2e/helpers/seedConstants.ts` and
  `apps/web/e2e/add-by-rss-credentials-media-message.spec.ts`: update hashes.

## Tests

- `packages/helpers`: contract cases (new input, legacy input, device-local guid, enclosure
  fallback, key order).
- `packages/parser-mapping`: `buildAddByRSSResourceData` canonicalizes `feed_url` and strips
  userinfo; `getAddByRSSHashIds` order.
- `apps/api` integration (DB-backed):
  - SQL parity: `SELECT public.add_by_rss_hash_id_from_feed($1, $2, $3)` equals
    `getAddByRSSHashId` for: plain values, a `"` and `\` in the guid, non-ASCII, leading and
    trailing spaces, tabs, and newlines, no guid with an enclosure, neither.
  - Two payloads with different `channel_id_text` and the same `feed_url` + `guid` end as one
    queue row at now-playing.
  - `feed_url` with userinfo and an uppercase host is stored canonical.
  - Removing an unknown Add by RSS hash returns success.

## Docs

Update the hash description wherever docs state `channel_id_text + guid`
(`docs/proposals/mobile/app-development-process/DOCS-MOBILE-PROCESS-SHARED-VS-DIVERGENT.md`,
`tools/qa/docs/faker/07c-queues.md`, `07b-playlists.md`, and any Add by RSS doc under `docs/`).

## Scratchpad entry

```markdown
## Add by RSS episodes have the same id on every device

- Surfaces: api, web, packages (helpers, parser-mapping, orm), database migration
- Change: Queue and playlist entries for Add by RSS episodes are identified by feed URL plus
  episode guid (or enclosure URL), not by a per-device channel id. The API canonicalizes the feed
  URL and recomputes the id. Adding the same episode from a second device moves the existing
  entry instead of duplicating it.
- Who notices: anyone using Add by RSS on more than one device
- Operator steps: migration 0020 rehashes existing rows and removes duplicates it would create;
  readiness markers move to 0020
```

## Done when

- [ ] Helpers contract, parser-mapping, API normalization, and ORM recompute in place
- [ ] Duplicate adds move the existing row; unknown removes succeed
- [ ] Migration 0020, regenerated baselines, readiness markers
- [ ] Web callers match new and legacy ids
- [ ] Seeds, tests, docs, scratchpad entry

## Operator verification

**Root**

```bash
npm run build:packages
npm run test -w packages/helpers
npm run test -w packages/parser-mapping
npm run test -w apps/web
make test_deps
npm run test:e2e:api
kustomize build --load-restrictor LoadRestrictionsNone infra/k8s/base/api
kustomize build --load-restrictor LoadRestrictionsNone infra/k8s/base/management-api
make e2e_test_web_report_spec SPEC=e2e/media-player-addbyrss-resume.spec.ts,e2e/media-player-addbyrss-no-swap.spec.ts,e2e/add-by-rss-credentials-media-message.spec.ts
open .artifacts/e2e-reports/latest/index.html
```

Push `infra/k8s/` changes to the Argo CD tracked branch so the cluster syncs.
