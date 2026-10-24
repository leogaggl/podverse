**Cursor model:** Cursor Grok 4.7 · **Reasoning:** high

# 30 — Web Developer tab, key list, and revoke

Adds the signed-in Developer tab at `/settings?tab=developer`, the key list, and revoke with
confirm. The create form is plan 31. There is no Developer tab today (R5): `TabKey` in
`Settings.tsx` is `account`, `advanced`, `general`, `keyboard`, `notifications`, `opml`, and
`profile`.

## Rows

R5, R6, R9, R36, R43, R45, R47, R50, R52, R68, R76

## Runs after

13

## Files

apps/web/src/components/Settings/Settings.tsx
apps/web/src/components/Settings/Panels/SettingsDeveloper/SettingsDeveloper.tsx
apps/web/src/components/Settings/Panels/SettingsDeveloper/ModalRevokeApiKey.tsx
apps/web/src/components/Settings/Panels/SettingsDeveloper/apiKeyDisplay.ts
apps/web/src/components/Settings/Panels/SettingsDeveloper/apiKeyDisplay.test.ts
apps/web/src/styles/components/Settings/Panels/SettingsDeveloper/SettingsDeveloper.module.scss
packages/i18n-catalog/consumer/originals/en-US.json
packages/i18n-catalog/consumer/originals/es.json
packages/i18n-catalog/consumer/originals/fr.json
packages/i18n-catalog/consumer/originals/el-GR.json
packages/i18n-catalog/consumer/overrides/es.json
packages/i18n-catalog/consumer/overrides/fr.json
packages/i18n-catalog/consumer/overrides/el-GR.json
tools/web/seed-e2e.mjs
apps/web/e2e/settings-developer.spec.ts
makefiles/local/e2e-spec-order-web.txt
release-notes/scratchpad.md

## Tests

- Unit: `apiKeyDisplay.test.ts` (Vitest, picked up by the web workspace `test` script).
- Playwright: `apps/web/e2e/settings-developer.spec.ts`. Plan 31 appends the create tests to that
  file. Insert the spec in `makefiles/local/e2e-spec-order-web.txt` immediately after
  `apps/web/e2e/settings-account-change-password.spec.ts`.

CRUD and membership matrix for this surface:

| Behavior | Status |
| --- | --- |
| Read the list, empty state, signed-out redirect | Covered in this plan's spec |
| Revoke, including cancel | Covered for an account with a valid membership |
| Revoke while membership is expired | Deferred. The expired seed account has no key, and create requires a valid membership, so this spec cannot mint one. Plan 13's `account-api-keys.integration.test.ts` covers expired list and revoke. The button this plan renders is the one the valid-membership spec clicks. |
| Update a key | Deferred. The API has no update endpoint. A key is revoked and a new one is created. |
| Load-error branch | Deferred. Same spinner and Try Again pattern as `SettingsSessions`, with no fault injection in this suite. |
| Create, validation, expired create | Plan 31 |
| Anonymous | Covered (redirect) |
| Valid membership (seeded trial) | Covered |
| Expired membership | Covered for opening the tab and seeing the empty list |
| Free (no membership) | Seeded as `e2e-api-keys-none@example.com` with no membership status row. Opening the tab shows the same empty list. Create copy is plan 31. |
| Expiring soon, premium-only | Deferred. Expiring soon can create. Create is not premium-only. |

## Release scratchpad

```markdown
## Developer tab lists and revokes API keys

- Surfaces: web
- Change: Settings gains a Developer tab at `/settings?tab=developer` for signed-in accounts.
  It lists each API key with its name, token hint, permission summary, created time, expiry, and
  last-used time, and revokes a key after confirmation. An expired membership can still open the
  tab, see keys, and revoke them. The tab links to the interactive API reference at
  `<api base>/docs` and the raw spec at `<api base>/docs.yaml`. A custom key's permission
  summary names only the actions some route checks. It does not show an MCP configuration.
- Who notices: signed-in people who open Settings
- Operator steps: none
```

## Reuse

