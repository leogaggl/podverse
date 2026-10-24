**Cursor model:** Cursor Grok 4.7 · **Reasoning:** high

# 10 — API key shared model in `@podverse/helpers`

The names and shapes every later plan in this set builds on: the CRUD bitmask, the resource
catalog, the actions each resource supports, the presets, the expiration options, the token
format, the key limit, the error codes, and the DTOs.
Pure TypeScript with unit tests. No API, ORM, or client code changes here.

## Rows

R1, R2, R8, R18, R23, R26, R40, R62, R74, R75, R82

## Runs after

none

## Files

packages/helpers/src/lib/crudBitmask.ts
packages/helpers/src/lib/crudBitmask.test.ts
packages/helpers/src/lib/apiKey.ts
packages/helpers/src/lib/apiKey.test.ts
packages/helpers/src/dtos/account/accountApiKey.ts
packages/helpers/src/dtos/index.ts
packages/helpers/src/index.ts

## What Metaboost has, and where this deviates (R1, R2)

Metaboost (`../metaboost`) has CRUD bitmasks (`packages/helpers/src/crud/crud-bitmask.ts`:
create=1, read=2, update=4, delete=8, values 0–15) stored as one integer column per resource
(`admin_permissions.*_crud`, `bucket_admin.*_crud`, `bucket_role.*_crud`). Its Bearer handling is
the session JWT only (`apps/api/src/middleware/requireAuth.ts`); it has no user-issued keys.
Podverse already uses the same bits for management admin roles
(`packages/helpers/src/managementAdminRoles/constants.ts`, `apps/management-api/src/lib/crud.ts`).

This set borrows the bit values and the per-resource mask. It deviates in two places:

- **Storage:** one JSONB object of `{ resource: mask }` on the key row (plan 11), not one column
  per resource. The resource catalog will grow with the API; a JSONB map grows by editing
  `API_KEY_RESOURCES` with no migration, and a resource missing from a stored key reads as 0
  (deny).
- **Issuance:** hashing, expiry, last-used, and revocation are new design (plans 11–13).

`crudBitmask.ts` is the one CRUD-bit helper in the monorepo. Plan 14 switches the management API,
management web, and `packages/helpers/src/managementAdminRoles/` to it, so keep its names and
semantics exactly as written here.

## `packages/helpers/src/lib/crudBitmask.ts` (new)

```ts
/** CRUD permission bits. A mask is their sum, 0–15. */
export const CRUD_BITS = { create: 1, read: 2, update: 4, delete: 8 } as const;

/** Display and iteration order. */
export const CRUD_ACTIONS = ['create', 'read', 'update', 'delete'] as const;
export type CrudAction = (typeof CRUD_ACTIONS)[number];

export const CRUD_MASK_NONE = 0;
export const CRUD_MASK_ALL = 15;

export function isCrudAction(value: unknown): value is CrudAction;
/** An integer from 0 to 15. */
export function isCrudMask(value: unknown): value is number;
export function crudMaskHas(mask: number, action: CrudAction): boolean; // (mask & bit) !== 0
/** The mask with `action` turned on or off. */
export function crudMaskWith(mask: number, action: CrudAction, enabled: boolean): number;
/** Actions in CRUD_ACTIONS order. Bits above 8 are ignored. */
export function crudMaskToActions(mask: number): CrudAction[];
```

Implement `isCrudAction` with `CRUD_ACTIONS.some((action) => action === value)` (the pattern in
`packages/helpers/src/lib/accountSession.ts`), no `as`.

## `packages/helpers/src/lib/apiKey.ts` (new)

Imports `CRUD_ACTIONS`, `CRUD_BITS`, `CRUD_MASK_ALL`, `CRUD_MASK_NONE`, `crudMaskHas`,
`isCrudMask` and `type CrudAction` from `./crudBitmask.js`; `DATABASE_CONSTANTS` from
`./constants/databaseConstants.js`; `ONE_DAY_MS`, `ONE_MINUTE_MS` from `./timeConstants.js`.

### Token format

