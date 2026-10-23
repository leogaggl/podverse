**Cursor model:** Cursor Grok 4.7 · **Reasoning:** high

# 32 — Web: signed-in devices in Settings

Settings → Account gains a **Signed-In Devices** section, per operator answer 2: "full session
list on web and mobile, with device label, last used, a sign-out button per session, and "Sign Out
of All Other Devices"." It is built on plan 22's endpoints and request helpers (R27).

## Rows

R27

## Runs after

22, 31

## Files

- apps/web/src/components/Settings/Panels/SettingsAccount/SettingsSessions.tsx
- apps/web/src/components/Settings/Panels/SettingsAccount/ModalSignOutOtherDevices.tsx
- apps/web/src/components/Settings/Panels/SettingsAccount/SettingsAccount.tsx
- apps/web/src/styles/components/Settings/Panels/SettingsAccount/SettingsSessions.module.scss
- apps/web/src/lib/auth/signOutThisBrowser.ts
- apps/web/src/components/NavBar/NavBar.tsx
- packages/i18n-catalog/consumer/originals/en-US.json
- packages/i18n-catalog/consumer/originals/es.json
- packages/i18n-catalog/consumer/originals/fr.json
- packages/i18n-catalog/consumer/originals/el-GR.json
- apps/web/e2e/helpers/accountSessions.ts
- apps/web/e2e/settings-account-sessions.spec.ts
- makefiles/local/e2e-spec-order-web.txt

## Before you start

Confirm, and stop and report if any is missing:

- `ApiRequestService` has `reqAuthSessions()`, `reqAuthSessionRevoke(sessionIdText)`, and
  `reqAuthSessionsRevokeOthers()` (plan 22).
- `DTOAccountSession` and `AccountSessionClientType` are exported from `@podverse/helpers`
  (plans 10 and 22). `AccountSessionClientType` is `'web' | 'mobile'`.
- `apps/web/e2e/helpers/accountSessions.ts` has `loginSessionsUser`, `endOtherSessions`,
  `newOtherDeviceRequest`, and `FIREFOX_WINDOWS_USER_AGENT` (plans 30 and 31).

## What the user sees

Inside the Account tab, between **Download My Data** and **Delete Account**, each pair separated
by `<Divider withSpacing />` as the other sections are:

- Heading **Signed-In Devices** (`h3`) and one sentence of description.
- A list, this browser first, then the rest in the API's order (most recently used first). Each
  row shows:
  - **Name:** `device_label`, or when it is null, **Web Browser** or **Mobile App** by
    `client_type`.
  - **Second line:** **This Device** for the current session; otherwise **Last Used <date>**,
    with the date from `formatDateAbbrev(row.last_seen_at, locale)` (`@podverse/helpers`). The
    API keeps `last_seen_at` to within a day, so the date is shown without a time.
  - **Sign Out** button. Its accessible name includes the device ("Sign Out Firefox · Windows"),
    since every row has one.
- **Sign Out of All Other Devices** under the list, shown only when the list has another row.
  It opens a confirm modal.
- **Loading:** `LoadingSpinner` (`ariaLabel={tMisc('loading')}`, `size="medium"`), as in
  `SettingsRemovedContent.tsx`. **Error:** a `role="alert"` sentence and a **Try Again** button
  (`tMisc('try_again')`) that reloads the list.

## Behavior

- **Load** on mount with `getApiRequestService().reqAuthSessions()`, using the `LoadState` union
  and `cancelled` flag pattern from `SettingsRemovedContent.tsx`.
- **Sign Out on another row:** `reqAuthSessionRevoke(row.id_text)`. Success removes the row and
  shows `showToast(t('sign_out_success'), 'success')`. A 404 (`getStatusCodeFromError` from
  `@podverse/helpers-requests`, or `error.response.status` through a guard) means it already
  ended: remove the row with no toast. Any other error: `handleRateLimitAlert(error, locale,
  tMisc)` first, as `SettingsAccount.tsx` does; when it returns false, `showToast(t('sign_out_error'),
  'error')`.
- **Sign Out on this browser's row:** `signOutThisBrowser(loggedInAccount?.id_text)` (below), the
  same as the navbar's Logout. No notice follows: plan 20 gives a self sign-out none.
- **Sign Out of All Other Devices:** the modal's confirm calls `reqAuthSessionsRevokeOthers()`.
  Success closes the modal, keeps only the current row, and shows
  `showToast(t('sign_out_all_other_success'), 'success')`. Error: rate-limit check, then
  `showToast(t('sign_out_all_other_error'), 'error')`, and the modal stays open.
- **In-flight guards** inside the handlers, not only `disabled` (**input-rate-control**): a
  `Set<string>` ref of session ids being ended (also drives that row's button `isLoading` and
  `disabled` through state), and a boolean ref for the revoke-others call.

## `apps/web/src/lib/auth/signOutThisBrowser.ts`

