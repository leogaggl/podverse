# Mobile login — unverified account and forgot password

Implemented. An unverified account with the right password gets the same notice as web, including
resend. Forgot Password starts in the app. The email links themselves stay on the website:
universal links only claim podcast, episode, playlist, clip, and profile paths, so a verification
or reset link opened from Mail still loads the site.

## Why the phone said the password was wrong

`POST /auth/login` (web) checks the password, then returns **403**
`{ message: 'Account not verified.' }` when the account is unverified.
`ModalAuthLogin` matches that string to `ERROR_MESSAGES.ACCOUNT.NOT_VERIFIED` and shows
`authentication.account_not_verified` plus **Resend Verification Email**.

`POST /auth/mobile/token` does not. `authenticateAccountCredentials` in
`apps/api/src/lib/auth/index.ts` returns null when `account.verified` is false, and it does that
**before** `verifyPassword`. `issueMobileToken` turns every null into **401** `Unauthorized`.
`loginWithMobileToken` maps 401 to `invalid_credentials`, and the login screen shows
`authentication.invalid_email_or_password`.

A correct password on an unverified account and a wrong password look the same on the phone.

A second signup for an existing email does not change the stored password and does not sign
anyone in. That behavior is locked in
`.llm/plans/completed/signup-verification-email-failure-notice.md`. This screen still requires
the stored password. The password typed into a later signup form is discarded.

## 1. Mobile token must match web login

In `authenticateAccountCredentials` (or only in `issueMobileToken`, if the helper stays shared):

1. Unknown identifier, missing credentials, or a password that does not match → **401**
   `Unauthorized`. Same as today.
2. Password matches and the account is unverified → **403**
   `{ message: 'Account not verified.' }` using `ERROR_MESSAGES.ACCOUNT.NOT_VERIFIED`.

Check the password before the verified flag. A 403 before the password check would tell a caller
that the address exists and is unverified.

Add an API test next to `POST /auth/mobile/*` in `apps/api/src/test/auth.test.ts`: correct password
and `verified: false` returns 403 with that message; wrong password stays 401.

## 2. Login screen shows the same notice as web

`apps/mobile/src/auth/loginWithMobileToken.ts`: a 403 whose body message is
`ERROR_MESSAGES.ACCOUNT.NOT_VERIFIED` becomes a new result, `account_not_verified`. Any other
non-401 error still throws. A 429 is a rate limit, not "Could not sign in" — use
`handleRateLimitMessage` (`apps/mobile/src/lib/rateLimit/handleRateLimitMessage.ts`) the way OPML
already does.

`LoginScreen` (`apps/mobile/src/screens/auth/LoginScreen.tsx`), when the result is
`account_not_verified`:

- Show `authentication.account_not_verified` ("Account not verified. Please check your email for a
  verification link.").
- Show a link labeled `authentication.resend_verification_email` ("Resend Verification Email").
- On press, call `reqAccountSendVerificationEmail` with the email from the form. On 200, replace
  the link with `authentication.verification_email_sent`.
- On 429, show the rate-limit message. On any other failure, show `errors.generic` (or the
  existing generic catalog key mobile already uses).

Those catalog keys already exist in `packages/i18n-catalog/consumer/originals/`. Reuse them. Do
not add new English copy for this screen.

The resend endpoint still answers "Verification email sent" when SMTP fails. That lie is owned by
`.llm/plans/completed/signup-verification-email-failure-notice.md`. If that plan has landed, honor
`code: verification_email_not_sent` here with the same dialog. If it has not, match today's web
resend: show the sent message and do not invent a second failure dialog.

Hide the notice again when the user edits the email or password, the same way web clears it at
the start of a new submit.

Test IDs: `login-account-not-verified`, `login-resend-verification`. The link needs
`accessibilityRole="link"` and the catalog string as its accessible name.

## 3. Forgot password, started in the app

The auth sheet in `apps/mobile/App.tsx` is a local mode, `'anonymous' | 'login' | 'signup'`.
`showAuthSheet` is true only for login and signup. Add `'forgot-password'` to that union **and**
to the `showAuthSheet` condition, or the sheet will close as soon as the mode changes.

New `ForgotPasswordScreen` beside `LoginScreen`:

- Email field, submit, and a way back to login (header back, same chrome as login).
- Submit calls `reqAccountSendResetPasswordEmail`. On 200, show
  `authentication.forgot_password_email_sent_message` and stop showing the form.
- 429 uses `handleRateLimitMessage`. Anything else uses the generic error. Web's unknown-email
  path is a 500 ("Account not found."); match that. Do not add a special "no such account"
  string.
- Login gets a link under the password field, `authentication.forgot_password` ("Forgot
  Password?"), test ID `login-forgot-password`. Show it whenever the app can reach an API that
  uses email flows. Alpha and production `user_signup_email` both can. There is no mobile
  equivalent of web's `getAccountSignupModeCapabilities` today; do not add a signup-mode config
  just to hide this link.

The reset message in the email opens `/reset-password?token=…` on the website. Do not build an
in-app reset screen. Say in the sent message's existing copy that the link finishes the reset;
do not rewrite that sentence unless it tells the user to stay inside the app.

Test IDs: `forgot-password-screen`, `forgot-password-email`, `forgot-password-submit`,
`forgot-password-sent`.

## Tests

- API: the 403 / 401 cases above.
- Mobile unit: map a 403 body of `Account not verified.` to `account_not_verified`, and a 401 to
  `invalid_credentials`. Keep the assertion on the helper, not a rendered screen, unless a screen
  test already exists for login.
- Maestro only if a login flow already covers this sheet. Do not add a new full-device flow for
  the copy change alone.

## Out of scope

- Sending the verification or reset email reliably (Brevo key, and the deferred mailer-failure
  notice plan).
- An in-app page for `/verify-email`, `/reset-password`, or `/set-password`. Those links open the
  website. `/set-password` is the admin-invite completion page, not a public signup step.
- Change email and profile editing. Those are
  `.llm/plans/completed/mobile-account-settings-web-parity.md`.

## Verification (operator, after implementation)

```bash
npm run build:packages
npm run test -w apps/api
npm --prefix apps/mobile run test
```
