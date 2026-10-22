**Cursor model:** Opus 5.5 · **Reasoning:** high

# 20 — Session-bound API auth: login, per-request check, renewal, rotation, logout

Every main API login creates an `account_session` row (plan 10), every token names its row, and
every authenticated request checks the row. Web renews its cookie as it is used, mobile rotates its
refresh token, and `logout` and `revokeMobileToken` end the calling session. A token that names
no session is rejected as unauthenticated.

This is one change. The pieces cannot ship apart: a token without a session check cannot be
revoked. No environment holds logins that must survive the deploy (00-REQUEST.md § Review of the
first planning pass, "Greenfield"), so every web and mobile user signs in again once after it.

Operator answers that shape it (00-REQUEST.md § Operator answers): one 365-day idle limit for
every client, renewed by use; a full session list (plan 22); the signed-out device shows a
specific reason; admin force-logout and management sessions are other areas.

## Rows

R1, R2, R3, R4, R5, R7, R8, R9, R11, R12, R13, R14, R17, R18, R19, R20, R22, R23, R25, R33, R39, R40, R43, R63

## Runs after

10

## Files

- packages/helpers/src/lib/auth.ts
- packages/helpers/src/lib/auth.test.ts
- packages/helpers/src/lib/authSessionNotice.ts
- packages/helpers/src/lib/authSessionNotice.test.ts
- packages/helpers/src/index.ts
- packages/helpers/package.json
- packages/helpers-requests/src/api/auth/auth.ts
- packages/helpers-requests/src/api/_request.ts
- packages/helpers-config/src/podverseTestEnv.ts
- apps/api/src/lib/auth/index.ts
- apps/api/src/lib/auth/accountSessionStore.ts
- apps/api/src/lib/auth/sessionTokens.ts
- apps/api/src/lib/auth/sessionTokens.test.ts
- apps/api/src/lib/auth/deviceLabel.ts
- apps/api/src/lib/auth/deviceLabel.test.ts
- apps/api/src/@types/express.d.ts
- apps/api/src/controllers/item.ts
- apps/api/src/config/index.ts
- apps/api/src/lib/startup/validation.ts
- apps/api/.env.example
- apps/api/ENV.md
- apps/api/openapi.yml
- infra/k8s/base/api/source/api.env
- tools/web-perf/lighthouse/.env.api.example
- tools/web-perf/lighthouse/.env.api
- docs/development/API-CLIENT-BOUNDARIES.md
- apps/api/src/test/helpers/index.ts
- apps/api/src/test/helpers/testAccountIds.ts
- apps/api/src/test/helpers/accountSessionStoreStub.ts
- apps/api/src/test/auth.test.ts
- apps/api/src/test/account-session.integration.test.ts

## Before you start

Other work is landing in the tree. Confirm the paths exist. Re-read
`apps/api/src/lib/auth/index.ts` in full, and grep for `config.auth.` and `AuthCookieName` in
`apps/api/src` to catch any new reader. The `realtime-banner-notifications` set (its plan 12) also
edits `verifyTokenAndMembership` and `Express.User` (it adds `token_expires_at`); if that landed
first, keep its field and its assignment.

Plan 10 exports the ORM functions and types used here: `createAccountSession`,
`getAccountSessionStatus`, `touchAccountSession`, `rotateAccountSessionRefreshToken`,
`revokeAccountSession`, `revokeAccountSessions`,
`listActiveAccountSessions`, `AccountSessionRow`, `AccountSessionStatus`,
`AccountSessionRotateResult`, and from `@podverse/helpers` the `AccountSessionClientType` and
`AccountSessionRevokeReason` unions.

## Answers to the request's questions (R1, R3, R7, R8)

These go in the implementer's final message and in the release scratchpad entry, so the operator
gets them in plain words.

