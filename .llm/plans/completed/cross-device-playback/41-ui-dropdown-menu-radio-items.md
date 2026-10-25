**Cursor model:** Cursor Grok 4.7 · **Reasoning:** high

# 41 — `@podverse/ui` dropdown menu: radio items with a description line

The device menu (plan 44) lists devices: one marked This Device, one highlighted as playing.
`DropdownMenuPanel` today renders a plain label per item, keyed by label. Two devices can share a
label until numbered, the playing device needs a checked state screen readers announce, and each
entry needs a short second line ("This Device · Playing"). This plan adds those three optional
fields to the shared panel, so the device menu reuses the same panel, keyboard navigation, and
styles as the player's Settings menu instead of a one-off menu (**reusable-components**,
**prefer-shared-ui-web-management**).

Every existing caller passes none of the new fields and renders exactly as before.

## Rows

R12, R39

## Runs after

none

## Files

packages/ui/src/components/navigation/DropdownMenu/DropdownMenuPanel.tsx
packages/ui/src/components/navigation/DropdownMenu/DropdownMenuPanel.module.scss
packages/ui/src/components/navigation/DropdownMenu/DropdownMenuPanel.test.tsx

## `DropdownMenuPanelItem`

Add three optional fields after `dismissOnSelect`:

```typescript
export type DropdownMenuPanelItem = {
  label: string;
  onClick: () => void;
  variant?: 'primary' | 'warning' | 'danger';
  /** When false, selecting the item does not close the menu (default true). */
  dismissOnSelect?: boolean;
  /** React key; defaults to `label`. Set it when two items can share a label. */
  key?: string;
  /** Second line under the label, smaller and muted. */
  description?: string;
  /**
   * Radio state. When any item in the list sets `checked` (true or false), every item renders as
   * `menuitemradio` with `aria-checked`; otherwise items stay `menuitem`.
   */
  checked?: boolean;
};
```

## `DropdownMenuPanel` rendering

- Before the `return`, compute `const isRadioGroup = menuItems.some((item) => item.checked !== undefined);`.
- `<li>`:
  - `key={item.key ?? item.label}`.
  - `role={isRadioGroup ? 'menuitemradio' : 'menuitem'}`.
  - `aria-checked={isRadioGroup ? item.checked === true : undefined}`.
  - Add `item.checked === true ? styles.menuItemChecked : null` to the `classNames` call.
  - Keep `tabIndex`, `onClick`, `onMouseEnter`, and `aria-selected` exactly as they are.
- Content: when `item.description` is a non-empty string, render
  `<span className={styles.menuItemLabel}>{item.label}</span><span className={styles.menuItemDescription}>{item.description}</span>`;
  otherwise render `{item.label}` as today (no wrapper span), so existing menus keep their DOM.

## `DropdownMenuPanel.module.scss`

Add after `.menuItemDanger`, using existing tokens only and no `var()` fallbacks
(**css-custom-properties-no-var-fallbacks**):

```scss
.menuItemChecked {
  font-weight: var(--font-weight-bold);
  color: var(--text-color-accent);
}

.menuItemLabel {
  display: block;
}

.menuItemDescription {
  display: block;
  margin-top: var(--spacing-xs);
  font-size: var(--font-size-sm);
  font-weight: normal;
  color: var(--text-color-secondary);
}
```

`.menuItemDescription` sets `font-weight: normal` so a checked item's bold label does not make
its description bold.

## Must stay true

- A list with no `checked` field anywhere renders `role="menuitem"` and no `aria-checked`, with
  the same markup as before.
- `useDropdownKeyboardNavigation` is unchanged; arrow keys and Enter work the same for radio
  items.
- No new exports; `DropdownMenuPanelItem` is already exported from
  `packages/ui/src/components/navigation/DropdownMenu/index.ts`.

## Tests

Extend `DropdownMenuPanel.test.tsx` (Vitest + Testing Library, same render setup as the existing
case):

- Items without `checked` → `getAllByRole('menuitem')` has the items and `queryAllByRole('menuitemradio')`
  is empty.
- Two items, one `checked: true` and one `checked: false` → both are `menuitemradio`; the first
  has `aria-checked="true"`, the second `aria-checked="false"`.
- An item with `description: 'This Device'` → the description text is rendered inside the item.
- Two items with the same `label` and different `key` values render without a duplicate-key
  warning (spy on `console.error` and expect no call).

## Release scratchpad

none (shared component; the device menu that uses it has its own entry in plan 44)
