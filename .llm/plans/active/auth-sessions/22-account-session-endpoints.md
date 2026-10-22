**Cursor model:** Cursor Grok 4.7 · **Reasoning:** extra high

# 22 — Session list and sign-out endpoints

Three endpoints let a signed-in user see their active sessions and end them: list, end one, and
"Sign Out of All Other Devices". Web (plans 30–39) and mobile (plans 40–49) build the screens on
these. The device that was signed out gets the `signed_out_elsewhere` notice on its next request
(plan 20).

The routes live under `/auth/sessions`, not `/account/sessions`: `apps/api/src/routes/account.ts`
ends with a catch-all `GET /:id_text`, and sessions are auth state.

## Rows

R26, R41

## Runs after

21

## Files

- packages/helpers/src/dtos/account/accountSession.ts
- packages/helpers/src/dtos/index.ts
- apps/api/src/controllers/account/accountSession.ts
- apps/api/src/routes/auth.ts
- apps/api/openapi.yml
- packages/helpers-requests/src/api/auth/sessions.ts
- packages/helpers-requests/src/api/_request.ts
- apps/api/src/test/account-session-list.integration.test.ts

## Before you start

Plan 20 must be done. Confirm before editing:

- `apps/api/src/lib/auth/accountSessionStore.ts` exports `listAccountSessions(accountId)`
  (returns `AccountSessionRow[]`), `endAccountSession({ accountId, sessionIdText, reason })`
  (returns `boolean`), and `endAccountSessions({ accountId, reason, exceptSessionIdText })`
  (returns `number`).
- `apps/api/src/lib/auth/index.ts` exports `clearAuthCookie`, `ensureAuthenticated`, and
  `getAuthenticatedUser`.
- `Express.User` in `apps/api/src/@types/express.d.ts` has `session_id_text: string`.
- `AccountSessionRow` and `AccountSessionClientType` are exported (`@podverse/orm` and
  `@podverse/helpers`, from plan 10).

If any is missing, stop and report.

## DTO (`packages/helpers/src/dtos/account/accountSession.ts`)

```typescript
import type { AccountSessionClientType } from '../../lib/accountSession.js';

/** One active session of the signed-in account. Dates are ISO 8601 strings. */
export type DTOAccountSession = {
  id_text: string;
  client_type: AccountSessionClientType;
  device_label: string | null;
  created_at: string;
  /** Last request on this session, kept to within a day. */
  last_seen_at: string;
  /** True for the session that made this request. */
  is_current: boolean;
};
```

Add `export * from './account/accountSession.js';` to `packages/helpers/src/dtos/index.ts`
directly after the `./account/accountContentLog.js` line.

The response never includes `idle_expires_at`, token hashes, the revoke reason, or the internal
`id`.

## Controller (`apps/api/src/controllers/account/accountSession.ts`)

Follow `apps/api/src/controllers/account/accountContentLog.ts`: a class with static methods, each
wrapping its body in `ensureAuthenticated(req, res, async () => { try { … } catch (error) {
handleGenericErrorResponse(res, error); } }, { skipMembershipStatus: true, skipTermsAcceptance:
true })`. Signing out must work for a lapsed membership or unaccepted terms.

```typescript
export class AccountSessionController {
  static async list(req: Request, res: Response): Promise<void>;
  static async revoke(req: Request, res: Response): Promise<void>;
  static async revokeOthers(req: Request, res: Response): Promise<void>;
}
```

A module-level `toAccountSessionDto(row: AccountSessionRow, currentSessionIdText: string):
DTOAccountSession` maps `id_text`, `client_type`, `device_label`, `created_at.toISOString()`,
`last_seen_at.toISOString()`, and `is_current: row.id_text === currentSessionIdText`.

- **`list`** — `GET /auth/sessions`. `listAccountSessions(user.id)`, map, respond 200
  `{ rows: DTOAccountSession[] }`. Order is the store's (newest `last_seen_at` first).