```ts
/** Every key starts with this, so the API tells a key from a session JWT before verifying it. */
export const API_KEY_TOKEN_PREFIX = 'pvk_';
/** Random bytes after the prefix, base64url-encoded (43 characters). */
export const API_KEY_SECRET_BYTES = 32;
/** Trailing characters of the token kept on the row so the owner can tell keys apart. */
export const API_KEY_TOKEN_HINT_LENGTH = 4;

export function hasApiKeyTokenPrefix(value: string): boolean; // value.startsWith(prefix)
/** `pvk_` followed by exactly 43 base64url characters. */
export function isApiKeyTokenFormat(value: string): boolean; // /^pvk_[A-Za-z0-9_-]{43}$/
/** `pvk_…abcd` for display. */
export function formatApiKeyTokenHint(tokenHint: string): string;
```

A session JWT starts with `eyJ` and has dots; base64url has no dots, so the prefix check is
unambiguous.

### Resource catalog (R23)

```ts
export const API_KEY_RESOURCES = [
  'account',
  'settings',
  'subscriptions',
  'add_by_rss',
  'playlists',
  'queue',
  'history',
  'clips',
  'notifications',
] as const;
export type ApiKeyResource = (typeof API_KEY_RESOURCES)[number];
export function isApiKeyResource(value: unknown): value is ApiKeyResource;
```

The array order is the display order on web and mobile. Put one doc comment above the array
listing what each resource covers. This is guidance for route mapping (area B decides the final
route table) and for the labels web and mobile show:

| Resource | Covers |
| --- | --- |
| `account` | The account's own profile: `GET /auth/me`, profile edits, published profile content. Never password, email, or account deletion. |
| `settings` | Account settings: locale, playback, listen stats, notification settings, device auto-download. |
| `subscriptions` | Followed podcasts, accounts, and playlists; subscribed lists; seen state; OPML import and export. |
| `add_by_rss` | Add by RSS feeds: parse requests, followed Add by RSS channels, their chapters and transcripts. |
| `playlists` | The account's playlists, their items, and playlist likes. |
| `queue` | The queue and now playing. |
| `history` | Listening history: the content log and the taste profile. Never listen or open reports (`/stats/listen`, `/stats/open`). |
| `clips` | The account's clips. |
| `notifications` | The notification inbox, preferences, notification channels, and push devices. |

Every resource stores a full 0–15 mask. Which of its four actions any route uses is the
supported-actions list below.

### Supported actions (R74)

```ts
/**
 * The actions some route checks for each resource, in CRUD_ACTIONS order. Web and mobile render a
 * checkbox for each listed action and a dash in every other cell; the OpenAPI spec describes the
 * same list. A stored mask may still hold an unlisted bit (presets set every bit); it opens nothing
 * until a route starts checking that action.
 */
export const API_KEY_SUPPORTED_ACTIONS: Readonly<Record<ApiKeyResource, readonly CrudAction[]>> = {
  account: ['read', 'update'],
  settings: ['update'],
  subscriptions: ['create', 'read', 'update', 'delete'],
  add_by_rss: ['create', 'read', 'delete'],
  playlists: ['create', 'read', 'update', 'delete'],
  queue: ['create', 'read', 'update', 'delete'],
  history: ['read', 'update'],
  clips: ['create', 'read', 'update', 'delete'],
  notifications: ['create', 'read', 'update', 'delete'],
};

export function apiKeyResourceSupportsAction(resource: ApiKeyResource, action: CrudAction): boolean;
// API_KEY_SUPPORTED_ACTIONS[resource].includes(action)
```

The unsupported cells are exactly: `account` create and delete; `settings` create, read, and
delete; `add_by_rss` update; `history` create and delete. Write the object literal as above, with
the type annotation and no `as`. Adding an action to a resource later is a one-line edit here plus
the route that checks it.

Only `apiKeyPermissionsGrantSupported` reads the list. `normalizeApiKeyPermissions` keeps unsupported bits,
`apiKeyPermissionsAllow` checks the mask as stored, and the presets set every bit (below).

### Permissions

