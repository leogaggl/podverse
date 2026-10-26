**Cursor model:** Cursor Grok 4.7 · **Reasoning:** extra high

# 10 — Notifications inbox becomes a root slide-up screen; the tab goes away

## Rows

R1, R4, R5, R8, R10

## Runs after

none

## Goal

The notifications inbox stops being a bottom tab (or a More overflow row) and becomes a root-stack
screen that slides up from the bottom over the tab shell, the same presentation the image viewer
uses. A down chevron dismisses it. Deep links and push/banner taps that target `/notifications`
land on that root screen. The More tab and its overflow row lose the unread badge. Plan 11 adds
the Home bell that opens this screen; this plan adds the `navigateToNotificationsInboxScreen()`
helper plan 11 calls.

Product rules this plan carries out (from `00-REQUEST.md` operator answers):

- Notifications is not a tab option at all. It cannot be pinned to the tab bar, it is not a More
  overflow row, and Settings > Tab Bar does not list it.
- The More tab carries no notifications badge.
- The inbox slides up from the bottom (root slide-up card, `ROOT_SLIDE_UP_SCREEN_OPTIONS`).

## Parity source

`ImageViewerScreen` (`apps/mobile/src/screens/image/ImageViewerScreen.tsx`) is the pattern: a
root-stack screen registered with `ROOT_SLIDE_UP_SCREEN_OPTIONS`, drawing its own
`HeaderBarChrome` with `backIcon="chevron-down"` and `backAccessibilityLabel={t('misc.dismiss')}`.
The full player's `onClose` in `MobileTabNavigator` is the pattern for dismissing when nothing is
under the card (`canGoBack()` false after a cold-start link): navigate to `MainTabs`.

## Files

apps/mobile/src/navigation/index.tsx
apps/mobile/src/navigation/deepLinking.ts
apps/mobile/src/navigation/deepLinking.test.ts
apps/mobile/src/navigation/notificationStack.test.ts
apps/mobile/src/navigation/tabBarIcon.tsx
apps/mobile/src/prefs/tabLayout.ts
apps/mobile/src/prefs/tabLayout.test.ts
apps/mobile/src/screens/notifications/NotificationsInboxScreen.tsx
apps/mobile/e2e/browse.yaml
apps/mobile/e2e/banner-notification.yaml
release-notes/scratchpad.md

## Files checked and left unchanged

- `apps/mobile/src/navigation/notificationStack.ts` — `resolveMobileDeepLinkState` /
  `resolveMobileDeepLinkAction` already fall through to `getDefaultStateFromPath(scopedPath)` for
  any non-Home-content path. Once the linking config maps `notifications` to the root route,
  `/notifications` resolves to a `NAVIGATE` to `NotificationsInbox` with no code change here.
- `apps/mobile/src/push/notificationRouting.ts` and `apps/mobile/src/push/notificationTarget.ts` —
  push taps resolve a path and feed the same pending-deep-link buffer in `App.tsx`. A payload whose
  path is `/notifications` reaches the new root route through the linking config. No change.
- `apps/mobile/src/push/openAccountNotificationLink.ts` — banner taps and inbox row taps open
  `podverse-next://<path>` through `Linking`, which reaches the same buffer. No change.
  `getActionFromState` sets `pop: true` when a link targets `MainTabs`, so an inbox row that links
  to content pops the inbox card and lands on the content.
- `apps/mobile/src/lib/reorder/resolveHover.test.ts` uses `'Notifications'` as a generic string id
  in a reorder fixture, not a `ContentTabId`. Leave it.
- `apps/mobile/src/screens/more/MoreSettingsTabBarScreen.tsx` derives its rows from
  `CONTENT_TAB_IDS` / `overflowTabs`, so removing the id removes the Notifications row and its
  `more-settings-tab-bar-add-notifications` control. No edit.
- `packages/i18n-catalog/**` — no catalog change. The inbox title keeps `nav.tab.notifications`
  (the stack already uses `nav.tab.downloads` as a non-tab screen title the same way), and the
  dismiss label is the existing `misc.dismiss`.

## Changes

### `apps/mobile/src/navigation/index.tsx` (large file — Grep the anchor, read a window)

1. **Imports.** Remove the `useNotificationsUnreadCount` import (line ~43); nothing in this file
   uses it after the edits below. Keep the `NotificationsInboxScreen` import.
2. **Navigator instances (~157).** Delete
   `const NotificationsStack = createNativeStackNavigator<NotificationsStackParamList>();`.
3. **`NOTIFICATIONS_STACK_ROUTES` (~240).** Delete the whole constant.
4. **`MORE_STACK_ROUTES` (~255).** Delete `MoreOverflowNotifications`.
5. **`ROOT_STACK_ROUTES` (~288).** Add `NotificationsInbox: 'NotificationsInbox',` after
   `MainTabs`.
