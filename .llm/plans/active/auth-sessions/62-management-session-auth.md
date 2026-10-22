**Cursor model:** Opus 5.5 · **Reasoning:** high

# 62 — Session-bound management API auth

Every management login creates an `admin_session` row (plan 60), every token names its row, and
every authenticated request checks the row. The web cookie renews as it is used, the mobile
refresh token rotates, and `logout` and `/auth/mobile/revoke` end the calling session. A token
that names no session is rejected as unauthenticated.

This is one change. A token without a session check cannot be revoked. No environment holds
logins that must survive the deploy (00-REQUEST.md § Review of the first planning pass,
"Greenfield"), so every admin signs in again once after it.

Operator answer (00-REQUEST.md): the same session model, the same renewal and revocation. A
superuser force-logout is plan 65. Password changes are plan 63. The session list is plan 64.
Showing the reason in management-web is plan 66.

## Rows

R46, R63

## Runs after

20, 60, 61

Plan 20 adds `isSessionAccessJwtPayload`, `isSessionRefreshJwtPayload`,
`DEFAULT_AUTH_SESSION_IDLE_EXPIRATION`, and `getAuthSessionEndedNotice`. Plan 61 edits
`config/index.ts`, startup validation, `.env.example`, `ENV.md`, and `management-api.env` for
the retention var. Keep that var.

## Files

- apps/management-api/src/lib/auth/index.ts
- apps/management-api/src/lib/auth/adminSessionStore.ts
- apps/management-api/src/lib/auth/sessionTokens.ts
- apps/management-api/src/lib/auth/sessionTokens.test.ts
- apps/management-api/src/lib/auth/deviceLabel.ts
- apps/management-api/src/lib/auth/deviceLabel.test.ts
- apps/management-api/src/@types/express.d.ts
- apps/management-api/src/config/index.ts
- apps/management-api/src/lib/startup/validation.ts
- apps/management-api/.env.example
- apps/management-api/ENV.md
- apps/management-api/openapi.yml
- infra/k8s/base/management-api/source/management-api.env
- infra/k8s/K8S.md
- infra/k8s/INFRA-K8S.md
- packages/helpers-config/src/podverseTestEnv.ts
- packages/helpers/src/lib/auth.ts
- packages/helpers/src/lib/auth.test.ts
- packages/helpers/src/lib/parseEnvExpiration.ts
- .cursor/skills/env-expiration-naming/SKILL.md
- docs/development/API-CLIENT-BOUNDARIES.md
- packages/management-api-requests/src/auth.ts
- apps/management-api/vitest.config.ts
- apps/management-api/vitest.setup.stub-sessions.ts
- apps/management-api/vitest.admin-session.real.config.ts
- apps/management-api/package.json
- apps/management-api/src/test/adminSessionStoreStub.ts
- apps/management-api/src/routes/auth.integration.test.ts
- apps/management-api/src/routes/admin-session.real.integration.test.ts

## Before you start

Confirm the paths exist. Re-read `apps/management-api/src/lib/auth/index.ts` in full. Grep
`apps/management-api/src` for `config.auth.` and `pv_mgmt_auth`. Plan 20 must have landed the
helpers named above. If any is missing, stop and report.

Do not edit `apps/api/**` or `packages/orm/**`. Do not import `apps/api/src/lib/auth/*`. In
`packages/helpers`, this plan only deletes the exports listed under § Exports with no readers; it
does not change plan 20's guards or constants.

## What stays different from the main API

Transcribe these. They are locked.

- Cookie name stays `pv_mgmt_auth` (`ADMIN_AUTH_COOKIE_NAME`).
- Token read order stays bearer, then cookie. Programmatic clients and the existing test
  "prefers Authorization Bearer over a stale pv_mgmt_auth cookie" depend on it. The main API
  reads the cookie first. Do not switch this.
- Mobile tokens keep `scope: 'podverse_management_mobile'`. Web tokens (`token_use: 'web'`) have
  no scope claim.
- There is no `optionalEnsureAuthenticated`. An ended session on `ensureAuthenticated` is a 401.
  Do not add an anonymous path.
- `POST /auth/logout` still returns `{ message: 'Logged out successfully' }`.
- `POST /auth/mobile/revoke` still returns `{ message: 'Mobile token family revoked' }`, including
  a missing or invalid token. It now also ends the server session.
