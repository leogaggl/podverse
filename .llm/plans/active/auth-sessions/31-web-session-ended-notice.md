**Cursor model:** Cursor Grok 4.7 · **Reasoning:** extra high

# 31 — Web: show why the browser was signed out

When a session is ended somewhere else, the browser holding it shows the specific reason the
operator asked for, once, after it becomes signed out (R44, operator answer 4):

| Notice (plan 20) | Sentence |
| --- | --- |
| `signed_out_elsewhere` | You were signed out from another device. |
| `password_changed` | Your password was changed. |
| `admin_force_logout` | An administrator signed you out. |
| `security` | You were signed out for your security. |

A browser that signed itself out, or whose session simply ran past the idle limit, gets no
notice (plan 20 sends none) and keeps today's plain signed-out state.

This plan covers the path every page load takes: the root layout's server-side `/auth/me` gets the
401 with the notice. Plan 33 adds the same notice for a 401 that a request from the browser gets
while a page stays open.

## Rows

R44

## Runs after

20, 22, 30

## Files

- packages/helpers-requests/src/api/parseAuthSessionEndedError.ts
- packages/helpers-requests/src/api/parseAuthSessionEndedError.test.ts
- packages/helpers-requests/src/api/index.ts
- apps/web/src/lib/auth/sessionEndedNotice.ts
- apps/web/src/lib/auth/sessionEndedNotice.test.ts
- apps/web/src/utils/auth/ssrAuth.ts
- apps/web/src/app/layout.tsx
- apps/web/src/components/Auth/AuthSessionChecker.tsx
- apps/web/src/components/Auth/SessionEndedNotice.tsx
- apps/web/src/components/App/AppChrome.tsx
- packages/i18n-catalog/consumer/originals/en-US.json
- packages/i18n-catalog/consumer/originals/es.json
- packages/i18n-catalog/consumer/originals/fr.json
- packages/i18n-catalog/consumer/originals/el-GR.json
- apps/web/e2e/helpers/accountSessions.ts
- apps/web/e2e/web-session-ended-notice.spec.ts
- makefiles/local/e2e-spec-order-web.txt

## Before you start

Confirm, and stop and report if any is missing:

- `@podverse/helpers/authSessionNotice` (subpath in `packages/helpers/package.json`) exports
  `AUTH_SESSION_ENDED_NOTICES`, `AuthSessionEndedNotice`, and `parseAuthSessionEndedNotice`
  (plan 20).
- `apps/web/src/lib/auth/jwtPayload.ts` exports `decodeJwtPayloadUnverified`, and
  `apps/web/e2e/helpers/accountSessions.ts` exists (plan 30).
- `POST /auth/sessions/revoke-others` exists (plan 22).

## How the notice reaches the screen

1. The root layout (`apps/web/src/app/layout.tsx`) already calls `/auth/me` on every page load with
   the browser's cookie. On a 401 it now also reads the notice from the body.
1. Today a cookie with no account renders only `AuthSessionChecker`, which calls logout and
   reloads. Before it does, it now saves the notice in `sessionStorage` and, when there is a
   notice, clears this browser's Add by RSS credentials for that account (the same cleanup the
   navbar's Logout does).
1. After the reload the page renders signed out. `SessionEndedNotice`, mounted in `AppChrome`, takes
   the saved notice (reading it removes it) and shows a modal with the sentence.

`sessionStorage` survives the reload in the same tab and nothing else; a notice never shows in
another tab or after the tab closes. The URL stays clean (**routing-url-params**).

Credentials are cleared only when the server sent a notice. `AuthSessionChecker` also runs when
`/auth/me` failed for another reason, such as the API being unreachable, and that must not delete
local data.

## `packages/helpers-requests/src/api/parseAuthSessionEndedError.ts`

Follow `parseMembershipGateError.ts` in the same folder (local `isRecord`, no `as`).

```typescript
import type { AuthSessionEndedNotice } from '@podverse/helpers/authSessionNotice';
import { parseAuthSessionEndedNotice } from '@podverse/helpers/authSessionNotice';

/**
 * Reads the signed-out notice from a thrown request error (axios-style
 * `error.response.{status,data}`). Returns null unless the response is a 401 whose body is
 * `{ code: 'session_ended', notice }`. Shared by web and mobile so both read one contract.
 */
export function parseAuthSessionEndedError(error: unknown): AuthSessionEndedNotice | null;
```

Import from the `authSessionNotice` subpath, not the `@podverse/helpers` barrel, so mobile can use
this file. Add `export * from './parseAuthSessionEndedError.js';` to
`packages/helpers-requests/src/api/index.ts` directly after the `parseMembershipGateError.js` line.

## `apps/web/src/lib/auth/sessionEndedNotice.ts`

