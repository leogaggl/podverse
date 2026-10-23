**Cursor model:** Cursor Grok 4.7 · **Reasoning:** extra high

# 23 — Signed-in change password ends every other session

A signed-in user changes their own password with `POST /account/change-password`, sending the
current password and the new one. The route checks the current password, sets the new one, ends
every other session of the account with reason `password_changed`, and keeps the session that made
the request. The operator's answer: "changing your own password ends every other session, and the
browser or device that made the change stays signed in."

The caller stays signed in whether it is a web browser (session cookie) or the mobile app
(bearer access token and refresh token): the route ends sessions by session id, so the caller's
cookie, access token, and refresh token all keep working, and nothing is re-issued.

There is no confirm-password field (operator answer: "one current-password field and one
new-password field"). Web and mobile forms are plan 35 and plan 44; they use the contract below.

## Rows

R30, R47, R51, R64

## Runs after

22

## Contract for the forms (plans 35 and 44)

- **Helper:** `reqAccountChangePassword({ current_password, new_password })` on
  `ApiRequestService` (`@podverse/helpers-requests`). It sends credentials, so a web cookie or a
  mobile bearer both work. It resolves to `{ message: 'Password changed', revoked_count: number }`
  and throws the usual request error on any non-2xx status.
- **Request body:** `{ "current_password": string, "new_password": string }`. Both required.
- **200:** `{ "message": "Password changed", "revoked_count": 2 }`. `revoked_count` is how many
  other sessions ended; `0` is a success. The caller's session is untouched and no cookie is set or
  cleared.
- **400 with a code** (read it with `getErrorResponseBodyCode(error)` from
  `@podverse/helpers/error`, compared against `ACCOUNT_CHANGE_PASSWORD_ERROR_CODES` from the same
  subpath):
  - `current_password_incorrect` — "Current password is incorrect". Nothing changed.
  - `invalid_new_password` — "New password does not meet the requirements". Same rule as sign-up:
    `validatePassword` / `getPasswordErrorKey` from `@podverse/helpers-validation` (at least 8
    characters, at least one character that is not a lowercase letter). Forms check it before
    sending with `getPasswordErrorKey` and its existing `invalid_password` catalog key. Nothing
    changed.
- **400 without a code:** a missing or empty field (Joi validation message).
- **401:** not signed in, or the caller's session has ended (plan 20's body, with `code:
  session_ended` and a `notice` when one applies). A wrong current password is never a 401, because
  web (plan 33) and mobile (plan 40) treat a 401 as a signed-out or refresh case.
- **429:** the per-account rate limit (four requests per 10 minutes by default), with the shared
  rate-limit body; forms show it through the shared rate-limit message helper
  (**rate-limit-message**).
- It works with a lapsed membership or unaccepted terms.

## Files

- packages/helpers/src/lib/error/errorMessages.ts
- packages/helpers-requests/src/api/account/account.ts
- packages/helpers-requests/src/api/_request.ts
- apps/api/src/controllers/account/account.ts
- apps/api/src/routes/account.ts
- apps/api/src/config/index.ts
- apps/api/src/lib/startup/validation.ts
- apps/api/.env.example
- apps/api/ENV.md
- infra/k8s/base/api/source/api.env
- apps/api/openapi.yml
- apps/api/src/test/account.test.ts
- apps/api/src/test/account-change-password.integration.test.ts

## Before you start

Plans 20, 21, and 22 must be done. Confirm:

- `apps/api/src/lib/auth/accountSessionStore.ts` exports `endAccountSessions({ accountId, reason,
  exceptSessionIdText })` returning the number of sessions ended.
- `Express.User` in `apps/api/src/@types/express.d.ts` has `session_id_text: string`.
- `apps/api/src/controllers/account/account.ts` already imports `endAccountSessions` (plan 21).
- `AccountService.resetPassword` in `packages/orm/src/services/account/account.ts` returns
  `Promise<'changed' | 'invalid_new_password'>` and applies `validatePassword` (plan 21).
