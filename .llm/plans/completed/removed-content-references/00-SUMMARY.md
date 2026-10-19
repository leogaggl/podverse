# Removed content references — summary

Third of three plan sets. Order: `feed-description-tiers`, `archived-content-slimming`, then
this set.

## Problem

1. **Takedown silently deletes users' clips.** `removeAllItemsForTakedownFeeds` hard-deletes
   every episode. `clip.item_id`, `playlist_resource.item_id`, and
   `playlist_resource.item_soundbite_id` are `ON DELETE CASCADE`, so the clips and playlist
   entries go with them, with no trace.
2. **Followers lose an archived show silently.** Followed-show lists filter on public
   visibility, which an archived feed loses. The episode list returns only Active episodes, with
   a 200. The `account_following_channel` row stays forever, and mobile keeps a subscription
   with an empty list. Mobile only drops a follow on a 404.
3. **Empty shows are never deleted.** No code path deletes a `channel` row. An archived or
   taken-down show with no episodes left keeps its row and its follow, notification, and stats
   rows forever.

## Goal

Content can be removed. What a user made stays as a small reference. Data nobody can use is
deleted.

## Locked decisions

1. **Snapshots, filled only at removal.** `clip` and `playlist_resource` each gain
   `removed_source jsonb NULL` and `source_removed_at timestamp NULL`. Rows that never lose
   their source pay only the null bitmap.

   ```ts
   type DTORemovedSource = {
     kind: 'item' | 'soundbite';
     item_title: string | null;
     channel_title: string | null;
     pub_date: string | null;
     soundbite_title: string | null;
   };
   ```

   Titles and a date only: no URLs, images, notes, or media. A clip keeps what the user wrote
   (title, description, start and end). It shows as **Content Removed** and cannot play.
2. **Foreign keys become `ON DELETE SET NULL`.** For `clip.item_id` (now nullable),
   `playlist_resource.item_id`, and `playlist_resource.item_soundbite_id`.
   `playlist_resource`'s exactly-one-reference CHECK becomes: exactly one reference, or no
   reference and `source_removed_at IS NOT NULL`.
3. **One capture helper runs before every episode hard delete.**
   `captureRemovedReferences(itemIds, manager)` writes the snapshots inside the same
   transaction. For clips, `SET NULL` is the backstop: a future delete path that forgets the
   helper still leaves the clip, with the user's own title. For playlist entries, the CHECK
   makes a forgotten helper fail the delete loudly, never lose rows quietly.
4. **Only owners see snapshots.** The clip owner gets the clip with `removed_source`. Anyone
   else gets 410 with no snapshot, and public clip lists exclude removed clips. Playlist
   entries show **Content Removed** to everyone; titles only to the playlist owner. Owners can
   delete removed clips and entries. Time edits on a removed clip are rejected.
5. **Queue rows for removed sources are pruned.** `pruneNonActiveItemBackedQueueResourceRows`
   also removes clip-backed rows whose clip has no episode.
6. **Follows of an archived show convert to Add-by-RSS, for members, when the feed still
   works.** This runs on the server, once per archived show, in `archiveAll`:
   - Never for takedown, spam, or a show that is the source of a `channel_merge`.
   - The probe is one GET with a 10-second timeout, reading at most 64 KB. It succeeds on a 2xx
     whose body contains `<rss` or `<feed`.
   - Followers whose membership allows `add_by_rss_add` (`evaluateFeatureAccess`,
     `deriveMembershipState`) get an `account_following_add_by_rss_channel` row (feed URL,
     title, image) and lose the directory follow. Every device then picks the show up through
     the existing Add-by-RSS refresh.
   - Followers without that access keep the directory follow until the show is deleted, which
     matches today's result.
   - An unreachable feed is retried on later runs, up to 3 attempts at least 24 hours apart,
     then marked `unreachable`.
7. **The episode list says the show is archived.** The channel episode list endpoint returns
   410 `{ gone: { reason: 'archived', add_by_rss_feed_url } }` for an archived feed, and 404 for
   takedown. `add_by_rss_feed_url` is set only when the signed-in requester already has an
   Add-by-RSS follow for that feed, so it never exposes a URL to anyone else. A merge 410
   (`merged_into`) wins over both. Channel detail and item detail are unchanged, so clip and
   episode pages keep working.
8. **Empty shows are deleted; the feed row stays.** A channel with no `item` rows whose feed is
   `takedown`, or `archived` with conversion finished, is deleted. Its follows, notification
   settings, auto-download rows, and stats cascade. Skip any channel a `channel_merge` row
   references. The small `feed` row stays: it records the lifecycle and keeps Podcast Index
   sync from re-adding the feed as new. A management restore makes the parser create a fresh
   channel (`getOrCreateByFeed`). Up to 200 per run.
9. **Takedown runs in one transaction per feed.** Capture snapshots, delete `item_merge_map`
   rows that point at those episodes (their foreign keys have no `ON DELETE`), delete the
   episodes, then strip the channel rows.

## Storage

- A snapshot is a few hundred bytes on a row that already exists. Nothing is copied for rows
  whose source stays.
- Deleted empty shows free their channel row and every cascade row.
- Conversion bookkeeping: three nullable columns on `channel`, set only for archived shows.

## What users see

- **My clips:** a removed clip stays in the owner's list as **Content Removed**, with their
  title and the episode and show titles. Delete works. Play does not.
- **Playlists:** a removed entry stays in place as **Content Removed**, removable.
- **Members following an archived show** whose feed still works: it appears under Add by RSS.
  Mobile logs the move in the sync log. No push or email.
- **Everyone else following it:** the same as today. It drops from the list, with the
  existing sync log line.
- **Web channel page of an archived show:** a sentence that it is no longer in the directory.

## Out of scope

- Remapping downloads of converted shows to their Add-by-RSS episodes. Downloads stay in
  Downloads and keep playing.
- Expiring snapshots. They are tiny; the owner deletes them.
- Server history rows. They follow the existing queue pruning.