```ts
/** A CRUD mask per resource. Stored keys and DTOs always carry every resource. */
export type ApiKeyPermissions = Record<ApiKeyResource, number>;
/** What one route needs from a key. */
export type ApiKeyPermissionRequirement = { resource: ApiKeyResource; action: CrudAction };

export function emptyApiKeyPermissions(): ApiKeyPermissions; // every resource 0
/**
 * Reads a stored or submitted object. Unknown resources are dropped; a missing resource or a value
 * that is not a CRUD mask reads as 0. Bits outside API_KEY_SUPPORTED_ACTIONS are kept. Never throws.
 */
export function normalizeApiKeyPermissions(value: unknown): ApiKeyPermissions;
export function apiKeyPermissionsAllow(
  permissions: ApiKeyPermissions,
  requirement: ApiKeyPermissionRequirement
): boolean;
/**
 * True when at least one cell that API_KEY_SUPPORTED_ACTIONS lists is set. Unsupported bits do not
 * count. The create endpoint, the web form, and the mobile form all use this one check.
 */
export function apiKeyPermissionsGrantSupported(permissions: ApiKeyPermissions): boolean;
```

Build records by iterating `API_KEY_RESOURCES` and reading input keys with `Reflect.get` on a
checked `typeof value === 'object' && value !== null && !Array.isArray(value)` object, no `as`.
`emptyApiKeyPermissions` may build with `Object.fromEntries` only if the result is typed without
`as`; otherwise write a loop that assigns into a `ApiKeyPermissions` literal initialised with
every resource set to `CRUD_MASK_NONE`.

### Presets (R26, R75)

```ts
export const API_KEY_PRESET_IDS = ['read_only', 'full_access'] as const;
export type ApiKeyPresetId = (typeof API_KEY_PRESET_IDS)[number];
/**
 * read_only: CRUD_BITS.read on every resource. full_access: CRUD_MASK_ALL on every resource.
 * Both set bits outside API_KEY_SUPPORTED_ACTIONS, so a key made from a preset picks up an action
 * as soon as a route starts checking it.
 */
export function apiKeyPermissionsForPreset(presetId: ApiKeyPresetId): ApiKeyPermissions;
/** The preset these permissions equal exactly, or null (the clients show "Custom"). */
export function findApiKeyPresetId(permissions: ApiKeyPermissions): ApiKeyPresetId | null;
```

Presets never filter through `API_KEY_SUPPORTED_ACTIONS`: Read Only stores 2 on `settings` and
Full Access stores 15 on every resource. Full Access never reaches the routes a key can never use
(key management, password, email, account deletion, billing); say so in the doc comment.

### Expiration (R40)

```ts
/** Days until a new key expires; null means it never expires. */
export const API_KEY_EXPIRATION_DAYS_OPTIONS = [30, 90, 365, null] as const;
export type ApiKeyExpirationDays = (typeof API_KEY_EXPIRATION_DAYS_OPTIONS)[number];
export const API_KEY_DEFAULT_EXPIRATION_DAYS: ApiKeyExpirationDays = 90;
export function isApiKeyExpirationDays(value: unknown): value is ApiKeyExpirationDays;
/** createdAt plus that many days, or null. */
export function apiKeyExpiresAt(createdAt: Date, days: ApiKeyExpirationDays): Date | null;
/** False for null. A string is parsed as an ISO date. */
export function isApiKeyExpired(expiresAt: Date | string | null, now: Date): boolean;
```

A key whose `expires_at` is at or before `now` is expired.

### Limits and timing

```ts
export const API_KEY_NAME_MAX_LENGTH = DATABASE_CONSTANTS.varchar_short; // 50
/** Keys an account may hold, expired ones included. Creating one more answers 409. */
export const API_KEY_MAX_PER_ACCOUNT = 20;
/** last_used_at is written at most once per this interval of use. */
export const API_KEY_LAST_USED_INTERVAL_MS = 5 * ONE_MINUTE_MS;
```

### Error codes (R8)

```ts
export const API_KEY_ERROR_CODES = {
  /** 401: unknown, malformed, or revoked key. */
  invalid: 'api_key_invalid',
  /** 401: the key's expiry has passed. */
  expired: 'api_key_expired',
  /** 403: this route never accepts a key. */
  notAllowed: 'api_key_not_allowed',
  /** 403: the key lacks the permission the route needs; the body names it. */
  permissionDenied: 'api_key_permission_denied',
  /** 400: a create request granted no supported permission. */
  permissionsEmpty: 'api_key_permissions_empty',
  /** 409: the account already holds API_KEY_MAX_PER_ACCOUNT keys. */
  limitReached: 'api_key_limit_reached',
} as const;
export type ApiKeyErrorCode = (typeof API_KEY_ERROR_CODES)[keyof typeof API_KEY_ERROR_CODES];
```

