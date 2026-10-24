**Cursor model:** Cursor Grok 4.7 · **Reasoning:** high

# 31 — Web create-key flow

Adds Create API Key on the Developer tab: name, expiration, presets, a per-resource grid of
checkboxes and dashes, and a one-time token with copy. Catalog strings are already in plan 30
under `settings.developer`, including `membership_required`, `membership_required_body`, and
`action_unavailable`. Do not edit the i18n files.

## Rows

R3, R9, R15, R24, R27, R37, R41, R45, R69, R76, R82

## Runs after

30

## Files

apps/web/src/components/Settings/Panels/SettingsDeveloper/SettingsDeveloper.tsx
apps/web/src/components/Settings/Panels/SettingsDeveloper/ModalCreateApiKey.tsx
apps/web/src/components/Settings/Panels/SettingsDeveloper/apiKeyForm.ts
apps/web/src/components/Settings/Panels/SettingsDeveloper/apiKeyForm.test.ts
apps/web/src/styles/components/Settings/Panels/SettingsDeveloper/ModalCreateApiKey.module.scss
apps/web/e2e/settings-developer.spec.ts
release-notes/scratchpad.md

## Tests

- Unit: `apiKeyForm.test.ts`.
- Playwright: append to `apps/web/e2e/settings-developer.spec.ts`. The seed accounts and the
  signed-out, list, and revoke tests already exist from plan 30.

| Behavior | Status |
| --- | --- |
| Create with the default preset and expiry, secret shown once, row appears, token leaves the page | Covered |
| Cancel the form | Covered |
| Empty name, no permissions | Covered |
| Preset fills the checkboxes; a checkbox leaves the preset | Covered |
| Expired membership clicks Create and no key is posted | Covered. Dialog keeps the existing expired copy. |
| No membership status clicks Create and no key is posted | Covered. Dialog heading is API Keys Require a Membership, with Buy Membership. |
| Unsupported grid cells render a dash | Covered on the create dialog |
| 409 limit and 400 name-length | Deferred. The client blocks an empty name and a mask with no supported bit before the request, and blocks submit when the loaded list length is already `API_KEY_MAX_PER_ACCOUNT` (20). Plan 13 covers the API responses. Filling 20 keys in Playwright is skipped. |
| Update | Deferred. No update endpoint. |

## Release scratchpad

```markdown
## Developer tab creates an API key and shows it once

- Surfaces: web
- Change: The Developer tab can create an API key with a name, Read Only or Full Access or
  custom per-resource permissions. A cell no route checks renders as a dash. Expiry is 30, 90
  (the default), or 365 days or No Expiration. The token is shown once with a copy control.
  An account that never had a membership, and an expired account, can still list and revoke
  keys. Create opens the membership dialog instead of the form. The never-had heading is
  API Keys Require a Membership. The expired dialog keeps the existing expired copy. Both
  use the same Buy Membership action for a trial or an account with no tier. The account
  may hold 20 keys.
- Who notices: signed-in people creating a key in Settings
- Operator steps: none
```

## Reuse

Edit the panel from plan 30. The form uses `Modal`, `Modal.Body`, `Modal.Actions`, `StackForm`,
`TextInput`, `FormDropdown`, `RadioButton`, `CheckboxField`, `Button`, and
`CopyToClipboardButton` from `@podverse/ui`. Footer buttons inside the modal use `Modal.Actions`
(Cancel then the primary). Styles import last.