- **Why web and mobile differ (R1).** Web gets one JWT in an httpOnly cookie, signed for
  `AUTH_JWT_EXPIRATION` (365 days) at login and never re-signed. Mobile gets two tokens: a 15-minute
  access token sent on every request, and a 365-day refresh token used only to get a new pair.
  Mobile uses the pair because its token travels in a header that any code holding it can replay,
  so the token sent everywhere is kept short. A cookie is scoped by the browser and unreadable by
  page scripts, so web never needed the split.
- **Is the year a misunderstanding about refresh (R3)?** Partly. Mobile's year is already an idle
  limit: each refresh issues a fresh 365-day refresh token, so an install opened at least once a
  year never signs out. Web's year counts from login: an active user is signed out exactly 365
  days after logging in, and an idle one the same. Neither can be ended from the server; rotating
  `AUTH_JWT_SECRET` signs out everyone.
- **What 900 seconds means (R7).** It is the access token's life. The app refreshes it silently
  before it runs out, so the user never sees it. The refresh token's 365 days is what decides how
  long an unused install stays signed in.
- **Is web doing something wrong (R8)?** The length is not the problem; the operator's answer keeps
  365 days. The problems are that it counts from login rather than from last use, and that nothing
  can end it. After this plan the 365 days is an idle limit for every client, every request checks
  a server-side session, and any session can be ended at once.

## Token model

Constants and guards in `packages/helpers/src/lib/auth.ts` (exported through the barrel, as today):

```typescript
/** Fallback when `AUTH_SESSION_IDLE_EXPIRATION` is unset — 365 days. */
export const DEFAULT_AUTH_SESSION_IDLE_EXPIRATION = ONE_YEAR_SECONDS;

/**
 * A session is renewed (row touched, web cookie re-signed) at most once per this interval of use.
 * The API decides renewal from the row; the web middleware uses the same interval to decide when
 * a server-rendered visit should ask for one.
 */
export const ACCOUNT_SESSION_RENEW_INTERVAL_MS = ONE_DAY_MS;

export type SessionAccessJwtPayload = {
  id: number;
  id_text: string;
  sid: string;
  token_use: 'web' | 'access';
};

export type SessionRefreshJwtPayload = {
  id: number;
  id_text: string;
  sid: string;
  rid: string;
  token_use: 'refresh';
};

export function isSessionAccessJwtPayload(value: unknown): value is SessionAccessJwtPayload;
export function isSessionRefreshJwtPayload(value: unknown): value is SessionRefreshJwtPayload;
```

Write the doc comment on `DEFAULT_AUTH_SESSION_IDLE_EXPIRATION` positively: one idle limit for
every client, renewed by use (web cookie, web JWT, mobile refresh JWT, session row). Put it next to
`DEFAULT_AUTH_MOBILE_ACCESS_TOKEN_EXPIRATION`.

After this plan the main API no longer reads `MobileRefreshJwtPayload`,
`isMobileRefreshJwtPayload`, `DEFAULT_AUTH_MOBILE_REFRESH_TOKEN_EXPIRATION`, or
`DEFAULT_AUTH_JWT_EXPIRATION` (`parseEnvExpiration.ts`). The management API still imports them
until plan 62 lands, so leave them in place here; plan 62 deletes them and their tests. Remove the
`isMobileRefreshJwtPayload` import from `apps/api/src/lib/auth/index.ts`.

The three token kinds the main API issues, all signed with `AUTH_JWT_SECRET`:

| Kind | Claims | Lifetime | Carried in |
| --- | --- | --- | --- |
| Web | `id`, `id_text`, `sid`, `token_use: 'web'` | idle limit | `jwt` cookie (`AuthCookieName`), or the login body when `AUTH_ALLOW_TOKEN_IN_RESPONSE_BODY` allows |
| Mobile access | `id`, `id_text`, `sid`, `scope: 'podverse_app_mobile'`, `token_use: 'access'` | `AUTH_MOBILE_ACCESS_TOKEN_EXPIRATION` (900) | `Authorization: Bearer` |
| Mobile refresh | `id`, `id_text`, `sid`, `rid`, `scope`, `token_use: 'refresh'` | idle limit | `/auth/mobile/refresh` and `/auth/mobile/revoke` bodies |

