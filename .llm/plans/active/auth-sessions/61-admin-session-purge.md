**Cursor model:** Cursor Grok 4.7 · **Reasoning:** medium

# 61 — Daily purge of old admin session rows

A management-api one-shot and a daily CronJob that delete `admin_session` rows (plan 60) once
their idle expiry is more than `ADMIN_SESSION_RETENTION_DAYS` in the past.

Workers cannot run this. They have no management-database connection (`DB_MANAGEMENT_*` is
management-api only; see `apps/management-api/ENV.md`). The job uses the management-api image,
which already has that connection.

Why the purge keys on `idle_expires_at`: revoking a session does not change `idle_expires_at`. A
revoked row stays as long as the session could have stayed in use, and a signed-out browser that
comes back within the 365-day idle limit still learns why. After that, idle expiry would have
signed it out anyway. The retention days add a short margin past expiry. Expired and revoked rows
use the same cutoff.

## Rows

R46

## Runs after

11, 60

Plan 11 also edits `infra/k8s/base/cron/kustomization.yaml`. Plan 60 adds the delete function and
the migration marker in `management-api.env`.

## Files

- apps/management-api/src/config/index.ts
- apps/management-api/src/lib/startup/validation.ts
- apps/management-api/src/lib/auth/adminSessionPurge.ts
- apps/management-api/src/lib/auth/adminSessionPurge.test.ts
- apps/management-api/src/index.ts
- apps/management-api/.env.example
- apps/management-api/ENV.md
- infra/k8s/base/management-api/source/management-api.env
- infra/k8s/base/cron/management-api-admin-session-purge.cronjob.yaml
- infra/k8s/base/cron/kustomization.yaml

## Decisions (transcribe, do not revisit)

- Command argument: `adminSessionPurge`. CronJob name: `management-api-admin-session-purge`.
  Schedule `"45 4 * * *"` (daily at 04:45, after the account-session purge at 04:30).
- Env var: `ADMIN_SESSION_RETENTION_DAYS`, optional, default 30. It counts days after a row's
  `idle_expires_at`. It is not `ACCOUNT_SESSION_RETENTION_DAYS`; that var belongs to workers.
- Default constant: `DEFAULT_ADMIN_SESSION_RETENTION_DAYS = 30` in
  `apps/management-api/src/lib/auth/adminSessionPurge.ts`. Do not add it to `packages/helpers`.
- The ORM function is `deleteAdminSessionsIdleExpiredBefore(cutoff)` from plan 60. Do not add
  another.
- Do not register this with `packages/worker-commands`. It is not a workers command.

## Steps

1. **Cutoff helper** (`adminSessionPurge.ts`): export `adminSessionPurge(): Promise<number>`.
   Read retention with the same rule as workers `resolveRetentionDays`: blank or unset → 30; a
   present value → `Number.parseInt(raw, 10)`. Cutoff = `subtractDays(new Date(), retentionDays)`
   from `@podverse/helpers`. Call `deleteAdminSessionsIdleExpiredBefore(cutoff)`. Log
   `adminSessionPurge starting with retention_days=… retention_cutoff=…` and
   `adminSessionPurge completed rows_deleted=…` through `loggerService` from
   `@management-api/factories/loggerService.js`. The doc comment says it deletes session rows
   whose idle expiry is older than the retention window, that revoked rows keep their idle
   expiry, and that a re-run removes whatever is left.
1. **Config** (`apps/management-api/src/config/index.ts`): add `adminSessionRetentionDays` on
   `config`, from `ADMIN_SESSION_RETENTION_DAYS`, default 30, using the blank-or-parse rule
   above. No `||` or `??` fallback that hides a bad value: a non-blank unparseable value stays
   `NaN` so startup rejects it.
1. **Validation** (`apps/management-api/src/lib/startup/validation.ts`): in the Auth & Security
   block, after the existing auth pushes. Blank → a valid optional result whose message is
   `Use Default (30 days)`. Otherwise `validatePositiveNumber('ADMIN_SESSION_RETENTION_DAYS',
   'Auth & Security', false, 1, 3650)` from `@podverse/helpers-config`.
1. **Process entry** (`apps/management-api/src/index.ts`): when `process.argv[2] ===
   'adminSessionPurge'`, after `validateStartupRequirements()` and the management-database
   connect, call `adminSessionPurge()` and `process.exit(0)`. Do not connect the app database,
   do not call `startApp`, and do not start HTTP. Any other argv (including none) keeps today's
   server startup. A purge failure logs and `process.exit(1)`.
1. **Env and docs**:
   - `apps/management-api/.env.example`: under `##### Auth & Security #####`, add
     `ADMIN_SESSION_RETENTION_DAYS="30"` with a two-line comment: days an `admin_session` row is
     kept after its idle expiry; a revoked row keeps its idle expiry. Quoted value
     (**env-file-formatting**).
   - `infra/k8s/base/management-api/source/management-api.env`: `ADMIN_SESSION_RETENTION_DAYS=30`
     with a one-line comment. Unquoted (**env-file-formatting**). Do not remove or rewrite the
     migration-marker line plan 60 set.
   - `apps/management-api/ENV.md`: document the var (optional, default 30, counted from idle
     expiry) and the one-shot `node apps/management-api/dist/index.js adminSessionPurge`.
1. **CronJob**: copy `infra/k8s/base/cron/worker-account-content-log-purge.cronjob.yaml` to
   `management-api-admin-session-purge.cronjob.yaml`. Set `metadata.name`, `schedule`, container
   name `management-api`, image `ghcr.io/podverse/podverse/management-api`, and command
   `node` / `apps/management-api/dist/index.js` / `adminSessionPurge`. `envFrom` matches the
   management-api container in `infra/k8s/base/management-api/deployment.yaml` (config map,
   management-api opaque, management-db opaque, app-db opaque, and the optional billing and
   product/extensions refs) so startup validation passes. Keep `runAsUser` / `runAsGroup` 1000,
   `readOnlyRootFilesystem: true`, and `restartPolicy: Never`. Add the file to
   `infra/k8s/base/cron/kustomization.yaml` after the account-content-log entry (or after
   plan 11's account-session entry if that line is already there).

## Tests

`apps/management-api/src/lib/auth/adminSessionPurge.test.ts`. Mock
`deleteAdminSessionsIdleExpiredBefore`. It is called with now minus 30 when
`ADMIN_SESSION_RETENTION_DAYS` is unset, and with now minus 10 when it is `'10'`.

## Release scratchpad

```markdown
## Daily purge of expired admin session rows

- Surfaces: management-api, k8s cron, k8s management-api env
- Change: `node apps/management-api/dist/index.js adminSessionPurge` and CronJob
  `management-api-admin-session-purge` (daily 04:45) delete `admin_session` rows whose idle
  expiry is more than `ADMIN_SESSION_RETENTION_DAYS` (default 30) days past. Revoked rows keep
  their idle expiry, so a signed-out admin still gets the reason while the session could have
  been in use.
- Who notices: operators
- Operator steps: optional `ADMIN_SESSION_RETENTION_DAYS` on the management API; the CronJob
  ships in base
```