From `@podverse/helpers`: `API_KEY_RESOURCES`, `API_KEY_PRESET_IDS`, `API_KEY_EXPIRATION_DAYS_OPTIONS`,
`API_KEY_DEFAULT_EXPIRATION_DAYS`, `API_KEY_NAME_MAX_LENGTH`, `API_KEY_MAX_PER_ACCOUNT`,
`API_KEY_ERROR_CODES`, `CRUD_ACTIONS`, `CRUD_BITS`, `apiKeyPermissionsForPreset`,
`apiKeyResourceSupportsAction`, `crudMaskHas`, `crudMaskWith`, `findApiKeyPresetId`,
`isApiKeyExpirationDays`, `deriveMembershipState`, `membershipPurchaseAction`,
`membershipPurchaseMessageKey`, `APP_ROUTES`, and the types
`ApiKeyPermissions`, `ApiKeyExpirationDays`, `ApiKeyPresetId`, `ApiKeyResource`, `CrudAction`,
`DTOAccountApiKey`, `AccountApiKeyCreateBody`.

`useMembershipGate().tryHandleMembershipGateError` from `apps/web/src/hooks/useMembershipGate.ts`.
`useModals().setModalLoginRequired` from `apps/web/src/contexts/Modals.tsx`.
`useTranslations('membership')` for the purchase label. `loggedInAccount` from `useAccount()`,
the snapshot Settings already holds.
`getErrorResponseStatus` and `getErrorResponseBodyCode` from `@podverse/helpers`.
`handleRateLimitAlert` as in `ModalChangePassword.tsx`. Copy labels: `useTranslations('features')`
for `copy` and `copied`.

Calls: `reqAuthApiKeyCreate(body)` returns `DTOAccountApiKeyCreated` (`{ api_key, token }`).

## Create button

In `SettingsDeveloper`, after the OpenAPI spec hint and before the loading state, render a
primary button labeled `t('create')`. It is visible for every signed-in account, including
expired and no-membership.

On click, compute `membership = deriveMembershipState(loggedInAccount)` once. Do not open the
create modal and do not POST unless `membership.isMember` is true.

The panel tells the two blocked accounts apart with that same snapshot. It does not fetch
anything new. `deriveMembershipState` (`packages/helpers/src/lib/accountMembership.ts`) reads
`loggedInAccount.account_membership_status.membership_expires_at`:

- **Expired.** `membership.isExpired` is true. That flag is `isMembershipExpiredAt`: the
  timestamp is present and in the past. Keep the existing expired copy. Call
  `tryHandleMembershipGateError` with this value (typed as the argument it already accepts,
  `unknown`; no `as`):

```ts
{
  response: {
    status: 403,
    data: {
      code: 'membership_expired',
      i18nKey: 'membership.membership_expired',
      renewPath: APP_ROUTES.MEMBERSHIP_RENEW,
    },
  },
}
```

  The dialog header falls back to `instructions.login_required` (`Login Required`) because the
  gate props set `title: null`. The body is `membership.membership_expired` (`Your membership
  has expired.`). The action label is
  `tMembership(membershipPurchaseMessageKey(membershipPurchaseAction(membership)))`. A trial
  account's label is Buy Membership (`membership.buy_membership`). Leave `ModalLoginRequired`
  unchanged.

- **Never had a membership.** `membership.isMember` is false and `membership.isExpired` is
  false. A null or missing `membership_expires_at` is not expired: `isMembershipExpiredAt`
  returns false for null, and `hasValidMembership` returns false, so `isMember` is false.
  That is the whole distinction the snapshot can make. The seed account with no
  `account_membership_status` row lands here (`tier` null, `expiresAt` null). Do not send the
  synthetic `membership_expired` payload. Call `setModalLoginRequired` with `title`
  `t('membership_required')` (`API Keys Require a Membership`), `message`
  `t('membership_required_body')` (`Buy a membership to create an API key.`), `messageNode`
  null, `actionLabel` from the same `membershipPurchaseMessageKey(membershipPurchaseAction(...))`
  call, and `actionHref` `APP_ROUTES.MEMBERSHIP_RENEW`. `ModalLoginRequired` stays closed when
  `message` is empty, so the body sentence is what opens it. The dialog's accessible name is
  the title. For this seed, `tier` is null, so the action is Buy Membership.

