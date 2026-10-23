import { describe, expect, it } from 'vitest';

import {
  bannerNotificationDragOffset,
  shouldDismissBannerNotificationSwipe,
} from './bannerNotificationSwipe';

describe('shouldDismissBannerNotificationSwipe', () => {
  it('dismisses at the distance boundary', () => {
    expect(shouldDismissBannerNotificationSwipe({ translationY: -48, velocityY: 0 })).toBe(true);
  });

  it('does not dismiss just short of both thresholds', () => {
    expect(shouldDismissBannerNotificationSwipe({ translationY: -47, velocityY: 0 })).toBe(false);
  });

  it('dismisses a short drag at the velocity boundary', () => {
    expect(shouldDismissBannerNotificationSwipe({ translationY: -47, velocityY: -800 })).toBe(true);
  });

  it('does not dismiss just under the velocity boundary', () => {
    expect(shouldDismissBannerNotificationSwipe({ translationY: -47, velocityY: -799 })).toBe(
      false
    );
  });

  it('does not dismiss a downward release even when the flick is fast upward', () => {
    expect(shouldDismissBannerNotificationSwipe({ translationY: 1, velocityY: -2000 })).toBe(false);
  });

  it('does not dismiss a resting finger', () => {
    expect(shouldDismissBannerNotificationSwipe({ translationY: 0, velocityY: 0 })).toBe(false);
  });

  it('dismisses a long upward drag', () => {
    expect(shouldDismissBannerNotificationSwipe({ translationY: -400, velocityY: 0 })).toBe(true);
  });

  it('does not dismiss a non-finite translation or velocity', () => {
    expect(
      shouldDismissBannerNotificationSwipe({ translationY: Number.NaN, velocityY: -800 })
    ).toBe(false);
    expect(
      shouldDismissBannerNotificationSwipe({ translationY: Number.POSITIVE_INFINITY, velocityY: 0 })
    ).toBe(false);
    expect(shouldDismissBannerNotificationSwipe({ translationY: -48, velocityY: Number.NaN })).toBe(
      false
    );
    expect(
      shouldDismissBannerNotificationSwipe({
        translationY: -48,
        velocityY: Number.NEGATIVE_INFINITY,
      })
    ).toBe(false);
  });
});

describe('bannerNotificationDragOffset', () => {
  it('clamps upward travel to -400', () => {
    expect(bannerNotificationDragOffset(-500)).toBe(-400);
  });

  it('clamps downward travel to 24', () => {
    expect(bannerNotificationDragOffset(80)).toBe(24);
  });

  it('returns an in-range offset unchanged', () => {
    expect(bannerNotificationDragOffset(-20)).toBe(-20);
  });

  it('returns 0 for a non-finite input', () => {
    expect(bannerNotificationDragOffset(Number.NaN)).toBe(0);
    expect(bannerNotificationDragOffset(Number.POSITIVE_INFINITY)).toBe(0);
  });
});
