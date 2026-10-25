'use client';

import classNames from 'classnames';
import type { MouseEvent, PointerEvent as ReactPointerEvent, ReactNode } from 'react';
import { useEffect, useLayoutEffect, useRef } from 'react';

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

/** Movement below this stays a click. Past it, the gesture scrolls and the click is swallowed. */
const DRAG_START_PX = 5;

function prefersReducedMotion(): boolean {
  return (
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  );
}

function scrollerOverflows(scroller: HTMLElement): boolean {
  return scroller.scrollWidth - scroller.clientWidth > 1;
}

type ChipRowDrag = {
  pointerId: number;
  startX: number;
  startScrollLeft: number;
  moved: boolean;
  removeWindowListeners: () => void;
};

/**
 * One line of pill chips that scrolls sideways when it does not fit, with the trailing controls
 * after the chips inside the same scroller. The selected chip is scrolled fully into view on mount
 * (a jump) and on every selection change (animated unless reduced motion is requested). A swipe
 * afterwards is left alone. The scrollbar is hidden, so a mouse or pen drag scrolls the row. The
 * chips keep the pointer cursor. A drag past a few pixels does not activate the chip or a trailing
 * control; a short press still does. Touch scrolling stays with the browser.
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
  const dragRef = useRef<ChipRowDrag | null>(null);
  const suppressClickRef = useRef(false);

  useEffect(() => {
    return () => {
      dragRef.current?.removeWindowListeners();
    };
  }, []);

  const onPointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.pointerType === 'touch' || event.button !== 0) {
      return;
    }
    const scroller = scrollerRef.current;
    if (scroller === null || !scrollerOverflows(scroller) || dragRef.current !== null) {
      return;
    }

    const pointerId = event.pointerId;
    const onMove = (moveEvent: PointerEvent) => {
      if (moveEvent.pointerId !== pointerId) {
        return;
      }
      const drag = dragRef.current;
      const node = scrollerRef.current;
      if (drag === null || node === null) {
        return;
      }
      const delta = moveEvent.clientX - drag.startX;
      if (!drag.moved) {
        if (Math.abs(delta) < DRAG_START_PX) {
          return;
        }
        drag.moved = true;
        suppressClickRef.current = true;
      }
      moveEvent.preventDefault();
      node.scrollLeft = drag.startScrollLeft - delta;
    };
    const onUp = (upEvent: PointerEvent) => {
      if (upEvent.pointerId !== pointerId) {
        return;
      }
      const drag = dragRef.current;
      drag?.removeWindowListeners();
      dragRef.current = null;
      if (drag === null || !drag.moved) {
        return;
      }
      suppressClickRef.current = true;
      window.setTimeout(() => {
        suppressClickRef.current = false;
      }, 0);
    };
    const listen = { capture: true } as const;
    const removeWindowListeners = () => {
      window.removeEventListener('pointermove', onMove, listen);
      window.removeEventListener('pointerup', onUp, listen);
      window.removeEventListener('pointercancel', onUp, listen);
    };
    dragRef.current = {
      pointerId,
      startX: event.clientX,
      startScrollLeft: scroller.scrollLeft,
      moved: false,
      removeWindowListeners,
    };
    window.addEventListener('pointermove', onMove, { capture: true, passive: false });
    window.addEventListener('pointerup', onUp, listen);
    window.addEventListener('pointercancel', onUp, listen);
  };

  const onClickCapture = (event: MouseEvent<HTMLDivElement>) => {
    if (!suppressClickRef.current) {
      return;
    }
    suppressClickRef.current = false;
    event.preventDefault();
    event.stopPropagation();
  };

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
      <div
        className={styles.scroller}
        ref={scrollerRef}
        onPointerDown={onPointerDown}
        onClickCapture={onClickCapture}
      >
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