`sid` is the session's `id_text`; `rid` is the raw refresh-token id plan 10's service mints. A
future client uses the access/refresh pair, which is the general token-client contract despite the
`/auth/mobile/*` path; it gets its own `ACCOUNT_SESSION_CLIENT_TYPES` value when one is added.

`apps/api/src/lib/auth/sessionTokens.ts` owns signing and parsing so `index.ts` stays readable:

- `signWebSessionToken({ accountId, accountIdText, sessionIdText })`.
- `signMobileTokenPair({ accountId, accountIdText, sessionIdText, refreshTokenId })` → the existing
  response shape (`token_type`, `access_token`, `access_token_expires_in`, `refresh_token`,
  `refresh_token_expires_in`). `refresh_token_expires_in` is the idle limit.
- `readRequestToken(req)` → `{ token, source: 'cookie' | 'bearer' } | null`. Same order as today:
  cookie first, then `Authorization: Bearer`.
- `classifyAccessJwt(decoded: unknown)` → `{ kind: 'session'; claims }` | `{ kind: 'rejected' }`.
  Session means the payload passes `isSessionAccessJwtPayload`. Everything else is rejected,
  including a refresh token on an access route and any payload with no `sid`. Every rejection
  answers `{ message: 'Unauthorized' }`; the separate `Re-authentication required` message for a
  token with no `id_text` goes away. Validate `sid` and `id_text` with `isValidNanoIdV2IdText`.
- `classifyRefreshJwt(decoded: unknown)` → `{ kind: 'session'; claims }` | `{ kind: 'rejected' }`.
  Session means the payload passes `isSessionRefreshJwtPayload`.

Narrow with the guards; no `as` on decoded payloads (the existing `decoded as DecodedToken` in
`verifyTokenAndMembership` goes away).

## Session store (`apps/api/src/lib/auth/accountSessionStore.ts`)

The API's only caller of the plan 10 session functions. It owns the clock, the idle limit from
config, and the reason-to-notice mapping, so every API path that starts, checks, renews, or ends a
session goes through it. Areas E and G rely on that (G publishes revocation events from here).

```typescript
export type AccountSessionCheck =
  | { kind: 'active'; session: AccountSessionRow; renewDue: boolean }
  | { kind: 'ended'; notice: AuthSessionEndedNotice | null };
```

- `startAccountSession({ accountId, clientType, deviceLabel, withRefreshToken })` →
  `{ sessionIdText, refreshTokenId }` (`refreshTokenId` null for web).
- `checkAccountSession({ accountId, sessionIdText })` → `AccountSessionCheck`. `renewDue` is true
  when `now - last_seen_at` is at least `ACCOUNT_SESSION_RENEW_INTERVAL_MS`, imported from
  `@podverse/helpers` (below; not an env var). Revoked maps to `ended` with `getAuthSessionEndedNotice(reason)`;
  expired and missing map to `ended` with a null notice.
- `renewAccountSession(session)` → `boolean` via `touchAccountSession` with `lastSeenAt: now` and
  `idleExpiresAt: now + idle`.
- `rotateMobileRefreshToken({ accountId, sessionIdText, presentedTokenId })` →
  `{ kind: 'rotated'; refreshTokenId; session } | { kind: 'ended'; notice }`. `reused` maps to
  `ended` with the `refresh_reuse` notice (`security`).
- `endAccountSession({ accountId, sessionIdText, reason })` → `boolean`.
- `endAccountSessions({ accountId, reason, exceptSessionIdText })` → `number`.
- `listAccountSessions(accountId)` → `AccountSessionRow[]` (plan 22 uses it).

Not a re-export wrapper: it adds config, clock, and mapping. It is also the seam the test suite
stubs (see Tests).

## Signed-out notice (R43)

