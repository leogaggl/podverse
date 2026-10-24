**Cursor model:** Cursor Grok 4.7 · **Reasoning:** extra high

# 42 — Mobile create API key

The create form, the expiration list, and the once-only token. Plan 41 already added the
catalog, the Create button, and the `MoreSettingsDeveloperCreate` route constant. This plan
mounts the screens and proves the path with one Maestro flow.

The account holds at most `API_KEY_MAX_PER_ACCOUNT` keys (20, plan 10). The name field allows
`API_KEY_NAME_MAX_LENGTH` characters (50). Those are different limits. Do not write 50 as the
key cap.

## Rows

R4, R16, R25, R28, R39, R42, R46, R70, R77

## Runs after

41

## Files

apps/mobile/src/screens/more/MoreSettingsDeveloperCreateScreen.tsx
apps/mobile/src/screens/more/MoreSettingsDeveloperExpirationScreen.tsx
apps/mobile/src/navigation/index.tsx
apps/mobile/src/components/primitives/CheckboxMark.tsx
apps/mobile/e2e/settings-developer.yaml
scripts/mobile/e2e-test.sh
release-notes/scratchpad.md

## Reuse

Form chrome is `TextField` (eyebrow plus a different placeholder), `FormField`,
`OptionChipGroup` (two presets), `SettingsOptionNavRow` into `OptionListScreen` (four
expiration choices; **mobile-settings-option-density**), `SettingsGroup`, `CheckboxRow`,
`HelperNote`, and `FormActions`. Copy `MoreSettingsChangePasswordScreen` for the submit
guard, `handleRateLimitMessage`, and `getErrorResponseBodyCode` /
`getErrorResponseStatus` from `@podverse/helpers/error`. Copy
`MoreSettingsThemeScreen` for the option list and `navigation.goBack` after a choice —
except expiration returns to the create screen with a param, because the draft is not a
saved preference.

Strings are plan 30's `settings.developer` consumer keys, plus `misc.cancel`, `misc.done`,
`features.copy`, and `features.copied`. Do not edit the catalogs. Do not edit
`MoreSettingsScreen` or `MoreSettingsDeveloperScreen`. Do not add
`settings.account.api_keys`.

`navigation/index.tsx` is large. Grep `MoreSettingsDeveloper` and insert beside it.

Cell kind and the toggle come from plan 40 (`apiKeyPermissionCellKind`,
`toggleApiKeyPermission`, `apiKeyPermissionChecked`). The supported-permission check is
`apiKeyPermissionsGrantSupported` from `@podverse/helpers` (plan 10). `apiKeyResourceSupportsAction` is what those helpers call. Do not
edit `packages/helpers`.

## Checkbox name

`CheckboxRow` in `CheckboxMark.tsx` takes an optional `accessibilityLabel`. The `Pressable`
uses that when set, and the visible `label` otherwise. Existing callers omit it. The create
screen passes the short action as `label` and `${resourceLabel}, ${actionLabel}` as
`accessibilityLabel`, so four "Read" boxes are not the same name. Those two labels are
already translated consumer strings. Do not add a catalog key for the pair.

## Navigation

Anchor on `MoreSettingsDeveloper` from plan 41:

- Import `MoreSettingsDeveloperCreateScreen` and `MoreSettingsDeveloperExpirationScreen`.
- `MORE_STACK_ROUTES.MoreSettingsDeveloperExpiration: 'MoreSettingsDeveloperExpiration'`
  after `MoreSettingsDeveloperCreate`. `MoreSettingsDeveloperCreate` is already there.
- `MoreStackParamList.MoreSettingsDeveloperExpiration: { expiresIn: ApiKeyExpirationChoice }`.
  Import the type from `accountApiKeyRows` if plan 41's import is not in scope at the type
  (it is a type-only import; reuse it).
- No linking paths. These screens are pushed from Developer.
- After the Developer `MoreStack.Screen`:

```tsx
<MoreStack.Screen
  component={MoreSettingsDeveloperCreateScreen}
  name={MORE_STACK_ROUTES.MoreSettingsDeveloperCreate}
  options={{ title: t('settings.developer.create') }}
/>
<MoreStack.Screen
  component={MoreSettingsDeveloperExpirationScreen}
  name={MORE_STACK_ROUTES.MoreSettingsDeveloperExpiration}
  options={{ title: t('settings.developer.expiration') }}
/>
```

## Expiration screen

`MoreSettingsDeveloperExpirationScreen` is `OptionListScreen`,
`testID="more-settings-developer-expiration-screen"`. Options are
`API_KEY_EXPIRATION_CHOICES` in that order (30, 90, 365, none). Labels are
`settings.developer.expiration_30`, `expiration_90`, `expiration_365`, and `no_expiration`.
testIDs `more-settings-developer-expiration-30` and the same suffix for `90`, `365`, and
`none`. `value` is `route.params.expiresIn`. `onSelect` calls

```ts
navigation.navigate(MORE_STACK_ROUTES.MoreSettingsDeveloperCreate, { expiresIn: choice });
```

`navigate`, not `push`, so the create screen already on the stack stays mounted and keeps
the name and the checkboxes. Do not write the choice to AsyncStorage.

## Create screen

`MobileScreenContainer` `testID="more-settings-developer-create-screen"`
`automaticallyAdjustKeyboardInsets`.

Signed out: `AuthAwareLoadState` with `authentication.login_required`, `showAuthRequired`,
`emptyTestID="more-settings-developer-create-login-required"`. Offline Mode:
`ListEmpty` with `OFFLINE_UNAVAILABLE_MESSAGE_KEY`,
`testID="more-settings-developer-create-offline-unavailable"`. Same branches as the list
screen, before the form.

State:

- `name` string, start `''`.
- `permissions`, start `apiKeyPermissionsForPreset('read_only')`. That is the default
  preset. Do not start from Full Access or from an empty mask.
- `token: string | null`, start null. This is the only place the secret lives. Not a route
  param, not a log, not SecureStore, not SQLite, not AsyncStorage.
- `copied` boolean, `formError: string | null`, `isSubmitting`, and a submit ref.
- `membershipDialogVisible` boolean, start false.

`expiresIn` is `route.params?.expiresIn ?? '90'`. Read it during render. Do not copy it
into state; returning from the expiration screen updates the param.

Resource and action labels are the same exhaustive switches as plan 41
(`settings.developer.resources.*`, `settings.developer.actions.*`). No template string for
the catalog key, and no `as`.

When `token` is null, the form, in one column with `gap: settingsCardInnerGap`:

- `TextField` `testID="more-settings-developer-name"`, `eyebrow` `settings.developer.name`,
  `placeholder` `settings.developer.name_placeholder`, `accessibilityLabel` the name key,
  `maxLength={API_KEY_NAME_MAX_LENGTH}`, `autoCorrect={false}`, `value` / `onChangeText`.
  The placeholder is the example `My Agent`, which is a different string from the eyebrow.
  An empty trimmed name disables submit. Do not add the web `name_required` paragraph.
- `FormField` `label` `settings.developer.presets`. Inside it, `OptionChipGroup`
  `testID="more-settings-developer-presets"`. The value type is
  `ApiKeyPresetId | 'custom'`. Options are only `read_only` and `full_access`, labels
  `preset_read_only` and `preset_full_access`, testIDs
  `more-settings-developer-preset-read-only` and
  `more-settings-developer-preset-full-access`. `value` is
  `findApiKeyPresetId(permissions) ?? 'custom'`, so a custom mask selects neither chip.
  `onChange` of a preset replaces `permissions` with `apiKeyPermissionsForPreset`. Checking
  every supported box from an empty mask stays custom: `findApiKeyPresetId` compares the
  whole mask, and the unsupported bits stay 0 until a preset sets them. Choosing Full
  Access, then toggling one supported box off and back on, stays Full Access. When the id
  is null, a `Text` `testID="more-settings-developer-preset-custom"` shows `preset_custom`.
- `HelperNote` `message` `settings.developer.key_cannot`,
  `testID="more-settings-developer-preset-help"`. Always, not only for Full Access.
