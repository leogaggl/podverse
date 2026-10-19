# 01 — Schema, DTO, copy

**Cursor model:** Opus 5.5 · **Reasoning:** high

## Summary

Add the account content log and the retire baseline column. Write the copy 06 and 07 will
show. Follow **linear-sql-greenfield-only**, **migration-readiness-marker-sync**, and
**ui-copy-casing**. Decisions: 00-SUMMARY 9 through 12.

Depends on `removed-content-references` being committed, so 0018 is already taken.

## Migration

`infra/k8s/base/ops/source/database/linear-migrations/app/0019_account_content_log.sql`
(next unused number). Greenfield only: no `IF NOT EXISTS`.

`channel.id_text` is `public.nano_id_v2`. `channel.title` is `public.varchar_normal`. Use
those domains. Grant like `0015_channel_merge.sql` grants `podcast_index_dead_feed_sync`.

```sql
ALTER TABLE public.podcast_index_dead_feed_sync
    ADD COLUMN last_retire_eligible_count integer;

CREATE TABLE public.account_content_log (
    id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    account_id integer NOT NULL,
    log_type varchar(32) NOT NULL,
    channel_id_text public.nano_id_v2 NOT NULL,
    channel_title public.varchar_normal,
    reason varchar(32) NOT NULL,
    follow_outcome varchar(32),
    clip_count integer DEFAULT 0 NOT NULL,
    playlist_entry_count integer DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT account_content_log_account_id_fkey
        FOREIGN KEY (account_id) REFERENCES public.account(id) ON DELETE CASCADE,
    CONSTRAINT account_content_log_type_check
        CHECK (log_type IN ('removed_content')),
    CONSTRAINT account_content_log_reason_check
        CHECK (reason IN ('left_directory', 'taken_down')),
    CONSTRAINT account_content_log_follow_outcome_check
        CHECK (
            follow_outcome IS NULL
            OR follow_outcome IN ('ended', 'moved_to_add_by_rss')
        ),
    CONSTRAINT account_content_log_counts_check
        CHECK (clip_count >= 0 AND playlist_entry_count >= 0),
    CONSTRAINT account_content_log_account_type_channel_key
        UNIQUE (account_id, log_type, channel_id_text)
);

CREATE INDEX account_content_log_account_updated_idx
    ON public.account_content_log (account_id, updated_at DESC);
CREATE INDEX account_content_log_updated_at_idx
    ON public.account_content_log (updated_at);
```

Confirm `account(id)` and the role names against `0001_app_schema.sql` and `0015` before
writing the grants. `podverse_app_read_write` gets select, insert, update, delete.
`podverse_app_read` gets select.

Then run, from the repo root:

```bash
make db_regen_linear_baseline
make db_verify_linear_baseline
```

Set the readiness marker to this file's name in `infra/k8s/base/api/source/api.env` and the
`infra/k8s/base/ops/kustomization.yaml` literals. Do not hand-edit the gz files.

## Entities

- `packages/orm/src/entities/channel/podcastIndexDeadFeedSync.ts`: nullable integer
  `last_retire_eligible_count`.
- New `packages/orm/src/entities/account/accountContentLog.ts`. Export it from
  `packages/orm/src/db/entities.ts` and `packages/orm/src/index.ts`. Columns match the table.
  `log_type`, `reason`, and `follow_outcome` are string unions, not free text.

## DTO

`packages/helpers/src/dtos/account/accountContentLog.ts`, exported from the helpers DTO
index:

```ts
export type AccountContentLogType = 'removed_content';
export type AccountContentLogReason = 'left_directory' | 'taken_down';
export type AccountContentLogFollowOutcome = 'ended' | 'moved_to_add_by_rss';

export type DTOAccountContentLog = {
  id: string;
  log_type: AccountContentLogType;
  channel_id_text: string;
  channel_title: string | null;
  reason: AccountContentLogReason;
  follow_outcome: AccountContentLogFollowOutcome | null;
  clip_count: number;
  playlist_entry_count: number;
  updated_at: string;
};
```

`id` is a string because the column is `bigint`. No `account_id`. The API returns only the
signed-in account's rows.

## Copy

Write every key in `originals/` for en-US, es, fr, and el-GR. Do not edit `overrides/`.
English chrome is title case. English sentences are sentence case. es, fr, and el-GR use
each language's own capitalization. Do not copy English title case into those files.

Consumer catalog, `packages/i18n-catalog/consumer/originals/`, under `settings.advanced`:

| Key | en-US |
| --- | --- |
| `advanced` | Advanced |
| `removed_content` | Removed Content |
| `empty` | Nothing in your library was removed in the last 30 days. |
| `left_directory` | {title} is no longer in the directory. |
| `taken_down` | {title} was taken down. |
| `moved_to_add_by_rss` | Your follow was moved to Add by RSS. |
| `follow_ended` | Your follow ended. |
| `clips` | {count} of your clips now show Content Removed. |
| `playlist_entries` | {count} of your playlist entries now show Content Removed. |
| `unknown_show` | A show |

`{title}` and `{count}` stay as next-intl placeholders. "Add by RSS" and "Content Removed"
stay as those product names.

Mobile catalog, `packages/i18n-catalog/mobile/originals/`, namespace `removed_content`.
Repeat the same sentences. Add:

| Key | en-US |
| --- | --- |
| `title` | Removed Content |
| `menu_subtitle` | Shows and items removed from your library |

Use the mobile catalog's existing placeholder style (the same shape as `error_log`).

## Scratchpad

```markdown
## Account content log and retire baseline

- Surfaces: ops (migration), helpers DTO, consumer and mobile catalogs
- Change: account_content_log stores one removed-content row per account per show.
  podcast_index_dead_feed_sync gains last_retire_eligible_count. Copy for Settings Advanced
  and More Advanced is in all four locales.
- Who notices: operators (one migration). Users see nothing until later prompts ship the screens.
- Operator steps: deploy; the API waits for the new marker
```

## Done when

- Both baselines regenerate and verify.
- The unique key is `(account_id, log_type, channel_id_text)`.
- Comments do not cite a plan or a step number.

## Operator verification

**Root**

```bash
npm run build:packages
npm run test -w packages/helpers
npm run test -w packages/orm
kustomize build --load-restrictor LoadRestrictionsNone infra/k8s/base/api
kustomize build --load-restrictor LoadRestrictionsNone infra/k8s/base/ops
```