- A missing `refresh_token` on `/auth/mobile/refresh` stays 400 `{ message: 'refresh_token is
  required' }`.
- `includeTokenInResponseBody` behavior stays.

## Token model

Reuse the plan 20 guards. Do not change them. Sign with `AUTH_JWT_SECRET`.

| Kind | Claims | Lifetime | Carried in |
| --- | --- | --- | --- |
| Web | `id`, `id_text`, `sid`, `token_use: 'web'` | idle limit | `pv_mgmt_auth` cookie, or the login body when `AUTH_ALLOW_TOKEN_IN_RESPONSE_BODY` allows |
| Mobile access | `id`, `id_text`, `sid`, `scope: 'podverse_management_mobile'`, `token_use: 'access'` | `AUTH_MOBILE_ACCESS_TOKEN_EXPIRATION` (900) | `Authorization: Bearer` |
| Mobile refresh | `id`, `id_text`, `sid`, `rid`, `scope: 'podverse_management_mobile'`, `token_use: 'refresh'` | idle limit | `/auth/mobile/refresh` and `/auth/mobile/revoke` bodies |

`sid` is the session `id_text`. `rid` is the raw refresh-token id plan 60 mints.

`apps/management-api/src/lib/auth/sessionTokens.ts`:

- `signWebSessionToken({ adminId, adminIdText, sessionIdText })`.
- `signMobileTokenPair({ adminId, adminIdText, sessionIdText, refreshTokenId })` → today's
  response shape. `refresh_token_expires_in` is the idle limit. Both tokens include
  `scope: 'podverse_management_mobile'`.
- `readRequestToken(req)` → `{ token, source: 'cookie' | 'bearer' } | null`. Bearer first, then
  `pv_mgmt_auth`. Same extraction as today's `getAuthTokenFromRequest`, plus the source.
- `classifyAccessJwt(decoded)` → `{ kind: 'session'; claims }` | `{ kind: 'rejected' }`. A
  session access payload must pass `isSessionAccessJwtPayload`. If `token_use` is `'access'`,
  `scope` must be exactly `'podverse_management_mobile'`; otherwise rejected. If `token_use` is
  `'web'`, a `scope` claim rejects it. Any payload with no `sid` is rejected. Keep today's 401
  message `Unauthorized`. Validate `sid` and `id_text` with `isValidNanoIdV2IdText`.
- `classifyRefreshJwt(decoded)` → `{ kind: 'session'; claims }` | `{ kind: 'rejected' }`. A
  session refresh payload must pass `isSessionRefreshJwtPayload` and `scope` must be
  `'podverse_management_mobile'`.

Narrow with the guards. No `as` on decoded payloads. The `decoded as DecodedToken` in
`verifyToken` goes away.

Copy `apps/api/src/lib/auth/deviceLabel.ts` to
`apps/management-api/src/lib/auth/deviceLabel.ts` unchanged, and copy its test. Do not import
across apps. `deviceLabelFromUserAgent` and `deviceLabelForMobile` are the two exports.

## Session store (`apps/management-api/src/lib/auth/adminSessionStore.ts`)

The only caller of plan 60's functions. It owns the clock, the idle limit from config, and the
notice mapping.

```typescript
export type AdminSessionCheck =
  | { kind: 'active'; session: AdminSessionRow; renewDue: boolean }
  | { kind: 'ended'; notice: AuthSessionEndedNotice | null };
```

- `startAdminSession({ adminAccountId, clientType, deviceLabel, withRefreshToken })` →
  `{ sessionIdText, refreshTokenId }` (`refreshTokenId` null for web).
- `checkAdminSession({ adminAccountId, sessionIdText })` → `AdminSessionCheck`. `renewDue` is
  true when `now - last_seen_at` is at least `ADMIN_SESSION_RENEW_INTERVAL_MS` (`ONE_DAY_MS`, a
  module constant, not an env var). Revoked maps through `getAuthSessionEndedNotice`. Expired
  and missing map to `ended` with a null notice.
- `renewAdminSession(session)` → `boolean` via `touchAdminSession`.
- `rotateAdminRefreshToken({ adminAccountId, sessionIdText, presentedTokenId })` →
  `{ kind: 'rotated'; refreshTokenId; session } | { kind: 'ended'; notice }`. `reused` maps to
  the `refresh_reuse` notice (`security`).
