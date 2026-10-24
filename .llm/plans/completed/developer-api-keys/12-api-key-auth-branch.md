**Cursor model:** Opus 5.5 · **Reasoning:** high

# 12 — Accept API keys in the API auth middleware

An API key is a third credential beside the web session cookie and the mobile access/refresh
pair. It arrives as `Authorization: Bearer pvk_…`. This plan teaches the auth middleware to
recognize it before JWT verification, check it, set `req.user` with the key's permissions, and
enforce three rules on every route: a route accepts a key only when it declares the permission it
needs, the key must hold that permission, and the account's membership must be valid even where
session users skip that check. It records last use without a write per request.

Session auth behaves exactly as before. No route other than `GET /auth/me` accepts a key after
this plan; area B declares the permission on the rest.

## No escalation (R59)

**A key can never do anything its owner cannot do as a normal signed-in user.** What makes that
true, and what must stay true:

- A key authenticates as its owner's account and nothing else. `req.user` carries the owner's
  `id` and `id_text`; there is no other identity, role, or admin flag on the key path.
- A key goes through the same terms, membership, and capability (`requiredCapability`) checks as
  the owner's session, with the same response bodies. The only difference is that a key is
  stricter: it gets the membership check even where `skipMembershipStatus` lets a session through.
  No route option skips a check for keys that it does not skip for sessions.
- A key reaches only routes that declare `apiKeyAccess`, and then only with the bit the route
  names. Everything else answers 403 `api_key_not_allowed`.
- `apps/api` has no admin routes, so there is nothing above a normal user for a key to reach.
- The management API never accepts a `pvk_` token: it has no key path, so the value fails JWT
  verification and gets 401. Plan 14 adds the test that proves it.

Put this rule, in two or three sentences, in the doc comment on `apiKeyAccess` in
`AuthenticatedRequestOptions` and in the `### Main API keys` docs section below.

## Rows

R8, R12, R13, R29, R33, R40, R49, R56, R58, R59, R60

## Runs after

10, 11

## Files

apps/api/src/lib/auth/sessionTokens.ts
apps/api/src/lib/auth/sessionTokens.test.ts
apps/api/src/lib/auth/apiKeyStore.ts
apps/api/src/lib/auth/index.ts
apps/api/src/@types/express.d.ts
apps/api/src/controllers/account/accountSession.ts
apps/api/src/controllers/account/account.ts
apps/api/openapi.yml
docs/development/API-CLIENT-BOUNDARIES.md
apps/api/src/test/api-key-auth.integration.test.ts
release-notes/scratchpad.md

## Fixed contracts (later plans build on these names)

### Route option

`AuthenticatedRequestOptions` in `apps/api/src/lib/auth/index.ts` gains:

```ts
/** The permission a key needs on this route. Omitted: the route never accepts a key. */
apiKeyAccess?: ApiKeyPermissionRequirement;
```

(`ApiKeyPermissionRequirement` from `@podverse/helpers`, plan 10.) Export the options type as
`AuthenticatedRequestOptions` so wrappers (`apps/api/src/lib/rateLimiter.ts`,
`apps/api/src/routes/billing.ts`, `apps/api/src/middleware/metaboostMintConsumeRateLimit.ts`) can
pass it through later. Default deny is the rule that keeps keys off key management, password,
email, account deletion, and billing (R29): those routes simply never declare `apiKeyAccess`.

### `req.user`

`apps/api/src/@types/express.d.ts`:

```ts
interface User {
  id: number;
  id_text: string;
  verified: boolean;
  /** `id_text` of the account session the request's token names; null for an API key. */
  session_id_text: string | null;
  /** The API key that authenticated the request; null for a session. */
  api_key: { id_text: string; permissions: ApiKeyPermissions } | null;
  entitlements?: AccountTrustEntitlements;
  /** The credential's expiry in epoch seconds: the JWT `exp`, or a key's `expires_at`. */
  token_expires_at?: number;
}
```

Add to `index.ts`:

```ts
/** The session id on a session-authenticated request. Throws on an API key request. */
export const getAuthenticatedSessionIdText = (req: Request): string => { … };
```

