import { spacing } from '../../theme/spacing';

/**
 * Air between the last glyph and the repeated first word. Wider than `spacing.base` so the seam
 * reads as a break rather than the next word of the same title.
 */
export const MARQUEE_LOOP_GAP = spacing['2xl'];

/** Scroll speed. Slow enough to read a long episode title while it passes. */
export const MARQUEE_SPEED_DP_PER_SECOND = 28;

/** Rest with the first word visible before every pass, so the label is readable between passes. */
export const MARQUEE_EDGE_HOLD_MS = 2500;

/** Sub-pixel differences are measurement noise, not overflow worth animating. */
const OVERFLOW_EPSILON = 1;

/**
 * Ignore layout jitter so a 0.4dp onLayout wobble cannot restart the pass or flip
 * overflow on and off.
 */
export const stabilizeMeasuredWidth = (previous: number, next: number): number => {
  if (!Number.isFinite(next) || next < 0) {
    return previous;
  }
  if (Math.abs(previous - next) <= OVERFLOW_EPSILON) {
    return previous;
  }
  return next;
};

/**
 * Whether a label overflows its viewport by enough to be worth scrolling.
 *
 * Reduce Motion turns scrolling off entirely: the label then truncates, which is the same
 * information at rest.
 */
export const shouldMarqueeScroll = ({
  contentWidth,
  reduceMotion,
  viewportWidth,
}: {
  contentWidth: number;
  reduceMotion: boolean;
  viewportWidth: number;
}): boolean => {
  if (reduceMotion || viewportWidth <= 0 || contentWidth <= 0) {
    return false;
  }
  return contentWidth - viewportWidth > OVERFLOW_EPSILON;
};

/** Measuring until both widths exist, then either a resting fit or a scroll. */
export type MarqueeLayout = 'fit' | 'measuring' | 'scroll';

/**
 * Layout for one label. A width of 0 is still measuring, so a new string cannot reuse the
 * previous string's width. Reduce Motion never scrolls: an overflowing label truncates in the
 * fit layout. `restInset` is space reserved before the first word, so the overflow check uses
 * the width that remains.
 */
export const resolveMarqueeLayout = ({
  contentWidth,
  reduceMotion,
  restInset,
  viewportWidth,
}: {
  contentWidth: number;
  reduceMotion: boolean;
  restInset: number;
  viewportWidth: number;
}): MarqueeLayout => {
  if (viewportWidth <= 0 || contentWidth <= 0) {
    return 'measuring';
  }
  const scrolls = shouldMarqueeScroll({
    contentWidth,
    reduceMotion,
    viewportWidth: Math.max(0, viewportWidth - restInset),
  });
  return scrolls ? 'scroll' : 'fit';
};

/** How far one revolution travels: one full copy plus the seam before the title repeats. */
export const marqueeLoopDistance = (contentWidth: number): number => {
  return Math.max(0, contentWidth) + MARQUEE_LOOP_GAP;
};

/** Travel time at a constant speed, so short and long titles scroll at the same rate. */
export const marqueeScrollDurationMs = (distance: number): number => {
  return Math.round((Math.max(0, distance) / MARQUEE_SPEED_DP_PER_SECOND) * 1000);
};