6. **`notificationsTabLinkScreens` (~419).** Delete the constant.
7. **`mobileNavigationScreens` (~439).**
   - Add `NotificationsInbox: 'notifications',` beside `FullPlayer: 'player'` (root level, outside
     `MainTabs`).
   - Under `More.screens`, delete the `MoreOverflowNotifications` entry and replace the comment
     "Overflow copies of each content-tab stack. `/notifications` still targets the Notifications
     tab." with "Overflow copies of each content-tab stack."
   - Under `MainTabs.screens`, delete the `Notifications` entry.
8. **Types.**
   - Delete `NotificationsStackParamList` (~603).
   - `MoreStackParamList`: delete `MoreOverflowNotifications`.
   - `RootStackParamList`: add `NotificationsInbox: undefined;` after `MainTabs`.
   - `MobileTabParamList`: delete `Notifications: undefined;`.
9. **Navigate helper.** After `navigateToImageViewerScreen` (~1083), add:

   ```typescript
   export function navigateToNotificationsInboxScreen(): void {
     if (!rootNavigationRef.isReady()) {
       return;
     }
     rootNavigationRef.navigate(ROOT_STACK_ROUTES.NotificationsInbox);
   }
   ```

10. **`NotificationsStackNavigator` (~1475).** Delete the function.
11. **`MoreStackNavigator` (~1541).** Delete the `MoreStack.Screen` whose name is
    `MORE_STACK_ROUTES.MoreOverflowNotifications`.
12. **`MoreRootScreen` (~1810).**
    - Delete `const notificationsUnreadCount = useNotificationsUnreadCount();`.
    - In `openOverflowTab`, delete the `case 'Notifications':` branch. The switch stays exhaustive
      over the narrowed `ContentTabId`.
    - In `overflowItems`, delete the `badgeCount: tabId === 'Notifications' ? … : undefined,` line.
      Overflow rows carry no badge.
13. **`TabScaffold` (~2020).**
    - Delete `notificationsUnreadCount` and `moreTabBadgeCount`.
    - Delete the whole `<Tab.Screen component={NotificationsStackNavigator} name="Notifications" …/>`
      (~2194–2204).
    - In the `More` `Tab.Screen` options, delete `tabBarBadge: moreTabBadgeCount > 0 ? … : undefined,`.
14. **Root stack (`MobileTabNavigator`, ~2318).** After the `ImageViewer` screen, add:

    ```tsx
    <RootStack.Screen
      component={NotificationsInboxScreen}
      name={ROOT_STACK_ROUTES.NotificationsInbox}
      options={ROOT_SLIDE_UP_SCREEN_OPTIONS}
    />
    ```

After the edits, Grep the file for `Notifications'`, `NotificationsStack`, `MoreOverflowNotifications`,
and `notificationsUnreadCount`; only `NotificationsInbox` / `NotificationsInboxScreen` and the
`NotificationStreamE2eStatus` marker should remain.

### `apps/mobile/src/screens/notifications/NotificationsInboxScreen.tsx`

1. Props type: replace the `NotificationsStackParamList` import with
   `import type { RootStackParamList } from '../../navigation';` and type the props as
   `NativeStackScreenProps<RootStackParamList, 'NotificationsInbox'>`. Rename the parameter from
   `_props` to `{ navigation }`.
2. Import `ROOT_STACK_ROUTES` (value) from `'../../navigation'` on its own line, `HeaderBarChrome`
   from `'../../components/screen/HeaderBarChrome'`, and `useSafeAreaInsets` from
   `'react-native-safe-area-context'`.
3. Add a dismiss handler:

   ```typescript
   const handleDismiss = useCallback(() => {
     if (navigation.canGoBack()) {
       navigation.goBack();
       return;
     }
     navigation.navigate(ROOT_STACK_ROUTES.MainTabs);
   }, [navigation]);
   ```

4. Render the chrome as the first element inside the `notifications-inbox-screen` container,
   above `FillList`:

   ```tsx
   <HeaderBarChrome
     backAccessibilityLabel={t('misc.dismiss')}
     backIcon="chevron-down"
     backTestID="notifications-inbox-dismiss"
     onBack={handleDismiss}
     title={t('nav.tab.notifications')}
   />
   ```

