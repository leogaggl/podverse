**Cursor model:** Opus 5.5 · **Reasoning:** high

# 10 — Account session table, entity, and ORM service

Server-side session rows for every user login on every client, plus the ORM functions the API
(plans 20–29), the management API (plans 50–59), and the purge worker (plan 11) call. This plan
adds no HTTP behavior: nothing creates or checks a session until plans 20–29 land.

Operator answers that shape it (00-REQUEST.md § Operator answers): one 365-day idle limit for
every client, renewed by use; a full session list with device label and last used; admins end all
of an account's sessions; the signed-out device shows the specific reason; admin logins get their
own table in the management database (plans 60–69, not this plan).

## Rows

R15, R16, R32, R38, R63

## Runs after

none

## Files

- infra/k8s/base/ops/source/database/linear-migrations/app/NNNN_account_session.sql
- infra/k8s/base/db/source/bootstrap/0004_app_linear_baseline.sql.gz
- infra/k8s/base/db/source/bootstrap/0005_management_linear_baseline.sql.gz
- infra/k8s/base/api/source/api.env
- packages/helpers/src/lib/accountSession.ts
- packages/helpers/src/index.ts
- packages/orm/src/entities/account/accountSession.ts
- packages/orm/src/db/entities.ts
- packages/orm/src/index.ts
- packages/orm/src/services/account/accountSession.ts
- packages/orm/src/services/account/accountSession.test.ts

`NNNN` is the next free number in `linear-migrations/app/` when this runs. The newest is
`0020_add_by_rss_feed_identity.sql` today, and the `realtime-banner-notifications` set also adds app
migrations, so re-list the folder first.

## Before you start

Other work is landing in the tree. Confirm the listed paths exist and re-read
`packages/orm/src/services/accountContentLog.ts` and `entities/account/accountContentLog.ts`,
which are the newest pattern for a raw-SQL service and a `varchar` + `CHECK` entity.

## Shared vocabulary (`packages/helpers/src/lib/accountSession.ts`)

Export from `packages/helpers/src/index.ts` next to `./lib/auth.js`.

```typescript
export const ACCOUNT_SESSION_CLIENT_TYPES = ['web', 'mobile'] as const;
export type AccountSessionClientType = (typeof ACCOUNT_SESSION_CLIENT_TYPES)[number];

export const ACCOUNT_SESSION_REVOKE_REASONS = [
  'signed_out',
  'signed_out_elsewhere',
  'password_changed',
  'admin_password_set',
  'admin_force_logout',
  'refresh_reuse',
] as const;
export type AccountSessionRevokeReason = (typeof ACCOUNT_SESSION_REVOKE_REASONS)[number];

export function isAccountSessionClientType(value: unknown): value is AccountSessionClientType;
export function isAccountSessionRevokeReason(value: unknown): value is AccountSessionRevokeReason;
```

Each reason, the event that writes it, and the copy the signed-out device should show. Plans 20–29
own the 401 shape and the final copy mapping. This is what the operator's answer implies:

| Reason | Written when | Signed-out device shows |
| --- | --- | --- |
| `signed_out` | the session signs itself out (`logout`, `revokeMobileToken`), or a new login on the same browser replaces it | nothing; that device already signed out |
| `signed_out_elsewhere` | the user ends this session from another session, one at a time or with "Sign Out of All Other Devices" | "You were signed out from another device" |
| `password_changed` | the user changes or resets their password | "Your password was changed" |
| `admin_password_set` | an admin sets the user's password (`POST /users/:id/password`) | "Your password was changed" |
| `admin_force_logout` | an admin uses Force Logout | "An administrator signed you out" |
| `refresh_reuse` | a refresh token that is neither current nor previous is presented (see Rotation) | "You were signed out for your security" |

`admin_password_set` is its own value so the row records who acted, even though the device shows
the same text as `password_changed`. A future client gets a new `ACCOUNT_SESSION_CLIENT_TYPES`
value plus a migration that widens the `CHECK`.

Account deletion has no reason. The row is deleted with the account (cascade), and a request on it
fails the account lookup first.

## Migration (`NNNN_account_session.sql`)

Greenfield-only (**linear-sql-greenfield-only**): no `IF NOT EXISTS` guards.