- `endAdminSession({ adminAccountId, sessionIdText, reason })` → `boolean`.
- `endAdminSessions({ adminAccountId, reason, exceptSessionIdText })` → `number`.
- `listAdminSessions(adminAccountId)` → `AdminSessionRow[]` (plan 64).

Idle length is `config.auth.sessionIdleExpiration` seconds. `idleExpiresAt` is `now` plus that
many seconds.

## Signed-out body

Reuse plan 20. Do not define a second notice union.

```json
{ "message": "Unauthorized", "code": "session_ended", "notice": "signed_out_elsewhere" }
```

With no notice (self sign-out, idle expiry, missing row, deleted admin), the 401 is
`{ "message": "Unauthorized" }`. Mobile refresh keeps `Invalid refresh token`, plus `code` and
`notice` when the notice is not null. The raw revoke reason never leaves the API.

## Request flow

### `ensureAuthenticated` / `verifyToken`

1. `readRequestToken`. No token → 401 as today.
1. `jwt.verify`, then `classifyAccessJwt`. Rejected → 401 `Unauthorized`.
1. Load the admin (`getWithRoleAndPermissions`) and run `checkAdminSession` in parallel with the
   lookup (`Promise.all`).
1. No admin, or `id_text` mismatch → 401 as today. Session `ended` → 401 with the notice body.
1. Active → `req.user` as today plus `session_id_text` (add it to `AuthenticatedAdmin` in
   `apps/management-api/src/@types/express.d.ts`).
1. `renewDue` → `renewAdminSession`. When it returns true and `client_type` is `web` and the
   token came from the cookie, sign a fresh web token and `setAuthCookie`. A web token sent as
   a bearer gets its row renewed and no new token. Renewal failures are logged and do not fail
   the request.
1. Every 401 this function sends for a cookie-sourced token also `clearAuthCookie`. A
   bearer-sourced 401 does not clear the cookie.

Remove the unused `passport-jwt` `JwtStrategy` registration and its import. Nothing calls
`passport.authenticate('jwt')`. Leave the `passport-jwt` package in `package.json`. Keep
`LocalStrategy`, `serializeUser`, and `deserializeUser`.

Export `clearAuthCookie` next to `setAuthCookie`. `setAuthCookie` keeps its attributes; `maxAge`
becomes the idle limit. `clearAuthCookie` clears host-only and, in production, the
`COOKIE_DOMAIN` cookie, matching today's `logout`.

### `authenticate` (web login)

After the password check: if the request already carries a cookie that classifies as a session
token with a valid signature, `endAdminSession` it with `signed_out` (a second login in one
browser replaces its session). Then `startAdminSession({ clientType: 'web', deviceLabel:
deviceLabelFromUserAgent(req) })`, sign the web token, set the cookie, and keep the
`includeTokenInResponseBody` behavior. Login JSON stays `{ message: 'Authenticated successfully' }`.

### `issueMobileToken`

After `verifyPassword`: `startAdminSession({ clientType: 'mobile', deviceLabel, withRefreshToken:
true })`, then `signMobileTokenPair`. The body accepts an optional `device_label` string. The
label is `device_label` when it is a non-empty string, else `deviceLabelForMobile` from
`X-Podverse-Client-Platform` (`ios` → `iOS`, `android` → `Android`), else null. Empty email or
password stays 400.

### `refreshMobileToken`

1. Empty body → 400 as today.
1. Verify and `classifyRefreshJwt`. Rejected → 401 `Invalid refresh token`.
1. Load the admin by `id` and require `id_text` to match. No admin → 401 `Invalid refresh token`.
1. `rotateAdminRefreshToken({ presentedTokenId: claims.rid })`.
1. `rotated` → `signMobileTokenPair` with the new id. `ended` → 401 `Invalid refresh token`, plus
   `code` and `notice` when the notice is not null.

Rotation is plan 60's: current or previous rotates; anything else revokes as `refresh_reuse`.
The existing auth test that refreshes the same token twice and expects both 200 still holds,
because the second call presents the previous id.

### `logout` and `revokeMobileToken`

