# First-deploy squash — execution order

Models and paste fences live in [COPY-PASTA.md](./COPY-PASTA.md). Ledger, areas, and settled
decisions: [00-SUMMARY.md](./00-SUMMARY.md) and [00-REQUEST.md](./00-REQUEST.md).

Three phases. Prompts in one phase edit disjoint files and run at once. No prompt in a phase with
several prompts writes `release-notes/scratchpad.md`; each puts its entry in its final message
under "Release notes entry", and Close appends them all.

## Phase 1 — every plan with no dependency (28 prompts)

Plan 10 runs `scripts/database/squash-linear-migrations.sh --write` and the baseline generator
against a throwaway Postgres, so **Docker must be running** before this phase starts. No other
prompt in the phase edits `scripts/database/**`, `infra/k8s/base/ops/source/**`,
`infra/k8s/base/ops/kustomization.yaml`, or `infra/k8s/base/db/**`.

| Prompt | Owns |
| --- | --- |
| 10 Postgres squash | both chains' `0001_*` and deleted `0002+` files, ops `kustomization.yaml`, `api.env`, `management-api.env`, the two `.gz` baselines, `squash-linear-migrations.sh`, `run-linear-migrations.sh` |
| 11 Migration contract docs | `docs/operations/database/LINEAR-MIGRATIONS.md`, `MANAGEMENT-DATABASE-CONSOLE.md`, `infra/k8s/INFRA-K8S.md`, `.cursor/rules/linear-baseline-0004.mdc`, `.cursor/skills/linear-sql-greenfield-only/SKILL.md` |
| 12 Wipe paths and database tooling | ops `db-drop-everything` / `db-verify-account` / `db-verify-all-account` cronjobs, `Makefile.local.infra.mk`, `Makefile.alpha.infra.mk`, `Makefile.local.validate.mk`, `.github/workflows/ci.yml`, Jenkins `apply-migration.jenkinsfile` |
| 20 Mobile SQLite squash | `apps/mobile/src/data/db/migrations.ts`, `runMigrations.ts`, `migrations.test.ts` |
| 21 Add by RSS open passes | `apps/mobile/src/data/db/index.ts`, `applyAddByRssResourceTypes.ts`, `applyAddByRssPublisherRefs.ts`, `repositories/addByRssRepository.ts` |
| 22 Single queue file write | `apps/mobile/src/data/nativeCache/projection.ts`, `projection.test.ts` |
| 23 Mobile data comments | `apps/mobile/src/data/db/schema.ts`, `src/data/README.md`, `repositories/syncEventLog.test.ts` |
| 30 Unread device prefs | `apps/mobile/src/prefs/prefsStore.ts`, `prefsStore.test.ts`, `prefs/index.ts`, `homeListPrefs.ts`, `homeListPrefs.test.ts` |
| 31 Stored download file name | `apps/mobile/src/downloads/downloadStorage.ts`, `downloadStorage.test.ts`, `downloadManager.ts`, `unsubscribedDownloadChannels.test.ts`, `src/prefs/downloadPrefs.ts`, `src/lib/playback/resolvePlaybackUrl.test.ts`, `PodverseCarPlaySceneDelegate.swift`, `PodverseMediaLibraryService.kt` |
| 32 Native cache library filename | `PodverseNativeCache.swift`, `PodverseNativeCache.kt`, engine `README.md`, `NATIVE-CACHE-SPIKE-IOS.md`, `NATIVE-CACHE-SPIKE-ANDROID.md` |
| 33 Auto download doc | `docs/development/mobile/MOBILE-AUTO-DOWNLOAD.md` |
| 34 Web base URL fallback | `apps/mobile/src/config/env.ts`, `publicWebBaseUrl.test.ts`, `apps/mobile/vitest.config.ts`, `app.config.ts`, `apps/mobile/.env.example` |
| 35 Unused primary queue export | `apps/mobile/src/hooks/usePrimaryQueue.ts` |
| 36 Debug panel citation | `apps/mobile/src/debug/PrimitivesDebugPanel.tsx` |
| 40 API membership env docs | `apps/api/ENV.md` |
| 41 API older-schema comments | `apps/api/src/lib/addByRSSResourceData.ts`, `controllers/account/accountFollowingAddByRSSChannel.ts`, three `apps/api/src/test/*` files |
| 50 Shared package comments | the 24 `packages/*` files plan 50 lists (none under `packages/ui`, `packages/i18n-catalog`, `packages/worker-commands`, or `feedForceReparseScheduler*`) |
| 51 Channel image URL fallback | `packages/parser-mapping/src/addByRSS/reconstruct.ts`, `reconstruct.test.ts` |
| 60 Description backfill command | `apps/workers/**` files plan 60 lists, `apps/workers/package.json`, `apps/workers/ENV.md`, `packages/worker-commands/src/registry.ts`, `infra/k8s/base/cron/kustomization.yaml`, `worker-descriptions-backfill.cronjob.yaml` |
| 61 Workers and infra prose | `verifiedPublisherLinks/backfill.ts`, `APPS-WORKERS.md`, `infra/k8s/K8S.md`, secret-generators doc, Jenkins alpha doc, `check-extensions-migration.sh`, Lighthouse doc |
| 62 Local env upgrade path | `scripts/local-env/setup.sh`, `migrate-local-secrets-to-home.sh`, `local-secrets-lib.sh`, `makefiles/local/Makefile.local.env.mk` |
| 70 Cookie consent shape | `cookieConsentPolicy.ts`, `cookieConsentPolicy.test.ts`, `localSettings.ts`, `localSettings.cc.test.ts` |
| 71 Embed builder type query | `apps/web/src/lib/embed/` files plan 71 lists, `apps/web/e2e/helpers/embedAssertions.ts` |
| 72 Unused UI aliases | `TableOfContents.tsx` + `index.ts`, `CompactFieldRow.tsx` + test, `packages/ui/src/index.ts` |
| 73 Web comments and livestream doc | the 14 files plan 73 lists, including `seedConstants.ts`, `tools/web/seed-e2e.mjs`, `_variables-root.scss` |
| 80 Upgrade-only feature docs | `docs/features/ADD-BY-RSS.md`, `docs/features/POPULARITY-AND-TASTE-PROFILE.md` |
| 81 Aicasts | four `misc/aicasts/*.md` scripts |
| 90 Proposals | three files under `docs/proposals/mobile/_master-plan_/phase-2/details/` |

