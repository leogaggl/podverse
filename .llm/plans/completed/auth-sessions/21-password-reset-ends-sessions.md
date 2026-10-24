**Cursor model:** Cursor Grok 4.7 · **Reasoning:** extra high

# 21 — Password reset and invite completion end every session; account deletion clears the cookie

Two public email-link routes set an account's password, and both end every session of that
account with reason `password_changed`:

- `POST /account/reset-password` (forgotten password). The operator's answer: "A forgotten-password
  reset ends every session." Whoever held a session, on any device, is signed out, and the user
  signs in again with the new password.
- `POST /account/set-password` (finishing an invite or account setup). The operator's answer:
  "Invite completion (POST /account/set-password) ends every session."

Devices that were signed out see the "password changed" notice on their next request (plan 20's
mapping). Both responses also clear the `jwt` cookie in the browser that sent the request, so that
browser lands signed out and signs in with the new password.

Deleting an account also clears the caller's cookie; plan 10's foreign key cascade already removes
its session rows.

Every path that sets a password uses the sign-up rule (`validatePassword` from
`@podverse/helpers-validation`: at least 8 characters, at least one that is not a lowercase
letter). The operator's answer: use the sign-up rule for change password "and also apply it to
reset and set-password so all four paths match". Sign-up already enforces it in
`AccountService.create`. This plan moves the check into `AccountService.resetPassword`, the one
ORM method that writes a new password for an existing account, so reset, set-password, and plan
23's change password all go through it. The web reset and set-password forms already check
`getPasswordErrorKey` (the same rule) before sending, so no client changes.

The signed-in change-password route, which keeps the caller's session, is plan 23.

## Rows

R30, R49, R55, R64

## Runs after

20

## Files

- packages/orm/src/services/account/account.ts
- apps/api/src/controllers/account/account.ts
- apps/api/openapi.yml
- apps/api/src/test/account.test.ts
- apps/api/src/test/account-session-password.integration.test.ts

## Before you start

Plan 20 must be done. Confirm these exist before editing:

- `apps/api/src/lib/auth/accountSessionStore.ts` exports `endAccountSessions({ accountId, reason,
  exceptSessionIdText })` returning a count.
- `apps/api/src/lib/auth/index.ts` exports `clearAuthCookie(res)`.
- `apps/api/src/test/helpers/accountSessionStoreStub.ts` exports `accountSessionStoreStub`, whose
  `endAccountSessions` is a `vi.fn`.
- `startTestApp` accepts `{ accountSessions: 'real' }`.

If any is missing, stop and report; do not write a replacement.

## Changes

### ORM password rule (`packages/orm/src/services/account/account.ts`)

The file already imports `validatePassword` from `@podverse/helpers-validation` for `create`.
Change `async resetPassword(accountId: number, newPassword: string): Promise<void>` to:

```typescript
/**
 * Sets a new password when it meets the sign-up password rule. Pending reset-password links for
 * the account stop working. An invalid password writes nothing.
 */
async resetPassword(
  accountId: number,
  newPassword: string
): Promise<'changed' | 'invalid_new_password'> {
  if (!validatePassword(newPassword)) {
    return 'invalid_new_password';
  }
  // ...the existing body unchanged: find the account (throw when missing), hash, update
  // credentials, delete the reset rows...
  return 'changed';
}
```

The rule check runs before the account lookup, so an invalid password never touches the
database. Grep for other callers of `.resetPassword(` across `apps/` and `packages/` before
editing; today the only callers are the two controller methods below. Stop and report if there
is another.

### Controller (`apps/api/src/controllers/account/account.ts`)

The rest of the edits are in this file.

### Imports

- Add `clearAuthCookie` to the existing import from `'@api/lib/auth//index.js'` (keep that
  specifier exactly as it is; alphabetical inside the braces: `clearAuthCookie`,
  `ensureAuthenticated`, `getAuthenticatedUser`, `optionalEnsureAuthenticated`).
- Add `import { endAccountSessions } from '@api/lib/auth/accountSessionStore.js';` directly after
  that import.
- No new `@podverse/helpers` import: pass the literal `'password_changed'`; the
  `AccountSessionRevokeReason` parameter type checks it.

### `static async resetPassword`