- One `SettingsGroup` per `API_KEY_RESOURCES` entry, in that array's order. `title` is the
  resource label. `spaced` on every group after the first.
  `testID={`more-settings-developer-resource-${resource}`}`. Inside the card, a column with
  `paddingHorizontal` and `paddingVertical` `spacing.lg` and `gap` `spacing.md`:
  - A `Text`, `typography.body`, secondary color, `settings.developer.resources_help.<resource>`
    through the same exhaustive resource switch. `testID`
    `more-settings-developer-resource-help-${resource}`.
  - One cell per `CRUD_ACTIONS` entry, in that order, so every resource still has four rows
    and the action order matches. This is a column, not a four-across grid.
    - `apiKeyPermissionCellKind` `'checkbox'`: a `CheckboxRow`. Visible `label` is the
      action label. `accessibilityLabel` is `${resourceLabel}, ${actionLabel}`. `checked`
      is `apiKeyPermissionChecked`. `onPress` sets permissions to
      `toggleApiKeyPermission`. testID
      `more-settings-developer-permission-${resource}-${action}`.
    - `'unsupported'`: not a `CheckboxRow` and not a disabled checkbox. A row with the same
      horizontal layout (a 22-point slot, then the action label). The slot shows an em dash
      (`—`) in the secondary text color. The row is a `View` with `accessible`,
      `accessibilityRole="image"`, and `accessibilityLabel` set to
      `t('settings.developer.action_unavailable', { resource: resourceLabel, action: actionLabel })`.
      The visible dash and the visible action word are
      `accessibilityElementsHidden` and `importantForAccessibility="no-hide-descendants"`,
      so the accessible name is only that sentence (for example
      `Account Create is not available.`). The row has no `onPress`. testID is the same
      `more-settings-developer-permission-${resource}-${action}` pattern. The eight
      unsupported cells are account create and delete; settings create, read, and delete;
      add_by_rss update; history create and delete. A dash does not show whether the stored
      mask has that bit. Presets still set those bits, and `toggleApiKeyPermission` is never
      called for them.
- `SettingsOptionNavRow` `testID="more-settings-developer-expiration"`, `title`
  `settings.developer.expiration`, `description` `settings.developer.expiration_help`,
  `valueLabel` the choice's catalog string (`expiration_30`, `expiration_90`,
  `expiration_365`, or `no_expiration`). `onPress` navigates to
  `MoreSettingsDeveloperExpiration` with `{ expiresIn }`.
- When `!apiKeyPermissionsGrantSupported(permissions)`, a `Text`
  `testID="more-settings-developer-permissions-empty"` with `permissions_empty`. A
  read-only preset stores the read bit on `settings`, and that cell is a dash, so unchecking
  every visible Read box leaves that bit set. The helper is still false, and the alert
  shows. Do not strip unsupported bits on toggle.
- When `formError` is set, a `Text` `testID="more-settings-developer-error"`,
  `accessibilityRole="alert"`, `accessibilityLiveRegion="polite"`.
- `FormActions` one action, label `settings.developer.create`,
  `testID="more-settings-developer-submit"`, `disabled` when the trimmed name is empty or
  `apiKeyPermissionsGrantSupported` is false, `loading` while submitting.

Submit, behind the ref: call `apiKeyCreateAccess` with `isTierKnown` from `useAccessTier` and
`isMember` / `isExpired` from `useMembership`. Exhaustive switch:

- `membership_expired`: `openGate('membership_expired')` and return. That is the existing
  expired copy. Do not show `membership_required`.
- `needs_membership`: set `membershipDialogVisible` and return. Do not call
  `openGate('needs_membership')`.
- `unknown` and `allowed`: continue.

Call `createAccountApiKey` with `toApiKeyCreateBody`. On success, `setToken(created.token)`
and `navigation.setOptions({ title: t('settings.developer.created_title') })`.
Do not `console.warn` or otherwise print `created`. On failure, same order as change
password: `handleRateLimitMessage` sets `formError` to that string; `handleGateError`
returns (a membership 403 from the server opens the existing expired gate, then this screen
returns); status 401 returns; `getErrorResponseBodyCode` `api_key_permissions_empty` shows
`permissions_empty`; `api_key_limit_reached` shows `limit_reached`; anything else shows
`create_error` and `console.warn` the error (it is a failed request, not a token). The click
path does not POST for an expired account or an account that never had a membership.

