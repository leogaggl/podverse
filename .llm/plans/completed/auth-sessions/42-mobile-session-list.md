**Cursor model:** Cursor Grok 4.7 · **Reasoning:** high

# 42 — Mobile Signed-In Devices screen

Settings gets a **Signed-In Devices** screen listing every session on the account: device label,
last used, a Sign Out button on every row, and **Sign Out of All Other Devices**. The
app also names itself at login (`device_label`), so its row reads "iPhone · iOS" or
"Google Pixel 6 Pro · Android" instead of a bare platform. A Maestro flow covers the list, signing
out one session, and the signed-out reason from plan 41 by ending the device's own session from the
host.

## Rows

R28, R45 (device coverage of plan 41's reason)

## Runs after

41, 22, 32

## Files

- apps/mobile/src/lib/device/deviceModel.ts
- apps/mobile/src/lib/device/deviceModel.test.ts
- apps/mobile/src/screens/more/errorLogDeviceContext.ts
- apps/mobile/src/screens/more/errorLogDeviceContext.read.ts
- apps/mobile/src/screens/more/errorLogDeviceContext.test.ts
- apps/mobile/src/auth/mobileSessionDeviceLabel.ts
- apps/mobile/src/auth/mobileSessionDeviceLabel.test.ts
- apps/mobile/src/auth/mobileSessionDeviceLabel.read.ts
- apps/mobile/src/auth/loginWithMobileToken.ts
- apps/mobile/src/auth/loginWithMobileToken.test.ts
- apps/mobile/src/auth/accountSessions.ts
- apps/mobile/src/screens/more/accountSessionRows.ts
- apps/mobile/src/screens/more/accountSessionRows.test.ts
- apps/mobile/src/screens/more/MoreSettingsSessionsScreen.tsx
- apps/mobile/src/screens/more/MoreSettingsScreen.tsx
- apps/mobile/src/navigation/index.tsx
- apps/mobile/vitest.config.ts
- packages/i18n-catalog/consumer/originals/en-US.json
- packages/i18n-catalog/consumer/originals/es.json
- packages/i18n-catalog/consumer/originals/fr.json
- packages/i18n-catalog/consumer/originals/el-GR.json
- apps/mobile/e2e/auth-sessions.yaml
- apps/mobile/e2e/scripts/auth-sessions.js
- apps/mobile/e2e/auth-logout.yaml
- scripts/mobile/e2e-test.sh

## Before you start

Plans 22, 32, and 41 must be done. Confirm:

- The consumer catalogs have web plan 32's `settings.account.sessions` object.

- `DTOAccountSession` and `AccountSessionClientType` (`'web' | 'mobile'`) are exported from
  `@podverse/helpers` (plans 10 and 22). Import them as types.
- `ApiRequestService` (`packages/helpers-requests/src/api/apiRequestService.ts`) has
  `reqAuthSessions()`, `reqAuthSessionRevoke(sessionIdText)`, `reqAuthSessionsRevokeOthers()`, and
  `reqAuthMobileToken` accepts an optional `device_label`.
- Plan 41's `ClearSession` type exists in `src/auth/forcedLogoutNotice.ts`.

If any is missing, stop and report. Read the method signatures from the source; do not guess
response shapes. `navigation/index.tsx` (about 2,200 lines) and `vitest.config.ts` have edits from
other work: read the slices you touch with offset and limit, and edit with StrReplace
(**large-file-reading**).

## Device label

1. **Move `joinDeviceModel`** from `src/screens/more/errorLogDeviceContext.ts` to
   `src/lib/device/deviceModel.ts` (same body and doc comment). Import it in
   `errorLogDeviceContext.read.ts` from `../../lib/device/deviceModel`. Move its test cases from
   `errorLogDeviceContext.test.ts` into `deviceModel.test.ts`.
1. **`src/auth/mobileSessionDeviceLabel.ts`** (pure):

   ```typescript
   export type MobileSessionDeviceFacts =
     | { os: 'ios'; interfaceIdiom: string }
     | { os: 'android'; manufacturer: string; model: string }
     | { os: 'other' };

   /** Label the server shows in the session list: "<device> · <OS>", brand names only. */
   export const mobileSessionDeviceLabel = (facts: MobileSessionDeviceFacts): string | null;
   ```

   - iOS: `interfaceIdiom` `'phone'` → `'iPhone · iOS'`, `'pad'` → `'iPad · iOS'`, anything else →
     `'iOS'`.
   - Android: `joinDeviceModel(manufacturer, model)` → `'<model> · Android'`; null → `'Android'`.
   - other → null (the server then falls back to the client platform header).

   The separator is ` · ` (space, U+00B7, space), the same format as web's `"<Browser> · <OS>"`
   from plan 20. Labels are brand names and are not translated.
1. **`src/auth/mobileSessionDeviceLabel.read.ts`**: `readMobileSessionDeviceLabel(): string | null`
   builds the facts from `Platform.OS` and `Platform.constants` the way
   `errorLogDeviceContext.read.ts` `readModel` does (`interfaceIdiom`; `Manufacturer`, `Model`).
1. **`loginWithMobileToken.ts`**: send
   `reqAuthMobileToken({ email, password, device_label: readMobileSessionDeviceLabel() ?? undefined })`
   (match plan 20's parameter type; omit the field when null). This is the app's only login path
   (password login and E2E quick login both go through it).

## Requests: `src/auth/accountSessions.ts`

Three functions, each taking `deps: AuthRequestDeps` and calling `requestWithMobileAuthRefresh` so
401 handling, refresh, and the signed-out reason all come from the shared path:

- `fetchAccountSessions(deps): Promise<DTOAccountSession[]>` → `api.reqAuthSessions()`, returns
  `rows`.
- `endAccountSession(deps, sessionIdText): Promise<void>` → `api.reqAuthSessionRevoke(...)`.
- `endOtherAccountSessions(deps): Promise<number>` → `api.reqAuthSessionsRevokeOthers()`, returns
  `revoked_count`.

Unwrap `{ status, data }` the way `MoreSettingsPopularityTrackingScreen.tsx` does. The session list
is account data that changes from other devices, so it is fetched each time the screen opens and
never written to SQLite (**mobile-account-scoped-data**).

## Rows: `src/screens/more/accountSessionRows.ts` (pure)

```typescript
export type AccountSessionRow = {
  idText: string;
  isCurrent: boolean;
  /** Device label, or null when the session has none (caller shows the client fallback). */
  deviceLabel: string | null;
  clientType: AccountSessionClientType;
  lastSeenAt: string;
};

/** The current session first, then the rest in server order (most recently used first). */
export const toAccountSessionRows = (sessions: readonly DTOAccountSession[]): AccountSessionRow[];
```

Add `withoutAccountSession(rows, idText)` and `onlyCurrentAccountSession(rows)` for the local
updates after a sign-out.

## Screen: `src/screens/more/MoreSettingsSessionsScreen.tsx`

Parity source: web plan 32 (`SettingsSessions.tsx`). Same rows, same order, same copy keys, and
the same actions: every row has Sign Out, one session ends without a confirm, and Sign Out of All
Other Devices confirms first.

Root `testID="more-settings-sessions-screen"`, inside `MobileScreenContainer`
(**mobile-screen-layout**). Reuse `ListRow`, `Button`, `FormActions`, `ConfirmDialog`,
`AuthAwareLoadState`, and `ListEmpty`; no new shared component (**mobile-reusable-components**).
`useTranslation()` with full keys under `settings.account.sessions`.

State, in this order:

1. **Signed out** (`useAuth().status !== 'authenticated'`): `AuthAwareLoadState` with
   `showAuthRequired`, `authMessageKey="settings.account.sessions.login_required"`,
   `emptyTestID="more-settings-sessions-login-required"`. No request.
1. **Offline Mode on** (`useOfflineMode().enabled`): `ListEmpty` with
   `OFFLINE_UNAVAILABLE_MESSAGE_KEY`, `testID="more-settings-sessions-offline-unavailable"`, as
   `MoreOpmlScreen.tsx` does. No request.
1. **Loading / error**: `AuthAwareLoadState` with `isLoading`, `errorKey`
   (`'settings.account.sessions.load_error'`), `onRetry`,
   `loadingTestID="more-settings-sessions-loading"`, `errorTestID="more-settings-sessions-error"`.
   Load on mount with a cancelled flag, as `MoreSettingsPopularityTrackingScreen.tsx` does.
1. **List**: the description line (`settings.account.sessions.description`), then one `ListRow` per
   row, then the sign-out-all action.

Rows:

- Title: `deviceLabel`, or `settings.account.sessions.client_type_web` /
  `client_type_mobile` when null, chosen by an exhaustive `switch` on `clientType` with no
  `default`.
- Subtitle: `settings.account.sessions.this_device` for the current row; otherwise
  `t('settings.account.sessions.last_used', { date: formatDateAbbrev(lastSeenAt, locale) })`
  (`formatDateAbbrev` from `@podverse/helpers`, as `itemDetailDateLabel.ts` imports it; the server's
  `last_seen_at` is only accurate to a day, so show a date, not a time).
- Trailing on every row: `<Button size="sm" variant="outline"
  label={t('settings.account.sessions.sign_out')}
  accessibilityLabel={t('settings.account.sessions.sign_out_device_aria', { device: title })}
  testID={`more-settings-session-sign-out-${idText}`} />`. Each Sign Out button gets its own
  accessible name (**screen-reader-accessibility**).
- Row `testID`: `more-settings-session-current` for the current row, else
  `more-settings-session-${idText}`.
- **Sign Out of All Other Devices** below the list: `FormActions` with one `variant="danger"`
  action labeled `settings.account.sessions.sign_out_all_other`,
  `testID="more-settings-sessions-sign-out-others"`, shown only when at least one other row exists.

Actions:

- **Sign Out on this device's row:** `useAuth().logout()`, the same call the More tab's Logout row
  makes (push and auto-download unregister, server revoke, local sign-out). No confirm, as Logout
  has none. `App.tsx` resets its auth sheet when the status changes, so no extra call is needed. The
  screen then shows the signed-out state.
- **Sign Out on another row:** `endAccountSession(deps, idText)` right away, no confirm (matches
  web). Success removes the row (`withoutAccountSession`). A 404 means it already ended: remove the
  row too. Any other failure keeps the row and shows `settings.account.sessions.sign_out_error`
  inline under the description (`testID="more-settings-sessions-action-error"`).
- **Sign Out of All Other Devices:** opens a `ConfirmDialog` (through `AppOverlay`, as other More
  screens do): title `settings.account.sessions.sign_out_all_other`, body
  `settings.account.sessions.sign_out_all_other_body`, confirm `settings.account.sessions.sign_out`,
  cancel `misc.cancel`. Test IDs `more-settings-sessions-sign-out-others-dialog`, `-confirm`,
  `-cancel`. Confirm calls `endOtherAccountSessions(deps)`; success keeps only the current row
  (`onlyCurrentAccountSession`); failure closes the dialog and shows
  `settings.account.sessions.sign_out_all_other_error` inline.
- **In-flight guards** in the handlers, not only `disabled` (**input-rate-control**): a ref
  `Set<string>` of session ids being ended (also drives that row's button `loading` through state),
  and a boolean ref for the revoke-others call.
- A 401 that ends this device's own session is handled by the shared refresh path (sign-out plus
  plan 41's dialog); the screen then shows the signed-out state.

## Settings row and route

- `MoreSettingsScreen.tsx`: add an item after Notifications and before Terms: label
  `t('settings.account.sessions.heading')`, `testID: 'more-settings-sessions'`, navigates to
  `MORE_STACK_ROUTES.MoreSettingsSessions`. The row is always shown; signed out, the screen shows the
  login prompt (the same way Library's account-only screens show `CallToActionSection`).
- `navigation/index.tsx`:
  - `MORE_STACK_ROUTES`: `MoreSettingsSessions: 'MoreSettingsSessions'` in alphabetical position
    among the `MoreSettings*` entries.
  - `moreTabLinkScreens`: `MoreSettingsSessions: \`more${APP_ROUTES.SETTINGS}/sessions\``.
  - `MoreStackParamList`: `MoreSettingsSessions: undefined;`.
  - A `MoreStack.Screen` after `MoreSettingsPopularityTracking` with
    `options={{ title: t('settings.account.sessions.heading') }}`.

## Catalog (`consumer` layer, all four locales)

Web plan 32 adds `settings.account.sessions` (`heading`, `description`, `this_device`,
`last_used`, `client_type_web`, `client_type_mobile`, `sign_out`, `sign_out_device_aria`,
`sign_out_error`, `sign_out_all_other`, `sign_out_all_other_body`, `sign_out_all_other_error`,
`load_error`, and toast keys mobile does not use). Mobile reuses them and adds one key at the end of
that object, for the signed-out state web never shows:

| Key | en-US | es | fr | el-GR |
| --- | --- | --- | --- | --- |
| `login_required` | Log in to see the devices signed in to your account. | Inicia sesión para ver los dispositivos con sesión iniciada en tu cuenta. | Connectez-vous pour voir les appareils connectés à votre compte. | Συνδεθείτε για να δείτε τις συσκευές που είναι συνδεδεμένες στον λογαριασμό σας. |

Insert with StrReplace beside the last sibling; never rewrite the file (**large-file-reading**).

## `vitest.config.ts`

Add to `include` in alphabetical position: `src/auth/loginWithMobileToken.test.ts` (exists but is
not included), `src/auth/mobileSessionDeviceLabel.test.ts`, `src/lib/device/deviceModel.test.ts`,
`src/screens/more/accountSessionRows.test.ts`. Extend the header comment with one clause for the
session device label and session rows.

## Maestro

### `apps/mobile/e2e/scripts/auth-sessions.js`

Host-JVM script modeled on `scripts/seed-playback-now-playing.js` (same header comment style,
`optional` helper, `API_BASE_URL`, seeded login, and `http` usage; use `http.request(url, { method:
'DELETE', headers })` for deletes). Env:

- `E2E_SESSION_ACTION` — `create-other` or `end-device`. Required.
- `E2E_OTHER_DEVICE_LABEL` — label for `create-other`. Required for that action.
- `E2E_DEVICE_LABEL_SUFFIX` — `' · iOS'` or `' · Android'`. Required for `end-device`.

Actions:

- `create-other`: `POST /auth/mobile/token` with `device_label: E2E_OTHER_DEVICE_LABEL`. With that
  access token, `GET /auth/sessions` and `DELETE` every non-current row with the same label (left
  over from an earlier failed run), so the app shows exactly one. Leave the new session open.
- `end-device`: `POST /auth/mobile/token` with `device_label: 'E2E Host'`. `GET /auth/sessions`;
  pick the non-current `mobile` row whose `device_label` ends with `E2E_DEVICE_LABEL_SUFFIX` and has
  the latest `created_at` (the app logged in during this flow, so it is the newest on its
  platform). `DELETE /auth/sessions/<id>`, then `DELETE` the host's own row (`is_current`) to clean
  up. Throw with a clear message when no row matches.

Both actions throw on any non-2xx with the status and body.

### `apps/mobile/e2e/auth-sessions.yaml`

Use `TIMEOUT_*` values from `shared/timeouts.env` (**mobile-maestro-timeouts**). Steps:

1. `shared/launch-and-connect.yaml`, then `shared/login-seeded-user.yaml`.
1. Per platform (`runFlow` with `when: platform: iOS` / `Android`, as `track.yaml` does), run the
   script with `create-other` and `E2E_OTHER_DEVICE_LABEL` `E2E Other iOS` / `E2E Other Android`.
   The iOS and Android slots run at once against one API and one seeded account, so each slot
   touches only its own labels.
1. `tab-more` → `more-settings` → `more-settings-sessions`; wait for
   `more-settings-sessions-screen` and `more-settings-session-current`; assert the other label is
   visible. Screenshot.
1. The other session guarantees `more-settings-sessions-sign-out-others` is shown. Tap it, assert
   `more-settings-sessions-sign-out-others-dialog`, screenshot, tap
   `more-settings-sessions-sign-out-others-cancel`, and assert the other label is still visible.
   Never confirm here: the iOS and Android slots share the account, so it would end the other
   slot's session mid-flow. Plan 22's API integration tests hold revoke-others.
1. `tapOn: text: "Sign Out E2E Other iOS"` (Android: `"Sign Out E2E Other Android"`, in the same
   per-platform `runFlow` blocks); the accessible name matches. Wait until the label is no longer
   visible. Screenshot.
1. `runFlow: shared/stack-back.yaml` to return to Settings. Run the script with `end-device` and `E2E_DEVICE_LABEL_SUFFIX` per platform.
1. Tap `more-settings-sessions` again. The list request gets the session-ended 401, the refresh is
   refused with the `signed_out_elsewhere` notice, and the app signs out. Wait for
   `forced-logout-modal`; assert text matching `You were signed out from another device\..*`.
   Screenshot.
1. Tap `forced-logout-dismiss`; assert `more-settings-sessions-login-required`. The tab navigator
   stays mounted through sign-out (`App.tsx` keeps `MobileTabNavigator` rendered for both auth
   states), so the sessions screen stays on top and re-renders signed out. Screenshot.

### Other e2e files

- `scripts/mobile/e2e-test.sh` `flow_needs_e2e_api`: add `auth-sessions` after `auth-logout`.
- `apps/mobile/e2e/auth-logout.yaml`: the comment above the final `assertNotVisible` says a real
  forced logout cannot be arranged. Replace that sentence: the forced-logout dialog after a server
  sign-out is covered in `auth-sessions.yaml`, and this flow checks that signing yourself out shows
  no dialog.

## Tests

- `deviceModel.test.ts`: the moved `joinDeviceModel` cases.
- `mobileSessionDeviceLabel.test.ts`: iPhone, iPad, other iOS idiom, Android with model, Android
  with empty manufacturer and model, other OS → null.
- `loginWithMobileToken.test.ts` (newly included): mock `./mobileSessionDeviceLabel.read`; the
  token request carries `device_label` when the reader returns a label and omits it when null.
  Update existing cases that the newer code broke; keep their intent.
- `accountSessionRows.test.ts`: current first, others keep server order, the two local-update
  helpers.
- Maestro `auth-sessions.yaml` as above. The screen's button wiring and states are covered there
  and need no RN render test (**mobile-test-economics**).

## Release scratchpad

```markdown
## Mobile Signed-In Devices screen

- Surfaces: mobile, i18n (consumer catalog)
- Change: Settings has a new Signed-In Devices screen listing every web and mobile session on the
  account with its device label and last-used date. Every row has a Sign Out button (this device's
  row, marked This Device, signs the app out like Logout), and Sign Out of All Other Devices ends
  every session except this one after a confirm. The app now sends a device label at login
  ("iPhone · iOS", "iPad · iOS", "<manufacturer model> · Android"). The screen needs a connection
  and is unavailable in Offline Mode. Reuses web's `settings.account.sessions.*` copy and adds
  `settings.account.sessions.login_required`. New Maestro flow
  `auth-sessions`.
- Who notices: signed-in mobile users
- Operator steps: none
```
