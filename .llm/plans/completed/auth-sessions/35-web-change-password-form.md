**Cursor model:** Cursor Grok 4.7 · **Reasoning:** extra high

# 35 — Web Change Password form in Settings

Settings → Account gains a **Change Password** section whose button opens a modal, the same way
Change Email does. The modal has one current-password field, one new-password field, no confirm
field, and no show-password control. Submit calls plan 23's `reqAccountChangePassword`. On
success the modal closes and the browser stays signed in. Catalog keys go in the consumer layer,
the same layer as plan 32's `settings.account.sessions`.

The mobile screen is plan 44. It reuses these keys and does not add its own. Do not add the
mobile screen here.

## Rows

R52, R54, R62

## Runs after

23, 32, 34, 52

Plan 23 adds the request helper. Plan 32 edits `SettingsAccount.tsx`, the consumer originals,
and `e2e-spec-order-web.txt`. Plan 34 edits the same originals and deletes
`authentication.confirm_password`, `authentication.password_mismatch`, and
`getPassword2ErrorKey`. Plan 52 also runs `npm run i18n:compile`, which rewrites every layer's
overrides, so this plan's compile starts only after that one.

## Files

- apps/web/src/components/Settings/Panels/SettingsAccount/ModalChangePassword.tsx
- apps/web/src/styles/components/Modal/ModalChangePassword.module.scss
- apps/web/src/components/Settings/Panels/SettingsAccount/SettingsAccount.tsx
- packages/i18n-catalog/consumer/originals/en-US.json
- packages/i18n-catalog/consumer/originals/es.json
- packages/i18n-catalog/consumer/originals/fr.json
- packages/i18n-catalog/consumer/originals/el-GR.json
- apps/web/e2e/settings-account-change-password.spec.ts
- makefiles/local/e2e-spec-order-web.txt
- tools/web/seed-e2e.mjs
- packages/helpers-config/src/podverseTestEnv.ts

## Before you start

Confirm, and stop and report if any is missing:

- `ApiRequestService` has `reqAccountChangePassword({ current_password, new_password })`
  returning `{ message: string; revoked_count: number }` (plan 23).
- `ACCOUNT_CHANGE_PASSWORD_ERROR_CODES` and `getErrorResponseBodyCode` are exported from
  `@podverse/helpers` (plan 23; the code helper already lives in
  `packages/helpers/src/lib/error/errorParsing.ts`).
- `getPasswordErrorKey` and `getPasswordRequirementsInfoKey` are exported from
  `@podverse/helpers-validation/client`. `getPassword2ErrorKey` is already deleted (plan 34).
  If it is still exported, stop.
- `packages/i18n-catalog/consumer/originals/en-US.json` has `settings.account.sessions` (plan 32,
  plus `login_required` from plan 42). `authentication.confirm_password` and
  `authentication.password_mismatch` are already gone (plan 34).
- `apps/web/src/components/Settings/Panels/SettingsAccount/SettingsAccount.tsx` still has the
  Download My Data `SettingsSection`. Plan 32 may have inserted Signed-In Devices between that
  section and Delete Account. Leave that block as it is.

`en-US.json` and `seed-e2e.mjs` are large. Search the anchors below and edit with StrReplace.
Do not rewrite either file (**large-file-reading**).

## Decisions (transcribe, do not revisit)

- The form is a modal, matching Change Email (operator answer: "Modal, matching Change Email").
  The Account tab has a `SettingsSection` with a heading and a button that opens it. This section
  is always rendered, including when `canUseEmailVerificationFlows` is false. Plan 23's route is
  not behind `requireEmailFlows`.
- Two fields only. Eyebrows are **Current Password** and **New Password**. Placeholders are not
  those words (**form-eyebrow-placeholder**): current uses "Type your current password"; new
  reuses `authentication.password_hint` ("At least 8 characters").
- `@podverse/ui` `TextInput` with `type="password"`. It has no show-password control. Do not add
  one, and do not import `getPassword2ErrorKey`.
- The current password is not checked with `getPasswordErrorKey`. Only the new password is.
  An empty current password is the missing-field message, not `invalid_password`.
- Success copy does not include `revoked_count`. On success the modal closes and the toast is the
  sentence in `settings.account.change_password.success`. The page does not reload and does not
  call logout.
- The spec does not use `e2e-user@example.com`. It uses a seeded account that no other spec
  logs into, and it puts that password back in a `finally`.

## Form

New `ModalChangePassword.tsx`, named export `ModalChangePassword`, props
`{ isOpen: boolean; onClose: () => void }`. `'use client'`. Follow `ModalChangeEmail.tsx` in the
same folder for the `Modal` wiring, and **modal-layout-contract** for `Modal.Body` and
`Modal.Actions`.