```typescript
/** Clears this browser's Add by RSS credentials for the account, ends the session, and reloads. */
export async function signOutThisBrowser(accountIdText: string | null | undefined): Promise<void>;
```

Body: `await clearAddByRSSCredentialsForSignOut(accountIdText)`; `try { await
getApiRequestService().reqAuthLogout(); } catch { … }`, logging nothing (the cookie may already be
gone); then `window.location.reload()`. Replace the body of `handleLogout` in
`apps/web/src/components/NavBar/NavBar.tsx` with `await
signOutThisBrowser(loggedInAccount?.id_text);` and drop imports it no longer needs.

## `SettingsSessions.tsx`

- `'use client'`. `useTranslations('settings.account.sessions')` as `t`, plus `misc`;
  `useLocale()`; `useAccount()` for `loggedInAccount`.
- Module-level, exhaustive over the union with no `default`:

  ```typescript
  function clientTypeLabelKey(clientType: AccountSessionClientType): 'client_type_web' | 'client_type_mobile' {
    switch (clientType) {
      case 'web':
        return 'client_type_web';
      case 'mobile':
        return 'client_type_mobile';
    }
  }
  ```

- Markup inside `SettingsSection`: `<h3 id="settings-sessions-heading">`, the description `<p>`,
  then `<ul className={styles.rows} aria-labelledby="settings-sessions-heading">`. Each `<li
  className={styles.row}>` holds `<div className={styles.rowText}>` (name in `<span
  className={styles.name}>`, second line in `<span className={styles.meta}>`) and the `Button`
  (`type="button"`, `variant="secondary"`, `aria-label={t('sign_out_device_aria', { device:
  name })}`, text `t('sign_out')`).
- The revoke-others `Button` (`type="button"`, `variant="secondary"`) sits after the list and opens
  `ModalSignOutOtherDevices`.
- Render it from `SettingsAccount.tsx` as described above.

## `ModalSignOutOtherDevices.tsx`

Follow `ModalDeleteAccount.tsx`: props `{ isOpen: boolean; isSubmitting: boolean; onClose: () =>
void; onConfirm: () => void }`. `header` and `ariaLabel` = `t('sign_out_all_other')`,
`closeButtonAriaLabel={tMisc('close_modal')}`. `Modal.Body` holds `<p>{t('sign_out_all_other_body')}</p>`
and `Modal.Actions` with **Cancel** (`variant="secondary"`, `tMisc('cancel')`) then **Sign Out**
(`variant="primary"`, `t('sign_out')`, `isLoading` and `disabled` while submitting), Cancel first
in DOM order (**form-primary-actions-row**, **modal-layout-contract**).

## `SettingsSessions.module.scss`

Tokens only, no `var()` fallbacks (**css-custom-properties-no-var-fallbacks**):

- `.rows`: `list-style: none; margin: var(--spacing-lg) 0; padding: 0; display: flex;
  flex-direction: column; gap: var(--spacing-md);`
- `.row`: `display: flex; align-items: center; justify-content: space-between; gap:
  var(--spacing-lg);`
- `.rowText`: `display: flex; flex-direction: column; gap: var(--spacing-sm); min-width: 0;`
- `.name`: `overflow-wrap: anywhere;`
- `.meta`: `color: var(--text-color-secondary);`

All four tokens are defined in `packages/ui/src/styles/_variables-root.scss`.

## i18n (consumer layer)

In each `packages/i18n-catalog/consumer/originals/<locale>.json`, add a `sessions` object inside
`settings.account`, directly after `download_my_data_error`. StrReplace beside the sibling; never
rewrite the file. Mobile (plans 40–49) may reuse these keys.

