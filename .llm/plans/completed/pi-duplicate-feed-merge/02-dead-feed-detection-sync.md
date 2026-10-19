# 02 — Dead-feed detection sync

**Cursor model:** Cursor Grok 4.7 · **Reasoning:** high

## Summary

Replace the suspended merge job with a sync that records Podcast Index duplicate pairs we
already hold. It does not merge, does not archive a feed, and ignores dead rows that have no
duplicate target. A mode flag keeps production idle until alpha has reviewed a dry run.

Depends on the tables from [01-merge-data-model.md](./01-merge-data-model.md). Do not edit the
parser notification block (plan 05) or `packages/orm/src/services/deduplicator.ts` (plan 04).

## Mode

`PODCAST_INDEX_DUPLICATE_MERGE_MODE` is `off`, `dry_run`, or `apply`. Anything else fails startup.

| Mode | This command |
| --- | --- |
| `off` | Exit 0 immediately. Do not download the CSV. |
| `dry_run` | Upsert `detected` rows. Never set `applied`. |
| `apply` | Same as `dry_run` in this prompt. Plan 04 is what applies. |

Add the var:

- `infra/k8s/base/workers/source/workers.env` — unquoted `PODCAST_INDEX_DUPLICATE_MERGE_MODE=off`, one
  comment line that names only this variable.
- `apps/workers/.env.example` (and the env-template stub if workers has one) —
  `PODCAST_INDEX_DUPLICATE_MERGE_MODE="off"`.
- `apps/workers/src/lib/startup/validation.ts` next to `PODCAST_INDEX_BASE_URL`. Allow only the
  three values. Do not default it in `config/index.ts`; validation rejects a missing value.

Do not set alpha to `dry_run` in this prompt. Base stays `off`. The operator flips alpha after
review (see [00-EXECUTION-ORDER.md](./00-EXECUTION-ORDER.md)).

## Download

Rewrite `deadFeedsDownloadAndExtractCSV` in
[packages/external-services-podcast-index/src/index.ts](packages/external-services-podcast-index/src/index.ts).

- Write the file under `os.tmpdir()` via `fs.mkdtemp`. Delete it in `finally`. Do not use
  `__dirname` (this package is `"type": "module"`).
- Send `If-Modified-Since` and `If-None-Match` from `podcast_index_dead_feed_sync`. On HTTP 304,
  return without parsing.
- Use the service user-agent. A generic agent gets HTTP 403 from `public.podcastindex.org`.
- Keep `deadFeedsExtractRow`: column 0 is `id_to_archive`, column 1 is `duplicate_id_to_keep`
  or null.

The CSV is about 30MB and about 3.3 million lines. Stream it. Do not load the file as one string.

## What gets recorded

Build an in-memory map of dead id → duplicate target (null when the second column is empty). Then:

1. Resolve chains. Walk `duplicateOf` with a visited set. A cycle, or a final id that is itself
   in the dead map and has no further target, is skipped (no row).
2. Load `feed.podcast_index_id` for non-null ids into a `Set` once. Intersect. Do not query per
   CSV row.
3. For each remaining pair, upsert `channel_merge` on `from_podcast_index_id`:
   - Insert as `detected` when absent. Set `to_podcast_index_id` to the resolved survivor.
     Leave `mode`, `from_channel_id`, and `to_channel_id` null (plan 04 fills them).
   - If status is already `applied`, `rejected`, or `reverted`, do not change it.
   - If status is `detected`, `verified`, or `needs_review`, update `to_podcast_index_id` when
     the resolved survivor changed, and set status back to `detected` so verification runs again.
4. Upsert the single `podcast_index_dead_feed_sync` row with the response `Last-Modified`,
   `ETag`, and `synced_at`.

Remove `/data/dead_feeds_cache.json`. Remove `podcastIndexDeadFeedsDeleteCache` from
[packages/worker-commands/src/registry.ts](packages/worker-commands/src/registry.ts),
`apps/workers/src/commands/index.ts`, and `categoriesForCommand.ts`.

`podcastIndexDeadFeedsFlagAndMerge` keeps its command name so the cron args do not change, but
its body is the sync above. It must not call `handleDuplicatePodcastIndexId`.

Update the dedup paragraph in [docs/RSS-ARCHIVE-DELETE-LIFECYCLE.md](docs/RSS-ARCHIVE-DELETE-LIFECYCLE.md)
so it no longer says this job sets `PendingArchive`. Say it only records `duplicateOf` pairs.
Plan 04 will extend that paragraph with apply behavior. Leave the rest of the doc alone.

## Recent feeds

In [packages/mq/src/functions/mq/rss/addRecentlyUpdatedFeedsFromPodcastIndex.ts](packages/mq/src/functions/mq/rss/addRecentlyUpdatedFeedsFromPodcastIndex.ts),
after the feed is found, skip enqueue when its lifecycle `state_key` is `merged`. Count those
skips in the existing log line. Do not batch-rewrite this function.

## `podcast_guid` collision

`channel.podcast_guid` is UNIQUE. Two copies of one `<podcast:guid>` make
`channelService.update` throw on every parse.

In `handleParsedChannel` ([packages/parser/src/lib/rss/channel/channel.ts](packages/parser/src/lib/rss/channel/channel.ts)),
when the update fails on that unique constraint:

- Retry the update with `podcast_guid` omitted (leave the column null on this channel).
- Log one warning with both channel ids. Do not fail the parse.
- If a `channel_merge` row already exists for either feed's `podcast_index_id`, set
  `match_stats.guidCollision` to true. Do not insert a `channel_merge` row from the parser.
  Podcast Index is the only source of pairs.

## Cron

[infra/k8s/base/cron/worker-dead-feeds-merge.cronjob.yaml](infra/k8s/base/cron/worker-dead-feeds-merge.cronjob.yaml):

- `suspend: false`
- `schedule: "15 * * * *"` (the CSV is rewritten hourly; avoid minute 0)
- Keep `concurrencyPolicy: Forbid`, `backoffLimit: 0`, `restartPolicy: Never`
- Command stays `podcastIndexDeadFeedsFlagAndMerge`
- Drop the stale volume mount comment path `podverse-external-services/.../tmp` if the container
  no longer needs that mount. The download uses `os.tmpdir()`, which is writable.

Safe while the base env is `off`: the job starts and exits.

## Tests

Unit-test chain resolution and the "we hold this id" filter with a fixture of a few CSV rows,
including a chain, a cycle, a dead survivor, and a row with an empty second column. Do not
download the live CSV in tests.

## Done when

- `off` does not touch the network.
- A duplicate row for a feed we have becomes one `detected` row pointing at the final live id.
- A dead row with no duplicate target does not change any feed lifecycle.
- A `podcast_guid` collision no longer fails the parse.

## Operator verification

**Root**

```bash
npm run test -w @podverse/external-services-podcast-index
npm run test -w @podverse/orm
npm run test -w @podverse/mq
```