Copy the load, row, and revoke shape from
`apps/web/src/components/Settings/Panels/SettingsAccount/SettingsSessions.tsx` and
`ModalSignOutOtherDevices.tsx`. Copy the row layout from
`apps/web/src/styles/components/Settings/Panels/SettingsAccount/SettingsSessions.module.scss`
(`rows`, `row`, `rowText`, `name`, `meta`). Use `SettingsSection`, `Button`, `Modal`,
`Modal.Body`, `Modal.Actions`, and `LoadingSpinner` from `@podverse/ui`. Dates use
`formatDateTimeAbbrev` from `@podverse/helpers` with `useLocale()`.

Consume plan 10 and plan 13. Do not edit `@podverse/helpers` or `@podverse/helpers-requests`.

- List: `getApiRequestService().reqAuthApiKeys()` → `DTOAccountApiKey[]`, newest first.
- Revoke: `reqAuthApiKeyRevoke(idText)`.
- Hint text: `formatApiKeyTokenHint(row.token_hint)` (`pvk_…` plus the hint).
- Preset vs custom: `findApiKeyPresetId`.
- Expired key: `isApiKeyExpired(row.expires_at, new Date())`.
- Actions on a custom mask: `crudMaskToActions`, then drop any action
  `apiKeyResourceSupportsAction` rejects (plan 10).
- Resource order: `API_KEY_RESOURCES`. Action order: `CRUD_ACTIONS`.
- Doc URLs: `apiDocsUrl` and `apiDocsYamlUrl` in `apiKeyDisplay.ts`.

Error status and code: `getErrorResponseStatus` and `getErrorResponseBodyCode` from
`@podverse/helpers`, then `handleRateLimitAlert` from
`apps/web/src/utils/rateLimit/rateLimitAlert.ts`, matching `SettingsSessions`.

## Settings tab

In `apps/web/src/components/Settings/Settings.tsx`:

- Add `'developer'` to the `TabKey` union and to `tabFromQueryParam`, beside `'advanced'`.
- In `tabData`, after the `advanced` push and before the `keyboard` push, when
  `loggedInAccount` is set, push `{ key: 'developer', label: tSettings('developer.developer'), … }`
  using the same `z` decrement.
- Render `{loggedInAccount && tab === 'developer' && <SettingsDeveloper />}` after the advanced
  panel.
- Leave the signed-out redirect as it is. Once `developer` parses, a signed-out visit to
  `?tab=developer` already falls through to `setTab('general')` and `router.replace('/settings')`,
  because the effect allows only `general` and `keyboard`.

The tab is a button (the shared `Tab` component), same as Advanced.

## Panel

`SettingsDeveloper` is a client component. Namespace `useTranslations('settings.developer')`.
Also `useTranslations('misc')` for `loading`, `try_again`, `cancel`, `close_modal`.

```tsx
<SettingsSection>
  <h3 id="settings-api-keys-heading">{t('heading')}</h3>
  <p>{t('description')}</p>
  <p>{t('key_cannot')}</p>
  <p>
    <a href={apiDocsUrl(getClientApiBaseUrl())} target="_blank" rel="noopener noreferrer">
      {t('api_reference')}
    </a>
  </p>
  <p className={styles.meta}>{t('api_reference_hint')}</p>
  <p>
    <a href={apiDocsYamlUrl(getClientApiBaseUrl())} target="_blank" rel="noopener noreferrer">
      {t('api_spec')}
    </a>
  </p>
  <p className={styles.meta}>{t('api_spec_hint')}</p>
  {/* plan 31 inserts the Create API Key button here */}
  {/* loading / error / list */}
</SettingsSection>
```

`apiDocsUrl` and `apiDocsYamlUrl` live in `apiKeyDisplay.ts`. Each strips one trailing slash
from the API base (`getClientApiBaseUrl()` in `apps/web/src/factories/apiRequestService.ts`)
and appends `/docs` or `/docs.yaml`. Those are the Swagger UI and the raw spec the API serves
from `openapi.yml` (R68). Each link's text is the whole control, so the catalog strings stay
plain (mobile shares them and cannot render a next-intl rich tag).

The visible copy is only the catalog strings in this plan. That includes the sentence about
sending an Authorization Bearer header. It does not include an MCP configuration, a JSON
example, or a sample client config (R52).

