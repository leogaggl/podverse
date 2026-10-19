# Podcast Index retired feeds and the Removed Content log

Runs after `removed-content-references` is finished and committed. That set provides
`captureRemovedReferences`, `convertArchivedShowFollows`, `deleteEmptyRemovedShows`, and
migration 0018. This set's migration is the next unused app file after that
(`0019_account_content_log.sql` unless 0018 was not used).

## Problem

1. A row on the Podcast Index dead list with an empty `duplicateOf` is ignored. The feed stays
   `active`, keeps every episode, and can be parsed again by on-demand refresh, trending, or
   OPML. The recent-feeds cron skips only `merged`.
2. `processPendingArchiveFeeds` loads every pending feed and its items. A large retire backlog
   would make one `archiveAll` run unbounded.
3. When a followed show disappears, a signed-in user has nowhere durable to see why. Mobile's
   Error Log is a local sync log, and web has no equivalent.

## Goal

Podcast Index is the authority for which directory feeds are no longer valid. Retire those
feeds, keep what a user made, and leave a short explanation a signed-in user can find if they
go looking. Do not notify them.

## Locked decisions

1. **Signal.** Retire a feed we hold when its Podcast Index id is on the dead list and any of
   these is true:
   - `duplicateOf` is empty, or the chain cannot be resolved (a cycle, or a survivor that is
     itself on the list). `resolveDeadFeedDuplicateChains` already omits those ids.
   - A resolved pair whose `channel_merge.status` is `rejected` or `reverted`.

   Wait while status is `detected`, `verified`, `needs_review`, or `applied`. Record pairs
   before the retire pass, so a pair first seen on this run is `detected` and waits. Skip a
   feed whose lifecycle already blocks parsing (`lifecycleStateBlocksParseAndVisibility`).
2. **No grace period.** The first run that lists the feed retires it.
3. **Mode.** `PODCAST_INDEX_DEAD_FEED_RETIRE_MODE` is `off`, `dry_run`, or `apply`, separate
   from `PODCAST_INDEX_DUPLICATE_MERGE_MODE`. Base stays `off`. Download the CSV when either
   mode is not `off`. When retire mode is `dry_run` or `apply`, download the full CSV every
   run and do not send the conditional validators. The per-run cap has to walk the same list
   on later hours, and a conditional miss would skip the drain. `dry_run` writes no lifecycle
   change.
4. **Brake.** Store `last_retire_eligible_count` on `podcast_index_dead_feed_sync`. Eligible
   means held feeds matching decision 1, including ones already retired. Growth is this run's
   eligible count minus the stored count.
   - Stored count is null: retire nothing. Only `dry_run` stores the count.
   - Growth is above `max(2000, 1% of held feeds)`: retire nothing, log a warning, and do not
     move the stored count. The warning tells the operator to run one `dry_run` to accept the
     new count, then return to `apply`.
   - Otherwise `apply` retires at most 200 feeds (`RETIRE_MAX_PER_RUN`), oldest Podcast Index
     id first, and then stores the new eligible count.
5. **Action.** `FeedService.setFeedLifecycleState` to `pending_archive`, `reasonKey`
   `podcast_index_dead`, `source` `system`. `archiveAll` archives, slims, converts follows,
   and cleans up. The feed row stays.
6. **Stub.** If a feed's reason is `podcast_index_dead`, no `channel` row points at it, and
   its Podcast Index id is absent from this CSV, delete that feed row (at most 200 per run).
   Skip the delete when another row still references the feed. A later return starts clean.
   There is no automatic revive. A feed that leaves the list while its channel still exists
   stays archived.
7. **Recent-feeds cron.** Skip every lifecycle that blocks parsing, not only `merged`.
8. **Follows do not stay on a removed show.**
   - A member moved to Add by RSS loses the directory follow during conversion.
   - After `follow_conversion_status` is `converted`, `unreachable`, or `no_followers`, delete
     every remaining `account_following_channel` row for that channel.
   - Takedown deletes those follows in the takedown transaction.
   - Clips and playlist entries stay, with their snapshots. That is the lasting record. This
     log only explains what happened, for 30 days.
9. **One log row per account per show.** Table `account_content_log`, `log_type`
   `removed_content` only. Unique on `(account_id, log_type, channel_id_text)`. Upsert rules:
   - `taken_down` replaces `left_directory`. `left_directory` does not replace `taken_down`.
   - `moved_to_add_by_rss` is kept over `ended`.
   - `clip_count` and `playlist_entry_count` become the greater of the stored and the new
     value.
   - `channel_title` fills in when the new value is non-null.
   - `updated_at` moves to now. `created_at` stays.

   Who gets a row:
   - **Left the directory:** each directory follower, when the follow is moved or ended.
     Clips still play, so clip owners are not logged for that reason.
   - **Taken down:** each directory follower, each clip owner, and each playlist owner, in
     the takedown transaction. `clip_count` and `playlist_entry_count` are that account's
     rows on the show.

   Not logged: merges, queue pruning, and episodes archived while their clips still play.
10. **Volume.** At most 100 rows per account; an insert trims older rows by `updated_at`.
    One show writes at most 5,000 new log rows; further accounts still lose the follow, and
    the run logs a warning. Chunk writes by 500 accounts. No push, email, or inbox
    notification.
11. **Retention.** `ACCOUNT_CONTENT_LOG_RETENTION_DAYS` defaults to 30. A daily worker
    deletes rows whose `updated_at` is older than that. Purging on `updated_at` keeps a row
    that was just updated for a later takedown.
12. **Where it appears.** Signed-in users only.
    - Web: a Settings tab `Advanced` (`/settings?tab=advanced`) with the Removed Content list.
    - Mobile: More, Advanced, Removed Content, next to Error Log.
    - When the mobile request has an access token, the archived-410 path does not also write
      `directory_channel_gone` to the local Error Log. Signed-out users still get that line.

## What a row says

One show produces one row. The screen turns the columns into short sentences: the show left
the directory or was taken down; the follow moved to Add by RSS or ended, when
`follow_outcome` is set; clip and playlist counts only when they are above zero.

## Out of scope

- Changing `PODCAST_INDEX_DUPLICATE_MERGE_MODE` on alpha. That stays a separate config step.
- Retiring a feed from our own parse failures.
- Logging merges.
- Any notification, email, or inbox row for these events.
