**Cursor model:** Cursor Grok 4.7 · **Reasoning:** high

# 14 — Management API account event publisher

The management API writes notifications when an admin sends a campaign now
(`dispatchAdminNotificationCampaign` from `apps/management-api/src/routes/notificationCampaigns.ts`,
which reaches `AccountNotificationService.createMany`). Plan 11 publishes from `createMany`
through whatever publisher the process registered, so the management API needs a Redis (Valkey)
connection of its own. Today it has no Redis client, config, env var, or secret mount.

This plan copies the API's KeyValDB wiring, reduced to what publishing needs: host, port, and
password from the existing `podverse-keyvaldb-opaque` secret, and one publisher connection. There
is no cache, so no `KEYVALDB_CACHE_EXPIRATION`. Redis is not required for the management API to
start or serve requests: a publish during an outage is dropped and logged (plan 11), and the
writes it follows still succeed. So there is no `wait-keyvaldb` init container and no startup
ping.

Other work is landing in the tree. Before editing, confirm these still exist: the `bindORMContext`
call and the `shutdown` function in `apps/management-api/src/index.ts`, the `appDatabase` section
in `apps/management-api/src/config/index.ts`, the `// Main app database` block in
`apps/management-api/src/lib/startup/validation.ts`, `managementApiTestEnvBase` in
`packages/helpers-config/src/podverseTestEnv.ts`, the management-api `DB_*` lines in
`scripts/local-env/setup.sh`, and plan 11's `registerAccountEventPublisher`,
`unregisterAccountEventPublisher`, `warnIfNoAccountEventPublisher`, and
`ACCOUNT_EVENT_REDIS_RECONNECT_DELAY_MS` exported from `@podverse/orm`.

## Rows

R41

## Runs after

11

## Files

apps/management-api/package.json
package-lock.json
apps/management-api/src/config/index.ts
apps/management-api/src/lib/startup/validation.ts
apps/management-api/.env.example
apps/management-api/src/lib/accountEvents/accountEventPublisher.ts
apps/management-api/src/lib/accountEvents/accountEventPublisher.test.ts
apps/management-api/src/index.ts
apps/management-api/ENV.md
packages/helpers-config/src/podverseTestEnv.ts
scripts/local-env/setup.sh
infra/k8s/base/management-api/source/management-api.env
infra/k8s/base/management-api/deployment.yaml
release-notes/scratchpad.md

## Dependency

Add `"ioredis": "^6.0.0"` to `dependencies` in `apps/management-api/package.json`, the same range
as `apps/api` and `apps/workers`. Run `npm install` from the repo root to update
`package-lock.json`; ioredis is already in the lockfile, so only the workspace entry changes. The
Dockerfile installs with `npm ci --omit=dev` from the lockfile and needs no change. Tell the
operator to run `./scripts/development/update-lockfile-linux.sh` before committing (see
[LOCKFILE-LINUX.md](/docs/development/tooling/LOCKFILE-LINUX.md)).

## Config and validation

- `apps/management-api/src/config/index.ts`: add to the `Config` type and the `config` object,
  after `appDatabase`:

  ```typescript
  keyvaldb: {
    host: process.env.KEYVALDB_HOST!,
    port: parseInt(process.env.KEYVALDB_PORT!, 10),
    password: process.env.KEYVALDB_PASSWORD!,
  },
  ```

  No defaults (AGENTS.md).
- `apps/management-api/src/lib/startup/validation.ts`: after the `// Management (admin) database`
  block, add a `// KeyValDB (account event publishing)` block with
  `validateRequired('KEYVALDB_HOST', 'KeyValDB')`, `validateRequired('KEYVALDB_PORT', 'KeyValDB')`,
  and `validateRequired('KEYVALDB_PASSWORD', 'KeyValDB')`, matching the API's lines. If the file
  has a numeric port validator used for `DB_PORT`, use it for `KEYVALDB_PORT` too.
- `apps/management-api/.env.example`: after the Management database block, a `# KeyValDB` section
  in the API's style:

  ```bash
  # KeyValDB (Valkey): the management API publishes account events (new notifications) here.
  KEYVALDB_HOST="localhost"
  KEYVALDB_PORT="6379"
  KEYVALDB_PASSWORD=
  ```

  Keep the section order the same as the validation push order (**startup-validation-env-order**).
- `apps/management-api/ENV.md`: a `### KeyValDB` subsection under `## Required Variables`, after
  Database, with a three-row table and one sentence: the management API opens one connection, used
  only to publish account events on the channel `podverse:account-events` after it writes
  notifications; an outage drops the events and never fails the request.

## Publisher module

`apps/management-api/src/lib/accountEvents/accountEventPublisher.ts`:

```typescript
/** Opens the publisher connection and registers it with `@podverse/orm`. */
export function startAccountEventPublisher(): void;

/** Unregisters the publisher and closes its connection. Safe to call twice. */
export async function closeAccountEventPublisher(): Promise<void>;
```