Check `isExpired` first. A valid member has `isMember` true and `isExpired` false and opens
`ModalCreateApiKey`.

A 403 from `reqAuthApiKeyCreate` still goes through `tryHandleMembershipGateError` below. The
click path never POSTs for either blocked account, so that branch is only a membership that
lapses after the page loaded.

## Form state

`apiKeyForm.ts` holds the pure pieces. The modal holds React state.

Initial state, restored whenever the modal closes:

- `name`: `''`
- `permissions`: `apiKeyPermissionsForPreset('read_only')`
- `expiresInDays`: `API_KEY_DEFAULT_EXPIRATION_DAYS` (90)
- field errors cleared, `created` null

Expiration dropdown values are strings because `FormDropdown` options are strings. `null` is
the option value `'none'`.

```ts
export const API_KEY_EXPIRATION_NONE_VALUE = 'none';

export function apiKeyExpirationToDropdownValue(days: ApiKeyExpirationDays): string;
export function apiKeyExpirationFromDropdownValue(value: string): ApiKeyExpirationDays;
export function toggleApiKeyPermission(
  permissions: ApiKeyPermissions,
  resource: ApiKeyResource,
  action: CrudAction,
  enabled: boolean
): ApiKeyPermissions;
export function apiKeyCreateBody(input: {
  name: string;
  permissions: ApiKeyPermissions;
  expiresInDays: ApiKeyExpirationDays;
}): AccountApiKeyCreateBody;
export function apiKeyPermissionCellKind(
  resource: ApiKeyResource,
  action: CrudAction
): 'checkbox' | 'unsupported';
```

`apiKeyExpirationToDropdownValue` returns `'none'` for null and `String(days)` otherwise.
`apiKeyExpirationFromDropdownValue` returns null for `'none'`. For anything else, `Number` the
string and return it when `isApiKeyExpirationDays` is true; otherwise return
`API_KEY_DEFAULT_EXPIRATION_DAYS`. `toggleApiKeyPermission` returns a new permissions object
with that resource set to `crudMaskWith(...)`. `apiKeyCreateBody` trims the name and always
sends `expires_in_days` (including `null` and `90`) plus the full permissions object.
`apiKeyPermissionCellKind` returns `'checkbox'` when `apiKeyResourceSupportsAction` is true
and `'unsupported'` otherwise. The "at least one permission" check is
`apiKeyPermissionsGrantSupported` from `@podverse/helpers` (plan 10), the same check the create
endpoint runs. It is true when any supported cell is set; unsupported bits do not count.
Presets still store those bits. Do not define a local copy.

## Modal, form step

`isOpen`, `onClose`, `onCreated(apiKey: DTOAccountApiKey)`, `existingKeyCount: number | null`.
`existingKeyCount` is `rows.length` when the list is ready, otherwise null.

While `created === null`, header and `ariaLabel` are `t('create')`. `StackForm` `onSubmit`.

- `TextInput` `id="api-key-name"`, `name="name"`, `eyebrow={t('name')}`,
  `placeholder={t('name_placeholder')}`, `maxLength={API_KEY_NAME_MAX_LENGTH}`,
  `autoComplete="off"`, `infoError` set to the name error when there is one,
  `aria-invalid` when that error is set. The placeholder is the example `My Agent`, which is
  a different string from the eyebrow.
- `FormDropdown` `id="api-key-expiration"`, `eyebrow={t('expiration')}`, `info={t('expiration_help')}`,
  `value` from `apiKeyExpirationToDropdownValue`. Options, in
  `API_KEY_EXPIRATION_DAYS_OPTIONS` order: `30` / `expiration_30`, `90` / `expiration_90`,
  `365` / `expiration_365`, `none` / `no_expiration`. `onChange` runs
  `apiKeyExpirationFromDropdownValue`.