```typescript
import type { AuthSessionEndedNotice } from '@podverse/helpers';

export type SessionEndedNoticeMessageKey =
  | 'session_ended.signed_out_elsewhere'
  | 'session_ended.password_changed'
  | 'session_ended.admin_force_logout'
  | 'session_ended.security';

/** Exhaustive: a new notice fails to compile until it has copy. Keys are under `authentication`. */
export function sessionEndedNoticeMessageKey(
  notice: AuthSessionEndedNotice
): SessionEndedNoticeMessageKey;

/** Saves the notice for the page load after the sign-out reload. Browser only. */
export function storePendingSessionEndedNotice(notice: AuthSessionEndedNotice): void;

/** Returns the saved notice and removes it, so it shows once. Null when none or invalid. */
export function takePendingSessionEndedNotice(): AuthSessionEndedNotice | null;
```

- Storage key: `const SESSION_ENDED_NOTICE_STORAGE_KEY = 'podverse.auth.session_ended_notice';`.
- Both storage functions wrap `window.sessionStorage` access in `try`/`catch` (storage can be
  disabled); a failure stores or returns nothing.
- `takePendingSessionEndedNotice` removes the key before validating, then returns the value only
  when `AUTH_SESSION_ENDED_NOTICES.some((notice) => notice === value)` (a local type guard
  `isAuthSessionEndedNotice(value: string): value is AuthSessionEndedNotice`).
- `sessionEndedNoticeMessageKey` is a `switch` with one `case` per notice and no `default`
  (**i18n-user-facing-strings** § Reason-mapped copy).

Import `AUTH_SESSION_ENDED_NOTICES` from `@podverse/helpers` (the web app uses the barrel).

## `apps/web/src/utils/auth/ssrAuth.ts`

Add, and make `getSSRLoggedInAccount` delegate to it (its return type and other callers stay the
same):

```typescript
export type SSRAuthState = {
  account: DTOAccount | null;
  /** Set when `/auth/me` answered 401 because the session was ended elsewhere. */
  sessionEndedNotice: AuthSessionEndedNotice | null;
};

export async function getSSRAuthState(): Promise<SSRAuthState>;
```

No cookie → `{ account: null, sessionEndedNotice: null }`. `reqAuthMe()` succeeds →
`{ account, sessionEndedNotice: null }`. It throws → `{ account: null, sessionEndedNotice:
parseAuthSessionEndedError(error) }` (import from `@podverse/helpers-requests`).

## `apps/web/src/app/layout.tsx`

- Replace `getSSRLoggedInAccount()` with `getSSRAuthState()`; keep the local name
  `ssrLoggedInAccount` for `state.account` so the rest of the function is unchanged.
- When `ssrShouldLogout`, compute `ssrAccountIdText`: `decodeJwtPayloadUnverified(jwt)` and take
  `id_text` when it is a string, else null. It only picks which local data to clear on this
  browser; the API never sees it.
- Render `<AuthSessionChecker ssrShouldLogout={ssrShouldLogout}
  sessionEndedNotice={sessionEndedNotice} accountIdText={ssrAccountIdText} />`.

## `apps/web/src/components/Auth/AuthSessionChecker.tsx`

Props gain `sessionEndedNotice: AuthSessionEndedNotice | null` and `accountIdText: string | null`.
In the effect, before the existing logout call:

```typescript
if (sessionEndedNotice !== null) {
  storePendingSessionEndedNotice(sessionEndedNotice);
  await clearAddByRSSCredentialsForSignOut(accountIdText);
}
```

Keep the existing logout `try`/`catch` and `window.location.reload()`. Rewrite the two inline
comments so they describe what the code guarantees (**comments-future-forward**): logout clears
the cookie even when the session is already ended; the reload renders the signed-out page.
Add `sessionEndedNotice` and `accountIdText` to the effect's dependency list.

## `apps/web/src/components/Auth/SessionEndedNotice.tsx`

A `'use client'` component with no props.

- `const [notice, setNotice] = useState<AuthSessionEndedNotice | null>(null)`; a mount effect calls
  `takePendingSessionEndedNotice()` and sets it.
- Renders nothing when `notice` is null. Otherwise a `Modal` from `@podverse/ui`, following
  `ModalDeleteAccount.tsx` for props: `isOpen`, `onClose` (sets null), `header` and `ariaLabel` =
  `tAuthentication('session_ended.title')`, `closeButtonAriaLabel={tMisc('close_modal')}`. Body:
  `<Modal.Body><p>{tAuthentication(sessionEndedNoticeMessageKey(notice))}</p><Modal.Actions>` with
  one `Button` (`type="button"`, `variant="primary"`, `onClick` closes) labeled `tMisc('close')`.
