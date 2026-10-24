**Cursor model:** Opus 5.5 · **Reasoning:** high

# 60 — Admin session table, entity, and service

Server-side session rows for every management-admin login, in the management database. The
management API auth (plans 62–66) and the purge command (plan 61) call this service. This plan
adds no HTTP behavior.

It mirrors plan 10 (`account_session` in the app database). Do not import or edit
`packages/orm/src/services/account/accountSession.ts`. That service is bound to the app database.
Copy the behavior; the substitutions are the table name, the account column, and this app's data
source.

Operator answer (00-REQUEST.md): management-web admin logins use the same session model, with a
session table in the management database.

## Rows

R46, R63

## Runs after

10

## Files

- infra/k8s/base/ops/source/database/linear-migrations/management/NNNN_admin_session.sql
- infra/k8s/base/db/source/bootstrap/0004_app_linear_baseline.sql.gz
- infra/k8s/base/db/source/bootstrap/0005_management_linear_baseline.sql.gz
- infra/k8s/base/management-api/source/management-api.env
- apps/management-api/src/orm/entities/adminSession.ts
- apps/management-api/src/orm/db/index.ts
- apps/management-api/src/orm/services/adminSession.ts
- apps/management-api/src/orm/services/adminSession.test.ts

`NNNN` is the next free number in `linear-migrations/management/` when this runs. The newest is
`0003_billing_permissions.sql` today. Re-list the folder first. Do not edit `0001_management_schema.sql`.

## Before you start

Other work is landing in the tree. Confirm the paths exist. Re-read plan 10's service and migration
so the rotation rules match, and re-read `apps/management-api/src/orm/db/index.ts` for the entity
list. `make db_regen_linear_baseline` rewrites both baseline archives; plan 10 may have rewritten
them already. Regenerate again after this migration so `0005_` includes `admin_session`.

## Shared vocabulary

Reuse plan 10's unions from `@podverse/helpers`. Do not add a second client-type or revoke-reason
union.

- `AccountSessionClientType` — `web` and `mobile` only
- `AccountSessionRevokeReason` — the six reasons in plan 10

Who writes each reason on an admin session:

| Reason | Written when |
| --- | --- |
| `signed_out` | this session signs itself out, or a new login on the same browser replaces it |
| `signed_out_elsewhere` | this admin ends the session from another of their own sessions (plan 64) |
| `password_changed` | this admin changes their own password, or redeems an invite link (plan 63) |
| `admin_password_set` | another admin sets this admin's password (plan 63) |
| `admin_force_logout` | a superuser force-logouts this admin (plan 65) |
| `refresh_reuse` | a refresh token that is neither current nor previous is presented |

The notice text for each reason is plan 20's `getAuthSessionEndedNotice`. Do not remap it.
Deleting an admin has no reason: `admin_account` deletion cascades, and the request fails the
admin lookup first.

## Migration (`NNNN_admin_session.sql`)

Greenfield-only (**linear-sql-greenfield-only**): no `IF NOT EXISTS` guards.

The management database has `nano_id_v2` and does not have `varchar_normal`. `device_label` is
`character varying(255)`, the same length as `DATABASE_CONSTANTS.varchar_normal`. Use
`timestamp with time zone` so idle expiry is an absolute instant.

