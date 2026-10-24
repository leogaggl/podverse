**Cursor model:** Cursor Grok 4.7 · **Reasoning:** high

# 12 — Logical reset paths drop every app schema; database tooling sweep

The app chain creates two schemas, `public` and `listener_identity` (owned by the migrator; holds
`stats_listener`). The three logical reset paths drop only `public`, so `listener_identity`
survives, and re-applying `0001_app_schema.sql` then fails on `CREATE SCHEMA listener_identity`.
This plan makes each reset path drop `listener_identity` too, then cleans backward-looking or
wrong labels in area A's ops manifests, makefiles, and CI, and deletes an unused Jenkins
pipeline that applies SQL outside `linear_migration_history`.

No SQL migration, script under `scripts/database/`, or runner under
`infra/k8s/base/ops/source/database/` changes here. Plan 10 executes those while this plan may be
running.

## Rows

R4, R5, R17, R24

## Runs after

none

## Files

- `infra/k8s/base/ops/db-drop-everything.cronjob.yaml`
- `infra/k8s/base/ops/db-verify-account.cronjob.yaml`
- `infra/k8s/base/ops/db-verify-all-account.cronjob.yaml`
- `makefiles/local/Makefile.local.infra.mk`
- `makefiles/alpha/Makefile.alpha.infra.mk`
- `makefiles/local/Makefile.local.validate.mk`
- `.github/workflows/ci.yml`
- `infra/pipelines/jenkins/database/apply-migration.jenkinsfile`
- `release-notes/scratchpad.md`

## File actions

`apply-migration.jenkinsfile` is deleted (step 7); `release-notes/scratchpad.md` is appended to
(step 8).

## Rules for this plan

- Leave every `# Version: N` header line as it is.
- Comments follow **comments-future-forward**: state the constraint, not the history.
- Do not edit `scripts/database/**`, `infra/k8s/base/ops/source/**`,
  `infra/k8s/base/ops/kustomization.yaml`, or `infra/k8s/base/db/**` (plan 10 owns or executes
  them).
- Delete with `rm`, not `git rm`. No git writes.

## Steps

### 1. `infra/k8s/base/ops/db-drop-everything.cronjob.yaml`

a. Replace the header line
`# DANGER: Drops public schema on both app and management logical databases. Only runs when explicitly triggered.`
with two lines:

```yaml
# DANGER: Drops every schema the linear chains create (app: listener_identity and public; management: public). Only runs when explicitly triggered.
# A migration that creates a new schema must add a DROP SCHEMA for it here, in local_db_reset, and in alpha_db_reset.
```

b. In the container script, change only the app-database `-c` argument (the first `psql` call,
the one using `DB_APP_OWNER_USER` and `DB_APP_NAME`) from
`-c 'DROP SCHEMA public CASCADE; CREATE SCHEMA public;'` to:

```yaml
                    -c 'DROP SCHEMA IF EXISTS listener_identity CASCADE; DROP SCHEMA public CASCADE; CREATE SCHEMA public;'
```

Keep its indentation identical to the line it replaces. The management-database `psql` call is
unchanged. `IF EXISTS` is needed because the job is also the recovery path for a partly migrated
database.

### 2. `makefiles/local/Makefile.local.infra.mk` — `local_db_reset`

a. Change the echo `@echo "Dropping and recreating public schema..."` under `local_db_reset:` to
`@echo "Dropping listener_identity and recreating public schema..."`.

b. In the `docker exec -i podverse_local_db psql -U "$$DB_APP_OWNER_USER" …` line of that target,
change the start of the `-c` string from `"DROP SCHEMA public CASCADE; CREATE SCHEMA public;` to
`"DROP SCHEMA IF EXISTS listener_identity CASCADE; DROP SCHEMA public CASCADE; CREATE SCHEMA public;`.
Keep the rest of the string (the two `GRANT ALL ON SCHEMA public …` statements and the escaped
quotes) exactly as it is.

c. Leave the management reset target (the `podverse_local_db psql -U "$$DB_MANAGEMENT_OWNER_USER"`
line) unchanged; the management chain creates only `public`.

### 3. `makefiles/alpha/Makefile.alpha.infra.mk` — `alpha_db_reset`

Same two edits as step 2a and 2b, on the `alpha_db_reset:` target (`podverse_alpha_db`, app owner
line). Leave the management reset line unchanged.

### 4. `makefiles/local/Makefile.local.validate.mk`

Replace the comment `# Compare generated DB bootstrap 0003 (Docker) with committed files.` with
`# Compare generated 0004_app + 0005_management linear baselines (Docker) with committed files.`
Change nothing else in this file.

### 5. `infra/k8s/base/ops/db-verify-account.cronjob.yaml` and `db-verify-all-account.cronjob.yaml`

