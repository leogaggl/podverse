# Developer API keys — execution order

Prompts, models, and the run command: [COPY-PASTA.md](./COPY-PASTA.md). Request and settled review
answers: [00-REQUEST.md](./00-REQUEST.md). Ledger: [00-SUMMARY.md](./00-SUMMARY.md).

This set branches from `feature/combined` and its PR targets `feature/combined`.

Phases run in order. Prompts under one phase run at once, and they edit disjoint files. A prompt
that shares its phase with another puts its release-notes entry in its final message; prompt 42
runs alone at the end and appends those entries. Prompts that run alone (10, 12, 13, 42) write
`release-notes/scratchpad.md` themselves when their plan has an entry.

## Dependency graph

| Plan | Runs after | Why |
| --- | --- | --- |
| 10 | none | Shared bitmask, resource catalog, presets, expiry, supported actions, DTOs |
| 11 | 10 | Table and ORM service use the helpers' token format and permission normalizer |
| 14 | 10 | Management code switches to plan 10's `crudBitmask.ts` and `API_KEY_TOKEN_PREFIX` |
| 12 | 10, 11 | Auth branch reads keys through plan 11's ORM service |
| 13 | 12 | Endpoints extend plan 12's `apiKeyStore.ts` and `openapi.yml` scheme |
| 20 | 13 | Never-allowed route tests and shared test helpers need the create endpoint |
| 30 | 13 | Web list and revoke call plan 13's request functions |
| 40 | 13 | Mobile helpers call plan 13's request functions |
| 50 | 13 | Spec parity edits the same `openapi.yml` after plans 12 and 13 |
| 21, 22, 23 | 20 | Route labels use plan 20's test helper and rate-limit passthrough |
| 31 | 30 | Create dialog mounts in plan 30's panel and reuses its catalog keys |
| 41 | 40 | List screen uses plan 40's helpers; reuses plan 30's `consumer` keys |
| 51 | 20, 50 | Copies plan 20's route table onto the spec after plan 50's parity pass |
| 42 | 41 | Create screen mounts beside plan 41's screen in the navigator |

## Phase 1

- **10** — `@podverse/helpers` shared model. Alone: everything else imports it.

## Phase 2 (two prompts at once)

- **11** owns the `0031_account_api_key.sql` migration, `infra/k8s/base/ops/kustomization.yaml`,
  `infra/k8s/base/api/source/api.env`, both baseline archives, and the `packages/orm` entity,
  service, test, `db/entities.ts`, and `index.ts`. Needs Docker for
  `make db_regen_linear_baseline`.
- **14** owns `apps/management-api/src/lib/crud.ts` (and deletes `crud.test.ts`),
  `lib/authz/requireCrud.ts`, `routes/admins.ts`, `routes/database.ts`,
  `schemas/managementAdminRoles.ts`, `routes/auth.integration.test.ts`;
  `apps/management-web/src/lib/managementPermissions.ts` and its new test,
  `AdminPermissionsSection.tsx`, `AdminsListPageClient.tsx`; and
  `packages/helpers/src/managementAdminRoles/constants.ts` and its new test.

## Phase 3

- **12** — API key auth branch in `apps/api/src/lib/auth/`, `req.user.api_key`, the `apiKeyAuth`
  scheme on `GET /auth/me`, and the "a key never does more than its owner" tests. Alone: every
  later API prompt builds on it.

## Phase 4

- **13** — create, list, and revoke endpoints, `@podverse/helpers-requests` calls, spec entries,
  integration tests. Alone: it edits `apiKeyStore.ts` and `openapi.yml` after plan 12.

## Phase 5 (four prompts at once)

- **20** owns `apps/api/src/lib/rateLimiter.ts`, `apps/api/src/test/helpers/apiKeyTestAccounts.ts`,
  `apps/api/src/test/api-key-routes-denied.integration.test.ts`,
  `apps/api/src/test/api-key-access-supported-cells.test.ts`, the doc comment above
  `API_KEY_RESOURCES` in `packages/helpers/src/lib/apiKey.ts`, `.cursor/rules/api-key-route-access.mdc`,
  and `.cursor/rules/rule-index.mdc`. No controller and no `openapi.yml`.
