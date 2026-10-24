# Podverse linear migrations contract

## Canonical migration directories

Podverse forward-only SQL migration files are canonical in:

- `infra/k8s/base/ops/source/database/linear-migrations/app` (app database)
- `infra/k8s/base/ops/source/database/linear-migrations/management` (management database)

Each chain starts with two files; later schema changes append `0002_*.sql`, `0003_*.sql`, and so on:

- `0000_init_helpers.sql` — shared domains and helper functions
- `0001_app_schema.sql` or `0001_management_schema.sql` — full schema and reference data

Bootstrap-only DB/user setup scripts live in:

- `infra/k8s/base/db/source/bootstrap` (`0001_*.sh`, `0002_*.sh`, `0003_apply_linear_baselines.sh`, generated `0004_*` / `0005_*`)

## Generated init snapshots `0004_app_linear_baseline.sql.gz` and `0005_management_linear_baseline.sql.gz`

- After `0001` and `0002` (role and database creation), **`0003_apply_linear_baselines.sh`** runs in `docker-entrypoint-initdb` order. It installs required extensions as **`DB_APP_OWNER_USER`** (app DB) and **`DB_MANAGEMENT_OWNER_USER`** (management DB), then loads **`0004_*.sql.gz`** into the app database as **`DB_APP_MIGRATOR_USER`** and **`0005_*.sql.gz`** into the management database as **`DB_MANAGEMENT_MIGRATOR_USER`** (archives are mounted under `/linear-baseline/`, not as raw `.sql.gz` in `docker-entrypoint-initdb.d`, so Postgres does not apply both as the bootstrap superuser).
- Uncompressed content matches running the full linear app and management migration chains in a throwaway container, then **`pg_dump --no-owner --exclude-table-data=linear_migration_history`** of each database, with deterministic `linear_migration_history` inserts appended from migration filenames and checksums (two files, no combined `\connect` artifact). These files are **not** hand-edited.
- **Regenerate** after any change under `infra/k8s/base/ops/source/database/linear-migrations/` from the repo root:

  `make db_regen_linear_baseline` (Docker for `0004`/`0005`; uses synthetic credentials from `scripts/database/db.generate-baseline.env` only). Then `make db_verify_linear_baseline` and commit the updated `0004_` and `0005_` files.

- **Do not** edit `0004`/`0005` manually. A maintainer **`/test` comment** on a pull request runs the same `verify` step; merge only after baselines match. The linear `NNNN_*.sql` files remain the **source of truth**; `0004`/`0005` are materialized snapshots for first-start init and drift checks.

## Pre-release squash (consolidating many migrations)

A squash folds every file after `0000` into a regenerated `0001_*_schema.sql`. It changes the
checksum of `0001`, so every database built from the previous chain stops at
`run-linear-migrations.sh` with a checksum mismatch. Squash only when every Podverse database
(local dev, test, Lighthouse, and every cluster) can be dropped and recreated.

Do **not** concatenate old evolutionary migration files by hand (DROP/RENAME steps would break). Use:

```bash
bash scripts/database/squash-linear-migrations.sh        # write trial output under .artifacts/
bash scripts/database/squash-linear-migrations.sh --write  # replace 0001_*_schema.sql
make db_regen_linear_baseline
make db_verify_linear_baseline
```

Then, in the same change:

1. Delete every `NNNN_*.sql` after `0001` in both chains (keep only `0000` and `0001` per database).
2. List only `0000` and `0001` per chain in `infra/k8s/base/ops/kustomization.yaml`.
3. Set the readiness markers `API_EXPECTED_MIGRATION_FILENAME=0001_app_schema.sql` and
   `MANAGEMENT_API_EXPECTED_MIGRATION_FILENAME=0001_management_schema.sql` in the ops
   kustomization literals, `infra/k8s/base/api/source/api.env`, and
   `infra/k8s/base/management-api/source/management-api.env` (see
   `.cursor/skills/migration-readiness-marker-sync/SKILL.md`).
4. Compare the regenerated `0004`/`0005` baselines with the ones generated from the previous
   chain. Only the `linear_migration_history` rows and that table's sequence `setval` may differ.

`pg_dump` output keeps `COMMENT ON` text but not `--` comments, so comments in the folded files do
not survive. Constraints that must outlive a squash belong in Cursor rules, docs, or
`COMMENT ON`.

### Wiping databases after a squash

- **Local dev:** `make local_clean`, `make local_infra_up`, `make local_db_init`, then
  `make local_management_superuser_create`.
- **Test and E2E:** `make test_clean`, then `make test_deps` (`test_deps` also recreates both test
  databases on every run).
- **Lighthouse:** nothing; its database is recreated on every run.
- **Clusters:** pin the release that carries the squash first, so Postgres init loads the new
  `0004`/`0005` archives. Then delete the Postgres volume (`db-data-podverse-db-0`; app and
  management share it) and let `docker-entrypoint-initdb.d` run again. Restart the Deployments so
  Valkey, which has no volume, starts empty. Then recreate the management superuser, billing rows,
  and seeded content. Overlays that override a readiness marker must point it at the `0001` file.

A logical wipe (`ops-db-drop-everything`, `make local_db_reset`, `make alpha_db_reset`) drops
`public` and every other schema the app chain creates (`listener_identity`). A migration that
creates a new schema must add it to all three.

## Migration history metadata

Both app and management schemas include `linear_migration_history` with:

- `migration_filename` (unique)
- `migration_checksum`
- `applied_at`

## linear_migration_history seeding model

- `0004`/`0005` carry deterministic `linear_migration_history` rows directly, so fresh init has checksums aligned with `run-linear-migrations.sh`.
- Regeneration remains `make db_regen_linear_baseline`; CI parity remains `make db_verify_linear_baseline`.

## Greenfield-only migration SQL

Author each `NNNN_*.sql` as an **ordered forward chain**: assume every earlier file in the same database chain has already run. Avoid `CREATE … IF NOT EXISTS`, `DROP … IF EXISTS`, seed `ON CONFLICT`, and `WHERE NOT EXISTS` inserts unless a predecessor migration genuinely leaves the object or row presence ambiguous. Catalog-probing `DO $$ …` upgrade branches should not replace clear DDL in prior files. Cursor guidance: `.cursor/skills/linear-sql-greenfield-only/SKILL.md`.

## Operating model

- First deploy on a brand-new DB runs init scripts in order (`0001` → `0002` → `0003_apply` + archives), then (if needed) migration jobs for app and management; with baselines in place, migration jobs should find all files already applied and **skip** them.
- Subsequent deploys rerun the same jobs; already-applied migrations are skipped via checksum-tracked history.
- There is no existing-database baseline onboarding flow in this model.