- `useTranslations('settings')` as `tSettings`, `useTranslations('authentication')` as
  `tAuthentication`, `useTranslations('misc')` as `tMisc`, `useLocale()`.
- State: `currentPassword`, `newPassword`, `currentPasswordError` (string or undefined),
  `newPasswordError` (string or undefined), `formError` (string or undefined), `isSubmitting`.
- A `submittingRef` boolean. The handler returns immediately when it is already true, then sets
  it true before the request and false in `finally` (**input-rate-control**). `isSubmitting`
  drives the submit button's `isLoading` and `disabled`.
- `handleClose` clears both fields and every error, then calls `onClose`. The modal's close
  control, the Cancel button, and a successful change all go through it.

Markup:

- `Modal` with `isOpen`, `onClose={handleClose}`, `closeButtonAriaLabel={tMisc('close_modal')}`,
  and both `header` and `ariaLabel` set to `tSettings('account.change_password.heading')`.
- Inside `Modal.Body`, a `StackForm` whose `onSubmit` calls `preventDefault` and the handler. A
  real form lets password managers recognize the fields.
- `<p className={styles.message}>{tSettings('account.change_password.description')}</p>`.
- `TextInput` `type="password"` `name="currentPassword"` `autoComplete="current-password"`
  eyebrow `tSettings('account.change_password.current_password')` placeholder
  `tSettings('account.change_password.current_password_placeholder')`
  `infoError={currentPasswordError}` `aria-invalid={currentPasswordError !== undefined}`
  `autoFocus`.
- `TextInput` `type="password"` `name="newPassword"` `autoComplete="new-password"`
  eyebrow `tSettings('account.change_password.new_password')` placeholder
  `tAuthentication('password_hint')` `infoError={newPasswordError}`
  `aria-invalid={newPasswordError !== undefined}`.
- A line `{tAuthentication(getPasswordRequirementsInfoKey())}` under the fields.
- When `formError` is set, `<p role="alert">{formError}</p>`.
- `Modal.Actions`, Cancel first (**form-primary-actions-row**):
  - `Button` `type="button"` `variant="secondary"` `onClick={handleClose}`
    `disabled={isSubmitting}`, text `tMisc('cancel')`.
  - `Button` `type="submit"` `variant="primary"` text
    `tSettings('account.change_password.submit')`, `isLoading={isSubmitting}`. `disabled` when
    `isSubmitting` or `currentPassword.trim() === ''` or
    `getPasswordErrorKey(newPassword) !== undefined`.

New `apps/web/src/styles/components/Modal/ModalChangePassword.module.scss`, imported last
(**styles-import-last**) as `styles`:

```scss
.message {
  color: var(--text-color-secondary);
  margin: 0;
}
```

On change of either field, clear `formError` and that field's error. On blur of the new
password, when it is non-empty and `getPasswordErrorKey` returns a key, set
`newPasswordError` to `tAuthentication('invalid_password')`.

Handler, in order:

1. If `currentPassword.trim() === ''` or `newPassword.trim() === ''`, set `formError` to
   `tSettings('account.change_password.missing_field')` and return. Do not call the API.
2. If `getPasswordErrorKey(newPassword)` is defined, set `newPasswordError` to
   `tAuthentication('invalid_password')` and return. Do not call the API.
3. `await getApiRequestService().reqAccountChangePassword({ current_password: currentPassword, new_password: newPassword })`.
4. Success: call `handleClose()`, then
   `showToast(tSettings('account.change_password.success'), 'success')`. Ignore
   `revoked_count`. Do not navigate, reload, or call `reqAuthLogout`.
5. Catch: the modal stays open. `const handled = await handleRateLimitAlert(error, locale, tMisc)`.
   When it returns true, return. Read the status with `getErrorResponseStatus` from
   `@podverse/helpers` and the code with `getErrorResponseBodyCode`.
   - Status 401: return without setting a field or form error. Plan 33's session-ended path
     owns that response. Do not show `current_incorrect` for it.
   - `ACCOUNT_CHANGE_PASSWORD_ERROR_CODES.CURRENT_PASSWORD_INCORRECT` → `currentPasswordError =
     tSettings('account.change_password.current_incorrect')`.
   - `ACCOUNT_CHANGE_PASSWORD_ERROR_CODES.INVALID_NEW_PASSWORD` → `newPasswordError =
     tAuthentication('invalid_password')`.
   - Status 400 and no code → `formError = tSettings('account.change_password.missing_field')`.
   - Anything else → `formError = tSettings('account.change_password.error')`.

`SettingsAccount.tsx`:

- Import `ModalChangePassword` beside `ModalChangeEmail`, and add
  `const [isChangePasswordModalOpen, setIsChangePasswordModalOpen] = useState(false);` beside
  `isChangeEmailModalOpen`.
- Immediately after the change-email conditional (the block that ends with its own divider) and
  immediately before the Download My Data `SettingsSection`, render the section and a
  `<Divider withSpacing />`. The section mirrors the Change Email section:

```tsx
<SettingsSection>
  <h3>{tSettings('account.change_password.heading')}</h3>
  <Button
    type="button"
    onClick={() => setIsChangePasswordModalOpen(true)}
    variant="primary"
    description={tSettings('account.change_password.description')}
  >
    {tSettings('account.change_password.submit')}
  </Button>
  <ModalChangePassword
    isOpen={isChangePasswordModalOpen}
    onClose={() => setIsChangePasswordModalOpen(false)}
  />
</SettingsSection>
<Divider withSpacing />
```

Do not put it inside `capabilities.canUseEmailVerificationFlows`. Do not move Signed-In Devices.

## Catalog (consumer layer, all four locales)

Inside `settings.account`, add a `change_password` object as the next sibling after `sessions`.
StrReplace that window only.

| Key | en-US | es | fr | el-GR |
| --- | --- | --- | --- | --- |
| `heading` | Change Password | Cambiar contraseña | Changer le mot de passe | Αλλαγή κωδικού |
| `description` | Choose a new password. Every other device signed in to this account will be signed out. | Elige una contraseña nueva. Se cerrará la sesión en todos los demás dispositivos conectados a esta cuenta. | Choisissez un nouveau mot de passe. Tous les autres appareils connectés à ce compte seront déconnectés. | Επιλέξτε νέο κωδικό. Όλες οι άλλες συσκευές που είναι συνδεδεμένες σε αυτόν τον λογαριασμό θα αποσυνδεθούν. |
| `current_password` | Current Password | Contraseña actual | Mot de passe actuel | Τρέχων κωδικός |
| `new_password` | New Password | Contraseña nueva | Nouveau mot de passe | Νέος κωδικός |
| `current_password_placeholder` | Type your current password | Escribe tu contraseña actual | Saisissez votre mot de passe actuel | Πληκτρολογήστε τον τρέχοντα κωδικό σας |
| `submit` | Change Password | Cambiar contraseña | Changer le mot de passe | Αλλαγή κωδικού |
| `success` | Your password was changed. Every other device signed in to this account was signed out. | Tu contraseña se cambió. Se cerró la sesión en todos los demás dispositivos conectados a esta cuenta. | Votre mot de passe a été changé. Tous les autres appareils connectés à ce compte ont été déconnectés. | Ο κωδικός σας άλλαξε. Όλες οι άλλες συσκευές που είναι συνδεδεμένες σε αυτόν τον λογαριασμό αποσυνδέθηκαν. |
| `current_incorrect` | Current password is incorrect. | La contraseña actual es incorrecta. | Le mot de passe actuel est incorrect. | Ο τρέχων κωδικός είναι λανθασμένος. |
| `missing_field` | Enter your current password and a new password. | Escribe tu contraseña actual y una contraseña nueva. | Saisissez votre mot de passe actuel et un nouveau mot de passe. | Πληκτρολογήστε τον τρέχοντα κωδικό σας και έναν νέο κωδικό. |
| `error` | Could not change your password. Please try again. | No se pudo cambiar tu contraseña. Inténtalo de nuevo. | Impossible de changer votre mot de passe. Veuillez réessayer. | Δεν ήταν δυνατή η αλλαγή του κωδικού σας. Δοκιμάστε ξανά. |

Do not add `authentication.confirm_password` or `authentication.password_mismatch`. Do not edit
`overrides/` or any `compiled/` file by hand. From the repo root run `npm run i18n:compile`.

## Seed account

`tools/web/seed-e2e.mjs` truncates `account` and then inserts the perf user. Copy that perf
insert (account, credentials using the existing `passwordHash`, membership status,
`billing_membership_grant`, current terms acceptance, decided listen-stats settings) and the
`console.log`. Place the copy directly after `console.log(`Seeded perf user: ${E2E_PERF_EMAIL}`)`
and before `return accountId`.

Constants next to `E2E_PERF_EMAIL`:

- `E2E_CHANGE_PASSWORD_WEB_EMAIL = 'e2e-change-password-web@example.com'`
- `E2E_CHANGE_PASSWORD_WEB_ID_TEXT = 'e2eChgPwWeb01'` (13 characters)