```sql
-- One row per login on one client. A token names its row by id_text; a revoked or idle-expired
-- row fails the request that carries it. Revoked rows stay until idle_expires_at plus the purge
-- retention, so a device that returns within its idle limit is told why it was signed out.
CREATE TABLE public.account_session (
    id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    id_text public.nano_id_v2 NOT NULL,
    account_id integer NOT NULL,
    client_type varchar(16) NOT NULL,
    device_label public.varchar_normal,
    last_seen_at timestamp with time zone DEFAULT now() NOT NULL,
    idle_expires_at timestamp with time zone NOT NULL,
    refresh_token_hash varchar(64),
    previous_refresh_token_hash varchar(64),
    revoked_at timestamp with time zone,
    revoked_reason varchar(32),
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT account_session_id_text_key UNIQUE (id_text),
    CONSTRAINT account_session_account_id_fkey
        FOREIGN KEY (account_id) REFERENCES public.account(id) ON DELETE CASCADE,
    CONSTRAINT account_session_client_type_check
        CHECK (client_type IN ('web', 'mobile')),
    CONSTRAINT account_session_revoked_reason_check
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
    CONSTRAINT account_session_revoked_pair_check
        CHECK ((revoked_at IS NULL) = (revoked_reason IS NULL))
);

CREATE INDEX account_session_account_active_idx
    ON public.account_session (account_id, last_seen_at DESC)
    WHERE revoked_at IS NULL;

CREATE INDEX account_session_idle_expires_at_idx
    ON public.account_session (idle_expires_at);

GRANT SELECT, INSERT, DELETE, UPDATE ON TABLE public.account_session TO podverse_app_read_write;
GRANT SELECT ON TABLE public.account_session TO podverse_app_read;
```

Column notes:

- `id_text` is what tokens and the session API carry. Generate it in the service with
  `generateRandomIdText` (`packages/orm/src/lib/nanoid.ts`); the column has no DB default, the same
  as other `id_text` columns.
- `device_label` is nullable. Plans 20–29 derive it (browser and OS from the User-Agent on web; the
  device name the app sends on mobile). The service trims it and cuts it to
  `DATABASE_CONSTANTS.varchar_normal`; an empty result is stored as null.
- `idle_expires_at` is stored, not computed from config at read time, so a later change to the idle
  limit applies on each session's next renewal rather than expiring or reviving sessions all at
  once. The caller passes it; the ORM reads no auth config.
- `refresh_token_hash` and `previous_refresh_token_hash` are the hex SHA-256 of the refresh token
  ids (see Rotation). Web rows leave both null. Raw ids are never stored.
- Every row is created by a login. A token that names no session row is rejected by plans 20–29;
  nothing maps a token onto a row after the fact.
- Account deletion (API `AccountController.delete` → `AccountService.delete`, and management API
  `DELETE /users/:id`) hard-deletes the `account` row, so the cascade removes every session. R32
  needs no code beyond this foreign key.

After writing the file, run `make db_regen_linear_baseline` then `make db_verify_linear_baseline`
(generated artifacts, per **linear-baseline-0004**), and leave both regenerated `.sql.gz` files in
the tree. Set `API_EXPECTED_MIGRATION_FILENAME` in `infra/k8s/base/api/source/api.env` to the new
filename (**migration-readiness-marker-sync**). The management API marker is unchanged.

## Entity (`packages/orm/src/entities/account/accountSession.ts`)

Mirror `AccountContentLog`: `@Entity('account_session')`, the `@Unique`, `@Index`, and `@Check`
decorators with the same constraint names as the SQL, `@PrimaryGeneratedColumn('identity', { type:
'bigint', generatedIdentity: 'ALWAYS' })` typed `string`, `client_type` typed
`AccountSessionClientType`, `revoked_reason` typed `AccountSessionRevokeReason | null`, timestamps
`timestamptz`, and a `ManyToOne('Account', …, { onDelete: 'CASCADE' })`. Register it in
`packages/orm/src/db/entities.ts` and export it from `packages/orm/src/index.ts`. No inverse relation
on `Account`.

## Service (`packages/orm/src/services/account/accountSession.ts`)

Top-level exported functions on `AppDataSourceReadWrite`, like `accountContentLog.ts`, so the API
and the management API (which binds its app data source through `bindORMContext`) call the same code.
Export everything from `packages/orm/src/index.ts`.

Write every state change as one conditional SQL statement or one transaction that locks the row
(`SELECT … FOR UPDATE`). Two requests on the same session can arrive at once (two browser tabs, an
admin and the user, a refresh racing a sign-out), and none of the functions may lose an update or
un-revoke a row.

```typescript
export type AccountSessionRow = {
  id: string;
  id_text: string;
  account_id: number;
  client_type: AccountSessionClientType;
  device_label: string | null;
  created_at: Date;
  last_seen_at: Date;
  idle_expires_at: Date;
};

export type AccountSessionStatus =
  | { status: 'active'; session: AccountSessionRow }
  | { status: 'revoked'; reason: AccountSessionRevokeReason }
  | { status: 'expired' }
  | { status: 'missing' };
```

Functions, each taking `now: Date` where it compares time, so tests and callers share one clock:

- `createAccountSession({ accountId, clientType, deviceLabel, idleExpiresAt, withRefreshToken })`
  → `{ session: AccountSessionRow; refreshTokenId: string | null }`. With `withRefreshToken`, it
  mints the first refresh token id and stores its hash.
