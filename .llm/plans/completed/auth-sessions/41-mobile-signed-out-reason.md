**Cursor model:** Cursor Grok 4.7 · **Reasoning:** extra high

# 41 — Mobile shows why the server signed it out

When the server ends a session, plan 20's 401 carries `{ code: 'session_ended', notice }`. The app
already shows a one-time "You've Been Signed Out" dialog after a server sign-out
(`ForcedLogoutNotice`). This plan carries the notice from the 401 into that dialog so it names the
reason the operator asked for:

| Notice from the API | Sentence shown |
| --- | --- |
| `signed_out_elsewhere` | You were signed out from another device. |
| `password_changed` | Your password was changed. |
| `admin_force_logout` | An administrator signed you out. |
| `security` | You were signed out for your security. |
| none (idle limit passed, account deleted, plain 401) | Your session expired. |

The rest of the dialog stays: the existing warning that changes made while signed out stay on this
device, a Login button, and Not Now.

## Rows

R45

## Runs after

40, 31

## Files

- apps/mobile/src/auth/forcedLogoutNotice.ts
- apps/mobile/src/auth/forcedLogoutNotice.test.ts
- apps/mobile/src/auth/forcedLogoutNoticeCopy.ts
- apps/mobile/src/auth/forcedLogoutNoticeCopy.test.ts
- apps/mobile/src/auth/authRequestWithRefresh.ts
- apps/mobile/src/auth/authRequestWithRefresh.test.ts
- apps/mobile/src/auth/AuthProvider.tsx
- apps/mobile/src/auth/backgroundAuthDeps.ts
- apps/mobile/src/auth/completeMobilePasswordLogin.ts
- apps/mobile/src/auth/logoutWithMobileRevoke.ts
- apps/mobile/src/components/feedback/ForcedLogoutNotice.tsx
- apps/mobile/src/prefs/prefsStore.ts
- apps/mobile/src/prefs/prefsStore.test.ts
- apps/mobile/src/sync/syncJobs.ts
- apps/mobile/vitest.config.ts
- packages/i18n-catalog/consumer/originals/en-US.json
- packages/i18n-catalog/consumer/originals/es.json
- packages/i18n-catalog/consumer/originals/fr.json
- packages/i18n-catalog/consumer/originals/el-GR.json

## Before you start

Plans 20, 31, and 40 must be done. Confirm:

- `packages/helpers/package.json` exports `./authSessionNotice`, and
  `packages/helpers/src/lib/authSessionNotice.ts` exports `AUTH_SESSION_ENDED_NOTICES` and
  `AuthSessionEndedNotice`.
- Plan 31's `parseAuthSessionEndedError(error: unknown): AuthSessionEndedNotice | null` is exported
  from `@podverse/helpers-requests` (`packages/helpers-requests/src/api/parseAuthSessionEndedError.ts`).
  It returns the notice only for a 401 whose body is `{ code: 'session_ended', notice }`. Reuse it;
  do not write a mobile copy (**reuse-beyond-components**).
- The consumer catalogs have plan 31's `authentication.session_ended` object (`title`,
  `signed_out_elsewhere`, `password_changed`, `admin_force_logout`, `security`).
- `authRequestWithRefresh.ts` has plan 40's `rememberAccessToken` / `rememberSavedCredentials`.

If any is missing, stop and report. Import the notice type and list from
`@podverse/helpers/authSessionNotice` only, never the `@podverse/helpers` barrel.

Grep `apps/mobile/src` for `clearSession(` and `hasPendingForcedLogoutNotice` before editing, in
case a new caller landed.

## `forcedLogoutNotice.ts`

- Add `import type { AuthSessionEndedNotice } from '@podverse/helpers/authSessionNotice';`.
- Export the shared function type every caller uses:

  ```typescript
  /** Ends the session. `notice` is the server's reason, when the 401 carried one. */
  export type ClearSession = (
    reason: SessionEndReason,
    notice?: AuthSessionEndedNotice | null
  ) => Promise<void>;
  ```

- `markForcedLogout({ notice, occurredAt = new Date() }: { notice: AuthSessionEndedNotice | null;
  occurredAt?: Date })`. Write the notice first (`setPref('auth.forced_logout_notice', notice)`, or
  `clearPref('auth.forced_logout_notice')` when null), then `auth.forced_logout_at`. The timestamp
  is the presence marker, so a marker that exists always has its notice beside it.
