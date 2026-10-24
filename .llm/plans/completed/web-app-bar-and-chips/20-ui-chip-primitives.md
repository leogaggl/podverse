**Cursor model:** Opus 5.5 · **Reasoning:** high

# 20 — Chip primitives in `@podverse/ui`

Add the chip family every web list screen will use: a single chip (`pill` and `filter` variants),
a chip row with a trailing slot that scrolls sideways when it does not fit, a menu chip (one-step
menu), and a sort chip (sort menu with a second range step when the sort is Top). Extend
`DropdownMenuPanel` so a menu can show which option is current, and so a chip's menu can render in
a portal anchored to the chip, where the row's scroller cannot clip it. No app uses these yet;
plan 21 and areas C, D, and E adopt them.

## Rows

R5, R32, R33, R37, R38

## Runs after

none

## Why `@podverse/ui` (R33)

The chip, chip row, filter variant, menu chip, and sort chip are generic: no `next/*`, no
`next-intl`, no data fetch, no product routes. **prefer-shared-ui-web-management** § Promotion
checklist puts a generic, reusable control in `packages/ui`. `ButtonTabs` is already there and is
the closest existing primitive, but management-web (`StatsPageClient`, `FlagStatusPageClient`)
and seven web screens use it, so it stays as is and the chip family is new.

App-local stays app-local: `MediaListChips` (routing, chip persistence, `next-intl`), `ViewSelector`
(the gear, `next-intl`), and the new `ListSortChip` wrapper (plan 21). Every string in this plan
comes from props (**shared-ui-i18n**).

## Parity source

Mobile `apps/mobile/src/components/form/`:

- `SectionChipRow.tsx` — `SectionChip` (`pill` | `filter`), `SectionChipRow` with `trailing`. The
  row is one horizontal `ScrollView` at every width, with no scroll indicator. The trailing
  controls are inside the scroller, after the chips, and scroll with them. The selected chip is
  scrolled fully into view whenever the selection changes, including the one the screen opens
  with: the first reveal jumps, later ones animate. A swipe afterwards is left alone.
- `chipRowReveal.ts` — `getChipRevealOffset`, the offset that brings a chip fully into the row.
  This plan moves it to `@podverse/helpers` so web and mobile run the same arithmetic (§ 3b).
- `chipChrome.ts` — `filterChipChrome`: square radius in both states; idle uses the quiet fill,
  active uses an accent outline and accent label.
- `MenuSelectChip.tsx` — face is the current selection, caret opens the choices, accessible name
  `${heading}: ${faceLabel}`.
- `apps/mobile/src/screens/home/HomeSortChip.tsx` — one chip; the face shows the range while the
  popularity sort is selected; choosing popularity opens a second menu for the range before the
  list is reordered.
- `apps/mobile/src/screens/browse/BrowseSortChip.tsx` — range-only sort chip.

### Same as mobile

- The row never wraps. It is one line that scrolls sideways at **every** width. On a wide screen
  where everything fits, nothing scrolls and the row looks the same as a wrapping row would.
- The trailing controls (Category, Sort, the gear) sit inside the scroller after the chips and
  scroll with them.
- No visible scrollbar.
- The selected chip is scrolled fully into view when the selection changes and on mount. The
  mount reveal jumps; later reveals animate (instant under `prefers-reduced-motion: reduce`).

### Web differences, on purpose

- A chip's menu is the existing `DropdownMenuPanel` popover, not a bottom sheet. It renders in a
  portal on `document.body` with `position: fixed`, anchored to its chip, so the row's
  `overflow-x: auto` (which forces `overflow-y` to clip as well) cannot cut it off.