Delete line 3 in each, `# UPDATE: Added PGPASSWORD env var to fix 'no password supplied' error.`
Nothing else changes.

### 6. `.github/workflows/ci.yml` — linear baseline labels

The step verifies the `0004`/`0005` gz baselines; its labels name `0003`. Make these exact
replacements and no others:

| Line (today) | From | To |
| --- | --- | --- |
| 79 | `- name: Verify linear baseline 0003` | `- name: Verify linear baselines 0004/0005` |
| 80 | `id: db-baseline-0003` | `id: db-linear-baselines` |
| 173 | `'\| Linear baseline 0003 (vs generator) \| ✅ \|',` | `'\| Linear baselines 0004/0005 (vs generator) \| ✅ \|',` |
| 174 | `'\| Bootstrap init contract (0001/0002/0003/0004) \| ✅ \|',` | `'\| Bootstrap init contract (0001–0005) \| ✅ \|',` |
| 256 | `DB_BASELINE_0003: ${{ steps.db-baseline-0003.outcome }}` | `DB_LINEAR_BASELINES: ${{ steps.db-linear-baselines.outcome }}` |
| 275 | `process.env.DB_BASELINE_0003 === 'failure'` | `process.env.DB_LINEAR_BASELINES === 'failure'` |
| 278 | `'**Linear baseline 0003a/0003b / migration seed 0004:** Regenerate from the repo root, then commit:',` | `'**Linear baselines 0004/0005:** Regenerate from the repo root, then commit:',` |
| 296 | `` `\| Linear baseline 0003 (vs generator) \| ${status(process.env.DB_BASELINE_0003)} \|`, `` | `` `\| Linear baselines 0004/0005 (vs generator) \| ${status(process.env.DB_LINEAR_BASELINES)} \|`, `` |
| 297 | `` `\| Bootstrap init contract (0001/0002/0003/0004) \| ${status(...)} \|`, `` | same line with `(0001–0005)` |

(The `\|` above is table escaping; the file has plain `|`.) After editing, confirm
`rg -n "0003|db-baseline-0003|DB_BASELINE_0003" .github/workflows/ci.yml` prints nothing, and
`rg -n "db-linear-baselines|DB_LINEAR_BASELINES" .github/workflows/ci.yml` shows the step id, the
env line, the failure check, and the summary row all agree.

### 7. Delete `infra/pipelines/jenkins/database/apply-migration.jenkinsfile`

It applies a SQL file with raw `psql`, which skips `linear_migration_history` and its checksums,
and nothing in the repo references it. Confirm first:
`rg -n "apply-migration" --glob '!.llm/**'` prints no reference outside the file itself. If it
prints one, do not delete; report the reference in the final message. If the directory
`infra/pipelines/jenkins/database/` is empty afterward, remove it.

### 8. Release scratchpad

Append the entry below, or put it in the final message when this prompt shares a phase with other
prompts (**release-notes-scratchpad**).

## Self-check

- `rg -n "DROP SCHEMA" infra/k8s/base/ops/db-drop-everything.cronjob.yaml makefiles/local/Makefile.local.infra.mk makefiles/alpha/Makefile.alpha.infra.mk`
  shows `listener_identity` on exactly the three app-database lines and not on the three
  management lines.
- `rg -n "UPDATE:" infra/k8s/base/ops` prints nothing.
- YAML still parses: `ruby -e 'require "yaml"; ARGV.each { |f| YAML.load_file(f) }' infra/k8s/base/ops/db-drop-everything.cronjob.yaml infra/k8s/base/ops/db-verify-account.cronjob.yaml infra/k8s/base/ops/db-verify-all-account.cronjob.yaml .github/workflows/ci.yml`
  or the equivalent with `python3 -c 'import sys, yaml; [yaml.safe_load(open(f)) for f in sys.argv[1:]]' …`
  when PyYAML is available. If neither parser is available, say so in the final message.

## Tests

None added. The reset targets and the CronJob are operator tools with no test harness; the
operator's `kubectl kustomize infra/k8s/base/ops` render and the CI workflow on the PR cover the
manifest and workflow edits.

## Release scratchpad

```markdown
## Database reset paths also drop listener_identity

- Surfaces: ops, k8s, local tooling
- Change: `ops-db-drop-everything` drops the `listener_identity` schema in the app database before
  recreating `public`. `make local_db_reset` and `make alpha_db_reset` do the same. Before this,
  the schema survived a logical wipe and the next app migration run failed on
  `CREATE SCHEMA listener_identity`. The unused Jenkins `database/apply-migration.jenkinsfile`
  pipeline, which applied SQL outside the migration history, is removed.
- Who notices: operators who run a logical wipe (drop, rebootstrap roles, migrate) on a cluster or
  reset a local Docker database.
- Operator steps: none beyond syncing ops; the drop order in INFRA-K8S.md is unchanged.
```
