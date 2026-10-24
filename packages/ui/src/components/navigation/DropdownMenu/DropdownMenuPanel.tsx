'use client';

import classNames from 'classnames';
import type { CSSProperties, KeyboardEvent, RefObject } from 'react';
import { createPortal } from 'react-dom';
import { FaCheck } from 'react-icons/fa';

import { useAnchoredDropdownPosition } from '../../../hooks/useAnchoredDropdownPosition';
import { useDropdownViewportClamp } from '../../../hooks/useDropdownViewportClamp';

import styles from './DropdownMenuPanel.module.scss';

export type DropdownMenuPanelItem = {
  label: string;
  onClick: () => void;
  variant?: 'primary' | 'warning' | 'danger';
  /** When false, selecting the item does not close the menu (default true). */
  dismissOnSelect?: boolean;
  /**
   * Marks the current option. When any item defines it, the menu is a radio menu: rows are
   * `menuitemradio` with `aria-checked`, and each row reserves a leading check slot.
   */
  checked?: boolean;
};

export type DropdownMenuPanelProps = {
  menuItems: DropdownMenuPanelItem[];
  open: boolean;
  menuRef: RefObject<HTMLUListElement | null>;
  focusedIndex: number;
  setFocusedIndex: (idx: number) => void;
  handleMenuKeyDown: (e: KeyboardEvent) => void;
  setOpen: (open: boolean) => void;
  position?: 'left' | 'right';
  fullWidth?: boolean;
  verticalPosition?: 'above' | 'below';
  /** Accessible name of the open menu. */
  ariaLabel?: string;
  /**
   * When set, the open menu renders in a portal on `document.body` with `position: fixed`,
   * anchored to this element, so an `overflow` ancestor (a scrolling chip row) cannot clip it.
   * Omit to keep the menu absolutely positioned inside its wrapper.
   */
  anchorRef?: RefObject<HTMLElement | null>;
};

export function DropdownMenuPanel({
  menuItems,
  open,
  menuRef,
  focusedIndex,
  setFocusedIndex,
  handleMenuKeyDown,
  setOpen,
  position,
  fullWidth,
  verticalPosition = 'below',
  ariaLabel,
  anchorRef,
}: DropdownMenuPanelProps) {
  const isAnchored = anchorRef !== undefined;

  const { viewportClampStyle } = useDropdownViewportClamp({
    open: open && !isAnchored,
    menuRef,
    menuItemCount: menuItems.length,
    position,
    fullWidth,
    verticalPosition,
  });

  const { anchoredStyle } = useAnchoredDropdownPosition({
    open: open && isAnchored,
    anchorRef,
    menuRef,
    menuItems,
    position,
    fullWidth,
    verticalPosition,
    onAnchorHidden: () => setOpen(false),
  });

  if (!open) {
    return null;
  }

  let style: CSSProperties;
  if (isAnchored) {
    style = anchoredStyle;
  } else {
    const positionStyle =
      position === 'left' ? { left: 0 } : position === 'right' ? { right: 0 } : { right: 0 };

    const fullWidthStyle = fullWidth ? { width: '100%' } : {};

    const verticalStyle =
      verticalPosition === 'above'
        ? {
            top: 'auto',
            bottom: '100%',
            marginTop: 0,
            marginBottom: '0.25rem',
          }
        : {
            top: '100%',
            bottom: 'auto',
            marginTop: '0.25rem',
            marginBottom: 0,
          };

    style = { ...positionStyle, ...verticalStyle, ...fullWidthStyle, ...viewportClampStyle };
  }

  const isRadioMenu = menuItems.some((item) => item.checked !== undefined);

  const menu = (
    <ul
      className={styles.dropdownMenu}
      role="menu"
      aria-label={ariaLabel}
      tabIndex={-1}
      ref={menuRef}
      onKeyDown={handleMenuKeyDown}
      style={style}
    >
      {menuItems.map((item, idx) => (
        <li
          key={item.label}
          role={isRadioMenu ? 'menuitemradio' : 'menuitem'}
          aria-checked={isRadioMenu ? item.checked === true : undefined}
          tabIndex={-1}
          className={classNames(
            styles.menuItem,
            item.variant === 'warning' ? styles.menuItemWarning : null,
            item.variant === 'danger' ? styles.menuItemDanger : null
          )}
          onClick={() => {
            item.onClick();
            if (item.dismissOnSelect !== false) {
              setOpen(false);
            }
          }}
          onMouseEnter={() => setFocusedIndex(idx)}
          aria-selected={focusedIndex === idx}
        >
          {isRadioMenu ? (
            <span className={styles.check} aria-hidden="true">
              {item.checked === true ? <FaCheck /> : null}
            </span>
          ) : null}
          {item.label}
        </li>
      ))}
    </ul>
  );

  return isAnchored ? createPortal(menu, document.body) : menu;
}
