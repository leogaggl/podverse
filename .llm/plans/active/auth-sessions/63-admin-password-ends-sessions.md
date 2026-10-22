**Cursor model:** Cursor Grok 4.7 · **Reasoning:** extra high

# 63 — Setting an admin password ends that admin's sessions

When an admin password changes, the sessions of that admin end, so a stolen session cannot
outlive the new password. The signed-out browser sees the password-changed notice (plan 20's
mapping, already used by plan 62).

Two paths set a password today:

- `PATCH /admins/:id` with a `password` field. The route is signed in.
- `POST /admins/invite-link/redeem`. The route is public (token in the body, no session).

`AdminAccountService.update` throws `Superuser accounts cannot be modified via API` before it
writes, so a password patch never changes a superuser. Do not add a session call on that throw.

Deleting an admin already removes sessions by the cascade in plan 60. Do not add a session call
on `DELETE /admins/:id`, and do not clear the caller's cookie there (the caller is deleting
someone else; a superuser cannot delete themselves).

## Rows

R46

## Runs after

62

## Files

- apps/management-api/src/orm/services/adminAccount.ts
- apps/management-api/src/routes/admins.ts
- apps/management-api/openapi.yml
- apps/management-api/src/routes/admins.integration.test.ts
- apps/management-api/src/routes/admin-password-session.real.integration.test.ts
- apps/management-api/vitest.admin-session.real.config.ts

## Before you start

Plan 62 must be done. Confirm:

- `endAdminSessions({ adminAccountId, reason, exceptSessionIdText })` is exported from
  `apps/management-api/src/lib/auth/adminSessionStore.ts`.
- `AuthenticatedAdmin` has `session_id_text: string`.
- The default Vitest config stubs that store, and `vitest.admin-session.real.config.ts` includes
  `src/**/*.real.integration.test.ts` without the stub.

If any is missing, stop and report.

## Changes

### `completeSetPasswordFromToken`

Change the return type from `Promise<void>` to `Promise<{ adminAccountId: number }>`, returning
the id the function already loads (`first.admin_account_id`). The only caller is
`POST /admins/invite-link/redeem` in `apps/management-api/src/routes/admins.ts`.

### Invite redeem

After `await service.completeSetPasswordFromToken(token, password)` succeeds, and before
`res.json({ message: 'Password updated' })`:

```typescript
await endAdminSessions({
  adminAccountId: result.adminAccountId,
  reason: 'password_changed',
  exceptSessionIdText: null,
});
```

Do not catch that call. A password that changed while sessions stayed alive must not report
success. The existing invalid-token branch stays as it is, and it must not call
`endAdminSessions`.

Import `endAdminSessions` from `@management-api/lib/auth/adminSessionStore.js`. Pass the literal
`'password_changed'`. No new `@podverse/helpers` import.

### `PATCH /admins/:id`

After `const updated = await service.update(targetId, patch)` succeeds, and only when
`patch.password !== undefined`, before `res.json`:

- Actor is the target (`actor.id === targetId`): `endAdminSessions({ adminAccountId: targetId,
  reason: 'password_changed', exceptSessionIdText: actor.session_id_text })`. The browser that
  set the password stays signed in.
- Actor is someone else: `endAdminSessions({ adminAccountId: targetId, reason:
  'admin_password_set', exceptSessionIdText: null })`.

A patch that does not include `password` does not call `endAdminSessions`. Do not catch the
call. The existing superuser-modification error still returns 403 and does not end sessions.

## OpenAPI

Find each operation by `operationId`.

- `managementPatchAdminsId`: extend `description` with: "When the body includes a password, every
  other session of that admin ends. When another admin sets the password, every session of the
  target ends. Signed-in browsers are told the password changed."
- `managementPostAdminsInviteLinkRedeem`: extend `description` with: "On success every session of
  that admin ends; signed-in browsers are told the password changed."

## Tests

**`admins.integration.test.ts`** (stubbed store). Import the stub from
`apps/management-api/src/test/adminSessionStoreStub.ts`. `mockClear()` `endAdminSessions` in a
`beforeEach` of the describes you touch.

- The invite-redeem success case expects `endAdminSessions` called with
  `{ adminAccountId, reason: 'password_changed', exceptSessionIdText: null }` using the id the
  service returned. The invalid-token case expects it not to have been called. If the success
  case mocks `completeSetPasswordFromToken`, make the mock resolve `{ adminAccountId: <the id
  the test already uses> }`.
- A `PATCH /admins/:id` success that sends `password` and whose mocked actor id equals the
  target expects `reason: 'password_changed'` and `exceptSessionIdText` equal to the actor's
  session id (`pvMgtSes001` from plan 62's auth header, once that header is what this file
  signs — if this file signs its own JWT, add `sid` the same way plan 62's `adminAuthHeaders`
  does, or the request is 401).
- A `PATCH` success that sends `password` for a different admin id expects
  `reason: 'admin_password_set'` and `exceptSessionIdText: null`.
- A `PATCH` success with no `password` expects `endAdminSessions` not to have been called.

Read the file before editing. It mocks `AdminAccountService`. Extend the mock so `update` and
`completeSetPasswordFromToken` return what these cases need. Do not rewrite unrelated cases.

**`admin-password-session.real.integration.test.ts`** (real store; picked up by the real Vitest
config). Seed an admin the way plan 62's real file does. Cases:

- Two web logins and one mobile token pair, then `POST /admins/invite-link/redeem` with a token
  row inserted the way `upsertInviteToken` writes it. All three `admin_session` rows have
  `revoked_reason = 'password_changed'`. Each old cookie on `GET /auth/me` is 401
  `{ code: 'session_ended', notice: 'password_changed' }`. The old refresh token on
  `/auth/mobile/refresh` is 401 with the same notice. A login with the new password succeeds.
- Two web logins for admin B. A superuser (role id 1; create through `AdminAccountService` and
  set `admin_account_role_id` to 1 if `create` leaves it at the default 2) patches B's password.
  Both of B's rows have `revoked_reason = 'admin_password_set'`. The superuser's own session
  still works.

## Release scratchpad

```markdown
## Changing an admin password ends that admin's sessions

- Surfaces: management-api
- Change: redeeming an admin invite (`POST /admins/invite-link/redeem`) ends every session of
  that admin. An admin setting their own password ends every other session and keeps the
  browser that sent the change. Another admin setting the password ends every session of the
  target. Those browsers get the `password_changed` notice on the next request.
- Who notices: an admin whose password was just set is signed out on other devices and signs in
  with the new password.
- Operator steps: none
```
