# Popularity Tracking rebuild — execution order

Prompts and models: [COPY-PASTA.md](COPY-PASTA.md). Request and settled review answers:
[00-REQUEST.md](00-REQUEST.md). Ledger, decisions, and deferred work: [00-SUMMARY.md](00-SUMMARY.md).

Phases run one after another. Prompts inside one phase run at once and own disjoint files. No
prompt except the last writes `release-notes/scratchpad.md`; each puts its entry in its final
message under "Release notes entry", and prompt 19, which runs alone last, appends them all.

Docker must be running for phase 1 and phase 12: plans 10 and 19 regenerate the linear baseline
archives.

## Why twelve phases

Ten plans edit `packages/orm/src/index.ts` and ten edit `docs/features/POPULARITY-TRACKING.md`.
Between them, plans 10, 31, 41, 70, 71, 42, 50, 72, 51, and 83 each need a phase of their own on
those two files, plan 11 must follow plan 10, and plan 19 must follow every caller move. Everything
else fits around that spine.

## Dependency graph

From each plan's `## Runs after`. Rows marked "ordering" also wait for a plan because Close chose
that order for a shared file or helper.

| Plan | Runs after |
| --- | --- |
| 10 schema foundation | none |
| 11 ORM entities and range helper | 10 |
| 12 listener-id separation guard | none |
| 19 remove legacy stats, closes the set | 10, 11, 32, 42, 43, 50, 51, 60, 61, 83 |
| 20 explanation text and version | none |
| 21 terms section | none |
| 30 counted-listen rule helper | none |
| 31 listen and open write services | 10, 11, 30 |
| 32 listen and open API | 31 |
| 40 retention setting 90 days | none |
| 41 event partitions job | 10, 40 |
| 42 popularity refresh job | 10, 11, 41 |
| 43 dev seed daily totals | 11, 42 |
| 50 public popularity readers | 10, 11 |
| 51 channel merge popularity data | 10, 11, 30, 42, 50 |
| 60 management stats ranges | 11 |
| 61 management database browser | 10 |
| 70 opt-out deletes listening data | 10, 11; ordering: 31, so plan 70 reuses plan 31's listener lock helper instead of adding a second one |
| 71 Taste Profile API | 10, 11, 70 |
| 72 data export of listening data | 10, 11, 70 |
| 80 listen session tracker | 30 |
| 81 web listen and open reports | 32, 80 |
| 82 mobile listen outbox | 32, 80 |
| 83 remove legacy stats requests | 31, 81, 82 |
| 90 Taste Profile copy and paging helper | 71 |
| 91 Taste Profile E2E seed | 10, 20 |
| 92 web opt-out warning | 70, 90, 91 |
| 93 web Taste Profile sections | 71, 90, 91, 92 |
| 94 mobile opt-out warning | 70, 90 |
| 95 mobile Taste Profile sections | 71, 90, 91, 94 |

## Shared files and who edits them, in order

| File | Plans, in phase order |
| --- | --- |
| `packages/orm/src/index.ts` | 11, 31, 41, 70, 71, 42, 50, 72, 43, 19 |
| `docs/features/POPULARITY-TRACKING.md` | 10 (creates), 31, 41, 70, 71, 42, 50, 72, 51, 83 |
| `packages/helpers/src/index.ts` | 30, 11, 90, 43, 19 |
| `infra/k8s/base/api/source/api.env` | 10, 20, 40, 32, 19 |
| `infra/k8s/base/ops/kustomization.yaml` | 10, 19 |
| Linear baseline archives `0004_` and `0005_` | 10, 19 |
| `infra/k8s/base/web/source/web-sidecar.env`, `apps/web/sidecar/.env.example`, `dev/env-overrides/local/legal.env.example`, `packages/helpers-config/src/podverseTestEnv.ts`, `apps/web/playwright.e2e-server-env.ts` | 20, 40 |
| `apps/api/.env.example`, `apps/api/ENV.md` | 20, 40, 32 |
| `tools/web/seed-e2e.mjs` | 20, 91 |
| `apps/api/openapi.yml` | 32, 70, 71 |
| `packages/helpers-requests/src/api/_request.ts` | 32, 71, 83 |
| `packages/helpers-requests/src/api/stats/stats.ts` | 32, 83 |
| `packages/helpers/src/dtos/index.ts` | 71, 19 |
| `packages/orm/src/db/entities.ts` | 11, 19 |
| `apps/api/src/test/stats-foundation-schema.integration.test.ts` | 10 (creates), 19 |
| `apps/workers/ENV.md` | 40, 41, 42, 43 |
| `packages/worker-commands/src/registry.ts`, `apps/workers/src/commands/index.ts`, `apps/workers/src/lib/startup/categoriesForCommand.ts` and its test, `apps/workers/package.json`, `apps/workers/APPS-WORKERS.md` | 41, 42, 43 (APPS-WORKERS.md: 41, 42) |
| `infra/k8s/base/cron/kustomization.yaml` | 41, 42 |
| `packages/helpers/src/lib/simulatedAggregatedStats.ts` and its test | 43 (deletes), 19 (finds them gone) |
| `apps/web/src/components/MediaPlayer/Controller/NonLiveMediaOrchestrator.tsx` | 80, 81 |
| `apps/mobile/src/playback/PlaybackProvider.tsx` | 80, 82 |
| `apps/mobile/src/components/feedback/ConfirmDialog.tsx`, `apps/mobile/src/screens/more/MoreSettingsPopularityTrackingScreen.tsx` | 94, 95 |