Load state matches sessions: `{ status: 'loading' } | { status: 'error' } | { status: 'ready'; rows }`.
Reload with a `reloadToken`. Loading shows `LoadingSpinner` with `ariaLabel={tMisc('loading')}`.
Error shows `t('load_error')` in a `role="alert"` paragraph and a secondary Try Again button.
Ready and `rows.length === 0` shows `t('empty')`. Ready and non-empty shows the list,
`aria-labelledby="settings-api-keys-heading"`.

Keep the server order. Do not re-sort.

## List row

Each `li` shows:

- Name (`styles.name`).
- Token hint from `formatApiKeyTokenHint`.
- Permission summary from `summarizeApiKeyPermissions` (below).
- `t('created', { date: formatDateTimeAbbrev(row.created_at, locale) })`.
- When `expires_at` is null: `t('no_expiration')`. Otherwise
  `t('expires', { date: formatDateTimeAbbrev(row.expires_at, locale) })`. When
  `isApiKeyExpired(row.expires_at, new Date())` is true, also show `t('expired')`.
- When `last_used_at` is null: `t('never_used')`. Otherwise
  `t('last_used', { date: formatDateTimeAbbrev(row.last_used_at, locale) })`.

A secondary Revoke button, `aria-label={t('revoke_aria', { name: row.name })}`, `isLoading` and
`disabled` while that id is in flight. An in-flight `Set` plus a ref, matching
`endingIdsRef` in `SettingsSessions`, so a second click does not double-send.

`apiKeyDisplay.ts` (named exports, no React):

```ts
export type ApiKeyPermissionSummary =
  | { kind: 'preset'; presetId: ApiKeyPresetId }
  | { kind: 'custom'; lines: { resource: ApiKeyResource; actions: CrudAction[] }[] };

export function summarizeApiKeyPermissions(permissions: ApiKeyPermissions): ApiKeyPermissionSummary;
```

`findApiKeyPresetId` non-null → `{ kind: 'preset', presetId }`. A preset match uses the whole
mask, including bits no route checks, so Full Access and Read Only still summarize to the
preset. Otherwise walk `API_KEY_RESOURCES`. For each resource, start from `crudMaskToActions`
(already `CRUD_ACTIONS` order) and keep an action only when `apiKeyResourceSupportsAction`
returns true (R76). Drop a resource whose remaining list is empty. All zeros, or only
unsupported bits, → `{ kind: 'custom', lines: [] }`.

The component maps `read_only` / `full_access` to `preset_read_only` / `preset_full_access`, and
custom lines to `t('resources.<resource>')` plus the action labels joined with `, `, lines joined
with ` · `. Empty custom lines render `preset_custom`. Use an exhaustive switch on
`ApiKeyPresetId` and on `ApiKeyResource` / `CrudAction` for the catalog keys (a helper that
returns the key union), so a new resource fails the typecheck. No `as`.

## Revoke

`ModalRevokeApiKey` matches `ModalSignOutOtherDevices`: `header` and `ariaLabel` are
`t('revoke_title')`. Body is `t('revoke_body', { name })`. `Modal.Actions` DOM order is Cancel
(`misc.cancel`, secondary) then Revoke (`t('revoke')`, primary). While `isSubmitting`, both
buttons are disabled, the primary has `isLoading`, and `onClose` from the backdrop or X returns
without closing.

Confirm calls `reqAuthApiKeyRevoke`. Success removes the row, closes the modal, and
`showToast(t('revoke_success'), 'success')`. A 404 removes the row and closes without a toast
(the key is already gone). Rate limit uses `handleRateLimitAlert`. Any other failure toasts
`t('revoke_error')` and leaves the row.

## Membership

The panel renders only for a signed-in account, including an expired one and one with no
membership. List and revoke always call the API. Those routes accept an expired session
(plan 13). Do not hide Revoke when `deriveMembershipState(loggedInAccount).isMember` is false,
and do not open the membership modal on revoke.

## i18n