- `RadioButton` `name="api-key-preset"`, `eyebrow={t('presets')}`, options in order
  `read_only`, `full_access`, `custom` with labels `preset_read_only`, `preset_full_access`,
  `preset_custom`. `selectedValue` is `findApiKeyPresetId(permissions) ?? 'custom'`.
  `onChange` of `read_only` or `full_access` replaces permissions with
  `apiKeyPermissionsForPreset`. `onChange` of `custom` leaves permissions as they are, so the
  radio stays on the matching preset until a checkbox changes it. Custom is the label for a
  mask that matches neither preset. Checking every supported box does not select Full Access:
  `findApiKeyPresetId` compares the whole mask, and the unsupported bits stay 0 until a preset
  sets them. Choosing Full Access, then toggling one supported box off and back on, stays
  Full Access, because those bits were already set.
- One `fieldset` per `API_KEY_RESOURCES` entry, `min-width: 0`. `legend` is
  `t('resources.<resource>')`. A paragraph under the legend is `t('resources_help.<resource>')`
  with `id` `api-key-help-<resource>` and `className={styles.help}`. `aria-describedby` on the
  fieldset points at that id. Inside, one cell per `CRUD_ACTIONS` entry, in that order, so the
  four columns stay aligned across resources (R76).
  - `apiKeyPermissionCellKind` `'checkbox'`: a `CheckboxField`, label `t('actions.<action>')`,
    `checked={crudMaskHas(permissions[resource], action)}`, `onChange` calls
    `toggleApiKeyPermission`. `name` `api-key-<resource>-<action>`.
  - `'unsupported'`: not a checkbox and not a disabled checkbox. A dash cell:

```tsx
<span className={styles.unsupported} role="img" aria-label={label}>
  <span aria-hidden="true">—</span>
</span>
```

  `label` is `t('action_unavailable', { resource: resourceLabel, action: actionLabel })`.
  `resourceLabel` and `actionLabel` come from the exhaustive catalog-key helper plan 30 uses
  for list rows (`t('resources.<resource>')` and `t('actions.<action>')` on a union). Do not
  build those keys with a template string, and do not use `as`. The visible glyph is an em
  dash. The accessible name is the catalog sentence, for example
  `Account Create is not available.` The eight unsupported cells are account create and
  delete; settings create, read, and delete; add_by_rss update; history create and delete.
  A dash does not show whether the stored mask has that bit. Presets still set those bits,
  and `toggleApiKeyPermission` is never called for them.
- When `!apiKeyPermissionsGrantSupported(permissions)`, a `role="alert"` paragraph shows
  `t('permissions_empty')`. A read-only preset stores the read bit on `settings`, and that
  cell is a dash, so unchecking every visible Read box leaves that bit set.
  `apiKeyPermissionsGrantSupported` is still false, and the alert shows. Do not strip
  unsupported bits on toggle: that would drop a Full Access mask off the preset.
- A form-level `role="alert"` paragraph shows the form error when set (limit or generic).
- `Modal.Actions`: Cancel (`misc.cancel`, secondary) then Create API Key (`t('create')`,
  primary, `type="submit"`). Both disabled while submitting. Primary `isLoading` while
  submitting. Backdrop and X call the same close as Cancel, and both no-op while submitting.

Submit, with a `submittingRef` so a second submit returns immediately:

1. Trimmed name empty → set the name error to `t('name_required')` and return.
2. Trimmed name longer than `API_KEY_NAME_MAX_LENGTH` → `t('name_too_long', { max: API_KEY_NAME_MAX_LENGTH })` and return.
3. `!apiKeyPermissionsGrantSupported` → the permissions alert is already visible; return.
4. `existingKeyCount !== null && existingKeyCount >= API_KEY_MAX_PER_ACCOUNT` → form error
   `t('limit_reached')` and return.
5. `reqAuthApiKeyCreate(apiKeyCreateBody(...))`.