5. The card covers the tab bar and mini player, so the bottom-chrome overlay inset is zero here and
   the home indicator is uncovered. In the `content` style add the bottom safe-area inset:
   `paddingBottom: tokens.spacing.lg + insets.bottom` (read `insets` from `useSafeAreaInsets()`
   and add `insets.bottom` to that `useMemo`'s dependency list).
6. Everything else (focus effects, `markNotificationsInboxFocused`, offline and login fills, live
   rows, load more) stays as is. The signed-out `CallToActionSection` fill stays: a `/notifications`
   link opened while signed out still lands here.

### `apps/mobile/src/prefs/tabLayout.ts`

- Remove `'Notifications'` from `CONTENT_TAB_IDS`, the `Notifications` entry from
  `TAB_TEST_ID_SLUG`, and the `if (tabId === 'Notifications')` branch from `tabLabelKey`.
- No storage migration. `parseVisibleTabs` already drops any id that is not in `CONTENT_TAB_IDS`,
  so a device that pinned Notifications keeps its other tabs in order, and a stored bar that held
  only Notifications falls back to `DEFAULT_VISIBLE_TABS`. Extend the module doc comment with one
  sentence saying an unknown stored id is dropped when read.

### `apps/mobile/src/navigation/tabBarIcon.tsx`

Remove `'notifications'` from `TabIconKey` and its `TAB_ICON_NAMES` entry.

### `apps/mobile/src/navigation/deepLinking.ts`

Rename `MOBILE_NOTIFICATIONS_TAB_PATH` to `MOBILE_NOTIFICATIONS_PATH` (both uses). Behavior stays:
any path whose first segment is `notifications` maps to `/notifications`, which the linking config
now resolves to the root `NotificationsInbox` screen.

## Tests

- `apps/mobile/src/prefs/tabLayout.test.ts`
  - "keeps a valid unique order and drops unknown ids": use
    `'["Recommendations","Home","Browse","Search","My Library"]'` →
    `['Recommendations', 'Home', 'Browse', 'Search']`, and add
    `parseVisibleTabs('["Home","Notifications","Search"]')` → `['Home', 'Search']` and
    `parseVisibleTabs('["Notifications"]')` → `[...DEFAULT_VISIBLE_TABS]` (a bar stored before
    Notifications stopped being a tab).
  - "treats tabs not on the bar as More overflow": `['Recommendations']`.
  - Replace `'Notifications'` with `'Recommendations'` in the `addVisibleTab`, `addVisibleTabAt`,
    and overflow-to-visible `applyTabBarDrop` cases (expected arrays change the same way).
- `apps/mobile/src/navigation/deepLinking.test.ts`: add a case under `mapIncomingPathToScopedPath`
  — `/notifications`, `/notifications/anything`, and `podverse-next://notifications` all map to
  `/notifications`.
- `apps/mobile/src/navigation/notificationStack.test.ts`: in the `resolveMobileDeepLinkAction`
  describe, add `NotificationsInbox: 'notifications'` at the root of the shared `options.screens`
  and a case: `resolveMobileDeepLinkAction('/notifications', options)` matches
  `{ payload: { name: 'NotificationsInbox' }, type: 'NAVIGATE' }`.
- Maestro `apps/mobile/e2e/browse.yaml` (Discovery area; tab bar pref):
  - Header comment: replace "Notifications lives in More." and "Settings can swap Notifications
    onto the bar" with Recommendations wording ("Recommendations lives in More." / "Settings can
    swap Recommendations onto the bar (replaces the last visible content tab).").
  - Line ~14: `assertNotVisible: id: tab-notifications` stays (Notifications is never a tab).
  - Line ~379: replace `assertVisible: id: more-nav-notifications` with
    `assertNotVisible: id: more-nav-notifications` followed by
    `assertVisible: id: more-nav-recommendations`.
  - On the tab bar settings screen (after `takeScreenshot: browse-tab-bar-settings`), add
    `assertNotVisible: id: more-settings-tab-bar-add-notifications`, then tap
    `more-settings-tab-bar-add-recommendations` instead of `…-add-notifications`.
  - After the two `stack-back` runs: comment "addVisibleTab appends Recommendations and drops the
    last content tab, My Library.", `assertVisible: id: tab-recommendations`,
    `assertVisible: id: tab-browse`, `assertNotVisible: id: tab-my-library`, and rename the
    screenshot to `browse-tab-bar-recommendations-visible`.
- Maestro `apps/mobile/e2e/banner-notification.yaml` (covers the `/notifications` link path, since
  a banner tap opens `podverse-next://notifications`):
  - Header comment: "A later tap opens Notifications, which slides up over this screen. The down
    chevron returns to it."
  - After `takeScreenshot: banner-notification-opened-inbox`, append:

    ```yaml
    - assertVisible:
        id: notifications-inbox-dismiss
    - tapOn:
        id: notifications-inbox-dismiss
    - extendedWaitUntil:
        notVisible:
          id: notifications-inbox-screen
        timeout: ${TIMEOUT_FAST}
    - assertVisible:
        id: more-e2e-playback-screen
    - takeScreenshot: banner-notification-inbox-dismissed
    ```

`notifications-inbox.yaml` still enters through More here; plan 11 rewrites it to enter through the
Home bell. The set's tests run once at the end, after plan 11.

## Release scratchpad

```markdown
## Notifications is no longer a tab; the inbox slides up

- Surfaces: mobile
- Change: Notifications is removed as a tab option. It cannot be pinned to the tab bar, it is not
  a row on More, and Settings > Tab Bar no longer lists it. The inbox is now a full-screen card
  that slides up from the bottom over the tab bar and mini player, with a down chevron to dismiss.
  Links, push taps, and in-app banner taps that open `/notifications` land on that card. The More
  tab no longer shows the unread notifications badge.
- Who notices: everyone on mobile; users who had pinned Notifications to the tab bar see it gone
  and keep their other tabs in the same order
- Operator steps: none
```