Membership `ConfirmDialog`, same copy as plan 41's never-had dialog: title
`settings.developer.membership_required`, body `settings.developer.membership_required_body`,
cancel `misc.cancel`, confirm label from the same exhaustive switch on
`membershipPurchaseMessageKey(membershipPurchaseAction(membership))`. `onConfirm` closes the
dialog and calls `goToMembership()`. testIDs
`more-settings-developer-create-membership-dialog`,
`more-settings-developer-create-membership-cancel`,
`more-settings-developer-create-membership-confirm`. A missing status row has `tier` null, so
the action is Buy Membership. This dialog does not contain the expired sentence.

When `token` is non-null, replace the form. Do not keep the form mounted under the token.

- `Text` `typography.prose` with `settings.developer.shown_once`.
- `Text` `selectable` `testID="more-settings-developer-token"` whose text is the token.
  `accessibilityLabel` is `settings.developer.token_label`. `typography.body`. A person using
  a screen reader hears the token as the value of that label.
- `FormActions`, top to bottom: Done (`variant="outline"`,
  `testID="more-settings-developer-done"`, label `misc.done`, `onPress`
  `navigation.goBack()`), then Copy (`variant="primary"`,
  `testID="more-settings-developer-copy"`). Copy calls `Clipboard.setStringAsync` from
  `expo-clipboard` and sets `copied`. On failure, set `formError` to
  `settings.developer.copy_failed`. Label and `accessibilityLabel` are `features.copied`
  when copied, otherwise `features.copy`. The stack back button also leaves. Either way
  the token state unmounts with the screen. The list screen's focus effect reloads.

No MCP block, no second reveal, no "I have saved this" checkbox.

## Maestro

New `apps/mobile/e2e/settings-developer.yaml`. One flow, both platforms in one file, each
platform using its own key name so a parallel run does not revoke the other phone's key.
API-backed. Do not add it to `flow_needs_test_assets`.

In `scripts/mobile/e2e-test.sh`, add `settings-developer` to the `flow_needs_e2e_api` case,
beside `settings-downloads`. Grep `settings-downloads` and extend that pattern. Do not
reformat the rest of the case.

