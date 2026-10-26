**Cursor model:** Cursor Grok 4.7 · **Reasoning:** high

# 11 — Home title-bar bell opens the notifications inbox

## Rows

R2, R3, R9, R11

## Runs after

10

## Goal

Home's title bar gets a filled bell to the left of the existing ellipsis (`HomeOverflowMenu`).
The bell shows the unread notifications count, stopping at `99+`, and, on press, opens the root
slide-up inbox plan 10 added.
Signed out, or signed in without notifications access, the bell stays visible and opens the
membership gate instead. Checking all notifications is a Home-only function: no other screen gets
this bell.

## Decisions settled here

- **Glyph:** Ionicons `notifications` (filled) at the `HeaderBarAction` default 26pt. Do not pass
  `iconSize`. Primary text color (same as the ellipsis). The outline name is not used.
- **Badge:** the shared `CountBadge` (accent tone), absolutely positioned at the top-right corner
  of the 44pt `HeaderBarAction` slot (`top: 0`, `right: 0`), `pointerEvents="none"`. It is drawn
  over the control, so the control's bounds never change when a count appears
  (**button-stable-bounds**). Hidden at zero (`CountBadge` already returns `null`). The Home bell
  passes `max={99}`. A count above 99 reads `99+`; 99 itself reads `99`. `max` is optional and
  has no default, so every other caller still shows the full count. The widen rule stays
  `count >= 10` (`badgeStretch`), which already covers the three-character `99+` face.
- **Unread source:** `useNotificationsUnreadCount()` (`apps/mobile/src/hooks/useNotificationsUnreadCount.ts`),
  read inside the bell component, not in `HomeScreen`, so a count change re-renders only the bell.
- **Press decision** (pure function, below):
  - not `authenticated` → `openGate('needs_account')` (same as `useChannelNotifications.runWrite`)
  - `authenticated` while the account snapshot is still loading (`isTierKnown === false`) → open
    the inbox. `useAccessTier` documents that a gate opened in that window would tell a signed-in
    user to sign in; the inbox's own load handles the server's answer.
  - `evaluateFeature('notifications')` allowed → open the inbox
  - denied → `openGate(access.reason)` (`needs_membership` or `membership_expired`; the gate's
    confirm goes to the Membership screen)
- **Accessible name:** `t('settings.notifications.notifications')` ("Notifications"). With a count
  above zero, append `, ` and `t('settings.notifications.unread_count_aria', { count: unreadCount })`.
  `count` is the real unread number, including when the face is `99+` (142 speaks as
  "142 unread notifications", not "99+"). That is the number web's `NotificationBellButton`
  passes into the same key. Mobile `CountBadge` stays hidden from assistive tech, so the button
  label is the only place the count is spoken, the way `ListRow` folds its badge. No new catalog
  keys. Do not pass `99`, `Math.min`, or the face string into the key.
- **testIDs:** `home-notifications-bell` on the control, `home-notifications-bell-badge` on the
  badge.

## Reuse

- `HeaderBarAction` (control, default 26pt, no `iconSize`), `HeaderBarActions` (trailing slot
  with more than one action — the **mobile-screen-layout** rule requires it), `CountBadge` with
  `max={99}`. The face formula is `formatCountBadgeFace` in `countBadgeFace.ts`, the same rule as
  web `CountBadge` in `packages/ui/src/components/layout/CountBadge/CountBadge.tsx`: a count above
  `max` reads as that max followed by `+`. Web defaults `max` to 99. Mobile does not copy that
  default. `max` omitted means `String(count)`, which is what `ListRow` (`badgeCount`) and
  `HomeFeedGridCell` (downloaded count, `tone="muted"`) show today. Do not edit those two files.
- `useMembershipGate().openGate`,
  `useAccessTier()` (`evaluateFeature`, `isTierKnown`), `useAuth().status`.
- `navigateToNotificationsInboxScreen()` exported from `apps/mobile/src/navigation/index.tsx` by
  plan 10.

## Files