## Phases

### Phase 1 — schema, guard, terms, listen rule

- **10** owns the new app migration, both baseline archives, `api.env` (marker only),
  `infra/k8s/base/ops/kustomization.yaml` (marker and file list only),
  `docs/features/POPULARITY-TRACKING.md` (creates it), and
  `apps/api/src/test/stats-foundation-schema.integration.test.ts`.
- **12** owns `eslint.config.mjs`, `packages/orm/src/services/stats/statsListenerSeparation.sourceGuard.test.ts`,
  `.cursor/rules/popularity-listener-id-separation.mdc`, and `.cursor/rules/rule-index.mdc`.
- **21** owns `apps/api/legal/terms/{en-US,es,fr,el-GR}.md` and
  `apps/api/src/lib/legal/termsContent.test.ts`.
- **30** owns `packages/helpers/src/lib/popularityListen.ts` and its test,
  `packages/helpers/src/index.ts`, and `packages/helpers/package.json`.

### Phase 2 — ORM entities, explanation text, browser allowlist, session tracker

- **11** owns the new `packages/orm/src/entities/stats/` files,
  `packages/orm/src/services/stats/listenerIdentity/statsListener.ts`,
  `packages/orm/src/db/entities.ts`, `packages/orm/src/index.ts`,
  `packages/helpers/src/lib/statsPopularityRange.ts` and its test, and
  `packages/helpers/src/index.ts`.
- **20** owns `apps/api/legal/popularity-tracking/*.md`, `api.env` and `web-sidecar.env` (version
  keys), `apps/api/.env.example`, `apps/api/ENV.md`, `apps/web/sidecar/.env.example`,
  `dev/env-overrides/local/legal.env` and `legal.env.example`,
  `packages/helpers-config/src/podverseTestEnv.ts`, `apps/web/playwright.e2e-server-env.ts`,
  `tools/web/seed-e2e.mjs`, and its two API tests.
- **61** owns `apps/management-api/src/lib/database/tablePolicy.ts` and its test, and
  `apps/management-api/src/routes/database.integration.test.ts`.
- **80** owns the `packages/playback-core/` files in its plan,
  `NonLiveMediaOrchestrator.tsx` and its two web tests, and `apps/mobile/src/playback/PlaybackProvider.tsx`.

### Phase 3 — write services, retention, management ranges, E2E seed

- **31** owns the three new `listenerIdentity/` write services, `packages/orm/src/index.ts`, the
  doc, and `apps/api/src/test/stats-listen-write.integration.test.ts`. It creates the listener
  lock helper that plan 70 reuses.
- **40** owns `packages/helpers/src/lib/time.ts` and the retention value in `api.env`,
  `workers.env`, `web-sidecar.env`, `apps/api/.env.example`, `apps/workers/.env.example`,
  `apps/web/sidecar/.env.example`, `legal.env.example`, `apps/web/playwright.e2e-server-env.ts`,
  `podverseTestEnv.ts`, `apps/api/ENV.md`, and `apps/workers/ENV.md`.
- **60** owns the management stats route and lib, `apps/management-api/openapi.yml`,
  `packages/management-api-requests/src/stats.ts`, `StatsPageClient.tsx`,
  `apps/management-web/e2e/stats-page.spec.ts`, `StatsBarChart.tsx`, and the `statsPage` key in
  the four management catalogs.
- **91** owns `tools/web/seed-e2e.mjs` and `apps/web/e2e/helpers/legalConsent.ts`.

### Phase 4 — listen API, partition job

- **32** owns `apps/api/src/routes/stats.ts`, the stats controllers, `apps/api/src/config/index.ts`,
  `apps/api/src/lib/startup/validation.ts`, `apps/api/.env.example`, `apps/api/ENV.md`,
  `dev/env-overrides/local/rate-limit.env.example`, `scripts/local-env/setup.sh`, `api.env`,
  `apps/api/openapi.yml`, `packages/helpers-requests/src/api/stats/stats.ts` and `_request.ts`,
  and `apps/api/src/test/stats.track.test.ts`.
- **41** owns the partition job's workers and ORM files, `packages/orm/src/index.ts`, the workers
  registry, command index, categories and test, `apps/workers/package.json`, the new cronjob and
  `infra/k8s/base/cron/kustomization.yaml`, `apps/workers/ENV.md`, `APPS-WORKERS.md`, the doc, and
  its integration test.

### Phase 5 — opt-out deletion, web and mobile senders

