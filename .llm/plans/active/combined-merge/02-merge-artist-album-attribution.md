**Cursor model:** Cursor Grok 4.7 · **Reasoning:** extra high

# 02 — Merge feature/artist-album-attribution

Follow `00-SUMMARY.md` § Merge step rules. Branch slug for rule 2: `artist-album-attribution`.

## Rows

R3, R4, R6

## Runs after

01

## Files

- every file the merge brings in (309 outside `.llm/`)
- `apps/workers/ENV.md`
- `infra/k8s/base/api/source/api.env`
- `infra/k8s/base/db/source/bootstrap/0004_app_linear_baseline.sql.gz`
- `infra/k8s/base/db/source/bootstrap/0005_management_linear_baseline.sql.gz`
- `infra/k8s/base/ops/kustomization.yaml`
- `infra/k8s/base/ops/source/database/linear-migrations/app/0023_channel_verified_publisher.sql`
- `release-notes/scratchpad.md`
- `scripts/mobile/e2e-test.sh`
- `apps/mobile/package-lock.json`
- `.llm/plans/active/combined-merge-deferred/00-SUMMARY.md` (only when deferring)

## Specifics

- Expected textual conflicts: the six files in `00-SUMMARY.md` § Order for step 02.
- Renumber `app/0022_channel_verified_publisher.sql` to `app/0023_channel_verified_publisher.sql`
  with `git mv`, then rule 4. Markers after this step:
  `API_EXPECTED_MIGRATION_FILENAME=0023_channel_verified_publisher.sql`,
  `MANAGEMENT_API_EXPECTED_MIGRATION_FILENAME=0003_billing_permissions.sql`. In
  `infra/k8s/base/ops/kustomization.yaml`, both `0022_account_notification_read_at.sql` and
  `0023_channel_verified_publisher.sql` are listed, in number order.
- Mobile SQLite: the branch's version 25 stays 25 (it is the first to add one).
- `scripts/mobile/e2e-test.sh`: keep both sides' flow or area entries.
- Rule 6: the branch changes `apps/mobile/package-lock.json`, so run the mobile install.

## Tests

None added. abctestall runs after step 05.

## Release scratchpad

Update the branch's scratchpad entry if it names `0022_channel_verified_publisher`; otherwise none.