An expired membership keeps the existing `membership_expired` 403 body; terms keep
`terms_acceptance_required`. No new codes for those.

## `packages/helpers/src/dtos/account/accountApiKey.ts` (new)

```ts
import type { ApiKeyExpirationDays, ApiKeyPermissions } from '../../lib/apiKey.js';

/** One API key of the signed-in account. Dates are ISO 8601 strings. The token is never listed. */
export type DTOAccountApiKey = {
  id_text: string;
  name: string;
  /** Last characters of the token; show with formatApiKeyTokenHint. */
  token_hint: string;
  permissions: ApiKeyPermissions;
  created_at: string;
  /** Null when the key never expires. */
  expires_at: string | null;
  /** Last accepted request, kept to within API_KEY_LAST_USED_INTERVAL_MS. Null until first use. */
  last_used_at: string | null;
};

/** The create response: the only time the token is returned. */
export type DTOAccountApiKeyCreated = {
  api_key: DTOAccountApiKey;
  token: string;
};

/** POST /auth/api-keys body. Omitted expires_in_days means API_KEY_DEFAULT_EXPIRATION_DAYS. */
export type AccountApiKeyCreateBody = {
  name: string;
  permissions: Partial<ApiKeyPermissions>;
  expires_in_days?: ApiKeyExpirationDays;
};
```

## Exports

- `packages/helpers/src/dtos/index.ts`: add `export * from './account/accountApiKey.js';` beside
  `./account/accountSession.js`.
- `packages/helpers/src/index.ts`: add `export * from './lib/apiKey.js';` and
  `export * from './lib/crudBitmask.js';` beside `./lib/accountSession.js`. Grep the index first;
  none of these names is exported today.

## Tests

- `packages/helpers/src/lib/crudBitmask.test.ts` (unit): `crudMaskHas` per bit, on 0, on 15, and
  on a combined mask (`read | update` has read and update, not create or delete), which is the
  coverage plan 14 relies on when it deletes `apps/management-api/src/lib/crud.test.ts`;
  `crudMaskWith` on and off; `crudMaskToActions(15)` and `(0)`; `isCrudMask` rejects -1, 16, 2.5,
  '2'.
- `packages/helpers/src/lib/apiKey.test.ts` (unit):
  - `isApiKeyTokenFormat` accepts `pvk_` plus 43 base64url characters and rejects a JWT-shaped
    string, a short token, and one with a dot; `hasApiKeyTokenPrefix` accepts a short `pvk_x`.
  - `normalizeApiKeyPermissions` fills missing resources with 0, drops unknown keys, turns
    out-of-range or non-integer values into 0, and returns all zeros for null, arrays, and strings.
  - Each preset round-trips through `findApiKeyPresetId`; a mixed mask returns null.
  - Presets keep the full mask: Full Access is 15 and Read Only is 2 on every resource, including
    `settings` and `history`.
  - `API_KEY_SUPPORTED_ACTIONS` has an entry for every resource in `API_KEY_RESOURCES`, and each
    entry is in `CRUD_ACTIONS` order with no repeats.
  - `apiKeyResourceSupportsAction` is false for exactly the eight unsupported cells (`account`
    create and delete; `settings` create, read, and delete; `add_by_rss` update; `history` create
    and delete) and true for the other 28. Write the eight as a literal list in the test, not
    derived from the constant.
  - `normalizeApiKeyPermissions({ settings: 2, history: 15 })` keeps 2 and 15.
  - `API_KEY_MAX_PER_ACCOUNT` is 20.
  - `apiKeyPermissionsAllow`.
  - `apiKeyPermissionsGrantSupported` is false for `emptyApiKeyPermissions()`, false for a mask
    that sets only unsupported bits (`{ settings: 2, history: 9 }`, every other resource 0), and
    true for `apiKeyPermissionsForPreset('read_only')` and for `account` read alone.
  - `apiKeyExpiresAt` for 30 days and null; `isApiKeyExpired` at, before, and after the instant,
    and for null and an ISO string.

## Release scratchpad

none