- `startTestApp({ accountSessions: 'real' })` calls `vi.doUnmock('@api/lib/auth/password.js')`,
  and `auth.test.ts` drops its password-module mock in `afterAll` (plan 20).
- `apps/api/src/test/helpers/accountSessionStoreStub.ts` exports `accountSessionStoreStub`, and
  `apps/api/src/test/helpers/testAccountIds.ts` exports `TEST_ACCOUNT_SESSION_ID_TEXT`.
- `startTestApp` accepts `{ accountSessions: 'real' }`.

If any is missing, stop and report; do not write a replacement. Re-check the other listed paths
and anchors too; other work is landing in the tree.

## Changes

### Error codes (`packages/helpers/src/lib/error/errorMessages.ts`)

Directly after the `AccountCreateResponseCode` type:

```typescript
export const ACCOUNT_CHANGE_PASSWORD_ERROR_CODES = {
  CURRENT_PASSWORD_INCORRECT: 'current_password_incorrect',
  INVALID_NEW_PASSWORD: 'invalid_new_password',
} as const;

export type AccountChangePasswordErrorCode =
  (typeof ACCOUNT_CHANGE_PASSWORD_ERROR_CODES)[keyof typeof ACCOUNT_CHANGE_PASSWORD_ERROR_CODES];
```

`lib/error/index.ts` already re-exports the file, so the barrel and the `@podverse/helpers/error`
subpath (which mobile uses) both carry it. No `package.json` change.

### ORM

No ORM change. Plan 21 made `AccountService.resetPassword` apply the sign-up rule and return
`'changed' | 'invalid_new_password'`; every password-setting route, this one included, goes
through it. It also deletes pending reset-password rows, which is why a change voids any
reset email link.

### Controller (`apps/api/src/controllers/account/account.ts`)

Imports:

- `import { verifyPassword } from '@api/lib/auth/password.js';` directly after the
  `'@api/lib/auth/accountSessionStore.js'` import plan 21 added.
- Add `ACCOUNT_CHANGE_PASSWORD_ERROR_CODES` to the existing `@podverse/helpers` value import,
  alphabetically (before `ACCOUNT_RESPONSE_CODES`).

Add `static async changePassword` directly before `static async resetPassword`:

```typescript
static async changePassword(req: Request, res: Response): Promise<void> {
  ensureAuthenticated(
    req,
    res,
    async () => {
      const bodySchema = Joi.object({
        current_password: Joi.string().required(),
        new_password: Joi.string().required(),
      });

      validateBodyObject(bodySchema, req, res, async () => {
        try {
          const jwtUser = getAuthenticatedUser(req);
          const { current_password, new_password } = req.body;

          const account = await AccountController.accountService.get(jwtUser.id, {
            relations: accountCredentialsRelations,
          });
          const passwordHash = account?.account_credentials?.password;
          const currentPasswordMatches =
            passwordHash !== undefined &&
            passwordHash !== '' &&
            (await verifyPassword(current_password, passwordHash));
          if (!currentPasswordMatches) {
            res.status(400).json({
              message: 'Current password is incorrect',
              code: ACCOUNT_CHANGE_PASSWORD_ERROR_CODES.CURRENT_PASSWORD_INCORRECT,
            });
            return;
          }

          const result = await AccountController.accountService.resetPassword(
            jwtUser.id,
            new_password
          );
          if (result === 'invalid_new_password') {
            res.status(400).json({
              message: 'New password does not meet the requirements',
              code: ACCOUNT_CHANGE_PASSWORD_ERROR_CODES.INVALID_NEW_PASSWORD,
            });
            return;
          }

          const revokedCount = await endAccountSessions({
            accountId: jwtUser.id,
            reason: 'password_changed',
            exceptSessionIdText: jwtUser.session_id_text,
          });

          res.json({ message: 'Password changed', revoked_count: revokedCount });
        } catch (error) {
          handleGenericErrorResponse(res, error);
        }
      });
    },
    { skipMembershipStatus: true, skipTermsAcceptance: true }
  );
}
```

