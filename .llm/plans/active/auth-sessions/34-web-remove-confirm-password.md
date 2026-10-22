**Cursor model:** Cursor Grok 4.7 · **Reasoning:** high

# 34 — Web sign-up, reset, and set-password keep one password field

Each of the three web password forms keeps its existing password field and drops the confirm
field, the mismatch check, and the catalog keys that exist only for that check. The request
body already sends one `password`. Nothing on the API accepts a second password.

Plan 43 removes the mobile call to `getPassword2ErrorKey` first. This plan then deletes that
function. The new change-password form is plan 35; do not add it here.

## Rows

R56, R57, R58

## Runs after

42, 43, 51, 66

Plan 42 is the last earlier edit of the consumer catalog originals (it follows 31, 32, and 41).
Plans 51 and 66 edit the management catalog originals and run `npm run i18n:compile`, which
rewrites every layer's overrides. This plan runs that compile too, so it starts only after those
edits are in the tree. Plan 43 has already stopped calling `getPassword2ErrorKey`.

## Files

- apps/web/src/components/Auth/AuthSignUpForm.tsx
- apps/web/src/components/Auth/AuthResetPasswordForm.tsx
- apps/web/src/app/set-password/SetPasswordPageClient.tsx
- apps/web/e2e/sign-up-legal-consent.spec.ts
- apps/web/e2e/set-password-invite-session.spec.ts
- packages/helpers-validation/src/client.ts
- packages/helpers-validation/src/password.ts
- packages/helpers-validation/src/signUpValidation.ts
- packages/i18n-catalog/consumer/originals/en-US.json
- packages/i18n-catalog/consumer/originals/es.json
- packages/i18n-catalog/consumer/originals/fr.json
- packages/i18n-catalog/consumer/originals/el-GR.json

## Before you start

Plan 43 is done: `apps/mobile/src/screens/auth/SignUpScreen.tsx` does not import
`getPassword2ErrorKey`. If it still does, stop and report.

Do not edit the management catalogs, `EditUserPageClient.tsx`, or
`RedeemAdminInviteLinkPageClient.tsx` (plan 52). Do not add a change-password screen (plan 35).

## Decisions (transcribe, do not revisit)

- Each form keeps the password field it already submits. On all three, that input stays
  `name="password1"`, `type="password"`, eyebrow `tAuthentication('password')`, placeholder
  `tAuthentication('password_hint')`. Do not rename it, and do not add a show-password control.
  `@podverse/ui` `TextInput` has no such control; `type="password"` stays hidden.
- The confirm input (`name="password2"`, eyebrow `authentication.confirm_password`) is removed,
  along with its state, touched flag, error state, change handler, and blur handler.
- A blur or change of the remaining password field no longer reads a second value.
- Submit stays disabled until the remaining checks pass. Sign-up still requires a valid email,
  a valid password, and the terms checkbox. Reset and set-password still require a token and a
  valid password. Set-password still shows its email field; that field is not a confirm field.
- The request body is unchanged: sign-up sends `password: password1` through `reqAccountCreate`;
  reset sends `{ token, password: password1 }` through `reqAccountResetPassword`; set-password
  sends `{ token, password: password1, ...(email ? { email } : {}) }` to `POST /account/set-password`.
- There is no API or OpenAPI confirmation field to delete. Do not add one, and do not send a
  second password "for compatibility".
- `getPassword2ErrorKey` is deleted from both validation modules. `validateSignUpFields` keeps
  email and password checks and drops its third argument. It has no callers today.
- Catalog keys `authentication.confirm_password` and `authentication.password_mismatch` are
  removed from every consumer original. Grep shows no other reader once these forms and
  `getPassword2ErrorKey` are gone. Do not remove `authentication.password`,
  `authentication.password_hint`, `authentication.invalid_password`, or
  `authentication.password_requirements`.

## Forms

In each of the three components, delete every `password2` / `password2ErrorKey` /
`password2Touched` binding and the second `TextInput`. Drop `getPassword2ErrorKey` from the
`@podverse/helpers-validation/client` import. Keep `getPasswordErrorKey` and
`getPasswordRequirementsInfoKey`.

`isFormValid` becomes:

- `AuthSignUpForm`: `!getEmailErrorKey(email) && !getPasswordErrorKey(password1) && !!email && !!password1 && termsAgreed`
- `AuthResetPasswordForm` and `SetPasswordPageClient`: `!!token && !getPasswordErrorKey(password1) && !!password1`

`handlePassword1Blur` only sets `password1ErrorKey` from `getPasswordErrorKey` when the field
was touched and is non-empty. `onPassword1Change` only updates `password1`, its touched flag,
and clears `password1ErrorKey` when the new value is empty or valid. Delete `handlePassword2Blur`
and `onPassword2Change`.

## Validation helpers

Delete `getPassword2ErrorKey` from `packages/helpers-validation/src/client.ts` and from
`packages/helpers-validation/src/password.ts`. Leave `getPasswordErrorKey`, `validatePassword`,
and `getPasswordRequirementsInfoKey`.

Replace `packages/helpers-validation/src/signUpValidation.ts` with:

```typescript
import { getEmailErrorKey } from './email.js';
import { getPasswordErrorKey } from './password.js';

export type SignUpValidationResult = {
  emailErrorKey?: string;
  password1ErrorKey?: string;
  isValid: boolean;
};

export function validateSignUpFields(email: string, password1: string): SignUpValidationResult {
  const emailErrorKey = getEmailErrorKey(email);
  const password1ErrorKey = getPasswordErrorKey(password1);
  const isValid = !emailErrorKey && !password1ErrorKey && !!email && !!password1;
  return {
    ...(emailErrorKey !== undefined ? { emailErrorKey } : {}),
    ...(password1ErrorKey !== undefined ? { password1ErrorKey } : {}),
    isValid,
  };
}
```

`packages/helpers-validation/src/index.ts` already re-exports that module. Do not add a wrapper
file. No unit test covers these functions; do not add one that only asserts the deletion.

## Catalog

In each `packages/i18n-catalog/consumer/originals/<locale>.json`, inside `authentication`, delete
the `confirm_password` entry and the `password_mismatch` entry. Search the key and edit that
window (**large-file-reading**). Do not rewrite the file. Plans 31, 32, 41, and 42 may have
added other keys nearby; leave those.

Locales: `en-US`, `es`, `fr`, `el-GR`.

Do not edit `overrides/` or any `compiled/` file by hand. Run `npm run i18n:compile` from the
repo root. That rewrites override structure, including dropping these two keys from the
non-English consumer overrides, and regenerates compiled JSON. Compiled JSON is gitignored.

## Tests

`apps/web/e2e/sign-up-legal-consent.spec.ts` fills `input[name="password2"]` in all three tests.
Delete those fills and the `confirmPasswordInput` local. Keep every `input[name="password1"]`
fill. The disabled-submit test still fills email and password, leaves terms unchecked, and
expects Submit disabled.

`apps/web/e2e/set-password-invite-session.spec.ts` asserts a textbox named `Confirm Password`
(exact) in three steps. Delete those three assertions. Keep the textbox named `Password`
(exact) and the rest of each step.

No web spec fills a confirm field on Reset Password. Do not add one.

## Release scratchpad

```markdown
## Sign-up, reset, and set-password use one password field

- Surfaces: web
- Change: Sign Up, Reset Password, and Set Password each keep a single password field. The
  confirm field and the mismatch check are gone. The request still sends one password.
- Who notices: people creating an account, resetting a password, or finishing an invite on the website
- Operator steps: none
```
