'use client';

import type { ReactNode } from 'react';
import { useRef } from 'react';

import { useDropdownKeyboardNavigation } from '../../../hooks/useDropdownKeyboardNavigation';
import type { DropdownMenuPanelItem } from '../DropdownMenu/DropdownMenuPanel';
import { DropdownMenuPanel } from '../DropdownMenu/DropdownMenuPanel';
import { Chip } from './Chip';

import styles from './Chip.module.scss';

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

/** A filter chip that opens a one-step radio menu anchored to it. */
export function MenuChip<T extends string>({
  label,
  faceLabel,
  icon,
  options,
  value,
  onSelect,
  menuLabel,
  selected = false,
  position = 'left',
  testId,
}: MenuChipProps<T>) {
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLUListElement>(null);

  const menuItems: DropdownMenuPanelItem[] = options.map((option) => ({
    label: option.label,
    checked: option.value === value,
    onClick: () => {
      if (option.value !== value) {
        onSelect(option.value);
      }
    },
  }));

  const { open, setOpen, focusedIndex, setFocusedIndex, handleButtonKeyDown, handleMenuKeyDown } =
    useDropdownKeyboardNavigation({
      itemCount: menuItems.length,
      onItemSelect: (idx) => menuItems[idx]?.onClick(),
      onClose: () => setOpen(false),
      buttonRef,
      menuRef,
    });

  const hasFace = faceLabel !== undefined && faceLabel !== '';

  return (
    <div className={styles.menuWrapper}>
      <Chip
        ref={buttonRef}
        variant="filter"
        selected={selected}
        menuExpanded={open}
        icon={icon}
        aria-label={hasFace ? `${label}: ${faceLabel}` : label}
        title={label}
        onClick={() => setOpen((v) => !v)}
        onKeyDown={handleButtonKeyDown}
        data-testid={testId !== undefined ? `${testId}-button` : undefined}
      >
        {hasFace ? faceLabel : undefined}
      </Chip>
      <DropdownMenuPanel
        menuItems={menuItems}
        open={open}
        menuRef={menuRef}
        focusedIndex={focusedIndex}
        setFocusedIndex={setFocusedIndex}
        handleMenuKeyDown={handleMenuKeyDown}
        setOpen={setOpen}
        position={position}
        ariaLabel={menuLabel ?? label}
        anchorRef={buttonRef}
      />
    </div>
  );
}
