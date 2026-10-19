# 02 — Slimming pass, parser reversal, report

**Cursor model:** Opus 5.5 · **Reasoning:** high

## Summary

A new archiver step deletes the related rows that clips and playlists never read, from archived
episodes and archived shows, and reduces their descriptions to the preview. The parser clears
the marker when an episode or show comes back. A read-only command reports what is left to
slim and how many bytes it holds.

Depends on 01 and on `feed-description-tiers` 01 and 03. Decisions: 00-SUMMARY 2 through 9.

## Helper

`packages/helpers/src/lib/descriptionPreview.ts`: add

```ts
export const buildArchivedDescriptionValue = (preview: string): string;
```

It returns `<p>` + the HTML-escaped preview + `</p>`, or `''` for an empty preview. Use the
existing escape helper in `packages/helpers/src/lib/html.ts` if there is one; otherwise add
one there. The result must pass `readDescriptionDocument` in strict mode. Unit test it,
including `<`, `&`, and quotes in the preview.

## Slimming service — `packages/orm/src/services/archivedSlimming.ts`

```ts
export const ARCHIVED_SLIM_ITEM_BATCH_SIZE = 500;
export const ARCHIVED_SLIM_MAX_ITEMS_PER_RUN = 20_000;
export const ARCHIVED_SLIM_MAX_CHANNELS_PER_RUN = 200;

export async function slimArchivedItems(): Promise<{ slimmed: number }>;
export async function slimArchivedChannels(): Promise<{ slimmed: number }>;
```

Write with `AppDataSourceReadWrite`. Read the batch inside the write transaction, not from the
replica.

### Episodes

Loop until a batch comes back short or the run cap is reached. One transaction per batch:

1. Select up to 500 ids:
   `WHERE item_flag_status_id = <Archived> AND archived_slimmed_at IS NULL ORDER BY id
   FOR UPDATE SKIP LOCKED`. The partial index from 01 serves this.
2. Delete from each table below `WHERE item_id = ANY($1)`. Rows that reference `item_value` cascade.

   `item_chapters_feed`, `item_chat`, `item_content_link`, `item_funding`, `item_license`,
   `item_location`, `item_person`, `item_season_episode`, `item_season`,
   `item_social_interact`, `item_transcript`, `item_txt`, `item_value`

3. Delete `item_soundbite` rows for those items that no `playlist_resource.item_soundbite_id`
   references. `queue_resource` rows for archived items are already pruned by
   `pruneNonActiveItemBackedQueueResourceRows`, so they do not keep a soundbite.
4. Load `item_description` for the batch (`id`, `value`, `preview`, `source_length`). For each
   row, preview = `preview ?? getDescriptionPreviewText({ value })`. Update `value` to
   `buildArchivedDescriptionValue(preview)`, `preview` to that preview, `is_truncated` to true,
   and `source_length` to `COALESCE(source_length, char_length(old value))`. Skip the update
   when `value` already equals the reduced form.
5. `UPDATE item SET archived_slimmed_at = now() WHERE id = ANY($1)`.

Keep the table list in one exported constant so tests and the report command use the same
list.

### Shows

Select up to 200 channels whose feed lifecycle state is `archived` and whose
`archived_slimmed_at` is null. One transaction per channel:

1. Run the shared channel detail cleanup (below).
2. Reduce `channel_description` the same way as an episode description.
3. `UPDATE channel SET archived_slimmed_at = now()`.

Shows whose feed is `takedown` or still `active` are not touched here.

## Shared channel cleanup — `archiver.ts`

Split `optionalChannelDeleteQueries` into two exported lists:

- `CHANNEL_DETAIL_DELETE_QUERIES`: everything except `channel_about`, `channel_description`,
  and `channel_image`. Order: value recipients, podroll remote items, and publisher remote items
  first (as now), then `channel_trailer` before `channel_season`, then the rest.
  `channel_trailer.channel_season_id` has no `ON DELETE`. Deleting `channel_season` cascades to
  `item_season`, which is intended.