```sql
-- One row per admin login on one client. A token names its row by id_text; a revoked or
-- idle-expired row fails the request that carries it. Revoked rows stay until idle_expires_at
-- plus the purge retention, so a browser that returns within its idle limit is told why it was
-- signed out.
CREATE TABLE public.admin_session (
    id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    id_text public.nano_id_v2 NOT NULL,
    admin_account_id integer NOT NULL,
    client_type varchar(16) NOT NULL,
    device_label character varying(255),
    last_seen_at timestamp with time zone DEFAULT now() NOT NULL,
    idle_expires_at timestamp with time zone NOT NULL,
    refresh_token_hash varchar(64),
    previous_refresh_token_hash varchar(64),
    revoked_at timestamp with time zone,
    revoked_reason varchar(32),
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT admin_session_id_text_key UNIQUE (id_text),
    CONSTRAINT admin_session_admin_account_id_fkey
        FOREIGN KEY (admin_account_id) REFERENCES public.admin_account(id) ON DELETE CASCADE,
    CONSTRAINT admin_session_client_type_check
        CHECK (client_type IN ('web', 'mobile')),
    CONSTRAINT admin_session_revoked_reason_check
        CHECK (
            revoked_reason IS NULL
            OR revoked_reason IN (
                'signed_out',
                'signed_out_elsewhere',
                'password_changed',
                'admin_password_set',
                'admin_force_logout',
                'refresh_reuse'
            )
        ),
    CONSTRAINT admin_session_revoked_pair_check
        CHECK ((revoked_at IS NULL) = (revoked_reason IS NULL))
);

CREATE INDEX admin_session_admin_active_idx
    ON public.admin_session (admin_account_id, last_seen_at DESC)
    WHERE revoked_at IS NULL;

CREATE INDEX admin_session_idle_expires_at_idx
    ON public.admin_session (idle_expires_at);

GRANT SELECT, INSERT, DELETE, UPDATE ON TABLE public.admin_session TO podverse_management_read_write;
GRANT SELECT ON TABLE public.admin_session TO podverse_management_read;
```

Column notes, matching plan 10:

- `id_text` is what tokens carry. Generate it with `generateRandomIdText` from `@podverse/orm`.
  No database default.
- `device_label` is nullable. Callers pass a string or null. The service trims it and cuts it to
  255 characters. An empty result is stored as null.
- `idle_expires_at` is stored. The caller passes it. This service reads no auth config.
- `refresh_token_hash` and `previous_refresh_token_hash` are the hex SHA-256 of refresh token ids.
  Web rows leave both null. Raw ids are never stored.
- Every row is created by a login. A token that names no session row is rejected by plan 62;
  nothing maps a token onto a row after the fact.
- Deleting an admin (`AdminAccountService.delete`) hard-deletes `admin_account`, so the cascade
  removes every session. No other delete-path code.

After the file is written, run `make db_regen_linear_baseline` then `make db_verify_linear_baseline`
(**linear-baseline-0004**) and leave both `.sql.gz` archives in the tree. Set
`MANAGEMENT_API_EXPECTED_MIGRATION_FILENAME` in
`infra/k8s/base/management-api/source/management-api.env` to the new filename
(**migration-readiness-marker-sync**). Leave `API_EXPECTED_MIGRATION_FILENAME` unchanged. The
marker line is the only edit in that env file; plans 61 and 62 add their own keys later.

## Entity (`apps/management-api/src/orm/entities/adminSession.ts`)

`@Entity('admin_session')`. `@PrimaryGeneratedColumn('identity', { type: 'bigint',
generatedIdentity: 'ALWAYS' })` typed `string`. `client_type` typed `AccountSessionClientType`.
`revoked_reason` typed `AccountSessionRevokeReason | null`. Timestamps `timestamptz`.
`@ManyToOne('AdminAccount', { onDelete: 'CASCADE' })` on `admin_account_id`. `@Unique`, `@Index`,
and `@Check` use the same constraint names as the SQL. Register the class in the `entities` array
in `apps/management-api/src/orm/db/index.ts`. No inverse relation on `AdminAccount`.

## Service (`apps/management-api/src/orm/services/adminSession.ts`)

Top-level functions on `AppDataSourceReadWrite` from `@management-api/orm/db/index.js`. Raw SQL,
not the repository. Every state change is one conditional statement or one transaction that locks
the row (`SELECT … FOR UPDATE`). Two requests on the same session must not lose an update or
un-revoke a row. Set `updated_at` to `now` on every write.

```typescript
export type AdminSessionRow = {
  id: string;
  id_text: string;
  admin_account_id: number;
  client_type: AccountSessionClientType;
  device_label: string | null;
  created_at: Date;
  last_seen_at: Date;
  idle_expires_at: Date;
};

export type AdminSessionStatus =
  | { status: 'active'; session: AdminSessionRow }
  | { status: 'revoked'; reason: AccountSessionRevokeReason }
  | { status: 'expired' }
  | { status: 'missing' };

export type AdminSessionRotateResult =
  | { outcome: 'rotated'; refreshTokenId: string; session: AdminSessionRow }
  | { outcome: 'reused' }
  | { outcome: 'revoked'; reason: AccountSessionRevokeReason }
  | { outcome: 'expired' }
  | { outcome: 'missing' };
```

