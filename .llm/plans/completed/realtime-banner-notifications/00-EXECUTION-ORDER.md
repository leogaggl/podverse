# Realtime and banner notifications — execution order

Prompts and models: [COPY-PASTA.md](COPY-PASTA.md). Request and settled review answers:
[00-REQUEST.md](00-REQUEST.md). Ledger and decisions: [00-SUMMARY.md](00-SUMMARY.md).

Phases run one after another. Prompts inside one phase run at once and own disjoint files,
counting the shared files in **parallel-plan-execution** § Shared files (`openapi.yml`,
`apps/mobile/vitest.config.ts`, `apps/mobile/src/navigation/index.tsx`, the mobile E2E YAML, the
i18n originals, and the scratchpad). In a phase with several prompts, no prompt writes
`release-notes/scratchpad.md`; each puts its entry in its final message under "Release notes
entry", and prompt 53 appends them all. Prompts that run alone (42, 53) append their own entry.

## Dependency graph

From each plan's `## Runs after`:

| Plan | Runs after |
| --- | --- |
| 10 account event contract | none |
| 11 Redis fanout in the ORM | none |
| 13 API Redis connections | 11 |
| 14 management API publisher | 11 |
| 15 workers publisher | 11 |
| 12 API `/account/events` stream | 10, 11, 13 |
| 16 architecture doc | 11, 12, 13, 14, 15 |
| 20 read state schema | 11, 12 |
| 21 mark one read | 20 |
| 30 web stream client | 10 |
| 31 web bell badge | 30 |
| 32 web live inbox | 31, 21 |
| 33 web push tap marks read | 21, 30, 31 |
| 40 mobile stream runtime | 10, 12 |
| 41 mobile push tap marks read | 21, 40 |
| 42 mobile inbox live rows | 40, 41 |
| 43 mobile More badges | 40 |
| 50 banner kinds and prefs | none |
| 51 banner card | none |
| 52 banner settings | 40, 50 |
| 53 banner host, closes the set | 40, 41, 42, 50, 51, 52 |

## Phases

### Phase 1 — contract and fanout

- **10** owns `packages/helpers/src/lib/accountEventStream.ts`, its test, and
  `packages/helpers/src/index.ts`.
- **11** owns `packages/orm/src/lib/accountEventPublisher.ts` and its test,
  `accountNotificationSignal.ts` and its test, `accountNotificationPublish.test.ts`,
  `packages/orm/src/services/account/accountNotification.ts` and its test,
  `packages/orm/src/services/account/account.ts`, and `packages/orm/src/index.ts`.

### Phase 2 — management API publisher and banner building blocks

Plan 14 runs `npm install` at the repo root. It shares this phase only with mobile prompts, which
use the standalone `apps/mobile` install, so no other prompt type-checks a root workspace while
`node_modules` changes. That is why 13 and 15 wait for Phase 3.

- **14** owns its `apps/management-api/` files, `package-lock.json`,
  `packages/helpers-config/src/podverseTestEnv.ts`, `scripts/local-env/setup.sh`, and
  `infra/k8s/base/management-api/source/management-api.env` and `deployment.yaml`.
- **50** owns `apps/mobile/src/notifications/bannerNotificationPolicy.ts` and its test,
  `apps/mobile/src/prefs/bannerNotificationPrefs.ts` and its test, and
  `apps/mobile/vitest.config.ts`.
- **51** owns `bannerNotificationQueue.ts`, `bannerNotificationSwipe.ts`, their tests, and
  `apps/mobile/src/components/feedback/BannerNotification.tsx`. It does not edit
  `vitest.config.ts`; plan 50's glob collects its tests.

### Phase 3 — API and worker Redis wiring, web stream library

- **13** owns `apps/api/src/lib/accountEvents/`, `apps/api/src/index.ts`,
  `apps/api/src/test/helpers/index.ts`, and `apps/api/ENV.md`.
- **15** owns its `apps/workers/` files and the worker, cron, and ops seed manifests it lists.
- **30** owns `apps/web/src/factories/apiRequestService.ts` and the
  `apps/web/src/lib/notifications/stream/` URL, connection, and coordinator modules and tests.

### Phase 4 — API stream, web bell

- **12** owns `apps/api/src/lib/accountEventStream/`, the `accountEventStream.ts` controller,
  `apps/api/src/routes/account.ts`, `apps/api/src/@types/express.d.ts`,
  `apps/api/src/lib/auth/index.ts`, `apps/api/src/app.ts`, `apps/api/src/index.ts`,
  `apps/api/src/test/helpers/index.ts`, `apps/api/src/test/account-events.test.ts`,
  `apps/api/openapi.yml`, and `apps/api/APPS-API.md`.
