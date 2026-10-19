# 03 — Batched pending archive

**Cursor model:** Codex 5.3 · **Reasoning:** high

## Summary

`processPendingArchiveFeeds` loads every pending feed with `channel.items`. A retire backlog
would make one `archiveAll` unbounded. Select feed ids in a cap and update items with
set-based SQL. Decisions: 00-SUMMARY 5. `archiveAll` already calls this method; do not
change that call or its place in the order.

Can run beside 02. Do not edit `flagAndMerge.ts`.

## Cap

In `packages/orm/src/services/archiver.ts`:

```ts
const PENDING_ARCHIVE_MAX_FEEDS_PER_RUN = 1000;
const PENDING_ARCHIVE_ITEM_CHUNK = 1000;
```

`PENDING_ARCHIVE_ITEM_CHUNK` matches `ARCHIVED_ITEM_ORPHAN_DELETE_BATCH_SIZE`.

## Selection

Replace the body of `processPendingArchiveFeeds`. Do not use `getFeedsPendingArchive` on
this path. Leave that method in place if tests or other callers still use it; if nothing
calls it after this change, delete it and its relation constant only when no caller remains.

One query, at most `PENDING_ARCHIVE_MAX_FEEDS_PER_RUN` rows:

- `feed_lifecycle_state_type.state_key` is `pending_archive`
- the feed has a channel
- order by `feed.id` ascending

Columns needed: `feed.id`, `channel.id`. No item relation.

## Items

For those channel ids, in chunks of `PENDING_ARCHIVE_ITEM_CHUNK`:

1. `UPDATE item SET item_flag_status_id = $archived WHERE channel_id = ANY($channels) AND item_flag_status_id IN ($active, $pending) AND (EXISTS clip OR EXISTS playlist_resource on that item)`.
2. Delete the other active or pending items for those channels, by id list, in the same
   chunk size: `NOT EXISTS` clip and `NOT EXISTS` playlist_resource.

Archived items stay archived. The clip and playlist checks are the same predicates
`processItems` uses today (`clip.item_id`, `playlist_resource.item_id`). Do not call
`processItems` from this path. Do not snapshot: this delete only removes items that have no
clip or playlist row. `captureRemovedReferences` stays on the takedown path.

Then, for each feed id, `FeedService.setFeedLifecycleState` to `archived` with `source`
`FeedLifecycleUpdateSourceEnum.Archiver`, and clear `last_parsed_file_hash`, as the method
does today. A feed with no items still moves to `archived`.

Log the feed count and the item update and delete counts at info level.

## Tests

Extend `packages/orm/src/services/archiver.test.ts`. Mock the query runner the way the
orphan-delete tests do.

- A run selects at most 1000 feed ids.
- An item with a clip is updated to Archived and is not deleted.
- An item with neither a clip nor a playlist row is deleted.
- The feed lifecycle write is `archived` / archiver, and it still happens when the channel
  has no matching items.

Do not assert SQL text that names this plan.

## Scratchpad

```markdown
## Pending archive runs in capped batches

- Surfaces: orm archiver
- Change: one archiveAll run archives at most 1000 pending feeds. Items with a clip or
  playlist entry become Archived. Other active or pending items are deleted in chunks.
- Who notices: operators, on the worker log counts. Listeners lose directory episodes for
  those shows; clips and playlist entries stay.
- Operator steps: none. The next archiveAll uses the new path.
```

## Done when

- `archiveAll` still calls `processPendingArchiveFeeds` once, in its current position.
- No path on this method loads `channel.items`.
- Comments do not cite a plan or a step number.

## Operator verification

**Root**

```bash
npm run build:packages
npm run test -w packages/orm
```
