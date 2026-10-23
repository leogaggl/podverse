**Cursor model:** Cursor Grok 4.7 · **Reasoning:** high

# 51 — Force Logout on the management user page

The management user detail page gets one Force Logout control. Confirming it calls plan 50's
`forceLogoutUser`. Setting the user's password on the edit page already calls
`POST /users/:id/password`; this plan only changes the success sentence so the admin sees that
the user was signed out of every device.

The detail page is already limited to superusers (`users/[id]/page.tsx` redirects any other role
to the dashboard). Do not add a second role check. There is no session list and no per-session
button (R42).

## Rows

R29, R31, R42

## Runs after

50

## Files

- apps/management-web/src/app/(management)/users/[id]/UserDetailPageClient.tsx
- packages/i18n-catalog/management/originals/en-US.json
- packages/i18n-catalog/management/originals/es.json
- packages/i18n-catalog/management/originals/fr.json
- packages/i18n-catalog/management/originals/el-GR.json
- apps/management-web/e2e/users-detail-force-logout.spec.ts
- apps/management-web/e2e/helpers/routes.ts
- makefiles/local/e2e-spec-order-management-web.txt

## Before you start

Plan 50 must be done. Confirm `forceLogoutUser` is exported from
`packages/management-api-requests/src/users.ts`. The detail page imports user requests through
`apps/management-web/src/lib/requests/users.ts`, which re-exports that package. Import
`forceLogoutUser` from that app module, next to `deleteUser`. Do not import
`@podverse/management-api-requests` directly.

Do not edit `EditUserPageClient.tsx`. It already does `setSuccess(t('passwordChanged'))`. The new
sentence comes from the catalog key.

Catalog files are large. Search `passwordChanged` inside the `users` object and edit that window.
Do not rewrite a catalog file. Do not edit `overrides/` or any `compiled/` JSON.

## Decisions (transcribe, do not revisit)

- The button sits in the existing `PageHeaderActions` on the user detail page, after Billing and
  before Delete, `type="button"`, `variant="danger"`. Label is `Force Logout`.
- Confirming stays on the detail page and shows a success alert. It does not redirect to the
  users list (delete does, because the user is gone).
- The confirmation dialog copies the delete dialog on this same page: `Modal`, question paragraph,
  `ModalActions` with Cancel (`variant="secondary"`) then Confirm (`variant="primary"`). Cancel
  and Confirm use `tc('cancel')` and `tc('confirm')`. The confirm button uses `isLoading` while
  the request is in flight; Cancel is `disabled` for that time. Close uses `tc('closeModalAria')`.
- A failed request uses the page's existing full-page error branch (`setError`), same as a failed
  delete, and closes the dialog. The success sentence is not shown.
- Password success copy changes. Old English: "Password changed successfully." New English:
  "Password changed. This user was signed out of every device."

## Catalog (`packages/i18n-catalog/management/originals/`)

Add these keys on the `users` object, immediately after `failedToDelete`, in every locale file.
English chrome is title case. English sentences are sentence case. The other locales use their
own capitalization, not English title case. Placeholders: none.

`en-US.json`:

- `forceLogout`: `Force Logout`
- `confirmForceLogout`: `Sign this user out of every device? They will need to sign in again.`
- `forceLogoutConfirmAria`: `Confirm Force Logout`
- `forceLogoutSuccess`: `This user was signed out of every device.`
- `failedToForceLogout`: `Failed to sign this user out.`
- `passwordChanged`: replace with `Password changed. This user was signed out of every device.`

`es.json`:

- `forceLogout`: `Forzar cierre de sesión`
- `confirmForceLogout`: `¿Cerrar la sesión de este usuario en todos los dispositivos? Tendrá que volver a iniciar sesión.`
- `forceLogoutConfirmAria`: `Confirmar cierre de sesión forzado`
- `forceLogoutSuccess`: `Se cerró la sesión de este usuario en todos los dispositivos.`
- `failedToForceLogout`: `No se pudo cerrar la sesión de este usuario.`
- `passwordChanged`: replace with `Contraseña cambiada. Se cerró la sesión de este usuario en todos los dispositivos.`

