# Archived content slimming — summary

Second of three plan sets. Order: `feed-description-tiers`, then this set, then
`removed-content-references`.

## Problem

The archiver keeps an episode only when a clip or a playlist entry points at it. That rule is
right. What it keeps is not:

- A kept episode keeps every related row: full show notes (up to 30,000 stored characters after
  `feed-description-tiers`), transcripts, chapters, people, value splits, funding, soundbites,
  social interact, txt, license, location, chat, content links, and season.
- An archived show keeps its channel row and every related channel row forever. Only takedown
  removes related channel rows (`packages/orm/src/services/archiver.ts`).

Nothing reads most of that. A clip or playlist row shows the episode title, date, image, and
show title, and plays the enclosure. The clip page adds the episode Summary.

## Goal

Archived episodes and archived shows keep only what clips, playlists, and their pages show. The
rest is deleted. All of it comes from RSS. If an episode returns to its feed, or management
restores the feed, the next parse rebuilds it.

## Locked decisions

1. **Slim, never delete.** This set deletes no `item`, `channel`, or `feed` rows. Removal is the
   third set.
2. **An archived episode keeps:**

   | Kept | Why |
   | --- | --- |
   | `item` row | Identity, title, dates, links |
   | `item_about` | Duration, episode link |
   | `item_enclosure`, its sources and integrity rows | Clips and playlist entries play |
   | `item_image` | Row artwork |
   | `live_item` | Livestream DTOs require `live_item_status` |
   | `item_description`, reduced | Summary shows the preview and the shortened-notes notice |
   | `item_soundbite` rows that a `playlist_resource` references | Playlist entries |

   Deleted: `item_chapters_feed`, `item_chat`, `item_content_link`, `item_funding`,
   `item_license`, `item_location`, `item_person`, `item_season`, `item_season_episode`,
   `item_social_interact`, unreferenced `item_soundbite`, `item_transcript`, `item_txt`,
   `item_value` (its recipients, time splits, and remote items cascade).
3. **The reduced description** is `<p>` + the escaped preview + `</p>`, with `is_truncated` true.
   `source_length` keeps its value, or takes the old value's length when null. The notice from
   the first set then links to the episode page: **Read Full Show Notes**.
4. **An archived show** (feed lifecycle `archived`) keeps the `channel` row, the `feed` row,
   `channel_about`, `channel_image`, and a reduced `channel_description` in the same form. Every
   other related channel table is emptied. Spam feeds (lifecycle still `active`) are not slimmed
   at the show level. Takedown feeds are already stripped.
5. **One marker per row.** `item.archived_slimmed_at` and `channel.archived_slimmed_at`
   (nullable timestamps). A partial index finds unslimmed archived episodes. A pass never
   rescans a slimmed row.
6. **Reversal is automatic.** The parser sets an episode back to Active on reparse
   (`ItemService.update`). That same write clears `archived_slimmed_at`. The related-table handlers
   recreate missing rows because `_updateMany` adds rows that are not stored. When the parser
   handles a show, it clears `channel.archived_slimmed_at`. A parse of an archived feed only
   happens after management restores it, and the archiver already clears
   `last_parsed_file_hash`, so the first parse after a restore is never skipped by hash.
7. **Batched and idempotent.** The pass runs inside `archiveAll` (06:00 and 18:00) after
   `deleteArchivedItemsWithoutClipOrPlaylist`, so rows about to be deleted are not slimmed
   first. 500 episodes per transaction, at most 20,000 episodes and 200 shows per run. A
   backlog drains over a few runs.
8. **Measured, not guessed.** A read-only report command prints counts and the bytes held by
   removable rows, before and after.
9. **The channel cleanup order is fixed.** `channel_trailer.channel_season_id` has no
   `ON DELETE`. The existing takedown list deletes seasons before trailers, so takedown fails
   for any show whose trailers are tied to a season. One shared list now runs trailers first.

## Storage

- The large items are show notes, transcripts metadata, chapters metadata, people, and value
  splits. One kept episode drops from up to about 30 KB of notes to at most about 400
  characters.
- Postgres reuses freed space after autovacuum. Files do not shrink without `VACUUM FULL` or
  `pg_repack`. That is an operator choice, not part of this set.
- New cost: one 8-byte timestamp per archived row.

## What users see

- Clip and playlist rows: unchanged.
- An archived episode's page or clip page: Summary shows the preview and **Read Full Show
  Notes** to the episode's own page. Chapters, transcripts, people, and funding chips hide
  because they are empty. 03 confirms each surface hides empty chips and fixes any that do not.
- An episode that returns to its feed: full data again after the next parse.

## Out of scope

- Deleting episodes, shows, or feeds. Snapshots for clips when content is removed. Follow
  conversion. All in `removed-content-references`.
- Transcript and chapter files themselves. They live at the publisher's URLs; only the
  metadata rows are stored.
- Shrinking database files.