On 201: `onCreated(result.api_key)` and store `result` in `created` so the secret step
replaces the form. Do not close. On failure, `handleRateLimitAlert` first. Then
`tryHandleMembershipGateError`; when it returns true, close the create modal (the membership
modal is the one on screen) and do not toast. Then branch on
`getErrorResponseBodyCode`:

- `API_KEY_ERROR_CODES.permissionsEmpty` → the permissions alert (state already covers it;
  leave the modal open).
- `API_KEY_ERROR_CODES.limitReached` → form error `t('limit_reached')`.
- Status 400 → name error `t('name_required')` when the trimmed name is empty, otherwise
  form error `t('create_error')`.
- Status 401 → return (the session-ended path on the request service already ran).
- Anything else → form error `t('create_error')`.

Clear the name error when the name changes, and clear the form error when the name,
permissions, or expiration change.

## Modal, secret step

When `created` is set, header and `ariaLabel` become `t('created_title')`. The form is
unmounted.

- A paragraph with `aria-live="polite"` shows `t('shown_once')`.
- A read-only `TextInput` `id="api-key-token"`, `readOnly`, `value={created.token}`,
  `eyebrow={t('token_label')}`, `autoComplete="off"`, `spellCheck={false}`. The value is the
  only place the token is rendered. Do not put it in a toast, the list, or a log.
- `CopyToClipboardButton` `textToCopy={created.token}`, `idleLabel` `features.copy`,
  `copiedLabel` `features.copied`, `errorLabel` `t('copy_failed')`.
- `Modal.Actions` contains one primary button, `t` from `misc.done` (`Done`). It closes.

Close (Done, X, or backdrop) drops `created` from state inside the reset, then `onClose`.
`onCreated` already ran at 201, so the list has the row and a second close does not insert
it again. The parent helper ignores an `id_text` it already has:

```ts
function withCreatedKey(rows: DTOAccountApiKey[], created: DTOAccountApiKey): DTOAccountApiKey[] {
  if (rows.some((row) => row.id_text === created.id_text)) {
    return rows;
  }
  return [created, ...rows];
}
```

There is no extra confirm when the token has not been copied. The live sentence is the
warning. Closing discards the token from the client.

## Parent list update

`SettingsDeveloper` passes `onCreated` that, when status is `ready`, sets rows to
`withCreatedKey`. When status is not `ready`, bump `reloadToken` instead so the new key
loads from the server. Pass `existingKeyCount`.

## Styles

`ModalCreateApiKey.module.scss`:

- `.resources`: column, `gap: var(--spacing-lg)`.
- `.resource`: `min-width: 0`, `border: none`, `margin: 0`, `padding: 0`.
- `.help`: `color: var(--text-color-secondary)`.
- `.actions`: `display: grid`, `grid-template-columns: repeat(4, minmax(0, 1fr))`,
  `gap: var(--spacing-md)`.
- `.unsupported`: `color: var(--text-color-secondary)`.
- `.tokenRow`: `display: flex`, `flex-wrap: wrap`, `align-items: center`, `gap: var(--spacing-md)`,
  and `min-width: 0` on the input wrapper so the token cannot widen the modal.

One argument to `var()`. Do not set `overflow-x: hidden` on the modal. Leave the modal width
at the default.

## Accessibility

The preset control is a radiogroup named Presets. Each resource is a fieldset named by its
legend, so a checkbox exposes a name like Account / Read. Each dash exposes the
`action_unavailable` sentence and is not a checkbox. The secret paragraph is a live region.
The read-only token field's accessible name is its eyebrow, API Key. Revoke and the rest of
the list stay as plan 30 built them. List rows name supported cells only; that summary is
plan 30.

## Unit tests

`apiKeyForm.test.ts`:

- `apiKeyExpirationToDropdownValue(90)` is `'90'`; `null` is `'none'`.
- `apiKeyExpirationFromDropdownValue('none')` is null; `'30'` is 30; `'60'` is 90.
- `toggleApiKeyPermission` turns `CRUD_BITS.read` off on `account` for a read-only preset and
  leaves the other resources unchanged.