- `getAccountSessionStatus({ sessionIdText, accountId, now })` → `AccountSessionStatus`. A row for a
  different account is `missing`. A revoked row reports its reason even when it is past
  `idle_expires_at`, so a device told nothing for months still learns why. This is the per-request
  check; one indexed lookup on `id_text`. Plans 20–29 decide whether to fold it into the account
  query.
- `touchAccountSession({ sessionId, lastSeenAt, idleExpiresAt })` → `boolean`. It updates only
  where `revoked_at IS NULL` and returns false otherwise. How often it is called (web at most once
  a day) is decided by plans 20–29.
- `rotateAccountSessionRefreshToken({ sessionIdText, accountId, presentedTokenId, lastSeenAt,
  idleExpiresAt, now })` → `AccountSessionRotateResult` (see Rotation):

  ```typescript
  export type AccountSessionRotateResult =
    | { outcome: 'rotated'; refreshTokenId: string; session: AccountSessionRow }
    | { outcome: 'reused' }
    | { outcome: 'revoked'; reason: AccountSessionRevokeReason }
    | { outcome: 'expired' }
    | { outcome: 'missing' };
  ```

- `revokeAccountSession({ accountId, sessionIdText, reason, now })` → `boolean`. It is scoped to the
  account, so a user can only end their own sessions, and it is true only when an active row
  changed. An already-revoked row keeps its first reason.
- `revokeAccountSessions({ accountId, reason, exceptSessionIdText, now })` → `number` of rows
  changed. `exceptSessionIdText: null` ends all of them (admin Force Logout, admin password set,
  password reset); a value keeps the caller's own session ("Sign Out of All Other Devices", password
  change).
- `listActiveAccountSessions({ accountId, now })` → `AccountSessionRow[]`: not revoked,
  `idle_expires_at > now`, newest `last_seen_at` first. Plans 20–29 map these to the response shape
  and mark the caller's own row.
- `deleteAccountSessionsIdleExpiredBefore(cutoff: Date)` → `number`. Plan 11 calls it.

Parse rows the way `readContentLogRow` does: `Reflect.get` plus narrowing, with no `as`.

### Rotation

Refresh-token ids are 32 random bytes from `node:crypto` `randomBytes`, base64url-encoded. The
service mints them and returns them raw; callers embed the id in the refresh token and never
compute a hash themselves. The row stores two hashes:

- **current**: the id most recently handed to the client
- **previous**: the id the client last presented successfully

`rotateAccountSessionRefreshToken` locks the row, then:

1. A missing row, another account's row, a revoked row, or an idle-expired row returns `missing`,
   `revoked` (with its reason), or `expired`, and changes nothing.
1. `hash(presented) === current` → previous := current, current := hash(new id). Returns
   `{ outcome: 'rotated', refreshTokenId, session }`.
1. `hash(presented) === previous` → current := hash(new id), previous unchanged. Returns
   `rotated` the same way. This is a client that never received the last response (lost in transit,
   app killed mid-request), at any delay, so it is never read as theft.
1. Anything else → revoke the row with `refresh_reuse` in the same transaction and return
   `{ outcome: 'reused' }`.

Every `rotated` outcome also sets `last_seen_at` and `idle_expires_at` from the arguments.

Why theft is still caught: when two holders share a token, each refresh mints a new current that
orphans the other holder's copy, and the orphaned holder's next refresh lands in step 4. The one
case this cannot tell apart from theft is a single client sending two refreshes at once and then
keeping the older response. Plans 40–49 make mobile refresh single-flight and store each rotated
token durably before using it, which removes that case.

## Tests

`packages/orm/src/services/account/accountSession.test.ts`, mocking `@orm/db/index.js` as
`accountContentLog.test.ts` does. Behavior to hold, not SQL text:

- Rotation outcomes: current id rotates and moves to previous; previous id rotates and keeps
  previous; an unknown id revokes with `refresh_reuse` and returns `reused`; revoked, expired, and
  other-account rows return their status without writing.
- The stored hash is never the raw id, and the returned id matches the hash written.
- `getAccountSessionStatus` reports `revoked` with its reason past `idle_expires_at`, and `missing`
  for another account's row.
- `revokeAccountSessions` passes the except id through only when it is given.
- `createAccountSession` stores a null label for blank input and cuts a long one.

Real-database coverage of the locking and the cascade belongs to the API integration tests in
plans 20–29: concurrent refreshes on one session, and every session row gone after account deletion.

## Release scratchpad

```markdown
## Server-side session records (schema only)

- Surfaces: api database, k8s base env
- Change: new app migration `NNNN_account_session.sql` adds the `account_session` table (one row
  per login per client: client type, device label, last seen, idle expiry, revocation and reason,
  and refresh-token rotation state). Nothing reads or writes it until the API session work lands.
- Who notices: operators only
- Operator steps: apply app migrations through `NNNN_account_session.sql`. API readiness waits on
  that file (`API_EXPECTED_MIGRATION_FILENAME`).
```

Replace `NNNN` with the real number.
