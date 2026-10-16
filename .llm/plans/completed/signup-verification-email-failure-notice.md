# Deferred: Tell the user when the verification email was not sent

Saved for later. No code has been changed for this work.

## Problem

`POST /api/v2/account` creates the account, then calls `sendVerificationEmail`. That helper
catches every SMTP error, logs it with `console.error`, and returns normally. The controller then
responds `{ message: 'Account created' }`, and web and mobile both show "Account created
successfully. Please check your email for a verification link."

When the mailer is broken (seen on alpha: Brevo `535 5.7.8 Authentication failed`), the user waits
for an email that never comes. Signing up again does not help, because the duplicate-email path
returns the same success message without sending anything. The user cannot verify, so login fails
with "Account not verified" and nothing tells them why.

The resend endpoint (`POST /account/send-verification-email`) has the same problem. It responds
"Verification email sent" after a failed send.

## Goal

When the account was created but the verification email failed to send, show a dismissible
pop-up saying so, and tell the user to contact support to get verified. Keep it short and give no
mailer internals (no provider name, SMTP code, or error text).

## Copy

Catalog: `packages/i18n-catalog/consumer/originals/*.json`, under `authentication`. Write all four
locales in `originals/` (`en-US`, `es`, `fr`, `el-GR`). Do not edit `overrides/`. The title is in
title case and the body in sentence case (**ui-copy-casing**).

| Key | en-US |
| --- | --- |
| `verification_email_not_sent_title` | Verification Email Not Sent |
| `verification_email_not_sent_body` | Your account was created, but our email service isn't working right now. Contact {email} to verify your account. |
| `verification_email_not_sent_body_no_contact` | Your account was created, but our email service isn't working right now. Contact support to verify your account. |

`{email}` is the configured contact address (web `NEXT_PUBLIC_CONTACT_EMAIL`, mobile
`getMobileConfig().contactEmail`). Use the `_no_contact` body when that value is empty.

The resend flow reuses the same title and body. "Your account was created" is still true there.

## API contract

Keep HTTP **200** for a created account. A 5xx would read as "signup failed" in clients and
retries, and a retry would hit the duplicate-email path and get no email anyway. Add a stable
machine code to the body:

```json
{ "message": "Account created", "code": "verification_email_not_sent" }
```

On success the body stays `{ "message": "Account created" }` (no `code`), so older clients keep
working.

Resend endpoint: when the send fails, respond **503**
`{ "message": "Verification email not sent", "code": "verification_email_not_sent" }`. The account
exists either way, and the client shows the same pop-up.

Put the code in `@podverse/helpers` next to the other account error strings (`ERROR_MESSAGES`
or a small `ACCOUNT_RESPONSE_CODES` object). Do not let web and mobile each hardcode the literal.

Update `apps/api/openapi.yml` for both responses.

## API changes

1. `apps/api/src/lib/mailer/sendVerificationEmail.ts`: return a result instead of `void`, for
   example `'sent' | 'skipped' | 'failed'`.
   - `config.mailer.disabled` or no host returns `skipped`. That is the intended local and
     `admin_only_username` behavior, and it must not trigger the pop-up.
   - Transporter creation failure or `sendMail` rejection returns `failed`.
   - Replace `console.error` with `loggerService.logError`. Log the error code and response code;
     never log credentials. Do not put `err.message` in the HTTP response.
2. `AccountController.sendVerificationEmailHelper` returns that result.
3. `AccountController.create` adds `code: 'verification_email_not_sent'` when the result is
   `failed`.
4. `AccountController.sendVerificationEmail` (resend) responds 503 with the code on `failed`.
5. Apply the same result type to `sendChangeEmailVerificationEmail.ts`, which swallows errors the
   same way. Its pop-up wording is a follow-up. In this plan only the return type changes, so that
   endpoint can respond honestly later.
6. `sendResetPasswordEmail.ts` already throws on failure (generic 500). Leave it alone.

### Duplicate signup

A second signup for an email that already has a row must look like the first signup. Do not
tell the client the email exists. A username-unavailable message is a separate case. This
endpoint is email signup.

`AccountService.create` already throws `ERROR_MESSAGES.ACCOUNT.ALREADY_EXISTS` before it
writes a new password. Keep that. Do not update the stored password. Do not sign the caller
in, and do not issue a token.

When the existing account is not verified, send another verification email, the same helper
a first signup uses. The response matches a first signup: `{ "message": "Account created" }`
when the send succeeds or is skipped, and the same `verification_email_not_sent` code when
the send fails.

When the existing account is already verified, do not send, do not change `verified`, and do
not change the password. Return the same JSON a first signup returns for the same mailer
state, including the failure code when the mailer is failing. That keeps a down mailer from
revealing that the address is registered. The notice is the same one a new signup shows.

