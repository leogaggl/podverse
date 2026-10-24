**Cursor model:** Cursor Grok 4.7 · **Reasoning:** high

# 40 — Mobile API key helpers

Pure functions and the authenticated request wrappers the Developer screens call. No navigation,
no catalog, no screen. The list is account data that changes on other devices, so nothing here
writes SQLite, AsyncStorage, or SecureStore, and the create token is only a return value.

## Rows

R4, R10, R38, R39, R48, R51, R71, R77, R82

## Runs after

13

## Files

apps/mobile/src/auth/accountApiKeys.ts
apps/mobile/src/screens/more/accountApiKeyRows.ts
apps/mobile/src/screens/more/accountApiKeyRows.test.ts
apps/mobile/src/config/apiDocsUrl.ts
apps/mobile/src/config/apiDocsUrl.test.ts

## Reuse

Copy the shape of `apps/mobile/src/auth/accountSessions.ts` for the wrappers and
`apps/mobile/src/screens/more/accountSessionRows.ts` for the row mapper. Expiration, presets,
hints, the expired check, and `apiKeyResourceSupportsAction` come from plan 10
(`packages/helpers/src/lib/apiKey.ts`, `crudBitmask.ts`). Request methods come from plan 13
(`reqAuthApiKeys`, `reqAuthApiKeyCreate`, `reqAuthApiKeyRevoke`). Import values from
`@podverse/helpers` the way `MoreSettingsSessionsScreen` imports `formatDateAbbrev`. Import DTO
types with `import type` from `@podverse/helpers/dto`. Do not add a helpers subpath and do not
edit `packages/helpers`.

The permission summary matches plan 30's `summarizeApiKeyPermissions`. Web's copy lives in
`apps/web` and mobile cannot import it, so this module owns the mobile copy of that algorithm.

## `apps/mobile/src/config/apiDocsUrl.ts`

Swagger UI is registered at `${api prefix}${api version}/docs`, and the raw document at
`${api prefix}${api version}/docs.yaml` (`registerSwaggerDocs` in
`apps/api/src/lib/docs/registerSwaggerDocs.ts`). `getMobileConfig().api.baseUrl` is already
that prefix plus version, including a custom API override (`apps/mobile/src/config/index.ts`).

One trailing slash on the base is stripped. Do not strip `/api/v2`.

```ts
const withDocsPath = (apiBaseUrl: string | null, path: '/docs' | '/docs.yaml'): string | null => {
  if (apiBaseUrl === null || apiBaseUrl === '') {
    return null;
  }
  return `${apiBaseUrl.replace(/\/$/, '')}${path}`;
};

/** Swagger UI for this API base, or null when the app has no server address. */
export const apiDocsUrl = (apiBaseUrl: string | null): string | null =>
  withDocsPath(apiBaseUrl, '/docs');

/** Raw OpenAPI document URL for this API base, or null when the app has no server address. */
export const apiDocsYamlUrl = (apiBaseUrl: string | null): string | null =>
  withDocsPath(apiBaseUrl, '/docs.yaml');
```

Plan 41 opens `apiDocsUrl` in the system browser and copies `apiDocsYamlUrl` to the clipboard.

## `apps/mobile/src/auth/accountApiKeys.ts`

Same deps type and `requestWithMobileAuthRefresh` as `accountSessions.ts`. A short comment:
the list changes from other devices, so callers fetch it when the screen opens and do not
write it to device storage. The create result's `token` is the caller's to show once; this
function does not log it.

```ts
export const fetchAccountApiKeys = (deps: AuthRequestDeps): Promise<DTOAccountApiKey[]> =>
  requestWithMobileAuthRefresh(deps, (api) => api.reqAuthApiKeys());

export const createAccountApiKey = (
  deps: AuthRequestDeps,
  body: AccountApiKeyCreateBody
): Promise<DTOAccountApiKeyCreated> =>
  requestWithMobileAuthRefresh(deps, (api) => api.reqAuthApiKeyCreate(body));

export const revokeAccountApiKey = async (
  deps: AuthRequestDeps,
  apiKeyIdText: string
): Promise<void> => {
  await requestWithMobileAuthRefresh(deps, (api) => api.reqAuthApiKeyRevoke(apiKeyIdText));
};
```

## `apps/mobile/src/screens/more/accountApiKeyRows.ts`

Imports: `API_KEY_RESOURCES`, `CRUD_ACTIONS`, `apiKeyPermissionsForPreset`,
`apiKeyResourceSupportsAction`, `crudMaskHas`, `crudMaskToActions`, `crudMaskWith`,
`findApiKeyPresetId`, `formatApiKeyTokenHint`, `isApiKeyExpired`, and the types
`ApiKeyExpirationDays`, `ApiKeyPermissions`, `ApiKeyPresetId`, `ApiKeyResource`, `CrudAction`
from `@podverse/helpers`. `AccountApiKeyCreateBody` and `DTOAccountApiKey` as types from
`@podverse/helpers/dto`. No `as`.

