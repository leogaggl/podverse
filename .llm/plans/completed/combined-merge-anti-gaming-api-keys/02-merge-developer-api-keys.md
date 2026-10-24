**Cursor model:** Cursor Grok 4.7 · **Reasoning:** extra high

# 02 — Merge feature/developer-api-keys

Follow `00-SUMMARY.md` § Merge step rules. Branch slug for rule 2: `developer-api-keys`. Read
`.artifacts/plan-runner/combined-merge-anti-gaming-api-keys/01.md` first.

## Rows

R1, R2, R3, R4

## Runs after

01

## Files

- every file the merge brings in (163 outside `.llm/`)
- the six conflicted files and the semantic-check list in `00-SUMMARY.md` § Order for step 02
- `apps/api/src/routes/legal.ts`, `apps/api/src/routes/stats.ts` (or wherever
  `POST /stats/listen` and `POST /stats/open` are mounted), and the account settings route that
  mounts `accountSettingsListenStats` — only to confirm they stay closed to API keys
- `apps/api/src/test/api-key-routes-*.integration.test.ts`
- `package-lock.json`, `apps/mobile/package-lock.json` (only when rule 6 applies)
- `.llm/plans/active/combined-merge-anti-gaming-api-keys-deferred/00-SUMMARY.md` (only when
  deferring)

## Specifics

- Conflicts, resolved per rule 3 and rule 4:
  - `infra/k8s/base/api/source/api.env`: `API_EXPECTED_MIGRATION_FILENAME=0031_account_api_key.sql`.
  - `infra/k8s/base/ops/kustomization.yaml`: both sides' entries; app `0027`–`0031` in numeric
    order, each once, in both the `files` list and the `podverse-ops-migration-scripts` literals.
  - `0004_app_linear_baseline.sql.gz`: `git checkout --ours`, then
    `make db_regen_linear_baseline` and `make db_verify_linear_baseline`.
  - `.cursor/rules/rule-index.mdc`, `release-notes/scratchpad.md`, `scripts/mobile/e2e-test.sh`:
    union of both sides.
- API key route access: read `.cursor/rules/api-key-route-access.mdc` (arrives with this merge).
  Every authenticated route anti-gaming added is on that rule's closed list: listen and open
  reports, the listen-stats consent, and its agreement text (Taste Profile agreement). Confirm
  none of them carries `apiKeyAccess`, none has `x-api-key-permission` or an `apiKeyAuth`
  security entry in `apps/api/openapi.yml`, and each is in the closed-route table of the matching
  `apps/api/src/test/api-key-routes-*.integration.test.ts` when that file keeps a closed table.
  Add a missing row; do not open a route to keys.
- `apps/api/openapi.yml`: both sides' paths and schemas. Run `npm run openapi:check` after
  `lint:fix`.
- `packages/helpers/src/dtos/index.ts`, `packages/helpers/src/index.ts`,
  `packages/orm/src/db/entities.ts`, `packages/orm/src/index.ts`: export and register both sides'
  additions (the `AccountApiKey` entity and anti-gaming's stats entities).
- `apps/management-web/src/lib/managementPermissions.ts`,
  `apps/mobile/src/navigation/index.tsx`, `apps/mobile/src/screens/more/MoreSettingsScreen.tsx`:
  both sides' entries and screens.
- i18n catalogs: union; then `npm run i18n:validate`.

## Tests

`apps/api/src/test/api-key-routes-*.integration.test.ts`: closed-route rows for anti-gaming's
routes when missing. Nothing else added.

## Release scratchpad

none (both branches' entries arrive with the merges)