apps/mobile/src/components/primitives/countBadgeFace.ts
apps/mobile/src/components/primitives/countBadgeFace.test.ts
apps/mobile/src/components/primitives/CountBadge.tsx
apps/mobile/src/lib/notifications/notificationsBellPress.ts
apps/mobile/src/lib/notifications/notificationsBellPress.test.ts
apps/mobile/src/screens/home/HomeNotificationsBell.tsx
apps/mobile/src/screens/home/HomeScreen.tsx
apps/mobile/e2e/notifications-inbox.yaml
apps/mobile/vitest.config.ts
release-notes/scratchpad.md

## Changes

### `apps/mobile/src/lib/notifications/notificationsBellPress.ts` (new)

```typescript
import type { AccessDenialReason, FeatureAccess } from '@podverse/helpers';

import type { AuthStatus } from '../../auth/AuthProvider';

export type NotificationsBellPress =
  | { kind: 'open' }
  | { kind: 'gate'; reason: AccessDenialReason };

/**
 * What a press on the Home notifications bell does. Signed out always gates on an account. A
 * signed-in user whose account snapshot has not arrived opens the inbox: the tier reads as
 * anonymous in that window, and a gate would ask someone who just signed in to sign in.
 */
export function resolveNotificationsBellPress({
  access,
  isTierKnown,
  status,
}: {
  access: FeatureAccess;
  isTierKnown: boolean;
  status: AuthStatus;
}): NotificationsBellPress {
  if (status !== 'authenticated') {
    return { kind: 'gate', reason: 'needs_account' };
  }
  if (!isTierKnown || access.allowed) {
    return { kind: 'open' };
  }
  return { kind: 'gate', reason: access.reason };
}
```

Both imports are type-only, so the `@podverse/helpers` barrel is not pulled into the bundle.

### `apps/mobile/src/components/primitives/countBadgeFace.ts` (new)

Pure module, no React Native import, so the node Vitest suite can load it. Named export only.

```typescript
/**
 * Digits on a count badge. With no max, the digits are the count. With a max, a count above it
 * reads as that max followed by "+".
 */
export function formatCountBadgeFace(count: number, max?: number): string {
  if (max !== undefined && count > max) {
    return `${max}+`;
  }
  return String(count);
}
```

`count > max`, not `>=`, so 99 with `max` 99 stays `99`. Do not floor, clamp, or default `max`.
An omitted `max` must stay `String(count)`, which is the face `CountBadge` paints today.

### `apps/mobile/src/components/primitives/CountBadge.tsx`

Add optional `max?: number` to `CountBadgeProps`. Document on the prop: when set, a count above
it is shown as that max followed by `+`; when omitted, the badge shows the full count. There is
no default. `ListRow` and `HomeFeedGridCell` omit it.

In `CountBadge`, read `max` and replace `const face = String(count)` with
`formatCountBadgeFace(count, max)`. Leave `const stretches = count >= 10` and the `count <= 0`
early return as they are. Import `formatCountBadgeFace` from `'./countBadgeFace'`. Do not export
it from `primitives/index.ts`. Do not add a default of 99.

Extend the component doc comment with one sentence: an optional `max` replaces a higher count
with that max followed by `+`.

### `apps/mobile/src/screens/home/HomeNotificationsBell.tsx` (new)

Named export `HomeNotificationsBell`, no props.

- Hooks: `useTranslation()`, `useAuth()` (`status`), `useAccessTier()` (`evaluateFeature`,
  `isTierKnown`), `useMembershipGate()` (`openGate`), `useNotificationsUnreadCount()`, and
  `useThemedStyles` with a module-scope `createStyles` for the two styles below.
- `onPress`: call `resolveNotificationsBellPress({ access: evaluateFeature('notifications'),
  isTierKnown, status })`; on `open` call `navigateToNotificationsInboxScreen()`, on `gate` call
  `openGate(result.reason)`.
- Accessible name, from the real `unreadCount` (the face cap does not apply here):

  ```tsx
  const notificationsLabel = t('settings.notifications.notifications');
  const accessibilityLabel =
    unreadCount > 0
      ? `${notificationsLabel}, ${t('settings.notifications.unread_count_aria', {
          count: unreadCount,
        })}`
      : notificationsLabel;
  ```