Pairs that touch neighbouring files and stay disjoint: 21 and 23 (`db/index.ts` vs `db/schema.ts`),
31 and 32 (CarPlay scene delegate and media library service vs `PodverseNativeCache.*`), 30 and
31 (`prefs/index.ts` vs `prefs/downloadPrefs.ts`), 70 and 73 (`localSettings.cc.test.ts` vs the
`sba` / `pmt` / `bae` tests), 71 and 73 (embed test files), 72 and 73 (`packages/ui/src/index.ts`
vs `_variables-root.scss`), 11 and 61 (`INFRA-K8S.md` vs `K8S.md`).

## Phase 2 — cleanups that build on phase 1 (4 prompts)

| Prompt | Runs after | Owns |
| --- | --- | --- |
| 37 Add by RSS stored-row helpers | 21, 34 | `apps/mobile/src/lib/addByRss/storedResourceType.ts` + test, `publisherRefs.ts` + test, `apps/mobile/vitest.config.ts` |
| 38 Native cache single queue kind | 22, 32 | `src/bridge/nativePlaybackBridge.ts`, `src/data/nativeCache/projection.test.ts`, engine `NativePlaybackBridge.ts`, `PodverseMediaEngineModule.ts` / `.swift` / `.kt`, `PodverseNativeCache.swift` / `.kt`, engine `README.md`, both spike docs |
| 52 Description backfill reason | 60 | `packages/orm/src/services/feed/feedForceReparseScheduler.ts`, `feedForceReparseScheduler.test.ts` |
| 82 Docs false after sweeps | 34, 62, 71 | `docs/features/EMBED-PLAYER.md`, `docs/development/env/LOCAL-ENV-OVERRIDES.md`, `.cursor/rules/mobile-deep-links-and-prod-cutover.mdc` |

## Phase 3 — Close (alone)

### Release notes

Append to `release-notes/scratchpad.md`, at the end, unchanged and in this order, the "Release
notes entry" from each final message in `.artifacts/plan-runner/first-deploy-squash/`:
10, 12, 20, 21, 22, 30, 31, 32, 34, 51, 60, 62, 70, 71, 80, 38, 52. When a final message has no
entry, copy that plan's `## Release scratchpad` block from
`.llm/plans/completed/first-deploy-squash/`. Skip an entry whose `##` title is already in the
scratchpad. Never edit another entry.

### Set-wide self-check (read-only)

