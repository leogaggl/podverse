**Cursor model:** Cursor Grok 4.7 · **Reasoning:** extra high

# 50 — Admin force-logout and admin password set end every user session

A superuser can end every session of one app account, and setting that account's password does the
same. Both call plan 10's `revokeAccountSessions` with `exceptSessionIdText: null`. The signed-out
device already learns why from plan 20: `admin_force_logout` shows "An administrator signed you
out", and `admin_password_set` shows "Your password was changed". This plan does not add a session
list, a per-session control, or any change to admin-account logins (area F).

Operator answer (00-REQUEST.md): admins end all of an account's sessions only, with one Force
Logout on the management-web user page (plan 51). An admin setting a user's password also ends all
of that user's sessions.

## Rows

R29, R31, R42

## Runs after

20

## Files

- apps/management-api/src/lib/endUserAccountSessions.ts
- apps/management-api/src/routes/users.ts
- apps/management-api/src/routes/users.integration.test.ts
- apps/management-api/openapi.yml
- packages/management-api-requests/src/users.ts

## Before you start

Plans 10 and 20 must be done. Confirm these exist before editing:

- `@podverse/orm` exports `revokeAccountSessions({ accountId, reason, exceptSessionIdText, now })`
  returning a number (plan 10). The management API process already calls `bindORMContext` in
  `apps/management-api/src/index.ts`, so this function writes the app database.
- The revoke reasons `admin_force_logout` and `admin_password_set` are in
  `ACCOUNT_SESSION_REVOKE_REASONS` (`packages/helpers/src/lib/accountSession.ts`).

If either is missing, stop and report. Do not write a SQL substitute and do not import anything
from `apps/api`.

`apps/management-api/src/routes/users.ts` and `apps/management-api/openapi.yml` are large. Search
the anchors below and edit those windows. Do not read either file end to end.

## Decisions (transcribe, do not revisit)

- One route, `POST /users/:id/force-logout`. No body. It ends every session of that `account` id.
  There is no admin endpoint to list sessions or end one session (R42).
- `exceptSessionIdText` is always `null`. An admin login is a different account, so there is no
  "current user session" to keep.
- A user who exists and has zero active sessions still gets 200 with `sessions_ended: 0`. Repeat
  calls stay 200. 404 is only for a missing account.
- The password route still returns `{ message: 'Password updated' }`. It does not grow a count.
  Force-logout returns `{ message: 'User signed out', sessions_ended: <number> }`.
- If `revokeAccountSessions` throws, the handler's existing `catch` calls `next(error)`. Do not
  catch it and still send 200. A password change that did not end sessions must not report success.