- While a chip's menu is open, it follows the chip when the page or the row scrolls and when the
  window resizes. It closes, with no selection, once the chip is scrolled fully out of sight
  (out of the row's visible part or out of the viewport). Mobile has no equivalent: its sheet is
  modal, so nothing scrolls under it.
- Keyboard focus also reveals a chip: Tab into a chip that is past the row's edge and the browser
  scrolls the row to it (native focus scrolling; no code). `scroll-padding-inline` keeps the focus
  ring inside the visible part.
- The reveal inset is the row's chip gap rather than mobile's `spacing.base`.

## Files

packages/ui/src/components/navigation/Chip/Chip.tsx
packages/ui/src/components/navigation/Chip/Chip.module.scss
packages/ui/src/components/navigation/Chip/ChipRow.tsx
packages/ui/src/components/navigation/Chip/ChipRow.module.scss
packages/ui/src/components/navigation/Chip/MenuChip.tsx
packages/ui/src/components/navigation/Chip/SortChip.tsx
packages/ui/src/components/navigation/Chip/index.ts
packages/ui/src/components/navigation/Chip/Chip.test.tsx
packages/ui/src/components/navigation/Chip/ChipRow.test.tsx
packages/ui/src/components/navigation/Chip/MenuChip.test.tsx
packages/ui/src/components/navigation/Chip/SortChip.test.tsx
packages/ui/src/components/navigation/DropdownMenu/DropdownMenuPanel.tsx
packages/ui/src/components/navigation/DropdownMenu/DropdownMenuPanel.module.scss
packages/ui/src/components/navigation/DropdownMenu/DropdownMenuPanel.test.tsx
packages/ui/src/hooks/useAnchoredDropdownPosition.ts (new)
packages/ui/src/index.ts
packages/ui/PACKAGES-UI.md
packages/helpers/src/lib/chipRowReveal.ts (new; moved from mobile)
packages/helpers/src/lib/chipRowReveal.test.ts (new; moved from mobile)
packages/helpers/package.json
apps/mobile/src/components/form/chipRowReveal.ts (delete)
apps/mobile/src/components/form/chipRowReveal.test.ts (delete)
apps/mobile/src/components/form/SectionChipRow.tsx
apps/mobile/vitest.config.ts

`packages/ui/src/index.ts` and `packages/ui/PACKAGES-UI.md` are shared with area A. Do not run
this plan at the same time as an area A plan that edits either file. The mobile files and
`packages/helpers/package.json` are shared with no other plan in this set.

`packages/ui/src/hooks/useDropdownViewportClamp.ts` is read, not edited: the new hook reuses its
`DROPDOWN_VIEWPORT_CLAMP_MARGIN_PX` and the `clampRectToViewportEdges` helper it calls.

## 1. `DropdownMenuPanel` — current option, menu name, and the anchored portal

`packages/ui/src/components/navigation/DropdownMenu/DropdownMenuPanel.tsx`.

### 1a. Current option and menu name

- `DropdownMenuPanelItem` gains `checked?: boolean`.
- `DropdownMenuPanelProps` gains `ariaLabel?: string`, rendered as `aria-label` on the `<ul
  role="menu">`.
- When **any** item in `menuItems` has `checked` defined, the panel is a radio menu: every `<li>`
  gets `role="menuitemradio"` and `aria-checked={item.checked === true}`, and every row gets a
  fixed-width leading check slot (`<span className={styles.check} aria-hidden="true">`) holding
  `FaCheck` (from `react-icons/fa`, as `Button.tsx` imports `FaChevronDown`) only on the checked
  row, so labels line up. Otherwise rows keep `role="menuitem"` and no slot. Keep the existing
  `aria-selected` focus attribute and click behavior.
- `DropdownMenuPanel.module.scss`: `.check` is `display: inline-flex`, a fixed width of
  `var(--font-size-base)`, `margin-right: var(--spacing-md)`, and color `var(--text-color-accent)`.
  Make `.menuItem` `display: flex; align-items: center` so the slot and label share one line.

`useDropdownKeyboardNavigation` needs no change: its focus effect falls back to the `<li>` itself,
which carries the role. Its outside-click check tests `menuRef.current.contains(target)`, so a
portaled menu still counts as inside, and React synthetic events from the portal still bubble to
the chip's handlers.

### 1b. Opt-in anchored portal

`DropdownMenuPanelProps` gains:

```ts
/**
 * When set, the open menu renders in a portal on `document.body` with `position: fixed`,
 * anchored to this element, so an `overflow` ancestor (a scrolling chip row) cannot clip it.
 * Omit to keep the menu absolutely positioned inside its wrapper.
 */
anchorRef?: RefObject<HTMLElement | null>;
```

When `anchorRef` is undefined, the panel is unchanged: same markup, same inline `position`,
`verticalPosition`, and `fullWidth` styles, and `useDropdownViewportClamp` as today. `Dropdown`,
`MoreButton`, `SettingsButton`, `EmbedPlayerMoreButton`, the app menus, and `ViewSelector` until
plan 21 do not pass it. Only `MenuChip` and `SortChip` do.

When `anchorRef` is set:

- Call `useAnchoredDropdownPosition` (§ 1c) and use its `anchoredStyle` as the `<ul>`'s whole
  inline style. Do not merge `positionStyle`, `verticalStyle`, `fullWidthStyle`, or
  `viewportClampStyle`.
- Render the same `<ul>` through `createPortal(menu, document.body)` from `react-dom`. The panel
  already returns `null` while closed, so nothing touches `document` during server rendering.
- Keep the `.dropdownMenu` class. Its `z-index: 1000000` already sits above the sticky NavBar.
  Theme variables come from `<html data-ui-theme>`, so a menu on `body` keeps its theme.

Both hooks run on every render, because hooks cannot be conditional: pass
`open: open && anchorRef === undefined` to `useDropdownViewportClamp` and
`open: open && anchorRef !== undefined` to `useAnchoredDropdownPosition`.

### 1c. `useAnchoredDropdownPosition`

New `packages/ui/src/hooks/useAnchoredDropdownPosition.ts`, `'use client'`:

```ts
/** Space between the anchor and the menu; matches the panel's inline `0.25rem` offset. */
export const DROPDOWN_ANCHOR_GAP_PX = 4;

export type UseAnchoredDropdownPositionArgs = {
  open: boolean;
  anchorRef: RefObject<HTMLElement | null> | undefined;
  menuRef: RefObject<HTMLUListElement | null>;
  /** Recompute when the rows change (a sort chip swapping to its range step). */
  menuItems: readonly { label: string }[];
  position?: 'left' | 'right';
  fullWidth?: boolean;
  verticalPosition?: 'above' | 'below';
  /** Called once the anchor is scrolled fully out of sight. */
  onAnchorHidden: () => void;
};

export function useAnchoredDropdownPosition(args: UseAnchoredDropdownPositionArgs): {
  anchoredStyle: CSSProperties;
};
```

Placement, in viewport pixels, from `anchor.getBoundingClientRect()` (`a`) and the menu's
`offsetWidth` / `offsetHeight` (`w`, `h`; layout size, unaffected by transforms):

| Input | Result |
| --- | --- |
| `fullWidth` | `left = a.left`, and the style sets `width: a.width` (so `w = a.width`) |
| `position === 'left'` | `left = a.left` (menu's left edge on the chip's left edge) |
| `position === 'right'` or undefined | `left = a.right - w` (menu's right edge on the chip's right edge; undefined matches today's inline fallback to `right: 0`) |
| `verticalPosition` `'below'` (default) | `top = a.bottom + DROPDOWN_ANCHOR_GAP_PX` |
| `verticalPosition` `'above'` | `top = a.top - DROPDOWN_ANCHOR_GAP_PX - h` |

Then clamp with `clampRectToViewportEdges({ left, top, width: w, height: h }, window.innerWidth,
window.innerHeight, DROPDOWN_VIEWPORT_CLAMP_MARGIN_PX)` and add `dx` / `dy`, so a menu that would
run off an edge slides back inside, as the in-place panel does today.

`anchoredStyle`:

- Closed: `{}`.
- Open, not yet measured: `{ position: 'fixed', top: 0, left: 0, visibility: 'hidden' }`.
- Measured: `{ position: 'fixed', top, left, right: 'auto', bottom: 'auto', margin: 0 }`, plus
  `width` when `fullWidth`.

Timing:

- Measure in a `useLayoutEffect` keyed on `open`, `menuItems`, `position`, `fullWidth`, and
  `verticalPosition`, so the first painted frame is already in place. Set state only when `top`,
  `left`, or `width` changed, so a fresh `menuItems` array each render cannot loop.
- While open, listen to `window` `scroll` with `capture: true` (this catches the chip row's own
  sideways scroll as well as the page) and to `resize`. Each event schedules one
  `requestAnimationFrame` re-measure; cancel the pending frame and remove both listeners on close
  and on unmount.
- While open, observe the anchor with an `IntersectionObserver` (implicit root, `threshold: 0`).
  Its intersection is clipped by every scrolling ancestor, so `isIntersecting === false` means the
  chip is fully out of the row's visible part or out of the viewport: call `onAnchorHidden()`.
  Disconnect on close. Skip the observer when `typeof IntersectionObserver === 'undefined'`
  (jsdom).

The panel passes `onAnchorHidden={() => setOpen(false)}`. Closing this way calls no `onClick`
and does not move focus.

## 2. `Chip`

`Chip.tsx`, a `forwardRef<HTMLButtonElement, ChipProps>`:

```ts
export type ChipVariant = 'pill' | 'filter';

export type ChipProps = Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'type'> & {
  /** `pill` picks which list shows. `filter` narrows it (category, sort, the gear). */
  variant?: ChipVariant; // default 'pill'
  /** Selected face: pill fills with the primary button color; filter gets the accent outline. */
  selected?: boolean; // default false
  /** Sets aria-pressed. Pass for chips that toggle or pick one of a set; omit on menu triggers. */
  pressed?: boolean;
  /** Defined only on menu triggers: sets aria-haspopup="menu", aria-expanded, and the caret. */
  menuExpanded?: boolean;
  /** Leading glyph, wrapped in an aria-hidden span. */
  icon?: ReactNode;
};
```

- Renders `<button type="button">` with the rest props spread, `aria-pressed={pressed}` only when
  `pressed !== undefined`, and `aria-haspopup="menu"` plus `aria-expanded={menuExpanded}` only
  when `menuExpanded !== undefined`.
- The caret (`FaChevronDown`, `aria-hidden`) renders when `menuExpanded !== undefined` **and** the
  chip has `children`. An icon-only menu trigger (the gear) has no caret.
- Icon-only (no `children`) without `aria-label` throws
  `new Error('Chip: icon-only chips require aria-label')`, the same contract as `IconButton`.
- Class names come from `Chip.module.scss` plus the caller's `className`.

`Chip.module.scss` (CSS custom properties only, no `var()` fallbacks):

| Part | Value |
| --- | --- |
| Box | `display: inline-flex; flex: none; align-items: center; gap: var(--spacing-sm); height: 2.25rem; padding: 0 var(--spacing-base); white-space: nowrap; border: 1px solid; cursor: pointer` |
| Type | `font-size: var(--font-size-sm); font-weight: var(--font-weight-medium); line-height: 1` |
| Idle (both variants) | background `var(--background-color-secondary)`, border `var(--border-color-tertiary)`, color `var(--text-color-primary)`; hover background `var(--background-color-tertiary)` |
| `pill` radius | `var(--border-radius-round)` |
| `pill` selected | background and border `var(--button-primary-bg)`, color `var(--button-primary-color)`; hover background and border `var(--button-primary-bg-hover)` |
| `filter` radius | `var(--border-radius)` in both states, so the shape never changes |
| `filter` selected | background `var(--background-color-tertiary)`, border and color `var(--text-color-accent)` |
| Icon-only | `width: 2.25rem; padding: 0; justify-content: center; font-size: var(--font-size-md)` |
| Caret | `font-size: var(--font-size-xs)` |
| Focus | `&:focus-visible { outline: none; @include focus-ring; }` from `../../../styles/mixins/focus` |
| Disabled | `opacity: 0.5; cursor: default`, no hover change |
| `.menuWrapper` | `display: inline-flex; flex: none` (the `MenuChip` / `SortChip` wrapper; no `position`, since the menu is portaled) |

The height is fixed so a text chip, an icon-only chip, and a chip with a caret line up in one row
(**button-stable-bounds**). `flex: none` keeps a chip at its label width inside the scroller.

## 3. `ChipRow`

`ChipRow.tsx`:

```ts
export type ChipRowItem<T extends string> = { key: T; label: string };

export type ChipRowProps<T extends string> = {
  items: readonly ChipRowItem<T>[];
  /** `null` when no item is the current selection. */
  selectedKey: T | null;
  onSelect: (key: T) => void;
  /** Category, Sort, then the gear. Mount each only when the current item can use it. */
  trailing?: ReactNode;
  /** Names the group of items for assistive tech. */
  ariaLabel?: string;
  className?: string;
  /** Root gets it; items get `${testId}-items`, each chip `${testId}-${key}`, trailing `${testId}-trailing`. */
  testId?: string;
};
```

Markup:

```tsx
<div className={classNames(styles.chipRow, className)} data-testid={testId}>
  <div className={styles.scroller} ref={scrollerRef}>
    <div role="group" aria-label={ariaLabel} className={styles.items} data-testid={…-items}>
      {items.map((item) => (
        <Chip key={item.key} ref={…} variant="pill" selected={…} pressed={…} onClick={() => onSelect(item.key)} data-testid={…}>
          {item.label}
        </Chip>
      ))}
    </div>
    {trailing ? <div className={styles.trailing} data-testid={…-trailing}>{trailing}</div> : null}
  </div>
</div>
```

- The root carries the caller's `className` (outer spacing) and the test id. The scroller is an
  inner element so the caller's margin never fights the scroller's own negative margin.
- The trailing group is inside the scroller, after the items, so it scrolls with the chips.
- Items keep the caller's order; selecting one does not move it.
- `onSelect` fires on every click, including the selected chip; callers decide whether that is a
  no-op (`MediaListChips` already returns early).
- Omit each `data-testid` when `testId` is undefined.
- Keep a `Map<T, HTMLButtonElement>` of item chips through callback refs (`Chip` forwards its
  ref), so the reveal can find the selected one.

`ChipRow.module.scss`:

- `.chipRow`: `min-width: 0` only. No `overflow`, no margin.
- `.scroller`: `display: flex; flex-wrap: nowrap; align-items: center; gap: var(--spacing-md);
  overflow-x: auto; overflow-y: hidden; overscroll-behavior-x: contain; scrollbar-width: none;
  padding: var(--spacing-sm); margin: calc(-1 * var(--spacing-sm)); scroll-padding-inline:
  var(--spacing-sm)`, and `&::-webkit-scrollbar { display: none; }`.
  - `--spacing-sm` (0.25rem) is the width of the 4px `--box-shadow-focus` ring. The padding gives
    the ring room inside the clip on every side, and the equal negative margin keeps the chips
    aligned with the page gutter and the row's outer box the same size.
  - `overscroll-behavior-x: contain` stops a sideways swipe at the row's end from turning into the
    browser's back gesture.
- `.items` and `.trailing`: `display: flex; flex: none; flex-wrap: nowrap; align-items: center;
  gap: var(--spacing-md)`.

### 3a. Revealing the selected chip

Mirror `SectionChipRow`'s reveal in a `useLayoutEffect` keyed on `selectedKey`:

1. `animated` is whether the effect has run before (a ref set to `true` after the first run), so
   the mount reveal jumps and later ones animate.
2. Return when `selectedKey === null`, the scroller or the chip is missing, or
   `chip.getClientRects().length === 0`. That last case is a chip hidden by CSS (plan 50's
   `hideDesktop` chips from 1200px up) and has no box to reveal.
3. Measure: `scrollerRect = scroller.getBoundingClientRect()`, `chipRect =
   chip.getBoundingClientRect()`, `edgeInset = Number.parseFloat(getComputedStyle(scroller).columnGap)`,
   or `0` when that is `NaN`.
4. `offset = getChipRevealOffset({ chipX: chipRect.left - scrollerRect.left + scroller.scrollLeft,
   chipWidth: chipRect.width, scrollX: scroller.scrollLeft, viewportWidth: scroller.clientWidth,
   contentWidth: scroller.scrollWidth, edgeInset })` from `@podverse/helpers/chipRowReveal`.
5. When `offset !== null`, `scroller.scrollTo({ left: offset, behavior })`, where `behavior` is
   `'smooth'` when `animated` and the user has not asked for reduced motion
   (`typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches`),
   and `'auto'` otherwise.

A user's own swipe afterwards is left alone: nothing listens to the scroller's scroll here.

### 3b. Share `getChipRevealOffset`

The arithmetic is the same on web and mobile, so it moves to one place (**reuse-beyond-components**),
following the `@podverse/helpers/marquee` precedent (shared by `packages/ui` and mobile through a
subpath, not the barrel):

- Move `apps/mobile/src/components/form/chipRowReveal.ts` to
  `packages/helpers/src/lib/chipRowReveal.ts` unchanged (`ChipRowRevealInput`,
  `getChipRevealOffset`), and its test to `packages/helpers/src/lib/chipRowReveal.test.ts`
  unchanged except the import path (`./chipRowReveal.js`, Tier A specifier).
- `packages/helpers/package.json` `exports`: add `"./chipRowReveal": { "types":
  "./dist/lib/chipRowReveal.d.ts", "default": "./dist/lib/chipRowReveal.js" }` beside
  `"./marquee"`. Do not add it to the barrel.
- `apps/mobile/src/components/form/SectionChipRow.tsx`: import `getChipRevealOffset` from
  `@podverse/helpers/chipRowReveal`. Delete the mobile file and its test.
- `apps/mobile/vitest.config.ts`: remove `'src/components/form/chipRowReveal.test.ts'` from
  `include`, and remove the doc-comment clause that lists `src/components/form/chipRowReveal.ts`
  (keep the sentence grammatical).
- `packages/ui` imports it as `@podverse/helpers/chipRowReveal`.

## 4. `MenuChip`

A filter chip that opens a one-step radio menu. The gear (plan 21) uses it.

```ts
export type MenuChipOption<T extends string> = { value: T; label: string };

export type MenuChipProps<T extends string> = {
  /** Names the control. The accessible name is `label`, or `${label}: ${faceLabel}` with a face. */
  label: string;
  /** Visible text on the face. Omit for an icon-only chip. */
  faceLabel?: string;
  icon?: ReactNode;
  options: readonly MenuChipOption<T>[];
  value: T;
  onSelect: (value: T) => void;
  /** Accessible name of the open menu. Defaults to `label`. */
  menuLabel?: string;
  /** Accent outline on the face. Default false. */
  selected?: boolean;
  /** Which chip edge the menu lines up with. Default 'left'. */
  position?: 'left' | 'right';
  testId?: string;
};
```

- Wrapper `<div className={styles.menuWrapper}>` from `Chip.module.scss`.
- Trigger: `<Chip variant="filter" selected={selected} menuExpanded={open} icon={icon}
  aria-label={…} title={label} ref={buttonRef} onClick={toggle} onKeyDown={handleButtonKeyDown}
  data-testid={testId ? `${testId}-button` : undefined}>{faceLabel}</Chip>`.
- Menu: `DropdownMenuPanel` with `anchorRef={buttonRef}`, `ariaLabel={menuLabel ?? label}`, items
  `{ label, onClick: () => onSelect(value), checked: value === current }`, `position`, and keyboard
  wiring from `useDropdownKeyboardNavigation` exactly as `ViewSelector` does today.
- Choosing the current option closes the menu without calling `onSelect`.

## 5. `SortChip`

One chip for the list order, matching `HomeSortChip`. The face is the current sort; while the
range-bearing sort (Top) is selected, the face is the range. Choosing Top swaps the open menu to
the range options, and the list is reordered only once a range is chosen.

```ts
export type SortChipOption<T extends string> = { value: T; label: string };
export type SortChipRangeOption<T extends string> = {
  value: T;
  label: string;
  /** Face text when shorter than the menu row. Defaults to `label`. */
  shortLabel?: string;
};
export type SortChipRange<TSort extends string, TRange extends string> = {
  /** The sort option that takes a range, e.g. 'top'. */
  sort: TSort;
  /** Accessible name of the range menu, e.g. "Range". */
  heading: string;
  options: readonly SortChipRangeOption<TRange>[];
  /** Current range; `null` while another sort is selected. */
  value: TRange | null;
};
export type SortChipProps<TSort extends string, TRange extends string> = {
  /** e.g. "Sort". Accessible name is `${heading}: ${faceLabel}`; also the sort menu's name. */
  heading: string;
  options: readonly SortChipOption<TSort>[];
  value: TSort;
  /** `range` is non-null exactly when `sort === range.sort`. */
  onChange: (sort: TSort, range: TRange | null) => void;
  range?: SortChipRange<TSort, TRange>;
  /** Which chip edge the menu lines up with. Default 'left'. */
  position?: 'left' | 'right';
  testId?: string;
};
```

Behavior:

| Situation | Result |
| --- | --- |
| Face, value is not the range sort | The option label for `value`; when `value` is not in `options`, the first option's label |
| Face, value is the range sort and `range.value !== null` | That range option's `shortLabel ?? label` |
| Chip chrome | `variant="filter"`, `selected` (accent outline, as mobile `MenuSelectChip`), `menuExpanded={open}`, caret |
| Menu | `DropdownMenuPanel` with `anchorRef={buttonRef}` and `position`, inside a `styles.menuWrapper` div, as `MenuChip` |
| Open, step `sort` | Panel `ariaLabel={heading}`; one item per option, `checked: option.value === value`; the range sort's item has `dismissOnSelect: false` |
| Choose a non-range sort equal to `value` | Close; no `onChange` |
| Choose a different non-range sort | `onChange(sort, null)`; close |
| Choose the range sort | Stay open; step becomes `range`; focus moves to the checked range item, else the first |
| Step `range` | Panel `ariaLabel={range.heading}`; one item per range option, `checked: value === range.sort && option.value === range.value` |
| Choose a range | When `value !== range.sort` or the range differs, `onChange(range.sort, chosen)`; close either way |
| Escape, Tab, or a click outside, either step | Close with no `onChange`; the next open starts at step `sort` |
| The chip is scrolled fully out of sight while open | Close with no `onChange` (§ 1c); the next open starts at step `sort` |
| `options` is exactly `[range.sort]` | Range-only (mobile `BrowseSortChip`): every open starts at step `range` |

Implementation notes:

- Hold `step: 'sort' | 'range'` in state; reset it to the initial step whenever `open` turns false.
- Call `useDropdownKeyboardNavigation` with `closeOnItemSelect: false` and `itemCount` of the
  current step's list. In `onItemSelect(index)` run the same handler the click runs, then close
  with `setOpen(false)` unless the step moved to `range`.
- The step swap changes `menuItems`, so the anchored menu re-measures and stays lined up with the
  chip at its new width.
- Callers mount a `SortChip` only when the current list can sort and there are at least two
  choices (two sorts, or a range sort with ranges). Do not add a disabled state.

## 6. Exports and docs

- `packages/ui/src/components/navigation/Chip/index.ts` exports the four components and their
  types.
- `packages/ui/src/index.ts`: add the value and type exports directly below the `ButtonTabs`
  export pair (around line 272), from `./components/navigation/Chip/index`, in the file's style.
  The new hook stays internal; do not export it.
- `packages/ui/PACKAGES-UI.md`: add `## Navigation — Chips` after `## Navigation — NavBar` and its
  subsections. Cover:
  - `pill` versus `filter`.
  - `ChipRow` order (items, then trailing: Category, Sort, the gear), and that trailing controls
    mount only when the current item can use them.
  - The row is one line at every width. It scrolls sideways when it does not fit, with no
    visible scrollbar, and the trailing controls scroll with the chips. The selected chip is
    scrolled into view on mount and on every selection change. The row has no outer margin.
  - `MenuChip` and `SortChip` menus render in a portal on `document.body`, anchored to the chip
    (`DropdownMenuPanel` `anchorRef`). They follow the chip on scroll and resize, and close once
    the chip is scrolled fully out of sight. `position` picks which chip edge the menu lines up
    with. Playwright and Testing Library find these menus from the page or `screen`, not inside
    the row.
  - `SortChip`'s range step; menus show the current option as a checked radio item; all strings
    come from the app.
  - Under the existing dropdown guidance, or in the same section if there is none: other
    `DropdownMenuPanel` callers omit `anchorRef` and keep the in-place menu.

## Accessibility

- Item chips: `aria-pressed` reflects the selection inside a `role="group"`, which matches the
  existing `ButtonTabs` contract and every spec that asserts `aria-pressed`.
- Menu chips: `aria-haspopup="menu"` and `aria-expanded`; the open menu has a name; options are
  `menuitemradio` with `aria-checked`, so a screen reader hears which sort and which range are
  current.
- The portaled menu is at the end of `body`, but focus moves into it on open (the keyboard hook
  focuses the first or checked row) and Escape returns focus to the chip, so the reading order
  follows the interaction.
- Every chip stays reachable by Tab even when it is scrolled out of the row's visible part; focus
  scrolls it into view.
- Icon-only chips must have `aria-label`; glyphs are `aria-hidden`.
- Every chip is a real `<button>` with a visible focus ring, not clipped by the scroller.

## Tests

Vitest and Testing Library, beside the components, following `Dropdown.test.tsx`:

- `DropdownMenuPanel.test.tsx` (add cases):
  - With `checked` items, rows are `menuitemradio` and only the checked one has
    `aria-checked="true"`; `ariaLabel` names the menu; without `checked`, rows stay `menuitem`.
  - Without `anchorRef`, the open `<ul role="menu">` is inside the render container (unchanged
    markup).
  - With `anchorRef`, the open menu is a direct child of `document.body`, not inside the render
    container, and its inline `position` is `fixed`.
  - With `anchorRef`, a stubbed anchor rect (`{ left: 100, right: 180, top: 40, bottom: 76 }`) and
    a stubbed menu `offsetWidth` of 160 / `offsetHeight` of 120 (stub on the element or
    `HTMLElement.prototype`, restore after): `position="left"` puts the menu at `left: 100px`,
    `top: 80px`; `position="right"` at `left: 20px`.
  - With `anchorRef`, after the stubbed anchor rect moves and a `scroll` event fires on a nested
    element, the menu's `top` and `left` follow (`await waitFor`).
  - With `anchorRef` and a stubbed `window.IntersectionObserver` that records its callback,
    reporting `isIntersecting: false` calls `setOpen(false)`.
- `Chip.test.tsx`: `pressed` sets `aria-pressed`; `menuExpanded` sets `aria-haspopup` and
  `aria-expanded`; an icon-only chip without `aria-label` throws.
- `ChipRow.test.tsx`:
  - Items render in order with `aria-pressed` on the selected one only; `selectedKey={null}`
    presses none; clicking calls `onSelect` with the key.
  - `trailing` renders after the items inside `${testId}-trailing`, and the trailing wrapper and
    `${testId}-items` share one parent (the scroller); no trailing wrapper when `trailing` is
    undefined.
  - Reveal: stub `getBoundingClientRect` / `getClientRects` for the scroller (`left: 0`,
    `width: 300`) and the selected chip (`left: 400`, `width: 80`), `clientWidth` 300,
    `scrollWidth` 900, and a `scrollTo` spy on the scroller. On mount with that chip selected,
    `scrollTo` is called once with `behavior: 'auto'` and the offset from `getChipRevealOffset`.
    Rerender with another key whose chip is already visible: no further call.
  - A selected chip whose `getClientRects()` is empty (hidden) does not call `scrollTo`.
- `MenuChip.test.tsx`: icon-only accessible name is `label`; with `faceLabel` it is
  `${label}: ${faceLabel}`; opening shows a menu named `menuLabel`, rendered outside the chip's
  wrapper (the menu is not a descendant of the trigger's parent); choosing another option calls
  `onSelect` and closes; choosing the current option does not call `onSelect`.
- `SortChip.test.tsx`: face and accessible name (`Sort: Recent`); a non-range choice calls
  `onChange('a_z', null)`; choosing Top keeps the menu open with a menu named `Range`, and choosing
  Month calls `onChange('top', 'month')`; with `value='top'` and range `week` the face is `Week`
  and `Week` is checked; Escape at the range step calls nothing and the next open shows the sort
  list; range-only opens straight to the range list; keyboard Enter on the face, ArrowDown to Top,
  Enter shows the range list. Query menus through `screen`, since they render on `body`.
- `packages/helpers/src/lib/chipRowReveal.test.ts`: the moved mobile cases, unchanged.

No Playwright spec here: nothing on screen uses these until plan 21, which adds the narrow-screen
row check, and plan 30, which checks that the sort menu is not inside the row.

## Release scratchpad

none
