# Auth sessions and remote logout — execution order

Prompts and models: [COPY-PASTA.md](COPY-PASTA.md). Request and settled review answers:
[00-REQUEST.md](00-REQUEST.md). Ledger and decisions: [00-SUMMARY.md](00-SUMMARY.md).

Phases run one after another. Prompts inside one phase run at once and own disjoint files. In a
phase with several prompts, no prompt writes `release-notes/scratchpad.md`; each puts its entry
in its final message under "Release notes entry", and prompt 44 appends them all. Prompts that run
alone (32, 42, 65, 66, 34, 52, 35, 44) append their own entry.

## Outside this set

- **`realtime-banner-notifications`** is independent of this set; the two can run in separate
  worktrees. Both edit `apps/api/src/lib/auth/index.ts`, `apps/api/src/@types/express.d.ts`,
  `apps/api/openapi.yml`, `infra/k8s/base/api/source/api.env`, the linear baseline archives, and
  the web Notifications context. Whichever branch merges second keeps both sets' fields in those
  files, renumbers its linear migration past the other's, and reruns
  `make db_regen_linear_baseline`.
- Plans 10 and 60 take the next free migration number at run time.
- **`auth-sessions-stream-close`** (plans 70 and 71, closing a session's open streams) runs after
  this set and the realtime set are both merged.

## Dependency graph

From each plan's `## Runs after`:

| Plan | Runs after |
| --- | --- |
| 10 account session schema | none |
| 11 account session purge | 10 |
| 20 session-bound API auth | 10 |
| 21 reset and invite end every session | 20 |
| 22 session list and sign-out endpoints | 21 |
| 23 signed-in change password | 22 |
| 30 web cookie renewal | 20, 22 |
| 31 web signed-out reason | 20, 22, 30 |
| 32 web Signed-In Devices | 22, 31 |
| 33 web open page notices ended session | 22, 32 |
| 34 web forms drop confirm password | 42, 43, 51, 66 |
| 35 web Change Password form | 23, 32, 34, 52 |
| 40 mobile refresh rotation safety | 20 |
| 41 mobile signed-out reason | 40, 31 |
| 42 mobile Signed-In Devices | 41, 22, 32 |
| 43 mobile sign-up drops confirm password | none |
| 44 mobile Change Password screen, closes the set | 23, 35, 42, 43 |
| 50 admin force-logout API | 20 |
| 51 admin force-logout page | 50 |
| 52 management forms drop confirm password | 51, 63, 66, 34 |
| 60 admin session schema | 10 |
| 61 admin session purge | 11, 60 |
| 62 session-bound management API auth | 20, 60, 61 |
| 63 admin password ends sessions | 62 |
| 64 admin session endpoints | 63 |
| 65 superuser force-logout | 64 |
| 66 management-web renewal and reason | 65 |

## Shared files that set the order

- **Catalogs and `npm run i18n:compile`.** Plans 31, 32, 41, 42, 51, 65, 66, 34, 52, and 35 edit
  catalog originals; 41, 65, 66, 34, 52, and 35 also run the compile, which rewrites every
  layer's overrides. A compiling prompt never shares a phase with another catalog prompt, so
  Phases 7–14 hold one prompt each.
- **Linear baseline archives.** Plans 10 and 60 both run `make db_regen_linear_baseline`, which
  rewrites both `0004_` and `0005_`. They run in Phases 1 and 2. Start Docker first.
- **`apps/api/openapi.yml`:** 20, 21, 22, then 23.
- **`apps/management-api/openapi.yml`:** 50, then 62, 63, 64, 65.
- **`infra/k8s/base/api/source/api.env`:** 10, 20, 23.
- **`infra/k8s/base/management-api/source/management-api.env`:** 60, 61, 62.
- **`infra/k8s/base/cron/kustomization.yaml`:** 11, then 61.
- **`packages/helpers-requests/src/api/_request.ts`:** 20, 22, 23, 33.
- **`packages/helpers/src/lib/auth.ts` and `auth.test.ts`:** 20, then 62.
- **`apps/web/e2e/web-session-ended-notice.spec.ts` and `apps/web/src/lib/auth/sessionEndedNotice.ts`:**
  31, then 33.
- **`apps/web/e2e/helpers/accountSessions.ts` and `makefiles/local/e2e-spec-order-web.txt`:** 30,
  31, 32, 35.
- **`tools/web/seed-e2e.mjs`:** 30, 35, 44.
- **`packages/orm/src/services/account/account.ts`:** 21 (the password rule in `resetPassword`),
  which 23 calls without editing.
- **`apps/mobile/vitest.config.ts`:** 40, 41, 42.
- **`apps/mobile/src/navigation/index.tsx`, `MoreSettingsScreen.tsx`, `scripts/mobile/e2e-test.sh`:**
  42, then 44.
- **`apps/management-web/e2e/users-detail-force-logout.spec.ts`:** 51, then 52.

## Phases

### Phase 1 — account session schema, mobile sign-up field

Start Docker first: plan 10 regenerates the linear baseline archives.

- **10** owns the new app migration, both baseline archives, `infra/k8s/base/api/source/api.env`,
  `packages/helpers/src/lib/accountSession.ts`, `packages/helpers/src/index.ts`, the
  `AccountSession` entity, `packages/orm/src/db/entities.ts`, `packages/orm/src/index.ts`, and the
  ORM session service and its test.
- **43** owns `apps/mobile/src/screens/auth/SignUpScreen.tsx`.

### Phase 2 — API session auth, account purge, admin session schema

Docker stays up: plan 60 regenerates the archives again.

- **11** owns `packages/helpers/src/lib/time.ts`, its `apps/workers/` files (config, retention
  test, startup validation, categories, the `accountSession/purge` command and test,
  `commands/index.ts`, `package.json`, `.env.example`, `ENV.md`, `APPS-WORKERS.md`),
  `packages/worker-commands/src/registry.ts`, `infra/k8s/base/workers/source/workers.env`, the
  new cronjob, and `infra/k8s/base/cron/kustomization.yaml`.
- **20** owns `packages/helpers/src/lib/auth.ts`, `auth.test.ts`, `authSessionNotice.ts` and its
  test, `packages/helpers/src/index.ts`, `packages/helpers/package.json`,
  `packages/helpers-requests/src/api/auth/auth.ts` and `_request.ts`,
  `packages/helpers-config/src/podverseTestEnv.ts`, `apps/api/src/lib/auth/`,
  `apps/api/src/@types/express.d.ts`, `apps/api/src/controllers/item.ts`, the API config, startup
  validation, `.env.example`, `ENV.md`, `openapi.yml`, `infra/k8s/base/api/source/api.env`, the
  Lighthouse API env files, `docs/development/API-CLIENT-BOUNDARIES.md`, and its API test helpers
  and tests.
- **60** owns the new management migration, both baseline archives,
  `infra/k8s/base/management-api/source/management-api.env`, and the management API
  `adminSession` entity, `orm/db/index.ts`, and the session service and its test.

### Phase 3 — reset ends sessions, mobile rotation, admin force-logout API, admin purge

- **21** owns `packages/orm/src/services/account/account.ts`,
  `apps/api/src/controllers/account/account.ts`, `apps/api/openapi.yml`,
  `apps/api/src/test/account.test.ts`, and `account-session-password.integration.test.ts`.
- **40** owns `authRequestWithRefresh.ts` and its test, `AuthProvider.tsx`,
  `backgroundAuthDeps.ts`, and `apps/mobile/vitest.config.ts`.
- **50** owns `apps/management-api/src/lib/endUserAccountSessions.ts`, `routes/users.ts` and its
  test, `apps/management-api/openapi.yml`, and `packages/management-api-requests/src/users.ts`.
- **61** owns the management API config, startup validation, `adminSessionPurge.ts` and its test,
  `src/index.ts`, `.env.example`, `ENV.md`, `management-api.env`, the new cronjob, and
  `infra/k8s/base/cron/kustomization.yaml`.

### Phase 4 — session endpoints, Force Logout page, management session auth

- **22** owns `packages/helpers/src/dtos/account/accountSession.ts`, `dtos/index.ts`, the
  `accountSession.ts` controller, `apps/api/src/routes/auth.ts`, `apps/api/openapi.yml`,
  `packages/helpers-requests/src/api/auth/sessions.ts` and `_request.ts`, and its integration test.
- **51** owns `UserDetailPageClient.tsx`, the four management catalog originals (the `users`
  keys), `users-detail-force-logout.spec.ts`, `apps/management-web/e2e/helpers/routes.ts`, and
  `makefiles/local/e2e-spec-order-management-web.txt`.
- **62** owns `apps/management-api/src/lib/auth/`, `@types/express.d.ts`, the management API config,
  startup validation, `.env.example`, `ENV.md`, `openapi.yml`, `package.json`, the Vitest configs
  and setup, its tests, `management-api.env`, `infra/k8s/K8S.md`, `infra/k8s/INFRA-K8S.md`,
  `packages/helpers-config/src/podverseTestEnv.ts`, `packages/helpers/src/lib/auth.ts`,
  `auth.test.ts`, `parseEnvExpiration.ts`, `.cursor/skills/env-expiration-naming/SKILL.md`,
  `docs/development/API-CLIENT-BOUNDARIES.md`, and `packages/management-api-requests/src/auth.ts`.

### Phase 5 — change password route, web renewal, admin password

- **23** owns `packages/helpers/src/lib/error/errorMessages.ts`,
  `packages/helpers-requests/src/api/account/account.ts` and `_request.ts`, the account
  controller and routes, the API config, startup validation, `.env.example`, `ENV.md`, `api.env`,
  `openapi.yml`, `apps/api/src/test/account.test.ts`, and its integration test.
- **30** owns `apps/web/src/middleware.ts`, `apps/web/src/lib/auth/jwtPayload.ts`,
  `webSessionRenewal.ts`, their tests, `apps/web/e2e/helpers/accountSessions.ts`,
  `web-session-renewal.spec.ts`, `tools/web/seed-e2e.mjs`, and
  `makefiles/local/e2e-spec-order-web.txt`.
- **63** owns `apps/management-api/src/orm/services/adminAccount.ts`, `routes/admins.ts`, its
  tests, `apps/management-api/openapi.yml`, and `vitest.admin-session.real.config.ts`.

### Phase 6 — web signed-out reason, admin session endpoints

- **31** owns `parseAuthSessionEndedError.ts` and its test,
  `packages/helpers-requests/src/api/index.ts`, `apps/web/src/lib/auth/sessionEndedNotice.ts` and
  its test, `ssrAuth.ts`, `layout.tsx`, `AuthSessionChecker.tsx`, `SessionEndedNotice.tsx`,
  `AppChrome.tsx`, the four consumer catalog originals, `apps/web/e2e/helpers/accountSessions.ts`,
  `web-session-ended-notice.spec.ts`, and `makefiles/local/e2e-spec-order-web.txt`.
- **64** owns `adminSessionHttp.ts`, `apps/management-api/src/routes/auth.ts`,
  `apps/management-api/openapi.yml`, `packages/management-api-requests/src/authSessions.ts` and
  `index.ts`, and its integration test.

### Phase 7 — web Signed-In Devices

- **32**, alone.

### Phase 8 — web open page notices, mobile signed-out reason

- **33** owns `packages/helpers-requests/src/api/_request.ts`,
  `apiRequestServiceOnRequestError.test.ts`, `apps/web/src/factories/apiRequestService.ts`,
  `sessionEndedNotice.ts` and its test, `SessionEndedNotice.tsx`, and
  `web-session-ended-notice.spec.ts`.
- **41** owns its `apps/mobile/src/auth/` files, `ForcedLogoutNotice.tsx`, `prefsStore.ts` and its
  test, `syncJobs.ts`, `apps/mobile/vitest.config.ts`, the four consumer catalog originals, and
  the `npm run i18n:compile` output.

### Phase 9 — mobile Signed-In Devices

- **42**, alone.

### Phase 10 — superuser force-logout

- **65**, alone.

### Phase 11 — management-web renewal and reason

- **66**, alone.

### Phase 12 — web forms drop confirm password

- **34**, alone.

### Phase 13 — management forms drop confirm password

- **52**, alone.

### Phase 14 — web Change Password form

- **35**, alone.

### Phase 15 — mobile Change Password screen, then close the set

- **44**, alone. Owns `MoreSettingsChangePasswordScreen.tsx`, `MoreSettingsScreen.tsx`,
  `apps/mobile/src/navigation/index.tsx`, `tools/web/seed-e2e.mjs`, `auth-change-password.yaml`
  and its script, and `scripts/mobile/e2e-test.sh`. Appends every parallel prompt's release
  entry, then its own, archives the set, and carries the cumulative verification.

## Release entries collected by prompt 44

From `.artifacts/plan-runner/auth-sessions/<NN>.md`, in this order: 10, 43, 11, 20, 60, 21, 40,
50, 61, 22, 51, 62, 23, 30, 63, 31, 64, 33, 41. Every plan carries an entry.
