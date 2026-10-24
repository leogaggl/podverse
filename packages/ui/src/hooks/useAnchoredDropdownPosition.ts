'use client';

import type { CSSProperties, RefObject } from 'react';
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';

import { clampRectToViewportEdges } from '../lib/viewport/clampRectToViewportEdges';
import { DROPDOWN_VIEWPORT_CLAMP_MARGIN_PX } from './useDropdownViewportClamp';

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

type AnchoredPlacement = {
  top: number;
  left: number;
  width: number | null;
};

/**
 * Viewport placement for a `position: fixed` menu rendered in a portal and anchored to an
 * element. Follows the anchor on any scroll (page or a scrolling ancestor) and on resize, and
 * reports when the anchor has scrolled fully out of sight so the menu can close.
 */
export function useAnchoredDropdownPosition({
  open,
  anchorRef,
  menuRef,
  menuItems,
  position,
  fullWidth,
  verticalPosition = 'below',
  onAnchorHidden,
}: UseAnchoredDropdownPositionArgs): { anchoredStyle: CSSProperties } {
  const [placement, setPlacement] = useState<AnchoredPlacement | null>(null);

  const latestRef = useRef({
    anchorRef,
    menuRef,
    position,
    fullWidth,
    verticalPosition,
    onAnchorHidden,
  });
  useLayoutEffect(() => {
    latestRef.current = {
      anchorRef,
      menuRef,
      position,
      fullWidth,
      verticalPosition,
      onAnchorHidden,
    };
  });

  const measure = useCallback(() => {
    const latest = latestRef.current;
    const anchor = latest.anchorRef?.current ?? null;
    const menu = latest.menuRef.current;
    if (anchor === null || menu === null) {
      return;
    }

    const anchorRect = anchor.getBoundingClientRect();
    const width = latest.fullWidth ? anchorRect.width : menu.offsetWidth;
    const height = menu.offsetHeight;
    const left =
      latest.fullWidth || latest.position === 'left' ? anchorRect.left : anchorRect.right - width;
    const top =
      latest.verticalPosition === 'above'
        ? anchorRect.top - DROPDOWN_ANCHOR_GAP_PX - height
        : anchorRect.bottom + DROPDOWN_ANCHOR_GAP_PX;
    const { dx, dy } = clampRectToViewportEdges(
      { left, top, width, height },
      window.innerWidth,
      window.innerHeight,
      DROPDOWN_VIEWPORT_CLAMP_MARGIN_PX
    );

    const next: AnchoredPlacement = {
      top: top + dy,
      left: left + dx,
      width: latest.fullWidth ? anchorRect.width : null,
    };
    setPlacement((prev) =>
      prev !== null && prev.top === next.top && prev.left === next.left && prev.width === next.width
        ? prev
        : next
    );
  }, []);

  useLayoutEffect(() => {
    if (!open) {
      setPlacement(null);
      return;
    }
    measure();
  }, [open, menuItems, position, fullWidth, verticalPosition, measure]);

  useEffect(() => {
    if (!open) {
      return;
    }

    let frame: number | null = null;
    const scheduleMeasure = () => {
      if (frame !== null) {
        return;
      }
      frame = window.requestAnimationFrame(() => {
        frame = null;
        measure();
      });
    };

    window.addEventListener('scroll', scheduleMeasure, { capture: true });
    window.addEventListener('resize', scheduleMeasure);

    let observer: IntersectionObserver | null = null;
    const anchor = latestRef.current.anchorRef?.current ?? null;
    if (anchor !== null && typeof IntersectionObserver !== 'undefined') {
      observer = new IntersectionObserver(
        (entries) => {
          const entry = entries[entries.length - 1];
          if (entry !== undefined && !entry.isIntersecting) {
            latestRef.current.onAnchorHidden();
          }
        },
        { threshold: 0 }
      );
      observer.observe(anchor);
    }

    return () => {
      if (frame !== null) {
        window.cancelAnimationFrame(frame);
      }
      window.removeEventListener('scroll', scheduleMeasure, { capture: true });
      window.removeEventListener('resize', scheduleMeasure);
      observer?.disconnect();
    };
  }, [open, measure]);

  if (!open) {
    return { anchoredStyle: {} };
  }

  if (placement === null) {
    return {
      anchoredStyle: { position: 'fixed', top: 0, left: 0, visibility: 'hidden' },
    };
  }

  return {
    anchoredStyle: {
      position: 'fixed',
      top: placement.top,
      left: placement.left,
      right: 'auto',
      bottom: 'auto',
      margin: 0,
      ...(placement.width !== null ? { width: placement.width } : {}),
    },
  };
}
