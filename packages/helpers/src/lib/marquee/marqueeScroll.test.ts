import { describe, expect, it } from 'vitest';

import {
  marqueeLoopDistance,
  marqueeScrollDurationMs,
  resolveMarqueeLayout,
  shouldMarqueeScroll,
  stabilizeMeasuredWidth,
} from './marqueeScroll.js';

describe('shouldMarqueeScroll', () => {
  it('scrolls when the label is wider than the space it has', () => {
    expect(
      shouldMarqueeScroll({ contentWidth: 320, reduceMotion: false, viewportWidth: 180 })
    ).toBe(true);
  });

  it('stays still when the label fits', () => {
    expect(
      shouldMarqueeScroll({ contentWidth: 140, reduceMotion: false, viewportWidth: 180 })
    ).toBe(false);
  });

  it('ignores sub-pixel overflow from measurement rounding', () => {
    expect(
      shouldMarqueeScroll({ contentWidth: 180.4, reduceMotion: false, viewportWidth: 180 })
    ).toBe(false);
  });

  it('stays still under Reduce Motion even when it overflows', () => {
    expect(shouldMarqueeScroll({ contentWidth: 320, reduceMotion: true, viewportWidth: 180 })).toBe(
      false
    );
  });

  it('stays still before either width is measured', () => {
    expect(shouldMarqueeScroll({ contentWidth: 320, reduceMotion: false, viewportWidth: 0 })).toBe(
      false
    );
    expect(shouldMarqueeScroll({ contentWidth: 0, reduceMotion: false, viewportWidth: 180 })).toBe(
      false
    );
  });
});

describe('resolveMarqueeLayout', () => {
  it('waits while either width is still zero', () => {
    expect(
      resolveMarqueeLayout({
        contentWidth: 0,
        reduceMotion: false,
        restInset: 0,
        viewportWidth: 180,
      })
    ).toBe('measuring');
    expect(
      resolveMarqueeLayout({
        contentWidth: 320,
        reduceMotion: false,
        restInset: 0,
        viewportWidth: 0,
      })
    ).toBe('measuring');
  });

  it('fits when the label is within the space it has', () => {
    expect(
      resolveMarqueeLayout({
        contentWidth: 140,
        reduceMotion: false,
        restInset: 0,
        viewportWidth: 180,
      })
    ).toBe('fit');
  });

  it('scrolls when the label is wider than the space it has', () => {
    expect(
      resolveMarqueeLayout({
        contentWidth: 320,
        reduceMotion: false,
        restInset: 0,
        viewportWidth: 180,
      })
    ).toBe('scroll');
  });

  it('fits under Reduce Motion even when the label overflows', () => {
    expect(
      resolveMarqueeLayout({
        contentWidth: 320,
        reduceMotion: true,
        restInset: 0,
        viewportWidth: 180,
      })
    ).toBe('fit');
  });
});

describe('marqueeLoopDistance', () => {
  it('travels one copy plus the seam', () => {
    expect(marqueeLoopDistance(320, 24)).toBe(344);
  });
});

describe('stabilizeMeasuredWidth', () => {
  it('keeps the first real width', () => {
    expect(stabilizeMeasuredWidth(0, 348)).toBe(348);
  });

  it('ignores sub-pixel jitter that would restart a pass', () => {
    expect(stabilizeMeasuredWidth(348, 348.4)).toBe(348);
  });

  it('accepts a real resize of the bar', () => {
    expect(stabilizeMeasuredWidth(348, 280)).toBe(280);
  });
});

describe('marqueeScrollDurationMs', () => {
  it('holds one speed, so a longer title takes longer', () => {
    const shortPass = marqueeScrollDurationMs(50);
    const longPass = marqueeScrollDurationMs(200);
    expect(longPass).toBeGreaterThan(shortPass);
    expect(longPass / shortPass).toBeCloseTo(4, 1);
  });

  it('is zero when there is nothing to travel', () => {
    expect(marqueeScrollDurationMs(0)).toBe(0);
  });
});