- `logout`: read the request token. A session token → `endAdminSession(…, 'signed_out')`. Then
  `clearAuthCookie` and `{ message: 'Logged out successfully' }`. A missing or invalid token still clears the cookie
  and returns 200. Errors ending the session are logged, not returned.
- `revokeMobileToken` becomes async. A validly signed session refresh token ends its session
  with `signed_out` (no current/previous check). Always 200 `{ message: 'Mobile token family revoked' }`.

## Config, env, and docs

- `config.auth` becomes `jwtSecret`, `sessionIdleExpiration` (from `AUTH_SESSION_IDLE_EXPIRATION`,
  default `DEFAULT_AUTH_SESSION_IDLE_EXPIRATION`, via `readOptionalPositiveExpirationEnv`),
  `sessionCookieMaxAgeMs` (idle × `MS_PER_SECOND`), `mobileAccessTokenExpiration`,
  `allowTokenInResponseBody`, and the retention field plan 61 added. Remove `jwtExpiration` and
  `mobileRefreshTokenExpiration`, and the `DEFAULT_AUTH_JWT_EXPIRATION` and
  `DEFAULT_AUTH_MOBILE_REFRESH_TOKEN_EXPIRATION` imports.
- Startup validation: replace the `AUTH_JWT_EXPIRATION` and `AUTH_MOBILE_REFRESH_TOKEN_EXPIRATION`
  pushes with one for `AUTH_SESSION_IDLE_EXPIRATION` (`Blank uses default (31536000 seconds)`),
  in that same position. Keep the access-token push and plan 61's retention push.
- `.env.example`: replace the JWT and mobile-refresh blocks with
  `AUTH_SESSION_IDLE_EXPIRATION="31536000"` and a comment: idle limit in seconds for every
  management client; each use renews it; blank uses 31536000 (365d). Keep the access-token block
  and plan 61's retention block.
- `management-api.env`: the same replacement, unquoted, one-line comment. Keep the migration
  marker and `ADMIN_SESSION_RETENTION_DAYS`.
- `managementApiTestEnvBase` in `packages/helpers-config/src/podverseTestEnv.ts`: replace
  `AUTH_JWT_EXPIRATION` and `AUTH_MOBILE_REFRESH_TOKEN_EXPIRATION` with
  `AUTH_SESSION_IDLE_EXPIRATION: '31536000'`. Do not edit `apiTestEnvBase` (plan 20 owns it).
- `ENV.md`: document `AUTH_SESSION_IDLE_EXPIRATION` (bounds the cookie, the web JWT, and the
  refresh JWT; renewed at most once a day; revocation is server-side) and drop the two removed
  keys. Say that rotating `AUTH_JWT_SECRET` ends every admin session at once, and that ending
  one session is done through the session endpoints and force-logout.
- `docs/development/API-CLIENT-BOUNDARIES.md`: plan 20 scoped the built contract to the main API
  and left the management lines. Update the management lines to the same contract: session-bound
  tokens, rotation with the previous token accepted, reuse revokes the session, revocation
  checked on every request, `session_ended` 401 body, cookie `pv_mgmt_auth` renewed at most once
  a day, scope `podverse_management_mobile`. Keep the sentence that `/auth/mobile/revoke` on the
  management API returns `Mobile token family revoked`.
- `infra/k8s/K8S.md` and `infra/k8s/INFRA-K8S.md`: the paragraph that lists
  `AUTH_JWT_EXPIRATION` for both APIs. After plan 20 the main API uses
  `AUTH_SESSION_IDLE_EXPIRATION`. After this plan both APIs do. Update that sentence so it names
  `AUTH_SESSION_IDLE_EXPIRATION` for both, and still names `AUTH_MOBILE_ACCESS_TOKEN_EXPIRATION`
  and `AUTH_ALLOW_TOKEN_IN_RESPONSE_BODY`.
- Rewrite the header comment in `apps/management-api/src/lib/auth/index.ts` for this model, and
  remove its `isMobileRefreshJwtPayload` import.
- `.cursor/skills/env-expiration-naming/SKILL.md`: its § Do env example names
  `AUTH_JWT_EXPIRATION`, which no app reads after this plan. Replace it with
  `AUTH_SESSION_IDLE_EXPIRATION`.