Use it at the four reads that need a session: `AccountSessionController.list`, `.revoke`,
`.revokeOthers` (`apps/api/src/controllers/account/accountSession.ts`) and the change-password
handler's `endAccountSessions({ exceptSessionIdText })` in
`apps/api/src/controllers/account/account.ts` (anchor `reason: 'password_changed'`). Those routes
never declare `apiKeyAccess`, so the throw is unreachable; it keeps a key from ever reaching
`exceptSessionIdText: null`, which would end every session.

### Request token

`apps/api/src/lib/auth/sessionTokens.ts`: `RequestToken` becomes
`{ token: string; source: 'cookie' | 'bearer' | 'api_key' }`. `readRequestToken` keeps its order
(the cookie wins over the header) and returns `source: 'api_key'` when the Bearer value passes
`hasApiKeyTokenPrefix`. A `pvk_` value that is malformed still goes down the key path, so the
caller gets `api_key_invalid` instead of a bare 401. Every existing caller that runs
`classifyAccessJwt` on the token keeps working: a key is rejected there, so `logout`,
`endSessionInPresentedCookie`, and `getActiveSessionAccountId` (used by `apps/api/src/controllers/item.ts`)
treat a key as no session.

### Responses

| Case | Status | Body |
| --- | --- | --- |
| Unknown, malformed, or revoked key; account gone | 401 | `{ message: 'Invalid API key', code: 'api_key_invalid' }` |
| Key past `expires_at` | 401 | `{ message: 'API key expired', code: 'api_key_expired' }` |
| Route has no `apiKeyAccess` | 403 | `{ message: 'API keys cannot be used for this endpoint.', code: 'api_key_not_allowed' }` |
| Key lacks the bit | 403 | `{ message: 'This API key needs the <action> permission on <resource>.', code: 'api_key_permission_denied', required_permission: { resource, action } }` |
| Terms not accepted (route enforces terms) | 403 | the existing `terms_acceptance_required` body |
| Membership expired, on any route | 403 | the existing `membership_expired` body (`code`, `i18nKey`, `renewPath`) |
| `requiredCapability` missing | 403 | the existing `feature_not_available_for_account_type` body |

Codes come from `API_KEY_ERROR_CODES`. The bodies must be byte-identical to the session path's
for the three existing cases; extract them into small functions both paths call rather than
copying the literals.

`optionalEnsureAuthenticated` treats a key the same as `ensureAuthenticated`: an invalid or
expired key is a 401, never anonymous access, and the route rules above apply. A developer who
sends a bad key learns it on the first request.

## Key path in `index.ts`

Branch on `requestToken.source === 'api_key'` before `verifySessionJwt` (in
`verifyTokenAndMembership` or a sibling it delegates to). Order:

1. `checkApiKey(token)` (store, below). Rejected → the 401 for its code.
2. Route rules from the key row alone: no `options.apiKeyAccess` → 403 not allowed;
   `!apiKeyPermissionsAllow(permissions, options.apiKeyAccess)` → 403 permission denied.
3. Load the account by `apiKey.account_id` with the membership relations always (ignore
   `skipMembershipStatus`) and the terms relation when terms are enforced
   (`options.skipTermsAcceptance !== true && config.terms.version !== ''`). No account → 401
   invalid.
4. Set `req.user`: `session_id_text: null`, `api_key: { id_text, permissions }`,
   `token_expires_at` = `Math.floor(expires_at.getTime() / 1000)` when the key expires.
5. Terms, then membership (always), then entitlements onto `req.user.entitlements`, then
   `requiredCapability`, with the shared bodies.
6. When `lastUsedDue`, `await recordApiKeyUse(apiKey)`; it logs and swallows its own errors.
7. `next()`.

The session path also sets `api_key: null`. Nothing else in the session path changes:
renewal, ended-session handling, cookie clearing, and the order of its checks stay as they are.
`rejectUnauthorized` clears the cookie only for `source === 'cookie'`, so a key 401 never sets a
cookie.

Never log the token. Log a key by `id_text` only. `redactForLog` already redacts the
`Authorization` header.

## `apps/api/src/lib/auth/apiKeyStore.ts` (new)

Mirrors `accountSessionStore.ts`: every API path that checks or records use of a key goes through
it, and it owns the clock.

