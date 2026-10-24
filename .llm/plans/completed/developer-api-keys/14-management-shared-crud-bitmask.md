**Cursor model:** Cursor Grok 4.7 · **Reasoning:** extra high

# 14 — Management API and management web use the shared CRUD-bit helper

The management API, management web, and the predefined management admin roles each carry their
own copy of the CRUD bits (create 1, read 2, update 4, delete 8). Plan 10 adds the shared helper,
`packages/helpers/src/lib/crudBitmask.ts`. This plan routes every management caller through it and
deletes the copies.

**No behavior change.** Every permission check answers exactly as before for every mask, role,
and missing-permissions case. No route, status code, response body, label, or stored value
changes. The management API gets no API keys: it never accepts a `pvk_` token, and this plan adds
the test that proves it (R61).

Reasoning is extra high because this is authorization code: a swapped bit or a dropped superuser
check changes who can do what, and nothing but the tests below would notice.

## Rows

R61, R64, R65, R66

## Runs after

10

## Files

apps/management-api/src/lib/crud.ts
apps/management-api/src/lib/crud.test.ts
apps/management-api/src/lib/authz/requireCrud.ts
apps/management-api/src/routes/admins.ts
apps/management-api/src/routes/database.ts
apps/management-api/src/schemas/managementAdminRoles.ts
apps/management-api/src/routes/auth.integration.test.ts
apps/management-web/src/lib/managementPermissions.ts
apps/management-web/src/lib/managementPermissions.test.ts
apps/management-web/src/components/admins/AdminPermissionsSection.tsx
apps/management-web/src/app/(management)/admins/AdminsListPageClient.tsx
packages/helpers/src/managementAdminRoles/constants.ts
packages/helpers/src/managementAdminRoles/constants.test.ts

## Shared helper used

From plan 10, exported from the root of `@podverse/helpers`:

- `CRUD_BITS` (`{ create: 1, read: 2, update: 4, delete: 8 }`), `CRUD_ACTIONS`, `type CrudAction`
- `CRUD_MASK_NONE` (0), `CRUD_MASK_ALL` (15)
- `crudMaskHas(mask, action)`, `crudMaskToActions(mask)`, `isCrudMask(value)`

Import from `@podverse/helpers` in both apps (both already depend on it, and management-web client
components already import its root). Inside `packages/helpers`, import from `../lib/crudBitmask.js`.
Type imports go on their own `import type` line. Do not add a local file that re-exports these
names (**avoid-reexport-wrappers**).

| Old | New |
| --- | --- |
| `CrudMask` (management-api `lib/crud.ts`) | `CRUD_BITS` |
| `CrudOp` | `CrudAction` |
| `hasCrud(crud, op)` | `crudMaskHas(crud, op)` |
| `CRUD_CREATE` / `CRUD_READ` / `CRUD_UPDATE` / `CRUD_DELETE` (management-web) | `crudMaskHas(mask, 'create' \| 'read' \| 'update' \| 'delete')` |
| literal `15` / `2` / `0` as role masks | `CRUD_MASK_ALL` / `CRUD_BITS.read` / `CRUD_MASK_NONE` |
| `.min(0).max(15)` on a CRUD mask schema | `.min(CRUD_MASK_NONE).max(CRUD_MASK_ALL)` |

## Management API

### `apps/management-api/src/lib/crud.ts` and `crud.test.ts`

Delete both. Plan 10's `packages/helpers/src/lib/crudBitmask.test.ts` covers `crudMaskHas` on
each bit, on 0 and 15, and on a combined mask, which is everything `crud.test.ts` covered.

### `apps/management-api/src/lib/authz/requireCrud.ts`

- Replace the two `@management-api/lib/crud.js` imports with
  `import type { CrudAction } from '@podverse/helpers';` and
  `import { crudMaskHas } from '@podverse/helpers';`.
- `requireCrud(resource: PermissionResource, op: CrudAction)`; the check becomes
  `if (!crudMaskHas(crud, op))`.
- `getCrudForResource`, the superuser pass, the 401 and both 403 bodies stay as they are.

`requireCrud.test.ts` does not import `crud.ts` and needs no change; it must still pass untouched.

### `apps/management-api/src/routes/admins.ts`

- Replace `import { hasCrud } from '@management-api/lib/crud.js';` with
  `import { crudMaskHas } from '@podverse/helpers';` (merge into an existing value import from
  `@podverse/helpers` if the file has one).
- Anchor `const canChangePermissions`: `crudMaskHas(adminsCrud, 'create') || crudMaskHas(adminsCrud, 'update')`.
- Anchor `const crudSchema = Joi.number().integer().min(0).max(15);` →
  `.min(CRUD_MASK_NONE).max(CRUD_MASK_ALL)`.

