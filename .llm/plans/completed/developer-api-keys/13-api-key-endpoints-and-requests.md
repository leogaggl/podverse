**Cursor model:** Cursor Grok 4.7 · **Reasoning:** extra high

# 13 — Create, list, and revoke endpoints and the shared request calls

Adds `GET /auth/api-keys`, `POST /auth/api-keys`, and `DELETE /auth/api-keys/{api_key_id_text}`
beside the session endpoints, the `@podverse/helpers-requests` calls web and mobile use, the
OpenAPI operations, and integration tests. Session auth only: none of these routes declares
`apiKeyAccess`, so a key gets 403 `api_key_not_allowed` on all three (plan 12).

## Rows

R14, R17, R29, R32, R34, R35, R40, R49, R56, R57, R62, R63, R82

## Runs after

12

## Files

apps/api/src/lib/auth/apiKeyStore.ts
apps/api/src/controllers/account/accountApiKey.ts
apps/api/src/routes/auth.ts
packages/helpers-requests/src/api/auth/apiKeys.ts
packages/helpers-requests/src/api/_request.ts
apps/api/openapi.yml
apps/api/src/test/account-api-keys.integration.test.ts
release-notes/scratchpad.md

## Parity source

`AccountSessionController` (`apps/api/src/controllers/account/accountSession.ts`), the session
routes in `apps/api/src/routes/auth.ts`, `packages/helpers-requests/src/api/auth/sessions.ts`, the
`/auth/sessions` operations in `apps/api/openapi.yml`, and
`apps/api/src/test/account-session-list.integration.test.ts`. Copy their structure.

## Store additions (`apps/api/src/lib/auth/apiKeyStore.ts`)

```ts
export async function createApiKey(input: {
  accountId: number;
  name: string;
  permissions: ApiKeyPermissions;
  expiresInDays: ApiKeyExpirationDays;
}): Promise<{ apiKey: AccountApiKeyRow; token: string }>;
// expiresAt = apiKeyExpiresAt(new Date(), input.expiresInDays); calls createAccountApiKey.

export async function listApiKeys(accountId: number): Promise<AccountApiKeyRow[]>;
export async function countApiKeys(accountId: number): Promise<number>;
export async function revokeApiKey(input: {
  accountId: number;
  apiKeyIdText: string;
}): Promise<boolean>; // deleteAccountApiKey
```

## Controller `apps/api/src/controllers/account/accountApiKey.ts` (new)

`export class AccountApiKeyController` with `list`, `create`, `revoke`, each wrapping its body in
`ensureAuthenticated` and `try`/`handleGenericErrorResponse` like `AccountSessionController`.

```ts
function toAccountApiKeyDto(row: AccountApiKeyRow): DTOAccountApiKey {
  return {
    id_text: row.id_text,
    name: row.name,
    token_hint: row.token_hint,
    permissions: row.permissions,
    created_at: row.created_at.toISOString(),
    expires_at: row.expires_at === null ? null : row.expires_at.toISOString(),
    last_used_at: row.last_used_at === null ? null : row.last_used_at.toISOString(),
  };
}
```

### `list` — `GET /auth/api-keys`

Options `{ skipMembershipStatus: true, skipTermsAcceptance: true }`: an expired account can view
its keys (R34). Responds 200 `{ rows: DTOAccountApiKey[] }`, newest first, expired keys included.

### `create` — `POST /auth/api-keys`

Options `{ skipMembershipStatus: false }`: an expired account gets the existing 403
`membership_expired` body and cannot create (R35). Terms are enforced (the default). No
`requiredCapability`: any account with a valid membership may create (R32).

Validate with `validateBodyObject` (`@api/lib/validation/index.js`) and a schema defined in the
controller file, the way `apps/api/src/controllers/stats/statsListen.ts` defines `bodySchema`:

```ts
const permissionsSchema = Joi.object(
  Object.fromEntries(
    API_KEY_RESOURCES.map((resource) => [
      resource,
      Joi.number().integer().min(CRUD_MASK_NONE).max(CRUD_MASK_ALL),
    ])
  )
);

const createBodySchema = Joi.object({
  name: Joi.string().trim().min(1).max(API_KEY_NAME_MAX_LENGTH).required(),
  permissions: permissionsSchema.required(),
  expires_in_days: Joi.valid(...API_KEY_EXPIRATION_DAYS_OPTIONS).default(
    API_KEY_DEFAULT_EXPIRATION_DAYS
  ),
});
```

The global policy strips unknown keys, so an unknown resource name is dropped; the response
echoes the stored permissions, so a developer sees what the key holds. Then, in order:

1. `permissions = normalizeApiKeyPermissions(body.permissions)`. If
   `!apiKeyPermissionsGrantSupported(permissions)` → 400
   `{ message: 'Grant at least one permission.', code: 'api_key_permissions_empty' }`. Only
   supported cells count, so a mask that sets only unsupported bits (for example `history`
   create) is empty. This is the same check the web and mobile forms run.
