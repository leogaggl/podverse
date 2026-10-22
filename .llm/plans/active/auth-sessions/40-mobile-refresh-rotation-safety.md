**Cursor model:** Opus 5.5 · **Reasoning:** extra high

# 40 — Mobile refresh never presents a rotated-away or unsaved refresh token

Plan 20 rotates the mobile refresh token on every refresh. The server accepts the current token
and the previous one; anything older ends the session as suspected theft (`refresh_reuse`, shown
as "You were signed out for your security"). This plan makes the mobile client hold up its side:
it only ever presents the refresh token that is saved in SecureStore, so normal use can never look
like theft.

This plan also answers R6 in prose. The implementer repeats the R6 answer in the final message.

## Rows

R6, R24

## Runs after

20

## Files

- apps/mobile/src/auth/authRequestWithRefresh.ts
- apps/mobile/src/auth/authRequestWithRefresh.test.ts
- apps/mobile/src/auth/AuthProvider.tsx
- apps/mobile/src/auth/backgroundAuthDeps.ts
- apps/mobile/vitest.config.ts

## Before you start

Other work is landing in the tree. Re-read the four source files in full. `vitest.config.ts` also
has uncommitted edits from other work; keep them.

Plan 20 does not change the refresh response shape (`access_token`, `refresh_token`, and the two
`*_expires_in` fields), so nothing here depends on plan 20's code landing first. The order exists
because the rotation behavior this plan protects against starts with plan 20.

## Answer to R6: does mobile already keep a login for a long time?

Yes. Read from the code as it stands:

- **Storage.** Login writes the access and refresh tokens to SecureStore (Keychain / Keystore) with
  `AFTER_FIRST_UNLOCK` (`secureTokenStorage.ts`). They survive app restarts, phone restarts, and
  app updates. On iOS the Keychain entry can also outlive deleting the app.
- **Launch.** `hydrateFromSecureStorage` reads both tokens and the cached account from SQLite and
  shows the signed-in app with no network request. When the access token is expired or within 60
  seconds of expiring, `primeAccessTokenRefresh` starts a refresh in the background.
- **Every request.** Authenticated requests go through `requestWithMobileAuthRefresh`. It refreshes
  first when the 15-minute (900-second) access token is within 60 seconds of `exp`, shares one
  refresh across every caller (`refreshAccessTokenSingleFlight`), and retries a 401 once after a
  refresh. The user never sees the 900 seconds.
- **Why it lasts.** Each refresh returns a new 365-day refresh token, so the year restarts on every
  refresh. An install that makes any signed-in request at least once a year stays signed in.
- **What ends it.** Only the server refusing the refresh (a 401). Timeouts, offline, and 5xx leave
  the session alone, so an offline phone stays signed in. When the server does refuse,
  `clearSession('session_expired')` signs the app out and the forced-logout notice explains it.
- **What it lacks before this set.** The refresh token is not rotated or recorded server-side, so
  nothing can end a mobile session short of rotating `AUTH_JWT_SECRET`, and Logout only forgets the
  tokens on the phone.

## The hole this plan closes

Today `refreshAccessTokenSingleFlight` calls `rememberAuthCredentials(new pair)` before
`await setTokens(...)`, so the new refresh token is published in memory before SecureStore has
it. Two paths then present a token the server no longer accepts once rotation lands:

1. **Unsaved token used.** The SecureStore write fails (or the app is killed after the response and
   before the write). Memory holds N, SecureStore still holds K. The next refresh presents N, the
   server rotates to M with previous N, and K is now neither. The next launch reads K from
   SecureStore and the session ends as theft.
1. **Stale caller token.** Background work (`createBackgroundAuthDeps`: car sync, auto-download)
   refreshes and saves new tokens without updating React state. The foreground `AuthProvider` still
   holds the old refresh token in state. `refreshWithStoredToken` and the 401 retry path in
   `requestWithMobileAuthRefresh` pass a caller-supplied refresh token. After two background
   refreshes, the foreground copy is two rotations old and its refresh ends the session.

Server rule to keep in mind (plan 10): presenting the previous token rotates and leaves previous
unchanged. So presenting the token in SecureStore is always safe, however many times in a row,
until a new token is saved.

## Invariant

The refresh token sent to `/auth/mobile/refresh` is the one most recently confirmed in
SecureStore for the current auth session generation. A new refresh token becomes eligible to send
only after its SecureStore write resolves. (`expo-secure-store` resolves after the Keychain write on
iOS and after `SharedPreferences.commit()` on Android, so a resolved write is durable.)

Single-flight stays as it is: one refresh at a time per JS runtime, and the in-flight promise is
held until `setTokens` settles, so no second refresh can start between the response and the write.

All JS in the app (foreground, background tasks, car sync) shares one runtime and one module
instance, so the module-level state below covers every caller. Android Auto browsing is native and
never refreshes tokens.

## Changes in `authRequestWithRefresh.ts`

Replace the single `storedCredentials` pair with two published values, each stamped with
`authSessionGeneration`:

- **Published access token** — the newest access token. May be published before it is saved, so a
  request already in flight uses it. Access tokens are not rotation-checked, so an unsaved one is
  harmless.
- **Saved refresh token** — set only from a confirmed SecureStore value.

Exports (replace `rememberAuthCredentials`; update every caller):

- `rememberAccessToken(accessToken: string): void` — publish an access token for the current
  generation.
- `rememberSavedCredentials(accessToken: string, refreshToken: string): void` — call after both
  SecureStore writes resolved. Publishes the access token and the saved refresh token.