## Exports with no readers

After plan 20 and this plan, nothing reads these `@podverse/helpers` exports. Delete them:

- `packages/helpers/src/lib/auth.ts`: `DEFAULT_AUTH_MOBILE_REFRESH_TOKEN_EXPIRATION` and its doc
  comment, `MobileRefreshJwtPayload`, and `isMobileRefreshJwtPayload`. Drop `ONE_YEAR_SECONDS` from
  the file's import only if plan 20's `DEFAULT_AUTH_SESSION_IDLE_EXPIRATION` no longer uses it.
- `packages/helpers/src/lib/auth.test.ts`: the `isMobileRefreshJwtPayload` describe block. Keep
  plan 20's cases for the session guards.
- `packages/helpers/src/lib/parseEnvExpiration.ts`: `DEFAULT_AUTH_JWT_EXPIRATION`. Keep the
  `ONE_YEAR_SECONDS` import; `MAX_FREE_TRIAL_EXPIRATION` reads it.

Before deleting, run `rg -n "DEFAULT_AUTH_JWT_EXPIRATION|DEFAULT_AUTH_MOBILE_REFRESH_TOKEN_EXPIRATION|MobileRefreshJwtPayload" apps packages tools --glob '!**/node_modules/**' --glob '!**/dist/**'`
(this also matches `isMobileRefreshJwtPayload`). The only hits should be the definitions, the
helpers test, and the management API lines this plan removes. The search covers `apps/mobile`,
which is outside the npm workspaces and is not caught by a workspace type-check. If another reader
exists, stop and report.

`packages/management-api-requests/src/auth.ts`: `mobileToken` takes an optional `device_label`
and sends it when set. No other client change in this plan.

## OpenAPI (`apps/management-api/openapi.yml`)

Find spots by `operationId` or path.

- `cookieAuth` description: renewed at most once a day of use; ends when the idle limit passes
  or the session is ended. The cookie name stays `pv_mgmt_auth`.
- `AuthenticationErrorResponse`: add optional `notice` (enum of the four notices from plan 20)
  and document `code: session_ended`.
- `managementPostAuthMobileToken`: optional `device_label`.
- `managementPostAuthMobileRefresh`: `refresh_token_expires_in` is the idle limit; 401 may carry
  `code` and `notice`.
- `managementPostAuthLogin`, `managementPostAuthLogout`, `managementPostAuthMobileToken`,
  `managementPostAuthMobileRefresh`, `managementPostAuthMobileRevoke`, `managementGetAuthMe`:
  descriptions matching the flow above. Logout and revoke response messages stay as they are.

## Tokens with no session (R63)

There is no upgrade path. A token with no `sid` fails classification and gets the plain 401: a
cookie-sourced one clears `pv_mgmt_auth` on that response, and a refresh token gets `Invalid
refresh token` with no notice. Each admin signs in once after the deploy, and that login creates
the session.

## Tests

Existing route tests import `app` directly and sign JWTs with no session row, and they mock
`AdminAccountService`, so a real `admin_session` row cannot be inserted for them.

**Stub, default Vitest config.**

- `apps/management-api/src/test/adminSessionStoreStub.ts`: `vi.fn` stubs with the store's
  signatures. Checks return active with `renewDue: false`. Starts return a fixed
  `id_text` of `pvMgtSes001` (9–15 chars, nano_id_v2) and a random refresh id. Rotations return
  `rotated` with a new random id. Ends return true / 0. List returns `[]`.
- `apps/management-api/vitest.setup.stub-sessions.ts`: `vi.mock` of
  `@management-api/lib/auth/adminSessionStore.js` returning that stub. Add it to `setupFiles` in
  `vitest.config.ts` after `vitest.setup.ts`. Exclude `src/**/*.real.integration.test.ts` from
  that config.
- `vitest.admin-session.real.config.ts`: same alias and env setup file, no stub setup, include
  only `src/**/*.real.integration.test.ts`.