Rules this code holds; keep them if you reshape it:

- The current password is checked before the new one, and neither failure writes anything or ends
  any session.
- `endAccountSessions` is not caught. A password that changed while the other sessions stayed alive
  must not report success; the error reaches `handleGenericErrorResponse`.
- The caller's session is excluded by `jwtUser.session_id_text`, which is the same id for a web
  cookie and a mobile access token. Do not call `clearAuthCookie`, `setAuthCookie`, or anything that
  re-issues tokens.
- No new password equal to the current one check: it is accepted and still ends the other sessions.

### Route (`apps/api/src/routes/account.ts`)

`rateLimitAuthEndpoint` is already imported. Directly after the `requireEmailFlows` function and
before `const router = Router();`, add an exported limiter (exported so tests can reset it, as
`strikeCheckoutPollRateLimit` in `routes/billing.ts` is):

```typescript
export const accountChangePasswordRateLimit = rateLimitAuthEndpoint({
  ...config.rateLimits.accountChangePassword,
  skipTermsAcceptance: true,
});
```

Directly before the `'/send-reset-password-email'` route:

```typescript
router.post(
  '/change-password',
  accountChangePasswordRateLimit,
  asyncHandler(AccountController.changePassword)
);
```

No `requireEmailFlows`: changing a password while signed in works in every signup mode. The route
sits above the catch-all `GET /:id_text`, and it is a POST, so the two never collide.

### Rate-limit config

Follow `accountSetPassword` / `ACCOUNT_SET_PASSWORD_MAX_PER_10_MINUTES` in each file, and put the
new key directly after it (**startup-validation-env-order**, **env-defaults-match-code**,
**env-file-formatting**):

- `apps/api/src/config/index.ts`: `accountChangePassword: { windowMs: number; max: number };` in
  the `rateLimits` type after `accountSetPassword`, and the value
  `parseCountPerWindowEnvFromKey({ envValue: process.env.ACCOUNT_CHANGE_PASSWORD_MAX_PER_10_MINUTES,
  key: 'ACCOUNT_CHANGE_PASSWORD_MAX_PER_10_MINUTES', defaultMax: 4 })` after `accountSetPassword`'s.
- `apps/api/src/lib/startup/validation.ts`:
  `validateOptional('ACCOUNT_CHANGE_PASSWORD_MAX_PER_10_MINUTES', 'Account', 'Use Default (4)')`.
- `apps/api/.env.example`: `ACCOUNT_CHANGE_PASSWORD_MAX_PER_10_MINUTES="4"`.
- `infra/k8s/base/api/source/api.env`: `ACCOUNT_CHANGE_PASSWORD_MAX_PER_10_MINUTES=4`.
- `apps/api/ENV.md`: `- **`ACCOUNT_CHANGE_PASSWORD_MAX_PER_10_MINUTES`** (default `4`)` after the
  set-password line.

`tools/web-perf/lighthouse/.env.api*` and `packages/helpers-config/src/podverseTestEnv.ts` do not
list the sibling password limits; leave them alone.

### Request helper (`packages/helpers-requests/src/api/account/account.ts`)

Directly after `reqAccountResetPassword`:

```typescript
export async function reqAccountChangePassword(
  api: ApiRequestService,
  params: { current_password: string; new_password: string }
): Promise<{ message: string; revoked_count: number }> {
  return api.apiRequest<{ message: string; revoked_count: number }>({
    path: '/account/change-password',
    method: 'POST',
    data: params,
    config: { withCredentials: true },
  });
}
```

In `packages/helpers-requests/src/api/_request.ts`, add `reqAccountChangePassword` to the
`'./account/account.js'` value import (alphabetically, after `reqAccountChangeEmailAddress`), and
add the method directly after `reqAccountResetPassword(params: …) { … }`:

```typescript
  reqAccountChangePassword(params: { current_password: string; new_password: string }) {
    return reqAccountChangePassword(this, params);
  }
```

## OpenAPI (`apps/api/openapi.yml`)