Layer: **consumer** (`packages/i18n-catalog/consumer/originals/`). Web and mobile both load this
layer. Do not copy these keys into `shared/` or `mobile/`. Insert a `developer` object inside
`settings`, immediately before the existing `keyboard` object (the `advanced` object ends just
above it). Search for `"keyboard"` under `settings`; do not rewrite the catalog file.

English, title case for labels and sentence case for sentences. `{date}`, `{name}`, `{max}`,
`{resource}`, and `{action}` stay exactly those tokens in every locale. Write real `es`, `fr`,
and `el-GR` translations in the same change. Do not copy English title case into those files.
No next-intl rich tags.

Reuse, do not add: `misc.loading`, `misc.try_again`, `misc.cancel`, `misc.close_modal`.

| Key | English |
| --- | --- |
| `settings.developer.developer` | Developer |
| `settings.developer.heading` | API Keys |
| `settings.developer.description` | Create a key for a script or agent. Send it as an Authorization Bearer header. The key is shown once. |
| `settings.developer.key_cannot` | A key cannot create or revoke API keys, change your password or email, delete your account, or buy a membership. |
| `settings.developer.api_reference` | API Reference |
| `settings.developer.api_reference_hint` | Opens the interactive API reference served by this server. |
| `settings.developer.api_spec` | OpenAPI Spec |
| `settings.developer.api_spec_hint` | Opens the raw OpenAPI document served by this server. |
| `settings.developer.empty` | You have no API keys. |
| `settings.developer.load_error` | Could not load your API keys. |
| `settings.developer.last_used` | Last Used {date} |
| `settings.developer.never_used` | Never Used |
| `settings.developer.created` | Created {date} |
| `settings.developer.expires` | Expires {date} |
| `settings.developer.no_expiration` | No Expiration |
| `settings.developer.expired` | Expired |
| `settings.developer.revoke` | Revoke |
| `settings.developer.revoke_aria` | Revoke {name} |
| `settings.developer.revoke_title` | Revoke API Key |
| `settings.developer.revoke_body` | Revoke {name}? This cannot be undone. Anything using this key will stop working. |
| `settings.developer.revoke_success` | API Key Revoked |
| `settings.developer.revoke_error` | Could not revoke that API key. Please try again. |
| `settings.developer.preset_read_only` | Read Only |
| `settings.developer.preset_full_access` | Full Access |
| `settings.developer.preset_custom` | Custom |
| `settings.developer.resources.account` | Account |
| `settings.developer.resources.settings` | Settings |
| `settings.developer.resources.subscriptions` | Subscriptions |
| `settings.developer.resources.add_by_rss` | Add by RSS |
| `settings.developer.resources.playlists` | Playlists |
| `settings.developer.resources.queue` | Queue |
| `settings.developer.resources.history` | History |
| `settings.developer.resources.clips` | Clips |
| `settings.developer.resources.notifications` | Notifications |
| `settings.developer.actions.create` | Create |
| `settings.developer.actions.read` | Read |
| `settings.developer.actions.update` | Update |
| `settings.developer.actions.delete` | Delete |

Plan 31 uses more keys under the same object. Add those in this plan too, so the catalog is
edited once. Plan 31 does not edit the catalog.

| Key | English |
| --- | --- |
| `settings.developer.create` | Create API Key |
| `settings.developer.created_title` | API Key Created |
| `settings.developer.shown_once` | This key is shown once. Copy it now. You will not see it again. |
| `settings.developer.token_label` | API Key |
| `settings.developer.copy_failed` | Could Not Copy |
| `settings.developer.name` | Name |
| `settings.developer.name_placeholder` | My Agent |
| `settings.developer.name_required` | Enter a name. |
| `settings.developer.name_too_long` | Use at most {max} characters. |
| `settings.developer.expiration` | Expiration |
| `settings.developer.expiration_help` | A key stops working after this time. No Expiration means it works until you revoke it. |
| `settings.developer.expiration_30` | 30 Days |
| `settings.developer.expiration_90` | 90 Days |
| `settings.developer.expiration_365` | 365 Days |
| `settings.developer.presets` | Presets |
| `settings.developer.permissions_empty` | Grant at least one permission. |
| `settings.developer.limit_reached` | This account already has the most API keys allowed. Revoke one first. |
| `settings.developer.create_error` | Could not create that API key. Please try again. |
| `settings.developer.resources_help.account` | Your profile and the profile content you publish. |
| `settings.developer.resources_help.settings` | Playback, language, and other account settings. |
| `settings.developer.resources_help.subscriptions` | Podcasts, accounts, and playlists you follow, including OPML import and export. |
| `settings.developer.resources_help.add_by_rss` | Feeds you add by RSS. |
| `settings.developer.resources_help.playlists` | Playlists you own and playlist likes. |
| `settings.developer.resources_help.queue` | Your queue and what is playing now. |
| `settings.developer.resources_help.history` | Listening history and your taste profile. |
| `settings.developer.resources_help.clips` | Clips you create. |
| `settings.developer.resources_help.notifications` | Your notification inbox, preferences, and devices. |
| `settings.developer.membership_required` | API Keys Require a Membership |
| `settings.developer.membership_required_body` | Buy a membership to create an API key. |
| `settings.developer.action_unavailable` | {resource} {action} is not available. |

