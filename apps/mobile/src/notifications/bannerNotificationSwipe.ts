/** Upward travel, in points, that dismisses on release even when the flick is slow. */
export const BANNER_NOTIFICATION_SWIPE_DISMISS_DISTANCE = 48;

/** Upward speed, in points per second, that dismisses even when the drag is still short. */
export const BANNER_NOTIFICATION_SWIPE_DISMISS_VELOCITY = 800;

/** How far the card may follow a finger upward while it is down. */
export const BANNER_NOTIFICATION_SWIPE_DRAG_MIN_Y = -400;

/** How far the card may follow a finger downward while it is down. */
export const BANNER_NOTIFICATION_SWIPE_DRAG_MAX_Y = 24;

/**
 * Upward motion is negative, matching a pan's `translationY` and `velocityY`.
 * A release that ends below the rest position springs back, including a fast upward flick
 * that finished below the rest position.
 */
export function shouldDismissBannerNotificationSwipe(input: {
  translationY: number;
  velocityY: number;
}): boolean {
  if (!Number.isFinite(input.translationY) || !Number.isFinite(input.velocityY)) {
    return false;
  }
  if (input.translationY > 0) {
    return false;
  }
  return (
    input.translationY <= -BANNER_NOTIFICATION_SWIPE_DISMISS_DISTANCE ||
    input.velocityY <= -BANNER_NOTIFICATION_SWIPE_DISMISS_VELOCITY
  );
}

/** Finger offset the card copies while the finger is down. Non-finite input stays at rest. */
export function bannerNotificationDragOffset(translationY: number): number {
  if (!Number.isFinite(translationY)) {
    return 0;
  }
  return Math.min(
    BANNER_NOTIFICATION_SWIPE_DRAG_MAX_Y,
    Math.max(BANNER_NOTIFICATION_SWIPE_DRAG_MIN_Y, translationY)
  );
}