- **70** owns `listenerIdentity/listeningDataDeletion.ts` (and `listenerLock.ts` only when plan 31
  left no helper), `accountSettingsListenStats.ts`, `packages/orm/src/index.ts`,
  `packages/helpers/src/lib/popularityTracking.ts` and its test, `apps/api/openapi.yml` (the
  `PATCH /account-settings/listen-stats` description), the doc, and its integration test.
- **81** owns the web files in its plan: `statsTracking.ts` and its new test,
  `apps/web/src/lib/playback/index.ts`, `NonLiveMediaOrchestrator.tsx` and its new test,
  `MEDIA-PLAYER-DECISION-MATRIX.md`, `StatsPageViewTrackers.tsx`, and `ProfilePageClient.tsx`.
- **82** owns the mobile files in its plan, including `apps/mobile/src/data/db/migrations.ts`,
  `schema.ts`, `PlaybackProvider.tsx`, `syncJobs.ts`, `carBackgroundSync.ts`, and
  `apps/mobile/vitest.config.ts`.

### Phase 6 — Taste Profile API

- **71** runs alone: `tasteProfileAccount.ts`, `packages/orm/src/index.ts`, the new DTO and
  `packages/helpers/src/dtos/index.ts`, the controller and `apps/api/src/routes/account.ts`,
  `apps/api/openapi.yml`, `packages/helpers-requests/src/api/account/tasteProfile.ts` and
  `_request.ts`, the doc, and its integration test.

### Phase 7 — refresh job, Taste Profile copy

- **42** owns the refresh job's ORM and workers files, the two deleted aggregate commands,
  `packages/orm/src/index.ts`, the workers registry, command index, categories and test, startup
  validation comment, the two workers tests it lists, `apps/workers/package.json`, the two new
  cronjobs and `infra/k8s/base/cron/kustomization.yaml`, `apps/workers/ENV.md`,
  `APPS-WORKERS.md`, the doc, and its integration test.
- **90** owns the four consumer catalog originals, `packages/helpers/src/lib/tasteProfilePages.ts`
  and its test, and `packages/helpers/src/index.ts`.

### Phase 8 — public readers, opt-out warnings

- **50** owns the five `services/stats/popularity/` readers, `packages/orm/src/index.ts`,
  `packages/orm/src/services/item/item.ts`, `packages/helpers-requests/src/api/queryParams.ts`,
  `apps/api/src/lib/stats.ts` and its new test, the five API controllers, the four API tests it
  renames mocks in, its integration test, and the doc.
- **92** owns `ModalPopularityTrackingOptOut.tsx` and its SCSS, `SettingsListenStats.tsx`,
  `PopularityAgreementGate.tsx`, and `apps/web/e2e/popularity-tracking-consent.spec.ts`.
- **94** owns `ConfirmDialog.tsx`, `PopularityTrackingOptOutPanel.tsx`,
  `MoreSettingsPopularityTrackingScreen.tsx`, `TermsAcceptanceProvider.tsx`, and
  `apps/mobile/e2e/popularity-tracking.yaml`.

### Phase 9 — data export, Taste Profile sections

- **72** owns `packages/helpers/src/dtos/account/accountDataExport.ts`,
  `listenerIdentity/listeningDataExport.ts`, `packages/orm/src/services/account/accountDataExport.ts`,
  `packages/orm/src/index.ts`, the doc, and its integration test.
- **93** owns `useTasteProfileLists.ts`, `SettingsTasteProfile.tsx`, `ModalTasteProfileUnhide.tsx`
  and both SCSS modules, `SettingsAccount.tsx`, and `apps/web/e2e/settings-taste-profile.spec.ts`.
- **95** owns the mobile `useTasteProfileLists.ts`, `TasteProfileSections.tsx`, `ConfirmDialog.tsx`,
  `MoreSettingsPopularityTrackingScreen.tsx`, `apps/mobile/e2e/taste-profile.yaml`,
  `scripts/mobile/e2e-test.sh`, `apps/mobile/e2e/HOW-TO-RUN.md`, and
  `docs/testing/FULL-REPO-VERIFICATION-COMMANDS.md`.

### Phase 10 — dev seed, channel merge

- **43** owns the new workers seed files and `statsDailyDevSeed.ts`, the deleted
  `simulatedAggregatedStats.ts` and test and the old seed command, `packages/helpers/src/index.ts`,
  `packages/orm/src/index.ts`, the workers registry, command index, categories and test,
  `apps/workers/package.json`, root `package.json`, `apps/workers/ENV.md`, and `docs/QUICKSTART.md`.
- **51** owns `applyChannelMerge.ts`, `channelMergeRowJournal.ts`,
  `apps/workers/src/commands/podcastIndex/deadFeeds/flagAndMerge.ts`, the two channel merge
  integration tests, and the doc.

### Phase 11 — remove legacy request helpers

- **83** runs alone: `packages/helpers-requests/src/api/stats/stats.ts`, `_request.ts`, and the doc.

### Phase 12 — drop legacy stats, close the set

- **19** runs alone and last. It drops the old tables and code, regenerates the baselines,
  appends every release-notes entry, writes the deferred summary, archives the set, and ends with
  the cumulative verification.
