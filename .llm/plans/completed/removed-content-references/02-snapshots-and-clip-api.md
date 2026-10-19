# 02 — Snapshot capture, takedown, clip and playlist API, copy

**Cursor model:** Opus 5.5 · **Reasoning:** high

## Summary

Before any episode is hard-deleted, its clips and playlist entries get a snapshot. Takedown
runs as one transaction per feed. The API shows snapshots to owners only and returns 410 to
everyone else. This prompt also writes all of the set's user-facing copy, so 04 and 05 can run
in parallel.

Depends on 01. Decisions: 00-SUMMARY 1 through 5, and 9.

## Capture helper — `packages/orm/src/services/removedReferences.ts`

```ts
export async function captureRemovedReferences(
  itemIds: number[],
  manager: EntityManager
): Promise<{ clips: number; playlistEntries: number }>;
```

Three set-based `UPDATE`s, each skipping rows where `source_removed_at` is already set:

1. `clip` rows with `item_id = ANY($1)`: `removed_source` = `jsonb_build_object('kind',
   'item', 'item_title', i.title, 'channel_title', ch.title, 'pub_date', i.pub_date,
   'soundbite_title', null)`, and `source_removed_at = now()`. Join `item` and `channel`.
2. `playlist_resource` rows with `item_id = ANY($1)`: the same shape.
3. `playlist_resource` rows whose `item_soundbite_id` belongs to those items: `kind`
   `'soundbite'`, with `soundbite_title`.

`pub_date` is ISO 8601 text. Return the row counts. Unit test the SQL shape with mocks, in the
style of `archiver.test.ts`.

## Shared check — `packages/helpers/src/lib/removedSource.ts`

```ts
export const isRemovedSource = (resource: { source_removed_at?: string | null }): boolean;
```

True when `source_removed_at` is a non-empty string. Export it from the helpers index and unit
test it. Web (04) and mobile (05) both import it.

## Who calls it

- **Takedown** (`removeAllItemsForTakedownFeeds` in `archiver.ts`): one
  `AppDataSourceReadWrite.transaction` per feed, in this order:
  1. collect the item ids;
  2. `captureRemovedReferences`;
  3. `DELETE FROM item_merge_map WHERE from_item_id = ANY($1) OR to_item_id = ANY($1)`;
  4. delete the items;
  5. run both channel cleanup lists.

  Log the counts.
- **`ItemService.delete` and `deleteMany`**: call it first, in a transaction. They have no
  production callers today. This keeps a future caller safe.
- **The archive branches** (`processItems`, `deleteArchivedItemsWithoutClipOrPlaylist`) only
  delete episodes with no clip or playlist rows, so they do not call it. If a clip is created
  between their check and the delete, `SET NULL` keeps it. A playlist entry created in that
  window makes the delete fail on the CHECK, and the next run retries.

## Queue pruning — `queueResourceActiveItemFilter.ts`

Change the clip-backed query to a `LEFT JOIN item` with
`WHERE qr.clip_id IS NOT NULL AND (c.item_id IS NULL OR i.item_flag_status_id <> $1)`. Update
the read-side filter in the same file the same way, so a removed clip never lists in a queue or
history response.

## Clip API

Find the clip routes and controller in `apps/api/src` and the service in
`packages/orm/src/services/clip*.ts`.

- **Detail by id:** when `source_removed_at` is set:
  - The owner (the signed-in account is the clip's account) gets 200 with `item: null`,
    `removed_source`, and `source_removed_at`.
  - Anyone else gets 410 `{ message: 'Clip source was removed', removed: true }`, with no
    snapshot.
- **Public and channel or item lists:** exclude removed clips. They already inner-join `item`
  for visibility; confirm it, and add `clip.item_id IS NOT NULL` where a list does not.
- **The owner's own clip list:** include removed clips, in their usual sort position.
- **Update:** on a removed clip, reject changes to `start_time`, `end_time`, and sharable status
  with 400. Title and description edits are allowed. Delete is unchanged.
- **Playback stats and track events** for a removed clip: 410.

## Playlist API

- **Playlist detail:** removed entries keep their `list_position`. `removed_source` is returned
  only when the requester owns the playlist; otherwise it is null and `source_removed_at` is
  still set.
- **Removing an entry:** unchanged, and it works for removed entries.
- **Adding an entry:** unchanged. Joi already requires one reference.

## OpenAPI — `apps/api/openapi.yml`

Add `RemovedSource`. On the clip and playlist resource schemas: `item` nullable,
`removed_source`, and `source_removed_at`. Document the 410 for clip detail and the 400 for time
edits.

## Copy

Consumer catalog `packages/i18n-catalog/consumer/originals/{en-US,es,fr,el-GR}.json`. English
chrome is title case; sentences stay sentence case (**ui-copy-casing**):

| Key | en-US |
| --- | --- |
| `info.removed.content_removed` | Content Removed |
| `info.removed.clip_source_removed` | The episode for this clip was removed from Podverse. |
| `info.removed.playlist_entry_removed` | This item was removed from Podverse. |
| `info.removed.show_not_in_directory` | This show is no longer in the Podverse directory. |

Mobile catalog `packages/i18n-catalog/mobile/originals/{en-US,es,fr,el-GR}.json`, beside
`error_log.directory_channel_gone`:

| Key | en-US |
| --- | --- |
| `error_log.directory_channel_converted` | Moved {channel} to Add by RSS. It is no longer in the directory. |

Write each language in its own capitalization. Do not edit `overrides/`.

## Tests — `apps/api/src/test/removed-content.integration.test.ts`

Seed a feed with an episode, a soundbite, a clip owned by account A, and a playlist owned by A
with three entries: that episode, that soundbite, and the clip. Add an `item_merge_map` row
pointing at the episode and a queue row for the clip. Move the feed to `takedown` and run
`removeAllItemsForTakedownFeeds`. Then:

- The clip remains with `item_id` null and a `removed_source` naming the episode and show.
- All three playlist entries remain. Two have snapshots. The clip entry still references the
  clip.
- The queue row is gone after `pruneNonActiveItemBackedQueueResourceRows`.
- A's GET clip is 200 with `removed_source`. Account B and anonymous get 410 with no snapshot.
- B's GET of A's playlist shows the removed entries with `removed_source` null.
- A PATCH with a new `start_time` is 400. A title change is 200.
- The public clip list does not include the clip; A's own list does.
- A direct insert of a playlist row with no reference and no `source_removed_at` fails.

## Scratchpad

```markdown
## Clips and playlist entries survive takedowns

- Surfaces: api, workers (archiveAll), orm
- Change: When a feed is taken down, each clip and playlist entry pointing at its episodes is
  kept with a small snapshot (episode title, show title, date) instead of being deleted. Owners
  see it as Content Removed and can delete it; others get 410. Removed clips leave queues.
  Takedown now runs in one transaction per feed.
- Who notices: users with clips or playlists of taken-down shows; API clients (clip item can be
  null, new 410)
```

## Done when

- No episode hard-delete path can drop a clip without either a snapshot or the `SET NULL`
  backstop.
- Comments must not cite this plan or any plan number.

## Operator verification

**Root** — needs `make test_deps`.

```bash
npm run build:packages
npm run test -w packages/helpers
npm run test -w packages/orm
npm run test -w apps/api
```