```ts
export type ApiKeyPermissionSummary =
  | { kind: 'preset'; presetId: ApiKeyPresetId }
  | { kind: 'custom'; lines: { resource: ApiKeyResource; actions: CrudAction[] }[] };

/**
 * Preset when the whole mask matches, including bits no route checks.
 * Otherwise one line per resource that still has a supported action.
 */
export const summarizeApiKeyPermissions = (
  permissions: ApiKeyPermissions
): ApiKeyPermissionSummary => {
  const presetId = findApiKeyPresetId(permissions);
  if (presetId !== null) {
    return { kind: 'preset', presetId };
  }
  const lines: { resource: ApiKeyResource; actions: CrudAction[] }[] = [];
  for (const resource of API_KEY_RESOURCES) {
    const actions = crudMaskToActions(permissions[resource]).filter((action) =>
      apiKeyResourceSupportsAction(resource, action)
    );
    if (actions.length > 0) {
      lines.push({ resource, actions });
    }
  }
  return { kind: 'custom', lines };
};

export type ApiKeyListRow = {
  idText: string;
  name: string;
  /** Display form from formatApiKeyTokenHint, such as pvk_…abcd. */
  hintLabel: string;
  summary: ApiKeyPermissionSummary;
  createdAt: string;
  expiresAt: string | null;
  lastUsedAt: string | null;
  isExpired: boolean;
};

/** Server order, newest first. `now` is the clock the caller passes in. */
export const toApiKeyListRows = (
  keys: readonly DTOAccountApiKey[],
  now: Date
): ApiKeyListRow[] =>
  keys.map((key) => ({
    idText: key.id_text,
    name: key.name,
    hintLabel: formatApiKeyTokenHint(key.token_hint),
    summary: summarizeApiKeyPermissions(key.permissions),
    createdAt: key.created_at,
    expiresAt: key.expires_at,
    lastUsedAt: key.last_used_at,
    isExpired: isApiKeyExpired(key.expires_at, now),
  }));

export const withoutApiKey = (
  rows: readonly ApiKeyListRow[],
  idText: string
): ApiKeyListRow[] => rows.filter((row) => row.idText !== idText);
```

`findApiKeyPresetId` compares the whole mask. A mask that ticks every supported cell and leaves
the unsupported bits at 0 is custom, not Full Access. A Full Access mask stays Full Access when
a supported cell is turned off and back on, because those bits were already set. This function
does not clear unsupported bits.

Expiration choices are strings because `OptionListScreen` is generic over `string`. `none` is
the no-expiration choice. `90` is the screen default; this module does not apply that default.

```ts
export const API_KEY_EXPIRATION_CHOICES = ['30', '90', '365', 'none'] as const;
export type ApiKeyExpirationChoice = (typeof API_KEY_EXPIRATION_CHOICES)[number];

export const expirationChoiceFromDays = (days: ApiKeyExpirationDays): ApiKeyExpirationChoice => {
  switch (days) {
    case 30:
      return '30';
    case 90:
      return '90';
    case 365:
      return '365';
    case null:
      return 'none';
  }
};

export const expirationDaysFromChoice = (choice: ApiKeyExpirationChoice): ApiKeyExpirationDays => {
  switch (choice) {
    case '30':
      return 30;
    case '90':
      return 90;
    case '365':
      return 365;
    case 'none':
      return null;
  }
};
```

Permission edits. `toggleApiKeyPermission` returns a new object; it does not mutate the input.
Build it by copying each resource from `API_KEY_RESOURCES` and replacing the one resource's
mask with `crudMaskWith`. Callers never call it for a cell `apiKeyResourceSupportsAction`
rejects.

```ts
export const toggleApiKeyPermission = (
  permissions: ApiKeyPermissions,
  resource: ApiKeyResource,
  action: CrudAction
): ApiKeyPermissions;

export const apiKeyPermissionChecked = (
  permissions: ApiKeyPermissions,
  resource: ApiKeyResource,
  action: CrudAction
): boolean; // crudMaskHas(permissions[resource], action)

export const apiKeyPermissionCellKind = (
  resource: ApiKeyResource,
  action: CrudAction
): 'checkbox' | 'unsupported';
// 'checkbox' when apiKeyResourceSupportsAction(resource, action) is true, otherwise 'unsupported'
```

The "at least one permission" check is `apiKeyPermissionsGrantSupported` from
`@podverse/helpers` (plan 10), the same check the create endpoint runs. Import it where it is
used; do not define a mobile copy.

