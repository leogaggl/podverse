# 03 — Description schema, ORM, and DTO fields

**Cursor model:** Cursor Grok 4.7 · **Reasoning:** high

## Summary

Add the columns every later prompt reads: the per-feed tier override, per-feed truncation
telemetry, and per-row `preview`, `is_truncated`, and `source_length`. Widen the description
`value` columns past 10,000 characters. Add the `feed-force-reparse` job type helpers so the
parser (04) and management (05) share one definition.

Depends on 01 (`DescriptionLengthTierEnum`, `DESCRIPTION_STORED_MAX_CEILING`,
`DESCRIPTION_PREVIEW_MAX_LENGTH`). You own the schema only. Do not edit the parser, routes, or
clients.

Follow **linear-sql-greenfield-only**, **linear-baseline-0004**, and
**migration-readiness-marker-sync**.

## Migration — `infra/k8s/base/ops/source/database/linear-migrations/app/0016_description_length_tiers.sql`

Use `0016` unless a later file already exists; take the next unused number and use it
everywhere below.

```sql
-- Per-feed description length tier and truncation telemetry. Tier keys and limits live in
-- @podverse/helpers descriptionLimits; null means the default tier.

ALTER TABLE public.feed ADD COLUMN description_length_tier_override varchar(16);

ALTER TABLE ONLY public.feed
    ADD CONSTRAINT feed_description_length_tier_override_check
    CHECK (
        description_length_tier_override IS NULL
        OR description_length_tier_override IN ('standard', 'extended', 'maximum')
    );

ALTER TABLE public.feed ADD COLUMN description_truncated_count integer DEFAULT 0 NOT NULL;
ALTER TABLE public.feed ADD COLUMN description_longest_source_length integer;
ALTER TABLE public.feed ADD COLUMN description_truncated_at timestamp without time zone;

CREATE INDEX feed_description_truncated_idx
    ON public.feed (description_longest_source_length DESC)
    WHERE description_truncated_count > 0;

ALTER TABLE public.item_description ALTER COLUMN value TYPE text;
ALTER TABLE ONLY public.item_description
    ADD CONSTRAINT item_description_value_length_check
    CHECK (char_length(value) <= 150000) NOT VALID;
ALTER TABLE public.item_description VALIDATE CONSTRAINT item_description_value_length_check;
ALTER TABLE public.item_description ADD COLUMN preview varchar(400);
ALTER TABLE public.item_description ADD COLUMN is_truncated boolean DEFAULT false NOT NULL;
ALTER TABLE public.item_description ADD COLUMN source_length integer;
```

Repeat the last block for `channel_description`, with constraint
`channel_description_value_length_check`.

Notes:

- `NOT VALID` then `VALIDATE` keeps the long scan off the exclusive lock. Every existing value is
  10,000 characters or fewer, so validation cannot fail.
- `ADD COLUMN ... DEFAULT false NOT NULL` is a metadata-only change on current Postgres.
- `ALTER COLUMN value TYPE text` from the `varchar_longer` domain may rewrite the table. Note
  that in the rollout section of your response so the operator can deploy in a quiet window. Do
  not add catalog probes or `IF EXISTS` guards.
- `preview` stays nullable. The backfill in 04 fills existing rows.

Then, yourself, in this order:

```bash
make db_regen_linear_baseline
make db_verify_linear_baseline
```

Leave the regenerated `0004_app_linear_baseline.sql.gz` and `0005_` gz in the working tree.

## Readiness markers

Set `API_EXPECTED_MIGRATION_FILENAME=0016_description_length_tiers.sql` in both places:

- `infra/k8s/base/api/source/api.env`
- `infra/k8s/base/ops/kustomization.yaml` (the configMapGenerator literal)

Leave `MANAGEMENT_API_EXPECTED_MIGRATION_FILENAME` alone. This is an app-database migration.

## ORM entities

`packages/orm/src/entities/feed/feed.ts`, next to the other overrides:

