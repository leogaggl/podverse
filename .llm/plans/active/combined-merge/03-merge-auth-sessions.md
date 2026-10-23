**Cursor model:** Cursor Grok 4.7 · **Reasoning:** extra high

# 03 — Merge feature/auth-sessions

Follow `00-SUMMARY.md` § Merge step rules. Branch slug for rule 2: `auth-sessions`.

## Rows

R3, R4, R6

## Runs after

02

## Files

- every file the merge brings in (244 outside `.llm/`)
- `apps/api/src/lib/auth/index.ts`
- `apps/api/src/test/helpers/index.ts`
- `apps/workers/ENV.md`
- `infra/k8s/base/api/source/api.env`
- `infra/k8s/base/management-api/source/management-api.env`
- `infra/k8s/base/db/source/bootstrap/0004_app_linear_baseline.sql.gz`
- `infra/k8s/base/db/source/bootstrap/0005_management_linear_baseline.sql.gz`
- `infra/k8s/base/ops/kustomization.yaml`
- `infra/k8s/base/ops/source/database/linear-migrations/app/0024_account_session.sql`
- `infra/k8s/base/ops/source/database/linear-migrations/management/0004_admin_session.sql`
- `release-notes/scratchpad.md`
- `scripts/mobile/e2e-test.sh`
- `.llm/plans/active/combined-merge-deferred/00-SUMMARY.md` (only when deferring)

## Specifics

- The branch is 14 commits behind `develop`; those commits are already on `combined`. Where a
  conflict is between the branch and a newer `develop` change, keep the `develop` change and
  re-apply the branch's intent on top.
- Expected textual conflicts: the nine files in `00-SUMMARY.md` § Order for step 03.
- `apps/api/src/lib/auth/index.ts` and `apps/api/src/test/helpers/index.ts`: export everything
  both sides export. Sessions replace or wrap token handling on the branch; if realtime
  notifications (step 01) authenticates its stream with a helper the branch changed, make the
  stream use the branch's session-aware helper and keep the stream's behavior. Grep callers of
  every renamed or re-signed export with `rg -n '<export>' apps packages` and update them.
- Renumber `app/0022_account_session.sql` to `app/0024_account_session.sql` with `git mv`.
  `management/0004_admin_session.sql` keeps its number. Rule 4, then markers:
  `API_EXPECTED_MIGRATION_FILENAME=0024_account_session.sql`,
  `MANAGEMENT_API_EXPECTED_MIGRATION_FILENAME=0004_admin_session.sql`. The kustomization lists
  `0022`, `0023`, `0024` for app and `0004_admin_session.sql` for management. `make
  db_regen_linear_baseline` regenerates both `0004_` and `0005_` archives.
- Anything about session security you are unsure of (token lifetime, revocation, which helper a
  route should use) is a deferred entry, never a guess left silent.

## Tests

None added. abctestall runs after step 05.

## Release scratchpad

Update the branch's scratchpad entry if it names `0022_account_session`; otherwise none.
