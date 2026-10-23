**Cursor model:** Opus 5.5 · **Reasoning:** high

# 30 — Web: renewed session cookie reaches the browser on server-rendered visits

After plan 20, the API renews a web session at most once a day of use: it touches the session row
and answers with a fresh `jwt` cookie in `Set-Cookie`. A request the browser makes to the API
directly stores that cookie. A page rendered on the web server does not: `ssrAuth.ts` and every
server component call the API from the Next server with the browser's cookie copied into a
`cookie` header (`ApiRequestService` `authContext` mode `cookie`), so the API's `Set-Cookie` lands
on the Next server and is dropped. Server components cannot set cookies.

This plan makes the web middleware the one place that asks for a renewal during a page visit and
forwards the API's `Set-Cookie` to the browser verbatim. With it, the 365-day cookie lifetime is an
idle limit for every kind of web visit (R21).

## Rows

R21, R63

## Runs after

20, 22

## Files

- apps/web/src/middleware.ts
- apps/web/src/lib/auth/jwtPayload.ts
- apps/web/src/lib/auth/jwtPayload.test.ts
- apps/web/src/lib/auth/webSessionRenewal.ts
- apps/web/src/lib/auth/webSessionRenewal.test.ts
- apps/web/e2e/helpers/accountSessions.ts
- apps/web/e2e/web-session-renewal.spec.ts
- tools/web/seed-e2e.mjs
- makefiles/local/e2e-spec-order-web.txt

## Before you start

Plans 20 and 22 must be done (the E2E helper calls plan 22's `POST /auth/sessions/revoke-others`).
Confirm:

- `ACCOUNT_SESSION_RENEW_INTERVAL_MS` and `AuthCookieName` are exported from `@podverse/helpers`.
- `GET /auth/check-session` runs `ensureAuthenticated` with `skipMembershipStatus` and
  `skipTermsAcceptance` (`AccountController.checkIfValidAuthSession`), and plan 20's renewal step
  (`renewDue` → `setAuthCookie`) runs inside it for cookie-sourced tokens.
- The web token carries `sid` and `token_use: 'web'`, and `jsonwebtoken` adds `iat` (plan 20's
  `signWebSessionToken` does not pass `noTimestamp`).

Re-read `apps/web/src/middleware.ts` in full; other work may have changed it.

## Design

- **Only when due.** The middleware decodes the `jwt` cookie's payload without verifying it and
  calls the API only when a renewal is due. Most page requests make no extra API call.
- **Due** means the payload has a non-empty string `sid`, and either it has no numeric `iat` or
  `nowMs - iat * 1000 >= ACCOUNT_SESSION_RENEW_INTERVAL_MS`. The web token is re-signed on every
  renewal, so its `iat` is the last renewal time the browser holds. A payload with no `sid` is
  never due: the API rejects it, and the root layout's `/auth/me` handles that as a signed-out
  visit.
- **The call** is `GET <ssrApiBase>/auth/check-session` with the request's `cookie` header.
  Timeout 2000 ms. Any failure (timeout, network, non-JSON) is ignored and the page renders
  as today.
- **Forward verbatim.** Every `Set-Cookie` value on the API response, whatever the status, is
  appended to the middleware's response with `response.headers.append('set-cookie', value)`. The
  API's attributes (in production `Domain` from `COOKIE_DOMAIN`, `Secure`, `SameSite=Lax`; in
  development host-only `SameSite=Strict`) are already the ones the browser holds, so forwarding
  them unchanged replaces the same cookie instead of adding a second one. Never construct the
  cookie in the web app.
- **Downstream server rendering uses the renewed token.** When the API set a non-empty `jwt`, the
  middleware replaces the `jwt` pair in the request's `cookie` header
  (`NextResponse.next({ request: { headers } })`), so `ssrAuth.ts` and the root layout in the
  same request send the new token.
- **An ended session is not handled here.** When the API cleared the cookie (empty value), forward
  the clear but leave the request's `cookie` header unchanged. The root layout's `/auth/me` then
  gets the 401 with the signed-out notice, and plan 31 shows it. If the request header dropped the
  cookie, the layout would render a signed-out page with no reason.
- **Skip prefetches.** Requests with `next-router-prefetch: 1` skip renewal; the navigation that
  follows renews.
- **Client requests need nothing.** A browser request to the API stores the renewed cookie itself.

Small clock differences between the web and API servers only mean a renewal is asked for a
little early. The API answers no `Set-Cookie` until its row is due, and the next request asks
again.

## `apps/web/src/lib/auth/jwtPayload.ts`

Runs in the middleware (edge runtime) and in the browser, so no Node `Buffer`.

```typescript
/**
 * Reads a JWT's payload without verifying its signature. Only for decisions the API re-checks:
 * when to ask for a renewal, and which local data to clear on sign-out.
 */
export function decodeJwtPayloadUnverified(token: string): Record<string, unknown> | null;
```

Split on `.`, require three parts, base64url-decode the second (replace `-`/`_`, pad with `=`,
`atob`, then `TextDecoder` over the bytes so non-ASCII claims decode), `JSON.parse`, and return the
object only when it is a non-null, non-array object. Any throw returns null. No `as`; narrow with a
local `isRecord` guard.