```ts
export type ApiKeyCheck =
  | { kind: 'active'; apiKey: AccountApiKeyRow; lastUsedDue: boolean }
  | { kind: 'rejected'; code: typeof API_KEY_ERROR_CODES.invalid | typeof API_KEY_ERROR_CODES.expired };

export async function checkApiKey(token: string): Promise<ApiKeyCheck>;
/** Never throws; a failed write is logged with the key's id_text. */
export async function recordApiKeyUse(apiKey: AccountApiKeyRow): Promise<void>;
```

`lastUsedDue` is true when `last_used_at` is null or at least `API_KEY_LAST_USED_INTERVAL_MS`
old. `checkApiKey` maps `getAccountApiKeyStatus` (`missing` → invalid, `expired` → expired).
Plan 13 adds the create, list, and revoke functions to this module.

API integration tests that run with `startTestApp()` in stub mode mock only
`accountSessionStore.ts`; their tokens are JWTs, so they never reach this module. Do not add a
stub for it.

## `GET /auth/me` accepts keys

`AccountController.getLoggedInAccount` (`apps/api/src/controllers/account/account.ts`) adds
`apiKeyAccess: { resource: 'account', action: 'read' }` to its options. It is the "who am I"
check a developer runs first, and the route this plan's tests use. Its
`skipMembershipStatus: true` stays for sessions; a key on it still gets the membership check.

## OpenAPI (`apps/api/openapi.yml`)

Large file: grep the anchor, read a window, edit beside it.

- `components.securitySchemes` (after `bearerAuth`, near line 51): add

  ```yaml
  apiKeyAuth:
    type: http
    scheme: bearer
    bearerFormat: pvk_ API key
    description: >
      A long-lived API key created in Settings → Developer on web or mobile and shown once.
      Send it as `Authorization: Bearer pvk_…`. A key works only on operations that list
      `apiKeyAuth` in `security`; `x-api-key-permission` names the resource and CRUD action the
      key needs there. A key is rejected on every operation while the account's membership has
      expired. Keys never manage keys, change a password or email, delete the account, or reach
      billing.
  ```

  and give `bearerAuth` a description saying it is the session JWT (mobile access token, or the
  web token sent as a header), not an API key.
- `AuthenticationErrorResponse` (anchor `AuthenticationErrorResponse:`, near line 650): the
  `code` description adds `api_key_invalid` and `api_key_expired`.
- New schema `ApiKeyAuthorizationErrorResponse` beside `AuthorizationErrorResponse`: `allOf`
  `ErrorResponse` plus `code` (enum `api_key_not_allowed`, `api_key_permission_denied`) and
  `required_permission` (object, nullable; `resource` enum of the nine resources, `action` enum
  `create`/`read`/`update`/`delete`).
- New schema `ApiKeyPermissionRequirement` (the same `resource`/`action` object) for reuse.
- `/auth/me` `get` (anchor `/auth/me:`, near line 9302): `security` adds `- apiKeyAuth: []`; add
  `x-api-key-permission: { resource: account, action: read }` as a block mapping; add a `403`
  response whose schema is `oneOf` `ApiKeyAuthorizationErrorResponse` and
  `AuthorizationErrorResponse`, described as key-only (not allowed, permission, or expired
  membership).

`x-api-key-permission` is the extension name for every operation that accepts a key; area E adds
it to the rest from area B's table. `apps/management-api/openapi.yml` does not change (no keys
there).

## Docs

`docs/development/API-CLIENT-BOUNDARIES.md`: add `### Main API keys` after `### Main API sessions`.
Cover: a key is created and revoked from a signed-in session only; `Authorization: Bearer pvk_…`;
the cookie wins when a request carries both; only operations that declare a permission accept a
key; the error codes in the table above; expired membership rejects keys everywhere; a key can
never do anything its owner cannot do signed in (§ No escalation); the management API never
accepts a key; last use is recorded at most every five minutes; keys survive password changes,
password resets, and admin sign-outs, and end only when revoked, expired, or the account is
deleted.

## Tests

- `apps/api/src/lib/auth/sessionTokens.test.ts` (unit): `readRequestToken` returns
  `source: 'api_key'` for `Bearer pvk_…` (well-formed and malformed), still prefers the cookie
  over a key header, and still returns `bearer` for a JWT.