In `bodySchema`, change `password: Joi.string().min(8).required()` to
`password: Joi.string().required()`. The ORM rule decides validity, so the two cannot disagree.

Replace `await AccountController.accountService.resetPassword(...)` with:

```typescript
const result = await AccountController.accountService.resetPassword(
  accountResetPassword.account.id,
  password
);
if (result === 'invalid_new_password') {
  res.status(400).json({ message: 'Password does not meet the requirements' });
  return;
}
```

An invalid password leaves the reset link usable, so the user can try again from the same email.

Then, between that check and `res.json({ message: 'Password reset successfully' })`, add:

```typescript
await endAccountSessions({
  accountId: accountResetPassword.account.id,
  reason: 'password_changed',
  exceptSessionIdText: null,
});
clearAuthCookie(res);
```

Errors propagate to the existing `catch` (`handleGenericErrorResponse`). Do not catch them here: a
reset that changed the password but did not end the sessions must not report success.

The invalid-token branch (`400 Invalid or expired reset password token`) returns before the reset
and must not end sessions or clear the cookie.

### `static async setPassword`

Replace `await AccountController.accountService.resetPassword(account.id, password);` with the
same `result` check as `resetPassword` (400 `{ message: 'Password does not meet the
requirements' }` and return). It runs before the email update, `verifyEmail`, and the
set-password row deletion, so an invalid password changes nothing and the invite link stays
usable.

Between `await AccountController.accountSetPasswordService.deleteByAccountId(account.id);` and
`res.json({ message: 'Password set successfully' });`, add the same two session statements with
`accountId: account.id`. Every early `400` return above it (missing token or password, invalid
token, expired token, missing account, missing email, invalid password) stays as it is and must
not end sessions.

### `static async delete`

Between `await AccountController.accountService.delete(account_id);` and
`res.json({ message: 'Account deleted successfully' });`, add `clearAuthCookie(res);`. No session
call: the `account_session.account_id` foreign key is `ON DELETE CASCADE`.

## OpenAPI (`apps/api/openapi.yml`)

Find each operation by `operationId`, not by line.

- `apiPostAccountResetPassword` (`/account/reset-password`): extend `description` with: "On
  success every session of the account ends; signed-in devices are told the password changed. The
  response clears the `jwt` cookie."
- `apiPostAccountSetPassword` (`/account/set-password`): the same sentence.
- Both operations: the `password` property's description becomes "At least 8 characters, with at
  least one character that is not a lowercase letter." with `minLength: 8`, and the `400`
  response gains an example `invalidPassword` with
  `{ message: Password does not meet the requirements }`.
- `apiDeleteAccountDelete` (`/account/delete`): add to `description`: "Deleting the account ends
  all of its sessions. The response clears the `jwt` cookie." If the operation has no
  `description`, add one with that text.

## Tests

**`apps/api/src/test/account.test.ts`** (uses the stub store; `startTestApp()` default):

- Import `accountSessionStoreStub` from `./helpers/accountSessionStoreStub.js`.
- In `describe('POST /account/reset-password')`, add a `beforeEach` that calls
  `accountSessionStoreStub.endAccountSessions.mockClear()`.
  - The success case: also expect `accountSessionStoreStub.endAccountSessions` to have been called
    with `{ accountId: TEST_USER_ID, reason: 'password_changed', exceptSessionIdText: null }`, and
    expect a `set-cookie` header containing `jwt=;`.
  - The invalid-token case: expect it not to have been called.
  - Replace the short-password case: `resetPasswordMock.mockResolvedValueOnce('invalid_new_password')`
    with a token that resolves a reset row. Expect 400
    `{ message: 'Password does not meet the requirements' }`, no `set-cookie` header containing
    `jwt=`, and `endAccountSessions` not called.
- In `describe('POST /account/set-password')`, add the same `mockClear()` to its existing
  `beforeEach`.
  - Both success cases: the same two expectations.
  - The invalid-token and expired-token cases: expect it not to have been called.
  - New case: a valid set-password row and `resetPasswordMock.mockResolvedValueOnce('invalid_new_password')`.
    Expect 400 with the same message; `verifyEmailMock` and `setPasswordDeleteByAccountIdMock`
    not called; `endAccountSessions` not called.