`fr.json`:

- `forceLogout`: `Forcer la déconnexion`
- `confirmForceLogout`: `Déconnecter cet utilisateur de tous les appareils ? Il devra se reconnecter.`
- `forceLogoutConfirmAria`: `Confirmer la déconnexion forcée`
- `forceLogoutSuccess`: `Cet utilisateur a été déconnecté de tous les appareils.`
- `failedToForceLogout`: `Impossible de déconnecter cet utilisateur.`
- `passwordChanged`: replace with `Mot de passe modifié. Cet utilisateur a été déconnecté de tous les appareils.`

`el-GR.json`:

- `forceLogout`: `Αναγκαστική αποσύνδεση`
- `confirmForceLogout`: `Αποσύνδεση αυτού του χρήστη από όλες τις συσκευές; Θα χρειαστεί να συνδεθεί ξανά.`
- `forceLogoutConfirmAria`: `Επιβεβαίωση αναγκαστικής αποσύνδεσης`
- `forceLogoutSuccess`: `Αυτός ο χρήστης αποσυνδέθηκε από όλες τις συσκευές.`
- `failedToForceLogout`: `Αποτυχία αποσύνδεσης αυτού του χρήστη.`
- `passwordChanged`: replace with `Ο κωδικός άλλαξε. Αυτός ο χρήστης αποσυνδέθηκε από όλες τις συσκευές.`

## Detail page (`UserDetailPageClient.tsx`)

Anchor: the Delete `Button` inside `PageHeaderActions`, and the delete `Modal` at the bottom of
the shell.

State, next to the delete state:

- `forceLogoutConfirmOpen` boolean, default false
- `forceLogoutLoading` boolean, default false
- `success` string or null, default null

`handleForceLogout`:

- Set `forceLogoutLoading` true, `error` null, `success` null.
- `await forceLogoutUser(userId)`.
- On success: `setSuccess(t('forceLogoutSuccess'))`, close the dialog. Do not change
  `window.location`.
- On failure: `setError(t('failedToForceLogout'))`, close the dialog.
- `finally`: `setForceLogoutLoading` false.

Button, immediately before the Delete button:

```tsx
<Button
  onClick={() => {
    setForceLogoutConfirmOpen(true);
  }}
  type="button"
  variant="danger"
>
  {t('forceLogout')}
</Button>
```

Inside `ManagementPageShell`, before `DescriptionList`, when `success !== null`:

```tsx
<Alert variant="success">{success}</Alert>
```

`Alert` is already imported. Do not add styles. Do not edit the module scss.

Dialog, immediately after the delete `Modal`, same props shape (`isOpen`, `onClose`, `ariaLabel`,
`closeButtonAriaLabel`):

- `ariaLabel={t('forceLogoutConfirmAria')}`
- `onClose` sets `forceLogoutConfirmOpen` to false, and does nothing while `forceLogoutLoading`
  is true (match a dialog that must not dismiss mid-request: if `forceLogoutLoading`, return
  without closing).
- Body: `<p>{t('confirmForceLogout')}</p>`
- `ModalActions`: Cancel then Confirm, as specified above. Confirm's `onClick` is
  `() => void handleForceLogout()`.

## E2E

### Route helper

`apps/management-web/e2e/helpers/routes.ts` re-exports from `../../src/lib/routes`. Add
`buildUserPath` to that export list. It already exists in `src/lib/routes.ts`.

### Spec order

In `makefiles/local/e2e-spec-order-management-web.txt`, insert
`apps/management-web/e2e/users-detail-force-logout.spec.ts` on its own line immediately after
`apps/management-web/e2e/users-list.spec.ts`.

### Spec

