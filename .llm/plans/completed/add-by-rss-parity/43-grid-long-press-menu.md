# 43 — Grid tiles: hold for the swipe action

**Cursor model:** Cursor Grok 4.7 · **Reasoning:** medium

Rows: R11, R12. Mobile only.

Runs last of area D, after plan 42 (same screen, and this plan reuses 42's `handleUnsubscribe`).
Never together with plan 34, 40, 41, or 42.

Parity source: the list row's `SwipeActionRow` (`src/components/primitives/SwipeActionRow.tsx`)
for which action a tile offers, and `MoreMenu` (`src/components/primitives/MoreMenu.tsx`), the
bottom sheet with a Cancel button that row More menus already use, for how it is shown.

## Answers

**R11.** Holding a grid tile does nothing today: `HomeFeedGridCell` has only `onPress`. A list row
on the same chip reveals exactly one action on swipe: Unsubscribe for a follow (Home channel
chips, and the Add by RSS library after plan 42) and Delete All for a Home "Downloaded only" row.

**R12.** The common bottom sheet is `MoreMenu`. Its Cancel button is built in; an item press
closes the sheet and then runs the item.

## Locked decisions

1. **One optional action.** `HomeFeedGridCell` takes `removeAction?: { label; onRemove }`, the
   same single action `SwipeActionRow` reveals. With it set, a long press opens `MoreMenu` with
   that one item (danger tone, like the swipe button) and Cancel. Without it, the tile has no long
   press (Browse tiles keep today's behavior, as Browse rows have no swipe).
2. **Where it is set.** Home channel-chip grid → Unsubscribe (`handleUnsubscribe`). Home
   "Downloaded only" grid → Delete All (`handleDeleteUnsubscribedDownloads`). Add by RSS library
   channel-chip grid → Unsubscribe (plan 42's `handleUnsubscribe`).
3. **Timing.** React Native's default long-press delay (500 ms). A long press does not also fire
   the tap.
4. **Screen readers.** The tile exposes the same action as an accessibility action named
   `remove`, run directly with no sheet, matching `SwipeActionRow`.
5. **Errors.** The screen handlers already set their error notice and then throw; the tile
   swallows that rejection (it has no spinner to stop).
6. **Render cost.** The sheet mounts on the first long press only and stays mounted after that
   (`shouldMountRowMoreMenu`), and screens pass a memoized action object so memoized tiles do not
   re-render.

## Files

| File                                                 | Change                          |
| ---------------------------------------------------- | ------------------------------- |
| `src/screens/home/HomeFeedGridCell.tsx`              | `removeAction`, long press      |
| `src/screens/home/HomeScreen.tsx`                    | Pass Unsubscribe and Delete All |
| `src/screens/rss/AddByRssRootScreen.tsx`             | Pass Unsubscribe                |
| `e2e/subscriptions-anonymous.yaml`                   | Hold a tile, then Cancel        |
| `.cursor/skills/mobile-reusable-components/SKILL.md` | Grid tile long press            |
| `release-notes/scratchpad.md`                        | Entry                           |

App paths are under `apps/mobile/`.

## Implementation

### `HomeFeedGridCell.tsx`

```typescript
export type HomeFeedGridCellRemoveAction = {
  /** Already localized. Names the sheet item and the accessibility action. */
  label: string;
  onRemove: (row: HomeFeedRowData) => void | Promise<void>;
};
```

Add `removeAction?: HomeFeedGridCellRemoveAction` to the props (alphabetical order). Imports:
`useCallback`, `useMemo`, `useState` from `react`; `MoreMenu` and `type MoreMenuSection` from the
existing `'../../components/primitives'` import; `shouldMountRowMoreMenu` from
`'../../components/player/rowMoreMenuMount'`.

In the component, after the existing labels:

```typescript
const cellTestID = testID ?? `home-feed-cell-${row.id}`;
const [isMenuVisible, setIsMenuVisible] = useState(false);
const [hasOpenedMenu, setHasOpenedMenu] = useState(false);

const runRemove = useCallback(() => {
  if (removeAction === undefined) {
    return;
  }
  const result = removeAction.onRemove(row);
  if (result instanceof Promise) {
    // The screen shows the failure; the rejection only matters to a swipe row's spinner.
    void result.catch(() => undefined);
  }
}, [removeAction, row]);

const openMenu = useCallback(() => {
  setHasOpenedMenu(true);
  setIsMenuVisible(true);
}, []);

const closeMenu = useCallback(() => {
  setIsMenuVisible(false);
}, []);

const menuSections = useMemo<MoreMenuSection[]>(
  () =>
    removeAction === undefined
      ? []
      : [
          {
            items: [
              { key: 'remove', label: removeAction.label, onPress: runRemove, tone: 'danger' },
            ],
            key: 'actions',
          },
        ],
  [removeAction, runRemove]
);
```

On the `Pressable`:

- `accessibilityActions={removeAction === undefined ? undefined : [{ label: removeAction.label,
  name: 'remove' }]}`
- `onAccessibilityAction={(event) => { if (event.nativeEvent.actionName === 'remove') {
  runRemove(); } }}`
- `onLongPress={removeAction === undefined ? undefined : openMenu}`
- `testID={cellTestID}`

Return a fragment: the `Pressable`, then

```tsx
{shouldMountRowMoreMenu(removeAction !== undefined, hasOpenedMenu) ? (
  <MoreMenu
    cancelLabel={t('misc.cancel')}
    onCancel={closeMenu}
    sections={menuSections}
    testID={`${cellTestID}-menu`}
    visible={isMenuVisible}
  />
) : null}
```

`MoreMenu` renders through `AppOverlay`, which draws nothing in place, so the grid layout does
not change. Its item testID is `${cellTestID}-menu-remove` and Cancel is
`${cellTestID}-menu-cancel`.

Add to the component doc comment: "With `removeAction`, holding the tile opens the bottom sheet
with the one action a list row's swipe reveals, plus Cancel."

### `HomeScreen.tsx`

- Import `type HomeFeedGridCellRemoveAction` from `'./HomeFeedGridCell'`.
- `HomeFeedListItem` gains `unsubscribeAction: HomeFeedGridCellRemoveAction`. Its grid branch
  passes `removeAction={isHomeFilterMediaType(mediaType) ? unsubscribeAction : undefined}`.
- Beside `const unsubscribeLabel = t('features.unsubscribe');`:

```typescript
const unsubscribeAction = useMemo<HomeFeedGridCellRemoveAction>(
  () => ({ label: unsubscribeLabel, onRemove: handleUnsubscribe }),
  [handleUnsubscribe, unsubscribeLabel]
);
```

  Pass `unsubscribeAction={unsubscribeAction}` in `renderItem` and add it to the dependency list.
- Delete All, declared before the `listFooter` memo that renders the "Downloaded only" grid:

```typescript
const deleteAllAction = useMemo<HomeFeedGridCellRemoveAction>(
  () => ({ label: t('features.download.delete_all'), onRemove: handleDeleteUnsubscribedDownloads }),
  [handleDeleteUnsubscribedDownloads, t]
);
```

  The footer's `HomeFeedGridCell` (`testID={`home-unsubscribed-download-cell-${row.id}`}`) gets
  `removeAction={deleteAllAction}`; add `deleteAllAction` to that memo's dependency list.

### `AddByRssRootScreen.tsx`

- Import `type HomeFeedGridCellRemoveAction` beside `HomeFeedGridCell`.
- `LibraryFeedListItem` gains `removeAction?: HomeFeedGridCellRemoveAction`, passed to its
  `HomeFeedGridCell`.
- Beside plan 42's `unsubscribeLabel`, memoize `unsubscribeAction` from `unsubscribeLabel` and
  `handleUnsubscribe` (same shape as Home). `renderItem` passes
  `removeAction={isAddByRssLibraryFilterMediaType(selectedMediaType) ? unsubscribeAction :
  undefined}`; add `unsubscribeAction` to its dependency list.

### `mobile-reusable-components/SKILL.md`

After the **Grid (`HomeFeedGridCell`)** bullet in "Home subscription markers", add:

```markdown
**Grid long press:** a tile whose list row has a swipe action passes it as `removeAction`;
holding the tile opens `MoreMenu` with that action and Cancel, and screen readers get it as the
`remove` accessibility action. A tile with no swipe counterpart (Browse) has no long press.
```

## Tests

- No unit test: the cell's logic is gesture and overlay wiring in React Native.
- Maestro `e2e/subscriptions-anonymous.yaml`, inserted after
  `- takeScreenshot: home-view-grid-subscribed` and before the overlay switch back to list view:

```yaml
# Holding a tile opens the list row's swipe action in the bottom sheet. Cancel keeps the follow.
- longPressOn:
    id: "home-feed-cell-.*"
- extendedWaitUntil:
    visible:
      id: "home-feed-cell-.*-menu-remove"
      text: Unsubscribe
    timeout: ${TIMEOUT_FASTER}
- assertVisible:
    id: "home-feed-cell-.*-menu-cancel"
- takeScreenshot: home-grid-long-press-menu
- tapOn:
    id: "home-feed-cell-.*-menu-cancel"
- extendedWaitUntil:
    notVisible:
      id: "home-feed-cell-.*-menu-remove"
    timeout: ${TIMEOUT_FASTER}
- assertVisible:
    id: "home-feed-cell-.*"
```

## Release scratchpad

Append to `release-notes/scratchpad.md`:

```markdown
## Mobile grid tiles: hold to unsubscribe or delete

- Surfaces: mobile
- Change: In grid view, holding a tile opens a bottom sheet with the action that a list row's
  swipe reveals, plus Cancel: Unsubscribe on Home's Podcasts, Artists, and Albums and on the Add
  by RSS library, and Delete All on Home's "Downloaded only" tiles. Screen readers get the same
  action from the tile. Browse tiles are unchanged.
- Who notices: anyone who uses grid view
- Operator steps: none
```