```bash
rg -n "0031_account_api_key|0004_admin_session" --glob '!release-notes/**' --glob '!.llm/**'
rg -n "writeQueueSnapshot\b|queue-snapshot\.json|library-browse-index" apps/mobile --glob '!node_modules/**'
rg -n "applyAddByRss|storedResourceType|ormDescriptionsBackfill|description_backfill" apps packages infra --glob '!**/node_modules/**'
ls infra/k8s/base/ops/source/database/linear-migrations/app infra/k8s/base/ops/source/database/linear-migrations/management
```

Expected: the first prints nothing; the second prints only `GO-NO-GO.md`; the third prints
nothing; each chain directory lists `0000_init_helpers.sql` and one `0001_*` file. Report any
other hit in the final message. Do not fix product code in Close.

### Archive

Confirm every numbered plan (10–12, 20–23, 30–38, 40–41, 50–52, 60–62, 70–73, 80–82, 90) is in
`.llm/plans/completed/first-deploy-squash/`. If one is still in `active/`, stop and report
BLOCKED naming it. Then move `00-REQUEST.md`, `00-SUMMARY.md`, `00-EXECUTION-ORDER.md`, and
`COPY-PASTA.md` there and remove the empty `.llm/plans/active/first-deploy-squash/` directory.

### Final message

In this order, every command block fish-safe and labeled with its `.vscode/terminals.json` tab:

1. **Cumulative verification**, assuming no earlier prompt was tested. Stop **Dev**, **Workers**,
   and **Mobile E2E API** first. Docker, **Mobile E2E Metro**, **Mobile E2E API**, and
   **Mobile E2E test-assets** must be running before the Mobile Maestro block; restart
   **Mobile E2E API** after the Root block so it runs on the rebuilt test database and packages.
   Plans 31, 32, and 38 change Swift and Kotlin, so the Mobile block prebuilds before the E2E
   installs. Leave-running commands stay out of the blocks.

   Root:

   ```bash
   npm run build:packages
   npm run lint
   npm run type-check
   npm run type-check:mobile
   npm run test:unit
   npm --prefix apps/mobile run test
   bash scripts/database/validate-linear-migrations.sh
   make db_verify_linear_baseline
   kustomize build --load-restrictor LoadRestrictionsNone infra/k8s/base/ops
   kustomize build --load-restrictor LoadRestrictionsNone infra/k8s/base/db
   kustomize build --load-restrictor LoadRestrictionsNone infra/k8s/base/api
   kustomize build --load-restrictor LoadRestrictionsNone infra/k8s/base/management-api
   kustomize build --load-restrictor LoadRestrictionsNone infra/k8s/base/cron
   make test_clean
   make test_deps
   npm run test:e2e:api
   make e2e_test_web_report_spec SPEC=e2e/cookie-consent-enabled.spec.ts,e2e/cookie-consent-disabled.spec.ts,e2e/embed-share-builder.spec.ts,e2e/embed-routes.spec.ts,e2e/embed-responsive-player.spec.ts
   open .artifacts/e2e-reports/latest/index.html
   ```

   Mobile:

   ```bash
   npm run mobile:prebuild
   ```

   Mobile E2E iOS:

   ```bash
   npm run mobile:e2e:ios
   ```

   Mobile E2E Android:

   ```bash
   npm run mobile:e2e:android
   ```

   Mobile Maestro:

   ```bash
   npm run mobile:e2e:test -- hello-world,add-by-rss-artist,library-downloads,settings-downloads
   open .artifacts/mobile-e2e-reports/latest/failures.json
   open .artifacts/mobile-e2e-reports/latest/ios-phone/index.html
   open .artifacts/mobile-e2e-reports/latest/android-phone/index.html
   ```

   If plan 10's final message says the `.gz` baselines were not regenerated, put
   `make db_regen_linear_baseline` first in the Root block.

2. **Database wipe**: copy plan 10's `## Operator wipe for the last prompt` section in full (local
   development, test, and alpha cluster), from
   `.llm/plans/completed/first-deploy-squash/10-postgres-squash.md`. Say that no agent ran any of
   it, and that the alpha steps belong to the first `abcdeploysteps podverse alpha` of the release
   that carries this set.
3. **Mobile reinstall**: copy plan 20's `## Operator reinstall step` section in full.
4. **Notes**: three aicast episodes changed spoken lines and need new audio (plan 81, D24); CarPlay
   and Android Auto reads after plans 32 and 38 are proven only by the operator's car checklists,
   not by Maestro; any hit from the set-wide self-check.