- Render (`CountBadge` has no `pointerEvents` prop, so a wrapper `View` carries the position and
  lets taps through to the control). Do not pass `iconSize`.

  ```tsx
  <View style={styles.root}>
    <HeaderBarAction
      accessibilityLabel={accessibilityLabel}
      icon="notifications"
      onPress={handlePress}
      testID="home-notifications-bell"
    />
    <View pointerEvents="none" style={styles.badge}>
      <CountBadge count={unreadCount} max={99} testID="home-notifications-bell-badge" />
    </View>
  </View>
  ```

  Styles: `root: { position: 'relative' }`, `badge: { position: 'absolute', right: 0, top: 0 }`.
- Imports: `CountBadge` from `'../../components/primitives/CountBadge'`, `HeaderBarAction` from
  `'../../components/screen/HeaderBarAction'`, `navigateToNotificationsInboxScreen` from
  `'../../navigation'`, `useMembershipGate` from `'../../membership/MembershipGateProvider'`,
  `useAccessTier` from `'../../membership/useAccessTier'`, `useAuth` from
  `'../../auth/AuthProvider'`, `useNotificationsUnreadCount` from
  `'../../hooks/useNotificationsUnreadCount'`, `resolveNotificationsBellPress` from
  `'../../lib/notifications/notificationsBellPress'`.
- One doc comment on the component: the Home title-bar bell; the unread count is read here so a
  count change re-renders only this control; Home is the only screen with this bell; the badge
  face stops at 99+ and the accessible name uses the real count.

### `apps/mobile/src/screens/home/HomeScreen.tsx` (large file — Grep `headerRight`, read a window)

In the `useLayoutEffect` that calls `navigation.setOptions` (~898), wrap the trailing slot:

```tsx
headerRight: () => (
  <HeaderBarActions>
    <HomeNotificationsBell />
    <HomeOverflowMenu
      canMarkAllSeen={canMarkAllSeen}
      onMarkAllSeen={handleMarkAllSeen}
      onViewModeChange={handleViewModeChange}
      showMarkAllSeen={showMarkAllSeen}
      viewMode={resolvedPrefs.viewMode}
    />
  </HeaderBarActions>
),
```

Bell first, so it sits to the left of the ellipsis. Add imports for `HeaderBarActions`
(`'../../components/screen/HeaderBarActions'`) and `HomeNotificationsBell` (`'./HomeNotificationsBell'`)
beside the existing `HomeOverflowMenu` import. The effect's dependency list does not change.
`HomeStackNavigator` is also mounted under More's overflow Home; the bell appears there too, which
is still the Home screen.

### `apps/mobile/vitest.config.ts` (large file — Grep `FillList.test.ts` inside `include`)

Add these two strings to the `include` array, next to `'src/components/primitives/FillList.test.ts'`:

- `'src/components/primitives/countBadgeFace.test.ts'`
- `'src/lib/notifications/notificationsBellPress.test.ts'`

Do not edit the header comment. The `include` array is what runs the tests.

## Tests

- `apps/mobile/src/components/primitives/countBadgeFace.test.ts` (Vitest, one `describe` of
  `formatCountBadgeFace`). Mobile unit tests are an allowlist in `apps/mobile/vitest.config.ts`,
  so add `'src/components/primitives/countBadgeFace.test.ts'` beside the existing
  `'src/components/primitives/FillList.test.ts'` include entry. Do not import `CountBadge.tsx`
  from the test; that file loads React Native, and this suite is node-only.
  - omitted `max`: `1` → `'1'`, `99` → `'99'`, `100` → `'100'`, `142` → `'142'`.
  - `max` 99: `99` → `'99'`, `100` → `'99+'`, `142` → `'99+'`.
