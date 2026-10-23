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