- `package.json` `test` script: `vitest run && vitest run --config vitest.admin-session.real.config.ts`.
- `auth.integration.test.ts`: `adminAuthHeaders` signs `{ id, id_text, sid: 'pvMgtSes001',
  token_use: 'access', scope: 'podverse_management_mobile' }`. Keep the cases that still hold,
  including bearer-over-stale-cookie and the double refresh of one token (both 200 under the
  stub). Add: a refresh token sent as a bearer on `GET /auth/me` is 401; a signed token with no
  `sid` is 401 `Unauthorized` and the stub's `checkAdminSession` is not called;
  `/auth/mobile/revoke` returns 200 with the existing
  message for no body, an invalid token, and a valid one, and the valid one calls
  `endAdminSession`.

**Real file** `apps/management-api/src/routes/admin-session.real.integration.test.ts`. Do not mock
`AdminAccountService` or the session store. In `beforeAll`, initialize
`AppDataSourceReadWrite` if it is not already, and create admins with `AdminAccountService.create`
(unique emails; role id 2 exists in the migrated test database). `verifyPassword` then login.
Destroy the data source in `afterAll` and delete the admins you created (cascade removes
sessions). Cases:

- Web login creates a `web` row with a label from the User-Agent and sets `pv_mgmt_auth` whose
  JWT carries `sid`. `GET /auth/me` with that cookie is 200.
- Renewal: with `last_seen_at` two days back, a cookie request returns `Set-Cookie` and moves
  `last_seen_at` and `idle_expires_at`. A second request the same day returns no `Set-Cookie`.
- `logout` ends the row with `signed_out`. Replaying the old cookie is a plain 401 that clears
  the cookie.
- A row revoked as `signed_out_elsewhere` gives `{ code: 'session_ended', notice:
  'signed_out_elsewhere' }` on `GET /auth/me`.
- A second web login with the first cookie attached ends the first row.
- Mobile access works; after revoking the row, the same unexpired access token is 401 with its
  notice.
- Rotation: refresh R0 → R1; refresh R0 again → R2; refresh R1 → 401 with notice `security` and
  the row revoked `refresh_reuse`.
- Two concurrent refreshes of R0 both return 200, the row stays active, and a refresh with the
  second response's token returns 200.
- `/auth/mobile/revoke` ends the session; a later refresh is a plain 401 with message
  `Mobile token family revoked` on the revoke response.
- `device_label` in the token body is stored; without it, `X-Podverse-Client-Platform: ios`
  stores `iOS`.
- Deleting the admin leaves `SELECT count(*) FROM admin_session WHERE admin_account_id = $1` at 0.

**Unit:** `sessionTokens.test.ts` (every payload shape, bearer before cookie, scope required on
access and refresh, scope rejected on web, no `sid` rejected). `deviceLabel.test.ts` is the copied
file. `packages/helpers/src/lib/auth.test.ts` loses its `isMobileRefreshJwtPayload` cases (§ Exports
with no readers).

## Release scratchpad

```markdown
## Server-side sessions for every management admin login

- Surfaces: management-api, management-web, k8s base env
- Change: every admin login (browser cookie and mobile token pair) creates a server-side session
  in the management database, and every authenticated request checks it, so a session can be
  ended at once. The `pv_mgmt_auth` cookie renews at most once a day of use, so the 365-day
  limit counts from last use instead of from login. Mobile refresh tokens rotate on every
  refresh; the previous token stays usable, and any older copy ends the session. Logout and
  `/auth/mobile/revoke` end the calling session. A 401 for a session ended elsewhere carries
  `code: session_ended` and a `notice`. `POST /auth/mobile/token` accepts an optional
  `device_label`. Bearer is still preferred over the cookie. Revoke still responds `Mobile token
  family revoked`.
- Who notices: every signed-in admin signs in once after the deploy, because tokens issued before
  it name no session and are rejected. After that, admins who stay active stop being signed out
  365 days after login.
- Operator steps: `AUTH_SESSION_IDLE_EXPIRATION` (default 31536000) replaces `AUTH_JWT_EXPIRATION`
  and `AUTH_MOBILE_REFRESH_TOKEN_EXPIRATION` on the management API; remove the old keys from its
  deployment env. Apply the admin session migration first (plan 60).
- Also: `@podverse/helpers` no longer exports `DEFAULT_AUTH_JWT_EXPIRATION`,
  `DEFAULT_AUTH_MOBILE_REFRESH_TOKEN_EXPIRATION`, `MobileRefreshJwtPayload`, or
  `isMobileRefreshJwtPayload`.
```