- **31** owns `apps/web/src/contexts/Notifications.tsx`,
  `apps/web/src/hooks/useNotificationsUnreadCount.ts` and its test,
  `notificationStreamEventUnreadCount.ts` and its test, `NotificationBellButton.tsx`, and
  `apps/web/e2e/notifications-inbox.spec.ts`.

### Phase 5 — read state schema, mobile stream, docs

Start Docker first: plan 20 regenerates the linear baseline archives.

- **16** owns `docs/architecture/ARCHITECTURE.md`.
- **20** owns the new app migration (`0022_account_notification_read_at.sql`, or the next free
  number if another set's `0022` has landed), both baseline archives,
  `infra/k8s/base/api/source/api.env`, `infra/k8s/base/ops/kustomization.yaml`, the
  `AccountNotification` entity, the ORM notification service and its test, the notification DTO,
  the API serialization and its test, the API notification controller,
  `apps/api/src/test/account-notifications.test.ts`, and `apps/api/openapi.yml`.
- **40** owns the `apps/mobile/src/notifications/` stream modules (SSE parser, policy, store,
  controller, client) and their tests, `NotificationsRuntime.tsx`,
  `NotificationStreamE2eStatus.tsx`, `authRequestWithRefresh.ts`, the mobile
  `useNotificationsUnreadCount.ts`, `NotificationsInboxScreen.tsx`, `navigation/index.tsx`,
  `SyncProvider.tsx`, `App.tsx`, `vitest.config.ts`, `apps/mobile/e2e/notifications-inbox.yaml`,
  and `apps/mobile/APPS-MOBILE.md`. It reads play state through `usePlaybackIsPlaying()` and
  edits no playback file.

### Phase 6 — mark one read, mobile badges, banner settings

- **21** owns `packages/orm/src/lib/queryResultRows.ts` and its test,
  `packages/orm/src/services/billingCheckoutChannel.ts`, the ORM notification service and its
  test, the API notification controller, `apps/api/src/routes/account.ts`,
  `apps/api/src/test/account-notifications.test.ts`, `apps/api/openapi.yml`, and
  `packages/helpers-requests/src/api/account/notification/notifications.ts` and `_request.ts`.
- **43** owns `apps/mobile/src/navigation/index.tsx`.
- **52** owns `MoreSettingsNotificationsScreen.tsx`, the four
  `packages/i18n-catalog/mobile/originals/*.json` files, and
  `apps/mobile/e2e/notifications-inbox.yaml`.

### Phase 7 — web live inbox, web push tap, mobile push tap

- **32** owns `NotificationsPageClient.tsx`, `notificationsInboxRows.ts` and its test, and
  `apps/web/e2e/notifications-inbox.spec.ts`.
- **33** owns `apps/web/public/webpush-sw.js`, `apps/web/src/lib/notifications/webpush/`, and
  `apps/web/src/contexts/Notifications.tsx`.
- **41** owns `apps/mobile/src/push/notificationTarget.ts` and its test, `notificationRouting.ts`,
  `notificationsRepository.ts`, `notificationReadActions.ts` and its test,
  `usePushTapMarksRead.ts`, `NotificationsRuntime.tsx`, and `apps/mobile/vitest.config.ts`.

### Phase 8 — mobile inbox live rows

- **42**, alone. It edits `NotificationsInboxScreen.tsx`, `SyncProvider.tsx`, and
  `vitest.config.ts` after plans 40 and 41, and appends its own scratchpad entry.

### Phase 9 — banner host, then close the set

- **53**, alone. It edits `notificationStreamStore.ts`, `NotificationsInboxScreen.tsx`,
  `SyncProvider.tsx`, `App.tsx`, and `vitest.config.ts` after plans 40 and 42, adds
  `expo-haptics` to the mobile install, appends every parallel prompt's release entry and then
  its own, archives the set, and carries the cumulative verification.

## Release entries collected by prompt 53

From `.artifacts/plan-runner/realtime-banner-notifications/<NN>.md`, in this order: 14, 15, 12,
31, 20, 40, 21, 43, 52, 32, 33, 41. Plans 10, 11, 13, 16, 30, 50, and 51 carry no entry; plan 42
appends its own.

## After this set

`.llm/plans/active/cross-device-playback/` builds on the account event stream, the reserved
`playback.*` namespace, and plan 40's `backgroundAudioActive` run-condition input. It runs after
this set.