`features.copy` (`Copy`) and `features.copied` (`Copied`) already exist. Plan 31 reuses them
for the copy button. Do not add a second copy pair.

After the originals are in place, run `npm run i18n:compile` from the repo root. If it adds
empty slots to the three consumer `overrides/` files, leave those values empty and include the
files. Do not write translations into `overrides/`. Compiled output under `apps/*/i18n/compiled/`
stays uncommitted.

## Seed

In `tools/web/seed-e2e.mjs`, next to the other email constants:

```js
/** Sync with apps/web/e2e/settings-developer.spec.ts */
const E2E_API_KEYS_EMAIL = 'e2e-api-keys@example.com';
const E2E_API_KEYS_EXPIRED_EMAIL = 'e2e-api-keys-expired@example.com';
const E2E_API_KEYS_NONE_EMAIL = 'e2e-api-keys-none@example.com';
```

Insert all three accounts immediately after the `e2e-sessions@example.com` block (that block
already has `membershipExpiresAt` and `membershipStartsAt` in scope). Copy its inserts: random
`id_text` via `crypto.randomBytes(8).toString('hex').slice(0, 15)` (15 characters, inside
`nano_id_v2`), verified account, credentials with `passwordHash`, terms acceptance at
`E2E_CONFIGURED_TERMS_VERSION`, and `account_settings` with listen stats decided
(`allow_listen_stats` false, `listen_stats_accepted` false, the popularity version, `NOW()`),
matching the sessions account so Settings does not stop on a consent wall.

- `e2e-api-keys@example.com`: trial membership (`account_membership_id` 1) and a `trial`
  `billing_membership_grant` using the same future `membershipStartsAt` / `membershipExpiresAt`
  as sessions. **membership-expiry-seeds-need-grant**: write the grant in the same step as
  `membership_expires_at`, with `Date` objects.
- `e2e-api-keys-expired@example.com`: trial, `membership_expires_at` one UTC day in the past,
  grant `starts_at` 30 UTC days before that and `ends_at` equal to that past expiry.
- `e2e-api-keys-none@example.com`: the same account, credentials, terms, and
  `account_settings` rows, and no `account_membership_status` row and no
  `billing_membership_grant`. Do not write a null `membership_expires_at`. Plan 31 uses this
  account for the create gate.

Password is the existing `TEST_PASSWORD` (`Test!1Aa`). Do not insert `account_api_key` rows.

## Styles

`SettingsDeveloper.module.scss` uses the session row classes and tokens already in that file
(`--spacing-lg`, `--spacing-md`, `--spacing-sm`, `--text-color-secondary`). One argument to
`var()`. The styles import is the last import in each component.

## Unit tests

`apiKeyDisplay.test.ts`:

- Permissions from `apiKeyPermissionsForPreset('read_only')` and `'full_access'` summarize to
  that preset.
- A mask with only `playlists` read+update summarizes to custom with that one line and actions
  `['read', 'update']`.
- `emptyApiKeyPermissions()` summarizes to custom with no lines.
- A mask with only `account` create (bit 1) summarizes to custom with no lines. That bit is
  not a supported cell.
