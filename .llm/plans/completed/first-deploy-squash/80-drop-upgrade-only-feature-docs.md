**Cursor model:** Cursor Grok 4.7 · **Reasoning:** medium

# 80 — Drop upgrade-only steps from feature docs

A first deploy has no older v5 database. Two feature docs still tell an operator to repair one.
Remove those steps. Leave every other doc in this area as it stands.

## Rows

R15

## Runs after

none

## Files

- docs/features/ADD-BY-RSS.md
- docs/features/POPULARITY-AND-TASTE-PROFILE.md

## Tests

none

## Release scratchpad

```markdown
## Feature docs drop one-time schema repair steps

- Surfaces: docs
- Change: Add by RSS no longer says migration `0012_add_by_rss_client_credentials.sql` made
  people re-enter credentials. Popularity no longer says to run `ops-db-rebootstrap-roles`
  before `ops-db-migrate-app` on a database created before the migrator had `CREATE`. A new
  deployment still starts `statsEventPartitionsMaintain` once by hand so dated partitions exist.
- Who notices: operators reading those feature docs
- Operator steps: none
```

## Edits

### `docs/features/ADD-BY-RSS.md`

Under `### requires_credentials`, delete this paragraph and the blank line that follows it:

```markdown
Linear migration `0012_add_by_rss_client_credentials.sql` dropped the encrypted columns and set the flag on every row that had them, so those users enter credentials again on each device.
```

The four bullets above it are the current rules. Keep them. Keep the key-rotation paragraph
under `### Environment` (`No data migration is involved` is the transit-key rotation, which
stays).

### `docs/features/POPULARITY-AND-TASTE-PROFILE.md`

Replace the whole subsection `### The Migrator Creates the Schema` (the two paragraphs and the
`bash` block, through "Wait for the first job to finish before starting the second.") with:

```markdown
### Schema Ownership

`listener_identity` is created with the app schema. The app migrator role applies that schema
and needs `CREATE` on the app database. DB bootstrap grants it.
```

In `### Partitions and Retention Job`, replace the **Schedule** bullet with:

```markdown
- **Schedule:** the CronJob `worker-stats-event-partitions` in `infra/k8s/base/cron` runs it daily
  at 03:30. On a new deployment, start it once by hand before the first listens arrive so dated
  partitions exist. After that, the daily run keeps the current month and the next two.
```

Leave the **Manual run** and **Local development** bullets as they are. The job still creates
month partitions; `0025_popularity_tracking_foundation.sql` defines the ensure/drop functions and
does not create the current month's partitions, and the squash keeps those functions inside
`0001_app_schema.sql`.

## Leave unchanged

These were read and stay. Do not edit them.

- `docs/QUICKSTART.md` — "applies linear migrations" and the database troubleshooting section
  stay true after the chains are `0000` + `0001`.
- `docs/development/AGENTS-REFERENCE.md` — the DDL source of truth is still
  `infra/k8s/base/ops/source/database/linear-migrations/`.
- `docs/operations/deploy/ALPHA-DEPLOYMENT.md` — no migration filename and no upgrade-only
  procedure.
- `docs/development/k8s/REMOTE-K8S-GITOPS.md` — the sentence that a migration squash or baseline
  rename drops and recreates the DB PVC is still the operator step.
- `docs/RSS-ARCHIVE-DELETE-LIFECYCLE.md` — the source line points at the app linear-migrations
  directory, which remains.
- `docs/billing/BILLING.md` and `docs/billing/BILLING-OPERATIONS.md` — `migration_baseline` is a
  current grant source, and the v4 membership carryover is the previous app, which stays.
- `docs/image-shrinking/**` — the image-shrink backfill is the periodic job for images that are
  not resized yet, including new rows.
- `docs/operations/database/**`, `docs/development/mobile/**`, and `docs/proposals/**` — other
  areas own those trees.
- `extensions/**` — no migration or upgrade-only docs.
