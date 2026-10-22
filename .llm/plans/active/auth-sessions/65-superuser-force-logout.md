**Cursor model:** Cursor Grok 4.7 · **Reasoning:** extra high

# 65 — Superuser force-logout of another admin

A superuser can end every session of another admin from that admin's detail page. One button,
"Force Logout". It ends all of that admin's sessions. It does not end a single session, and it
does not appear on the signed-in superuser's own page.

The signed-out admin sees "An administrator signed you out" (notice `admin_force_logout`, plan
62). Plan 66 is what paints that sentence on the login page.

## Rows

R46

## Runs after

64

Plans 63 and 64 also edit `apps/management-api/openapi.yml`. Plan 64 does not edit `admins.ts`.

## Files

- apps/management-api/src/routes/admins.ts
- apps/management-api/openapi.yml
- packages/management-api-requests/src/admins.ts
- apps/management-web/src/lib/requests/admins.ts
- apps/management-web/src/app/(management)/admins/[id]/AdminDetailPageClient.tsx
- packages/i18n-catalog/management/originals/en-US.json
- packages/i18n-catalog/management/originals/es.json
- packages/i18n-catalog/management/originals/fr.json
- packages/i18n-catalog/management/originals/el-GR.json
- apps/management-web/e2e/admins-force-logout.spec.ts
- apps/management-api/src/routes/admins.integration.test.ts
- apps/management-api/src/routes/admin-force-logout.real.integration.test.ts

`apps/management-web/src/lib/requests/admins.ts` only re-exports `@podverse/management-api-requests`.
If the new function is exported from that package's `admins.ts`, which `index.ts` already
re-exports, the web file needs no edit. Confirm and skip it when that is true.

## API

`POST /admins/:id/force-logout` in `apps/management-api/src/routes/admins.ts`, next to
`DELETE /:id`. Middleware: `ensureAuthenticated`, then `requireSuperuser` from
`@management-api/lib/authz/requireSuperuser.js`.

- No `req.user` → 401 `{ message: 'Authentication required' }` (requireSuperuser already does
  this when it runs first; keep that order).
- Role is not `superuser` → 403 `{ message: 'Superuser only' }`.
- Target id is not an integer → 400 `{ message: 'Invalid id' }`.
- Target id equals `req.user.id` → 400 `{ message: 'Cannot force logout your own account' }`.
  A superuser signs out their own browser with logout.
- Target admin does not exist → 404 `{ message: 'Admin account not found' }`. Load with
  `AdminAccountService.getWithRoleAndPermissions`. A superuser target is allowed. Do not apply
  `assertNonSuperuserCannotTargetSuperuser`; `requireSuperuser` already rejected everyone else.
- Otherwise `endAdminSessions({ adminAccountId: targetId, reason: 'admin_force_logout',
  exceptSessionIdText: null })`, then 200 `{ revoked_count: number }`. Zero is success (the
  admin had no active sessions).

Do not go through `AdminAccountService.update`. That function rejects superuser targets, and
this route must be able to sign a superuser out.

## Request helper

In `packages/management-api-requests/src/admins.ts`, next to `deleteAdmin` (match that function's
style):

```typescript
export async function forceLogoutAdmin(
  service: ManagementApiRequestService,
  id: number
): Promise<{ revoked_count: number }> {
  return service.apiRequest<{ revoked_count: number }>({
    path: `/admins/${id}/force-logout`,
    method: 'POST',
  });
}
```

If `deleteAdmin` builds the service inside the function instead of taking one, follow
`deleteAdmin` exactly and only change the path and the response type. Read the file first.

## Management-web

`AdminDetailPageClient`. Show the button only when `user.role === 'superuser'` and
`admin.id !== user.id`. Show it when the target is a superuser. Do not reuse `canDeleteRow` or
`canEdit`; those hide superuser targets and depend on `admins` delete permission.

Place a `Button` `variant="danger"` in the existing `PageHeaderActions` (the one with Edit and
Delete). Label `t('forceLogout')`.

Confirm with a `Modal` copied from the delete modal on the same page: `ariaLabel` from
`t('forceLogoutConfirmAria')`, `closeButtonAriaLabel={tc('closeModalAria')}`, body
`t('confirmForceLogout')`, cancel `tc('cancel')`, confirm button text `t('forceLogout')` and
`variant="danger"`. While the request runs, `isLoading` on the confirm button.

On success, close the modal and set a success `Alert` to `t('forceLogoutSuccess')`. Stay on the
page. On failure, set the existing `error` state to `t('forceLogoutFailed')` and close the modal.
The Alert is the announcement; do not add a second live region.

Call `forceLogoutAdmin` through the same request module the page uses for `deleteAdmin`.

## Copy