## `apps/web/src/lib/auth/webSessionRenewal.ts`

```typescript
export type WebSessionRenewal = {
  /** Every `Set-Cookie` value from the API response, unchanged. */
  setCookies: string[];
  /** The new `jwt` value when the API issued one; null when it cleared the cookie or set none. */
  renewedToken: string | null;
};

export function isWebSessionRenewalDue(token: string, nowMs: number): boolean;

export function readSetCookieValue(setCookies: string[], name: string): string | null;

export function replaceCookieInHeader(cookieHeader: string, name: string, value: string): string;

export async function fetchWebSessionRenewal(params: {
  apiBase: string;
  cookieHeader: string;
}): Promise<WebSessionRenewal | null>;
```

- `isWebSessionRenewalDue`: the Due rule above, using `decodeJwtPayloadUnverified`. A token that
  does not decode is not due (the API rejects it, and the layout's own call handles that).
- `readSetCookieValue`: for each value, take the first `;`-separated segment, split on the first
  `=`, trim; return the value of the last cookie named `name` when it is non-empty, else null.
  Express's `clearCookie` writes an empty value, so a clear returns null.
- `replaceCookieInHeader`: split the header on `;`, replace the value of the pair named `name`
  (trimmed name match), keep every other pair and its order, append `name=value` when absent, and
  join with `'; '`.
- `fetchWebSessionRenewal`: raw `fetch` with `AbortSignal.timeout(2000)`, as the existing middleware
  helpers do (`fetchWithTimeout` from `@podverse/helpers-backend` is Node-only and does not run in
  the middleware). Headers: `accept: application/json` and `cookie`.
  Read `response.headers.getSetCookie()`. Return null when that list is empty or on any throw;
  otherwise `{ setCookies, renewedToken: readSetCookieValue(setCookies, AuthCookieName) }`. Do not
  read the body.

Put a short doc comment at the top of the module stating the contract positively: the API owns
renewal; the web forwards the API's `Set-Cookie` unchanged because server components cannot set
cookies.

## `apps/web/src/middleware.ts`

1. At the top of `middleware`, compute the renewal once:
   - `token = request.cookies.get(AuthCookieName)?.value`.
   - When there is a token, the request is not a prefetch, `ssrApiBase()` is not null, and
     `isWebSessionRenewalDue(token, Date.now())`, call `fetchWebSessionRenewal` with
     `request.headers.get('cookie') ?? ''`. Otherwise
     `renewal = null`.
1. Build `requestHeaders = new Headers(request.headers)` once. When `renewal?.renewedToken` is
   set, `requestHeaders.set('cookie', replaceCookieInHeader(currentCookieHeader, AuthCookieName,
   renewal.renewedToken))`.
1. Every response path uses those headers and carries the renewal:
   - Add a local `withRenewal(response: NextResponse): NextResponse` that appends each
     `renewal.setCookies` value and returns the response.
   - Replace every bare `NextResponse.next()` with `NextResponse.next({ request: { headers:
     requestHeaders } })` wrapped in `withRenewal`.
   - `passThrough` and the clip-removed 410 branch set their extra request header
     (`MERGE_REDIRECT_CHECKED_HEADER`, `CLIP_REMOVED_REQUEST_HEADER`) on a copy of
     `requestHeaders`, not of `request.headers`.
   - The 308 merge redirect is wrapped too, so a renewal on a redirected visit is not lost.
1. `visitorClipRemoved` forwards the cookie header it is given (the possibly renewed one) instead of
   reading `request.headers.get('cookie')`.
1. Widen `config.matcher` to every page route:

   ```typescript
   export const config = {
     matcher: ['/((?!api/|_next/static|_next/image|.*\\.[a-zA-Z0-9]+$).*)'],
   };
   ```

   This keeps route handlers (`/api/proxy`, `/api/resolve-media-url`), build assets, and files
   with an extension (`favicon.ico`, `robots.txt`, `sitemap.xml`, images) out. The merge redirect
   and clip checks already return early for other paths (`mergeRedirectRouteFromPath` returns
   null; `clipIdFromPath` returns null), so their behavior on their own routes is unchanged.

Keep the file's existing helpers and order otherwise. Do not rename `middleware.ts` to the Next 16
`proxy.ts` convention in this plan.

## Tests

**Unit** (`apps/web` Vitest picks up `src/**/*.test.ts`):

- `jwtPayload.test.ts`: a token built in the test (base64url header and payload, any signature)
  decodes; base64url characters `-` and `_` and missing padding decode; a non-ASCII claim decodes;
  two parts, invalid base64, invalid JSON, and an array payload return null.
- `webSessionRenewal.test.ts`:
  - `isWebSessionRenewalDue`: fresh session token not due; `iat` exactly one interval old is due;
    no `iat` is due; no `sid` (even with an old `iat`) is not due; garbage is not due.
  - `readSetCookieValue`: a renewal value; a clear (`jwt=; Path=/; Expires=Thu, 01 Jan 1970
    00:00:00 GMT`) is null; another cookie name is null; two `jwt` values return the last.
  - `replaceCookieInHeader`: replaces in place among other cookies; appends when absent; keeps a
    value that contains `=`.
  - `fetchWebSessionRenewal`: stub `globalThis.fetch` with `vi.spyOn`; a response whose
    `headers.getSetCookie()` returns a renewal gives `renewedToken`; an empty list gives null; a
    rejected fetch gives null; the request carries `cookie`.

**E2E** — `apps/web/e2e/web-session-renewal.spec.ts`, with a dedicated seeded account so ending
sessions never touches the shared `e2e-user@example.com`.

- `tools/web/seed-e2e.mjs`: add `E2E_SESSIONS_EMAIL = 'e2e-sessions@example.com'` beside
  `E2E_CONSENT_ORDER_EMAIL` with a `/** Sync with apps/web/e2e/helpers/accountSessions.ts */`
  comment. Seed it after the consent-order account with the same statements as that account
  (random 15-char hex `id_text`, verified, credentials with `TEST_PASSWORD`, membership status,
  Trial grant, `account_settings`), except: terms acceptance uses `E2E_CONFIGURED_TERMS_VERSION`,
  and `account_settings` records a popularity-tracking decision
  (`allow_listen_stats false, listen_stats_accepted false, listen_stats_agreement_version
  E2E_POPULARITY_TRACKING_VERSION, listen_stats_decided_at NOW()`) so no gate covers the page. Log
  `Seeded sessions user: <email>` beside the other seed logs, in the same template-string form.
- `apps/web/e2e/helpers/accountSessions.ts` (later plans in this set extend it):
  - `E2E_SESSIONS_EMAIL`, `E2E_SESSIONS_PASSWORD = 'Test!1Aa'`, `E2E_API_BASE_URL =
    'http://localhost:4030/api/v2'` (the base the other specs use).
  - `loginSessionsUser(request: APIRequestContext): Promise<void>` — `POST /auth/login`, expect ok.
    Pass `page.request` for the browser's context.
  - `endOtherSessions(request: APIRequestContext): Promise<void>` — `POST
    /auth/sessions/revoke-others`, expect ok. Each test calls it right after logging in so earlier
    runs leave nothing behind.
  - `withAppDb<T>(run: (client: Client) => Promise<T>): Promise<T>` — `pg` `Client` with the same
    connection settings as `helpers/setE2eAccountTrial.ts`; always `end()`.
  - `signE2eJwt(payload: Record<string, unknown>): string` — HS256 with `node:crypto`
    `createHmac('sha256', secret)`, base64url segments, secret from
    `buildPodverseApiTestEnv({ profile: 'apiWebE2e' }).AUTH_JWT_SECRET` (import from
    `@podverse/helpers-config`, as `apps/web/playwright.e2e-server-env.ts` does). Nothing
    hardcodes the secret.
  - `readJwtCookie(context: BrowserContext): Promise<string>` — the `jwt` cookie value; throw when
    missing.
  - `decodeE2eJwtPayload(token: string): Record<string, unknown>` — `Buffer` base64url decode of
    the payload; throw when not an object.
- Cases (each with `capturePageLoad` / `actionAndCapture` from `helpers/stepScreenshots.ts`, as
  `settings-opml-export.spec.ts` does):
  1. **A session last renewed two days ago is renewed by a server-rendered page visit.** Log in,
     end other sessions, read the cookie and its `sid`, `id`, `id_text`. In the database set that
     row's `last_seen_at = now() - interval '2 days'`. Sign a web token with the same `id`,
     `id_text`, `sid`, `token_use: 'web'`, `iat` two days ago, and `exp` one year after that iat;
     put it in the context as `jwt` (`context.addCookies`, host from `baseURL`, path `/`,
     `httpOnly`, `sameSite: 'Strict'`). `page.goto('/podcasts')`: the document response's
     `headersArray()` has a `set-cookie` starting `jwt=` whose token differs from the signed one;
     the context's `jwt` cookie is that new token, its payload has the same `sid`, and its `iat`
     is within the last minute; the row's `last_seen_at` is within the last minute. The page
     renders signed in (the navbar account menu, not Login).
  2. **A fresh cookie makes no renewal call.** Log in, end other sessions, `page.goto('/podcasts')`:
     the document response has no `set-cookie` starting `jwt=`.
- Add `apps/web/e2e/web-session-renewal.spec.ts` to `makefiles/local/e2e-spec-order-web.txt`
  directly after `apps/web/e2e/set-password-invite-session.spec.ts`.

## Release scratchpad

```markdown
## Web keeps its session cookie fresh on every kind of visit

- Surfaces: web
- Change: the web middleware now runs on every page route. When the signed-in cookie is due for
  its once-a-day renewal, it asks the API to renew and passes
  the API's `Set-Cookie` straight to the browser. Pages rendered on the web server previously
  dropped a renewed cookie, so a visitor who only loaded pages would still have been signed out
  365 days after the last cookie the browser stored. Now the 365-day limit counts from the last
  visit of any kind.
- Who notices: nobody directly; signed-in web users stay signed in while they keep visiting.
- Operator steps: none
```
