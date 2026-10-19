# 06 — API 410 and web redirects

**Cursor model:** Cursor Grok 4.7 · **Reasoning:** high

## Summary

After an absorb merge, old channel and episode URLs still open the show. Web answers with a
permanent redirect. The API answers `410` plus the id to use instead, and a batch endpoint so a
phone can remap many ids in one call. A re-point merge changes no ids, so these paths do nothing
for it.

Depends on applied rows from [04-apply-merge-server.md](./04-apply-merge-server.md). Do not edit
mobile or the merge transaction.

## API

### `410` on a merged id

When a channel's feed lifecycle is `merged` and `channel_merge.status` is `applied` with a
`to_channel_id`:

- `GET` channel by numeric id or `id_text` returns `410`:

```json
{ "merged_into": { "kind": "channel", "id_text": "<survivor id_text>" } }
```

- The same for album and artist channel payloads if they share that controller.

When an item has an `item_merge_map` row with a non-null `to_item_id` for an `applied` merge:

- `GET` item returns `410` with `kind: "item"` and the survivor item `id_text`.

Unmatched items (no map row, or `to_item_id` null) stay `200`. They are the episodes that only
exist on the old feed; playback must keep working.

List endpoints already hide non-public channels and non-active items. Do not add a second filter.
Do not `410` a channel that was only re-pointed (`to_channel_id` is null).

### `POST /identity/resolve`

Public (`security: []`). No account data in or out. Body:

```json
{
  "channel_id_texts": ["..."],
  "item_id_texts": ["..."],
  "podcast_index_ids": [1]
}
```

Each array optional. At least one required. Cap each array at 500; `400` above that.

Response, only for ids that actually moved:

```json
{
  "channels": [{ "from_id_text": "...", "to_id_text": "..." }],
  "items": [{ "from_id_text": "...", "to_id_text": "..." }],
  "podcast_index_ids": [{ "from": 1, "to_channel_id_text": "..." }]
}
```

`podcast_index_ids` resolves `channel_merge.from_podcast_index_id` on an `applied` absorb to the
survivor channel. Re-point rows are omitted (the feed id already changed; the client should
subscribe by the channel it has).

Rate-limit like other public read routes. Add the path and the `410` body to
`apps/api/openapi.yml` (`operationId`, example). Add a method on the API client in
`@podverse/helpers-requests`. Follow **openapi-sync** and **app-routes-shared-constants** (this
path is an API route, not an `APP_ROUTES` web path).

### Subscribe by an old Podcast Index id

Any follow or preview that looks up a feed by `podcast_index_id` and misses must check
`channel_merge` for an `applied` absorb and use the survivor channel instead of 404. Pending
follows (`account_pending_following_channel`) for that id resolve to the survivor on the next
parse, which plan 04 already rewrites; this lookup is the extra case where the client sends the
old id after the merge.

## Web

Use `permanentRedirect` from `next/navigation` (308), not a temporary `redirect`.

Shared helper, one place, called from the server page before rendering:

- `apps/web/src/app/podcast/[channel_id]/page.tsx`
- `apps/web/src/app/album/[channel_id]/page.tsx`
- `apps/web/src/app/artist/[channel_id]/page.tsx`
- `apps/web/src/app/episode/[item_id]/page.tsx`
- `apps/web/src/app/track/[item_id]/page.tsx`
- `apps/web/src/app/podcast-index/feed/[podcast_index_id]/page.tsx` when the Podcast Index id is
  `from_podcast_index_id` on an applied absorb

Build the destination with the existing `APP_ROUTES` helpers (`buildPodcastPath`,
`buildEpisodePath`, and the album, artist, and track builders). Do not hardcode `` `/episode/${id}` ``.
Keep the query string the user arrived with (sort, clip time) when the destination is the same
resource kind.

### Sort cookie

Per-instance sort lives in the `local-settings` cookie (`sp`), keyed by the shared scope builder.
On redirect, copy a scope entry that contains the old `id_text` onto the survivor `id_text`, then
drop the old entry. Use the existing cookie reader/writer in
`apps/web/src/utils/localSettings/`. If `cookies().set` is not allowed in the server page, do the
rewrite in `middleware.ts` for these path prefixes instead of a client fix-up. No flash of the
old page.

### Sitemap

`apps/web/src/app/sitemap.ts` does not list channel or episode URLs yet. Do not add them here.
Merged feeds already have `public_visible` false, so any later sitemap that lists public channels
excludes them. Do not add a second exclusion list.

## Tests

- API integration: applied absorb, GET old channel and matched item return `410` and the survivor
  `id_text`. Unmatched item returns `200`. `POST /identity/resolve` returns only the moved ids
  and ignores unknown ids.
- Web E2E spec `apps/web/e2e/channel-merge-redirect.spec.ts`. Seed one merged channel and one
  survivor through the same seed path other specs use. Assert the old podcast URL ends on the
  survivor URL (308). Follow **e2e-page-tests**.

## Scratchpad

Append to `release-notes/scratchpad.md`:

```markdown
## Old links follow a merged show

- Surfaces: api, web
- Change: Opening a show or episode that Podcast Index merged into another show lands on the
  surviving show. Episode links that have no match on the survivor still play.
- Who notices: anyone with a bookmark or shared link to a duplicate feed
```

## Done when

- A merged channel URL on web ends on the survivor, with the sort preference carried over.
- The API `410` body is in OpenAPI and the request client.
- Unmatched episodes are not redirected.

## Operator verification

**Root** — API tests need `make test_deps`. Web report needs the usual E2E stack. Do not set
`E2E_API_GATE_MODE`.

```bash
npm run test -w apps/api
make e2e_test_web_report_spec SPEC=e2e/channel-merge-redirect.spec.ts
open .artifacts/e2e-reports/latest/index.html
```