Find spots by name, not by line.

**Schemas**, directly after `ApiPostAccountResetPasswordResponse200`:

- `ApiPostAccountChangePasswordRequest`: object, required `current_password` and `new_password`,
  both `type: string`, `format: password`. `current_password` description "The account's current
  password". `new_password` description "The new password. At least 8 characters, with at least
  one character that is not a lowercase letter.", `minLength: 8`.
- `ApiPostAccountChangePasswordResponse200`: object, required `message` and `revoked_count`.
  `message` string, example `Password changed`. `revoked_count` integer, minimum 0, description
  "Other sessions of the account that were ended."
- `ApiPostAccountChangePasswordResponse400`: object, required `message`. `message` string. `code`
  string, enum `current_password_incorrect`, `invalid_new_password`; description "Present when the
  current password is wrong or the new password does not meet the rule. Absent for a missing
  field."

**Path**, directly before `/account/reset-password:`:

- `/account/change-password` `post`, `operationId: apiPostAccountChangePassword`, `tags:
  [account]`, summary `POST /account/change-password`, `security` in the list form
  `/account/send-change-email-address-email` uses (`bearerAuth`, `cookieAuth`).
- Description: "Changes the signed-in account's password. The current password must match. Every
  other session of the account ends, and those devices are told the password changed. The session
  that sent the request stays signed in, whether it uses the web cookie or a mobile access token.
  Works with a lapsed membership or unaccepted terms."
- `requestBody` required, `ApiPostAccountChangePasswordRequest`, with an example
  `{ current_password: "Old-password1", new_password: "New-password2" }`.
- Responses: `200` → `ApiPostAccountChangePasswordResponse200` with example
  `{ message: Password changed, revoked_count: 2 }`; `400` → `ApiPostAccountChangePasswordResponse400`
  with two examples (`currentPasswordIncorrect`, `invalidNewPassword`); `401` →
  `AuthenticationErrorResponse`; `429` "Too many requests" → `ErrorResponse` (the form the billing
  paths use; grep `"429":`); `500` → `InternalServerErrorResponse`.

## Tests

**`apps/api/src/test/account.test.ts`** (stub store, `startTestApp()` default). The file mocks
`AccountService` from `@podverse/orm`; `getMock` serves both the auth lookup and the controller's
credentials lookup.

- Use the file's existing `resetPasswordMock`, whose default plan 21 set to
  `vi.fn(async () => 'changed' as const)`. No new ORM mock.
- Import `bcrypt` from `'bcrypt'`, `accountSessionStoreStub` (plan 21 already imports it),
  `TEST_ACCOUNT_SESSION_ID_TEXT`, and `accountChangePasswordRateLimit` from
  `'../routes/account.js'`.
- `describe('POST /account/change-password')`:
  - `beforeAll`: `currentHash = await bcrypt.hash('Current-pass1', 4)`.
  - `beforeEach`: `accountChangePasswordRateLimit.resetForUser(TEST_USER_ID)`,
    `resetPasswordMock.mockClear()`, `accountSessionStoreStub.endAccountSessions.mockClear()`,
    and `getMock.mockResolvedValue(…)` with the file's default account plus
    `account_credentials: { email: TEST_EMAIL, password: currentHash }`.
  - `afterEach`: restore `getMock` to the file's default resolved value so later describes are
    unchanged.
  - Success with `authHeaders(TEST_USER_ID)`: 200, body `{ message: 'Password changed',
    revoked_count: 0 }`; `resetPasswordMock` called with `(TEST_USER_ID, 'New-pass2')`;
    `endAccountSessions` called with `{ accountId: TEST_USER_ID, reason: 'password_changed',
    exceptSessionIdText: TEST_ACCOUNT_SESSION_ID_TEXT }`; no `set-cookie` header contains `jwt=`.
  - Wrong current password: 400, `code: 'current_password_incorrect'`; neither mock called.
  - `resetPasswordMock` resolves `'invalid_new_password'` once: 400,
    `code: 'invalid_new_password'`; `endAccountSessions` not called.
  - Missing `new_password`, and an empty `current_password`: 400 with no `code`; neither mock
    called.
  - No auth headers: 401.

