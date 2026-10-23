'use client';

import classNames from 'classnames';
import type { CSSProperties, HTMLAttributes, PointerEventHandler } from 'react';
import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react';

import type { MarqueeLayout } from '@podverse/helpers/marquee';
import {
  MARQUEE_EDGE_HOLD_MS,
  marqueeScrollDurationMs,
  resolveMarqueeLayout,
  stabilizeMeasuredWidth,
} from '@podverse/helpers/marquee';

import { useMarqueeTurn } from '../../../hooks/useMarqueeTurn';
import { usePrefersReducedMotion } from '../../../hooks/usePrefersReducedMotion';

import styles from './MarqueeText.module.scss';

export type MarqueeTextProps = Omit<HTMLAttributes<HTMLSpanElement>, 'children'> & {
  /**
   * Where the label sits when it fits. A scrolling label always rests on its first word at the
   * left edge, after any `restInset`.
   */
  align?: 'center' | 'left';
  children: string;
  /**
   * Space before the first word while the label rests, as a CSS length (a spacing token, such as
   * `var(--spacing-lg)`). The space travels with the scrolling copy, so the glyphs still leave at
   * the clip edge. The overflow check counts it. A centered label that fits ignores it.
   */
  restInset?: string;
  /**
   * Labels in the same group scroll one at a time and hand off after each pass. Ungrouped labels
   * loop on their own.
   */
  turnGroup?: string;
  /** Position in the group's rotation. Lower goes first. Default 0. */
  turnOrder?: number;
};

type MarqueeLabelProps = {
  align: 'center' | 'left';
  children: string;
  contentWidth: number;
  hovered: boolean;
  layout: MarqueeLayout;
  onContentWidth: (text: string, width: number) => void;
  restInset: string | undefined;
  turnGroup: string | undefined;
  turnOrder: number;
};

type MeasuredContent = {
  text: string;
  width: number;
};

const subscribeToNothing = (): (() => void) => () => {};

/** Scrolling needs both a resize signal and the Web Animations API; without them a label fits. */
const supportsMeasuredMotion = (): boolean =>
  typeof ResizeObserver === 'function' && typeof HTMLElement.prototype.animate === 'function';

/** The server render is `measuring`, which looks the same as `fit`, so assume support there. */
const assumeMeasuredMotion = (): boolean => true;

/**
 * One string's marquee. The parent keys this on the string, so a new title mounts a new
 * measurer, a new group member, and a track at offset 0, and any running pass is cancelled.
 */
function MarqueeLabel({
  align,
  children,
  contentWidth,
  hovered,
  layout,
  onContentWidth,
  restInset,
  turnGroup,
  turnOrder,
}: MarqueeLabelProps) {
  const trackRef = useRef<HTMLSpanElement>(null);
  const firstCopyRef = useRef<HTMLSpanElement>(null);
  const secondCopyRef = useRef<HTMLSpanElement>(null);
  const measureRef = useRef<HTMLSpanElement>(null);
  const animationRef = useRef<Animation | null>(null);
  const hoveredRef = useRef(hovered);
  const scrolls = layout === 'scroll';
  const { finish, turn } = useMarqueeTurn({ group: turnGroup, order: turnOrder, scrolls });

  useEffect(() => {
    const measure = measureRef.current;
    if (measure === null || typeof ResizeObserver !== 'function') {
      return;
    }
    // The measurer's box follows web-font loads and root font-size changes.
    const observer = new ResizeObserver(() => {
      onContentWidth(children, measure.getBoundingClientRect().width);
    });
    observer.observe(measure);
    return () => {
      observer.disconnect();
    };
  }, [children, onContentWidth]);

  useEffect(() => {
    hoveredRef.current = hovered;
    const animation = animationRef.current;
    if (animation === null) {
      return;
    }
    if (hovered) {
      animation.pause();
    } else {
      animation.play();
    }
  }, [hovered]);

  useEffect(() => {
    const track = trackRef.current;
    const firstCopy = firstCopyRef.current;
    const secondCopy = secondCopyRef.current;
    if (!scrolls || turn === null || track === null || firstCopy === null || secondCopy === null) {
      return;
    }
    // The seam width comes from CSS, and a rest inset before the first copy is not travelled.
    const distance = secondCopy.offsetLeft - firstCopy.offsetLeft;
    if (distance <= 0) {
      return;
    }
    let cancelled = false;
    let animation: Animation | null = null;

    // Without `fill`, the track returns to offset 0 when a pass ends.
    const startPass = (onFinished: () => void) => {
      const pass = track.animate(
        [{ transform: 'translateX(0)' }, { transform: `translateX(-${distance}px)` }],
        {
          delay: MARQUEE_EDGE_HOLD_MS,
          duration: marqueeScrollDurationMs(distance),
          easing: 'linear',
        }
      );
      animation = pass;
      animationRef.current = pass;
      if (hoveredRef.current) {
        pass.pause();
      }
      pass.finished.then(
        () => {
          if (!cancelled) {
            onFinished();
          }
        },
        () => {
          // `cancel()` rejects `finished`; a cancelled pass is not an error.
        }
      );
    };

    if (turnGroup === undefined) {
      const runPass = () => {
        if (cancelled) {
          return;
        }
        startPass(runPass);
      };
      runPass();
    } else {
      startPass(() => {
        animationRef.current = null;
        finish();
      });
    }

    return () => {
      cancelled = true;
      animationRef.current = null;
      animation?.cancel();
    };
  }, [contentWidth, finish, scrolls, turn, turnGroup]);

  const hasRestInset = restInset !== undefined && restInset !== '';
  const insetStyle: CSSProperties | undefined = hasRestInset
    ? { paddingInlineStart: restInset }
    : undefined;

  return (
    <>
      <span ref={trackRef} className={classNames(styles.track, scrolls && styles.trackScroll)}>
        {scrolls && hasRestInset ? (
          <span aria-hidden="true" className={styles.restInset} style={{ width: restInset }} />
        ) : null}
        <span
          ref={firstCopyRef}
          className={classNames(
            scrolls ? styles.copyScroll : styles.copyFit,
            !scrolls && align === 'center' && styles.copyCentered
          )}
          style={!scrolls && align === 'left' ? insetStyle : undefined}
        >
          {children}
        </span>
        {scrolls ? (
          <>
            <span aria-hidden="true" className={styles.seam} />
            <span aria-hidden="true" ref={secondCopyRef} className={styles.copyScroll}>
              {children}
            </span>
          </>
        ) : null}
      </span>
      <span aria-hidden="true" ref={measureRef} className={styles.measure} style={insetStyle}>
        {children}
      </span>
    </>
  );
}