```ts
@Column({ type: 'varchar', length: 16, nullable: true })
description_length_tier_override!: DescriptionLengthTierEnum | null;

@Column({ type: 'int', default: 0 })
description_truncated_count!: number;

@Column({ type: 'int', nullable: true })
description_longest_source_length!: number | null;

@Column({ type: 'timestamp', nullable: true })
description_truncated_at!: Date | null;
```

`packages/orm/src/entities/item/itemDescription.ts` and
`packages/orm/src/entities/channel/channelDescription.ts`:

- `value`: `@Column({ type: 'text' })`. Leave `select` at its default; 09 changes it.
- `preview`: `varchar`, length `DESCRIPTION_PREVIEW_MAX_LENGTH`, nullable.
- `is_truncated`: `boolean`, default false.
- `source_length`: `int`, nullable.

## DTOs — `packages/helpers`

- `dtos/item/itemDescription.ts` and `dtos/channel/channelDescription.ts`: add
  `preview?: string | null`, `is_truncated?: boolean`, `source_length?: number | null`. They are
  optional because phones hold payloads written before these fields existed. Keep `value: string`
  required; 09 makes it optional.
- `dtos/feed/feed.ts`: add `description_length_tier_override?: string | null`,
  `description_truncated_count?: number`, `description_longest_source_length?: number | null`,
  `description_truncated_at?: string | null`.

## Force-reparse job helpers — new `packages/orm/src/services/feed/feedForceReparseScheduler.ts`

Mirror `adminNotificationCampaignScheduler.ts`:

```ts
export const FEED_FORCE_REPARSE_JOB_TYPE = 'feed-force-reparse';

export type FeedForceReparsePayload = {
  feedId: number;
  reason: 'description_tier_change' | 'description_backfill';
};

export const buildFeedForceReparseDedupeKey = (feedId: number): string =>
  `${FEED_FORCE_REPARSE_JOB_TYPE}:${feedId}`;

export const parseFeedForceReparsePayload = (
  payload: Record<string, unknown> | null | undefined
): FeedForceReparsePayload | null;
```

The parser accepts a positive integer `feedId` and a known `reason`. Anything else returns
null.

Also add `scheduleFeedForceReparse(feedId, reason, runAfter)` there. It calls
`ScheduledJobService.upsertByDedupeKey`, then sets `feed.last_parsed_file_hash` to null. The
job parses with `forceParse`, so clearing the hash only matters if the job fails: the next
ordinary parse of that feed still runs in full. Management (05) and the backfill (04) both call
this one function.

Export everything new from `packages/orm/src/index.ts`.

## Tests

`packages/orm/src/services/feed/feedForceReparseScheduler.test.ts`: payload parsing (valid,
missing id, string id, unknown reason) and the dedupe key. 05's integration test covers the
job row and the cleared hash against a real database.

## Scratchpad

Append to `release-notes/scratchpad.md`:

```markdown
## Description columns allow longer show notes

- Surfaces: ops (app DB migration 0016), k8s base api env
- Change: Feeds gain a description length tier override and truncation counts. Item and
  channel descriptions gain a plain preview, a truncated flag, and the source length, and the
  stored text may now exceed 10,000 characters (database cap 150,000).
- Who notices: operators. Listeners notice once the parser change ships.
- Operator steps: the API waits for 0016_description_length_tiers.sql. Changing value to text
  may rewrite item_description; deploy in a quiet window.
```

## Done when

- `make db_verify_linear_baseline` passes, and you ran it.
- Both readiness markers name the new file.
- No `IF EXISTS`, `IF NOT EXISTS`, or `ON CONFLICT` in the migration.
- Code comments must not cite this plan or any plan number.

## Operator verification

**Root**

```bash
npm run build:packages
npm run test -w packages/orm
kustomize build --load-restrictor LoadRestrictionsNone infra/k8s/base/api
kustomize build --load-restrictor LoadRestrictionsNone infra/k8s/base/ops
```