- `adoptStoredCredentials(accessToken: string, refreshToken: string): void` — call after reading
  tokens from SecureStore (hydrate, background deps). Publishes only when no saved refresh token is
  published for the current generation, so a read that raced a refresh cannot replace a newer
  saved token with an older one.
- `advanceAuthSessionGeneration` clears both values, as it clears `storedCredentials` today.

`chooseCredentials` reads the published access token and the saved refresh token instead of the
pair. Its preference rules (stored usable access token, later `exp` wins, fall back to the caller)
stay the same.

`refreshAccessTokenSingleFlight`:

1. The token it sends is the saved refresh token for the current generation when one exists, else
   the `refreshToken` argument. The argument becomes a fallback only (first refresh before
   anything was published, and tests).
1. On success, after the existing generation check: `rememberAccessToken(new access)`, then
   `await setTokens(new pair)`. Every `setTokens` implementation calls `rememberSavedCredentials`
   after its writes resolve (below).
1. When `setTokens` rejects (SecureStore write failed), log with `console.warn` and return the new
   access token. Do not rethrow and do not clear the session. The saved refresh token is still the
   old one, which the server accepts as previous, so the next refresh presents it again.
1. Keep the existing second generation check after `setTokens`.

Error handling in the catch block is unchanged in this plan (plan 41 adds the signed-out reason
there).

Rewrite the doc comments on the module state to state the invariant positively (see
**comments-future-forward**): what each value holds and when it is set.

## Changes in `AuthProvider.tsx`

- `setTokens`: replace the early `rememberAuthCredentials` with `rememberAccessToken(accessToken)`
  before the writes. After `Promise.all` resolves and the generation check passes, call
  `rememberSavedCredentials(accessToken, refreshToken)` before the React state updates. When the
  generation changed, publish nothing (sign-out already cleared it).
- `hydrateFromSecureStorage`: replace `rememberAuthCredentials(storedAccessToken,
  storedRefreshToken)` with `adoptStoredCredentials(...)`.
- `refreshWithStoredToken` keeps passing React state's `refreshToken`; the single-flight now
  prefers the saved token, so a stale state value is harmless. No other change.
- `logout` keeps passing React state's `refreshToken` to `logoutWithMobileRevoke`. Plan 20's
  `/auth/mobile/revoke` ends the session for any validly signed refresh token of that session, so a
  stale copy still signs out on the server.

## Changes in `backgroundAuthDeps.ts`

- Replace `rememberAuthCredentials(accessToken, refreshToken)` after the read with
  `adoptStoredCredentials(...)`.
- `setTokens`: `rememberAccessToken(nextAccess)` first, then the two writes, then
  `rememberSavedCredentials(nextAccess, nextRefresh)` after both resolve. Capture
  `getAuthSessionGeneration()` before the writes and skip the publish when it changed, as
  `AuthProvider.setTokens` does.

## `vitest.config.ts`

`src/auth/authRequestWithRefresh.test.ts` exists but is not in `include`, so it never runs. Add it
in alphabetical position among the `src/auth/*` entries. Add one clause to the header comment
listing the auth refresh gate (`src/auth/authRequestWithRefresh.ts` — the API factory, offline
pref, and connectivity reporter are mocked, so the gate runs in node). It imports
`../sync/syncErrorClassification`, which is already covered in node.

## Tests

`apps/mobile/src/auth/authRequestWithRefresh.test.ts` (newly included). Read the existing cases
first: they were written before the file was included, so update any that assume the old
`rememberAuthCredentials` behavior, and keep the rest. Add behavior cases, not implementation
checks (**unit-test-design-no-overgranularity**):

- A refresh sends the saved refresh token when the caller passes an older one (simulates stale
  React state after a background refresh): `rememberSavedCredentials(expiredAccess, 'R2')`, then
  `requestWithMobileAuthRefresh` with `refreshToken: 'R0'` and an expired access token →
  `reqAuthMobileRefresh` called with `'R2'`.
- When `setTokens` rejects, the request still runs with the new access token, `clearSession` is
  not called, and the next refresh (force the new access token expired) sends the old saved
  refresh token, not the one from the failed write.
- `adoptStoredCredentials` does not replace a saved refresh token already published for this
  generation, and does publish after `advanceAuthSessionGeneration`.
- A refresh that started before `advanceAuthSessionGeneration` publishes neither token (keep or
  adapt the existing case).
- Concurrent callers needing a refresh share one `reqAuthMobileRefresh` call (keep the existing
  case if present).

Maestro: none. Rotation races cannot be arranged from a flow; the unit tier holds them
(**mobile-test-economics**). Plan 42's flow exercises refresh against a session-bound server end to
end.

## Release scratchpad

```markdown
## Mobile refresh is safe with refresh-token rotation

- Surfaces: mobile
- Change: the app only sends a refresh token after it is saved in secure storage, and every
  refresh (foreground, background tasks, car sync) sends the most recently saved one. A failed
  secure-storage write after a refresh no longer fails the request; the app keeps using the
  previous refresh token, which the server still accepts. This keeps normal use from looking like
  a stolen token once the API rotates refresh tokens.
- Why mobile already stayed signed in (asked during planning): tokens live in secure storage, the
  15-minute (900-second) access token is refreshed silently before each request needs it, and each
  refresh returns a new 365-day refresh token, so any signed-in use within a year keeps the login.
  Only a server 401 signs the app out; offline and server errors never do.
- Who notices: nobody directly; it prevents unexpected "signed out for your security" sign-outs.
- Operator steps: none
```
