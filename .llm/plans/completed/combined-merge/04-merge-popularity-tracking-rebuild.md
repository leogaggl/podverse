**Cursor model:** Cursor Grok 4.7 · **Reasoning:** extra high

# 04 — Merge feature/popularity-tracking-rebuild

Follow `00-SUMMARY.md` § Merge step rules. Branch slug for rule 2: `popularity-tracking-rebuild`.

## Rows

R3, R4, R6

## Runs after

03

## Files

- every file the merge brings in (282 outside `.llm/`)
- the 17 files in `00-SUMMARY.md` § Order for step 04
- `infra/k8s/base/db/source/bootstrap/0005_management_linear_baseline.sql.gz`
- `infra/k8s/base/ops/source/database/linear-migrations/app/0025_popularity_tracking_foundation.sql`
- `infra/k8s/base/ops/source/database/linear-migrations/app/0026_drop_legacy_stats.sql`
- `infra/k8s/base/ops/source/database/runner/rebootstrap-full-bootstrap.sh`
- `package-lock.json`
- `.llm/plans/active/combined-merge-deferred/00-SUMMARY.md` (only when deferring)

## Specifics

- The branch is 14 commits behind `develop`; keep newer `develop` changes and re-apply the
  branch's intent on top, as in step 03.
- Renumber with `git mv`: `app/0022_popularity_tracking_foundation.sql` to
  `app/0025_popularity_tracking_foundation.sql`, and `app/0023_drop_legacy_stats.sql` to
  `app/0026_drop_legacy_stats.sql`. Rule 4, then markers:
  `API_EXPECTED_MIGRATION_FILENAME=0026_drop_legacy_stats.sql`,
  `MANAGEMENT_API_EXPECTED_MIGRATION_FILENAME=0004_admin_session.sql`. Update
  `rebootstrap-full-bootstrap.sh` if it names either old file.
- `0026_drop_legacy_stats.sql` drops the legacy stats objects. Before you keep it, grep the merged
  tree (`rg -n` on each dropped table and column name, in `apps`, `packages`, `tools`, and the
  migrations `0022`–`0024`) for code from steps 01–03 that still reads them. Move such code to
  the branch's new popularity services. When the right replacement is unclear, defer it with the
  file and the query.
- Mobile SQLite: the branch's version 25 becomes 26 in `apps/mobile/src/data/db/migrations.ts`,
  placed after artist/album's 25. Update `migrations.test.ts` expectations and any schema version
  constant in `apps/mobile/src/data/db/schema.ts`. Follow **dto-changes-are-device-data-migrations**.
- `packages/helpers/src/dtos/index.ts`: export both sides' DTOs.
- `apps/api/src/routes/account.ts` and `SettingsAccount.tsx`: keep the auth-session routes and UI
  from step 03 and the popularity additions; neither replaces the other.
- `eslint.config.mjs`: the branch adds listener-id separation rules; keep them with every other
  side's rules. When a new rule flags code from steps 01–03, fix that code to satisfy the rule; do
  not disable the rule.
- `infra/k8s/base/cron/kustomization.yaml`, `tools/web/seed-e2e.mjs`,
  `apps/workers/src/lib/startup/categoriesForCommand.test.ts`: union of both sides.

## Tests

`apps/mobile/src/data/db/migrations.test.ts` follows the renumbered version. Nothing else added.

## Release scratchpad

Update the branch's scratchpad entries if they name `0022_popularity_tracking_foundation` or
`0023_drop_legacy_stats`; otherwise none.