/**
 * Single-line label that scrolls itself when it is too long for its box, and truncates with an
 * ellipsis under `prefers-reduced-motion`.
 *
 * Built for player chrome, where each line is one line tall and the full title is what the
 * listener is looking for. An overflowing label rests on its first word before every pass, then
 * travels at a constant speed with a second copy after a seam, so the wrap reads as a
 * continuation. Labels that share a group move one at a time and hand off after each pass; a
 * label with no group repeats on its own. Hovering pauses a running pass.
 *
 * The server render and the first client render show one ellipsized copy, so the title is never
 * blank while it is measured. Callers put typography on the root through `className` and leave
 * truncation, overflow, and wrapping to this component. A flex parent needs `min-width: 0` so the
 * root can shrink.
 */
export function MarqueeText({
  align = 'left',
  children,
  className,
  onPointerEnter,
  onPointerLeave,
  restInset,
  turnGroup,
  turnOrder = 0,
  ...rest
}: MarqueeTextProps) {
  const rootRef = useRef<HTMLSpanElement>(null);
  const [viewportWidth, setViewportWidth] = useState(0);
  const [measured, setMeasured] = useState<MeasuredContent>({ text: children, width: 0 });
  const [hovered, setHovered] = useState(false);
  const reduceMotion = usePrefersReducedMotion();
  const canScroll = useSyncExternalStore(
    subscribeToNothing,
    supportsMeasuredMotion,
    assumeMeasuredMotion
  );

  useEffect(() => {
    const root = rootRef.current;
    if (root === null || typeof ResizeObserver !== 'function') {
      return;
    }
    const observer = new ResizeObserver(() => {
      setViewportWidth((previous) => stabilizeMeasuredWidth(previous, root.clientWidth));
    });
    observer.observe(root);
    return () => {
      observer.disconnect();
    };
  }, []);

  const handleContentWidth = useCallback((text: string, width: number) => {
    setMeasured((previous) => {
      const base = previous.text === text ? previous.width : 0;
      const next = stabilizeMeasuredWidth(base, width);
      return previous.text === text && previous.width === next ? previous : { text, width: next };
    });
  }, []);

  // A width measured for another string is not this string's width.
  const contentWidth = measured.text === children ? measured.width : 0;
  // The measurer carries `restInset` as padding, so its width already counts the inset.
  const layout: MarqueeLayout = canScroll
    ? resolveMarqueeLayout({ contentWidth, reduceMotion, restInset: 0, viewportWidth })
    : 'fit';

  const handlePointerEnter: PointerEventHandler<HTMLSpanElement> = (event) => {
    setHovered(true);
    onPointerEnter?.(event);
  };

  const handlePointerLeave: PointerEventHandler<HTMLSpanElement> = (event) => {
    setHovered(false);
    onPointerLeave?.(event);
  };

  return (
    <span
      {...rest}
      ref={rootRef}
      className={classNames(styles.root, className)}
      data-marquee-layout={layout}
      onPointerEnter={handlePointerEnter}
      onPointerLeave={handlePointerLeave}
    >
      <MarqueeLabel
        key={children}
        align={align}
        contentWidth={contentWidth}
        hovered={hovered}
        layout={layout}
        onContentWidth={handleContentWidth}
        restInset={restInset}
        turnGroup={turnGroup}
        turnOrder={turnOrder}
      >
        {children}
      </MarqueeLabel>
    </span>
  );
}