Functions, each taking `now: Date` where it compares time:

- `createAdminSession({ adminAccountId, clientType, deviceLabel, idleExpiresAt, withRefreshToken })`
  → `{ session: AdminSessionRow; refreshTokenId: string | null }`. With `withRefreshToken`, mint
  the first refresh token id and store its hash.
- `getAdminSessionStatus({ sessionIdText, adminAccountId, now })` → `AdminSessionStatus`. A row
  for a different admin is `missing`. A revoked row reports its reason even when it is past
  `idle_expires_at`. One indexed lookup on `id_text`.
- `touchAdminSession({ sessionId, lastSeenAt, idleExpiresAt })` → `boolean`. Updates only where
  `revoked_at IS NULL`. Returns false otherwise.
- `rotateAdminSessionRefreshToken({ sessionIdText, adminAccountId, presentedTokenId, lastSeenAt,
  idleExpiresAt, now })` → `AdminSessionRotateResult`.
- `revokeAdminSession({ adminAccountId, sessionIdText, reason, now })` → `boolean`. Scoped to the
  admin. True only when an active row changed. An already-revoked row keeps its first reason.
- `revokeAdminSessions({ adminAccountId, reason, exceptSessionIdText, now })` → `number`.
  `exceptSessionIdText: null` ends all of them.
- `listActiveAdminSessions({ adminAccountId, now })` → `AdminSessionRow[]`: not revoked,
  `idle_expires_at > now`, newest `last_seen_at` first.
- `deleteAdminSessionsIdleExpiredBefore(cutoff: Date)` → `number`. Plan 61 calls it.

Parse rows with `Reflect.get` plus narrowing. No `as` on database rows.

### Rotation

Same rules as plan 10. Refresh-token ids are 32 random bytes from `node:crypto` `randomBytes`,
base64url-encoded. The service mints them and returns them raw. Callers never hash.

`rotateAdminSessionRefreshToken` locks the row, then:

1. Missing, another admin's row, revoked, or idle-expired → `missing`, `revoked` (with its
   reason), or `expired`. Change nothing.
1. `hash(presented) === current` → previous := current, current := hash(new id). Return
   `{ outcome: 'rotated', refreshTokenId, session }`.
1. `hash(presented) === previous` → current := hash(new id), previous unchanged. Return `rotated`.
   This is a client that never received the last response, at any delay.
1. Anything else → revoke with `refresh_reuse` in the same transaction and return
   `{ outcome: 'reused' }`.

Every `rotated` outcome also sets `last_seen_at` and `idle_expires_at` from the arguments.

## Tests

`apps/management-api/src/orm/services/adminSession.test.ts`. Mock
`@management-api/orm/db/index.js` the way `apps/management-api/src/lib/database/auditLog.test.ts`
mocks `AppDataSourceReadWrite`. Hold behavior, not SQL text:

- Rotation: current id rotates and moves to previous; previous id rotates and keeps previous; an
  unknown id revokes with `refresh_reuse` and returns `reused`; revoked, expired, and
  other-admin rows return their status without writing.
- The stored hash is never the raw id, and the returned id matches the hash written.
- `getAdminSessionStatus` reports `revoked` with its reason past `idle_expires_at`, and `missing`
  for another admin's row.
- `revokeAdminSessions` passes the except id through only when it is given.
- `createAdminSession` stores a null label for blank input and cuts a long one to 255.

Real-database coverage of the lock and the cascade belongs to plan 62's integration tests.

## Release scratchpad

```markdown
## Server-side admin session records (schema only)

- Surfaces: management-api database, k8s base env
- Change: new management migration `NNNN_admin_session.sql` adds the `admin_session` table (one
  row per admin login per client: client type, device label, last seen, idle expiry, revocation
  and reason, and refresh-token rotation state). Nothing reads or writes it until the management
  API session work lands. Deleting an admin removes the rows with the account.
- Who notices: operators only
- Operator steps: apply management migrations through `NNNN_admin_session.sql`. Management API
  readiness waits on that file (`MANAGEMENT_API_EXPECTED_MIGRATION_FILENAME`).
```

Replace `NNNN` with the real number.