- `apiKeyCreateBody` trims the name and sets `expires_in_days` to null when the input days
  are null.
- `apiKeyPermissionCellKind` is `'unsupported'` for exactly these eight pairs: account create,
  account delete, settings create, settings read, settings delete, add_by_rss update, history
  create, history delete. The other 28 pairs are `'checkbox'`.
## Playwright

Append to the existing `Developer settings` suite. Reuse its login helper and the
`e2e-api-keys@example.com` / `e2e-api-keys-expired@example.com` /
`e2e-api-keys-none@example.com` accounts. Delete leftover keys
in `finally`. After navigation, assert the URL `/\/settings\?tab=developer/` and the heading.
`capturePageLoad` gets the element the step is about.

1. Open the tab and click the page button `Create API Key`. The dialog named `Create API Key`
   is visible. The button named `Expiration 90 Days` is visible. The radio named `Read Only`
   is checked. The Account group's Read checkbox is checked. The Account group has no checkbox
   named `Create`. It has an image named `Account Create is not available.` The Settings group
   has no checkbox named `Read` and has an image named `Settings Read is not available.`
   Screenshot the dialog, then click `Cancel`. The dialog is gone and `You have no API keys.`
   is still visible.
2. Open the form and submit with the name empty. The dialog stays and shows `Enter a name.`
   Type `Agent Key`, then uncheck every checkbox named `Read` and submit again. Settings has
   no Read checkbox; leave it. The dialog shows `Grant at least one permission.` Click the
   Full Access radio and assert the Account group's Update checkbox is checked. The Account
   group still has no checkbox named `Create`. Click the Read Only radio and assert the
   Account group's Read checkbox is checked and its Update checkbox is not.
3. Open the form, type `Agent Key`, click the Expiration button, and choose the menuitem
   `No Expiration` (`role="menuitem"` inside the dropdown's `role="menu"`). The trigger's
   accessible name is `Expiration No Expiration`. Submit with the dialog button named
   `Create API Key` (exact). The dialog's accessible name becomes `API Key Created`. It shows
   `This key is shown once. Copy it now. You will not see it again.` and a `Copy` button.
   The textbox named `API Key` matches `/^pvk_[A-Za-z0-9_-]{43}$/`. Screenshot that dialog,
   then click `Done`. The dialog is gone. The list shows `Agent Key`, `Read Only`, and
   `No Expiration`. The token string has count 0 on the page.
4. Signed in as `e2e-api-keys-expired@example.com`, open the tab and click `Create API Key`.
   No `POST` whose URL contains `/auth/api-keys` fires. The dialog named `Login Required`
   is visible and contains `Your membership has expired.` and a button named `Buy Membership`.
   The dialog named `Create API Key` has count 0. The text `API Keys Require a Membership`
   has count 0.
5. Signed in as `e2e-api-keys-none@example.com`, open the tab and click `Create API Key`.
   No `POST` whose URL contains `/auth/api-keys` fires. The dialog named
   `API Keys Require a Membership` is visible and contains
   `Buy a membership to create an API key.` and a button named `Buy Membership`. It does not
   contain `Your membership has expired.` The dialog named `Create API Key` has count 0.

Locators: `dialog.getByRole('group', { name: 'Account' }).getByRole('checkbox', { name: 'Read' })`.
A dash is `dialog.getByRole('group', { name: 'Account' }).getByRole('img', { name: 'Account Create is not available.' })`.
The submit button is `dialog.getByRole('button', { name: 'Create API Key', exact: true })`.
The control that opens the form is the same name outside the dialog. Keep each test inside
the default 10 second budget; the validation steps and the create steps are separate tests
so one flow does not carry the other.

## Out of scope

Do not add an update form, an MCP snippet, or a second copy of the catalog keys. Do not change
the list and revoke behavior from plan 30 except to insert the new row when create succeeds.
