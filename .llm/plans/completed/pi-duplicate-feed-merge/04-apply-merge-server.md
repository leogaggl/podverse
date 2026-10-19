# 04 — Apply the merge on the server

**Cursor model:** Opus 5.5 · **Reasoning:** high

## Summary

Turn a verified Podcast Index pair into one show. If we only have the old feed, re-point that
feed at the survivor URL and keep every id. If we have both, move account data onto the
survivor channel and stop parsing the old one. Every changed row is journaled so management
can revert it. Listeners are not notified about the backlog.

Depends on [01](./01-merge-data-model.md), [02](./02-dead-feed-detection-sync.md),
[03](./03-pair-verification-and-item-matching.md), and [05](./05-first-parse-side-effect-guard.md).
Replace [packages/orm/src/services/deduplicator.ts](packages/orm/src/services/deduplicator.ts).
Delete the delegate in `deduplicator.helpers.ts` once nothing imports it.

## Command

At the end of `podcastIndexDeadFeedsFlagAndMerge` (after detection), call
`verifyAndApplyDuplicateMerges()`.

| Mode | Behavior |
| --- | --- |
| `off` | Detection already returned. This function is not called. |
| `dry_run` | Assess each `detected` row. Write `verified` or `needs_review`, `mode`, channel ids, and `item_merge_map`. Do not change follows, items, or lifecycle. |
| `apply` | Do the dry-run write, then apply each `verified` row in its own transaction. |

`needs_review`, `rejected`, `applied`, and `reverted` are not auto-applied. Plan 08 sets an
approved row back to `verified`; the next `apply` run picks it up.

## Choose the mode for a pair

- No Podverse feed for `from_podcast_index_id`: skip.
- No Podverse feed for `to_podcast_index_id`: `repoint`.
- Both exist, and they are different channels: `absorb`. The survivor channel is the one whose
  feed has `to_podcast_index_id`.
- Both ids point at the same channel: skip, set `note` to `already_one_channel`.

## Assess before writing

Build `MatchFeed` values and call `assessDuplicatePair`.

- **Absorb:** both channels' stored items. Enclosure URL comes from the item's enclosure row.
  `podcast_guid` from the channel. iTunes id and `atom:link rel=self` from the last parsed feed
  data we stored; if we did not store them, pass null. Do not refuse a pair only because those
  fields are null.
- **Re-point:** stored items on the old channel, and items parsed from the survivor RSS in
  memory. Use the existing fetch/parse path that does not write the database. If the fetch
  fails, set `needs_review` and stop. Do not mark the feed archived.

Store `confidence`, `match_stats`, and one `item_merge_map` row per old item (`to_item_id`
null when unmatched). Replace map rows for this merge when re-assessing (delete + insert in the
same transaction).

## Apply, one transaction per pair

`SELECT … FOR UPDATE` on the `channel_merge` row. If status is no longer `verified`, return.

### Re-point

1. Journal then update each matched item's `guid` and `guid_enclosure_url` to the survivor
   item's values. Unmatched items are left unchanged.
2. Journal then set the feed's `url` and `podcast_index_id` to the survivor. Clear
   `last_parsed_file_hash` if that column is set, so the next parse is not skipped as unchanged.
3. If setting `channel.podcast_guid` to the survivor GUID would violate UNIQUE, leave it null
   and set `match_stats.guidCollision`. Do not fail the transaction.
4. Set `mode=repoint`, `status=applied`, `applied_at=now()`. `to_channel_id` stays null.
5. After commit, enqueue one parse of the new URL with
   `suppressNewItemSideEffectsPublishedBeforeMs` set to `applied_at`. Queue `rss-on-demand` (or
   the queue `parseFeed` already uses for a single feed). Do not parse inside the transaction.

Ids do not change. Plan 06 has nothing to redirect for a re-point.

### Absorb

Move rows with insert-then-delete, not a single `UPDATE` that can hit a unique key. Journal
every insert, update, and delete (`before_json` / `after_json`).