- `apps/mobile/src/lib/notifications/notificationsBellPress.test.ts` (Vitest, one `describe`).
  Add `'src/lib/notifications/notificationsBellPress.test.ts'` to the same `include` array. The
  module is type-only on its imports, so the test loads in node without a React Native mock.
  - `status: 'anonymous'` and `status: 'unknown'` → `{ kind: 'gate', reason: 'needs_account' }`.
  - `authenticated`, `isTierKnown: false`, access denied with `needs_account` → `{ kind: 'open' }`.
  - `authenticated`, tier known, `{ allowed: true }` → `{ kind: 'open' }`.
  - `authenticated`, tier known, denied `needs_membership` → gate `needs_membership`; denied
    `membership_expired` → gate `membership_expired`.
- Maestro `apps/mobile/e2e/notifications-inbox.yaml` — rewrite the entry steps; keep the Settings
  section from `more-settings` onward unchanged.
  - Header comment: "Signed out, the Home bell opens the login gate, and a /notifications link still
    reaches the inbox's login fill. Signed in, the bell opens the inbox, which slides up over Home;
    the down chevron returns to Home."
  - After `launch-and-connect` and the `notification-stream-e2e` `idle` assertion, replace the
    `tab-more` / `more-nav-notifications` steps with:

    ```yaml
    - assertVisible:
        id: home-notifications-bell
    - tapOn:
        id: home-notifications-bell
    - extendedWaitUntil:
        visible:
          id: premium-gate-modal
        timeout: ${TIMEOUT_FASTER}
    - assertVisible:
        id: premium-gate-login
    - takeScreenshot: notifications-bell-login-gate
    - tapOn:
        id: premium-gate-cancel
    - assertNotVisible:
        id: notifications-inbox-screen

    - openLink: podverse-next://notifications
    - runFlow: shared/confirm-ios-open-dialog.yaml
    - extendedWaitUntil:
        visible:
          id: notifications-inbox-screen
        timeout: ${TIMEOUT_SLOW}
    - assertVisible:
        id: notifications-inbox-dismiss
    - assertVisible:
        id: notifications-inbox-auth-required
    - assertVisible:
        id: notifications-inbox-auth-required-action
    - takeScreenshot: notifications-inbox-login-required
    - tapOn:
        id: notifications-inbox-dismiss
    - extendedWaitUntil:
        notVisible:
          id: notifications-inbox-screen
        timeout: ${TIMEOUT_FAST}
    - assertVisible:
        id: home-screen
    ```

  - Keep `shared/login-seeded-user.yaml` and the stream `open` / background / relaunch steps.
  - Replace the signed-in `tab-more` / `more-nav-notifications` / `stack-header-back` block
    (from the first signed-in `tapOn: tab-more` through `takeScreenshot: notifications-inbox-initial`
    and the following `stack-header-back` tap) with:

    ```yaml
    - tapOn:
        id: tab-home
    - assertVisible:
        id: home-notifications-bell
    - tapOn:
        id: home-notifications-bell
    - extendedWaitUntil:
        visible:
          id: notifications-inbox-screen
        timeout: ${TIMEOUT_SLOW}
    - assertNotVisible:
        id: premium-gate-modal
    - takeScreenshot: notifications-inbox-initial
    - tapOn:
        id: notifications-inbox-dismiss
    - extendedWaitUntil:
        notVisible:
          id: notifications-inbox-screen
        timeout: ${TIMEOUT_FAST}
    - assertVisible:
        id: home-screen
    - takeScreenshot: notifications-bell-home

    # Account-level subscribe defaults live under More > Settings, not the inbox.
    - tapOn:
        id: tab-more
    ```

    then continue with the existing `tapOn: more-settings` step. Remove the old comment "Back
    returns to the More menu."
  - The seeded account's unread count is not fixed, so the flow does not assert the badge; the
    screenshot shows it when present.

## Release scratchpad

```markdown
## Home title-bar notifications bell

- Surfaces: mobile
- Change: Home's title bar has a filled bell to the left of the ellipsis. It shows the unread
  notifications count, stopping at 99+, and opens the notifications inbox, which slides up from
  the bottom. Signed out, the bell opens the login prompt; signed in without notifications access
  (no membership or an expired one), it opens the membership prompt. The bell is the only in-app
  way to open the inbox; links, push taps, and banner taps still open it too.
- Who notices: everyone on mobile
- Operator steps: none
```
