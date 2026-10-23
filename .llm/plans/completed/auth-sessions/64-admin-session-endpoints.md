**Cursor model:** Cursor Grok 4.7 · **Reasoning:** extra high

# 64 — Admin session list and sign-out endpoints

Three endpoints let a signed-in admin see their own active sessions and end them: list, end one,
and end every other session. There is no management-web screen for this list in this set. The
device-list screen is for the main web app and the mobile app. A superuser ending another
admin's sessions is plan 65, and it does not use these routes.

The device that was signed out gets the `signed_out_elsewhere` notice on its next request
(plan 62).

## Rows

R46

## Runs after

63

Both edit `apps/management-api/openapi.yml`.

## Files

- apps/management-api/src/lib/auth/adminSessionHttp.ts
- apps/management-api/src/routes/auth.ts
- apps/management-api/openapi.yml
- packages/management-api-requests/src/authSessions.ts
- packages/management-api-requests/src/index.ts
- apps/management-api/src/routes/admin-session-list.real.integration.test.ts

## Before you start

Plan 62 must be done. Confirm `listAdminSessions`, `endAdminSession`, and `endAdminSessions`
are exported from `adminSessionStore.ts`, and that `clearAuthCookie` and `ensureAuthenticated`
are exported from `apps/management-api/src/lib/auth/index.ts`. `AuthenticatedAdmin` has
`session_id_text`. `DTOAccountSession` is exported from `@podverse/helpers` (plan 22). If any is
missing, stop and report.

## HTTP (`apps/management-api/src/lib/auth/adminSessionHttp.ts`)

Management routes are handlers, not a controller class. Export three functions and mount them
from `apps/management-api/src/routes/auth.ts`. Each handler assumes `ensureAuthenticated` already
ran.

Reuse `DTOAccountSession`. Do not add `DTOAdminSession`. The fields are the same: `id_text`,
`client_type`, `device_label`, `created_at`, `last_seen_at`, `is_current`. Dates are ISO 8601
strings. The response never includes `idle_expires_at`, token hashes, the revoke reason, or the
internal `id`.

`toAdminSessionDto(row, currentSessionIdText)` maps those fields.
`is_current` is `row.id_text === currentSessionIdText`.

- **`listAdminSessionsHttp`** — `GET /auth/sessions`. `listAdminSessions(user.id)`, map, 200
  `{ rows: DTOAccountSession[] }`. Order is the store's (newest `last_seen_at` first).
- **`revokeAdminSessionHttp`** — `DELETE /auth/sessions/:session_id_text`. Read the param with
  `getParamRequired` from `@management-api/lib/params.js`. When `isValidNanoIdV2IdText` is false,
  404 `{ message: 'Session not found' }`.
  - Own session (`=== user.session_id_text`): `endAdminSession({ …, reason: 'signed_out' })`,
    `clearAuthCookie`, 200 `{ message: 'Logged out successfully' }`. Same message as
    `POST /auth/logout`.
  - Other session: `endAdminSession({ …, reason: 'signed_out_elsewhere' })`. True → 200
    `{ message: 'Session ended' }`. False → 404 `{ message: 'Session not found' }`. The store
    scopes by admin, so one admin cannot end another's session, and the 404 does not tell the
    cases apart.
- **`revokeOtherAdminSessionsHttp`** — `POST /auth/sessions/revoke-others`.
  `endAdminSessions({ adminAccountId: user.id, reason: 'signed_out_elsewhere',
  exceptSessionIdText: user.session_id_text })`, then 200 `{ revoked_count: number }`. Zero is
  success.

Errors go to `next(error)`.

## Routes (`apps/management-api/src/routes/auth.ts`)

After the `/me` route:

```typescript
router.get('/sessions', ensureAuthenticated, (req, res, next) => {
  void listAdminSessionsHttp(req, res).catch(next);
});
router.post('/sessions/revoke-others', ensureAuthenticated, (req, res, next) => {
  void revokeOtherAdminSessionsHttp(req, res).catch(next);
});
router.delete('/sessions/:session_id_text', ensureAuthenticated, (req, res, next) => {
  void revokeAdminSessionHttp(req, res).catch(next);
});
```

Register `revoke-others` before the `:session_id_text` route.

## Request helpers (`packages/management-api-requests/src/authSessions.ts`)

