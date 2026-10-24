**Cursor model:** Cursor Grok 4.7 · **Reasoning:** extra high

# 44 — Mobile Change Password screen

Settings gains a **Change Password** screen that matches the web form in plan 35: one current
password, one new password, no confirm field, and no show-password control. Submit calls plan
23's `reqAccountChangePassword` through `requestWithMobileAuthRefresh`. On success the app stays
signed in.

The screen reuses plan 35's `settings.account.change_password.*` keys. Do not add catalog keys.

## Rows

R53, R54, R62

## Runs after

23, 35, 42, 43

Plan 23 adds the helper. Plan 35 adds the catalog keys, the web seed account, and the
`apiMobileE2e` rate-limit override. Plan 42 adds the Signed-In Devices row and edits
`MoreSettingsScreen.tsx`, `navigation/index.tsx`, and `scripts/mobile/e2e-test.sh`. Plan 43
removes the sign-up confirm field. This screen does not edit `SignUpScreen.tsx`.

## Files

- apps/mobile/src/screens/more/MoreSettingsChangePasswordScreen.tsx
- apps/mobile/src/screens/more/MoreSettingsScreen.tsx
- apps/mobile/src/navigation/index.tsx
- tools/web/seed-e2e.mjs
- apps/mobile/e2e/auth-change-password.yaml
- apps/mobile/e2e/scripts/auth-change-password.js
- scripts/mobile/e2e-test.sh

## Before you start

Confirm, and stop and report if any is missing:

- `ApiRequestService` has `reqAccountChangePassword` (plan 23). Call it on the service instance.
  Mobile does not import the package barrel of `@podverse/helpers`.
- `ACCOUNT_CHANGE_PASSWORD_ERROR_CODES` and `getErrorResponseBodyCode` export from
  `@podverse/helpers/error`.
- `getPasswordErrorKey` and `getPasswordRequirementsInfoKey` export from
  `@podverse/helpers-validation/client`. Do not import `getPassword2ErrorKey`. Plan 34 deletes
  it after plan 43; if this screen is implemented before that deletion, still do not import it.
- The consumer catalogs contain `settings.account.change_password` with the keys plan 35 lists
  (`heading`, `description`, `current_password`, `new_password`,
  `current_password_placeholder`, `submit`, `success`, `current_incorrect`, `missing_field`,
  `error`). If `heading` is missing, stop.
- `MoreSettingsScreen.tsx` has the Signed-In Devices item plan 42 added
  (`testID: 'more-settings-sessions'`). If it is missing, stop.
- `packages/helpers-config/src/podverseTestEnv.ts` `apiMobileE2e` sets
  `ACCOUNT_CHANGE_PASSWORD_MAX_PER_10_MINUTES` to `100000` (plan 35). If it does not, stop.
  Do not edit that file.
- `tools/web/seed-e2e.mjs` already inserts `e2e-change-password-web@example.com` (plan 35). The
  two accounts below are inserted after that block.

`navigation/index.tsx` is about 2,200 lines and other work edits it. Search
`MoreSettingsSessions` and edit with StrReplace (**large-file-reading**). Same for
`seed-e2e.mjs` and the `flow_needs_e2e_api` case in `e2e-test.sh`.

## Decisions (transcribe, do not revisit)

- One `TextField` for the current password and one for the new password.
  `secureTextEntry={!isE2e}`, the same switch login and sign-up use, so a release build hides
  the text and Maestro can type when `EXPO_PUBLIC_MOBILE_E2E=1`. `TextField` has no
  show-password control. Do not add one.
- Copy and keys come from plan 35. `revoked_count` is not shown. Success is the
  `settings.account.change_password.success` sentence, inline, and the screen stays mounted.
- The Settings row is always shown. Signed out, the screen shows `authentication.login_required`
  (**generic-login-required-copy**). Offline Mode shows the shared offline sentence and does
  not call the API. A lapsed membership still sees the form; plan 23's route allows it.
