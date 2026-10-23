**Cursor model:** Cursor Grok 4.7 · **Reasoning:** medium

# 11 — Daily purge of old account session rows

A workers command and a daily CronJob that delete `account_session` rows (plan 10) once their idle
expiry is more than `ACCOUNT_SESSION_RETENTION_DAYS` in the past. Copy the Removed Content purge
(`accountContentLogPurge`) in every file below. Only the names, the column, and the wording change.

Why the purge keys on `idle_expires_at`: revoking a session does not change `idle_expires_at`. A
revoked row therefore stays as long as the session could have stayed in use, and a signed-out device
that comes back any time within the 365-day idle limit still learns why it was signed out. After
that, the device would have been signed out by idle expiry anyway, and the ordinary signed-out state
is correct. The retention days add a short margin past expiry. Expired and revoked rows use the same
rule, so there is one cutoff and no second retention setting.

## Rows

R38

## Runs after

10

## Files

- packages/helpers/src/lib/time.ts
- apps/workers/src/config/index.ts
- apps/workers/src/config/retentionConfig.test.ts
- apps/workers/src/lib/startup/validation.ts
- apps/workers/src/lib/startup/categoriesForCommand.ts
- apps/workers/src/lib/startup/categoriesForCommand.test.ts
- apps/workers/src/commands/orm/accountSession/purge.ts
- apps/workers/src/commands/orm/accountSession/purge.test.ts
- apps/workers/src/commands/index.ts
- apps/workers/package.json
- apps/workers/.env.example
- apps/workers/ENV.md
- apps/workers/APPS-WORKERS.md
- packages/worker-commands/src/registry.ts
- infra/k8s/base/workers/source/workers.env
- infra/k8s/base/cron/worker-account-session-purge.cronjob.yaml
- infra/k8s/base/cron/kustomization.yaml

## Decisions (transcribe, do not revisit)

- Command name: `accountSessionPurge`. npm script: `account_session_purge`. CronJob:
  `worker-account-session-purge`, schedule `"30 4 * * *"` (daily at 04:30, after the Removed Content
  purge at 04:15).
- Env var: `ACCOUNT_SESSION_RETENTION_DAYS`, optional, default 30. It counts days after a row's
  `idle_expires_at`.
- Default constant: `DEFAULT_ACCOUNT_SESSION_RETENTION_DAYS = 30` in
  `packages/helpers/src/lib/time.ts`, directly after `DEFAULT_ACCOUNT_CONTENT_LOG_RETENTION_DAYS`,
  with a doc comment: "Days an account_session row is kept after its idle expiry (see
  ACCOUNT_SESSION_RETENTION_DAYS). A revoked row keeps its idle expiry, so a device that returns
  within its idle limit can still be told why it was signed out."
- The ORM function is `deleteAccountSessionsIdleExpiredBefore(cutoff)` from `@podverse/orm`
  (plan 10). Do not add another.
- Startup category: Base + ORM, the same as `accountContentLogPurge`.

## Steps

1. **Config** (`apps/workers/src/config/index.ts`): add `AccountSessionRetentionConfig` and
   `getAccountSessionRetentionConfig()` after `getAccountContentLogRetentionConfig`, using
   `resolveRetentionDays(process.env.ACCOUNT_SESSION_RETENTION_DAYS,
   DEFAULT_ACCOUNT_SESSION_RETENTION_DAYS)`.
1. **Validation** (`apps/workers/src/lib/startup/validation.ts`): add a
   `validateRetentionDays('ACCOUNT_SESSION_RETENTION_DAYS', 'Account sessions',
   DEFAULT_ACCOUNT_SESSION_RETENTION_DAYS)` push right after the `ACCOUNT_CONTENT_LOG_RETENTION_DAYS`
   one, and import the default.
1. **Command** (`apps/workers/src/commands/orm/accountSession/purge.ts`): copy
   `commands/orm/accountContentLog/purge.ts`. Cutoff = `subtractDays(new Date(), retentionDays)`. Log
   lines: `accountSessionPurge starting with retention_days=… retention_cutoff=…` and
   `accountSessionPurge completed rows_deleted=…`. The doc comment says that it deletes session rows
   whose idle expiry is older than the retention window, that revoked rows keep their idle expiry,
   and that a re-run removes whatever is left.
1. **Register**: import and add `accountSessionPurge` in `apps/workers/src/commands/index.ts` next to
   `accountContentLogPurge`; add it to `BASE_ORM_COMMANDS` in `categoriesForCommand.ts`; add the
   registry entry in `packages/worker-commands/src/registry.ts` after `accountContentLogPurge`:
   label `Account sessions: purge expired rows`, description `Delete account_session rows whose
   idle_expires_at is older than ACCOUNT_SESSION_RETENTION_DAYS.`, category `orm`, risk `normal`,
   `example_cli: 'npm run account_session_purge -w apps/workers'`; add the npm script to
   `apps/workers/package.json` after `account_content_log_purge`.
1. **Env and docs**:
   - `apps/workers/.env.example`: a `##### Account sessions #####` block after the Removed Content
     block, with `ACCOUNT_SESSION_RETENTION_DAYS="30"` and a two-line comment matching the default's
     doc comment.
   - `infra/k8s/base/workers/source/workers.env`: `ACCOUNT_SESSION_RETENTION_DAYS=30` after
     `ACCOUNT_CONTENT_LOG_RETENTION_DAYS`, with a one-line comment (unquoted value,
     **env-file-formatting**).
   - `apps/workers/ENV.md`: add `accountSessionPurge` to the "Base + ORM only" command list, a
     paragraph after the `ACCOUNT_CONTENT_LOG_RETENTION_DAYS` one, and a row in the Retention windows
     table: `ACCOUNT_SESSION_RETENTION_DAYS` | 30 | Account session rows (`account_session`), counted
     from idle expiry.
   - `apps/workers/APPS-WORKERS.md`: add `worker-account-session-purge` (`accountSessionPurge`,
     daily at 04:30) to the K8s flow list.
1. **CronJob**: copy `worker-account-content-log-purge.cronjob.yaml` to
   `worker-account-session-purge.cronjob.yaml`, changing only `metadata.name`, `schedule`, and the
   command argument. Add it to `infra/k8s/base/cron/kustomization.yaml` after the content-log entry.

## Tests

- `apps/workers/src/commands/orm/accountSession/purge.test.ts`: copy `accountContentLog/purge.test.ts`.
  It calls `deleteAccountSessionsIdleExpiredBefore` with now minus the default when the variable is
  unset, and with now minus 10 days when it is `'10'`.
- `apps/workers/src/config/retentionConfig.test.ts`: add the
  `ACCOUNT_SESSION_RETENTION_DAYS` / `DEFAULT_ACCOUNT_SESSION_RETENTION_DAYS` case to the table.
- `apps/workers/src/lib/startup/categoriesForCommand.test.ts`: `accountSessionPurge` maps to Base and
  ORM.

## Release scratchpad

```markdown
## Daily purge of expired session rows

- Surfaces: workers, k8s cron, k8s workers env
- Change: new `accountSessionPurge` worker command and `worker-account-session-purge` CronJob (daily
  04:30) delete `account_session` rows whose idle expiry is more than
  `ACCOUNT_SESSION_RETENTION_DAYS` (default 30) days past. Revoked rows keep their idle expiry, so a
  signed-out device still gets its reason while its session could have been in use.
- Who notices: operators
- Operator steps: optional `ACCOUNT_SESSION_RETENTION_DAYS` on workers; the CronJob ships in base
```
