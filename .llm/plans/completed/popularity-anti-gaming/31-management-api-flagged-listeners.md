**Cursor model:** Cursor Grok 4.7 · **Reasoning:** high

# 31 — Management API: list flagged listeners and clear a flag

Two management routes over `stats_flagged_listener` (plan 30): a paged list and a clear action.
Both work from the flag row's `id` and `listener_id`. Neither reads the account-to-listener
mapping, joins `account`, or returns anything that names an account.

## Rows

R10, R11

## Runs after

30

## Routes

Base path is the existing stats router: `${config.api.prefix}${config.api.version}/stats`.

### `GET /stats/flagged-listeners`

- Middleware: `ensureAuthenticated`, `requireCrud('stats', 'read')`.
- Query (Joi, `stripUnknown: true, convert: true`): `status` one of `active` (default),
  `cleared`, `all`; `page` integer ≥ 1 (default 1); `limit` integer 1–100 (default 25). A
  validation error answers 400 `{ message }`.
- Answer 200:
  `{ rows: StatsFlaggedListenerRow[], total: number, page: number, pageSize: number }` (same
  envelope as `/stats/:entityType/top`).
- Row shape:

  ```typescript
  type StatsFlaggedListenerRow = {
    id: number;
    listener_id: string;
    reason: PopularityFlagReason;
    /** ISO 8601 */
    flagged_at: string;
    times_flagged: number;
    /** ISO 8601, or null while the flag is active */
    cleared_at: string | null;
    cleared_by_admin_id: number | null;
    /** Stored listen events in the last 7 days, popularity-counted or not. */
    listens_last_7_days: number;
    /** Stored open events in the last 7 days. */
    opens_last_7_days: number;
  };
  ```

- Filter and order:

  | status | WHERE | ORDER BY |
  | --- | --- | --- |
  | `active` | `f.cleared_at IS NULL` | `f.flagged_at DESC, f.id DESC` |
  | `cleared` | `f.cleared_at IS NOT NULL` | `f.cleared_at DESC, f.id DESC` |
  | `all` | none | `f.flagged_at DESC, f.id DESC` |

- Read through `AppDbDataSourceRead` (the read role has `SELECT` on both event tables and the flag
  table). Row SQL:

  ```sql
  SELECT f.id, f.listener_id::text AS listener_id, f.reason, f.flagged_at, f.times_flagged,
         f.cleared_at, f.cleared_by_admin_id,
         (SELECT count(*)::int FROM stats_listen_event e
           WHERE e.listener_id = f.listener_id AND e.created_at >= now() - interval '7 days')
           AS listens_last_7_days,
         (SELECT count(*)::int FROM stats_open_event o
           WHERE o.listener_id = f.listener_id AND o.created_at >= now() - interval '7 days')
           AS opens_last_7_days
    FROM stats_flagged_listener f
   <WHERE>
   <ORDER BY>
   LIMIT $1 OFFSET $2
  ```

  Count SQL: `SELECT count(*)::int AS total FROM stats_flagged_listener f <WHERE>`. The WHERE and
  ORDER BY fragments come from a fixed map keyed by the validated status, never from input text.
  Both subqueries use `stats_*_event_listener_created_idx`.

### `POST /stats/flagged-listeners/:id/clear`

- Middleware: `ensureAuthenticated`, `requireCrud('stats', 'update')`.
- `:id` must parse to a positive integer; otherwise 400 `{ message: 'Invalid id' }`. No body.
- In one `AppDbDataSourceReadWrite.transaction`:
  1. Select the row (same columns as the list, evidence counts included) `WHERE f.id = $1 FOR UPDATE OF f`.
  1. No row: 404 `{ message: 'Flagged listener not found' }`.
  1. `cleared_at` already set: 409 `{ message: 'Flag already cleared' }`.
  1. `UPDATE stats_flagged_listener SET cleared_at = now(), cleared_by_admin_id = $2 WHERE id = $1`
     with `$2` the signed-in admin's id (`req.user.id`; missing answers 401 like
     `readAdminId` in `feedMergeReview.ts`).
  1. Select the row again and return it.
- After commit, record an audit entry (`AuditLogService.record`): `operation: 'update'`,
  `tableName: 'stats_flagged_listener'`, `rowId: id`, `requestId: getAuditRequestId(req)`, and
  before/after snapshots `{ id, reason, flagged_at, times_flagged, cleared_at, cleared_by_admin_id }`
  (no `listener_id`; the audit log lives in the management database and does not need it).