```typescript
import type { DTOAccountSession } from '@podverse/helpers';

import { ManagementApiRequestService } from './apiRequestService.js';

export const listAuthSessions = (
  service: ManagementApiRequestService
): Promise<DTOAccountSession[]> =>
  service
    .apiRequest<{ rows: DTOAccountSession[] }>({ path: '/auth/sessions', method: 'GET' })
    .then((response) => response.rows);

export const revokeAuthSession = (
  service: ManagementApiRequestService,
  sessionIdText: string
): Promise<{ message: string }> =>
  service.apiRequest<{ message: string }>({
    path: `/auth/sessions/${encodeURIComponent(sessionIdText)}`,
    method: 'DELETE',
  });

export const revokeOtherAuthSessions = (
  service: ManagementApiRequestService
): Promise<number> =>
  service
    .apiRequest<{ revoked_count: number }>({
      path: '/auth/sessions/revoke-others',
      method: 'POST',
    })
    .then((response) => response.revoked_count);
```

Export the module from `packages/management-api-requests/src/index.ts` next to `./auth.js`.
Do not add these to `@podverse/helpers-requests`. Management-web does not call them in this set.

## OpenAPI

**Schemas**, next to the other auth schemas:

- `AdminSession`: the `DTOAccountSession` fields. `client_type` enum `web`, `mobile`.
  `device_label` nullable string. Dates `format: date-time`. `last_seen_at` description: "Last
  request on this session, kept to within a day." `is_current` description: "True for the session
  that made this request."
- `ManagementGetAuthSessionsResponse200`: required `rows`, array of `AdminSession`.
- `ManagementPostAuthSessionsRevokeOthersResponse200`: required `revoked_count`, integer,
  minimum 0.

**Paths**, after `/auth/mobile/token`. Each `tags: [auth]`, `security` the same bearer-plus-cookie
list the other signed-in auth routes use, plus the usual 401 and 500 responses:

- `GET /auth/sessions`, `operationId: managementGetAuthSessions`. Description: "Returns the
  signed-in admin's active sessions, most recently used first."
- `POST /auth/sessions/revoke-others`, `operationId: managementPostAuthSessionsRevokeOthers`.
  Description: "Ends every session of this admin except the one making the request."
- `DELETE /auth/sessions/{session_id_text}`, `operationId: managementDeleteAuthSession`.
  Description: "Ends one session of this admin. Ending the caller's own session signs it out and
  clears the `pv_mgmt_auth` cookie, the same as `POST /auth/logout`." 200 `MessageResponse`, 404
  `NotFoundErrorResponse`.

## Tests

**`admin-session-list.real.integration.test.ts`** (real store). Seed one admin as plan 62 does.
Log in web twice with different `User-Agent` headers (cookies A and B) and once through
`/auth/mobile/token` with `device_label: 'Test Phone'` (bearer C).

- `GET /auth/sessions` with A returns three rows; exactly one has `is_current: true` and it is
  A's; labels match the two User-Agents and `Test Phone`; no row has keys outside the DTO.
- `DELETE` of B's id with A → 200 `{ message: 'Session ended' }`. B on `GET /auth/me` → 401
  `{ code: 'session_ended', notice: 'signed_out_elsewhere' }`. The list with A has two rows.
- The same DELETE again → 404. A DELETE of `not-a-valid-id` → 404.
- A second admin's session id deleted with A → 404, and that session still works.
- `DELETE` of A's own id with A → 200 `{ message: 'Logged out successfully' }`, the response
  clears `pv_mgmt_auth`, and A on `GET /auth/me` is a plain 401.
- `POST /auth/sessions/revoke-others` with C after a fresh web login D → 200
  `{ revoked_count: 1 }`. C still works. D gets `signed_out_elsewhere`.
- `POST /auth/sessions/revoke-others` with no other sessions → `{ revoked_count: 0 }`.
- All three routes without auth → 401.

## Release scratchpad

```markdown
## Admin session list and sign-out endpoints

- Surfaces: management-api
- Change: signed-in management API endpoints. `GET /auth/sessions` lists the admin's active
  sessions. `DELETE /auth/sessions/:session_id_text` ends one; ending your own matches logout.
  `POST /auth/sessions/revoke-others` ends every other session and returns `revoked_count`.
  Devices signed out this way get the `signed_out_elsewhere` notice. Management-web does not
  show this list.
- Who notices: a future management client that calls the endpoints
- Operator steps: none
```
