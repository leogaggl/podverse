**Cursor model:** Cursor Grok 4.7 · **Reasoning:** extra high

# 66 — Management-web cookie renewal and the signed-out reason

The management API renews `pv_mgmt_auth` by sending `Set-Cookie` (plan 62). A browser call stores
that cookie. A server-rendered call does not, unless this app copies `Set-Cookie` onto the
document response. Without that copy, the first request of the day renews the row and the
browser keeps a cookie whose JWT still expires on the old date.

When a session was ended, the next request gets a 401 with `code: session_ended` and a `notice`.
The login page shows the matching sentence once. Public pages do not exist on this app besides
login and the invite redeem flow; every signed-in page uses `ensureAuthenticated`, so the 401
is the signal.

## Rows

R46

## Runs after

65

Plan 65 edits the management i18n originals. This plan adds keys beside those.

## Files

- apps/management-web/src/middleware.ts
- apps/management-web/src/lib/auth/sessionEndedNotice.ts
- apps/management-web/src/lib/auth/sessionEndedNotice.test.ts
- apps/management-web/src/lib/requests/auth.ts
- apps/management-web/src/hooks/useManagementClientSessionGuard.ts
- apps/management-web/src/app/page.tsx
- packages/i18n-catalog/management/originals/en-US.json
- packages/i18n-catalog/management/originals/es.json
- packages/i18n-catalog/management/originals/fr.json
- packages/i18n-catalog/management/originals/el-GR.json
- apps/management-web/e2e/auth-session-notice.spec.ts

## Before you start

Plan 62 must be done. Confirm `@podverse/helpers/authSessionNotice` exports
`AUTH_SESSION_ENDED_NOTICES`, `parseAuthSessionEndedNotice`, and the `AuthSessionEndedNotice`
type. Management-web already depends on `@podverse/helpers`. If the subpath is missing, stop
and report.

Do not import from `apps/web`.

## Notice map (`sessionEndedNotice.ts`)

```typescript
export function isAuthSessionEndedNotice(value: string): value is AuthSessionEndedNotice {
  return (
    value === 'signed_out_elsewhere' ||
    value === 'password_changed' ||
    value === 'admin_force_logout' ||
    value === 'security'
  );
}
```

`sessionEndedNoticeMessageKey(notice)` is an exhaustive switch. No default branch.

| Notice | Catalog key | en-US |
| --- | --- | --- |
| `signed_out_elsewhere` | `auth.signedOutElsewhere` | You were signed out from another device |
| `password_changed` | `auth.passwordChanged` | Your password was changed |
| `admin_force_logout` | `auth.signedOutByAdministrator` | An administrator signed you out |
| `security` | `auth.signedOutForSecurity` | You were signed out for your security |

Add the four keys under `auth` in all four management originals. Other locales:

| Key | es | fr | el-GR |
| --- | --- | --- | --- |
| `auth.signedOutElsewhere` | Se cerró tu sesión desde otro dispositivo | Vous avez été déconnecté depuis un autre appareil | Αποσυνδεθήκατε από άλλη συσκευή |
| `auth.passwordChanged` | Se cambió tu contraseña | Votre mot de passe a été modifié | Ο κωδικός πρόσβασής σας άλλαξε |
| `auth.signedOutByAdministrator` | Un administrador cerró tu sesión | Un administrateur vous a déconnecté | Ένας διαχειριστής σάς αποσύνδεσε |
| `auth.signedOutForSecurity` | Se cerró tu sesión por tu seguridad | Vous avez été déconnecté pour votre sécurité | Αποσυνδεθήκατε για την ασφάλειά σας |

Do not edit `overrides/`. Run `npm run i18n:compile`.

`sessionEndedNotice.test.ts`: each notice maps to its key, and a string outside the four is not
a notice. That is the whole file.

## Middleware (`apps/management-web/src/middleware.ts`)

There is no middleware in this app today. Add one.

On a document request that has a `pv_mgmt_auth` cookie, `GET` the management API `/auth/me` with
that cookie. Build the base the same way `apps/web/src/middleware.ts` builds `ssrApiBase`, from
`NEXT_PUBLIC_SSR_API_PROTOCOL`, `NEXT_PUBLIC_SSR_API_HOST`, `NEXT_PUBLIC_SSR_API_PORT`,
`NEXT_PUBLIC_API_PREFIX`, and `NEXT_PUBLIC_API_VERSION`. If any required piece is missing, call
`NextResponse.next()` and do not fetch.