- A mask with `playlists` read and `account` create summarizes to custom with one line,
  `playlists` / `['read']`. The account line is omitted.
- `apiKeyPermissionsForPreset('full_access')` still summarizes to `full_access` even though
  that mask sets the unsupported bits.
- `apiDocsUrl('http://localhost:4030/api/v2/')` and `apiDocsUrl('http://localhost:4030/api/v2')`
  are both `http://localhost:4030/api/v2/docs`. The yaml helper appends `/docs.yaml` the same
  way, with and without a trailing slash on the base.
- An unknown extra field is not required; the helper only reads `ApiKeyPermissions`.

## Playwright

Suite title: `Developer settings`. Test titles are full sentences. After every `goto`, assert
the URL and a destination element. Pass that element to `capturePageLoad` from
`apps/web/e2e/helpers/stepScreenshots.ts`. Login is `page.request.post` to
`http://localhost:4030/api/v2/auth/login`, the same shape as
`apps/web/e2e/removed-content-log.spec.ts`. Emails match the seed constants. Password
`Test!1Aa`.

Each test that creates keys deletes them in `finally` via `GET /auth/api-keys` and
`DELETE /auth/api-keys/{id_text}`, so order between tests does not matter. The empty-state
test deletes any leftover keys first.

1. Signed out, `goto('/settings?tab=developer')`. URL matches `/\/settings$/`. The General
   control `#settings_preferred_media_type_selector` is visible (same destination check as
   `removed-content-log.spec.ts`). The button named `Developer` (exact) has count 0.
2. Signed in as `e2e-api-keys@example.com`, `goto('/settings?tab=developer')`. URL matches
   `/\/settings\?tab=developer/`. Heading `API Keys` is visible. The page shows
   `You have no API keys.` The link named `API Reference` has href
   `http://localhost:4030/api/v2/docs`. The link named `OpenAPI Spec` has href
   `http://localhost:4030/api/v2/docs.yaml`. Both open in a new tab
   (`target="_blank"`). `getByText(/MCP/)` has count 0. The sentence
   `Send it as an Authorization Bearer header.` is visible (a substring of the description).
3. With that account, `POST /auth/api-keys` twice. First body: name `Read Key`,
   `expires_in_days: 30`, `permissions` with every `API_KEY_RESOURCES` entry set to `2` (read).
   Second: name `Full Key`, `expires_in_days: null`, every resource `15`. Reload the tab. The
   list named `API Keys` has two items. The first contains `Full Key`, `Full Access`,
   `No Expiration`, and `Never Used`. The second contains `Read Key`, `Read Only`, `Expires`,
   and `Never Used`, and does not contain `No Expiration`. Each row contains `pvk_` and the
   last four characters of the token from that create response. Screenshot the list.
4. Create one key named `Revoke Key` (read on every resource, `expires_in_days: 90`). Click
   `Revoke Revoke Key`. The dialog named `Revoke API Key` is visible. Click `Cancel`. The row
   remains and the dialog is gone. Open it again, click `Revoke` (exact) inside the dialog.
   Toast text `API Key Revoked` is visible. The row is gone. `GET /auth/api-keys` does not
   include `Revoke Key`.
5. Signed in as `e2e-api-keys-expired@example.com`, open the tab. Heading `API Keys` and
   `You have no API keys.` are visible. The Developer button is visible.
6. With the valid-membership account, `POST /auth/api-keys` once. Name `Custom Key`,
   `expires_in_days: 90`, `playlists` set to `2` (read), `account` set to `1` (create), every
   other resource `0`. Reload the tab. The list item `Custom Key` contains the substring
   `Playlists Read`, and does not contain `Account`, `Full Access`, or `Read Only`. Do not
   assert the absence of the word Create: the created-time line starts with `Created`.

Do not add `test.setTimeout`. Do not assert a formatted timestamp (it depends on the locale
zone).

## Out of scope

Plan 31 adds the create button, the form, the one-time token, the dash cells, and the two
create-gate messages. This plan leaves no create control on the panel. The catalog keys for
those messages (`membership_required`, `membership_required_body`, `action_unavailable`) are
in the tables above so this plan is the only catalog edit.
