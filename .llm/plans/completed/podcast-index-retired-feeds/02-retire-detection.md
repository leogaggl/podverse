# 02 — Retire detection

**Cursor model:** Opus 5.5 · **Reasoning:** high

## Summary

The hourly job retires feeds the Podcast Index dead list marks, with a brake and a per-run
cap. The recent-feeds cron stops enqueueing feeds that will not be parsed. Decisions:
00-SUMMARY 1 through 7.

Depends on 01 (`last_retire_eligible_count`). Can run beside 03.

## Pure helper

In `packages/external-services-podcast-index/src/deadFeedDuplicateChains.ts`:

```ts
export function podcastIndexIdsToRetire(
  targets: ReadonlyMap<number, number | null>,
  heldPodcastIndexIds: ReadonlySet<number>
): number[];
```

Return held ids that are keys of `targets` and are **not** keys of
`resolveDeadFeedDuplicateChains(targets)`. That set is empty-`duplicateOf` rows plus chains
that do not resolve. Sort ascending. Extend `deadFeedDuplicateChains.test.ts` with a map
that has an empty target, a cycle, and a resolved pair. Only the first two come back.

## Brake

Same file, so the worker test does not need a database:

```ts
export const RETIRE_BRAKE_MIN_GROWTH = 2000;
export const RETIRE_MAX_PER_RUN = 200;

export function retireGrowthExceedsBrake(params: {
  eligibleCount: number;
  previousEligibleCount: number | null;
  heldCount: number;
}): boolean;
```

True when `previousEligibleCount` is null, or when
`eligibleCount - previousEligibleCount` is greater than
`max(RETIRE_BRAKE_MIN_GROWTH, ceil(heldCount * 0.01))`. A negative growth is false.
Unit-test null previous, a growth of 2000, a growth of 2001, and a 1% case.

## Job

`apps/workers/src/commands/podcastIndex/deadFeeds/flagAndMerge.ts`.

Download when **either** mode is not `off`. When retire mode is `off` and merge mode is
`off`, keep today's early return. When retire mode is `dry_run` or `apply`, call the
download **without** `ifModifiedSince` / `ifNoneMatch`, then still save `last_modified`,
`etag`, and `synced_at`. The merge pass keeps its current order: record pairs, then
`verifyAndApplyDuplicateMerges`.

After that pass, if retire mode is `off`, return. Otherwise:

1. Build the retire id list with `podcastIndexIdsToRetire`.
2. Load `channel_merge` for those Podcast Index ids plus the resolved pairs we hold.
   - Drop an id whose row is `detected`, `verified`, `needs_review`, or `applied`.
   - Add a held resolved-pair source whose row is `rejected` or `reverted`.
3. Eligible count is that set's size. Held count is `FeedService.listPodcastIndexIds()`.
4. If `retireGrowthExceedsBrake` is true, log a warning with both counts and the sentence
   that one `dry_run` accepts the new count. Do not change `last_retire_eligible_count`.
   Retire nothing.
5. If mode is `dry_run`, log eligible, growth, and how many are not yet blocking. Store
   `last_retire_eligible_count`. Retire nothing.
6. If mode is `apply` and the brake is clear, take the first `RETIRE_MAX_PER_RUN` ids whose
   feed lifecycle does not already block parsing, ordered by Podcast Index id. For each,
   `FeedService.setFeedLifecycleState` with `toStateKey` `pending_archive`, `reasonKey`
   `podcast_index_dead`, `source` `FeedLifecycleUpdateSourceEnum.System`. Then store the
   eligible count. Log how many changed.

Preserve `last_retire_eligible_count` when saving the sync row after a download. A save that
builds a new entity must copy the stored count, or the column goes null and the next run
looks like a first run.

## Stub delete

After the retire pass, in `apply` only. Select up to 200 feeds where `reason_key` is
`podcast_index_dead`, no `channel.feed_id` points at the feed, and `podcast_index_id` is not
in this CSV's id set. Delete the feed row. If a foreign key blocks one delete, skip that row
and log it. Do not cascade into account data. `dry_run` logs the count and deletes nothing.

## Recent-feeds cron

`packages/mq/src/functions/mq/rss/addRecentlyUpdatedFeedsFromPodcastIndex.ts`. Skip when
`lifecycleStateBlocksParseAndVisibility` is true for the stored state
(`pending_archive`, `archived`, `merged`, `takedown`). Rename the counter in the log line so
it counts every skipped blocking state. A missing lifecycle still enqueues, which matches
today's non-merged path.

## Env

Add `PODCAST_INDEX_DEAD_FEED_RETIRE_MODE` beside `PODCAST_INDEX_DUPLICATE_MERGE_MODE`.

- `apps/workers/src/config/index.ts`: same three-value union. Invalid values throw at startup.
- `apps/workers/src/lib/startup/validation.ts`: required, same category, same order as the
  env files (**startup-validation-env-order**).
- `apps/workers/.env.example`: quoted `"off"`.
- `infra/k8s/base/workers/source/workers.env`: unquoted `off`, one variable per comment line.
- `apps/workers/ENV.md`: one short entry. `off` skips the retire pass. `dry_run` stores the
  baseline. `apply` retires.

Update the `podcastIndexDeadFeedsFlagAndMerge` description in
`packages/worker-commands/src/registry.ts` so it mentions the retire pass. Do not add a
command.

## Scratchpad

```markdown
## Retire feeds the Podcast Index dead list marks

- Surfaces: workers, mq, k8s workers env
- Change: PODCAST_INDEX_DEAD_FEED_RETIRE_MODE off, dry_run, or apply. apply sets
  pending_archive with reason podcast_index_dead, at most 200 feeds a run, and refuses a
  jump above max(2000, 1% of held feeds). The recent-feeds cron skips every lifecycle that
  blocks parsing.
- Who notices: operators. Listeners see nothing until archiveAll runs.
- Operator steps: base stays off. Alpha rollout is dry_run, read the count, then apply.
```

## Done when

- `off` still returns before any download when merge mode is also `off`.
- `dry_run` stores the count and changes no lifecycle.
- A null stored count never retires.
- Comments do not cite a plan or a step number.

## Operator verification

**Root**

```bash
npm run build:packages
npm run test -w @podverse/external-services-podcast-index
npm run test -w packages/mq
npm run test -w apps/workers
npm run build -w apps/workers
```