- `DELETE /users/:id`, `POST /users` (create), and the invite-link routes do not call the helper.
  Deleting the account already removes its session rows (plan 10's `ON DELETE CASCADE`). Creating
  a user, including one created with a password, does not end sessions.

## Helper (`apps/management-api/src/lib/endUserAccountSessions.ts`)

New file. This is the only management-api call into `revokeAccountSessions`. Both routes below
use it, and a later realtime hook publishes from here rather than from the routes.

```typescript
import { revokeAccountSessions } from '@podverse/orm';

type AdminEndUserSessionsReason = 'admin_force_logout' | 'admin_password_set';

export async function endUserAccountSessions(
  accountId: number,
  reason: AdminEndUserSessionsReason,
): Promise<number> {
  return revokeAccountSessions({
    accountId,
    reason,
    exceptSessionIdText: null,
    now: new Date(),
  });
}
```

No re-export file. No comment that names a plan. Import it from the routes as
`import { endUserAccountSessions } from '@management-api/lib/endUserAccountSessions.js';`
(Tier A `.js` specifier).

## Routes (`apps/management-api/src/routes/users.ts`)

Anchor: `router.post('/:id/password'`.

### Password

Inside that handler, after the `DELETE FROM account_set_password` query and before
`res.json({ message: 'Password updated' })`, add:

```typescript
await endUserAccountSessions(id, 'admin_password_set');
```

Leave the response body as it is. Leave the 400 and 404 branches as they are; they return before
this line, so a bad password or a missing user does not end anyone's sessions.

### Force logout

Insert this route immediately after the password route (before `router.get('/:id/invite-link'`).
Same middleware and the same id / existence checks as the password route. The existence query is
the same SQL: `SELECT id FROM account WHERE id = $1` on `AppDbDataSourceRead`.

```typescript
router.post('/:id/force-logout', ensureAuthenticated, requireSuperuser, async (req, res, next) => {
  try {
    const id = parseIdParam(req.params.id);
    if (id === null) {
      res.status(400).json({ message: 'Invalid id' });
      return;
    }

    const existing = await AppDbDataSourceRead.query(`SELECT id FROM account WHERE id = $1`, [id]);
    if (existing.length === 0) {
      res.status(404).json({ message: 'User not found' });
      return;
    }

    const sessionsEnded = await endUserAccountSessions(id, 'admin_force_logout');
    res.json({ message: 'User signed out', sessions_ended: sessionsEnded });
  } catch (error) {
    next(error);
  }
});
```

Do not read a body. Ignore one if the client sends it.

## Request helper (`packages/management-api-requests/src/users.ts`)

Anchor: `export async function deleteUser`. Add this function immediately after `deleteUser`.
The package barrel already does `export * from './users.js'`, so do not edit the barrel.

```typescript
export async function forceLogoutUser(
  id: number,
  jwt?: string,
): Promise<{ message: string; sessions_ended: number }> {
  const service = new ManagementApiRequestService({ jwt });
  return service.apiRequest<{ message: string; sessions_ended: number }>({
    path: `/users/${id}/force-logout`,
    method: 'POST',
  });
}
```

## OpenAPI (`apps/management-api/openapi.yml`)

Anchors: `operationId: managementPostUsersIdPassword`, and schema key `MessageResponse`.

### Password operation

On `managementPostUsersIdPassword` (`/users/{id}/password`), replace the `description` string with:

`Superuser only. Sets the account password and ends every session of that account. Signed-in devices are told the password changed.`

Do not change its request or response schemas.

### New path

Insert path key `/users/{id}/force-logout` immediately before `/users/{id}/password`. Copy the
`security`, path `id` parameter, and 400/401/403/404/500 responses from the password operation.
No `requestBody`.

- `operationId`: `managementPostUsersIdForceLogout` (must stay unique)
- `tags`: `[users]`
- `summary`: `POST /users/{id}/force-logout`
- `description`: `Superuser only. Ends every session of the account. Signed-in devices are told an administrator signed them out. An account with no sessions still returns 200 and sessions_ended 0.`
- 200 schema: new component `UserForceLogoutResponse`, with one example:

```yaml
UserForceLogoutResponse:
  type: object
  required:
    - message
    - sessions_ended
  properties:
    message:
      type: string
      example: User signed out
    sessions_ended:
      type: integer
      minimum: 0
      example: 2
```

Add that schema immediately after `MessageResponse`. The 200 response uses `$ref` to it and
includes the example value `{ message: User signed out, sessions_ended: 2 }`.

## Tests

`apps/management-api/src/routes/users.integration.test.ts` already spies `@podverse/orm` named
exports (`hashPassword`). Add the same kind of spy for `revokeAccountSessions`.

In the existing `beforeEach`, after the other spy setup:

- `vi.spyOn(PodverseOrm, 'revokeAccountSessions')`
- `mockReset()` it, then `mockResolvedValue(0)`

Hold these behaviors. The app-database query mocks stay as they are; this call does not go
through `AppDbDataSourceReadWrite.query`.

`describe('POST /users/:id/password')` (anchor that heading):

- The existing success case also expects `revokeAccountSessions` to have been called once with
  `{ accountId: 1, reason: 'admin_password_set', exceptSessionIdText: null, now: expect.any(Date) }`.
  The response stays `{ message: 'Password updated' }`.
- Invalid password (`'short'`) does not call it.
- Add: unknown id returns 404 and does not call it (existence read resolves `[]`).
- Add: the spy rejects. Existence read, hash, and both writes are mocked as in the success case.
  Status is 500. Body `message` is not `'Password updated'`.

`describe('DELETE /users/:id')`, the success case: `revokeAccountSessions` was not called.

`describe('POST /users')`, the case "creates a user with both username and email plus password":
`revokeAccountSessions` was not called.

New `describe('POST /users/:id/force-logout')`:

- 401 with no `Authorization` header.
- Superuser, existence read `[{ id: 1 }]`, spy resolves `2`: status 200,
  `{ message: 'User signed out', sessions_ended: 2 }`, and the spy was called once with
  `{ accountId: 1, reason: 'admin_force_logout', exceptSessionIdText: null, now: expect.any(Date) }`.
- Superuser, spy resolves `0`: status 200 and `sessions_ended` is 0.
- Unknown id: 404, spy not called.
- Id `abc`: 400, spy not called.
- Spy rejects: 500, and the body has no `sessions_ended`.

`describe('Authz: non-superuser cannot access user endpoints')`: add a case that
`POST ${usersBase}/1/force-logout` with `adminAuthHeaders()` returns 403 and does not call the spy.

Do not add a second test file. The SQL of `revokeAccountSessions` is already covered by plan 10.

## Release scratchpad

```markdown
## Admin force-logout ends every session of a user

- Surfaces: management-api
- Change: A superuser `POST /users/:id/force-logout` ends every session of that account and
  returns how many sessions ended. `POST /users/:id/password` now does the same after the password
  is saved. Signed-out devices are told an administrator signed them out, or that the password
  changed. Deleting a user still removes sessions with the account.
- Who notices: superusers calling the management API; a user who is force-logged-out or whose
  password an admin sets is signed out on every device on the next request
- Operator steps: none
```