`packages/helpers/src/lib/authSessionNotice.ts`, exported from the barrel and from a new subpath
`@podverse/helpers/authSessionNotice` in `packages/helpers/package.json` (mobile cannot import the
barrel). It may `import type` the reason union from `./accountSession.js`; it must not import
anything Node-only.

```typescript
export const AUTH_SESSION_ENDED_CODE = 'session_ended';

export const AUTH_SESSION_ENDED_NOTICES = [
  'signed_out_elsewhere',
  'password_changed',
  'admin_force_logout',
  'security',
] as const;
export type AuthSessionEndedNotice = (typeof AUTH_SESSION_ENDED_NOTICES)[number];

/** Exhaustive switch; `signed_out` returns null (that device signed itself out). */
export function getAuthSessionEndedNotice(
  reason: AccountSessionRevokeReason
): AuthSessionEndedNotice | null;

/** Reads `{ code: 'session_ended', notice }` from a 401 body; null for any other body. */
export function parseAuthSessionEndedNotice(body: unknown): AuthSessionEndedNotice | null;
```

| Revoke reason | Notice |
| --- | --- |
| `signed_out` | none |
| `signed_out_elsewhere` | `signed_out_elsewhere` |
| `password_changed` | `password_changed` |
| `admin_password_set` | `password_changed` |
| `admin_force_logout` | `admin_force_logout` |
| `refresh_reuse` | `security` |

The 401 body for an ended session with a notice:

```json
{ "message": "Unauthorized", "code": "session_ended", "notice": "signed_out_elsewhere" }
```

With no notice (self sign-out, idle expiry, missing row, deleted account), the 401 is today's plain
`{ "message": "Unauthorized" }` (mobile refresh keeps `Invalid refresh token`). The raw revoke
reason never leaves the API. Copy lives with the clients (plans 30–49): the operator's four
sentences map one-to-one onto the four notices.

## Request flow

### `verifyTokenAndMembership` (behind `ensureAuthenticated` and `optionalEnsureAuthenticated`)

1. `jwt.verify`, then `classifyAccessJwt`. Rejected → 401 as today.
1. Run the account lookup (`getAccountMatchingJwtIdentity`, unchanged relations) and the session
   check (`checkAccountSession`) at once (`Promise.all`). The session check stays a separate
   indexed query rather than a join in the account lookup: that lookup loads several relations
   through TypeORM, and running both at once adds no round trip.
1. No account → 401 as today. Session `ended` → 401 with the notice body (above).
1. Active → set `req.user` as today plus `session_id_text` (add it to `Express.User` in
   `apps/api/src/@types/express.d.ts`).
1. `renewDue` → `renewAccountSession`. When it returns true and the session's `client_type` is
   `web` and the token came from the cookie, sign a fresh web token and `setAuthCookie`. A web token
   sent as a bearer (`includeTokenInResponseBody` clients) gets its row renewed but no new token;
   it ends at its JWT expiry, and long-lived token clients use the access/refresh pair. Renewal
   failures are logged and do not fail the request.
1. Terms, membership, and capability checks run after, unchanged.

Every 401 this function sends for a cookie-sourced token also clears the cookie (`clearAuthCookie`,
below), so a browser holding an ended cookie becomes signed out on that response.

`optionalEnsureAuthenticated`: when the account exists but the session check is `ended`, continue
as anonymous (`next()` with no `req.user`) instead of the 401, and leave the cookie alone. A public
page must not fail because the visitor's session was ended elsewhere. JWT failures keep today's
401. The notice reaches the client through the next signed-in route, which answers 401 with the
notice and clears the cookie in the same response (web calls `/auth/me` on every server render;
mobile refreshes at least every 15 minutes of use). Clearing the cookie on a public route would
let the browser drop it before any signed-in route could say why, and the web client could then
only show an unexplained signed-out state (plans 30–39 read the notice).

### Cookie helpers

