**Cursor model:** Cursor Grok 4.7 · **Reasoning:** medium

# 43 — Mobile unread count on the More tab and More row

The unread notification count shows wherever Notifications lives in the tab layout. When
Notifications is a visible tab, its tab badge shows the count, as it does today. When it is in
overflow (the factory layout), the More tab's badge and the More screen's Notifications row show
it instead. All three read plan 40's store, so they update live.

Before editing, confirm these exist in `apps/mobile/src/navigation/index.tsx` and adjust anchors if
they moved:

- `MoreRootScreen` and its `overflowItems` map over `overflowTabIds`;
- `TabScaffold`, its `visibleTabSet`, and its `useNotificationsUnreadCount()` call (plan 40 removed
  the argument);
- the `Tab.Screen` options for `Notifications` and `More`.

Also confirm that `MenuListItem` in `apps/mobile/src/components/screen/MenuListScreen.tsx` has
`badgeCount`.

## Rows

R6

## Runs after

40

## Files

apps/mobile/src/navigation/index.tsx
release-notes/scratchpad.md

## Reuses

- `useNotificationsUnreadCount()`, which reads plan 40's store.
- `MenuListItem.badgeCount`, which `ListRow` already renders as a `CountBadge` with testID
  `${testID}-badge` and folds into the row's accessibility label (`Notifications, 3`).
- The tab bar's existing `tabBarBadge` and `tabBarBadgeStyle`.

## Changes

1. **More row.** In `MoreRootScreen`:
   - read `const notificationsUnreadCount = useNotificationsUnreadCount();`;
   - in the `overflowItems` map, add `badgeCount: tabId === 'Notifications' ?
     notificationsUnreadCount : undefined`.

   The row's badge testID becomes `more-nav-notifications-badge` with no further code.
2. **More tab.** In `TabScaffold`:
   - compute `const moreTabBadgeCount = visibleTabSet.has('Notifications') ? 0 :
     notificationsUnreadCount;`;
   - in the `More` `Tab.Screen` options, add `tabBarBadge: moreTabBadgeCount > 0 ?
     moreTabBadgeCount : undefined`.
   - Leave the `Notifications` tab's badge as it is. It only renders when that tab is visible.
3. **Scope.** Do not move the My Library downloads badge, and do not sum other counts into More.
   The More badge carries the notification count only.

No new strings. The badge is a number, and the row's accessibility label already includes it.

## Tests

- No unit test. The change is two option values computed from one boolean, and the store and
  hook it reads are covered by plan 40.
- No new Maestro assertion. The E2E user has no unread notifications, and nothing in a flow can
  create one, so a badge assertion would have nothing to show. `apps/mobile/e2e/notifications-inbox.yaml`
  still opens Notifications from the More screen. That proves the row keeps its testID and press
  target with the new prop.

## Release scratchpad

```markdown
## Mobile unread notification count on More

- Surfaces: mobile
- Change: when Notifications is not one of the visible tabs (the default layout), the More tab
  and the More screen's Notifications row show the unread notification count, updating live.
  When Notifications is a visible tab, its own tab badge shows the count as before.
- Who notices: signed-in mobile users on the default tab layout, who previously saw no unread
  indicator
- Operator steps: none
```