- Replace `hasPendingForcedLogoutNotice` with:

  ```typescript
  export type PendingForcedLogoutNotice = { notice: AuthSessionEndedNotice | null };

  /** The notice owed to the user, or null when none is pending. */
  export const readPendingForcedLogoutNotice = async (): Promise<PendingForcedLogoutNotice | null>;
  ```

  Null when `auth.forced_logout_at` is absent or empty; otherwise `{ notice }` from
  `getPref('auth.forced_logout_notice')` (the pref guard already turns an unknown value into null).
- `clearForcedLogoutNotice` clears `auth.forced_logout_at` first, then `auth.forced_logout_notice`.
- Update the `SessionEndReason` doc comment on `session_expired`: the 401 may carry a notice naming
  why (another device, password change, administrator, security); without one the session expired.

## `forcedLogoutNoticeCopy.ts` (new, pure)

```typescript
import type { AuthSessionEndedNotice } from '@podverse/helpers/authSessionNotice';

export type ForcedLogoutReasonKey =
  | 'authentication.session_ended.admin_force_logout'
  | 'authentication.session_ended.expired'
  | 'authentication.session_ended.password_changed'
  | 'authentication.session_ended.security'
  | 'authentication.session_ended.signed_out_elsewhere';

/** The sentence that opens the forced-logout dialog. Null is a session that expired. */
export const forcedLogoutReasonKey = (
  notice: AuthSessionEndedNotice | null
): ForcedLogoutReasonKey;
```

Return the `expired` key for null first, then an exhaustive `switch (notice)` with one case per
notice and no `default` (**i18n-user-facing-strings** § Reason-mapped copy). Null here is a real
outcome the server reports (idle limit, deleted account), not a hidden state.

## `prefsStore.ts`

Add pref key `'auth.forced_logout_notice'` with value type `AuthSessionEndedNotice`, following how
`'pmt'` is wired: `PrefKey`, `PrefValueMap` (doc comment: the server's reason for the pending
forced logout; absent when the 401 named none), `PREF_KEYS` (right after
`'auth.forced_logout_at'`), `createEmptySnapshot`, a `getPref` overload whose implementation
returns the stored string only when `AUTH_SESSION_ENDED_NOTICES` contains it (a module-level
`isAuthSessionEndedNotice` guard like `isMediaTypePreference`), a `setPref` overload, and the
`hydratePrefs` branch. Import `AUTH_SESSION_ENDED_NOTICES` and the type from
`@podverse/helpers/authSessionNotice`.

## `authRequestWithRefresh.ts`

- `AuthRequestDeps.clearSession` becomes `ClearSession`.
Import `parseAuthSessionEndedError` from `@podverse/helpers-requests`.

- `AuthRequestDeps.clearSession` becomes `ClearSession`.
- `refreshAccessTokenSingleFlight` catch: `if (getErrorResponseStatus(error) === 401)` →
  `await clearSession('session_expired', parseAuthSessionEndedError(error))`. Remove the
  `errorCode === 'refresh_token_reuse_detected'` branch and the `getErrorResponseBodyCode` import:
  plan 20 answers reuse with a 401 carrying the `security` notice. Update the comment above it to
  say the server refused the refresh token and may say why.
- `requestWithMobileAuthRefresh`: the just-refreshed 401 path calls
  `deps.clearSession('session_expired', parseAuthSessionEndedError(error))`, and the retry path
  calls it with `parseAuthSessionEndedError(retryError)`.

## `AuthProvider.tsx`

- `AuthContextValue.clearSession` becomes `ClearSession`.
- `clearSession = useCallback(async (reason, notice = null) => …)`. When
  `shouldNotifyForcedLogout(reason)`, call `markForcedLogout({ notice })`. Concurrent clears still
  share the first call's promise, so the first notice wins; every 401 for one ended session carries
  the same notice, so they agree.

## `backgroundAuthDeps.ts`

`clearSession` becomes `async (reason, notice = null) => { … }`. After clearing tokens, when
`shouldNotifyForcedLogout(reason)`, call `markForcedLogout({ notice })` inside a try/catch that
`console.warn`s. Without this, a background refresh refused by the server signs the device out and
never tells the user. The foreground's next request then fails its own refresh with the same notice
and runs the full `clearSession`.

