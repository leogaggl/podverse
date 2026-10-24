**Cursor model:** Cursor Grok 4.7 · **Reasoning:** extra high

# 11 — `account_api_key` table, entity, and ORM service

Adds the key table (linear migration `0031`), its TypeORM entity, and a raw-SQL service that
mints a key, stores only its hash, checks a presented token, records last use, lists, counts,
and deletes. Regenerates the linear baselines and advances the API readiness marker.

## Rows

R14, R18, R40, R49, R57, R81

## Runs after

10

## Files

infra/k8s/base/ops/source/database/linear-migrations/app/0031_account_api_key.sql
infra/k8s/base/ops/kustomization.yaml
infra/k8s/base/api/source/api.env
infra/k8s/base/db/source/bootstrap/0004_app_linear_baseline.sql.gz
infra/k8s/base/db/source/bootstrap/0005_management_linear_baseline.sql.gz
packages/orm/src/entities/account/accountApiKey.ts
packages/orm/src/services/account/accountApiKey.ts
packages/orm/src/services/account/accountApiKey.test.ts
packages/orm/src/db/entities.ts
packages/orm/src/index.ts

## Shape reference

Follow `0024_account_session.sql`, `packages/orm/src/entities/account/accountSession.ts`, and
`packages/orm/src/services/account/accountSession.ts` (raw SQL through
`AppDataSourceReadWrite.manager.query`, `returnedRows`, `statementRowCount`, `Reflect.get` row
readers that throw on a malformed row, no `as`). Copy those private helpers into the new service;
do not import them from the session service (they are not exported).

## Migration `0031_account_api_key.sql`

Greenfield-only (**linear-sql-greenfield-only**): no `IF NOT EXISTS`. Header comment states what
the table guarantees, in present tense.

```sql
-- One row per API key. The token is shown once at creation; the row keeps only its SHA-256 hash
-- and its last four characters. Revoking a key deletes its row. Deleting the account deletes its
-- keys.
CREATE TABLE public.account_api_key (
    id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    id_text public.nano_id_v2 NOT NULL,
    account_id integer NOT NULL,
    name public.varchar_short NOT NULL,
    token_hash varchar(64) NOT NULL,
    token_hint varchar(4) NOT NULL,
    permissions jsonb NOT NULL,
    expires_at timestamp with time zone,
    last_used_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT account_api_key_id_text_key UNIQUE (id_text),
    CONSTRAINT account_api_key_token_hash_key UNIQUE (token_hash),
    CONSTRAINT account_api_key_account_id_fkey
        FOREIGN KEY (account_id) REFERENCES public.account(id) ON DELETE CASCADE,
    CONSTRAINT account_api_key_name_check CHECK (btrim(name) <> ''),
    CONSTRAINT account_api_key_permissions_check CHECK (jsonb_typeof(permissions) = 'object')
);

CREATE INDEX account_api_key_account_created_idx
    ON public.account_api_key (account_id, created_at DESC);

GRANT SELECT, INSERT, DELETE, UPDATE ON TABLE public.account_api_key TO podverse_app_read_write;
GRANT SELECT ON TABLE public.account_api_key TO podverse_app_read;
```

The unique `token_hash` index serves the per-request lookup. Account deletion from any surface,
including an admin deleting a user in management-api, removes the keys through the cascade; no
management code changes (R57).

## Readiness marker and kustomization

Per **migration-readiness-marker-sync**:

- `infra/k8s/base/api/source/api.env`: `API_EXPECTED_MIGRATION_FILENAME=0031_account_api_key.sql`.
- `infra/k8s/base/ops/kustomization.yaml`: the `API_EXPECTED_MIGRATION_FILENAME=` literal in
  `podverse-ops-migration-scripts` becomes `0031_account_api_key.sql`, and add
  `source/database/linear-migrations/app/0031_account_api_key.sql` after the `0026_` line in the
  app linear migrations `files` list.
- The management marker does not change.

The number is `0031`, not the next free `0027`. The popularity anti-gaming work
(`feature/popularity-anti-gaming`) owns app migrations `0027` through `0030` and reaches
`feature/combined` before this set. On this branch those four files do not exist yet, so the app
directory skips from `0026_` to `0031_`; that gap is expected, and the `files` list entry goes
after the `0026_` line. When that branch merges in, its entries go between `0026_` and `0031_`,
and the readiness marker stays `0031_account_api_key.sql`. If `0031_*` already exists in the app
directory when you start, stop and report rather than renumbering.

## Baselines

Run `make db_regen_linear_baseline`, then `make db_verify_linear_baseline` (**linear-baseline-0004**).
These generate committed artifacts; they are not tests. Leave both regenerated `.sql.gz` files in
the working tree. If Docker or the database tooling is unavailable, stop and report that the
baselines are not regenerated.

## Entity `packages/orm/src/entities/account/accountApiKey.ts`

