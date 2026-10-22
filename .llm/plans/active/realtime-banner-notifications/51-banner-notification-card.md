**Cursor model:** Cursor Grok 4.7 · **Reasoning:** high

# 51 — Banner notification card

The card that slides down from the top, shows a short summary, and leaves on its own, by the
Dismiss control, or by a swipe up. It does not subscribe to the stream, read prefs, navigate,
or mark anything read. Plan 53 mounts it. A swipe is a dismiss: it never calls `onPress`.

## Rows

R8, R9, R12, R43

## Runs after

none

## Files

apps/mobile/src/notifications/bannerNotificationQueue.ts
apps/mobile/src/notifications/bannerNotificationQueue.test.ts
apps/mobile/src/notifications/bannerNotificationSwipe.ts
apps/mobile/src/notifications/bannerNotificationSwipe.test.ts
apps/mobile/src/components/feedback/BannerNotification.tsx

## What already exists (R12)

`OfflineModeBanner` is a persistent strip in the bottom chrome. `MembershipExpiredBanner` is a
persistent row under the top of the screen, with a renew action and a dismiss control. Neither
slides in, hides itself, nor queues. There is no toast component under `apps/mobile/src`. This
plan adds the card. It does not change those two banners.

## Queue (`bannerNotificationQueue.ts`)

Pure. No React, no React Native, no Expo. Plan 50's vitest glob
`src/notifications/bannerNotification*.test.ts` collects the test. Do not edit
`vitest.config.ts`.

```typescript
export const BANNER_NOTIFICATION_VISIBLE_MS = 5_000;
export const BANNER_NOTIFICATION_WAITING_LIMIT = 3;

export type BannerNotificationQueueItem = {
  id: number;
  title: string;
  body: string | null;
  notification: DTOAccountNotification;
};

export type BannerNotificationQueueState = {
  visible: BannerNotificationQueueItem | null;
  waiting: readonly BannerNotificationQueueItem[];
};

export const EMPTY_BANNER_NOTIFICATION_QUEUE: BannerNotificationQueueState = {
  visible: null,
  waiting: [],
};

export function enqueueBannerNotification(
  state: BannerNotificationQueueState,
  item: BannerNotificationQueueItem
): BannerNotificationQueueState;

export function dismissVisibleBannerNotification(
  state: BannerNotificationQueueState
): BannerNotificationQueueState;

export function removeBannerNotification(
  state: BannerNotificationQueueState,
  id: number
): BannerNotificationQueueState;

export function clearBannerNotificationQueue(): BannerNotificationQueueState;
```

Import `DTOAccountNotification` with `import type` from `@podverse/helpers`.

One card is visible. Up to three more wait. A further arrival discards the oldest waiting item
and keeps the newest. The visible item is never replaced by an arrival.

- `enqueue`: if `item.id` is the visible id or already waiting, return the same `state`
  reference. If nothing is visible, it becomes `item` and `waiting` stays. If fewer than three
  are waiting, append. If three are waiting, drop index 0 and append.
- `dismissVisibleBannerNotification`: if nothing is visible, return the same reference.
  Otherwise the next waiting item becomes visible, or null when the wait list is empty.
- `removeBannerNotification`: removing the visible id is a dismiss. Removing a waiting id
  filters that id out. An unknown id returns the same reference.
- `clearBannerNotificationQueue` returns `EMPTY_BANNER_NOTIFICATION_QUEUE`.

## Swipe decision (`bannerNotificationSwipe.ts`)

Pure. No React, no React Native, no Expo, no gesture-handler import. The same Vitest glob as
the queue test collects `bannerNotificationSwipe.test.ts`. Do not edit `vitest.config.ts`.

Upward motion is negative, matching a `translationY` / `velocityY` from `Gesture.Pan()`.
Velocity is points per second.