Login is unchanged by this response. The person signs in with the password already stored.
The password typed into the second signup form is discarded. An unverified account with the
right password gets the login plan's "verify your email" notice and resend control. A wrong
password stays a normal failed login. Nothing in this response grants a session.

## Mobile

Sign-up already replaces the form on success (`accountCreated` in `SignUpScreen.tsx`): title
`authentication.account_created_title`, body `authentication.account_created_body`, and a
Login button. Do not look for `account_created_message`. That key is the older inline sentence.

The auth sheet is a React Native `Modal`. A `ConfirmDialog` opened from that sheet renders
under the modal (**mobile-overlays-in-tree**). Put the failure on the success screen.

- After `reqAccountCreate`, when `code` is `verification_email_not_sent`, still call
  `writeSignupMergeEmail(email)`. The response does not say whether the row is new. The
  marker only runs after a later login with the stored password.
- Do not show `account_created_body`. Show the not-sent title and body on that screen,
  testID `signup-verification-email-not-sent`.
- When the contact email is set, add a link that opens `mailto:${contactEmail}`. Reuse an
  existing Contact Support label if one exists. TestID `signup-verification-email-not-sent-contact`.
- Keep the Login button.
- VoiceOver and TalkBack read the message. The mailto control is a link.

`reqAccountCreate` in `packages/helpers-requests/src/api/account/account.ts` returns
`{ message: string }`. Widen the type to `{ message: string; code?: AccountCreateResponseCode }`
so neither client needs a type assertion.

This plan does not add a resend control. The login plan owns that screen.

## Web

- `apps/web/src/components/Auth/AuthSignUpForm.tsx`: same check after `reqAccountCreate`. Show a
  `Modal` with `Modal.Actions` (**modal-layout-contract**) containing the title, the body, and a
  `mailto:` link built the way `AuthContactOnlyMessage` builds one. Do not show the success info
  message when the code is present.
- `apps/web/src/components/Modal/ModalAuthLogin.tsx` `handleResendVerificationEmail`: on a 503
  with the code, show the same message instead of logging and doing nothing. The resend path
  currently has no failure UI at all.
- If the modal is used in both places, put it in one app-local component (for example
  `components/Auth/VerificationEmailNotSentModal.tsx`) per **reusable-components**.

## Test mail

API integration tests keep mocking `sendVerificationEmail`
(`apps/api/src/test/account.test.ts`). Those mocks resolve to a result value once the return
type changes. They do not open a socket.

Playwright uses a local Mailpit. SMTP is `localhost:1025`, which `podverseTestEnv.ts` already
sets as `MAILER_PORT`. The web UI and HTTP API use port `8025`. Start it from `e2e_deps` in
`makefiles/local/Makefile.local.e2e.mk`, not from `test_deps`, and not from API Vitest. Do not
point any test at Brevo or another remote mailer.

With Mailpit up, a normal signup send succeeds. `e2e/sign-up-legal-consent.spec.ts` keeps the
success screen and asserts the message arrived in Mailpit. The failure notice is a separate
step that routes `POST /api/v2/account` to the `verification_email_not_sent` body, so Mailpit
stays up for the rest of the run.

## Tests

- **API** (`apps/api/src/test/account.test.ts`): create returns 200 with
  `code: 'verification_email_not_sent'` when the mock resolves `failed`, and has no `code` when it
  resolves `sent` or `skipped`. Resend returns 503 with the code on `failed`. Cover the chosen
  duplicate-email behavior.
- **Unit** (`apps/api` mailer): `sendVerificationEmail` returns `failed` when `sendMail` rejects,
  and the logged error carries no password.
- **Web E2E**: `sign-up-legal-consent.spec.ts` asserts the success screen and that Mailpit
  received the message. A later step in that spec, or a sibling spec, routes
  `POST /api/v2/account` to the failure code and asserts the modal title, body, and contact
  link in a screenshot step.
- **Mobile**: a Maestro flow is optional. A unit test is enough if the response-to-dialog mapping
  is extracted into a small helper.

## Out of scope

- Fixing the alpha Brevo credentials. That is an operator secret rotation in `k.podcastdj.com`
  (`create_mailer_secret.sh alpha`, apply, restart the API).
- Alerting operators when the mailer fails (metrics or a health signal). Worth a separate plan.
- An in-app resend-verification screen on mobile.
- Change-email and reset-password pop-ups.

## Verification (operator, after implementation)

```bash
npm run build:packages
npm run lint
npm run test -w apps/api
make e2e_test_web_report_spec SPEC=e2e/sign-up-legal-consent.spec.ts
```