- Answer 200 `{ row: StatsFlaggedListenerRow }`.
- No listener lock: the write path reads the flag under its own lock, and the flag upsert in plan
  30 takes the row lock, so a clear and a re-flag serialize on the row. A clear holds for the rest
  of its UTC day (plan 30's `flagListener` rule).

Errors that are not 400, 401, 403, 404, or 409 log with `console.error('[stats/flagged-listeners…]', err)`
and answer 500 `{ message: 'Internal server error' }`, like the other stats routes.

## Code layout

Follow `feedMergeReview.ts` (routes registered on a router from a separate file, Joi schema
module with a typed parse function, app-DB helpers in `lib/`).

- New `apps/management-api/src/schemas/statsFlaggedListeners.ts`:
  `STATS_FLAGGED_LISTENER_STATUSES = ['active', 'cleared', 'all'] as const`,
  `StatsFlaggedListenerStatus`, `statsFlaggedListenerListQuerySchema`,
  `StatsFlaggedListenerListQueryValidated`, and
  `parseStatsFlaggedListenerListQuery(value: unknown): StatsFlaggedListenerListQueryValidated | null`
  (narrowing like `parseFeedMergeListQuery`, no `as`).
- New `apps/management-api/src/lib/stats/flaggedListeners.ts`:
  - `StatsFlaggedListenerRow` (above).
  - `readFlaggedListenerRow(value: unknown): StatsFlaggedListenerRow` — type guards on every
    field; `reason` through `isPopularityFlagReason` from `@podverse/helpers`; `Date` values to
    `toISOString()`; throws `Error('Expected a flagged listener row')` on a bad shape.
  - `listFlaggedListeners(query): Promise<{ rows: StatsFlaggedListenerRow[]; total: number }>`.
  - `clearFlaggedListener(id: number, adminId: number): Promise<ClearFlaggedListenerResult>` with
    `type ClearFlaggedListenerResult = { kind: 'not_found' } | { kind: 'already_cleared' } | { kind: 'cleared'; before: StatsFlaggedListenerRow; row: StatsFlaggedListenerRow };`
  - The row select SQL is one constant used by the list (with WHERE/ORDER/LIMIT appended) and by
    the clear (with `WHERE f.id = $1 FOR UPDATE OF f`).
  - TypeORM answers `UPDATE` without `RETURNING` with `[rows, count]`; the clear ignores that
    result and re-selects.
- New `apps/management-api/src/routes/statsFlaggedListeners.ts`:
  `export function registerStatsFlaggedListenerRoutes(router: Router): void` with both routes.
- `apps/management-api/src/routes/stats.ts`: import it and call
  `registerStatsFlaggedListenerRoutes(router);` right after `const router = express.Router();`, so
  `/flagged-listeners` is registered before the `/:entityType/...` routes. Update the file's top
  comment: these routes also list and clear flagged listeners.

## Request package

`packages/management-api-requests/src/stats.ts` (management-web re-exports this package from
`apps/management-web/src/lib/requests/stats.ts`, so web needs no request file change):

```typescript
export type StatsFlaggedListenerStatus = 'active' | 'cleared' | 'all';

export type StatsFlaggedListenerRow = { /* same fields as the API row */ };

export type StatsFlaggedListenersResponse = {
  rows: StatsFlaggedListenerRow[];
  total: number;
  page: number;
  pageSize: number;
};

export async function reqStatsFlaggedListeners(
  status: StatsFlaggedListenerStatus,
  page: number = 1,
  limit: number = 25
): Promise<StatsFlaggedListenersResponse>;

export async function reqStatsFlaggedListenerClear(
  id: number
): Promise<{ row: StatsFlaggedListenerRow }>;
```

`reason` is typed `PopularityFlagReason` (`import type` from `@podverse/helpers`). The clear call
is `method: 'POST'` to `/stats/flagged-listeners/${id}/clear` with no body. The package index
already has `export * from './stats.js'`.

## OpenAPI

`apps/management-api/openapi.yml`, above `/stats/{entity_type}/{id}:` (**openapi-sync**):

- `/stats/flagged-listeners` `get`, `operationId: managementGetStatsFlaggedListeners`, tag
  `stats`, `security` bearer and cookie like its neighbors, description naming
  `requireCrud('stats', 'read')`, the three query parameters with enum and bounds, 200 with the
  envelope, 400, 401, 403.
- `/stats/flagged-listeners/{id}/clear` `post`,
  `operationId: managementPostStatsFlaggedListenersIdClear`, description naming
  `requireCrud('stats', 'update')` and that a clear holds for the rest of its UTC day, path `id`
  integer, 200 `{ row }` with an example, 400, 401, 403, 404, 409.
- A `StatsFlaggedListenerRow` schema under `components.schemas` (or inline, matching how the
  neighboring stats paths declare theirs); `reason` enum `stored_cap_reached`,
  `too_soon_minutes`, described as: `stored_cap_reached` — the listener's stored listens reached
  the daily stored cap within the server-set number of hours of its first stored listen that UTC
  day; `too_soon_minutes` — the listener's new listens arrived inside the minimum interval for the
  server-set number of minutes in one unbroken run.

## Listener-id rule and table policy

- `.cursor/rules/popularity-listener-id-separation.mdc`: add
  `apps/management-api/src/routes/statsFlaggedListeners.ts` and
  `apps/management-api/src/lib/stats/flaggedListeners.ts` to `globs`, and after the paragraph that
  starts "Workers, management API and web" add: "Flagged listeners (`stats_flagged_listener`) and
  their too-soon signal (`stats_flag_signal`) are keyed by `listener_id`. Management lists and
  clears flags by row id and `listener_id` and never looks up or shows an account for them."
- `apps/management-api/src/lib/database/tablePolicy.ts` stays as it is: the database browser does
  not list either flag table, like the event and taste tables. The test below pins that.

## Docs

`docs/features/POPULARITY-AND-TASTE-PROFILE.md` § Flagged Listeners (plan 30 creates it): add that admins
with stats read permission see flagged listeners on the management Stats area (listener id,
reason, when, times flagged, listens and opens stored in the last 7 days), and admins with stats
update permission clear a flag; a clear is audited and holds for the rest of its UTC day. After
a clear, the listener's events from before the flag count again in range totals while they are
inside retention; events stored while the flag was in place keep `popularity_counted = false` and
stay out. A clear leaves `stats_flag_signal` as it is: the too-soon run resets on its own after a
gap of more than 2 minutes.

## Files

apps/management-api/src/schemas/statsFlaggedListeners.ts
apps/management-api/src/lib/stats/flaggedListeners.ts
apps/management-api/src/lib/stats/flaggedListeners.test.ts
apps/management-api/src/routes/statsFlaggedListeners.ts
apps/management-api/src/routes/statsFlaggedListeners.integration.test.ts
apps/management-api/src/routes/stats.ts
apps/management-api/src/lib/database/tablePolicy.test.ts
apps/management-api/openapi.yml
packages/management-api-requests/src/stats.ts
.cursor/rules/popularity-listener-id-separation.mdc
docs/features/POPULARITY-AND-TASTE-PROFILE.md
release-notes/scratchpad.md

## Tests

Unit, `apps/management-api/src/lib/stats/flaggedListeners.test.ts`: `readFlaggedListenerRow`
turns `Date` values into ISO strings, keeps null `cleared_at` and `cleared_by_admin_id`, and
throws for an unknown `reason`, a missing `id`, or a non-number count.

API integration (mocked DB, like `stats.integration.test.ts`; copy its admin fixtures, JWT helper,
`appDb.js` mock with `AppDbDataSourceRead.query`, `AppDbDataSourceReadWrite.transaction`, and an
`AuditLogService` mock whose `record` is a `vi.fn` you can assert on). Add an admin with
`statsCrud: 6` (read and update) beside the read-only one (`statsCrud: 2`).
`apps/management-api/src/routes/statsFlaggedListeners.integration.test.ts`:

- `GET /stats/flagged-listeners`: 401 without auth; 403 with no stats permission; 200 for the
  read-only stats admin; the default row SQL contains `cleared_at IS NULL` and
  `ORDER BY f.flagged_at DESC`; `status=cleared` SQL contains `cleared_at IS NOT NULL` and
  `ORDER BY f.cleared_at DESC`; 400 for `status=open` and for `limit=101`; a mocked row with
  `Date` values comes back with ISO strings and numeric counts; no query text contains
  `listener_identity` or matches `/\baccount/`.
- `POST /stats/flagged-listeners/:id/clear`: 401 without auth; 403 for the read-only stats admin;
  400 for `abc` and `0`; 404 when the locked select returns no row; 409 when it returns a row with
  `cleared_at` set; 200 for the read-and-update admin: the `UPDATE` ran with `[id, adminId]`, the
  response row has `cleared_at`, and the audit mock got `tableName: 'stats_flagged_listener'`,
  `rowId` equal to the id, and `operation: 'update'`.

Unit, `apps/management-api/src/lib/database/tablePolicy.test.ts`, "keeps daily, event, taste, and
aggregate tables off the allowlist": add `stats_flagged_listener` and `stats_flag_signal` to the
list.

## Release scratchpad

```markdown
## Management lists flagged listeners and clears flags

- Surfaces: management-api
- Change: `GET /stats/flagged-listeners` (stats read) lists listeners flagged out of popularity,
  active by default, with reason, times flagged, and listens and opens stored in the last 7 days.
  `POST /stats/flagged-listeners/:id/clear` (stats update) clears a flag and writes an audit
  entry. Both work from the pseudonymous listener id and never show an account. A clear holds
  for the rest of its UTC day; a later day's signal flags the listener again.
- Who notices: admins with stats permissions
- Operator steps: none; grant stats update to admins who should clear flags
```