```typescript
export const BANNER_NOTIFICATION_SWIPE_DISMISS_DISTANCE = 48;
export const BANNER_NOTIFICATION_SWIPE_DISMISS_VELOCITY = 800;
export const BANNER_NOTIFICATION_SWIPE_DRAG_MIN_Y = -400;
export const BANNER_NOTIFICATION_SWIPE_DRAG_MAX_Y = 24;

export function shouldDismissBannerNotificationSwipe(input: {
  translationY: number;
  velocityY: number;
}): boolean;

export function bannerNotificationDragOffset(translationY: number): number;
```

`shouldDismissBannerNotificationSwipe`:

- A non-finite `translationY` or `velocityY` returns false.
- `translationY > 0` returns false. A drag that ends below the rest position springs back,
  including when `velocityY` is a large negative number.
- Otherwise true when `translationY <= -48` or `velocityY <= -800`. The two checks are
  independent. A slow drag of exactly 48 points dismisses. A faster flick dismisses when the
  distance is still short of 48.

`bannerNotificationDragOffset` clamps the finger position the card copies while the finger is
down. Non-finite input returns `0`. Other values clamp to `[-400, 24]`: upward travel follows
the finger until 400 points, and downward travel follows the finger until 24 points.

## Card (`BannerNotification.tsx`)

A single mounted card. Plan 53 renders it only while a queue item is visible, and unmounts it
when the queue is cleared. The card does not know about the queue.

```typescript
export type BannerNotificationProps = {
  notificationId: number;
  title: string;
  body: string | null;
  dismissLabel: string;
  accessibilityHint: string;
  onPress: () => void;
  onClosed: () => void;
};
```

`title` and `body` are already the summary from plan 50's `bannerNotificationCopy`. Render them.
Do not fetch, format HTML, or look up a category.

### Layout

- Outer `Animated.View` (React Native `Animated`, not Reanimated). `useNativeDriver: true`.
  Wrap that view in `GestureDetector` from `react-native-gesture-handler`. The gesture section
  specifies the pan. The Dismiss control stays inside the card.
- Inside it, `Card` from `apps/mobile/src/components/primitives/Card.tsx` for the surface
  (secondary background, hairline, `tokens.radii.md`). Do not invent a second surface.
- A row: a `Pressable` with `flex: 1`, then a dismiss `Pressable`.
- Title: `numberOfLines={1}`, `typography.subheading`, primary text, `testID`
  `banner-notification-title`.
- Body: only when `body !== null`. `numberOfLines={1}`, `typography.body`, secondary text.
- Dismiss shows the glyph `✕`, the same glyph `MembershipExpiredBanner` uses.
  `accessibilityLabel` is `dismissLabel`. `accessibilityRole="button"`.
  `testID="banner-notification-dismiss"`.
- The card pressable: `testID="banner-notification"`, `accessibilityRole="button"`,
  `accessibilityLabel` is `title` when `body` is null and `` `${title}. ${body}` `` otherwise.
  `accessibilityHint` is the `accessibilityHint` prop. `accessibilityLiveRegion="polite"`.
- Styles from `useThemedStyles` with a module-scope factory. Spacing from `tokens.spacing`.
  Horizontal padding on the row is `spacing.lg`. The gap between title and body is `spacing.xs`.
  The gap between the text and the dismiss control is `spacing.md`.

Plan 53 places this view. This component does not read safe-area insets and does not position
itself on the screen.

### Motion

One `translateY` `Animated.Value` drives enter, drag, spring-back, and leave. Every
`Animated.timing` and `Animated.spring` uses `useNativeDriver: true`.

- Enter: `translateY` from `-240` to `0` over 220ms. The pan stays disabled until that timing
  finishes. When Reduce Motion skips the enter, enable the pan immediately.
- Leave: one function, `startLeave`, is the only leave. It sets a leaving ref synchronously,
  then `cancelTimer`. Card tap, Dismiss, the timer, and a qualifying swipe all use it. Card
  tap calls `onPress` before `startLeave`. The other three do not. Inside `startLeave`, if
  Reduce Motion is on, call `onClosed` and return. Do not `setValue(0)` on that path. If the
  value is already `<= -240`, call `onClosed` and skip the timing. Otherwise
  `translateY.stopAnimation()`, then `translateY` to `-240` over 180ms, then `onClosed`.
