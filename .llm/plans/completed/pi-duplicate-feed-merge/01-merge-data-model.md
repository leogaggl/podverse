# 01 — Merge data model

**Cursor model:** Cursor Grok 4.7 · **Reasoning:** high

## Summary

Add the tables and the `merged` feed lifecycle state that later plans write and read. Nothing
applies a merge in this prompt. A feed in `merged` cannot be parsed and is not public.

Decisions: [00-SUMMARY.md](./00-SUMMARY.md). This prompt owns the schema. Do not edit worker
commands or the parser notification block.

## Lifecycle state

Add `Merged = 'merged'` to `FeedLifecycleStateKeyEnum` in
[packages/orm/src/entities/feed/feedLifecycleStateType.ts](packages/orm/src/entities/feed/feedLifecycleStateType.ts).

Seed it in `infra/k8s/base/ops/source/database/linear-migrations/app/0015_channel_merge.sql`
(next file after `0014_billing_strike.sql`). Do not edit `0001_app_schema.sql`.

```sql
INSERT INTO public.feed_lifecycle_state_type (id, state_key, created_at, updated_at)
VALUES (5, 'merged', '2000-01-01 00:00:00+00', '2000-01-01 00:00:00+00');

SELECT setval('public.feed_lifecycle_state_type_id_seq', 5, true);
```

Confirm the sequence name against `0001` before writing. `state_key` is `varchar(64)`.

### Transitions

In [packages/orm/src/lib/feedLifecycleTransitionValidation.ts](packages/orm/src/lib/feedLifecycleTransitionValidation.ts):

| From | To | Allowed |
| --- | --- | --- |
| `active` | `merged` | yes |
| `pending_archive` | `merged` | yes |
| `archived` | `merged` | yes |
| `merged` | `takedown` | yes |
| `merged` | `active` | only with `explicitManagementOverride` (revert, plan 04) |
| anything else involving `merged` | | no |

Update the file's header comment and
`packages/orm/src/lib/feedLifecycleTransitionValidation.test.ts`.

### Parse and visibility

Treat `merged` like `archived` in both gates:

- `shouldAttemptFeedParseFromLifecycleAndPolicy` in
  [packages/orm/src/lib/feedLifecycleState.ts](packages/orm/src/lib/feedLifecycleState.ts)
- `applyLifecycleConstraintsToComputedPolicy` and
  `applyLifecycleConstraintsToEffectiveFlags` in
  [packages/orm/src/lib/feedEffectivePolicyComputed.ts](packages/orm/src/lib/feedEffectivePolicyComputed.ts)

Extend `feedEffectivePolicyComputed.test.ts`. Management lifecycle option lists that switch on
the enum (`listLifecycleStateOptions`, `toLifecycleStateEnum`, anywhere a new key would fail an
exhaustive switch) must include `merged`. Do not add a management button that sets `merged` by
hand; plan 08 is the only writer besides the apply job.

## Tables

All in `0015_channel_merge.sql`. Greenfield SQL: no `IF NOT EXISTS`, no `ON CONFLICT`. Follow
**linear-sql-greenfield-only**. App database only (not the management migration chain).

### `channel_merge`

One row per Podcast Index feed that was marked a duplicate. Status moves on this row; do not
insert a second row for the same `from_podcast_index_id`.

| Column | Type | Notes |
| --- | --- | --- |
| `id` | integer identity PK | |
| `from_podcast_index_id` | integer NOT NULL | UNIQUE |
| `to_podcast_index_id` | integer NOT NULL | final live survivor, after chains |
| `from_channel_id` | integer NULL | FK `channel(id)` |
| `to_channel_id` | integer NULL | FK `channel(id)`; null in re-point mode |
| `mode` | text NULL | `repoint` or `absorb`; null until verification |
| `status` | text NOT NULL | `detected`, `verified`, `needs_review`, `applied`, `rejected`, `reverted` |
| `confidence` | numeric(5,4) NULL | 0 to 1 |
| `match_stats` | jsonb NOT NULL default `'{}'` | counts per tier, shared identifiers |
| `note` | text NULL | review note or reject reason |
| `created_at` / `updated_at` | `timestamptz` default `now()` | |
| `applied_at` | `timestamptz` NULL | |

Check constraints on `mode` and `status`. Index `(status)` and `(to_podcast_index_id)`.

### `item_merge_map`

Written at verify time for absorb pairs, and at apply time for re-point pairs (old item id to
itself, with the GUID rewrite recorded in the journal).

| Column | Type | Notes |
| --- | --- | --- |
| `id` | integer identity PK | |
| `channel_merge_id` | integer NOT NULL | FK `channel_merge(id)` ON DELETE CASCADE |
| `from_item_id` | integer NOT NULL | FK `item(id)` |
| `to_item_id` | integer NULL | FK `item(id)`; null when unmatched |
| `match_tier` | text NULL | `guid`, `enclosure`, `fuzzy` |

UNIQUE `(channel_merge_id, from_item_id)`.

### `channel_merge_journal`

One row per mutated table row, so revert can undo an apply.

| Column | Type | Notes |
| --- | --- | --- |
| `id` | integer identity PK | |
| `channel_merge_id` | integer NOT NULL | FK ON DELETE CASCADE |
| `table_name` | text NOT NULL | |
| `row_pk` | text NOT NULL | stable primary key as text |
| `action` | text NOT NULL | `insert`, `update`, `delete` |
| `before_json` | jsonb NULL | |
| `after_json` | jsonb NULL | |
| `created_at` | `timestamptz` default `now()` | |

### `podcast_index_dead_feed_sync`

Single row. Stores the CSV validators so the next run can send `If-Modified-Since` /
`If-None-Match`.

| Column | Type |
| --- | --- |
| `id` | smallint PK, check `id = 1` |
| `last_modified` | text NULL |
| `etag` | text NULL |
| `synced_at` | `timestamptz` NULL |

Do not seed the row in SQL. Plan 02 inserts it on first sync.

## ORM

Entities under `packages/orm/src/entities/`, services that only read and upsert these rows under
`packages/orm/src/services/`. Export them from the package index the same way neighboring
entities are exported. No merge SQL in this prompt.

`ChannelMergeStatus` and `ChannelMergeMode` as string enums matching the checks. Use `===`.
No `as` casts.

## Baseline and marker

This prompt's agent runs (not an operator follow-up; these are generated artifacts):

```bash
make db_regen_linear_baseline
make db_verify_linear_baseline
```

Bump `API_EXPECTED_MIGRATION_FILENAME` in `infra/k8s/base/api/source/api.env` from
`0014_billing_strike.sql` to `0015_channel_merge.sql`. Update every other copy of that marker
the migration-readiness skill names. Do not hand-edit the `0004` / `0005` gz files.

## Tests

Unit tests for the new transitions and the policy gate. No API integration test in this prompt.

## Done when

- `merged` blocks parse and public visibility.
- The four tables exist only in `0015`.
- Baseline gz files are regenerated and `db_verify_linear_baseline` was run by the agent.
- `packages/orm` exports the new entities.

## Operator verification

**Root**

```bash
npm run test -w @podverse/orm
```
