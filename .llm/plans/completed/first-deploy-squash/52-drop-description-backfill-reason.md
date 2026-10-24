**Cursor model:** Cursor Grok 4.7 · **Reasoning:** medium

Drop `description_backfill` from the forced-reparse reason. Keep `description_tier_change`. Plan 60 deletes the only writer, `apps/workers/src/commands/orm/descriptions/backfill.ts`, and rewrites the two `'description_backfill'` strings in `apps/workers/src/commands/orm/scheduledJob/runDue.test.ts`. This plan runs after that, so the union member is gone only once that call site is gone.

`FeedForceReparseReason` is the string union on line 8 of `packages/orm/src/services/feed/feedForceReparseScheduler.ts`. `FEED_FORCE_REPARSE_REASONS` (line 15) is the allowed-reason set `isFeedForceReparseReason` checks. `parseFeedForceReparsePayload` returns null for a reason outside that set. `handleFeedForceReparse` in `apps/workers/src/commands/orm/scheduledJob/runDue.ts` then throws `Invalid feed-force-reparse payload`. Do not edit that worker file.

The management API still schedules the remaining reason. `apps/management-api/src/routes/feeds.ts` calls `scheduleFeedForceReparse(feedId, 'description_tier_change', new Date())`. Leave that call and `apps/management-api/src/routes/feeds.integration.test.ts` as they are.

## Rows

R33

## Runs after

60

## Files

packages/orm/src/services/feed/feedForceReparseScheduler.ts
packages/orm/src/services/feed/feedForceReparseScheduler.test.ts

## Tests

In `packages/orm/src/services/feed/feedForceReparseScheduler.test.ts`, replace every `'description_backfill'` with `'description_tier_change'`. That is the accept expect for feed id 7, and the four rejection expects that pass a known reason beside a missing, string, zero, or fractional feed id. Keep both expects in `accepts a positive integer feed id and a known reason` (feed ids 42 and 7). Keep the test titles, the `'other'` rejection, and the null payload rejection.

No API integration test, Playwright spec, or Maestro flow. The management API integration test already expects `description_tier_change`.

## Release scratchpad

Append this to `release-notes/scratchpad.md` when this prompt is the only one in its phase. When it shares a phase, do not edit the scratchpad; put the same entry in the final message under "Release notes entry".

```markdown
## Drop the description backfill reparse reason

- Surfaces: orm, workers
- Change: `feed-force-reparse` accepts only reason `description_tier_change`. A payload whose reason is `description_backfill` fails as an invalid payload. Nothing writes that reason after `ormDescriptionsBackfill` is removed.
- Who notices: operators who still had a queued force-reparse from that command
- Operator steps: none
```

## Edit

In `feedForceReparseScheduler.ts`, the type and the set become:

```typescript
export type FeedForceReparseReason = 'description_tier_change';
```

```typescript
const FEED_FORCE_REPARSE_REASONS: ReadonlySet<string> = new Set<FeedForceReparseReason>([
  'description_tier_change',
]);
```

Leave `FeedForceReparsePayload`, `isFeedForceReparseReason`, `parseFeedForceReparsePayload`, `scheduleFeedForceReparse`, and the job type `feed-force-reparse`. Do not add a comment about the removed reason.

`packages/orm/src/index.ts` star-exports this module. Plan 50 edits a comment in that file. Do not edit it.

## Do not edit

- `apps/workers/**`, including `runDue.ts` and `runDue.test.ts`. Plan 60 owns those.
- Any file in plan 50's `## Files` list.
- `apps/management-api/**` (area D).
