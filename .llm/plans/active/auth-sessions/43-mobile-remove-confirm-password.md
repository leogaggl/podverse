**Cursor model:** Cursor Grok 4.7 · **Reasoning:** high

# 43 — Mobile sign-up keeps one password field

The sign-up screen keeps its password field and drops the confirm field and the mismatch check.
Account creation already sends one `password` through `reqAccountCreate`. Plan 34 deletes
`getPassword2ErrorKey` and the catalog keys after this screen stops reading them. The new
change-password screen is plan 44; do not add it here.

## Rows

R59

## Runs after

none

## Files

- apps/mobile/src/screens/auth/SignUpScreen.tsx

## Decisions (transcribe, do not revisit)

- Keep the password `TextField`: `testID="signup-password"`, eyebrow and accessibility label
  `t('authentication.password')`, placeholder `t('authentication.password_hint')`,
  `secureTextEntry={!isE2e}`, and the existing `autoComplete` / `textContentType` pair
  (`new-password` / `newPassword` off the E2E build, `off` / `none` when `isE2e`).
  `TextField` has no show-password control. Do not add one.
- Delete the confirm `TextField` (`testID="signup-password-confirm"`), the `passwordConfirm`
  state, and the `getPassword2ErrorKey` import and call.
- `validateInputs` still returns `getEmailErrorKey(email)` or `getPasswordErrorKey(password)`,
  and otherwise `null`. An empty password is still `invalid_password`.
- `resolveValidationError` keeps the set `invalid_email` and `invalid_password`. Remove
  `password_mismatch` from that set.
- `reqAccountCreate` still receives `{ email, locale: DEFAULT_LOCALE, password, terms_version }`.
  Do not send a second password.
- Do not edit `packages/helpers-validation` or the consumer catalogs. Plan 34 owns that, and it
  runs after this plan. Do not edit Maestro flows: none under `apps/mobile/e2e/` fill or assert
  `signup-password-confirm`.

## Screen

`SignUpScreen` (`apps/mobile/src/screens/auth/SignUpScreen.tsx`):

- Import only `getEmailErrorKey` and `getPasswordErrorKey` from
  `@podverse/helpers-validation/client`.
- Delete `const [passwordConfirm, setPasswordConfirm] = useState('')`.
- In `validateInputs`, delete the `getPassword2ErrorKey(password, passwordConfirm)` block.
- In `resolveValidationError`, the set is `['invalid_email', 'invalid_password']`.
- Delete the second `TextField` in `signup-form` (the one whose eyebrow is
  `t('authentication.confirm_password')`).

Leave the terms accordion, the agreement checkbox, `signup-submit`, and the success branch as
they are.

## Tests

None. No Maestro flow fills or asserts the confirm field. Do not add a flow to prove a field is
absent (**mobile-test-economics**). Do not add a unit test; the screen has none, and the
remaining checks are `getEmailErrorKey` and `getPasswordErrorKey`.

## Release scratchpad

```markdown
## Mobile sign-up uses one password field

- Surfaces: mobile
- Change: Sign Up keeps a single password field. The confirm field and the mismatch check are
  gone. Creating the account still sends one password.
- Who notices: people creating an account in the mobile app
- Operator steps: none
```