- The Maestro flow does not change `e2e-user@example.com`. iOS and Android each use their own
  seeded account, change it from the screen, and change it back from the screen before the flow
  ends. The host script refuses the shared seeded emails.

## Screen

`apps/mobile/src/screens/more/MoreSettingsChangePasswordScreen.tsx`. Named export
`MoreSettingsChangePasswordScreen`.

Root `testID="more-settings-change-password-screen"` inside `MobileScreenContainer`
(**mobile-screen-layout**). No second display heading; the stack title is the heading. Reuse
`TextField`, `FormActions`, `AuthAwareLoadState`, and `ListEmpty`
(**mobile-reusable-components**). `useTranslation()`. `getMobileConfig().isE2e` for the secure
and autofill switch.

State, first match wins:

1. **Signed out** (`useAuth().status !== 'authenticated'`): `AuthAwareLoadState` with
   `showAuthRequired`, `authMessageKey="authentication.login_required"`,
   `emptyTestID="more-settings-change-password-login-required"`. No request.
2. **Offline Mode on** (`useOfflineMode().enabled`): `ListEmpty` with
   `OFFLINE_UNAVAILABLE_MESSAGE_KEY` from `src/lib/offlineModeViews`,
   `testID="more-settings-change-password-offline"`. No request.
3. **Form.** Description `settings.account.change_password.description` (`typography.prose`).
   Then the two fields,    the requirements line
   `t(\`authentication.${getPasswordRequirementsInfoKey()}\`)`, then `FormActions` with one
   `variant="primary"` action.

Fields:

- Current: `testID="more-settings-change-password-current"`, eyebrow and accessibility label
  `t('settings.account.change_password.current_password')`, placeholder
  `t('settings.account.change_password.current_password_placeholder')`,
  `autoCapitalize="none"`, `autoCorrect={false}`, `secureTextEntry={!isE2e}`,
  `autoComplete={isE2e ? 'off' : 'current-password'}`,
  `textContentType={isE2e ? 'none' : 'password'}`.
- New: `testID="more-settings-change-password-new"`, eyebrow and accessibility label
  `t('settings.account.change_password.new_password')`, placeholder
  `t('authentication.password_hint')`, the same secure and autofill switch with
  `new-password` / `newPassword` when not E2E.
- `invalid` on a field only when that field has an error string. Do not set `invalid` from the
  other field.

`FormActions` sits below the fields with `marginTop: formActionsTopGap(tokens.spacing)`. The
action label is `t('settings.account.change_password.submit')`,
`testID="more-settings-change-password-submit"`, `disabled` when the current value is empty or
`getPasswordErrorKey(newPassword) !== undefined`, `loading` while the request is in flight.

Messages, `typography.body`, `accessibilityLiveRegion="polite"`:

- Field errors render in the `TextField` the screen already uses for `invalid` by passing the
  sentence as extra text under that field only if `TextField` has no error prop. It does not.
  Render the current-password sentence and the new-password sentence as `Text` nodes directly
  under the matching field, `testID="more-settings-change-password-current-error"` and
  `testID="more-settings-change-password-new-error"`.
- Form-level sentence: `testID="more-settings-change-password-error"`.
- Success: `testID="more-settings-change-password-success"`.

Submit (`submittingRef`, same guard as plan 35, **input-rate-control**):

1. Empty current or empty new → form-level `settings.account.change_password.missing_field`.
   Do not call the API.
2. `getPasswordErrorKey(newPassword)` defined → new-field
   `authentication.invalid_password`. Do not call the API. Do not run `getPasswordErrorKey` on
   the current password.
3. Clear success and errors, then
   `requestWithMobileAuthRefresh(deps, (api) => api.reqAccountChangePassword({ current_password, new_password }))`
   with `deps` from `useAuth()` (`accessToken`, `refreshToken`, `setTokens`, `clearSession`),
   the same shape `MoreSettingsPopularityTrackingScreen.tsx` passes.
4. Success: clear both fields, set the success sentence, leave `status` authenticated. Do not
   call `logout`. Do not read `revoked_count`.