- `CHANNEL_IDENTITY_DELETE_QUERIES`: `channel_about`, `channel_description`, `channel_image`.

`removeOptionalChannelRows` (takedown) runs both lists, in that order. Slimming runs only the
detail list. Add a test asserting `channel_trailer` comes before `channel_season`.

## `archiveAll` order

```ts
await this.processPendingArchiveFeeds();
await this.processSpamFeeds();
await this.processPendingArchiveItems();
await this.deleteArchivedItemsWithoutClipOrPlaylist();
await slimArchivedItems();
await slimArchivedChannels();
await this.removeAllItemsForTakedownFeeds();
await pruneNonActiveItemBackedQueueResourceRows();
```

Log the two counts at info level with the existing logger.

## Parser reversal

- `ItemService.update` (`packages/orm/src/services/item/item.ts`, the method that sets
  `item_flag_status`): when the new status is Active and `archived_slimmed_at` is not null, set
  it to null in the same save.
- The parser's channel handler (`packages/parser/src/lib/rss/channel/channel.ts`, where the
  channel row is saved): set `archived_slimmed_at` to null when it is not null.
- Nothing else is needed. The related-table handlers recreate missing rows, and the description handler
  writes the full notes from the feed again.

## Report — workers command `ormArchivedSlimReport`

Read only, `AppDataSourceRead`. Prints, as one info log line each:

- Archived episodes: total, slimmed, unslimmed.
- Archived shows: total, slimmed, unslimmed.
- For unslimmed archived episodes: `sum(pg_column_size(t.*))` per table in the episode delete
  list, plus `item_description`. Same for unslimmed archived shows and the channel detail
  tables.
- A grand total in MB.

Register it the way the existing ORM commands are registered: `apps/workers/src/commands/index.ts`,
`packages/worker-commands/src/registry.ts`, and `apps/workers/src/lib/startup/categoriesForCommand.ts`
(database only). No CronJob; the operator runs it.

## Tests

- `archivedSlimming.test.ts` (mocked, in the style of `archiver.test.ts`): the batch loop stops
  on a short batch and at the run cap; referenced soundbites are kept; the description update is
  skipped when already reduced.
- `archiver.test.ts`: the new `archiveAll` order; takedown still runs both cleanup lists.
- `apps/api/src/test/archived-slimming.integration.test.ts` (database, like
  `channel-merge.integration.test.ts`): seed an archived episode with a clip, a transcript, a
  person, a value split, a chapters row, and long notes. Run `slimArchivedItems`. The clip, the
  enclosure, and the image remain. The other related rows are gone. The notes are the reduced form
  and pass strict `readDescriptionDocument`. The marker is set. Then call `ItemService.update`
  with Active and assert the marker is null.
- A second case: an archived show with seasons and a season-linked trailer slims without a
  foreign-key error.

## Scratchpad

```markdown
## Archived episodes and shows keep only what clips and playlists need

- Surfaces: workers (archiveAll), orm, parser
- Change: archiveAll now deletes transcripts, chapters, people, value, funding, soundbites not
  in a playlist, and the other detail rows from archived episodes, and reduces their notes to
  the 400-character preview. Archived shows keep only title, image, About, and a preview. The
  data returns on the next parse if the episode or feed comes back. Fixes a takedown cleanup
  failure for shows whose trailers belong to a season. New ormArchivedSlimReport command.
- Who notices: operators (database size); users see shorter notes on archived episodes, with a
  link to the full notes
- Operator steps: run ormArchivedSlimReport before and after the next archiveAll runs
```

## Done when

- No `item`, `channel`, or `feed` row is deleted by this code.
- A slimmed episode with a clip still plays its clip.
- Comments must not cite this plan or any plan number.

## Operator verification

**Root** — the integration test needs `make test_deps`.

```bash
npm run build:packages
npm run test -w packages/helpers
npm run test -w packages/orm
npm run test -w apps/api
npm run build -w apps/workers
npm run test -w apps/workers
node apps/workers/dist/index.js ormArchivedSlimReport
```

The last line reads the local dev database. **Dev** must be up.
