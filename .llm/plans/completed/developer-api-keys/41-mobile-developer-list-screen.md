**Cursor model:** Cursor Grok 4.7 · **Reasoning:** extra high

# 41 — Mobile Developer list screen

More → Settings → Developer. Signed-in users see their keys and can revoke one. The create
form is plan 42; this plan adds the Create button, the mobile-only catalog leaves, and the
route the form will register beside. An expired membership can open this screen and revoke.
An account that never had a membership can open it too. There is no MCP snippet and no
key-setup block.

The account holds at most `API_KEY_MAX_PER_ACCOUNT` keys (20, plan 10), expired keys included.
Do not write 50 for that cap. 50 is `API_KEY_NAME_MAX_LENGTH`, the name length, and this
screen does not use it.

## Rows

R7, R10, R38, R39, R44, R46, R48, R51, R53, R70, R71, R77, R80

## Runs after

40

## Files

apps/mobile/src/screens/more/MoreSettingsScreen.tsx
apps/mobile/src/screens/more/MoreSettingsDeveloperScreen.tsx
apps/mobile/src/navigation/index.tsx
apps/mobile/src/components/feedback/ConfirmDialog.tsx
packages/i18n-catalog/mobile/originals/en-US.json
packages/i18n-catalog/mobile/originals/es.json
packages/i18n-catalog/mobile/originals/fr.json
packages/i18n-catalog/mobile/originals/el-GR.json
release-notes/scratchpad.md

## Reuse

The screen follows `MoreSettingsSessionsScreen`: `MobileScreenContainer`, `AuthAwareLoadState`
when signed out or while loading or on a load error, `ListEmpty` with
`OFFLINE_UNAVAILABLE_MESSAGE_KEY` when Offline Mode is on, `ListRow` plus a trailing `Button`
per row, `ConfirmDialog` (`AppOverlay`, not a React Native `Modal`), and a 401 that returns
without a banner because `requestWithMobileAuthRefresh` ends the session. Dates use
`formatDateTimeAbbrev` from `@podverse/helpers` with `i18n.language`
(**time-format-local**). Rows and the two docs URLs come from plan 40. Do not add a repository.

`navigation/index.tsx` and the four catalog originals are large. Grep the anchors below and
insert. Do not rewrite either file.

Membership reads `useMembership()`, which is `deriveMembershipState` on the account snapshot
in `AuthProvider`. `isTierKnown` comes from `useAccessTier`. The purchase label is
`membershipPurchaseAction` and `membershipPurchaseMessageKey` from `@podverse/helpers`. The
expired dialog is `useMembershipGate().openGate('membership_expired')`. The never-had dialog
is a `ConfirmDialog` on this screen. Confirm on that dialog calls `goToMembership()` from
the same hook.

## Catalog

Plan 30 owns every string web and mobile share, under `settings.developer` in
`packages/i18n-catalog/consumer/originals/`. Do not edit `consumer/`, `shared/`, `overrides/`,
or `compiled/`. Do not add `settings.account` or `settings.account.api_keys`. Do not copy a
consumer leaf into the mobile layer. `i18n:validate` rejects a leaf that exists in both
`consumer` and `mobile`.

Mobile inherits those consumer keys. Call them with `t('settings.developer.<leaf>')`. English
is plan 30's; do not restate it here.

### Consumer keys this screen uses

- Menu title: `settings.developer.developer` (Developer).
- Stack title: `settings.developer.heading` (API Keys).
- Body: `description`, `key_cannot`.
- Docs row that opens the browser: `api_reference`, `api_reference_hint`.
- Docs row that copies the yaml URL: `api_spec` as the title. The subtitle is the mobile
  leaf below, not `api_spec_hint` (that sentence says the link opens).
- Empty, load error, dates, expiry, last used: `empty`, `load_error`, `created`, `expires`,
  `no_expiration`, `expired`, `last_used`, `never_used`.
- Permission summary: `preset_read_only`, `preset_full_access`, `preset_custom`,
  `resources.<resource>`, `actions.<action>`.
- Revoke: `revoke`, `revoke_aria`, `revoke_title`, `revoke_body`, `revoke_error`.
- Create button and the limit line: `create`, `limit_reached`.
- Never-had dialog: `membership_required`, `membership_required_body`. The confirm label is
  `membership.buy_membership` when `tier` is null (the purchase helper), not a developer key.
- Copy failure on the yaml row: `copy_failed`. Success uses `features.copied`.

