# Auth sessions: ending a session closes its live streams — execution order

Prompts and models: [COPY-PASTA.md](COPY-PASTA.md). Summary and prerequisites:
[00-SUMMARY.md](00-SUMMARY.md).

Two phases, one prompt each. Each prompt appends its own release scratchpad entry.

## Outside this set

- `auth-sessions` and `realtime-banner-notifications` are both merged into this branch, and the
  linear baseline archives verify (00-SUMMARY.md, "Before this set runs").
- Plan 70 stops and reports when `apps/api/src/lib/accountEventStream/accountEventStreamHub.ts` or
  `packages/orm/src/lib/accountEventPublisher.ts` is missing. Plan 71 stops when
  `apps/web/src/lib/notifications/stream/notificationStreamCoordinator.ts` is missing.

## Dependency graph

| Plan | Runs after |
| --- | --- |
| 70 session end closes streams | auth-sessions set; realtime set 10–14 |
| 71 web stream session-ended, closes the set | 70; auth-sessions set; realtime set 30–31 |

## Phases

### Phase 1 — stream close on session end

- **70** owns `packages/helpers/src/lib/authSessionNotice.ts`, `accountEventStream.ts`, their
  tests, `packages/orm/src/lib/accountEventPublisher.ts`, `accountSessionSignal.ts` and its test,
  `packages/orm/src/services/account/accountSession.ts` and its test, `packages/orm/src/index.ts`,
  `apps/api/src/lib/auth/index.ts`, `apps/api/src/lib/accountEventStream/accountEventStreamHub.ts`
  and its test, the `accountEventStream.ts` controller, `apps/api/src/test/account-events.test.ts`,
  `apps/api/openapi.yml`, and `apps/api/APPS-API.md`.

### Phase 2 — web stream session-ended, then close the set

- **71**, alone. Archives the set and carries the cumulative verification.
