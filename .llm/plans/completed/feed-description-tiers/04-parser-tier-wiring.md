# 04 — Parser tier wiring, reparse job, and backfill

**Cursor model:** Opus 5.5 · **Reasoning:** high

## Summary

The parser stores sanitized, balanced descriptions within the feed's tier. It records
truncation per row and per feed. Workers run the `feed-force-reparse` job. A one-off backfill
repairs rows written by the old raw cut and schedules throttled reparses so those feeds recover
their full notes.

Depends on 01 (helpers) and 03 (columns, job helpers). Do not edit management-api, apps/api, or
any client. Decisions: [00-SUMMARY.md](./00-SUMMARY.md) items 2–7 and 11.

## parser-mapping

`packages/parser-mapping/src/types/partytime.ts`: add `descriptionRaw?: string | null` to
`Episode` and to `FeedObject`. This is the local copy of Partytime's types. Partytime 5.2.0
populates the field (02). Until Podverse is on that version the field is absent, and the
pickers fall through to `description`.

`compat/partytime/item.ts`:

```ts
export const compatItemDescriptionDto = (
  parsedItem: Episode,
  tier: DescriptionLengthTierEnum
) => {
  const source = pickItemDescriptionSource({
    content: parsedItem.content ?? undefined,
    descriptionRaw: parsedItem.descriptionRaw ?? undefined,
    description: parsedItem.description ?? undefined,
    summary: parsedItem.summary ?? undefined,
  });
  return prepareDescriptionForStorage(source, tier);
};
```

Read the type for `content` and `summary` on both `PartytimeEpisode` and `Phase4PodcastLiveItem`.
If a live item lacks a field, pass `undefined`; do not cast.

`compat/partytime/channel.ts`: same shape with `pickChannelDescriptionSource`.

`compat/partytime/compatFull.ts` (Add-by-RSS mapping): pass `DEFAULT_DESCRIPTION_LENGTH_TIER`.
Add-by-RSS bundles are stored on phones, so the new fields reach them. Mobile reads them
tolerantly in 08.

Remove the `DATABASE_CONSTANTS.varchar_long` slices from both description builders. Leave
`varchar_long` itself; other columns use it.

## Parser threading

Add one context object and pass it down. Do not read the tier again per item.

```ts
export type DescriptionIngestContext = {
  tier: DescriptionLengthTierEnum;
  stats: { truncatedCount: number; longestSourceLength: number };
};
```

- `parser.ts`: after loading `feed`, build the context with
  `resolveDescriptionLengthTier(feed.description_length_tier_override)`. Pass it to
  `handleParsedChannel`, `handleParsedItems`, and `handleParsedLiveItems`.
- `channel/channel.ts` → `handleParsedChannelDescription(parsedFeed, channel, context, manager)`.
- `item/item.ts`: `handleParsedItems` → `handleParsedItemBatch` → the per-item handler →
  `handleParsedItemDescription(parsedItem, item, context, manager)`. Follow the same path for
  live items.
- Each description handler builds the DTO, updates `context.stats` (count when `is_truncated`,
  max of `source_length`), then calls `handleParsedOneData` as today. Null still deletes the row.
- `ItemDescriptionService` / `ChannelDescriptionService`: make sure `update` writes `preview`,
  `is_truncated`, and `source_length`. Extend the update type if it only accepts `value`.

On success, in the existing `finally` block in `parser.ts`, extend `feedUpdateDto` next to
`last_parsed_file_hash`:

- `description_truncated_count`: `stats.truncatedCount`
- `description_longest_source_length`: `stats.longestSourceLength`, or null when 0
- `description_truncated_at`: now when the count is above 0. Otherwise leave it unchanged; it
  records the last parse that cut something.

Write the telemetry only when `parseSucceeded`. A no-change skip
(`FeedNoChangesSinceLastParsedError`) writes nothing, because the stored rows did not change.

## Reparse job — `apps/workers/src/commands/orm/scheduledJob/runDue.ts`

Register `[FEED_FORCE_REPARSE_JOB_TYPE]: handleFeedForceReparse`:

1. `parseFeedForceReparsePayload(job.payload)`. Null throws, as the admin handler does.
2. Load the feed. Missing returns `{ outcome: 'cancelled', reason: 'Feed not found' }`.
3. If the feed may not be parsed (merged, taken down, or blocked by policy), cancel with the
   reason. Use the same eligibility check the ordinary parse path uses. Search the
   lifecycle/policy helpers in `@podverse/orm`; do not write a new rule.
4. Call `parsePodcastIndexFeedDirectly(feed.podcast_index_id, true, { enqueueFollowUpWork: true,
   suppressNewItemSideEffectsPublishedBeforeMs: job.created_at.getTime() })`.

In `apps/workers/src/commands/parser/rss/parseFeed.ts`, add that optional suppress field to the
`parsePodcastIndexFeedDirectly` options and pass it into `parseOptions`. A maintenance reparse
must not send new-episode notifications for items that already existed when it was scheduled.

## Backfill command — `ormDescriptionsBackfill`