### `apps/management-api/src/routes/database.ts`

- Replace `import { CrudMask } from '@management-api/lib/crud.js';` with
  `import { crudMaskHas } from '@podverse/helpers';`.
- `checkReadPermission`: `return crudMaskHas(crudValue, 'read');`.
- `checkCrudPermission`: delete the `mask` ternary; `return crudMaskHas(crudValue, op);`. The `op`
  parameter type `'create' | 'update' | 'delete'` stays.

### `apps/management-api/src/schemas/managementAdminRoles.ts`

`const crudSchema = Joi.number().integer().min(0).max(15);` →
`.min(CRUD_MASK_NONE).max(CRUD_MASK_ALL)`, importing both from `@podverse/helpers`.

### The management API rejects API keys (R61)

No code change: `readRequestToken` in `apps/management-api/src/lib/auth/sessionTokens.ts` passes a
`pvk_` Bearer value to JWT verification, which fails, so the request gets 401. The test pins it.

## Management web

### `apps/management-web/src/lib/managementPermissions.ts`

Keep every exported function name, signature, and answer. Delete the four `CRUD_*` constants and
replace the file's private `hasCrud` with one private helper that every `can*` function calls:

```ts
import type { CrudAction } from '@podverse/helpers';
import { crudMaskHas } from '@podverse/helpers';

function userHasCrud(user: CurrentUser, mask: number | undefined, action: CrudAction): boolean {
  if (user.role === 'superuser') {
    return true;
  }
  return user.permissions !== null && user.permissions !== undefined && crudMaskHas(mask ?? 0, action);
}
```

Each function becomes one line, for example
`canReadAdmins(user)` → `userHasCrud(user, user.permissions?.admins_crud, 'read')` and
`canDeleteStorage(user)` → `userHasCrud(user, user.permissions?.bucket_crud, 'delete')`. Keep the
field and action each function uses today; the test below lists them. `LIFECYCLE_TAKEDOWN_KEY`
and `feedOperationsRequireConfirm` do not change.

The answers match the old code: a superuser is always true, whatever `permissions` holds; for
anyone else, `permissions` null or undefined is false; otherwise the bit decides, and a missing
optional `*_crud` field reads as 0.

### `apps/management-web/src/components/admins/AdminPermissionsSection.tsx`

The local `CRUD_BITS` array (bits 1, 2, 4, 8 with label keys) shadows the shared name. Replace it:

```ts
const CRUD_LABEL_KEYS = {
  create: 'create',
  read: 'read',
  update: 'update',
  delete: 'deletePerm',
} as const satisfies Record<CrudAction, string>;

const CRUD_COLUMNS = CRUD_ACTIONS.map((action) => ({
  bit: CRUD_BITS[action],
  labelKey: CRUD_LABEL_KEYS[action],
}));
```

Rename the two `CRUD_BITS.map((check) => …)` uses to `CRUD_COLUMNS.map`. `toggleCrudBit`, the
`checked={(permissions[key] & check.bit) !== 0}` test, and the column order (create, read, update,
delete) stay. Keep `labelKey` a union of literals (the `as const satisfies` above) so
`tp(check.labelKey)` type-checks as it does today.

### `apps/management-web/src/app/(management)/admins/AdminsListPageClient.tsx`

Replace the 16-entry `CRUD_LABELS` table with a derivation that returns the same strings:

```ts
const CRUD_ACTION_LETTERS = {
  create: 'C',
  read: 'R',
  update: 'U',
  delete: 'D',
} as const satisfies Record<CrudAction, string>;

function crudLabel(value: number): string {
  if (!isCrudMask(value)) {
    return String(value);
  }
  if (value === CRUD_MASK_NONE) {
    return 'None';
  }
  return crudMaskToActions(value)
    .map((action) => CRUD_ACTION_LETTERS[action])
    .join('');
}
```

For 0–15 this gives `None`, `C`, `R`, `CR`, `U`, `CU`, `RU`, `CRU`, `D`, `CD`, `RD`, `CRD`, `UD`,
`CUD`, `RUD`, `CRUD`, exactly the old table; any other value falls back to `String(value)` as
before. `None` stays an untranslated literal, as it is today.

## `packages/helpers/src/managementAdminRoles/constants.ts`

- Import `CRUD_BITS`, `CRUD_MASK_ALL`, `CRUD_MASK_NONE` from `../lib/crudBitmask.js`.
- In `PREDEFINED_MANAGEMENT_ADMIN_ROLES`, every `15` becomes `CRUD_MASK_ALL`, every `2`
  `CRUD_BITS.read`, every `0` `CRUD_MASK_NONE`. No role's values change.
