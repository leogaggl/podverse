**Cursor model:** Cursor Grok 4.7 · **Reasoning:** medium

# Rewrite upgrade-only prose in workers, cron comments, and infra docs

Comments and docs in this area that describe upgrading an older v5 database, an older Secret name, or an older file layout. The code they sit next to stays.

Do not edit `infra/k8s/INFRA-K8S.md` (area A), `docs/**` (other areas), `release-notes/**`, or `packages/orm/**`. Do not remove `ormVerifiedPublisherLinksBackfill`, `imageShrinkBackfill`, or `billingImportLegacyMembershipExpiry`.

## Rows

R13, R29

## Runs after

none

## Files

apps/workers/src/commands/orm/verifiedPublisherLinks/backfill.ts
apps/workers/APPS-WORKERS.md
infra/k8s/K8S.md
infra/k8s/scripts/secret-generators/INFRA-K8S-SCRIPTS-SECRET-GENERATORS.md
infra/pipelines/jenkins/alpha/PIPELINES-JENKINS-ALPHA.md
scripts/development/extensions/check-extensions-migration.sh
tools/web-perf/lighthouse/TOOLS-WEB-PERF-LIGHTHOUSE.md

## Tests

none

## Release scratchpad

none

## Edits

### Verified publisher backfill comment

In `backfill.ts`, the JSDoc on `ormVerifiedPublisherLinksBackfill` says "Run once after the verified publisher migration, and any time links look stale." Replace that sentence. The rest of the comment stays true: the command recomputes links from stored references, a channel whose rows already match is unchanged, and `-afterId` resumes after the last channel id of a finished batch.

Replacement sentence: "Use it when a parse failed to recompute links or the stored links look stale."

Do not change the SQL, the flags, the cron YAML, or the registry entry. The cron comment ("Manual ops only… each channel is recomputed from stored references") does not cite a migration. Leave it.

### Workers checklist

In `apps/workers/APPS-WORKERS.md`, under "K8s / GitOps checklist", replace item 4. It says existing clusters apply the latest linear migration with ops migrate jobs, and fresh PVC bootstrap uses `0004_app_linear_baseline.sql.gz`.

Replacement:

```markdown
4. A fresh database is created from the regenerated baselines
   `0004_app_linear_baseline.sql.gz` and `0005_management_linear_baseline.sql.gz`.
   Readiness is `0001_app_schema.sql` and `0001_management_schema.sql`.
```

Leave the local smoke command `bash scripts/database/run-linear-migrations.sh --database app`. That runner still applies the chain, which after the squash is `0000` plus `0001`.

### K8s formatting note

In `infra/k8s/K8S.md`, the bullet that says do not add `infra/k8s/` back to `.prettierignore` ends with "it was previously ignored but now uses overrides". Replace the whole bullet with:

- **Do not** add `infra/k8s/` to `.prettierignore`. K8s files use the k8s Prettier overrides.

### Secret generator doc

In `INFRA-K8S-SCRIPTS-SECRET-GENERATORS.md`, delete only the upgrade sentences. Keep the current Secret names and the commands.

- On the `create_workers_storage_bucket_secret.sh` bullet, delete the sentence that starts "If you previously used `podverse-workers-garage-opaque`". End the bullet at the `BUCKET-PROVIDERS.md` reference.
- Delete the paragraph that starts "If you still have an older layout at `secrets/<namespace>/github-registry-secret.enc.yaml`".
- On the Argo CD naming paragraph, delete the sentence that starts "Older fixed names (e.g. `github-repo-creds`)".

### Jenkins alpha note

In `PIPELINES-JENKINS-ALPHA.md`, under "Full teardown and rebuild", delete the sentence "These two jobs replace the manual one-time clean-slate procedure (wipe DB data, re-init both DBs) documented elsewhere." The two bullets above it already say what `alpha_teardown_all` and `alpha_rebuild_all` do. Leave the jobs.

### Extensions check script

`scripts/development/extensions/check-extensions-migration.sh` is unreferenced. Keep the script. Its check is still the right constraint: `prom-client` is not a dependency of the main apps, and the extensions K8s base builds.

- Replace the header comment with: "Checks that prom-client is not a dependency of the main apps, and that the extensions K8s base builds."
- Replace the final echo `Extensions migration checks passed.` with `Extensions checks passed.`

Do not add a caller.

### Lighthouse troubleshooting

In `TOOLS-WEB-PERF-LIGHTHOUSE.md`, under "Database connection fails", delete the sentence that starts "If you previously had generic `read` / `read_write` roles" and tells the reader to `docker compose … down -v` once. Keep the sentences that name the current roles (`podverse_app_read`, `podverse_app_read_write`) and `0001_create_app_db_users.sh`. Keep the `run-linear-migrations.sh --database app` example. Those are the current reset path, not an older chain.

## Leave in place

These mentions were checked and stay:

- `apps/workers/ENV.md` section "v4 membership expiry". v4 import stays. Plan 60 edits a different sentence in that file.
- `tools/management-web/seed-e2e.mjs` says admin roles are seeded by migration. Reference data still comes from `0001_management_schema.sql`.
- `tools/qa/docs/faker/**` describes keeping faker aligned with entities. It does not name an old migration file.
- `infra/k8s/base/workers/source/workers.env` "older than this" lines are retention windows.
- `release-notes/5.5.3.md` mentions `worker-descriptions-backfill`. That file is the note for that version. Do not edit it.