Extract `clearAuthCookie(res)` from `logout` (both the host-only clear and, in production, the
`COOKIE_DOMAIN` clear) and export it with `setAuthCookie`; plan 21 calls it from account deletion.
`setAuthCookie` keeps its attributes; `maxAge` becomes the idle limit.

### `authenticate` (web login)

After the password check: if the request already carries a cookie that classifies as a session
token with a valid signature, `endAccountSession` it with `signed_out` (a second login in one
browser replaces its session, so the device list shows one row per browser). Then
`startAccountSession({ clientType: 'web', deviceLabel: deviceLabelFromUserAgent(req) })`, sign the
web token, set the cookie, and keep the `includeTokenInResponseBody` behavior.

Remove the unused `passport-jwt` `JwtStrategy` registration and its import: nothing calls
`passport.authenticate('jwt')`, and a strategy that skips the session check must not be one line
away from use. Leave the `passport-jwt` package in `package.json` (no lockfile change here).

### `issueMobileToken`

After `authenticateAccountCredentials`: `startAccountSession({ clientType: 'mobile', deviceLabel,
withRefreshToken: true })`, then `signMobileTokenPair`. The body accepts an optional
`device_label` string. The label is `device_label` when it is a non-empty string, else derived from
`X-Podverse-Client-Platform` (`ios` → `iOS`, `android` → `Android`), else null.

### `refreshMobileToken`

1. Verify and `classifyRefreshJwt`. Rejected → 401 `Invalid refresh token`.
1. Account lookup as today.
1. `rotateMobileRefreshToken({ presentedTokenId: claims.rid })`.
1. `rotated` → `signMobileTokenPair` with the new `refreshTokenId`. `ended` → 401
   `Invalid refresh token`, plus `code` and `notice` when the notice is not null.

Rotation rules are plan 10's: the current or the previous id rotates; anything else revokes the
session as `refresh_reuse`. Normal use never trips it (R14):

- A lost response or an app killed mid-refresh: the client resends the token it still has, which is
  now previous, and gets a new pair.
- Two refreshes racing with the same token: both succeed (the row lock serializes them; the second
  presents what is now previous). A client that then keeps the older of the two responses would
  trip reuse on its next refresh. The mobile app's refresh is single-flight
  (`refreshAccessTokenSingleFlight`), and plans 40–49 make sure each rotated token is stored before
  use, which removes that case.

### `logout` and `revokeMobileToken` (R33)

- `logout`: read the request token. A session token → `endAccountSession(…, 'signed_out')`. Then
  `clearAuthCookie` and the current response. A missing or invalid token still
  clears the cookie and returns 200. Errors ending the session are logged, not returned.
- `revokeMobileToken` becomes async (wrap it in `asyncHandler` in `apps/api/src/routes/auth.ts`).
  Read `refresh_token` from the body; a validly signed session refresh token ends its session
  with `signed_out` (no current/previous check: ending your own session needs no proof beyond the
  signature). Always 200
  `{ message: 'Mobile session revoked' }` (replacing `Mobile token family revoked`), including a
  missing or invalid token, so logout on the device never fails on this call.

### `item.ts` archived-channel lookup

`accountIdFromRequest` in `apps/api/src/controllers/item.ts` decodes the token itself. Replace it
with a new export from `apps/api/src/lib/auth/index.ts`,
`getActiveSessionAccountId(req): Promise<number | null>`: read the token, verify, classify, and
return the account id only when the session check is active. No renewal and no cookie writes. Delete `bearerOrCookieToken` and the `jsonwebtoken`
import there.

## Device label (`apps/api/src/lib/auth/deviceLabel.ts`)

No new dependency. `deviceLabelFromUserAgent(userAgent: string | undefined): string | null`
returns `"<Browser> · <OS>"`, or whichever half it recognizes, or null. Brand names only, so the
stored label reads the same in every locale.

- Browser, checked in this order: `Edg/` Edge, `OPR/` Opera, `SamsungBrowser/` Samsung Internet,
  `Firefox/` or `FxiOS/` Firefox, `Chrome/` or `CriOS/` Chrome, `Safari/` Safari.