Also reuse `misc.cancel`, `features.copied`, `authentication.login_required`,
`settings.offline_mode.unavailable`. Do not show `revoke_success` (the row leaves the list)
or `api_spec_hint`.

### Mobile-only leaves

These three leaves are not in `consumer`. Add a `developer` object inside each mobile
original's `settings` object, before `"offline_mode"`. Deep merge adds them beside the
consumer `settings.developer` keys. Placeholders: none. English chrome is title case; the
two sentences stay sentence case. The other locales use each language's own capitalization.

en-US:

```json
"developer": {
  "menu_subtitle": "API Keys for Scripts and Agents",
  "docs_unavailable": "API documentation isn't available until this app has a server address.",
  "spec_copy_hint": "Copies the OpenAPI document URL for the server this app is using."
}
```

es:

```json
"developer": {
  "menu_subtitle": "Claves de API para scripts y agentes",
  "docs_unavailable": "La documentación de la API no está disponible hasta que esta app tenga una dirección de servidor.",
  "spec_copy_hint": "Copia la URL del documento OpenAPI del servidor que usa esta app."
}
```

fr:

```json
"developer": {
  "menu_subtitle": "Clés d'API pour les scripts et les agents",
  "docs_unavailable": "La documentation de l'API n'est pas disponible tant que cette app n'a pas d'adresse de serveur.",
  "spec_copy_hint": "Copie l'URL du document OpenAPI du serveur que cette app utilise."
}
```

el-GR:

```json
"developer": {
  "menu_subtitle": "Κλειδιά API για σενάρια και πράκτορες",
  "docs_unavailable": "Η τεκμηρίωση API δεν είναι διαθέσιμη μέχρι αυτή η εφαρμογή να έχει διεύθυνση διακομιστή.",
  "spec_copy_hint": "Αντιγράφει τη διεύθυνση URL του εγγράφου OpenAPI του διακομιστή που χρησιμοποιεί αυτή η εφαρμογή."
}
```

After the four originals match, run `npm run i18n:compile` from the repo root. If it adds
empty slots under `mobile/overrides/`, leave those values empty and include the files.

## Navigation

In `apps/mobile/src/navigation/index.tsx`, anchor every insert on `MoreSettingsSessions`:

- Import `MoreSettingsDeveloperScreen` beside the sessions screen import. Do not import the
  create screen; plan 42 does.
- After the sessions entry in `MORE_STACK_ROUTES`:

```ts
MoreSettingsDeveloper: 'MoreSettingsDeveloper',
MoreSettingsDeveloperCreate: 'MoreSettingsDeveloperCreate',
```

- In `moreTabLinkScreens`, after `MoreSettingsSessions`, add this entry and no create path:

```ts
MoreSettingsDeveloper: `more${APP_ROUTES.SETTINGS}/developer`,
```

  That resolves to `more/settings/developer`.
- `MoreStackParamList` after the sessions line:

```ts
MoreSettingsDeveloper: undefined;
MoreSettingsDeveloperCreate: { expiresIn?: ApiKeyExpirationChoice } | undefined;
```

  Import `ApiKeyExpirationChoice` as a type from `../screens/more/accountApiKeyRows`. Plan 42
  adds the expiration route on this same type.
- `<MoreStack.Screen>` after the sessions screen, `component={MoreSettingsDeveloperScreen}`,
  `name={MORE_STACK_ROUTES.MoreSettingsDeveloper}`,
  `options={{ title: t('settings.developer.heading') }}`.

Do not mount a `MoreStack.Screen` for `MoreSettingsDeveloperCreate`. Plan 42 mounts
`MoreSettingsDeveloperCreateScreen` on the constant above. Until then the Create button has
a typed destination and no screen; the set runs 42 after this plan.

## Settings row

In `MoreSettingsScreen`, insert after the sessions item:

```ts
{
  onPress: () => {
    navigation.navigate(MORE_STACK_ROUTES.MoreSettingsDeveloper);
  },
  subtitle: t('settings.developer.menu_subtitle'),
  testID: 'more-settings-developer',
  title: t('settings.developer.developer'),
},
```

The row stays visible when signed out. The screen explains login, the same as sessions.

## ConfirmDialog

Add optional `confirmLoading?: boolean` to `ConfirmDialog`. When true, the confirm
`FormAction` gets `loading: true`. Existing callers omit it. Do not change button order
(confirm, then cancel).

## Developer screen

`MoreSettingsDeveloperScreen` mirrors the sessions screen's branches, in this order:

1. `status !== 'authenticated'`: `AuthAwareLoadState` with
   `authMessageKey="authentication.login_required"`, `showAuthRequired`,
   `emptyTestID="more-settings-developer-login-required"`. Container
   `testID="more-settings-developer-screen"`.
2. Offline Mode on: `ListEmpty` with `OFFLINE_UNAVAILABLE_MESSAGE_KEY` and
   `testID="more-settings-developer-offline-unavailable"`.
3. Loading or `loadErrorKey`: `AuthAwareLoadState` with
   `loadingTestID="more-settings-developer-loading"`,
   `errorTestID="more-settings-developer-error"`, `errorKey` `settings.developer.load_error`
   on failure. Retry bumps a reload token.

Load with `useFocusEffect` so returning from plan 42's create screen refetches. Cancel the
in-flight fetch in the effect cleanup. Call `fetchAccountApiKeys` then
`toApiKeyListRows(keys, new Date())`. On 401, return without setting an error. On any other
failure, `console.warn` and set the load error. Do not call `openGate` on list or revoke. An
expired membership and an account with no membership status row both get 200 from the API
and the rows render.

Loaded body, inside one `View` with `gap: settingsCardInnerGap`:

- Description `Text`, `typography.prose`, `settings.developer.description`.
- A second `Text`, `typography.prose`, `settings.developer.key_cannot`.
- Docs. Read `const apiBaseUrl = getMobileConfig().api?.baseUrl ?? null`, then
  `apiDocsUrl(apiBaseUrl)` and `apiDocsYamlUrl(apiBaseUrl)`. When both are null, one `Text`
  `testID="more-settings-developer-docs-unavailable"` with
  `settings.developer.docs_unavailable`. When both are strings (they are null together):
  - A `ListRow` `testID="more-settings-developer-docs"`, title
    `settings.developer.api_reference`, subtitle `settings.developer.api_reference_hint`.
    `onPress` calls `Linking.openURL` on the `/docs` URL and swallows a rejection the way
    `FundingLinksSection` does. Do not copy that URL.
  - A `ListRow` `testID="more-settings-developer-docs-yaml"`, title
    `settings.developer.api_spec`, subtitle `settings.developer.spec_copy_hint`. `onPress`
    calls `Clipboard.setStringAsync` from `expo-clipboard` with the `/docs.yaml` URL. On
    success, clear the action error and set a copied flag. On failure, clear the flag, set
    the action error to `settings.developer.copy_failed`, and `console.warn` the error. Do
    not log the URL. Do not call `Linking.openURL` for this row.
  - When the copied flag is set, a `Text` `testID="more-settings-developer-docs-yaml-copied"`,
    `accessibilityRole="alert"`, `accessibilityLiveRegion="polite"`, text `features.copied`.
- Action error `Text`, `testID="more-settings-developer-action-error"`,
  `accessibilityRole="alert"`, `accessibilityLiveRegion="polite"`, only when `actionErrorKey`
  is set. Revoke and the yaml copy share this slot.
- Zero rows: a `Text` `testID="more-settings-developer-empty"` with
  `settings.developer.empty`. Do not replace the description and the docs rows with
  `ListEmpty`.
- One `ListRow` per key, `testID={`more-settings-developer-key-${row.idText}`}`:
  - title: `row.name`
  - subtitle: hint, permission summary, and expiry joined with ` · `. The summary comes
    from `row.summary` (plan 40). `kind: 'preset'` uses `preset_read_only` or
    `preset_full_access` through an exhaustive switch on `ApiKeyPresetId`. `kind: 'custom'`
    with no lines uses `preset_custom`. Otherwise each line is the resource label, a space,
    then the action labels joined with `, `; lines join with ` · `. Resource and action
    labels are exhaustive switches on `ApiKeyResource` and `CrudAction` that call
    `t('settings.developer.resources.account')` and `t('settings.developer.actions.create')`
    and the matching keys. No template string for the key, and no `as`. A custom summary
    never names a cell `apiKeyResourceSupportsAction` rejects, because plan 40 already
    dropped those actions.
  - Expiry, in that same subtitle, is `expired` when `row.isExpired`, otherwise `expires`
    with `formatDateTimeAbbrev(row.expiresAt, i18n.language)`, or `no_expiration` when
    `expiresAt` is null.
  - meta: `created` and either `last_used` or `never_used`, joined with ` · `.
  - trailing `Button` `size="sm"` `variant="outline"` `label` `revoke`,
    `accessibilityLabel` `revoke_aria` with `{ name: row.name }`,
    `testID={`more-settings-developer-revoke-${row.idText}`}`, `loading` while that id is
    revoking. `onPress` opens the confirm dialog for that row. It does not revoke yet.