Same behavior as the API's publisher half in plan 13: `new Redis({ host, port, password,
connectionName: 'podverse-management-api-account-events-pub', retryStrategy: () =>
ACCOUNT_EVENT_REDIS_RECONNECT_DELAY_MS, enableOfflineQueue: false, maxRetriesPerRequest: 1,
lazyConnect: true })`, `connect()` without awaiting, register, errors logged once per outage with
a recovery message, second start does nothing. Use the management API's `loggerService` and
`config.keyvaldb`. Do not share code with the API; apps do not import each other.

## Startup and shutdown

In `apps/management-api/src/index.ts`:

- Directly after `bindORMContext({...})`: dynamically import the module, call
  `startAccountEventPublisher()`, then `warnIfNoAccountEventPublisher('management-api')` from
  `@podverse/orm` (D2's startup check).
- In `shutdown`, after the database block and before extensions shut down, call
  `closeAccountEventPublisher()` in its own `try`, logging with
  `loggerService.logError('Error closing account event publisher during shutdown', err)`.

## Tests

- `apps/management-api/src/lib/accountEvents/accountEventPublisher.test.ts`: mock `ioredis` with a
  fake `Redis` class extending `EventEmitter`, mock the config and logger modules, and mock
  `@podverse/orm` with `importOriginal` making the register and unregister functions `vi.fn`.
  - Start registers one connection named `podverse-management-api-account-events-pub`; a second
    start creates nothing.
  - Two `error` events between `ready`s log one warning; the next `ready` logs one recovery.
  - Close twice unregisters and quits once.
- Test env: add `KEYVALDB_HOST: '127.0.0.1'`, `KEYVALDB_PORT: '6679'`, and
  `KEYVALDB_PASSWORD: 'test'` to `managementApiTestEnvBase` in
  `packages/helpers-config/src/podverseTestEnv.ts` (the API's test Valkey), so startup validation
  passes in tests.
- Existing tests: `notificationCampaigns.integration.test.ts` mocks the campaign dispatch, so it
  writes no rows. Run `rg -n "bindORMContext|createORMContext" apps/management-api/src --glob '*.test.ts'`
  and check whether any of those tests reaches `createMany` unmocked. If one does, register
  `{ publish: async () => 0 }` with `registerAccountEventPublisher` in its setup and unregister
  in teardown; otherwise change nothing.

## Local env

`scripts/local-env/setup.sh`:

- With the other management-api `set_if_empty_or_equals` lines, add
  `set_if_empty_or_equals "$MANAGEMENT_API_INFRA_ENV" "KEYVALDB_HOST" "podverse_local_keyvaldb" "localhost"`
  and the matching `KEYVALDB_PORT` line (`"6379" "6379"`), as the API and workers have. The
  management API container is already on `podverse_local_network`.
- After the loop that upserts `KEYVALDB_PASSWORD` for the API and workers files, add a loop over
  `"$MANAGEMENT_API_APP_ENV" "$MANAGEMENT_API_INFRA_ENV"` that upserts `KEYVALDB_PASSWORD` from
  the same `$KEYVALDB_PASSWORD`. Do not add the management files to the existing loop; it also
  writes MQ credentials the management API does not use.

## Kubernetes

- `infra/k8s/base/management-api/source/management-api.env`: after the `DB_*` lines, add
  `KEYVALDB_HOST=podverse-keyvaldb` and `KEYVALDB_PORT=6379` (unquoted, as in `api.env`).
- `infra/k8s/base/management-api/deployment.yaml`: in the main container's `envFrom` (the one
  with `podverse-management-api-opaque`, not the migrations init container), add
  `- secretRef: name: podverse-keyvaldb-opaque` after `podverse-db-opaque`. The secret already
  exists in every namespace the API runs in.
- The alpha overlay (`infra/k8s/alpha/management-api/`) merges the base configMap and patches only
  a link annotation, so it needs no change. Check any other overlay directory under `infra/k8s/`
  for a management-api `envFrom` patch, and add the secret there too if one replaces the list.

## Release scratchpad

```markdown
## Management API publishes account events to Redis

- Surfaces: management-api, k8s base env, ops
- Change: the management API opens one Redis (Valkey) connection and publishes an account event
  on `podverse:account-events` whenever it writes notifications (admin campaign sends), so open
  account event streams show them within about a second. New required env vars `KEYVALDB_HOST`,
  `KEYVALDB_PORT`, and `KEYVALDB_PASSWORD`, the same values the API uses. Redis being down does
  not stop the management API or fail a send; the event is dropped and logged.
- Who notices: operators (new env vars and a new secret mount); users see campaign notifications
  arrive live once web and mobile use the stream
- Operator steps: the base k8s configMap and deployment now set the host and port and mount
  `podverse-keyvaldb-opaque`. A deployment outside these manifests must set the three `KEYVALDB_*`
  vars on the management API, or it fails startup validation.
```