```yaml
appId: com.podverse.app.next
name: Developer API Keys
---
# More → Settings → Developer creates a key, shows the secret once, lists the key, and
# revokes it. Each platform uses its own name so a parallel run stays on its own row.
# The OpenAPI row copies a URL. The API Reference row is not tapped, because that leaves
# the app. The seeded user has a membership, so neither membership dialog opens.

- runFlow: shared/launch-and-connect.yaml
- runFlow: shared/login-seeded-user.yaml

- tapOn:
    id: tab-more
- tapOn:
    id: more-settings
- tapOn:
    id: more-settings-developer
- extendedWaitUntil:
    visible:
      id: more-settings-developer-screen
    timeout: ${TIMEOUT_SLOW}
- extendedWaitUntil:
    visible:
      id: more-settings-developer-docs
    timeout: ${TIMEOUT_SLOW}
- extendedWaitUntil:
    visible:
      id: more-settings-developer-docs-yaml
    timeout: ${TIMEOUT_FAST}
- tapOn:
    id: more-settings-developer-docs-yaml
- extendedWaitUntil:
    visible:
      id: more-settings-developer-docs-yaml-copied
      text: "Copied"
    timeout: ${TIMEOUT_FAST}
- tapOn:
    id: more-settings-developer-create
- extendedWaitUntil:
    visible:
      id: more-settings-developer-create-screen
    timeout: ${TIMEOUT_FAST}
- extendedWaitUntil:
    visible:
      id: more-settings-developer-permission-account-create
    timeout: ${TIMEOUT_FAST}
- assertVisible:
    text: "Account Create is not available."
- assertVisible:
    id: more-settings-developer-permission-account-read

- runFlow:
    when:
      platform: iOS
    commands:
      - tapOn:
          id: more-settings-developer-name
      - inputText: "E2E Agent iOS"
- runFlow:
    when:
      platform: Android
    commands:
      - tapOn:
          id: more-settings-developer-name
      - inputText: "E2E Agent Android"
      - hideKeyboard
- tapOn:
    id: more-settings-developer-submit
- extendedWaitUntil:
    visible:
      id: more-settings-developer-token
    timeout: ${TIMEOUT_SLOW}
- takeScreenshot: settings-developer-token
- tapOn:
    id: more-settings-developer-copy
- extendedWaitUntil:
    visible:
      id: more-settings-developer-copy
      text: "Copied"
    timeout: ${TIMEOUT_FAST}
- tapOn:
    id: more-settings-developer-done
- extendedWaitUntil:
    visible:
      id: more-settings-developer-screen
    timeout: ${TIMEOUT_SLOW}

- runFlow:
    when:
      platform: iOS
    commands:
      - assertVisible:
          text: "E2E Agent iOS"
      - assertVisible:
          text: "Read Only"
      - tapOn:
          text: "Revoke E2E Agent iOS"
- runFlow:
    when:
      platform: Android
    commands:
      - assertVisible:
          text: "E2E Agent Android"
      - assertVisible:
          text: "Read Only"
      - tapOn:
          text: "Revoke E2E Agent Android"
- extendedWaitUntil:
    visible:
      id: more-settings-developer-revoke-dialog
    timeout: ${TIMEOUT_FAST}
- takeScreenshot: settings-developer-revoke-dialog
- tapOn:
    id: more-settings-developer-revoke-confirm
- runFlow:
    when:
      platform: iOS
    commands:
      - extendedWaitUntil:
          notVisible:
            text: "E2E Agent iOS"
          timeout: ${TIMEOUT_SLOW}
- runFlow:
    when:
      platform: Android
    commands:
      - extendedWaitUntil:
          notVisible:
            text: "E2E Agent Android"
          timeout: ${TIMEOUT_SLOW}
- takeScreenshot: settings-developer-revoked
```

The default key is the Read Only preset, so the list row says Read Only. That row's summary
is the preset, not a list of cells. The custom-line filter (supported cells only) and the
other seven unsupported pairs, including settings read, are the unit test in plan 40. The
flow asserts the first resource only, so it does not scroll to a later group. It does not
tap the API Reference row. Timeouts are the shared ladder (**mobile-maestro-timeouts**). Do
not invent a millisecond literal.

Account create is a dash. Account read is a checkbox. Both sit in the first group. The yaml
Copied wait matches that row's own id. The token Copied wait matches
`more-settings-developer-copy` together with the word Copied, because the list screen can
still be under the create screen and already shows Copied.

## Tests

- Unit: none added. Plan 40 covers presets, toggles, the eight unsupported cells, expiration
  choices, the create body, create access, and
  the permission summary.
- Maestro: `apps/mobile/e2e/settings-developer.yaml`, registered in `flow_needs_e2e_api`.
  One flow proves the screen is reachable, the yaml row copies with Copied feedback, the
  create grid shows the unsupported dashes and a supported checkbox, a key can be created,
  the secret is on screen, copy flips the button to Copied, the list shows the name and
  Read Only, and revoke removes it.

## Release scratchpad

```markdown
## Mobile can create an API key and show it once

- Surfaces: mobile
- Change: Developer → Create API Key asks for a name (up to 50 characters), starts on the
  Read Only preset, and can switch to Full Access or to per-resource permissions for account,
  settings, subscriptions, Add by RSS, playlists, queue, history, clips, and notifications.
  A cell no route checks is a dash with an accessible name, not a checkbox. Expiry is 30, 90
  (the default), or 365 days, or No Expiration, on its own screen. The secret is shown once
  with Copy and is not stored on the phone. An expired membership still sees Create; pressing
  it opens the existing expired-membership dialog. An account that never had a membership
  sees "API Keys Require a Membership" and Buy Membership. An account can hold 20 keys. A key
  still cannot manage keys, change the password or email, delete the account, or buy a
  membership, and the form says so.
- Who notices: people creating an API key from the phone
- Operator steps: none
```