2. If `countApiKeys(user.id) >= API_KEY_MAX_PER_ACCOUNT` (20, expired keys included) → 409
   `{ message: 'This account already has the most API keys allowed. Revoke one first.', code: 'api_key_limit_reached' }`.
   The count is a soft limit; two concurrent creates may both pass.
3. `createApiKey(…)` → 201 `DTOAccountApiKeyCreated` (`{ api_key, token }`). This response is the
   only place the token ever appears (R14).

Read `body` without `as`: type the validated `req.body` through a small guard or read each field
with `typeof` checks after validation.

### `revoke` — `DELETE /auth/api-keys/:api_key_id_text`

Options `{ skipMembershipStatus: true, skipTermsAcceptance: true }`: an expired account can
revoke (R34). `getParamRequired(req, 'api_key_id_text')`; not `isValidNanoIdV2IdText` → 404
`{ message: 'API key not found' }`. `revokeApiKey` false (no such key on this account, including
another account's key) → the same 404. Otherwise 200 `{ message: 'API key revoked' }`. Revoking
deletes the row; the key's next request gets 401 `api_key_invalid`.

Revoking an API key never ends a session, and ending sessions (sign out, password change,
password reset, invite password set, admin sign-out) never revokes keys. A key ends only when it
is revoked, expires, or its account is deleted. Nothing in this plan changes the session-ending
code; `endAccountSessions` and `revokeAccountSessions` touch only `account_session`.

## Routes (`apps/api/src/routes/auth.ts`)

Add after the session routes:

```ts
router.get('/api-keys', asyncHandler(AccountApiKeyController.list));
router.post('/api-keys', asyncHandler(AccountApiKeyController.create));
router.delete('/api-keys/:api_key_id_text', asyncHandler(AccountApiKeyController.revoke));
```

## Request calls (`@podverse/helpers-requests`)

New `packages/helpers-requests/src/api/auth/apiKeys.ts`, mirroring `sessions.ts`:

```ts
export const reqAuthApiKeys = (api: ApiRequestService): Promise<DTOAccountApiKey[]> =>
  api
    .apiRequest<{ rows: DTOAccountApiKey[] }>({
      path: '/auth/api-keys',
      method: 'GET',
      config: { withCredentials: true },
    })
    .then((response) => response.rows);

export const reqAuthApiKeyCreate = (
  api: ApiRequestService,
  body: AccountApiKeyCreateBody
): Promise<DTOAccountApiKeyCreated> =>
  api.apiRequest<DTOAccountApiKeyCreated>({
    path: '/auth/api-keys',
    method: 'POST',
    data: body,
    config: { withCredentials: true },
  });

export const reqAuthApiKeyRevoke = (
  api: ApiRequestService,
  apiKeyIdText: string
): Promise<ApiMessageResponse> =>
  api.apiRequest<ApiMessageResponse>({
    path: `/auth/api-keys/${encodeURIComponent(apiKeyIdText)}`,
    method: 'DELETE',
    config: { withCredentials: true },
  });
```

`packages/helpers-requests/src/api/_request.ts` (large file; anchor `reqAuthSessionsRevokeOthers`):
import the three functions beside the `./auth/sessions.js` import, and add methods
`reqAuthApiKeys()`, `reqAuthApiKeyCreate(body: AccountApiKeyCreateBody)`,
`reqAuthApiKeyRevoke(apiKeyIdText: string)` after `reqAuthSessionsRevokeOthers()` in the
`/* AUTH */` block.

## OpenAPI (`apps/api/openapi.yml`)

Grep `/auth/sessions/{session_id_text}:` (near line 9579) and add the new paths after that
operation, in the same style (`tags: [auth]`, `summary: <METHOD> <path>`, description). Every
operation's `security` is `bearerAuth` and `cookieAuth` only, never `apiKeyAuth`, and the
description says a key cannot call it.

- `/auth/api-keys` `get`, `operationId: apiGetAuthApiKeys`: 200 `ApiGetAuthApiKeysResponse200`;
  401; 403 `ApiKeyAuthorizationErrorResponse` (a key); 500. Description: lists the account's keys,
  newest first, expired keys included; works while membership is expired.
- `/auth/api-keys` `post`, `operationId: apiPostAuthApiKeys`: requestBody
  `ApiPostAuthApiKeysRequest` with an example (`name: My agent`, read on `playlists` and `queue`,
  `expires_in_days: 90`); 201 `DTOAccountApiKeyCreated` schema `ApiPostAuthApiKeysResponse201`
  with an example; 400 (`ValidationErrorResponse`, mention `api_key_permissions_empty`, returned when no
  supported action is set; unsupported bits alone do not count); 401; 403
  (`AuthorizationErrorResponse` for `membership_expired` and terms, or
  `ApiKeyAuthorizationErrorResponse`, as `oneOf`); 409 (`ErrorResponse`,
  `api_key_limit_reached`, described as "the account already holds 20 keys, expired keys
  included; revoke one first"); 500. Description: the token is returned only in this response;
  store it now. An account may hold at most 20 keys.
- `/auth/api-keys/{api_key_id_text}` `delete`, `operationId: apiDeleteAuthApiKey`: path param;
  200 `MessageResponse` example `API key revoked`; 401; 403 (key); 404 `NotFoundErrorResponse`;
  500. Description: deletes the key at once; works while membership is expired.

Schemas, beside `AccountSession` (near line 1674):

- `AccountApiKeyPermissions`: object, one integer property per resource in `API_KEY_RESOURCES`
  order, each `minimum: 0`, `maximum: 15`, with a description of the bits (create 1, read 2,
  update 4, delete 8).
- `AccountApiKey`: required `id_text`, `name`, `token_hint`, `permissions`, `created_at`,
  `expires_at` (nullable date-time), `last_used_at` (nullable date-time).
- `ApiGetAuthApiKeysResponse200` (`rows`), `ApiPostAuthApiKeysRequest` (`name` required, max 50;
  `permissions` required; `expires_in_days` enum `30`, `90`, `365`, nullable, default 90, null
  means no expiration), `ApiPostAuthApiKeysResponse201` (`api_key`, `token` with pattern
  `^pvk_[A-Za-z0-9_-]{43}$`).

## Out of scope

Management-api and management-web get no key list or revoke (R57). Admin account deletion removes
keys through the table's cascade (plan 11).

## Tests

`apps/api/src/test/account-api-keys.integration.test.ts` (API integration,
`startTestApp({ accountSessions: 'real' })`, file-unique email prefix `account-api-keys-`; account
creation and web login helpers as in `account-session-list.integration.test.ts`):

- Create with a session cookie: 201, `token` matches `isApiKeyTokenFormat`, `api_key.token_hint`
  equals the token's last four characters, `expires_at` about 90 days out when
  `expires_in_days` is omitted, null when it is null, about 30 days out for 30; the DTO has
  exactly the `DTOAccountApiKey` keys; the token string is not in the database (`token_hash`
  equals `sha256Hex(token)`).
- The created token gets 200 from `GET /auth/me` (plan 12's key route).
- List returns the keys newest first with no token field; `last_used_at` is null before use and
  set after the `/auth/me` call.
- Validation: missing name, a 51-character name, `expires_in_days: 60`, and a permission value of
  16 each get 400; all-zero permissions get 400 `api_key_permissions_empty`; permissions that set
  only unsupported bits (`{ settings: 2, history: 9 }`) also get 400 `api_key_permissions_empty`;
  `{ account: 2 }` alone gets 201.
- Limit: with 20 keys (`API_KEY_MAX_PER_ACCOUNT`) inserted through `createAccountApiKey`, one of
  them already expired by SQL update, the 21st create gets 409 `api_key_limit_reached`; after
  revoking one through the API, the next create gets 201.
- Revoke: 200 `{ message: 'API key revoked' }`; the token then gets 401 `api_key_invalid`;
  revoking again, an invalid id, and another account's key id each get 404.
- Expired membership (SQL update as in `archived-follow-conversion.integration.test.ts`): list and
  revoke still 200 with the session cookie; create gets 403 `membership_expired`.
- A full-access key gets 403 `api_key_not_allowed` on list, create, and revoke (R29).
- No credentials: 401 on all three.
- Keys outlive session endings (R63). Each case creates a key with `account` read through the
  API, ends sessions one way, then checks the key still gets 200 from `GET /auth/me` and the key
  row is still in `account_api_key`:
  - Password change: `POST /account/change-password` with the session cookie, body
    `{ current_password, new_password }`, as `account-change-password.integration.test.ts` does.
  - Password reset: insert a reset token with `AccountResetPasswordService` and
    `POST /account/reset-password` `{ token, password }`, as the `insertResetToken` helper and the
    forgotten-password case in `account-session-password.integration.test.ts` do. The old session
    cookie then gets 401; the key still gets 200.
  - Admin sign-out: call `revokeAccountSessions({ accountId, reason: 'admin_force_logout', exceptSessionIdText: null, now: new Date() })`
    from `@podverse/orm`, the function the management API's
    `apps/management-api/src/lib/endUserAccountSessions.ts` calls.

## Release scratchpad

```markdown
## Create, list, and revoke API keys

- Surfaces: api
- Change: `POST /auth/api-keys` creates a key from a signed-in session with a name, per-resource
  CRUD permissions (create 1, read 2, update 4, delete 8 for account, settings, subscriptions,
  add_by_rss, playlists, queue, history, clips, notifications), and an expiry of 30, 90 (default),
  or 365 days or none. The response carries the `pvk_…` token once; only its hash is stored.
  `GET /auth/api-keys` lists keys with last-used times; `DELETE /auth/api-keys/{id}` revokes one.
  An account may hold 20 keys, expired ones included; creating a 21st answers 409
  `api_key_limit_reached`. An expired membership can list and revoke but not create. A key can
  never call these endpoints. Keys survive password changes, password resets, and admin sign-outs. `@podverse/helpers-requests` adds `reqAuthApiKeys`,
  `reqAuthApiKeyCreate`, and `reqAuthApiKeyRevoke`.
- Who notices: developers; web and mobile Developer settings use these endpoints
- Operator steps: none
```
