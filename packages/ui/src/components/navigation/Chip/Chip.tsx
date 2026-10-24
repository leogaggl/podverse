import classNames from 'classnames';
import type { ButtonHTMLAttributes, ReactNode, Ref } from 'react';
import { forwardRef } from 'react';
import { FaChevronDown } from 'react-icons/fa';

import styles from './Chip.module.scss';

export type ChipVariant = 'pill' | 'filter';

export type ChipProps = Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'type'> & {
  /** `pill` picks which list shows. `filter` narrows it (category, sort, the gear). */
  variant?: ChipVariant;
  /** Selected face: pill fills with the primary button color; filter gets the accent outline. */
  selected?: boolean;
  /** Sets aria-pressed. Pass for chips that toggle or pick one of a set; omit on menu triggers. */
  pressed?: boolean;
  /**
   * Defined only on menu triggers: sets aria-haspopup="menu", aria-expanded, and the caret.
   * When omitted, a passed aria-expanded stays on the button.
   */
  menuExpanded?: boolean;
  /** Leading glyph, wrapped in an aria-hidden span. */
  icon?: ReactNode;
};

function hasChildren(children: ReactNode): boolean {
  return children !== undefined && children !== null && children !== false && children !== '';
}

export const Chip = forwardRef(function Chip(
  {
    variant = 'pill',
    selected = false,
    pressed,
    menuExpanded,
    icon,
    children,
    className,
    ...rest
  }: ChipProps,
  ref: Ref<HTMLButtonElement>
) {
  const withLabel = hasChildren(children);
  const ariaLabel = rest['aria-label'];
  if (!withLabel && (ariaLabel === undefined || ariaLabel === '')) {
    throw new Error('Chip: icon-only chips require aria-label');
  }

  const isMenuTrigger = menuExpanded !== undefined;

  return (
    <button
      {...rest}
      ref={ref}
      type="button"
      className={classNames(
        styles.chip,
        variant === 'filter' ? styles.filter : styles.pill,
        selected ? styles.selected : null,
        withLabel ? null : styles.iconOnly,
        className
      )}
      aria-pressed={pressed}
      aria-haspopup={isMenuTrigger ? 'menu' : undefined}
      {...(isMenuTrigger ? { 'aria-expanded': menuExpanded } : {})}
    >
      {icon !== undefined && icon !== null ? (
        <span className={styles.icon} aria-hidden="true">
          {icon}
        </span>
      ) : null}
      {withLabel ? children : null}
      {isMenuTrigger && withLabel ? <FaChevronDown className={styles.caret} aria-hidden /> : null}
    </button>
  );
});

Chip.displayName = 'Chip';