**`apps/api/src/test/account-change-password.integration.test.ts`** (new; real store,
`startTestApp({ accountSessions: 'real' })`). Seed one account per case as
`account-session.integration.test.ts` does (`AccountService.create` with password
`Original-pass1`, `getByEmail`, `verifyEmail`), so each case has its own rate-limit budget. Web
logins go through `POST /auth/login` with no cookie attached (a login with a cookie attached ends
that cookie's session, plan 20). The mobile pair comes from `POST /auth/mobile/token`
(`{ email, password, device_label: 'Test Phone' }`). Read rows with SQL through
`ormContext.dataSourceReadWrite`.

- **Web caller stays signed in.** Web logins A and B (different `User-Agent`) and mobile pair M.
  Change the password with cookie A. 200 with `revoked_count: 2`, and no `set-cookie` clearing
  `jwt`. A on `/auth/me` is 200. B on `/auth/me`, and M's access token on `/auth/me`, are 401
  `{ code: 'session_ended', notice: 'password_changed' }`. M's refresh token on
  `/auth/mobile/refresh` is 401 with the same notice. A's row has `revoked_at` null; B's and M's
  rows have `revoked_reason = 'password_changed'`. Login with `Original-pass1` is 401; login with
  the new password is 200.
- **Mobile caller stays signed in.** Web login W and mobile pair M. Change the password with M's
  access token as a bearer. 200 with `revoked_count: 1`. M's access token on `/auth/me` is 200. M's
  refresh token on `/auth/mobile/refresh` is 200, and the new access token works. W on `/auth/me`
  is 401 with the `password_changed` notice.
- **Wrong current password.** Web logins A and B. Change with A using a wrong current password: 400
  `code: 'current_password_incorrect'`. Both rows still active; B on `/auth/me` is 200; login with
  `Original-pass1` still works.
- **New password breaks the rule.** Web logins A and B. Change with A to `alllowercase`: 400
  `code: 'invalid_new_password'`. Both rows still active; login with `Original-pass1` still works.
- **Not signed in.** No cookie or bearer: 401.

**Real password checks.** Both files check the current password with real bcrypt through
`verifyPassword`; neither mocks `../lib/auth/password.js`. `auth.test.ts` does mock it, and the
suite runs with `isolate: false`, so plan 20 makes `auth.test.ts` drop that mock in `afterAll`
and makes `startTestApp({ accountSessions: 'real' })` unmock it. What proves the real module ran
is each file's pair of cases in the same file: the correct current password succeeds, and a wrong
one is 400 `current_password_incorrect`. A leaked fake returns the same answer for both, so one
of the pair fails. Keep both cases in each file; do not split them into separate files.

## Release scratchpad

```markdown
## Change password while signed in

- Surfaces: api, helpers, helpers-requests, k8s base env
- Change: new signed-in `POST /account/change-password` with `current_password` and
  `new_password`. It checks the current password, applies the sign-up password rule to the new
  one, ends every other session of the account (those devices get the `password_changed` notice),
  and keeps the session that sent it, on web and mobile. Returns `{ message, revoked_count }`.
  Failures are 400 with `code` `current_password_incorrect` or `invalid_new_password`. A change
  also voids any pending reset-password email link. Works with a lapsed membership or unaccepted
  terms. Rate limited per account by `ACCOUNT_CHANGE_PASSWORD_MAX_PER_10_MINUTES` (default 4).
  New request helper `reqAccountChangePassword` and `ACCOUNT_CHANGE_PASSWORD_ERROR_CODES` in
  `@podverse/helpers`.
- Who notices: users who change their password from Settings stay signed in where they are and
  are signed out everywhere else; web and mobile clients that build the form.
- Operator steps: optional `ACCOUNT_CHANGE_PASSWORD_MAX_PER_10_MINUTES` on the API (default 4).
```
