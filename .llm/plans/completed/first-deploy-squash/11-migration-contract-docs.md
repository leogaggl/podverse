**Cursor model:** Cursor Grok 4.7 · **Reasoning:** medium

# 11 — Migration contract docs and guidance after the squash

Make the migration docs, the K8s ops doc, and the two migration guidance files true after plan 10
squashes both Postgres chains to `0000` + `0001` and plan 12 makes the logical reset paths drop
`listener_identity`. Prose only: no SQL, scripts, manifests, or code.

## Rows

R4, R8, R24

## Runs after

none

## Files

- `docs/operations/database/LINEAR-MIGRATIONS.md`
- `docs/operations/database/MANAGEMENT-DATABASE-CONSOLE.md`
- `infra/k8s/INFRA-K8S.md`
- `.cursor/rules/linear-baseline-0004.mdc`
- `.cursor/skills/linear-sql-greenfield-only/SKILL.md`

## Rules for this plan

- Write future-forward (**comments-future-forward**): describe the system as it stands. No "was",
  "previously", "now", "no longer", or "after the squash we removed".
- Do not name the plan, the set, or a row number in any file.
- Change only the passages listed below. Do not reflow or reformat other paragraphs, and do not
  run Prettier.
- Do not touch `docs/operations/database/DB-MIGRATIONS.md`,
  `docs/operations/database/MANAGEMENT-DATABASE-CONSOLE-ROLLOUT.md`, or any file outside § Files.

## Steps

### 1. `docs/operations/database/LINEAR-MIGRATIONS.md`

a. Replace the line `Each database uses two files after pre-release squash:` with:

```markdown
Each chain starts with two files; later schema changes append `0002_*.sql`, `0003_*.sql`, and so on:
```

Keep the two bullets that follow it unchanged.

b. Replace the whole `## Pre-release squash (consolidating many migrations)` section (from that
heading down to, not including, `## Migration history metadata`) with:

````markdown
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
````

c. In `## Operating model`, leave the three bullets as they are.

### 2. `docs/operations/database/MANAGEMENT-DATABASE-CONSOLE.md`

Replace the `## Database Migrations` table (header row, separator, and the three rows that cite
`management/0002_admin_account_permissions.sql`, `management/0003_database_audit_log.sql`, and
`app/0017_feed_flag_status_reason.sql`) with:

```markdown
| File                                                                                    | Description                                                                         |
| --------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| `infra/k8s/base/ops/source/database/linear-migrations/management/0001_management_schema.sql` | `admin_account_permissions` (admin CRUD permissions) and `database_audit_log` (console writes) |
```

Do not edit the allowlist table or any other section of this file.

### 3. `infra/k8s/INFRA-K8S.md`

a. Delete the `### Workers bucket secret rename (from `podverse-workers-digital-ocean-opaque`)`
heading, the paragraph under it, and its three numbered steps. Keep the line
`Push to the Argo CD–tracked branch so the cluster can sync.` directly after the secret-generator
code block above it.

b. In `### Ops: drop schema, full bootstrap prep, then migrate`, replace the first sentence:

> runs `DROP SCHEMA public CASCADE; CREATE SCHEMA public;` against **both** the app database
> (`DB_APP_NAME`) and the management database (`DB_MANAGEMENT_NAME`), using each database’s owner
> credentials from `podverse-db-opaque` and `podverse-management-db-opaque`.

with:

> drops the `listener_identity` schema and recreates an empty `public` schema in the app database
> (`DB_APP_NAME`), and recreates an empty `public` schema in the management database
> (`DB_MANAGEMENT_NAME`), using each database’s owner credentials from `podverse-db-opaque` and
> `podverse-management-db-opaque`.

Keep the link to `db-drop-everything.cronjob.yaml` at the start of the sentence. Leave the rest of
the section unchanged.

c. Replace the bullet
`If an older encrypted Secret is missing keys the generators now emit, prefer re-running the matching **`create_*`** script …`
with:

```markdown
- If an encrypted Secret lacks a key its generator emits, prefer re-running the matching **`create_*`** script (see [INFRA-K8S-SCRIPTS-SECRET-GENERATORS.md](scripts/secret-generators/INFRA-K8S-SCRIPTS-SECRET-GENERATORS.md)); merge with **`sops`** only when you must preserve unrelated material.
```

d. Replace the bullet
`- **Do not** add `infra/k8s/` back to `.prettierignore` (it was previously ignored but now uses overrides)`
with:

```markdown
- **Do not** add `infra/k8s/` to `.prettierignore`; K8s files are formatted with their own overrides
```

### 4. `.cursor/rules/linear-baseline-0004.mdc`

a. Replace the `**Pre-release squash:**` bullet with:

```markdown
- **Pre-release squash:** Use `scripts/database/squash-linear-migrations.sh --write` to regenerate consolidated `0001_*_schema.sql` from the multi-file chain (do not concatenate evolutionary migrations by hand). A squash changes `0001`'s checksum, so it ships only with a wipe of every database. See docs/operations/database/LINEAR-MIGRATIONS.md.
```

b. In the next bullet, change `(for example `0003_...sql`)` to `(for example `0002_...sql`)`.
Leave the rest of that bullet unchanged.

### 5. `.cursor/skills/linear-sql-greenfield-only/SKILL.md`

In the bullet that starts `For post-squash evolution`, change `(for example `0003_...sql`)` to
`(for example `0002_...sql`)`. Nothing else in the file changes.

## Self-check

- `rg -n "previously|no longer|0003_\.\.\.sql|0017_feed_flag|0002_admin_account_permissions|digital-ocean-opaque" docs/operations/database/LINEAR-MIGRATIONS.md docs/operations/database/MANAGEMENT-DATABASE-CONSOLE.md infra/k8s/INFRA-K8S.md .cursor/rules/linear-baseline-0004.mdc .cursor/skills/linear-sql-greenfield-only/SKILL.md`
  prints nothing.
- Every path cited in the new text exists, except the `0002_*.sql` examples, which name the next
  file to be written.

## Tests

None. Docs and guidance only.

## Release scratchpad

none
