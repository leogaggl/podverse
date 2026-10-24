'use client';

import classNames from 'classnames';
import type { ReactNode } from 'react';
import { useLayoutEffect, useRef } from 'react';

import { getChipRevealOffset } from '@podverse/helpers/chipRowReveal';

import { Chip } from './Chip';

import styles from './ChipRow.module.scss';

export type ChipRowItem<T extends string> = {
  key: T;
  label: string;
  /** Hidden from 1200px up. The side column shows this section there. */
  hideDesktop?: boolean;
};

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

function prefersReducedMotion(): boolean {
  return (
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  );
}

/**
 * One line of pill chips that scrolls sideways when it does not fit, with the trailing controls
 * after the chips inside the same scroller. The selected chip is scrolled fully into view on mount
 * (a jump) and on every selection change (animated unless reduced motion is requested). A swipe
 * afterwards is left alone.
 */
export function ChipRow<T extends string>({
  items,
  selectedKey,
  onSelect,
  trailing,
  ariaLabel,
  className,
  testId,
}: ChipRowProps<T>) {
  const scrollerRef = useRef<HTMLDivElement>(null);
  const chipRefs = useRef(new Map<T, HTMLButtonElement>());
  const hasRevealedRef = useRef(false);

  useLayoutEffect(() => {
    const animated = hasRevealedRef.current;
    hasRevealedRef.current = true;

    if (selectedKey === null) {
      return;
    }
    const scroller = scrollerRef.current;
    const chip = chipRefs.current.get(selectedKey);
    if (scroller === null || chip === undefined || chip.getClientRects().length === 0) {
      return;
    }

    const scrollerRect = scroller.getBoundingClientRect();
    const chipRect = chip.getBoundingClientRect();
    const gap = Number.parseFloat(getComputedStyle(scroller).columnGap);
    const edgeInset = Number.isNaN(gap) ? 0 : gap;

    const offset = getChipRevealOffset({
      chipX: chipRect.left - scrollerRect.left + scroller.scrollLeft,
      chipWidth: chipRect.width,
      scrollX: scroller.scrollLeft,
      viewportWidth: scroller.clientWidth,
      contentWidth: scroller.scrollWidth,
      edgeInset,
    });
    if (offset === null) {
      return;
    }

    scroller.scrollTo({
      left: offset,
      behavior: animated && !prefersReducedMotion() ? 'smooth' : 'auto',
    });
  }, [selectedKey]);

  return (
    <div className={classNames(styles.chipRow, className)} data-testid={testId}>
      <div className={styles.scroller} ref={scrollerRef}>
        <div
          role="group"
          aria-label={ariaLabel}
          className={styles.items}
          data-testid={testId !== undefined ? `${testId}-items` : undefined}
        >
          {items.map((item) => {
            const isSelected = item.key === selectedKey;
            return (
              <Chip
                key={item.key}
                ref={(node) => {
                  if (node === null) {
                    chipRefs.current.delete(item.key);
                  } else {
                    chipRefs.current.set(item.key, node);
                  }
                }}
                variant="pill"
                selected={isSelected}
                pressed={isSelected}
                onClick={() => onSelect(item.key)}
                data-testid={testId !== undefined ? `${testId}-${item.key}` : undefined}
                {...(item.hideDesktop === true ? { 'data-hide-desktop': 'true' } : {})}
              >
                {item.label}
              </Chip>
            );
          })}
        </div>
        {trailing ? (
          <div
            className={styles.trailing}
            data-testid={testId !== undefined ? `${testId}-trailing` : undefined}
          >
            {trailing}
          </div>
        ) : null}
      </div>
    </div>
  );
}
