# API Client Boundaries (Web, SSR, and Mobile)

This document defines shared API client boundaries for Podverse app and management surfaces.

## APIs and base URL env ownership

- Main API (`apps/api`):
  - web client base comes from web runtime config (`public.api.client`)
  - SSR base comes from web runtime config (`public.api.ssr`)
  - route prefix/version is `config.api.prefix + config.api.version`
- Management API (`apps/management-api`):
  - management-web client base comes from management-web runtime config (`public.api.client`)
  - management-web SSR base comes from management-web runtime config (`public.api.ssr`)
  - route prefix/version is `config.api.prefix + config.api.version`

## Cookie names and auth channels

- Main API auth cookie: `jwt` (via `AuthCookieName` from `@podverse/helpers`)
- Management API auth cookie: `pv_mgmt_auth`

Both APIs support:

- browser cookie/session auth for web and SSR
- bearer auth for programmatic clients

## Shared auth context contract

Shared request clients accept one of these auth context modes:

- `none`
- `cookie`: `{ cookieName, token }`
- `bearer`: `{ token, headerName? }` (`Authorization: Bearer <token>` by default)
- `headers`: `{ headers: Record<string, string> }`

Rules:

- request-core remains framework agnostic (no Next.js, no browser globals required)
- cookie name is caller-provided config, never hardcoded in request-core internals
- both client packages must support cookie and bearer contexts

## Mobile bearer-first strategy

Bearer token auth is the baseline for mobile clients for both APIs.

- Mobile clients should call mobile token endpoints to receive `access_token` + `refresh_token`
- Web/SSR cookie flow remains unchanged and fully supported

## Mobile token endpoint contract

Both APIs expose mobile token endpoints under `/auth/mobile/*`:

- `POST /auth/mobile/token`: issue access + refresh token pair from credentials
- `POST /auth/mobile/refresh`: rotate refresh token and issue new pair
- `POST /auth/mobile/revoke`: end the session (logout/revoke)

### Main API sessions

Every main API login creates a server-side account session, and every token names it:

- Web gets one JWT in the `jwt` cookie. Token clients (mobile, and any future client) get a short
  access token for requests and a refresh token bound to the same session. The access/refresh
  pair is the general token-client contract despite the `/auth/mobile/*` path.
- Every authenticated request checks the session, so ending a session takes effect on its next
  request. A token that names no session is rejected as unauthenticated.
- One idle limit (`AUTH_SESSION_IDLE_EXPIRATION`, 365 days) applies to every client. Use renews it
  at most once a day; a web request that renews also re-sets the cookie with a fresh JWT.
- Each refresh rotates the refresh token. The newest token and the one presented just before it
  both rotate, so a client that lost a refresh response recovers by resending what it holds.
  Presenting any older token ends the session as suspected theft.
- `POST /auth/logout` and `POST /auth/mobile/revoke` end the calling session on the server.
  Revoke always answers 200.
- A 401 for a session ended somewhere else carries `code: session_ended` and a `notice`
  (`signed_out_elsewhere`, `password_changed`, `admin_force_logout`, `security`); read it with
  `parseAuthSessionEndedNotice` from `@podverse/helpers`. Self sign-out, idle expiry, and invalid
  tokens get a plain 401. Public routes treat an ended session as signed out rather than failing.

### Main API keys

An API key is a long-lived credential for scripts and agents, separate from sessions:

- A key is created and revoked only from a signed-in session (web Settings → Developer, mobile
  More → Settings → Developer). The token is shown once; the server keeps only its hash.
- Send it as `Authorization: Bearer pvk_…`. When a request carries both the `jwt` cookie and a
  key, the cookie wins.
- Only operations that declare a permission accept a key (`x-api-key-permission` and
  `apiKeyAuth` in `apps/api/openapi.yml`; `apiKeyAccess` in code). Every other operation answers
  403 `api_key_not_allowed`.
- Errors: 401 `api_key_invalid` (unknown, malformed, or revoked key, or the account is gone),
  401 `api_key_expired`, 403 `api_key_not_allowed`, and 403 `api_key_permission_denied` with
  `required_permission: { resource, action }`.
- While the account's membership has expired, its keys get 403 `membership_expired` on every
  route, including routes that let expired members' sessions through.
- A key can never do anything its owner cannot do signed in. It authenticates as the owner's
  account only, goes through the same terms, membership, and capability checks as the owner's
  session, and reaches only operations that declare a permission. `apps/api` has no admin
  routes.
- The management API never accepts a key: a `pvk_` token fails JWT verification there and gets 401.
- Last use is recorded at most once every five minutes per key.
- Keys survive password changes, password resets, and admin sign-outs. A key ends only when it is
  revoked, when it expires, or when the account is deleted.

### Management API sessions

The management API follows the same session contract for admins, with these differences:

- Every admin login creates a server-side admin session, and every token names it. A token that
  names no session is rejected as unauthenticated.
- Web gets one JWT in the `pv_mgmt_auth` cookie. Mobile access and refresh tokens carry the
  `podverse_management_mobile` scope; web tokens carry none.
- A bearer header wins over the cookie when a request carries both.
- Every authenticated request checks the session. The idle limit (`AUTH_SESSION_IDLE_EXPIRATION`,
  365 days) renews at most once a day of use, and a web request that renews also re-sets
  `pv_mgmt_auth` with a fresh JWT.
- Each refresh rotates the refresh token; the previous token is still accepted, and presenting any
  older one ends the session as suspected theft.
- `POST /auth/logout` and `POST /auth/mobile/revoke` end the calling session.
  `/auth/mobile/revoke` on the management API always answers 200 with
  `Mobile token family revoked`.
- A 401 for a session ended somewhere else carries `code: session_ended` and a `notice`, the same
  body as the main API.

## Migration guardrails

- `packages/*` API clients must not import from `apps/*`
- app-local request modules may temporarily re-export package modules for migration safety
- new management-api routes must add/update matching typed request wrappers in `@podverse/management-api-requests`
- new main API routes intended for app/mobile clients must add/update matching typed wrappers in `@podverse/helpers-requests`

## Deferred decisions

- Cross-repo reuse with Metaboost: deferred; keep implementation Podverse-local for now
- OpenAPI codegen for client wrappers: deferred; maintain manual typed wrappers with CI checks