New file `apps/management-web/e2e/users-detail-force-logout.spec.ts`. Follow
`users-edit-advanced-overrides.spec.ts` for sign-in and mocks:

- Seed comment: superuser `e2e-superadmin@example.com` / `Test!1Aa`. User GET and the force-logout
  POST are mocked.
- Copy that file's `MOCK_USER` (id `9001`) and `PRODUCT_MEMBERSHIP`, and its two GET route mocks
  (`**/api/v2/users/9001` for GET only, `**/products/membership` for GET only). Also mock
  `**/api/v2/users/9001/invite-link` GET to `{ invite_link: null }` so the detail page's invite
  fetch does not hit the real API.
- Sign in the same way: `ROUTES.HOME`, `#email`, `#password`, button `Sign in`, then
  `waitForURL('**/dashboard')`.
- Suite title: `Management-web user force logout`.
- Each test calls `test.setTimeout(45_000)` with the comment `Sign-in plus the user page load exceeds the default.`
- After every navigation, assert the URL and one destination element (`e2e-readability`).
- `capturePageLoad(page, testInfo, label, element)` after the assertion, passing the element the
  step checked (`e2e-screenshot-verified-element`). Import it from `./helpers/stepScreenshots`.

Tests, verbose titles:

1. `When a superuser confirms Force Logout, the user detail page stays open and says the user was signed out of every device.`
   - Count POSTs to `/users/9001/force-logout`. Fulfill 200
     `{ message: 'User signed out', sessions_ended: 2 }`.
   - `page.goto(buildUserPath('9001'))`. URL matches `/users/9001`. Heading `User detail` (level 1)
     is visible.
   - Click button `Force Logout`. Dialog named `Confirm Force Logout` is visible and shows
     `Sign this user out of every device? They will need to sign in again.`
   - Click `Confirm` inside that dialog. Success text
     `This user was signed out of every device.` is visible. URL is still `/users/9001`. The POST
     count is 1. Capture the success alert.

2. `When a superuser cancels Force Logout, no sign-out request is sent and the dialog closes.`
   - Same GET mocks. POST count starts at 0; fulfill is unnecessary if the assertion is that it
     was not called, but still install the route so a mistake fails the count instead of hitting
     the real API.
   - Open the dialog, click `Cancel`. Dialog is hidden. Button `Force Logout` is still visible.
     POST count is 0. Capture that button.

3. `When force logout fails, the page shows the failure sentence and does not show the success sentence.`
   - POST fulfills 500 `{ message: 'nope' }`.
   - Confirm. Text `Failed to sign this user out.` is visible. Text
     `This user was signed out of every device.` is not visible. The detail shell is replaced by
     that error, matching delete, so do not require the heading to remain. Capture the failure text.

4. `When a superuser saves a new password, the edit page says the user was signed out of every device.`
   - `page.goto(buildUserEditPath('9001', 'password'))` (`buildUserEditPath` is already exported
     from the e2e routes helper). URL contains `tab=password`. Heading `Edit user` (level 1) is
     visible.
   - Mock `POST **/api/v2/users/9001/password` to 200 `{ message: 'Password updated' }`. Leave
     other methods on that URL to `route.continue()` or to the GET user mock; do not let the GET
     mock answer the POST.
   - Fill `#edit-user-new-password` and `#edit-user-confirm-password` with `newpassword123`.
   - Click `Save changes`. Text
     `Password changed. This user was signed out of every device.` is visible. URL still contains
     `/users/9001/edit`. Capture that success alert.

Register the more specific Playwright routes after the broader ones so the POST handlers win.

## Release scratchpad

```markdown
## Force Logout on the management user page

- Surfaces: management-web
- Change: The user detail page has a Force Logout button. After confirmation it signs that user
  out of every device and stays on the page. Saving a new password on the edit page now says the
  user was signed out of every device.
- Who notices: superusers on the management user page
- Operator steps: none
```