Same password as every other seeded account (`Test!1Aa`, the existing `passwordHash`). Verified,
current terms version, listen-stats already decided, and a `trial` grant covering the membership
row (**membership-expiry-seeds-need-grant**). No follows, playlists, or other rows. Comment that
the email stays in sync with `settings-account-change-password.spec.ts`.

Do not add the iOS or Android accounts. Plan 44 does that after this block.

## Test env rate limit

In `packages/helpers-config/src/podverseTestEnv.ts`, inside `apiWebE2e` and `apiMobileE2e` only,
add `ACCOUNT_CHANGE_PASSWORD_MAX_PER_10_MINUTES: '100000'` directly after
`AUTH_LOGIN_MAX_PER_MINUTE`. One comment for both: the default of 4 per 10 minutes is what a
retry of this spec, or a mobile slot that changes and restores, would trip; the route's own
tests keep the default under `apiVitest`. Do not add the key to `apiVitest`.

## Tests

`apps/web/e2e/settings-account-change-password.spec.ts`. Suite title: "Change password in
Settings". API origin `http://localhost:4030/api/v2`. Account email
`e2e-change-password-web@example.com`, stable password `Test!1Aa`, temporary password
`E2e-web-pw2`.

`loginChangePasswordUser(page)`:

- `POST /auth/login` with the stable password.
- When that is 401, `POST /auth/login` with the temporary password, then
  `POST /account/change-password` with `current_password` the temporary password and
  `new_password` the stable password, then `POST /auth/login` with the stable password again.
- Throw when the stable login is still not ok. This repairs a previous run that stopped after
  the password changed. It never logs in as `e2e-user@example.com`.

`restoreStablePassword(page)` in a `finally`: `POST /account/change-password` with
`current_password` the temporary password and `new_password` the stable password. Ignore a
non-2xx (the password was already stable). Do not log either password.

Tests, verbose titles (**e2e-readability**). Each `page.goto` is followed by `toHaveURL` and a
visible destination element. Screenshots use `capturePageLoad` / `actionAndCapture` and pass the
element the step checks (**e2e-screenshot-verified-element**).

Every step that opens the modal: on `/settings?tab=account`, click the button named "Change
Password" in the Change Password section, then expect `getByRole('dialog', { name: 'Change
Password' })` visible. Scope every field, button, and error lookup after that to the dialog,
because the section button and the dialog's submit button share the label.

1. **When the current password is wrong, the dialog explains that and the browser stays
   signed in.** Login, `page.goto('/settings?tab=account')`, expect the URL and the heading
   "Change Password". Open the dialog. Fill Current Password with `wrong-password` and New
   Password with `E2e-web-pw2`. Click the dialog's "Change Password". Expect the dialog still
   open with the text "Current password is incorrect." `GET /auth/me` is 200. A second
   `POST /auth/login` with `Test!1Aa` on a fresh request context is 200. Capture the error text.
1. **When the new password is accepted, the dialog closes and the browser stays on Account,
   signed in.** Login, open `/settings?tab=account`, expect the URL and the heading. Open the
   dialog. It has a textbox named "Current Password" (exact) and one named "New Password"
   (exact). `input[name="currentPassword"]` and `input[name="newPassword"]` both have `type`
   `password`. The dialog has no textbox named "Confirm Password" and no button whose name
   matches `/show password/i`. Fill the stable password and `E2e-web-pw2`, click the dialog's
   "Change Password", expect the dialog hidden, expect the success sentence, expect the URL
   still `/settings?tab=account`, and expect `GET /auth/me` 200. Capture the success sentence.
   `finally` calls `restoreStablePassword`.
1. **Cancel closes the dialog without changing the password.** Login, open the dialog, fill
   both fields, click "Cancel". Expect the dialog hidden. `POST /auth/login` with `Test!1Aa` on
   a fresh request context is 200. Reopen the dialog and expect both fields empty. Capture the
   section heading.

Add `apps/web/e2e/settings-account-change-password.spec.ts` to
`makefiles/local/e2e-spec-order-web.txt` directly after
`apps/web/e2e/settings-account-sessions.spec.ts`. If that line is missing, stop and report.

No unit test. The new-password check is `getPasswordErrorKey`, which already has coverage.

## Release scratchpad

```markdown
## Change password in web Settings

- Surfaces: web, i18n catalogs (consumer)
- Change: Settings → Account has a Change Password button that opens a modal with a
  current-password field and a new-password field. There is no confirm field and no show-password control. A successful
  change keeps this browser signed in and signs out every other session. The new password
  follows the sign-up rule. Catalog keys are `settings.account.change_password.*`.
- Who notices: signed-in web users
- Operator steps: reseeding E2E (`make e2e_seed`) picks up `e2e-change-password-web@example.com`
```