## Other callers

- `completeMobilePasswordLogin.ts`: `CompleteMobilePasswordLoginParams.clearSession` becomes
  `ClearSession`.
- `logoutWithMobileRevoke.ts`: `LogoutWithMobileRevokeParams.clearSession` becomes `ClearSession`.
- `syncJobs.ts` `createAccountRefreshJob`: `clearSession('session_expired',
  parseAuthSessionEndedError(error))`.

## `ForcedLogoutNotice.tsx`

- Read with `readPendingForcedLogoutNotice()`. Hold the pending value in state separately from
  `isVisible`, and keep the last value while the dialog closes so the text cannot change during the
  fade.
- `body={`${t(forcedLogoutReasonKey(pending.notice))} ${t('authentication.forced_logout_body')}`}`:
  the reason sentence, a space, then the existing warning. Title, buttons, and test IDs stay.
- Update the component doc comment: it names the server's reason when one was given.

## Catalog (`consumer` layer, all four locales)

Consumer is shared with web. Plan 31 already added `authentication.session_ended` with the four
notice sentences; mobile reuses them. Add one key to that object, after `security`:

| Key | en-US | es | fr | el-GR |
| --- | --- | --- | --- | --- |
| `expired` | Your session expired. | Tu sesión caducó. | Votre session a expiré. | Η συνεδρία σας έληξε. |

Reword `authentication.forced_logout_body` so it no longer states a reason, because the reason
sentence now comes first: "You're now using Podverse signed out. Anything you subscribe to or
change from here stays on this device and won't be saved to your account. Log back in to pick up
where you left off."

Write natural `es`, `fr`, and `el-GR` rewordings of the body that keep each locale's current
wording for the remaining sentences, in each language's own sentence case (**ui-copy-casing**). Insert beside the siblings with StrReplace; never
rewrite a catalog file (**large-file-reading**). Compiled catalogs are gitignored build output
(`npm run i18n:compile`, **i18n-management**); do not edit `compiled/`.

## `vitest.config.ts`

Add `'src/auth/forcedLogoutNoticeCopy.test.ts'` to `include` beside
`'src/auth/forcedLogoutNotice.test.ts'`, and extend the header clause about the forced-logout
marker to mention the reason it stores and the reason-to-copy mapping.

## Tests

- `forcedLogoutNotice.test.ts`: `markForcedLogout({ notice: 'security' })` then
  `readPendingForcedLogoutNotice()` → `{ notice: 'security' }`; with `notice: null` → `{ notice:
  null }` and no stored notice key; `clearForcedLogoutNotice` makes it read null; a stored notice
  string outside the union reads as `{ notice: null }`. Replace the `hasPendingForcedLogoutNotice`
  cases. (Parsing the 401 body is plan 31's `parseAuthSessionEndedError` and is tested there.)
- `forcedLogoutNoticeCopy.test.ts`: one case per notice plus null.
- `authRequestWithRefresh.test.ts`: a refresh 401 whose body is `{ code: 'session_ended', notice:
  'signed_out_elsewhere' }` calls `clearSession('session_expired', 'signed_out_elsewhere')`; a plain
  refresh 401 calls `clearSession('session_expired', null)`; the just-refreshed 401 path passes the
  notice from that response. Extend the test file's `httpError` helper to take an optional body
  (`response.data`).
- `prefsStore.test.ts`: the hydrated snapshot includes `'auth.forced_logout_notice': null`; a
  stored valid notice round-trips; an unknown string reads as null.

Maestro coverage of the dialog text is in plan 42's `auth-sessions` flow, which can end the
device's session from the host.

## Release scratchpad

```markdown
## Mobile says why it was signed out

- Surfaces: mobile, i18n (consumer catalog)
- Change: when the server ends the app's session, the "You've Been Signed Out" dialog now opens
  with the reason: signed out from another device, password changed, signed out by an
  administrator, or signed out for your security (a reused refresh token). With no reason it says
  the session expired. Sessions ended during background work now also leave the notice for the
  next time the app opens. Reuses web's `authentication.session_ended.*` sentences and adds
  `authentication.session_ended.expired`; `authentication.forced_logout_body` no longer states a
  reason.
- Who notices: mobile users signed out remotely
- Operator steps: none
```