Skip the fetch when the `Next-Router-Prefetch` header is `1`, and when the path starts with
`/_next`. Matcher:

```typescript
export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
```

Read every `Set-Cookie` with `response.headers.getSetCookie()` and append each onto the
`NextResponse`. That is both the renewed cookie and the cookie clear.

- **200** with `Set-Cookie`: `NextResponse.next()` plus those cookies. The browser stores the
  renewed cookie. The page may still have read the old value for this one render; the next
  request uses the new one.
- **401** whose body parses to a notice (`parseAuthSessionEndedNotice`): if the path is not
  `/`, redirect to `/?notice=<notice>` and append the cookie clear. If the path is already `/`,
  do not redirect (that would loop); `NextResponse.next()` plus the cookie clear. The login page
  reads `notice`.
- **401** with no notice: `NextResponse.next()` plus the cookie clear. No `notice` query.
- Any other status, or a failed fetch: `NextResponse.next()` and do not copy cookies. A down API
  must not sign the browser out.

Only copy `Set-Cookie` values whose cookie name is `pv_mgmt_auth`.

## Client

`getCurrentUser` stays `Promise<CurrentUser | null>`. Callers that treat null as signed out keep
working.

Add `getManagementAuthResult()` in `apps/management-web/src/lib/requests/auth.ts`:

```typescript
export type ManagementAuthResult =
  | { user: CurrentUser; notice: null }
  | { user: null; notice: AuthSessionEndedNotice | null };
```

On success, `{ user, notice: null }`. On a 401, `{ user: null, notice: parseAuthSessionEndedNotice(body) }`.
On any other error, log it the way `getCurrentUser` logs non-401s and return `{ user: null, notice: null }`.
`getCurrentUser` becomes a wrapper that returns `result.user`.

`useManagementClientSessionGuard`: call `getManagementAuthResult`. When `user` is null and
`notice` is set, `router.replace('/?notice=' + notice)` (honor `redirectPath` when the caller
passed one: append `notice` to that path). When `user` is null and `notice` is null, keep today's
`router.replace(redirectPath)`.

## Login page (`apps/management-web/src/app/page.tsx`)

This page is `/`. It already calls `getCurrentUser` on mount and redirects to the dashboard when
someone is signed in.

- Read `notice` with `useSearchParams`. Ignore a value that fails `isAuthSessionEndedNotice`.
- Also read the notice from `getManagementAuthResult` when the mount check returns one.
- If either is set, show an `Alert` with `t(sessionEndedNoticeMessageKey(notice))` above the
  form. Prefer the result notice when both exist.
- A signed-in user still redirects to the dashboard and does not show the alert.
- Do not leave the query param as the only copy of a notice the mount check discovered: the
  middleware is what puts it on the URL for a full page load. The client guard puts it on the
  URL for a client redirect. The page only displays it.

## Tests

`sessionEndedNotice.test.ts` (above): each notice maps to its catalog key, and a string outside
the four is not a notice.

`apps/management-web/e2e/auth-session-notice.spec.ts`. Describe title: "Signed-out reason on the
management login page". Do not sign in.

- Visit `/?notice=password_changed`. The page shows `Your password was changed`. Capture that
  alert with `capturePageLoad`.
- Visit `/?notice=admin_force_logout`. The page shows `An administrator signed you out`.
- Visit `/?notice=not-a-notice`. The page does not show any of the four sentences.
- Visit `/` with no query. The page does not show any of the four sentences.

The middleware fetch is not covered here. Playwright's `page.route` does not see the server-side
`fetch`, and the login page has no cookie in these cases so the middleware does not call
`/auth/me`. The API integration tests in plan 62 hold the 401 body. This spec holds the
allowlist and the four sentences the operator asked for.

## Release scratchpad

```markdown
## Management login shows why an admin was signed out

- Surfaces: management-web
- Change: a renewed `pv_mgmt_auth` cookie from a server-rendered request is copied onto the
  browser response, so an admin who keeps using management-web is not signed out a year after
  login. When a session was ended, the login page shows one of: "You were signed out from
  another device", "An administrator signed you out", "Your password was changed", or "You were
  signed out for your security".
- Who notices: admins who were signed out from another session, by a superuser, by a password
  change, or because a refresh token was reused
- Operator steps: none
```