- The file's doc comment: replace "CRUD bits: create=1, read=2, update=4, delete=8 (sum 0–15)." with
  a pointer to `CRUD_BITS` in `lib/crudBitmask.ts`; keep the billing sentence.

## Tests

- `apps/management-api/src/routes/auth.integration.test.ts` (management-api integration), in
  `describe('GET /auth/me')` after `'returns 401 for a refresh token sent as a bearer token'`:
  `it('returns 401 for a Podverse API key sent as a bearer token, without a session lookup')`.
  Send `Authorization: Bearer ${API_KEY_TOKEN_PREFIX}${'a'.repeat(43)}` (a well-formed key;
  `API_KEY_TOKEN_PREFIX` from `@podverse/helpers`). Expect 401, body
  `{ message: 'Unauthorized' }`, and `adminSessionStoreStub.checkAdminSession` not called. Add a
  second request in the same case with a valid `pv_mgmt_auth` cookie
  (`jwt.sign({ id: 1, id_text: 'pvMgtAu001', ...TEST_ADMIN_SESSION_CLAIMS }, JWT_SECRET, { expiresIn: '1h' })`)
  plus the key header: still 401, because the header wins and a key is never a management
  credential.
- Deleted: `apps/management-api/src/lib/crud.test.ts` (covered by plan 10's
  `crudBitmask.test.ts`). `apps/management-api/src/lib/authz/requireCrud.test.ts` stays as it is
  and must pass unchanged.
- `apps/management-web/src/lib/managementPermissions.test.ts` (new, vitest unit). One
  `it.each` table over every exported `can*` function with the `*_crud` field and action it
  checks today:

  | Function | Field | Action |
  | --- | --- | --- |
  | `canReadAdmins` | `admins_crud` | read |
  | `canCreateAdmins` | `admins_crud` | create |
  | `canUpdateAdmins` | `admins_crud` | update |
  | `canDeleteAdmins` | `admins_crud` | delete |
  | `canReadFeeds` | `feeds_crud` | read |
  | `canUpdateFeeds` | `feeds_crud` | update |
  | `canReadStats` | `stats_crud` | read |
  | `canReadStorage` | `bucket_crud` | read |
  | `canDeleteStorage` | `bucket_crud` | delete |
  | `canReadEmbedDemo` | `embed_demo_crud` | read |
  | `canUpdateEmbedDemo` | `embed_demo_crud` | update |
  | `canReadNotifications` | `notifications_crud` | read |
  | `canCreateNotifications` | `notifications_crud` | create |
  | `canUpdateNotifications` | `notifications_crud` | update |
  | `canReadBillingChannels` | `billing_channels_crud` | read |
  | `canUpdateBillingChannels` | `billing_channels_crud` | update |
  | `canReadBillingProcessorProducts` | `billing_processor_products_crud` | read |
  | `canCreateBillingProcessorProducts` | `billing_processor_products_crud` | create |
  | `canUpdateBillingProcessorProducts` | `billing_processor_products_crud` | update |
  | `canReadBillingAccount` | `billing_account_crud` | read |
  | `canResyncBillingAccount` | `billing_account_crud` | update |
  | `canGrantBillingMembership` | `billing_account_crud` | create |
  | `canEndBillingMembership` | `billing_account_crud` | delete |
  | `canReadBillingWebhookEvents` | `billing_webhook_events_crud` | read |
  | `canReplayBillingWebhookEvents` | `billing_webhook_events_crud` | update |

  Write the table from the code as it stands before editing it, and check it against this list.
  For each row: an `admin` user whose permissions hold only that field set to the action's bit
  (every other field 0) gets true; the same field set to every other bit (`CRUD_MASK_ALL` minus
  the bit) gets false; `permissions: null` gets false; a `superuser` with `permissions: null` gets
  true. Build `CurrentUser` fixtures with every required `CrudPermissions` field present, typed,
  no `as`.
- `packages/helpers/src/managementAdminRoles/constants.test.ts` (new, vitest unit): `everything`
  has 15 on every `*Crud` field, `read_everything` has 2 on every field, `storage_full` has 15 on
  `bucketCrud` and 0 elsewhere, and `admins_stats_read` has 15 on `adminsCrud` and `statsCrud` and
  2 elsewhere. Write the numbers as literals so the test catches a swapped constant.
- `apps/management-web/e2e/admins-new-permissions-templates.spec.ts` already covers the
  permission matrix and the role templates; it needs no change and must still pass.

## Release scratchpad

none