| Table | Rule |
| --- | --- |
| `account_following_channel` | Insert `(account, B)` where missing. Delete `(account, A)`. |
| `account_notification_channel` plus its type rows | If B has no row, insert one and copy type rows. If B has a row, keep B's types. Then delete A's row. |
| `account_device_auto_download_channel` | Same insert-then-delete on `(account, installation, channel)`. |
| `account_pending_following_channel` | Point `podcast_index_id` and `feed_url` at the survivor when that `(account, feed_url)` is free. Otherwise delete the old pending row. |
| `queue_resource` | Repoint `item_id` through `item_merge_map`. When one queue would hold both items: keep `completed` if either is completed; otherwise keep the greater `playback_position`. Delete the other row. |
| `clip`, `playlist_resource` | Repoint `item_id` when the map has a `to_item_id`. |
| `stats_aggregated_channel`, `stats_aggregated_item` | Add A's counts onto B's row. Delete A's row. Create B's row when missing. |
| `stats_track_event_channel`, `stats_track_event_item` | If B already has that `account_guid`, delete A's event (do not double-count). Otherwise update the entity id. |

Fuzzy-only matches (no GUID, no enclosure): the audio may differ.

- Queue: preserve `completed`. Set `playback_position` to 0 unless the row was already completed.
- Clips: still repoint. Increment `match_stats.uncertainClipCount`. Do not scale timestamps.

Unmatched items:

- With a queue row, clip, or playlist resource: leave the item Active so that progress still
  plays. Count them in `match_stats.unmatchedKept`.
- With none of those: set item flag `PendingArchive` through the existing item-flag writer.

Then set feed A's lifecycle to `merged` via `FeedService.setFeedLifecycleState`, source
`system`. Do not delete channel A.

Set `mode=absorb`, `status=applied`, `to_channel_id`, `applied_at`.

Do not enqueue a parse of A. B is already parsed. Do not call the notification handlers.

## Revert

`revertChannelMerge(id)` in one transaction, only when status is `applied`.

Walk `channel_merge_journal` in reverse id order:

- `update`: write `before_json` back
- `insert`: delete the row we inserted
- `delete`: insert `before_json` back

Set lifecycle to `active` with `explicitManagementOverride`. Set status `reverted`. Keep the
journal. A later detection run must not flip `reverted` back to `detected` (plan 02 already
leaves `reverted` alone).

Re-point revert restores URL, Podcast Index id, and item GUIDs. It does not try to un-parse
episodes the follow-up parse added; those are real episodes on the survivor URL.

## Tests

API integration test (Postgres, `npm run test:e2e:api` is the operator command; this prompt
adds the test, it does not run it):

- Two feeds, two channels, overlapping item GUIDs.
- Account F follows only A. Account G follows both. G must not abort the merge.
- A queue row on a matched item, with `playback_position` and `completed`.
- A clip on a matched item.
- Apply. F and G follow only B. Queue and clip point at B's item. A's lifecycle is `merged`.
- Revert. Follows, queue, and clip point at A again. A's lifecycle is `active`.

A second test: survivor id has no feed → re-point updates `feed.url` and `podcast_index_id`,
channel id and item ids unchanged, and the enqueued parse options include the suppress timestamp.
Stub the RSS fetch.

## Docs and scratchpad

Extend the dedup paragraph in [docs/RSS-ARCHIVE-DELETE-LIFECYCLE.md](docs/RSS-ARCHIVE-DELETE-LIFECYCLE.md)
with re-point vs absorb and the journal. Append one entry to `release-notes/scratchpad.md`:

```markdown
## Duplicate Podcast Index feeds collapse onto one show

- Surfaces: workers, orm, api
- Change: When Podcast Index marks a feed as a duplicate, Podverse either re-points the feed we
  already have or moves follows, queue progress, clips, and playlists onto the surviving channel.
  The old channel stops parsing. Pairs that do not look like the same episodes wait for review.
- Who notices: listeners who followed a duplicate RSS URL; operators reviewing merges
- Operator steps: `PODCAST_INDEX_DUPLICATE_MERGE_MODE` stays `off` until an environment is ready
```

## Done when

- `dry_run` writes assessments and changes no account row.
- `apply` is idempotent for an already `applied` row.
- An account that follows both channels ends with one follow.
- Queue progress survives a GUID match.
- Revert restores the journaled rows.

## Operator verification

**Root** — API integration tests need Postgres on 5732 and Valkey on 6679 (`make test_deps`).

```bash
npm run test -w apps/api
```
