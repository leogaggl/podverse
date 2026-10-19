# 01 — Schema: slimmed markers

**Cursor model:** Cursor Grok 4.7 · **Reasoning:** high

## Summary

Two nullable timestamps record that an archived row was slimmed, so the pass never scans it
again. Follow **linear-sql-greenfield-only** and **migration-readiness-marker-sync**.

## Migration

`infra/k8s/base/ops/source/database/linear-migrations/app/0017_archived_slimming.sql` (next
unused number):

```sql
ALTER TABLE public.item
    ADD COLUMN archived_slimmed_at timestamp without time zone;

ALTER TABLE public.channel
    ADD COLUMN archived_slimmed_at timestamp without time zone;

CREATE INDEX item_archived_unslimmed_idx
    ON public.item (id)
    WHERE item_flag_status_id = 3 AND archived_slimmed_at IS NULL;
```

`3` is `ItemFlagStatusStatusEnum.Archived`. Add a one-line SQL comment saying so. The channel
pass selects through the feed lifecycle join, and archived shows are few, so the channel column
gets no index.

No `IF EXISTS`, no `ON CONFLICT`, no backfill. Every existing row starts unslimmed, which is
correct.

Then run:

```bash
make db_regen_linear_baseline
make db_verify_linear_baseline
```

Set the readiness marker to `0017_archived_slimming.sql` in both
`infra/k8s/base/api/source/api.env` and the `infra/k8s/base/ops/kustomization.yaml` literals.

## ORM

- `packages/orm/src/entities/item/item.ts`: `archived_slimmed_at?: Date | null`,
  `@Column({ type: 'timestamp', nullable: true })`.
- `packages/orm/src/entities/channel/channel.ts`: the same.

Do not add them to any DTO. They are internal.

## Scratchpad

```markdown
## Archived episodes and shows record when they were slimmed

- Surfaces: ops (migration)
- Change: New nullable item.archived_slimmed_at and channel.archived_slimmed_at, plus a partial
  index on unslimmed archived items. No behavior change on its own.
- Who notices: operators (one migration)
- Operator steps: deploy; the API waits for the new marker
```

## Done when

- Both baselines regenerate and verify.
- Both markers name the new file.
- Comments must not cite this plan or any plan number.

## Operator verification

**Root**

```bash
npm run build:packages
npm run test -w packages/orm
kustomize build --load-restrictor LoadRestrictionsNone infra/k8s/base/api
kustomize build --load-restrictor LoadRestrictionsNone infra/k8s/base/ops
```