- The hoisted `resetPasswordMock` default becomes `vi.fn(async () => 'changed' as const)`, and
  every existing `resetPasswordMock.mockResolvedValueOnce({})` becomes
  `mockResolvedValueOnce('changed')`.
- In `describe('DELETE /account/delete')`, the 200 case: expect a `set-cookie` header containing
  `jwt=;`.

**`apps/api/src/test/account-session-password.integration.test.ts`** (new; real store,
`startTestApp({ accountSessions: 'real' })`). Seed an account as
`account-session.integration.test.ts` does (`AccountService.create`, `getByEmail`, `verifyEmail`).
Cases:

- **Reset ends every session.** Two web logins (two cookies, each from a request with no cookie
  attached) and one mobile token pair. Create the reset row with `AccountResetPasswordService` the
  way `sendResetPasswordEmail` does (`update(account, { reset_token, reset_token_expires_at })`
  with a future date). Send `POST /account/reset-password` with the first cookie attached. It
  succeeds and its response clears the cookie. All three `account_session` rows have
  `revoked_reason = 'password_changed'`, including the session of the browser that sent the
  reset. Each old cookie on `/auth/me` gets 401
  `{ code: 'session_ended', notice: 'password_changed' }`. The old refresh token on
  `/auth/mobile/refresh` gets 401 with the same notice. A new login with the new password
  succeeds, and the old password is 401. Keep both login assertions in this case: together they
  are the check that the real password module ran (see "Real password checks" below).
- **Reset rejects a password that breaks the sign-up rule.** One web login. A reset row as above.
  `POST /account/reset-password` with `alllowercase` is 400 with
  `Password does not meet the requirements`. The session row is still active, the old password
  still logs in, and the same token then succeeds with a valid password (the link was not used
  up).
- **Invite completion ends every session.** One web login and one mobile token pair. Insert a
  set-password row with `new AccountSetPasswordService().update(account, { set_password_token,
  set_password_token_expires_at })` and a future expiry (read `AccountSetPasswordDto` for the
  exact field names). `POST /account/set-password` with `{ token, password }` succeeds and clears the cookie;
  both rows have `revoked_reason = 'password_changed'`; the old cookie on `/auth/me` gets the
  `password_changed` notice. A login with the new password succeeds.
- **Invite completion rejects a password that breaks the sign-up rule.** A set-password row as
  above. `POST /account/set-password` with `alllowercase` is 400 with the same message; the
  set-password row still exists, and the same token then succeeds with a valid password.
- **Deletion.** A web login, then `DELETE /account/delete` with that cookie; the response clears
  the cookie, and `SELECT count(*) FROM account_session WHERE account_id = $1` is 0.

### Real password checks

`auth.test.ts` replaces `../lib/auth/password.js` with a fake, and the API suite runs with
`isolate: false`, so a registration that outlives its file would make this file's login checks
meaningless. Plan 20 makes `startTestApp({ accountSessions: 'real' })` call
`vi.doUnmock('@api/lib/auth/password.js')` and makes `auth.test.ts` drop its own mock in
`afterAll`. Confirm both exist before writing this file; if either is missing, stop and report.
The reset case's pair (new password logs in, old password is 401) is what proves the real module
ran: a leaked fake returns the same answer for both, so one assertion fails. Never mock the
password module in this file.

## Release scratchpad

```markdown
## Password reset and invite completion end every session

- Surfaces: api
- Change: resetting a forgotten password (`POST /account/reset-password`) or completing an invite
  (`POST /account/set-password`) ends every session of the account on every device, including
  the browser that sent the request, and the response clears that browser's web cookie. Signed-out
  devices get the `password_changed` notice on their next request. Deleting an account clears the
  web cookie in the same response; its sessions are deleted with it. Reset and invite completion
  now apply the sign-up password rule (at least 8 characters, at least one that is not a
  lowercase letter) instead of an 8-character minimum; a password that breaks it is a 400
  `Password does not meet the requirements` and leaves the email link usable.
- Who notices: users who reset their password, or finish an invite, are signed out everywhere and
  sign in again with the new password. The web forms already applied the sign-up rule, so web
  users see no new rejection.
- Operator steps: none
```