- When `rows.length >= API_KEY_MAX_PER_ACCOUNT`, a `Text`
  `testID="more-settings-developer-limit"` with `limit_reached`, and no Create button.
  Otherwise `FormActions` with one primary action, label `create`,
  `testID="more-settings-developer-create"`. `onPress` calls `apiKeyCreateAccess` with
  `isTierKnown` from `useAccessTier` and `isMember` / `isExpired` from `useMembership`.
  Exhaustive switch, no default branch:
  - `allowed` and `unknown` call
    `navigation.navigate(MORE_STACK_ROUTES.MoreSettingsDeveloperCreate)` with no params
    (plan 42's screen treats a missing `expiresIn` as 90 days).
  - `membership_expired` calls `openGate('membership_expired')`. That dialog keeps the
    existing expired title and body (`membership.gate.title_expired` and the tier body in
    `membershipGateCopy`). Do not pass `membership_required` into it. Do not navigate.
  - `needs_membership` opens this screen's membership `ConfirmDialog`. Do not call
    `openGate('needs_membership')` (that dialog says Premium Feature). Do not navigate.
  The button stays visible for an expired membership and for an account that never had one
  (**membership-expiry-ux-contract**, **mobile-screen-layout**).

`ConfirmDialog` for revoke: `title` `revoke_title`, `body` `revoke_body` with the pending
row's name, `cancelLabel` `misc.cancel`, `confirmLabel` `revoke`, `confirmVariant="danger"`,
`confirmLoading` while the request runs, `testID="more-settings-developer-revoke-dialog"`,
`cancelTestID="more-settings-developer-revoke-cancel"`,
`confirmTestID="more-settings-developer-revoke-confirm"`. A ref blocks a second confirm and
makes cancel a no-op while the request runs. `revokeAccountApiKey`, then `withoutApiKey`.
Status 404 removes the row and does not set an error. Status 401 returns. Anything else sets
`revoke_error` and `console.warn`. Close the dialog when the request finishes.

`ConfirmDialog` for an account that never had a membership:
`title` `settings.developer.membership_required` (API Keys Require a Membership),
`body` `settings.developer.membership_required_body` (Buy a membership to create an API key.),
`cancelLabel` `misc.cancel`, `confirmLabel` from an exhaustive switch on
`membershipPurchaseMessageKey(membershipPurchaseAction(membership))`:
`buy_membership` → `t('membership.buy_membership')`, `extend_my_membership` →
`t('membership.extend_my_membership')`, `gate.sign_up` → `t('membership.gate.sign_up')`.
A missing membership status row has `tier` null, so the label is Buy Membership.
`onConfirm` closes the dialog and calls `goToMembership()`. `testID`
`more-settings-developer-membership-dialog`, `cancelTestID`
`more-settings-developer-membership-cancel`, `confirmTestID`
`more-settings-developer-membership-confirm`. This dialog does not contain the expired
sentence.

Do not log a key, a token, or a request body. Do not add an MCP string, a sample header
beyond the description sentence, or a second copy of the token.

## Tests

No new unit test. Plan 40 covers the row mapper, the permission summary, create access, and
both docs URLs. Plan 42's Maestro flow opens this screen, asserts both docs rows, copies the
yaml URL, creates a key, and revokes it. `ConfirmDialog`'s new prop is a pass-through to
`loading`; no separate test.

The seeded mobile user is a member, so that flow does not open either membership dialog. The
expired dialog is the existing gate. The never-had dialog is the two consumer keys on
`needs_membership`, which plan 40's unit test selects when the tier is known, `isExpired` is
false, and `isMember` is false.

## Release scratchpad

```markdown
## Developer screen lists and revokes API keys

- Surfaces: mobile
- Change: More → Settings → Developer lists the signed-in account's API keys with name, hint,
  a permission summary, expiry, created time, and last-used time, and revokes one after a
  confirm. A preset summary is Read Only or Full Access. A custom summary names only the
  actions some route checks. An expired membership can still open the screen and revoke, and
  Create opens the existing expired-membership dialog. An account that never had a membership
  sees "API Keys Require a Membership" and Buy Membership. One row opens the interactive API
  reference for the server the app is using. A second row copies that server's OpenAPI
  document URL. The screen has no MCP setup snippet. Shared strings come from
  `settings.developer` in the consumer catalog. The settings-row subtitle, the missing-server
  sentence, and the copy-row subtitle are mobile-only.
- Who notices: people managing API keys from the phone
- Operator steps: none
```