- OS: `iPhone` or `iPad` iOS, `Android` Android, `CrOS` ChromeOS, `Windows` Windows, `Mac OS X`
  macOS, `Linux` Linux.

`deviceLabelForMobile({ bodyLabel, platformHeader })` implements the mobile rule above. The ORM
trims and cuts to `varchar_normal`.

## Config, env, and docs (R39, R40)

- `apps/api/src/config/index.ts`: `config.auth` becomes `jwtSecret`, `sessionIdleExpiration` (from
  `AUTH_SESSION_IDLE_EXPIRATION`, default `DEFAULT_AUTH_SESSION_IDLE_EXPIRATION`, via
  `readOptionalPositiveExpirationEnv`), `sessionCookieMaxAgeMs` (idle × `MS_PER_SECOND`),
  `mobileAccessTokenExpiration`, `allowTokenInResponseBody`. Remove `jwtExpiration` and
  `mobileRefreshTokenExpiration`; the API no longer reads `AUTH_JWT_EXPIRATION` or
  `AUTH_MOBILE_REFRESH_TOKEN_EXPIRATION`.
- `apps/api/src/lib/startup/validation.ts`: replace the two removed `validateOptional` pushes with
  one for `AUTH_SESSION_IDLE_EXPIRATION` (`Blank uses default (31536000 seconds)`), in the same
  position (**startup-validation-env-order**).
- `apps/api/.env.example`: replace the two blocks with
  `AUTH_SESSION_IDLE_EXPIRATION="31536000"` and a comment: idle limit in seconds for every client;
  each use renews it; blank uses 31536000 (365d). Keep the access-token block.
- `tools/web-perf/lighthouse/.env.api.example` and `.env.api`: the same replacement
  (**lighthouse-env-alignment**).
- `infra/k8s/base/api/source/api.env`: replace `AUTH_JWT_EXPIRATION` and
  `AUTH_MOBILE_REFRESH_TOKEN_EXPIRATION` with `AUTH_SESSION_IDLE_EXPIRATION=31536000` and a one-line
  comment (unquoted, **env-file-formatting**). Leave `management-api.env` alone.
- `packages/helpers-config/src/podverseTestEnv.ts`: in `apiTestEnvBase` only, replace the two keys
  with `AUTH_SESSION_IDLE_EXPIRATION: '31536000'`. Leave `managementApiTestEnvBase`.
- `apps/api/ENV.md` § Token Expiration and § Numeric Validation: document
  `AUTH_SESSION_IDLE_EXPIRATION` (what it bounds, renewal at most once a day, revocation is
  server-side) and drop the two removed keys. Replace "Rotating `AUTH_JWT_SECRET` ends every mobile
  session" with: rotating it ends every session at once; ending one session or one account's
  sessions is done through the session endpoints and the management API.
- `docs/development/API-CLIENT-BOUNDARIES.md` § Mobile token endpoint contract: describe the main
  API as built (session-bound tokens, rotation with the previous token accepted, reuse revokes the
  session, revocation checked on every request, `session_ended` 401 body, web cookie renewal). It
  says "Both APIs" today; scope the statements to the main API and leave the management API lines
  for plans 60–69.
- Rewrite the header comment at the top of `apps/api/src/lib/auth/index.ts` for the new model, and
  drop the "Refresh JWTs stay valid until they expire" comment.

## Shared request helpers

`packages/helpers-requests/src/api/auth/auth.ts`: `reqAuthMobileToken` takes an optional
`device_label` and sends it when set; update the `ApiRequestService.reqAuthMobileToken` method
signature in `_request.ts` to match. No other client change here; plans 30–49 consume the notice.

## OpenAPI (`apps/api/openapi.yml`)

Find each spot by path, `operationId`, or schema name, not by line number.

- `components.securitySchemes.cookieAuth`: the cookie name is `jwt`, not `podverse_auth`. Add a
  description: renewed at most once a day of use; ends when the idle limit passes or the session is
  ended.
