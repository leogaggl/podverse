**Cursor model:** Cursor Grok 4.7 · **Reasoning:** high

# 01 — Merge feature/realtime-banner-notifications

Follow `00-SUMMARY.md` § Merge step rules. Branch slug for rule 2: `realtime-banner-notifications`.

## Rows

R3, R4, R6

## Runs after

none

## Files

- every file the merge brings in (158 outside `.llm/`)
- `package-lock.json`
- `apps/mobile/package-lock.json`
- `.llm/plans/active/combined-merge-deferred/00-SUMMARY.md` (only when deferring)

## Specifics

- The branch is current with `develop`, so the merge has no textual conflicts. The work is rule 1,
  rule 6, and rule 7.
- Migrations: `app/0022_account_notification_read_at.sql` keeps its number. Confirm
  `API_EXPECTED_MIGRATION_FILENAME=0022_account_notification_read_at.sql` and
  `MANAGEMENT_API_EXPECTED_MIGRATION_FILENAME=0003_billing_permissions.sql`, and that the file is
  listed in `infra/k8s/base/ops/kustomization.yaml`. Run `make db_verify_linear_baseline`; run
  `make db_regen_linear_baseline` first only if verify fails.
- Dependencies: the branch adds `ioredis` to the root lockfile and changes
  `apps/mobile/package.json`, so both installs in rule 6 run.

## Tests

None added. abctestall runs after step 05.

## Release scratchpad

none (the branch's own entries come in with the merge)