- `apps/api/src/test/api-key-auth.integration.test.ts` (API integration,
  `startTestApp({ accountSessions: 'real' })`, file-unique email prefix `api-key-auth-`). Create
  verified accounts as `account-session-list.integration.test.ts` does, and keys with
  `createAccountApiKey` from `@podverse/orm`. Expire memberships and keys with SQL updates as
  `archived-follow-conversion.integration.test.ts` does. Cases:
  - A key with `account` read gets 200 from `GET /auth/me` with that account's `id_text`, and
    `last_used_at` is set in the table; a second call within the interval leaves it unchanged.
  - A well-formed unknown key and a malformed `pvk_x` each get 401 `api_key_invalid`.
  - A key whose row was deleted gets 401 `api_key_invalid`.
  - A key with `expires_at` in the past gets 401 `api_key_expired`.
  - A key with only `playlists` read gets 403 `api_key_permission_denied` on `GET /auth/me` with
    `required_permission: { resource: 'account', action: 'read' }`.
  - A key with full access gets 403 `api_key_not_allowed` on `GET /auth/sessions` (a route
    without `apiKeyAccess`).
  - After the membership expires, the full-access key gets 403 `membership_expired` on
    `GET /auth/me`, while the same account's web session cookie still gets 200 there.
  - A request carrying a valid session cookie and a key with no `account` permission is
    authenticated by the cookie (200).
  - A key 401 response sets no `jwt` cookie.
- Same file, `describe('a key cannot do more than its owner')` (R60). `GET /auth/me` skips terms
  and has no capability, so these cases use probe routes. In `beforeAll`, after `startTestApp`,
  import `ensureAuthenticated` with `await import('../lib/auth/index.js')` (after the app starts,
  so it is the same module instance the app uses) and build a separate `express()` app holding
  only these GET routes, each answering `res.json({ ok: true })` from `next`:
  - `/probe/terms`: `{ skipMembershipStatus: false, apiKeyAccess: { resource: 'account', action: 'read' } }`
    (terms enforced by default).
  - `/probe/capability`: `{ skipMembershipStatus: false, skipTermsAcceptance: true, requiredCapability: ACCOUNT_ENTITLEMENT_CAPABILITY.allowNotifications, apiKeyAccess: { resource: 'notifications', action: 'read' } }`.
  - `/probe/membership`: `{ skipMembershipStatus: false, skipTermsAcceptance: true, apiKeyAccess: { resource: 'account', action: 'read' } }`.

  Send requests to the probe app with supertest, a full-access key in `Authorization`, and, for
  the session side, a web login cookie for the same account. Read the current terms version from
  `config.terms.version` (`../config/index.js`) after the app starts, create accounts with that
  version, and fail the `beforeAll` with a clear message when it is empty, since the terms case
  would prove nothing. Cases, each asserting the key and the session get the same answer:
  - Terms: after `UPDATE account_terms_acceptance SET terms_version = '2000-01-01' WHERE account_id = $1`,
    both get 403 `terms_acceptance_required` on `/probe/terms`; before the update both get 200.
  - Capability: after `UPDATE account_membership_status SET allow_notifications = false WHERE account_id = $1`,
    both get 403 `feature_not_available_for_account_type` on `/probe/capability`; before it both
    get 200.
  - Membership: after the membership expires, both get 403 `membership_expired` on
    `/probe/membership`.
  - The full-access key gets 403 `api_key_not_allowed` on a probe route copied from
    `/probe/membership` without `apiKeyAccess` (`/probe/closed`), while the session gets 200.

  The probe app lives only in this test file. It adds no route to `apps/api/src/app.ts`.

## Release scratchpad

```markdown
## The API accepts user-issued API keys

- Surfaces: api
- Change: `Authorization: Bearer pvk_…` authenticates as the key's account. A route accepts a key
  only when it declares the resource and CRUD action it needs (`GET /auth/me` needs account read);
  every other route answers 403 `api_key_not_allowed`. A key missing the permission gets 403
  `api_key_permission_denied` naming it. Unknown or revoked keys get 401 `api_key_invalid`,
  expired keys 401 `api_key_expired`. While the account's membership is expired, its keys get 403
  `membership_expired` on every route, including routes open to expired members' sessions. A key
  goes through the same terms and capability checks as its owner's session and can never do more
  than the owner can signed in. Last use is recorded at most every five minutes. The OpenAPI spec
  adds the `apiKeyAuth` scheme and the `x-api-key-permission` extension.
- Who notices: developers and agents calling the API with a key
- Operator steps: none
```