- `AuthenticationErrorResponse`: add optional `notice` (enum of the four notices) and document
  `code: session_ended`. Add a `sessionEnded` example to the 401 of `/auth/me`,
  `/auth/check-session`, and `/auth/mobile/refresh`.
- `MobileTokenRequest`: optional `device_label`.
- `MobileTokenResponse`: `refresh_token_expires_in` is the idle limit.
- `/auth/login`, `/auth/logout`, `/auth/mobile/token`, `/auth/mobile/refresh`,
  `/auth/mobile/revoke`: descriptions per the request flow above, replacing the
  "Auto-generated from route matrix" text where present. `apiPostAuthMobileRevoke`: the 200 schema
  changes from `EmptyResponse` to `MessageResponse`, and drop its `400` and `404` responses (it
  always returns 200).

## Tokens with no session (R63)

There is no upgrade path. A token with no `sid` fails classification and gets the plain 401: a web
cookie clears on that response, and a mobile refresh token gets `Invalid refresh token` with no
notice, which signs the app out (plan 41 shows the no-notice copy). Each user signs in once after
the deploy, and that login creates the session.

## Tests

**Stub for the existing suite.** Twenty-seven API test files sign session-less JWTs through
`authHeaders` and mock `AccountService` with accounts that do not exist in the test database, so a
real session row (foreign key to `account`) cannot be created for them.

- `apps/api/src/test/helpers/accountSessionStoreStub.ts`: an object of `vi.fn` stubs with the same
  signatures as `accountSessionStore.ts`. Checks return active with `renewDue: false`; starts return
  `TEST_ACCOUNT_SESSION_ID_TEXT` and a random refresh id; rotations return `rotated` with a new
  random id; ends return true / 0; list returns `[]`. Export it so tests can assert calls
  (plan 21 does).
- `apps/api/src/test/helpers/testAccountIds.ts`: `TEST_ACCOUNT_SESSION_ID_TEXT = 'pvtestses01'`
  (nano_id_v2 bounds).
- `startTestApp(options?: { accountSessions?: 'stub' | 'real' })`, default `'stub'`. Before the
  dynamic app import: `'stub'` → `vi.doMock('@api/lib/auth/accountSessionStore.js', () =>
  accountSessionStoreStub)`; `'real'` → `vi.doUnmock` of the same id. Registrations persist across
  files under `isolate: false`, so both branches always run one of the two calls. Confirm the alias
  id resolves for `vi.doMock`; if it does not, use the path relative to the helper.
- The `'real'` branch also calls `vi.doUnmock('@api/lib/auth/password.js')`. Real-store files
  check passwords against real bcrypt hashes, and `auth.test.ts`'s fake of that module must never
  reach them. Confirm the alias id names the same module `auth.test.ts` mocks as
  `'../lib/auth/password.js'`; if it does not, use the path relative to the helper.
- `authHeaders` and `adminAuthHeaders` sign `{ id, id_text, sid: TEST_ACCOUNT_SESSION_ID_TEXT,
  token_use: 'access' }`.

**`apps/api/src/test/auth.test.ts`** (stub): keep the existing cases that still hold, and update the
refresh cases to the stub. Add: a refresh token sent as a bearer on `/auth/check-session` is 401; a
signed token with no `sid` is 401 `{ message: 'Unauthorized' }` and the stub's
`checkAccountSession` is not called; `/auth/mobile/revoke` returns 200 with no body, with an
invalid token, and with a valid one (and calls `endAccountSession`). Drop any existing case that
expects `Re-authentication required`. Add `afterAll(() => { vi.doUnmock('../lib/auth/password.js'); })`
beside the file's existing teardown, so its `verifyPassword` fake does not outlive the file under
`isolate: false`; `account.test.ts` (plans 21 and 23) checks real bcrypt hashes in stub mode and
depends on it.