| Key | en-US | es | fr | el-GR |
| --- | --- | --- | --- | --- |
| `heading` | Signed-In Devices | Dispositivos con sesión iniciada | Appareils connectés | Συνδεδεμένες συσκευές |
| `description` | These devices are signed in to your account. Signing one out ends its session right away. | Estos dispositivos tienen sesión iniciada en tu cuenta. Cerrar la sesión de uno la termina de inmediato. | Ces appareils sont connectés à votre compte. En déconnecter un met fin à sa session immédiatement. | Αυτές οι συσκευές είναι συνδεδεμένες στον λογαριασμό σας. Η αποσύνδεση μιας συσκευής τερματίζει αμέσως τη συνεδρία της. |
| `this_device` | This Device | Este dispositivo | Cet appareil | Αυτή η συσκευή |
| `last_used` | Last Used {date} | Último uso: {date} | Dernière utilisation : {date} | Τελευταία χρήση: {date} |
| `client_type_web` | Web Browser | Navegador web | Navigateur web | Πρόγραμμα περιήγησης |
| `client_type_mobile` | Mobile App | Aplicación móvil | Application mobile | Εφαρμογή για κινητά |
| `sign_out` | Sign Out | Cerrar sesión | Se déconnecter | Αποσύνδεση |
| `sign_out_device_aria` | Sign Out {device} | Cerrar sesión en {device} | Déconnecter {device} | Αποσύνδεση {device} |
| `sign_out_success` | Device Signed Out | Sesión del dispositivo cerrada | Appareil déconnecté | Η συσκευή αποσυνδέθηκε |
| `sign_out_error` | Could not sign out that device. Please try again. | No se pudo cerrar la sesión de ese dispositivo. Inténtalo de nuevo. | Impossible de déconnecter cet appareil. Veuillez réessayer. | Δεν ήταν δυνατή η αποσύνδεση αυτής της συσκευής. Δοκιμάστε ξανά. |
| `sign_out_all_other` | Sign Out of All Other Devices | Cerrar sesión en todos los demás dispositivos | Déconnecter tous les autres appareils | Αποσύνδεση από όλες τις άλλες συσκευές |
| `sign_out_all_other_body` | Every other device signed in to your account will be signed out. This device stays signed in. | Se cerrará la sesión en todos los demás dispositivos conectados a tu cuenta. Este dispositivo seguirá con la sesión iniciada. | Tous les autres appareils connectés à votre compte seront déconnectés. Cet appareil reste connecté. | Όλες οι άλλες συσκευές που είναι συνδεδεμένες στον λογαριασμό σας θα αποσυνδεθούν. Αυτή η συσκευή παραμένει συνδεδεμένη. |
| `sign_out_all_other_success` | Other Devices Signed Out | Sesión cerrada en los demás dispositivos | Autres appareils déconnectés | Οι άλλες συσκευές αποσυνδέθηκαν |
| `sign_out_all_other_error` | Could not sign out your other devices. Please try again. | No se pudo cerrar la sesión en tus otros dispositivos. Inténtalo de nuevo. | Impossible de déconnecter vos autres appareils. Veuillez réessayer. | Δεν ήταν δυνατή η αποσύνδεση των άλλων συσκευών σας. Δοκιμάστε ξανά. |
| `load_error` | Could not load your signed-in devices. | No se pudieron cargar tus dispositivos con sesión iniciada. | Impossible de charger vos appareils connectés. | Δεν ήταν δυνατή η φόρτωση των συνδεδεμένων συσκευών σας. |

## Tests

**E2E** — `apps/web/e2e/settings-account-sessions.spec.ts`, on the sessions account.

Add to `apps/web/e2e/helpers/accountSessions.ts`:

- `loginSessionsUserMobile(request: APIRequestContext, deviceLabel: string): Promise<string>` —
  `POST /auth/mobile/token` with email, password, and `device_label`; returns `access_token`.

Each test starts with `loginSessionsUser(page.request)` and `endOtherSessions(page.request)`,
then signs in a Firefox-on-Windows device (`newOtherDeviceRequest`) and a mobile device
(`loginSessionsUserMobile(otherRequest, 'E2E Phone')` on a fresh `playwright.request.newContext()`),
then `page.goto('/settings?tab=account')`. Dispose request contexts at the end of each test.

1. **The Account tab lists every signed-in device with this browser first.** The "Signed-In
   Devices" heading is visible; the list has three items; the first contains "This Device"; one
   item contains "Firefox · Windows" and "Last Used"; one contains "E2E Phone" and "Last Used".
   Capture the list as the verified element.
1. **Signing out one other device ends only that session.** Click the button named "Sign Out
   Firefox · Windows"; the toast "Device Signed Out" appears; the list has two items and no
   "Firefox · Windows". `GET /auth/me` on the Firefox request context is 401 with body `code`
   `session_ended` and `notice` `signed_out_elsewhere`. `GET /auth/me` with the phone's
   `Authorization: Bearer` access token is 200.
1. **Sign Out of All Other Devices keeps only this browser.** Click "Sign Out of All Other
   Devices"; a dialog of that name opens (capture it); click its "Sign Out"; the toast "Other
   Devices Signed Out" appears; the list has one item, containing "This Device"; the "Sign Out of
   All Other Devices" button is gone. Both other devices get 401 with `notice`
   `signed_out_elsewhere` on `GET /auth/me`.
1. **Signing out this browser from the list signs it out with no notice.** Click the Sign Out
   button in the "This Device" row; after the reload the navbar shows Login, there is no `jwt`
   cookie, and no "You've Been Signed Out" dialog is visible.

Add the spec to `makefiles/local/e2e-spec-order-web.txt` directly after
`apps/web/e2e/web-session-ended-notice.spec.ts`.

## Release scratchpad

```markdown
## Signed-in devices on web Settings

- Surfaces: web, i18n catalogs (consumer)
- Change: Settings → Account has a Signed-In Devices section listing every session of the
  account: device name (browser and OS, or the app's device label), "This Device" or the date it
  was last used, and a Sign Out button per device. "Sign Out of All Other Devices" ends every
  session but this one after a confirmation. Signed-out devices see "You were signed out from
  another device." The navbar's Logout and the list's own row share one sign-out routine.
- Who notices: signed-in web users
- Operator steps: none
```