New file under `apps/workers/src/commands/orm/`. Register it where `scheduledJobsRunDue` is
registered: `apps/workers/src/commands/index.ts`, `packages/worker-commands/src/registry.ts`,
and the startup categories in `apps/workers/src/lib/startup/categoriesForCommand.ts` (database
only, the same category as `scheduledJobsRunDue`). Update its test.

Arguments: `-limit` (rows per batch, default 500), `-enqueueReparse`, `-maxFeeds` (default
200), `-staggerSeconds` (default 60), and `-dry-run`. Parse them the way `runDue.ts` parses
`-limit`.

Step A, for each of `item_description` and `channel_description`, in ascending id batches where
`preview IS NULL`:

- Resolve the feed's tier through item → channel → feed (or channel → feed).
- Run the row through a pure function `planDescriptionBackfill(value, tier)`, exported for
  tests. It returns the new `value`, `preview`, `is_truncated`, and `source_length`.
  - When `value.length === 2500` before preparing (the old raw cut), set `is_truncated: true`
    and `source_length: null`. Null means the source length is unknown until a reparse.
  - When preparing returns null (blank), set `preview: ''` so the row counts as done.
- Write only the four columns, one batch per transaction.

Step B, only with `-enqueueReparse`:

- Select feeds that have a row with `is_truncated AND source_length IS NULL` and no
  `scheduled_job` row with dedupe key `buildFeedForceReparseDedupeKey(feed.id)` in a pending or
  running state. Skip feeds that may not be parsed. Order by feed id. Take `-maxFeeds`.
- `scheduleFeedForceReparse(feed.id, 'description_backfill', now + i * staggerSeconds)`.
  Staggering keeps one `scheduledJobsRunDue` pass from claiming dozens of parses and delaying
  admin notification campaigns, which share that runner.

Log totals: rows scanned, rows rewritten, legacy cuts found, feeds scheduled, feeds remaining.
The command is idempotent; rerunning it converges.

## Kubernetes — suspended CronJob

`infra/k8s/base/cron/worker-descriptions-backfill.cronjob.yaml`: copy
`worker-scheduled-jobs.cronjob.yaml`. Set `suspend: true` and a placeholder schedule. The
command is `ormDescriptionsBackfill -enqueueReparse -maxFeeds 200`, with the same env refs and
security context. Add it to `infra/k8s/base/cron/kustomization.yaml`. Follow **infra-k8s**.

## Tests

- parser-mapping: `compatItemDescriptionDto` prefers `content`, falls back to `descriptionRaw`,
  respects the tier, and returns null for blank. Put the test next to the existing compat
  tests in that package.
- parser: a feed with two over-limit items records count 2 and the longest source length.
  Follow the mocking style in `parser.parseRSSFeedAndSaveToDatabase.hash-and-failure.test.ts`.
- workers `runDue.test.ts`: the reparse handler cancels a missing feed, cancels an ineligible
  feed, and calls the parse function with `forceParse` and the job's `created_at`.
- workers: `planDescriptionBackfill`, covering a legacy 2,500-character cut, a short row, a blank
  row, and idempotence on an already-prepared value.

## Scratchpad

Append to `release-notes/scratchpad.md`:

```markdown
## Long show notes keep their formatting

- Surfaces: parser, workers, k8s base cron
- Change: Descriptions are sanitized to the supported tags and shortened at a paragraph or
  list-item boundary within the feed's tier (default 10,000 visible characters), so lists,
  headings, and links survive. Items prefer content:encoded. Plain-text notes keep their line
  breaks. Each feed records how many descriptions were shortened and the longest source.
  A feed-force-reparse scheduled job reparses one feed. ormDescriptionsBackfill repairs rows cut
  by the old 2,500-character limit and schedules throttled reparses.
- Who notices: listeners see full, formatted show notes. Operators get a backfill job.
- Operator steps: after deploy, run the suspended worker-descriptions-backfill CronJob by hand
  until it reports no feeds remaining.
```

## Done when

- No description builder slices raw HTML.
- Telemetry is written only on a successful parse.
- The reparse handler never sends notifications for items older than the job.
- Code comments must not cite this plan or any plan number.

## Operator verification

**Root**

```bash
npm run build:packages
npm run test -w packages/parser-mapping
npm run test -w packages/parser
npm run build -w apps/workers
npm run test -w apps/workers
kustomize build --load-restrictor LoadRestrictionsNone infra/k8s/base/cron
node apps/workers/dist/index.js ormDescriptionsBackfill -dry-run
```

The last line reads the local dev database. **Dev** must be up (`make local_infra_up` or the
usual stack).

Backfill on alpha, after deploy. The alpha cron overlay in `k.podcastdj.com` pulls
`infra/k8s/base/cron` at the release tag, so the CronJob appears once that tag includes it. For
each rerun, increase the trailing number.

```bash
kubectl -n podverse-alpha create job --from=cronjob/worker-descriptions-backfill descriptions-backfill-1
kubectl -n podverse-alpha logs -f job/descriptions-backfill-1
```