- `useReduceMotion()` from `apps/mobile/src/hooks/useReduceMotion.ts`. When it is true, the
  enter sets `translateY` to `0` with no timing, a qualifying swipe still dismisses with no
  slide, and a non-qualifying release snaps back with `setValue(0)`. `onUpdate` still copies
  the finger while it is down.
- The visible timer is `BANNER_NOTIFICATION_VISIBLE_MS` from the queue module. It arms on
  mount and arms again from the full 5000ms when `notificationId` changes. On fire, `startLeave`.
- Tap on the card: call `onPress` immediately, then `startLeave`. Do not wait for the
  animation before `onPress`.
- Tap on dismiss: `startLeave`. Do not call `onPress`.
- While a leave is running, ignore further taps, ignore the timer, and ignore pan updates.
- When `notificationId` changes, stop the animation, cancel the timer, drop any in-flight pan
  (compare the id captured when the finger went down), and play the enter again.
- Cleanup on unmount cancels the timer and the animation and does not call `onClosed`.

### Timer while a finger is down

Pausing is part of this card. Track `remainingMs`, `deadlineMs` (`Date.now() + remainingMs`
while armed, otherwise `null`), and one timeout.

- `armTimer(durationMs)`: clear the timeout. If `durationMs <= 0`, leave the timer disarmed
  and return. Otherwise store `deadlineMs` and set the timeout for `durationMs`. `resumeTimer`
  does not call `startLeave`.
- `pauseTimer`: if `deadlineMs` is `null`, return. Store
  `remainingMs = max(0, deadlineMs - Date.now())`, set `deadlineMs` to `null`, and clear the
  timeout. A second pause while already paused does not change `remainingMs`.
- `resumeTimer`: if a leave is running, or `deadlineMs` is already set, return. Otherwise
  `armTimer(remainingMs)`.
- `cancelTimer`: clear the timeout, set `deadlineMs` to `null`, and set `remainingMs` to `0`.
  `startLeave` calls this. A later `resumeTimer` must not arm a fresh 5000ms.

`Gesture.Pan()` `onBegin` pauses. That fires when the finger touches the card, before the pan
activates, so a hold that has not moved yet also pauses. The outer view's `onTouchStart` pauses
too, including while the pan is still disabled during enter. `pauseTimer` is idempotent, so
both calls keep the same `remainingMs`.

On a spring-back, if `remainingMs <= 0`, `startLeave` (dismiss). Otherwise `resumeTimer`.
On a pan that never activated, `resumeTimer`. If `remainingMs` is `0`, `setTimeout` of `0`
calls `startLeave` only when the leaving ref is still clear, so a tap's `onPress` in this turn
opens the card and a touch that was not a tap still hides it. Do not resume after `startLeave`.

### Swipe

Reuse `Gesture.Pan()` from `react-native-gesture-handler`. `FullPlayerScrubber` and
`ReorderableSections` already build pans this way, and `App.tsx` already mounts
`GestureHandlerRootView`. Do not add a dependency. Do not use `PanResponder`. Do not use
`PanGestureHandler` (gesture-handler 3.3.0 deprecates it). Do not use Reanimated.
`Gesture.Pan()` UI-thread callbacks are Reanimated worklets, and this card's motion is React
Native `Animated`.

```typescript
Gesture.Pan()
  .runOnJS(true)
  .maxPointers(1)
  .enabled(entered && !leaving)
  .activeOffsetY([-10, 10])
  .failOffsetX([-24, 24])
  .cancelsTouchesInView(true)
```

`useMemo` the gesture. A new `Gesture` object on each render re-attaches the recognizer during
a drag. `.runOnJS(true)` keeps `onBegin`, `onStart`, `onUpdate`, `onEnd`, and `onFinalize` on
the JS thread so they can call `setValue`, the timer, and `startLeave`. After the enter timing
has run with the native driver, `setValue` updates that native node. The 10-point
`activeOffsetY` lets a tap reach the card `Pressable` and the Dismiss `Pressable`. The
horizontal fail offset applies only before activation, so a sideways nudge stays a tap.