5. Catch, in order. `handleRateLimitMessage(error, t)` when non-null is the form-level text.
   Status 401 (`getErrorResponseStatus` from `@podverse/helpers/error`): set no field error.
   `requestWithMobileAuthRefresh` already refreshes or ends the session
   (**mobile-auth-refresh-terminates**). Do not map a 401 to `current_incorrect`.
   Otherwise compare `getErrorResponseBodyCode(error)` with `===` to
   `ACCOUNT_CHANGE_PASSWORD_ERROR_CODES.CURRENT_PASSWORD_INCORRECT` (current-field
   `settings.account.change_password.current_incorrect`) or `INVALID_NEW_PASSWORD` (new-field
   `authentication.invalid_password`). Status 400 and no code →
   `settings.account.change_password.missing_field`. Anything else →
   `settings.account.change_password.error`.
6. `finally` clears the in-flight ref and the loading flag.
7. Editing either field clears success and the form-level error.

Changing either field's text clears that field's error. Surface every thrown error in the UI
(**mobile-surface-async-errors**). This is an interactive request, not a sync job, and nothing
is written to SQLite.

## Settings row and route

`MoreSettingsScreen.tsx`: insert an item immediately before the Signed-In Devices item
(`testID: 'more-settings-sessions'`):

- `title: t('settings.account.change_password.heading')`
- `subtitle: t('settings.account.change_password.description')`
- `testID: 'more-settings-change-password'`
- `onPress` navigates to `MORE_STACK_ROUTES.MoreSettingsChangePassword`

The row is always in the list. Include the new values in the `useMemo` dependency list only
when they are not already covered by `t` and `navigation`.

`navigation/index.tsx`, alphabetical among the `MoreSettings*` entries:

- `MORE_STACK_ROUTES.MoreSettingsChangePassword: 'MoreSettingsChangePassword'`
- `moreTabLinkScreens`:
  `` MoreSettingsChangePassword: `more${APP_ROUTES.SETTINGS}/change-password` ``
- `MoreStackParamList`: `MoreSettingsChangePassword: undefined`
- Import the screen and add `MoreStack.Screen` next to the Signed-In Devices screen plan 42
  added, `options={{ title: t('settings.account.change_password.heading') }}`.

## Seed accounts

In `tools/web/seed-e2e.mjs`, copy the change-password web insert plan 35 added (account,
credentials with the existing `passwordHash`, membership status, `billing_membership_grant`,
current terms, decided listen-stats). Insert two copies directly after that web block.

| Email | id_text | characters |
| --- | --- | --- |
| `e2e-change-password-ios@example.com` | `e2eChgPwIos01` | 13 |
| `e2e-change-password-android@example.com` | `e2eChgPwAnd01` | 13 |

Same `Test!1Aa` hash. Comment that the emails stay in sync with `auth-change-password.yaml`.
Do not give either account follows or playlists. Do not change `e2e-user@example.com` or the
web change-password account.

## Maestro

The flow does not change the password of `e2e-user@example.com`, the account
`auth-sessions.yaml` and `login-seeded-user.yaml` share across the iOS and Android slots. Each
slot uses its own account, changes the password on the screen, and changes it back on the screen
in the same flow. A run that fails before that second submit leaves the temporary password; the
next run's opening script puts the stable password back before the app logs in.

Stable password for both accounts: `Test!1Aa`. Temporary: iOS `E2e-ios-pw2`, Android
`E2e-and-pw2`. Both meet the sign-up rule.

### `apps/mobile/e2e/scripts/auth-change-password.js`

Host-JVM script, header comment and `http` style of `scripts/seed-playback-now-playing.js`.
`API_BASE_URL` defaults to `http://localhost:4230/api/v2`.

Env, all required, no defaults:

- `E2E_ACCOUNT_EMAIL`
- `E2E_ACCOUNT_PASSWORD` (stable)
- `E2E_ACCOUNT_TEMP_PASSWORD`