**`apps/api/src/test/account-session.integration.test.ts`** (real, `startTestApp({ accountSessions:
'real' })`). Create an account per case through `AccountService.create` and `getByEmail`, as
`queue-resource-delete.integration.test.ts` does, then `verifyEmail(account.id)` so login accepts it. Read and age rows with SQL through
`ormContext.dataSourceReadWrite`. Cases:

- Web login creates a `web` row with a label from the User-Agent and sets a cookie whose JWT
  carries `sid`; `/auth/check-session` with that cookie is 200.
- Real password check: in one case, a login with the account's password is 200 and a login with
  a wrong password is 401 with no session row created. A leaked `verifyPassword` fake returns the
  same answer for both, so one assertion fails. Never mock the password module in this file.
- Renewal: with `last_seen_at` set two days back, a request returns `Set-Cookie` and moves
  `last_seen_at` and `idle_expires_at`; a second request the same day returns no `Set-Cookie`.
- `logout` ends the row with `signed_out`; replaying the old cookie is a plain 401 that clears the
  cookie.
- A row revoked as `signed_out_elsewhere` gives `{ code: 'session_ended', notice:
  'signed_out_elsewhere' }` on `/auth/me`, and an `optionalEnsureAuthenticated` route
  (`GET /account/:id_text` for the same account) answers as anonymous (not 401) with no
  `Set-Cookie`.
- A second web login with the first cookie attached ends the first row.
- Mobile: the access token works; after revoking the row, the same unexpired access token is 401
  with its notice (R19).
- Rotation: refresh R0 → R1; refresh R0 again → R2 (previous); refresh R1 → 401 with notice
  `security` and the row revoked `refresh_reuse`; refresh R2 → 401.
- Concurrent refresh: two refreshes of R0 at once both return 200, the row stays active, and a
  refresh with the second response's token returns 200.
- `/auth/mobile/revoke` ends the session; a later refresh is a plain 401.
- `device_label` in the token body is stored; without it, `X-Podverse-Client-Platform: ios`
  stores `iOS`.

**Unit:** `sessionTokens.test.ts` (classification of every payload shape, cookie-before-bearer),
`deviceLabel.test.ts` (one case per browser and OS, unknown agent → null),
`packages/helpers/src/lib/auth.test.ts` (both new guards), `authSessionNotice.test.ts` (the mapping
table and body parsing, including non-object bodies and unknown notices).

## Release scratchpad

```markdown
## Server-side sessions for every main API login

- Surfaces: api, web, mobile, k8s base env, helpers, helpers-requests
- Change: every login (web and mobile) creates a server-side session, and every authenticated
  request checks it, so a session can be ended at once from the server. Web renews its cookie at
  most once a day of use, so the 365-day limit counts from last use instead of from login. Mobile
  refresh tokens rotate on every refresh; the previous token stays usable so a lost response never
  signs anyone out, and any older copy ends the session as suspected theft. `logout` and
  `/auth/mobile/revoke` end the calling session on the server. A 401 for a session ended elsewhere
  carries `code: session_ended` and a `notice` (`signed_out_elsewhere`, `password_changed`,
  `admin_force_logout`, `security`). Public routes treat an ended session as signed out instead of
  failing. `POST /auth/mobile/token` accepts an optional `device_label`.
- Why web and mobile differed: web had one 365-day JWT counted from login and never renewed; mobile
  had a 15-minute access token (900 seconds) refreshed silently by a 365-day refresh token, which
  already acted as an idle limit. Neither could be ended from the server.
- Who notices: every signed-in web and mobile user signs in once after the deploy, because tokens
  issued before it name no session and are rejected. After that, users active on web stop being
  signed out 365 days after login.
- Operator steps: `AUTH_SESSION_IDLE_EXPIRATION` (default 31536000) replaces `AUTH_JWT_EXPIRATION`
  and `AUTH_MOBILE_REFRESH_TOKEN_EXPIRATION` on the API; remove the old keys from API deployment
  env. Apply the session migration first (plan 10's entry).
```