- **30** owns `apps/web/src/components/Settings/Settings.tsx`, the new
  `Settings/Panels/SettingsDeveloper/` files (`SettingsDeveloper.tsx`, `ModalRevokeApiKey.tsx`,
  `apiKeyDisplay.ts` and test), `SettingsDeveloper.module.scss`, the `consumer` catalog originals
  and overrides (`settings.developer.*`), `tools/web/seed-e2e.mjs`,
  `apps/web/e2e/settings-developer.spec.ts`, and `makefiles/local/e2e-spec-order-web.txt`. The only
  prompt in this phase that runs `npm run i18n:compile`.
- **40** owns `apps/mobile/src/auth/accountApiKeys.ts`, `apps/mobile/src/screens/more/accountApiKeyRows.ts`
  and test, and `apps/mobile/src/config/apiDocsUrl.ts` and test.
- **50** owns `apps/api/openapi.yml` and `apps/api/src/lib/docs/registerSwaggerDocs.test.ts`.

Plan 20's edit to `apiKey.ts` is a comment only, so plans 30 and 40 can import that module while
it runs.

## Phase 6 (six prompts at once)

- **21** owns the playlist controllers (`playlist.ts`, `playlistResource*.ts`), the queue
  controllers (`queue.ts`, `queueResource*.ts`), `apps/api/src/controllers/clip.ts`, and
  `api-key-routes-playlists-queue-clips.integration.test.ts`.
- **22** owns `controllers/account/account.ts`, `profileContent.ts`, `accountFollowing*.ts`,
  `accountUnfollowBulk.ts`, `accountChannelSeen.ts`, `accountOpml{Export,Import}.ts`,
  `channel.ts`, `item.ts`, `liveItem.ts`, `accountAddByRSS{ChaptersTranscript,Parse}.ts`,
  `mq/mq.ts`, `apps/api/src/routes/account.ts`, and
  `api-key-routes-account-subscriptions-add-by-rss.integration.test.ts`.
- **23** owns `controllers/account/accountSettings/*` (locale, playback, notification,
  notificationType), `accountDeviceAutoDownload.ts`, `accountNotification*.ts`,
  `account{FCM,WebPush,UP}Device.ts`, `accountEventStream.ts`, `accountContentLog.ts`,
  `accountTasteProfile.ts`, and `api-key-routes-settings-notifications-history.integration.test.ts`.
  Not the `stats/` controllers.
- **31** owns `SettingsDeveloper.tsx` (after plan 30), `ModalCreateApiKey.tsx`, `apiKeyForm.ts`
  and test, `ModalCreateApiKey.module.scss`, and the create tests appended to
  `apps/web/e2e/settings-developer.spec.ts`. Edits no catalog and does not run `i18n:compile`.
- **41** owns `MoreSettingsScreen.tsx`, `MoreSettingsDeveloperScreen.tsx`,
  `apps/mobile/src/navigation/index.tsx`, `components/feedback/ConfirmDialog.tsx`, and the
  `mobile` catalog originals (three mobile-only `settings.developer.*` leaves). The only prompt in
  this phase that runs `npm run i18n:compile`.
- **51** owns `apps/api/openapi.yml` and `apps/api/src/lib/docs/openapiApiKeyPermissions.test.ts`.
  It reads plan 20's route table from the plan file, not from the controllers plans 21–23 edit.

## Phase 7

- **42** — mobile create and expiration screens, `navigation/index.tsx` (after plan 41),
  `CheckboxMark.tsx`, the `settings-developer.yaml` Maestro flow, and `scripts/mobile/e2e-test.sh`.
  Then it appends the parallel prompts' release-notes entries, archives the set, and ends with
  the cumulative verification.

## Release-notes entries collected by prompt 42

From the final messages in `.artifacts/plan-runner/developer-api-keys/`: 11, 30, 50, 21, 22, 23,
31, 41, 51. Plans 10, 14, 20, and 40 have no entry. Plans 12 and 13 append their own.