- **`revoke`** — `DELETE /auth/sessions/:session_id_text`. Read the param with
  `getParamRequired(req, 'session_id_text')` from `@api/lib/params.js`. When
  `isValidNanoIdV2IdText` (from `@podverse/orm`) is false, respond 404
  `{ message: 'Session not found' }`.
  - Own session (`=== user.session_id_text`): `endAccountSession({ …, reason: 'signed_out' })`,
    then `clearAuthCookie(res)`, then 200 `{ message: 'Signed out' }`. This is the same as
    `POST /auth/logout` and needs no other branch.
  - Other session: `endAccountSession({ …, reason: 'signed_out_elsewhere' })`. True → 200
    `{ message: 'Session ended' }`. False (another account's id, already ended, or unknown) → 404
    `{ message: 'Session not found' }`. The store scopes by account, so one user can never end
    another user's session, and the 404 does not tell the two cases apart.
- **`revokeOthers`** — `POST /auth/sessions/revoke-others`. `endAccountSessions({ accountId:
  user.id, reason: 'signed_out_elsewhere', exceptSessionIdText: user.session_id_text })`, then 200
  `{ revoked_count: number }`. Zero is a success.

Imports, in the repo's order (`@api/*` first, then third-party, then `@podverse/*`; type imports on
their own lines): `handleGenericErrorResponse` from `@api/controllers/helpers/error.js`;
`clearAuthCookie`, `ensureAuthenticated`, `getAuthenticatedUser` from `@api/lib/auth/index.js`;
`endAccountSession`, `endAccountSessions`, `listAccountSessions` from
`@api/lib/auth/accountSessionStore.js`; `getParamRequired` from `@api/lib/params.js`;
`import type { Request, Response } from 'express'`; `import type { DTOAccountSession } from
'@podverse/helpers'`; `import type { AccountSessionRow } from '@podverse/orm'`;
`import { isValidNanoIdV2IdText } from '@podverse/orm'`.

## Routes (`apps/api/src/routes/auth.ts`)

Add `import { AccountSessionController } from '@api/controllers/account/accountSession.js';` after
the `AccountController` import. After the `/check-session` line:

```typescript
router.get('/sessions', asyncHandler(AccountSessionController.list));
router.post('/sessions/revoke-others', asyncHandler(AccountSessionController.revokeOthers));
router.delete('/sessions/:session_id_text', asyncHandler(AccountSessionController.revoke));
```

## Request helpers (`packages/helpers-requests/src/api/auth/sessions.ts`)

Follow `packages/helpers-requests/src/api/account/contentLog.ts` (unwrap the response, send
credentials):

```typescript
import type { DTOAccountSession } from '@podverse/helpers';

import type { ApiRequestService } from '../_request.js';
import type { ApiMessageResponse } from '../_response.js';

export const reqAuthSessions = (api: ApiRequestService): Promise<DTOAccountSession[]> =>
  api
    .apiRequest<{ rows: DTOAccountSession[] }>({
      path: '/auth/sessions',
      method: 'GET',
      config: { withCredentials: true },
    })
    .then((response) => response.rows);

export const reqAuthSessionRevoke = (
  api: ApiRequestService,
  sessionIdText: string
): Promise<ApiMessageResponse> =>
  api.apiRequest<ApiMessageResponse>({
    path: `/auth/sessions/${encodeURIComponent(sessionIdText)}`,
    method: 'DELETE',
    config: { withCredentials: true },
  });

export const reqAuthSessionsRevokeOthers = (api: ApiRequestService): Promise<number> =>
  api
    .apiRequest<{ revoked_count: number }>({
      path: '/auth/sessions/revoke-others',
      method: 'POST',
      config: { withCredentials: true },
    })
    .then((response) => response.revoked_count);
```

In `packages/helpers-requests/src/api/_request.ts`: add
`import { reqAuthSessionRevoke, reqAuthSessions, reqAuthSessionsRevokeOthers } from
'./auth/sessions.js';` directly after the `'./auth/auth.js'` import, and three methods directly
after `reqAuthMobileRevoke(refresh_token: string) { … }`:

```typescript
  reqAuthSessions() {
    return reqAuthSessions(this);
  }

  reqAuthSessionRevoke(sessionIdText: string) {
    return reqAuthSessionRevoke(this, sessionIdText);
  }

  reqAuthSessionsRevokeOthers() {
    return reqAuthSessionsRevokeOthers(this);
  }
```

## OpenAPI (`apps/api/openapi.yml`)

**Schemas.** Directly after the `AccountContentLog` schema under `components.schemas`, add:

- `AccountSession`: object, required `id_text`, `client_type`, `device_label`, `created_at`,
  `last_seen_at`, `is_current`. `client_type` enum `web`, `mobile`. `device_label` string,
  `nullable: true`. Both dates `type: string`, `format: date-time`. `last_seen_at` description:
  "Last request on this session, kept to within a day." `is_current` description: "True for the
  session that made this request."
- `ApiGetAuthSessionsResponse200`: object, required `rows`, `rows` an array of `AccountSession`.
- `ApiPostAuthSessionsRevokeOthersResponse200`: object, required `revoked_count`, integer,
  minimum 0.

**Paths.** Directly after the whole `/auth/mobile/token:` path block (before the next top-level
path), add three paths, each with `tags: [auth]`, `security: [bearerAuth: [], cookieAuth: []]` in
the same list form as `/account/content-log`, and the `401` (`AuthenticationErrorResponse`) and
`500` (`InternalServerErrorResponse`) responses copied from `/account/content-log`:

- `/auth/sessions` `get`, `operationId: apiGetAuthSessions`, summary `GET /auth/sessions`,
  description "Returns the signed-in account's active sessions, most recently used first." 200 →
  `ApiGetAuthSessionsResponse200`.
- `/auth/sessions/revoke-others` `post`, `operationId: apiPostAuthSessionsRevokeOthers`, summary
  `POST /auth/sessions/revoke-others`, description "Ends every session of the account except the
  one making this request. Those devices are told they were signed out elsewhere." 200 →
  `ApiPostAuthSessionsRevokeOthersResponse200`.
- `/auth/sessions/{session_id_text}` `delete`, `operationId: apiDeleteAuthSession`, summary
  `DELETE /auth/sessions/{session_id_text}`, description "Ends one session of the account. Ending
  the requester's own session signs it out and clears the `jwt` cookie, the same as
  `POST /auth/logout`." Path parameter `session_id_text`, required, string. 200 →
  `MessageResponse`; 404 → `NotFoundErrorResponse`.

## Tests

**`apps/api/src/test/account-session-list.integration.test.ts`** (new; real store,
`startTestApp({ accountSessions: 'real' })`). Seed accounts as
`account-session.integration.test.ts` does (`AccountService.create`, `getByEmail`, `verifyEmail`).
Log in web twice with different `User-Agent` headers (cookies A and B) and once through
`/auth/mobile/token` with `device_label: 'Test Phone'` (bearer C). Cases:

- `GET /auth/sessions` with A returns three rows; exactly one has `is_current: true` and it is A's;
  labels match the two User-Agents and `Test Phone`; no row has keys outside the DTO.
- `DELETE /auth/sessions/<B's id_text>` with A → 200; B on `/auth/me` → 401
  `{ code: 'session_ended', notice: 'signed_out_elsewhere' }`; the list with A has two rows.
- The same DELETE again → 404. A DELETE with `not-a-valid-id` → 404.
- A second account's session id deleted with A → 404, and that session still works.
- `DELETE /auth/sessions/<A's own id_text>` with A → 200, the response clears the cookie, and A on
  `/auth/me` is a plain 401 (no notice).
- `POST /auth/sessions/revoke-others` with C (bearer) after a fresh web login D → 200
  `{ revoked_count: 1 }` (D only); C still works; D gets the `signed_out_elsewhere` notice.
- `POST /auth/sessions/revoke-others` with no other sessions → `{ revoked_count: 0 }`.
- All three routes without auth → 401.

## Release scratchpad

```markdown
## Session list and sign-out endpoints

- Surfaces: api, helpers, helpers-requests
- Change: new signed-in endpoints. `GET /auth/sessions` lists the account's active sessions
  (`id_text`, `client_type`, `device_label`, `created_at`, `last_seen_at` to within a day,
  `is_current`). `DELETE /auth/sessions/:session_id_text` ends one; ending your own is the same as
  logout. `POST /auth/sessions/revoke-others` ends every other session and returns
  `revoked_count`. Devices signed out this way get the `signed_out_elsewhere` notice. They work
  with a lapsed membership or unaccepted terms.
- Who notices: web and mobile clients that build the session list screens.
- Operator steps: none
```