Mirror `AccountSession`: `@Entity('account_api_key')`, `@Unique('account_api_key_id_text_key',
['id_text'])`, `@Unique('account_api_key_token_hash_key', ['token_hash'])`,
`@Index('account_api_key_account_created_idx', ['account_id', 'created_at'])`, both `@Check`s with
the SQL above, `ManyToOne('Account', …, { onDelete: 'CASCADE' })`. Columns: `id` (bigint identity,
`string`), `id_text` (`DATABASE_CONSTANTS.nano_id_v2`), `account_id`, `name`
(`DATABASE_CONSTANTS.varchar_short`), `token_hash` (`varchar_sha256_hex`), `token_hint`
(varchar 4), `permissions` (`jsonb`, typed `ApiKeyPermissions`), `expires_at` and `last_used_at`
(`timestamptz`, nullable), `created_at`, `updated_at`. Register it in
`packages/orm/src/db/entities.ts` beside `AccountSession` (import and array entry), and export it
from `packages/orm/src/index.ts` beside `./entities/account/accountSession.js`.

## Service `packages/orm/src/services/account/accountApiKey.ts`

Export from `packages/orm/src/index.ts` beside `./services/account/accountSession.js`.

```ts
export type AccountApiKeyRow = {
  id: string;
  id_text: string;
  account_id: number;
  name: string;
  token_hint: string;
  permissions: ApiKeyPermissions;
  created_at: Date;
  expires_at: Date | null;
  last_used_at: Date | null;
};

export type AccountApiKeyStatus =
  | { status: 'active'; apiKey: AccountApiKeyRow }
  | { status: 'expired' }
  | { status: 'missing' };

/** Mints the token, stores its hash and hint, and returns the raw token once. */
export async function createAccountApiKey(input: {
  accountId: number;
  name: string;
  permissions: ApiKeyPermissions;
  expiresAt: Date | null;
}): Promise<{ apiKey: AccountApiKeyRow; token: string }>;

/** The per-request check. A malformed token is `missing` without a query. */
export async function getAccountApiKeyStatus(input: {
  token: string;
  now: Date;
}): Promise<AccountApiKeyStatus>;

/** Sets last_used_at unless a later value is already stored. False when no row changed. */
export async function touchAccountApiKeyLastUsed(input: {
  apiKeyId: string;
  lastUsedAt: Date;
}): Promise<boolean>;

/** Every key of the account, expired ones included, newest first. */
export async function listAccountApiKeys(input: { accountId: number }): Promise<AccountApiKeyRow[]>;

export async function countAccountApiKeys(input: { accountId: number }): Promise<number>;

/** Deletes one of the account's own keys. False when the account has no key with that id_text. */
export async function deleteAccountApiKey(input: {
  accountId: number;
  apiKeyIdText: string;
}): Promise<boolean>;
```

Details:

- Token: `` `${API_KEY_TOKEN_PREFIX}${randomBytes(API_KEY_SECRET_BYTES).toString('base64url')}` ``;
  `token_hash` = `sha256Hex(token)`; `token_hint` = `token.slice(-API_KEY_TOKEN_HINT_LENGTH)`;
  `id_text` = `generateRandomIdText()` (`@orm/lib/nanoid.js`).
- `name` is trimmed before insert. The caller validates length; the service does not truncate.
- `permissions` is written as `JSON.stringify(normalizeApiKeyPermissions(input.permissions))`
  with a `$n::jsonb` cast, and read back through `normalizeApiKeyPermissions`.
- `getAccountApiKeyStatus`: return `missing` when `!isApiKeyTokenFormat(token)`. Otherwise
  `SELECT … FROM account_api_key WHERE token_hash = $1`. No row → `missing`;
  `isApiKeyExpired(row.expires_at, now)` → `expired`; else `active`.
- `touchAccountApiKeyLastUsed`: `UPDATE account_api_key SET last_used_at = $2 WHERE id = $1::bigint
  AND (last_used_at IS NULL OR last_used_at < $2)`. It does not touch `updated_at`; `updated_at`
  tracks edits to the key, and keys have no edit path today.
- `listAccountApiKeys`: `ORDER BY created_at DESC, id DESC`.
- `countAccountApiKeys`: `SELECT count(*)::int AS count`, read with `Reflect.get` and a number
  check.
- The raw token never reaches a log line or an error message.

## Tests

- `packages/orm/src/services/account/accountApiKey.test.ts` (unit, mocked `@orm/db/index.js` the
  way `accountSession.test.ts` mocks it):
  - `createAccountApiKey` returns a token matching `isApiKeyTokenFormat`, inserts
    `sha256Hex(token)` and the last four characters, never passes the raw token as a parameter,
    and normalizes permissions (unknown resource dropped, missing resource 0).
  - `getAccountApiKeyStatus`: malformed token returns `missing` without calling `query`; no row
    → `missing`; past `expires_at` → `expired`; null `expires_at` → `active`; the lookup
    parameter is the hash.
  - `touchAccountApiKeyLastUsed` returns false when the row count is 0.
  - `deleteAccountApiKey` scopes the delete by `account_id`.
- The API integration tests in plans 12 and 13 exercise the real table.

## Release scratchpad

```markdown
## API key table

- Surfaces: api, ops (app database)
- Change: migration `0031_account_api_key.sql` adds `account_api_key`: one row per user-issued
  API key with the token's SHA-256 hash and last four characters, per-resource CRUD permissions as
  JSON, optional expiry, and last-used time. Rows cascade on account deletion. The raw token is
  never stored.
- Who notices: operators running migrations
- Operator steps: run the linear migrations; `API_EXPECTED_MIGRATION_FILENAME` advances to
  `0031_account_api_key.sql`.
```