- `onBegin`: if the previous touch was a drag, clear that ref first, so this touch can still
  be a tap. Then `pauseTimer`. Remember the current `notificationId` for this touch.
- `onStart`: set a ref that means this touch became a drag.
- `onUpdate`: if this touch's id is still the visible id and a leave is not running,
  `translateY.setValue(bannerNotificationDragOffset(event.translationY))`.
- `onEnd`: read `event.translationY` and `event.velocityY` from the gesture event. Do not
  read them back from the animated value. If `shouldDismissBannerNotificationSwipe` is true,
  `startLeave` and do not call `onPress`. `startLeave` applies Reduce Motion and the
  already-at-`-240` skip. If the decision is false and Reduce Motion is on, `setValue(0)`,
  then the spring-back timer rule in the timer section. If the decision is false and Reduce
  Motion is off, `translateY.stopAnimation()`, spring to `0`, then that same timer rule. The
  spring is `stiffness: 400`, `damping: 30`, `mass: 1`, `overshootClamping: true`,
  `restDisplacementThreshold: 0.5`, `restSpeedThreshold: 0.5`, `useNativeDriver: true`.
- `onFinalize`: if this touch never activated, follow the non-activated rule in the timer
  section. Leave the drag ref set when this touch activated, so a `Pressable` `onPress` from
  the same touch still sees it. The next `onBegin` clears it.

The card `Pressable` and the Dismiss `Pressable` both return immediately when that drag ref is
set. A swipe never calls `onPress` and never marks the notification read. Plan 53 marks read
only in the card's `onPress`. The Dismiss control stays: `accessibilityLabel` is `dismissLabel`,
`accessibilityRole="button"`, `testID="banner-notification-dismiss"`. Do not add an
accessibility action for the swipe, and do not add a catalog string. Screen-reader dismissal
is the Dismiss control.

### Announcement

When `notificationId` changes, if `Platform.OS !== 'android'`, call
`AccessibilityInfo.announceForAccessibility` with the same label as the pressable. Android uses
`accessibilityLiveRegion` only, so the banner is not spoken twice.

No haptic here. Plan 53 plays it.

No catalog reads. `dismissLabel` is already localized.

## Tests

`bannerNotificationQueue.test.ts`. Build a `DTOAccountNotification` fixture with every required
field (`id`, `account_id`, `category`, `is_unread`, `title`, `body`, `link_path`, `payload`,
`created_at`, `expires_at`). No `as`.

- The first enqueue is visible and the wait list is empty.
- The next three wait, in order.
- A fifth distinct id discards the oldest waiting id and appends the new one. The visible id
  stays.
- Enqueue of the visible id, or of an id already waiting, returns the same state reference.
- Dismiss promotes the first waiting id. Dismiss on an empty queue returns the same reference.
- Remove of the visible id promotes. Remove of a waiting id keeps the others in order.
- Clear returns the empty constant.

`bannerNotificationSwipe.test.ts`. No React render and no `as`. One case per line:

- Distance boundary: `translationY: -48`, `velocityY: 0` dismisses.
- Short of both thresholds: `translationY: -47`, `velocityY: 0` does not.
- Velocity boundary with a short drag: `translationY: -47`, `velocityY: -800` dismisses.
- Just under the velocity boundary: `translationY: -47`, `velocityY: -799` does not.
- Downward release: `translationY: 1`, `velocityY: -2000` does not.
- Rest: `translationY: 0`, `velocityY: 0` does not.
- A long upward drag: `translationY: -400`, `velocityY: 0` dismisses.
- Non-finite `translationY`, and non-finite `velocityY`, do not dismiss.
- Drag offset clamps `-500` to `-400`, clamps `80` to `24`, returns `-20` unchanged, and
  returns `0` for a non-finite input.

No Maestro flow in this plan. Plan 53 swipes the mounted card.

## Release scratchpad

none