The eight unsupported pairs, from plan 10, are account create and delete; settings create,
read, and delete; add_by_rss update; history create and delete. The other 28 pairs are
checkboxes. Walk `API_KEY_RESOURCES` and `CRUD_ACTIONS`; do not hard-code a second list of the
eight pairs in this file. The unit test below is the place that names them.

Create access. List and revoke do not call this. `unknown` means the account snapshot has not
arrived: the screen opens the form and the create request takes the server's answer.
`isExpired` is checked before `isMember`, so an expired account never takes the never-had
branch.

```ts
export type ApiKeyCreateAccess = 'allowed' | 'membership_expired' | 'needs_membership' | 'unknown';

export const apiKeyCreateAccess = (input: {
  isTierKnown: boolean;
  isMember: boolean;
  isExpired: boolean;
}): ApiKeyCreateAccess => {
  if (!input.isTierKnown) {
    return 'unknown';
  }
  if (input.isExpired) {
    return 'membership_expired';
  }
  if (input.isMember) {
    return 'allowed';
  }
  return 'needs_membership';
};
```

`useMembership()` is `deriveMembershipState` on the loaded account. `isExpired` means
`membership_expires_at` is set and in the past. `isMember` false and `isExpired` false means
no expiry timestamp, including a missing membership status row (`tier` null).

```ts
export const toApiKeyCreateBody = (input: {
  name: string;
  permissions: ApiKeyPermissions;
  expiresIn: ApiKeyExpirationChoice;
}): AccountApiKeyCreateBody => ({
  name: input.name.trim(),
  permissions: input.permissions,
  expires_in_days: expirationDaysFromChoice(input.expiresIn),
});
```

The create screen's initial permissions are `apiKeyPermissionsForPreset('read_only')`, called
from the screen, not from this mapper. The account key cap is `API_KEY_MAX_PER_ACCOUNT` (20)
from plan 10. This module does not repeat that number. `API_KEY_NAME_MAX_LENGTH` (50) is the
name length, not the key cap.

## Tests

`apps/mobile/src/config/apiDocsUrl.test.ts` (unit):

- `apiDocsUrl('http://localhost:4230/api/v2')` and `apiDocsUrl('http://localhost:4230/api/v2/')`
  are both `http://localhost:4230/api/v2/docs`.
- `apiDocsYamlUrl` on those two bases is `http://localhost:4230/api/v2/docs.yaml`.
- `https://example.com/api/v2` keeps `/api/v2` and only gains the suffix.
- `null` and `''` return null from both functions.

`apps/mobile/src/screens/more/accountApiKeyRows.test.ts` (unit):

- `toApiKeyListRows` keeps server order, fills `hintLabel` via the real
  `formatApiKeyTokenHint`, sets `summary` to `{ kind: 'preset', presetId: 'read_only' }` for
  `apiKeyPermissionsForPreset('read_only')`, and sets `isExpired` true when `expires_at` is
  before `now`, false for a later instant and for null.
- `summarizeApiKeyPermissions`:
  - `read_only` and `full_access` presets summarize to that preset, including Full Access,
    whose mask sets unsupported bits.
  - A mask with only `playlists` read and update summarizes to custom with that one line and
    actions `['read', 'update']`.
  - `emptyApiKeyPermissions()` summarizes to custom with no lines.
  - A mask with only `account` create summarizes to custom with no lines.
  - A mask with `playlists` read and `account` create summarizes to custom with one line,
    `playlists` / `['read']`.
  - Turning every supported cell on from `emptyApiKeyPermissions()` stays custom. It does not
    become `full_access`.
- `withoutApiKey` drops one id.
- `expirationChoiceFromDays` / `expirationDaysFromChoice` round-trip 30, 90, 365, and null.
- `toggleApiKeyPermission` turns playlists read off on a read-only preset and leaves queue
  read on. `apiKeyPermissionChecked` matches.
- `apiKeyPermissionCellKind` is `'unsupported'` for exactly these eight pairs: account create,
  account delete, settings create, settings read, settings delete, add_by_rss update, history
  create, history delete. The other 28 pairs from `API_KEY_RESOURCES` × `CRUD_ACTIONS` are
  `'checkbox'`.
- `apiKeyCreateAccess`: unknown when `isTierKnown` is false, even if the other flags are
  false; `membership_expired` when `isExpired` is true, including when `isMember` is also
  true; allowed when `isExpired` is false and `isMember` is true; `needs_membership` when the
  tier is known, `isExpired` is false, and `isMember` is false.
- `toApiKeyCreateBody` trims the name and sends `expires_in_days: null` for `'none'`.

No unit test for `accountApiKeys.ts`. It only forwards to `requestWithMobileAuthRefresh`, the
same as `accountSessions.ts`.

## Release scratchpad

none