- `useTranslations('authentication')` and `useTranslations('misc')`.

Mount it in `apps/web/src/components/App/AppChrome.tsx` in the main return, directly after
`<BackgroundActivityOverlay />`. Embed routes and the terms and popularity gates return earlier and
never show it; a signed-out page never shows those gates.

## i18n (consumer layer)

In each `packages/i18n-catalog/consumer/originals/<locale>.json`, add an `authentication.session_ended`
object directly after the `forced_logout_dismiss` key. Insert with StrReplace beside the sibling;
never rewrite the file (**large-file-reading**). Mobile (plans 40–49) may reuse these keys.

| Key | en-US | es | fr | el-GR |
| --- | --- | --- | --- | --- |
| `title` | You've Been Signed Out | Se ha cerrado tu sesión | Vous avez été déconnecté | Έχετε αποσυνδεθεί |
| `signed_out_elsewhere` | You were signed out from another device. | Se cerró tu sesión desde otro dispositivo. | Vous avez été déconnecté depuis un autre appareil. | Αποσυνδεθήκατε από άλλη συσκευή. |
| `password_changed` | Your password was changed. | Se cambió tu contraseña. | Votre mot de passe a été modifié. | Ο κωδικός πρόσβασής σας άλλαξε. |
| `admin_force_logout` | An administrator signed you out. | Un administrador cerró tu sesión. | Un administrateur vous a déconnecté. | Ένας διαχειριστής σας αποσύνδεσε. |
| `security` | You were signed out for your security. | Se cerró tu sesión por tu seguridad. | Vous avez été déconnecté pour votre sécurité. | Αποσυνδεθήκατε για την ασφάλειά σας. |

Do not edit `overrides/` or any `compiled/` file.

## Tests

**Unit:**

- `packages/helpers-requests/src/api/parseAuthSessionEndedError.test.ts` (same shape as
  `parseMembershipGateError.test.ts`): a 401 with each of the four notices returns it; a 401 with
  `code: 'session_ended'` and an unknown notice, a 401 with no body, a 403 with the session body,
  a non-object error, and `null` all return null.
- `apps/web/src/lib/auth/sessionEndedNotice.test.ts` (jsdom): each notice maps to its key; store
  then take returns the notice and a second take returns null; an invalid stored value returns
  null and is removed; a `sessionStorage.setItem` that throws (`vi.spyOn(Storage.prototype,
  'setItem')`) does not throw out of `storePendingSessionEndedNotice`.

**E2E** — `apps/web/e2e/web-session-ended-notice.spec.ts`, on the sessions account from plan 30.

Add to `apps/web/e2e/helpers/accountSessions.ts`:

- `FIREFOX_WINDOWS_USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:128.0)
  Gecko/20100101 Firefox/128.0'` (plan 20 labels it `Firefox · Windows`).
- `newOtherDeviceRequest(playwright: PlaywrightWorkerArgs['playwright'], userAgent: string):
  Promise<APIRequestContext>` — `playwright.request.newContext({ extraHTTPHeaders: {
  'user-agent': userAgent } })`, then `loginSessionsUser` on it. The caller disposes it.

Case — **A browser whose session was ended from another device says so after its next page load**:

1. `loginSessionsUser(page.request)`, `endOtherSessions(page.request)`, `page.goto('/podcasts')`;
   the page is signed in.
1. Open the other device with `FIREFOX_WINDOWS_USER_AGENT` and call `endOtherSessions` on it.
1. `page.reload()`. A dialog named "You've Been Signed Out" is visible with the text "You were
   signed out from another device."; capture it with the dialog as the verified element
   (**e2e-screenshot-verified-element**). The navbar shows Login. The context has no `jwt` cookie.
1. Click "Close"; the dialog is hidden. `page.reload()`; no dialog appears (the notice shows once).
1. Dispose the other device's request context.

Add the spec to `makefiles/local/e2e-spec-order-web.txt` directly after
`apps/web/e2e/web-session-renewal.spec.ts`.

## Release scratchpad

```markdown
## Web says why it signed you out

- Surfaces: web, helpers-requests, i18n catalogs (consumer)
- Change: when a browser's session was ended somewhere else, its next page load signs it out and
  shows a dialog with the reason: "You were signed out from another device.", "Your password was
  changed.", "An administrator signed you out.", or "You were signed out for your security." The
  browser's saved Add by RSS credentials for that account are cleared, as with Logout. Signing
  out yourself, or a session that ran past the idle limit, shows no dialog. New shared helper
  `parseAuthSessionEndedError` in `@podverse/helpers-requests` reads the 401 body.
- Who notices: web users signed out from another device, by an administrator, by a password
  change, or by the theft check
- Operator steps: none
```