Add these keys under `admins` in the management catalog. English is title case for the button
and sentence case for the sentences. The other locales use each language's own capitalization.
Do not edit `overrides/`. Run `npm run i18n:compile` so management-web picks the keys up. Do not
commit `compiled/` if it is gitignored.

| Key | en-US | es | fr | el-GR |
| --- | --- | --- | --- | --- |
| `admins.forceLogout` | Force Logout | Cierre de sesión forzado | Déconnexion forcée | Εξαναγκασμένη αποσύνδεση |
| `admins.confirmForceLogout` | Sign this admin out of every device? | ¿Cerrar la sesión de este administrador en todos los dispositivos? | Déconnecter cet administrateur de tous les appareils ? | Να αποσυνδεθεί αυτός ο διαχειριστής από όλες τις συσκευές; |
| `admins.forceLogoutSuccess` | This admin was signed out of every device. | Se cerró la sesión de este administrador en todos los dispositivos. | Cet administrateur a été déconnecté de tous les appareils. | Αυτός ο διαχειριστής αποσυνδέθηκε από όλες τις συσκευές. |
| `admins.forceLogoutFailed` | Could not sign this admin out. | No se pudo cerrar la sesión de este administrador. | Impossible de déconnecter cet administrateur. | Δεν ήταν δυνατή η αποσύνδεση αυτού του διαχειριστή. |
| `admins.forceLogoutConfirmAria` | Confirm force logout | Confirmar cierre de sesión forzado | Confirmer la déconnexion forcée | Επιβεβαίωση εξαναγκασμένης αποσύνδεσης |

## OpenAPI

`POST /admins/{id}/force-logout`, `operationId: managementPostAdminsIdForceLogout`, `tags` the
same as `DELETE /admins/{id}`, security the same bearer-plus-cookie list. Description: "Ends
every session of this admin. Superuser only. Cannot target the caller. The signed-out admin is
told an administrator signed them out."

- 200: object, required `revoked_count`, integer, minimum 0.
- 400: `ErrorResponse` (own account, or an id that is not an integer).
- 401, 403 `AuthorizationErrorResponse`, 404 `NotFoundErrorResponse`, 500.

## Tests

**`admins.integration.test.ts`** (stub). `endAdminSessions` is `mockClear()`'d.

- Superuser `POST /admins/2/force-logout` → 200 `{ revoked_count: 0 }` (stub returns 0) and
  `endAdminSessions` called with `{ adminAccountId: 2, reason: 'admin_force_logout',
  exceptSessionIdText: null }`. Use whatever non-self id the file's admin mock already returns;
  if it only knows id 1, extend the mock with a second admin.
- The same call with the caller's own id → 400, and `endAdminSessions` was not called.
- A non-superuser token → 403, and `endAdminSessions` was not called.
- An unknown id → 404, and `endAdminSessions` was not called.
- No auth → 401.

The file signs JWTs for `ensureAuthenticated`. Those JWTs need `sid` and
`scope: 'podverse_management_mobile'` with `token_use: 'access'`, or plan 62's check rejects
them. Match `adminAuthHeaders` from `auth.integration.test.ts` after plan 62.

**`admin-force-logout.real.integration.test.ts`** (real store). A superuser and another admin,
each with a web login. The superuser's POST returns `{ revoked_count: 1 }`. The other admin's
cookie on `GET /auth/me` is 401 `{ code: 'session_ended', notice: 'admin_force_logout' }`. The
superuser's cookie still returns 200.

**E2E** `apps/management-web/e2e/admins-force-logout.spec.ts`. Follow
`admins-detail-invite.spec.ts`: real sign-in as `e2e-superadmin@example.com`, route-mock
`GET /api/v2/admins` and `GET /api/v2/admins/7001` with a row whose id is 7001 (not the signed-in
user), and mock `POST /api/v2/admins/7001/force-logout` to 200 `{ revoked_count: 1 }`.

- The detail page shows a button named `Force Logout`.
- Activating it opens a dialog whose name is `Confirm force logout`, with the sentence
  `Sign this admin out of every device?`.
- Confirming sends the POST and shows `This admin was signed out of every device.`
- Use `capturePageLoad` from `e2e/helpers/stepScreenshots` on the button, and
  `actionAndCapture` if that helper exists in the same module; otherwise `capturePageLoad`
  again on the success text. Do not raise the test timeout.

Describe title: "Force logout on admin detail". The test title is a full sentence.

## Release scratchpad

```markdown
## Superuser can force-logout another admin

- Surfaces: management-api, management-web
- Change: a superuser on another admin's detail page gets Force Logout. It ends every session
  of that admin. The control is absent on the superuser's own page, and the API rejects that
  case. The signed-out admin gets the `admin_force_logout` notice.
- Who notices: superusers managing other admins; an admin who is force-logged out
- Operator steps: none
```