Throw immediately when the email is `e2e-user@example.com`, `e2e-perf@example.com`,
`e2e-popularity-undecided@example.com`, `e2e-stale-terms@example.com`, or
`e2e-consent-order@example.com`.

`ensure-stable`:

- `POST /auth/mobile/token` with `{ email, password: stable, device_label: 'E2E Change Password' }`.
  200 → return. Do not call change-password. That caller's session is not the app's, and a
  change from here would end the app session.
- 401 → same login with the temporary password. 200 → `POST /account/change-password` with
  that access token as `Authorization: Bearer`, body
  `{ current_password: temporary, new_password: stable }`. Then return when
  `E2E_CHANGE_PASSWORD_REPAIR_THROW` is unset.
- When `E2E_CHANGE_PASSWORD_REPAIR_THROW` is `1` and the stable login was not 200, repair as
  above and then throw "change-password account was not left on the stable password".
- Any other status, or a temporary login that is not 200, throws with the status and body.
  Never fall through to another email.

### `apps/mobile/e2e/auth-change-password.yaml`

`TIMEOUT_*` from `shared/timeouts.env` (**mobile-maestro-timeouts**). Do not run
`shared/login-seeded-user.yaml`.

1. `shared/launch-and-connect.yaml` (signed out; `clearState` is part of that flow).
2. Per platform (`runFlow` `when: platform: iOS` / `Android`, as `track.yaml` does), run the
   script with that platform's email, `Test!1Aa`, and its temporary password. No
   `E2E_CHANGE_PASSWORD_REPAIR_THROW` on this call.
3. Login through the form, the steps in `shared/login-seeded-user-ui.yaml`, with that
   platform's email and `inputText: "Test!1Aa"`. `hideKeyboard` only inside the Android
   `when` block. Wait for `e2e-session-authenticated` with `TIMEOUT_SLOW`.
4. `tab-more` → `more-settings` → `more-settings-change-password`. Wait for
   `more-settings-change-password-screen` and both field ids. Assert visible text
   "Current Password" and "New Password". Assert not visible text "Confirm Password" and
   "Show Password". Screenshot.
5. Fill current with `Test!1Aa` and new with the platform temporary password. Android
   `hideKeyboard`. Tap `more-settings-change-password-submit`. Wait for
   `more-settings-change-password-success` (`TIMEOUT_SLOW`). Assert
   `e2e-session-authenticated` and assert not visible `forced-logout-modal`. Screenshot.
6. The screen clears both fields on success. Fill current with the temporary password and new
   with `Test!1Aa`. Android `hideKeyboard`. Tap submit again. Wait for the success id. Assert
   `e2e-session-authenticated` and assert not visible `forced-logout-modal`. Screenshot.
7. Run the script again with `E2E_CHANGE_PASSWORD_REPAIR_THROW` `1` and the same email and
   passwords. A stable login means the screen restored the password and the script returns. A
   stable login failure repairs the account and fails this run, so the next run starts stable
   and this run stays red.

### `scripts/mobile/e2e-test.sh`

In `flow_needs_e2e_api`, add `auth-change-password` immediately after `auth-sessions`. If
`auth-sessions` is not in that case list, stop. Do not add the flow to `flow_needs_test_assets`.

## Tests

Maestro `auth-change-password.yaml` above. No unit test and no render test. The password rule
is `getPasswordErrorKey`, and the screen's wiring is what the flow holds
(**mobile-test-economics**).

## Release scratchpad

```markdown
## Change password in mobile Settings

- Surfaces: mobile
- Change: Settings has a Change Password screen with a current-password field and a
  new-password field. There is no confirm field and no show-password control. A successful
  change keeps this device signed in and signs out every other session. The screen reuses
  web's `settings.account.change_password.*` copy. Signed out, it asks the person to log in.
  Offline Mode shows the shared offline message. New Maestro flow `auth-change-password`
  uses its own seeded accounts and puts each password back before the flow ends.
- Who notices: signed-in mobile users
- Operator steps: reseeding E2E (`make e2e_seed`) picks up the iOS and Android change-password accounts
```
