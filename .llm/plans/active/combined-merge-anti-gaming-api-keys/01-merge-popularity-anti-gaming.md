**Cursor model:** Cursor Grok 4.7 · **Reasoning:** extra high

# 01 — Merge feature/popularity-anti-gaming

Follow `00-SUMMARY.md` § Merge step rules. Branch slug for rule 2: `popularity-anti-gaming`.

## Rows

R1, R2, R4

## Runs after

none

## Files

- every file the merge brings in (220 outside `.llm/`)
- `infra/k8s/base/api/source/api.env`
- `infra/k8s/base/ops/kustomization.yaml`
- `infra/k8s/base/db/source/bootstrap/0004_app_linear_baseline.sql.gz`
- `package-lock.json`, `apps/mobile/package-lock.json` (only when rule 6 applies)
- `.llm/plans/active/combined-merge-anti-gaming-api-keys-deferred/00-SUMMARY.md` (only when
  deferring)

## Specifics

- The merge has no textual conflicts. The branch was cut from the current `feature/combined`
  tip, so its baseline `.gz` and markers should already match. Confirm, do not assume:
  `API_EXPECTED_MIGRATION_FILENAME=0030_stats_all_time_recount.sql`, app `0027`–`0030` listed in
  `infra/k8s/base/ops/kustomization.yaml`, then `make db_verify_linear_baseline`. Run
  `make db_regen_linear_baseline` only when verify fails.
- The branch renames "popularity tracking" to "Taste Profile" in copy and rules. After
  `lint:fix`, grep the merged tree for i18n keys the branch removed or renamed
  (`git diff HEAD --stat -- packages/i18n-catalog`) and for callers that still use an old key.
  Fix callers to the new key.
- Every route the branch adds or changes (`apps/api/src/routes/legal.ts`,
  `apps/api/src/controllers/stats/statsListen.ts`, `statsOpen.ts`,
  `accountSettings/accountSettingsListenStats.ts`, `legal/tasteProfileAgreement.ts`) keeps its
  authentication and rate-limit wrappers as the branch wrote them.

## Tests

None added. `lint:fix` type-checks the tests the branch brought.

## Release scratchpad

none (the branch's own entries arrive with the merge)
