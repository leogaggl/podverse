**Cursor model:** Cursor Grok 4.7 · **Reasoning:** high

# 52 — Management invite redeem and edit-user keep one password field

Redeem Admin Invite and the user edit password tab each keep one password field. The confirm
field, the mismatch check, and the catalog keys that exist only for that check are removed.
Both requests already send one `password`. Plan 63 ends the admin's sessions on a successful
redeem; this plan does not change that call. Plan 51 changes the password-saved sentence and
adds Force Logout; this plan does not touch either.

## Rows

R60, R61

## Runs after

51, 63, 66, 34

Plan 51 creates `users-detail-force-logout.spec.ts`, which fills the confirm field, and it
edits the management catalog originals. Plan 66 is the last earlier prompt that both edits
those originals and runs `npm run i18n:compile` (it follows plan 65). Plan 34 removes the
consumer confirm-password keys and also runs that compile. This plan's compile has to see all
of those originals.

## Files

- apps/management-web/src/app/(public-flows)/admins/redeem-invite-link/RedeemAdminInviteLinkPageClient.tsx
- apps/management-web/src/app/(management)/users/[id]/edit/EditUserPageClient.tsx
- apps/management-web/e2e/users-detail-force-logout.spec.ts
- packages/i18n-catalog/management/originals/en-US.json
- packages/i18n-catalog/management/originals/es.json
- packages/i18n-catalog/management/originals/fr.json
- packages/i18n-catalog/management/originals/el-GR.json

`users-detail-force-logout.spec.ts` does not exist until plan 51. If it is missing, stop and
report.

## Decisions (transcribe, do not revisit)

- Redeem Admin Invite keeps the first `TextInput`: `type="password"`, `autoComplete="new-password"`,
  `minLength={8}`, `required`, eyebrow `t('passwordLabel')` (`admins.setAdminPassword.passwordLabel`,
  English "New password"). Delete the second input (eyebrow `t('confirmLabel')`) and the
  `confirmPassword` state.
- Submit still rejects a password shorter than 8 characters with `ta('passwordMinLength')`
  (`users.passwordMinLength`). Delete the `password !== confirmPassword` branch and
  `t('passwordsDoNotMatch')`. The call stays `redeemAdminInviteLink({ token, password })`.
- Edit User's password tab keeps `#edit-user-new-password`: `type="password"`,
  `autoComplete="new-password"`, eyebrow `ta('newPassword')` (`auth.newPassword`). Delete
  `#edit-user-confirm-password` and the `confirmPassword` state. `handlePasswordSubmit` still
  sets `passwordError` from `t('passwordMinLength')` when `newPassword.length < 8`. Delete the
  mismatch branch. On success, clear `newPassword` only, and keep `setSuccess(t('passwordChanged'))`.
  Plan 51 replaces that sentence; do not write the old "Password changed successfully." back.
- Both surfaces use `@podverse/ui` `TextInput`. It has no show-password control. Do not add one.
- No management API field or Joi check exists only for confirmation. `POST /admins/invite-link/redeem`
  reads `token` and `password`. `POST /users/:id/password` sends `{ password }`. Do not add a
  second field.
- Keys removed, and the only reader each one has:

  - `auth.confirmPassword` — `EditUserPageClient` `ta('confirmPassword')`. `ta` is
    `useTranslations('auth')`. Keep `auth.newPassword` (also read by `EditAdminPageClient`).
  - `users.passwordsDoNotMatch` — `EditUserPageClient` `t('passwordsDoNotMatch')`. `t` is
    `useTranslations('users')`. Keep `users.passwordMinLength` and `users.passwordChanged`.
  - `admins.setAdminPassword.confirmLabel` and `admins.setAdminPassword.passwordsDoNotMatch` —
    `RedeemAdminInviteLinkPageClient`. Keep every other key in `admins.setAdminPassword`
    (`title`, `subtitle`, `passwordLabel`, `submit`, `success`, `backToSignIn`, `failed`,
    `missingToken`).

- Do not remove `admins.confirmForceLogout` or `admins.forceLogoutConfirmAria`. Those are the
  Force Logout dialog from plan 65, not a password field. Do not remove `common.confirm`.

## Pages

`RedeemAdminInviteLinkPageClient.tsx`: delete `confirmPassword` / `setConfirmPassword`, the
mismatch `if`, and the second `TextInput`. Keep `FormHintText` with `ta('passwordMinLength')`.
`t` (`admins.setAdminPassword`) stays for the card title, subtitle, submit, and error paths.

`EditUserPageClient.tsx`: anchors are `handlePasswordSubmit` and the password-tab `StackForm`
(the branch that is not the profile form). Delete `confirmPassword`, the mismatch `if`,
`setConfirmPassword('')`, and the confirm `TextInput`. The password `TextInput` and both
buttons stay. Profile save is untouched.

## Catalog

Search each key in `packages/i18n-catalog/management/originals/` and delete that entry in
`en-US.json`, `es.json`, `fr.json`, and `el-GR.json` (**large-file-reading**). Do not rewrite
a catalog file. Plans 51, 65, and 66 add other keys in `users`, `admins`, and `auth`; leave
those.

Do not edit `overrides/` or any `compiled/` file by hand. Run `npm run i18n:compile` from the
repo root. Compiled JSON is gitignored. Plan 34 already compiled its consumer deletions; this
compile drops the management keys removed here.

## Tests

No management-web spec in the tree today fills a confirm field. Plan 51's fourth test in
`apps/management-web/e2e/users-detail-force-logout.spec.ts` fills `#edit-user-new-password` and
`#edit-user-confirm-password` with `newpassword123`. Fill only `#edit-user-new-password`. Leave
the rest of that test, including the success sentence plan 51 asserts.

Do not add a redeem-invite spec. Nothing in `apps/management-web/e2e/` fills that confirm field.

## Release scratchpad

```markdown
## Management password forms use one password field

- Surfaces: management-web
- Change: Redeem Admin Invite and Edit User each keep a single password field. The confirm
  field and the mismatch check are gone. Both requests still send one password.
- Who notices: a new admin setting a password from an invite link, and a superuser setting a user's password
- Operator steps: none
```
