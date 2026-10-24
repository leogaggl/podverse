**Cursor model:** Cursor Grok 4.7 · **Reasoning:** extra high

# 53 — Show the banner, open the page, mark that notification read

While the app is in the foreground, a new stream notification slides down from the top unless
the Notifications inbox is on screen or that kind's switch is off. A tap opens the same page an
inbox row would and marks only that notification read. A swipe up, the Dismiss control, and the
timer each hide the card and leave that notification unread. A light haptic plays when the card
appears.

Plan 40 keeps the stream open in the background while audio plays. A notification event that
arrives while the app is not active never presents a banner and is not held to present one
later. Plan 40's store still applies it to the unread count, the badge, and the inbox. In the
background, OS push is what shows a notification.

This is the plan that mounts plan 51's card on plan 50's rules, using plan 40's event channel
and plan 41's `markNotificationReadById`. Web has no in-app banner. The operator kept the web
push popup. Do not add a web toast.

Before editing, confirm the symbols plan 40, 41, and 42 added are there, and follow them if a
name moved:

- `subscribeNotificationStreamEvents`, `isNotificationsInboxFocused`, and
  `markNotificationsInboxFocused` in
  `apps/mobile/src/notifications/notificationStreamStore.ts`.
- `markNotificationReadById` in `apps/mobile/src/notifications/notificationReadActions.ts`.
- `OverlayOutlet` in `AppBody` inside `apps/mobile/App.tsx`.
- `handleNotificationPress` in
  `apps/mobile/src/screens/notifications/NotificationsInboxScreen.tsx`.
- The `status === 'anonymous'` effect in `apps/mobile/src/sync/SyncProvider.tsx`.
- `MoreE2ePlaybackScreen` and `E2ePlayVideoButton`.
- Plan 52's keys `settings.notifications.banner_dismiss`,
  `settings.notifications.banner_open_hint`, and `e2e.show_banner_notification`.

Do not edit `navigation/index.tsx`, `notificationTarget.ts`, `notificationRouting.ts`,
`notificationReadActions.ts`, or the stream controller. Do not add `setNotificationHandler`.
Foreground OS pushes stay unpresented. The banner listens only to the stream.

When the stream closed in the background, a notification created between the return to the
foreground and the stream's first event does not get a banner. Plan 40 opens that session with
no replay. Do not add one. The badge and the inbox still catch it. When the stream stayed open
through the background, plan 40 keeps that connection and there is no such gap.

Plan 40's event channel carries no app state. The host reads `AppState` itself.

## Rows

R7, R10, R11, R13, R35, R43, R45

## Runs after

40, 41, 42, 50, 51, 52

## Files

apps/mobile/src/notifications/bannerNotificationStore.ts
apps/mobile/src/notifications/bannerNotificationStore.test.ts
apps/mobile/src/notifications/bannerNotificationE2e.ts
apps/mobile/src/notifications/BannerNotificationHost.tsx
apps/mobile/src/notifications/playBannerNotificationHaptic.ts
apps/mobile/src/notifications/notificationStreamStore.ts
apps/mobile/src/notifications/notificationStreamStore.test.ts
apps/mobile/src/push/accountNotificationLink.ts
apps/mobile/src/push/accountNotificationLink.test.ts
apps/mobile/src/push/openAccountNotificationLink.ts
apps/mobile/src/screens/notifications/NotificationsInboxScreen.tsx
apps/mobile/src/screens/more/MoreE2ePlaybackScreen.tsx
apps/mobile/src/sync/SyncProvider.tsx
apps/mobile/App.tsx
apps/mobile/package.json
apps/mobile/package-lock.json
apps/mobile/vitest.config.ts
apps/mobile/e2e/banner-notification.yaml
scripts/mobile/e2e-test.sh
release-notes/scratchpad.md

## Store

`bannerNotificationStore.ts` holds plan 51's queue in module state. No React and no React Native.

```typescript
export function getBannerNotificationQueue(): BannerNotificationQueueState;
export function subscribeBannerNotificationQueue(listener: () => void): () => void;
export type BannerNotificationPresentContext = {
  /** The app was active (`AppState` `active`) when the event arrived. */
  appActive: boolean;
  /** The Notifications inbox is on screen. */
  inboxFocused: boolean;
};
export function presentBannerNotification(
  notification: DTOAccountNotification,
  enabled: Readonly<Record<BannerNotificationKind, boolean>>,
  context: BannerNotificationPresentContext
): void;
export function dismissVisibleBannerNotification(): void;
export function removeBannerNotification(id: number): void;
export function clearBannerNotificationQueue(): void;
```

`presentBannerNotification`:

- When `context.appActive` is false, return. Nothing is enqueued or kept for later (R45).
- When `context.inboxFocused` is true, return.
- When `shouldShowBannerNotification` is false, return.
- When `bannerNotificationCopy` returns null, return.
- Otherwise enqueue an item whose `id` is `notification.id`, whose `title` and `body` are the
  copy, and whose `notification` is the DTO.
- Notify listeners only when the queue function returned a new state.

`dismissVisibleBannerNotification`, `removeBannerNotification`, and
`clearBannerNotificationQueue` delegate to the queue module. Clear is what sign-out and the
inbox use. A listener that throws is caught and logged with `console.warn`.

`bannerNotificationStore.test.ts` is collected by plan 50's glob. Do not add it to
`vitest.config.ts`.

- A `new-content` notification with the default map, `appActive: true`, and
  `inboxFocused: false` becomes visible.
- The same call with `inboxFocused: true` leaves the queue empty.
- An event received in the background: the same notification with `appActive: false` leaves the
  queue empty. A later call for a second notification with `appActive: true` makes only the
  second one visible, with nothing waiting behind it. The background one was not kept.
- A `livestream` notification with `payload: { type: 'livestream-scheduled' }` and the default
  map does not show.
- A notification with an empty title and a null body does not show.
- `removeBannerNotification` of the visible id promotes the next waiting item.
- `clearBannerNotificationQueue` empties the queue.

Use a full `DTOAccountNotification` fixture. No `as`. Every case except the background one passes
`appActive: true`.

## Inbox focus listener

Plan 40's store counts inbox focus and does not notify anyone when the count changes. Add:

```typescript
export function subscribeNotificationsInboxFocus(listener: () => void): () => void;
```

Call the listeners only when the focused count crosses between 0 and positive (the first hold,
and the last release). A double release does not notify. Catch a listener that throws, the same
way the other subscriber sets in that file do. Do not change `resetNotificationStreamStore`.
Focus still survives a reset.

Extend `notificationStreamStore.test.ts`: two nested holds notify on the first acquire and the
last release only.

## Opening the page

The inbox already resolves a row with `resolveNotificationDestinationFromPayload` and
`Linking.openURL`. Move that into two files so the banner and the inbox cannot diverge.
`notificationTarget.ts` stays the push-payload helper. Do not add Linking to it. It is in the
node Vitest suite.

`accountNotificationLink.ts` (pure):

```typescript
export function resolveAccountNotificationOpenPath(notification: {
  link_path: string | null;
  payload: Record<string, unknown> | null;
}): string;
```

Same inputs the inbox uses today:

```typescript
const destination = resolveNotificationDestinationFromPayload({
  ...(notification.payload ?? {}),
  link_path: notification.link_path,
});
return (
  destination.mobileStackPath ??
  (destination.kind === 'home' ? HOME_FALLBACK_PATH : destination.webPath)
);
```

`HOME_FALLBACK_PATH` comes from `notificationTarget.ts`. `link_path` is applied after the
payload spread, so the DTO's `link_path` wins over a `link_path` inside `payload`.

`openAccountNotificationLink.ts` (React Native):

```typescript
export function openAccountNotificationLink(notification: {
  link_path: string | null;
  payload: Record<string, unknown> | null;
}): Promise<void>;
```

Copy the inbox's URL rules. A path that starts with `http://` or `https://`, or that contains
`://`, goes to `Linking.openURL` as-is. Anything else uses
`getMobileConfig().deepLinkSchemes[0] ?? 'podverse-next'` and the path with one leading slash
removed: `` `${scheme}://${inAppPath}` ``. On failure, `console.warn` and resolve. This function
does not throw.

Replace the body of `handleNotificationPress` with
`void openAccountNotificationLink(notification)`. Remove the imports that become unused. Leave
the rest of the screen as plan 42 left it.

`accountNotificationLink.test.ts`:

- Payload `{ type: 'new-episode', channelIdText: 'chan123456', itemIdText: 'item123456' }` and
  `link_path: null` equals `buildMobileHomePodcastEpisodePath('chan123456', 'item123456')` from
  `@podverse/helpers`.
- `payload: null` and `link_path: '/notifications'` returns `'/notifications'`.
- `payload: {}` and `link_path: null` returns `HOME_FALLBACK_PATH`.

Add `src/push/accountNotificationLink.test.ts` to the `include` list in
`apps/mobile/vitest.config.ts` with a targeted insertion, and name the module in the header
comment. Do not rewrite the array. Do not remove plan 50's `bannerNotification*.test.ts` glob.

## Haptic

Add `expo-haptics` with the Expo SDK pin. From the repo root:

```bash
npm --prefix apps/mobile exec -- expo install expo-haptics
```

Commit the `apps/mobile/package.json` and `apps/mobile/package-lock.json` that command writes.
Do not add the dependency to the root workspace. Do not run
`scripts/development/update-lockfile-linux.sh` for this. That script regenerates the root
lockfile only.

`playBannerNotificationHaptic.ts`:

```typescript
export function playBannerNotificationHaptic(reduceMotion: boolean): void;
```

When `reduceMotion` is true, return. Otherwise
`void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)`. Catch and ignore a rejection. A
simulator or a binary that does not include the module yet still shows the banner. The dev
client has to be rebuilt before the haptic is felt. Say that in the scratchpad. Do not skip the
dependency because of the rebuild.

## Host

`BannerNotificationHost.tsx` renders nothing until a card is visible. Mount it in `AppBody`
immediately after `<OverlayOutlet />`, inside the same branch, so it sits under auth, theme,
and the root safe-area provider, and paints above the navigator and above overlays.

The host view is `StyleSheet.absoluteFillObject` with `pointerEvents="box-none"`. It does not
use `Modal` or `AppOverlay`. Those would take over the screen. Touches outside the card pass
through. The card's top margin is `useSafeAreaInsets().top + tokens.spacing.sm`, and its
horizontal margin is `tokens.spacing.lg`.

- Hydrate prefs in an effect: `void hydrateBannerNotificationPrefs()`. Do not await them before
  the first paint.
- Read enabled with `useSyncExternalStore(subscribeBannerNotificationPrefs,
  getBannerNotificationEnabled)`.
- Read the queue with `useSyncExternalStore(subscribeBannerNotificationQueue,
  getBannerNotificationQueue)`.
- Track hydration with `useSyncExternalStore(subscribeBannerNotificationPrefs,
  isBannerNotificationPrefsHydrated)`. The prefs module notifies on hydrate as well as on
  `set`, so this snapshot updates when the first read settles.
- Auth: the same `accessToken`, `clearSession`, `refreshToken`, `setTokens`, and `status` fields
  `useAuth()` already returns. Keep them in a ref.
- Subscribe once to `subscribeNotificationStreamEvents`.
  - `created`: first read `AppState.currentState === 'active'` from `react-native`. When it is
    false, drop the notification here: do not present it and do not hold it (R45). Plan 40's
    store has already applied it to the badge and the inbox. Otherwise, if
    `isBannerNotificationPrefsHydrated()` is false, hold the notification in a ref list capped
    at 4 (discard the oldest held). When the hydration snapshot becomes true,
    `presentBannerNotification` each held item in order with `getBannerNotificationEnabled()`
    and `{ appActive: AppState.currentState === 'active', inboxFocused:
    isNotificationsInboxFocused() }`, then clear the hold list. If the app left the foreground
    while prefs were loading, the store drops them. If prefs are already hydrated, present
    immediately with the same context.
  - `read` with `scope: 'one'`: `removeBannerNotification(event.notificationId)`.
  - `read` with `scope: 'all'`: `clearBannerNotificationQueue()`.
  - `resync`: ignore. Do not banner a backlog.
- Subscribe to `subscribeNotificationsInboxFocus`. When `isNotificationsInboxFocused()` becomes
  true, `clearBannerNotificationQueue()`. The inbox marks the new row read itself. Do not call
  `markNotificationReadById` for that clear.
- Add `AppState.addEventListener('change', …)` in an effect, and remove it in the cleanup. On
  `background`, `clearBannerNotificationQueue()` and empty the hold list, so no card from before
  the background is waiting on return. This clears without marking read; those notifications
  stay unread, like a dismiss. `inactive` changes nothing.
- When the visible id changes to a number, call
  `playBannerNotificationHaptic(getReduceMotionSnapshot())` from `useReduceMotion.ts`. Once per
  id, not on every render.
- Render `BannerNotification` with the visible item's id, title, and body.
  `dismissLabel` is `t('settings.notifications.banner_dismiss')`.
  `accessibilityHint` is `t('settings.notifications.banner_open_hint')`.
- `onPress`: if `status === 'authenticated'`, `void markNotificationReadById(authRef.current,
  notification.id)`. Either way, `void openAccountNotificationLink(notification)`. Do not await
  either call. Do not clear the queue here. The card calls `onClosed` after it leaves.
- `onClosed`: `dismissVisibleBannerNotification()`. A late call after a clear is a no-op because
  dismiss on an empty queue keeps that state.
- A swipe up is the card's dismiss path (plan 51). It calls `onClosed` and does not call
  `onPress`, so this host does not mark that notification read and does not open its page.
  Do not add a pan handler here. Web has no in-app banner, so this swipe has no web counterpart.
- Sign-out: in the `status === 'anonymous'` effect in `SyncProvider.tsx`, call
  `clearBannerNotificationQueue()` beside `resetNotificationStreamStore()` and
  `resetNotificationsInboxCache()`. The prefs stay.

The host effect subscribes after paint. Nothing here runs before the first screen.

## E2E button

`bannerNotificationE2e.ts`:

```typescript
export function presentE2eBannerNotification(): void;
```

When `isMobileE2eFromEnv()` is false, return. Otherwise `presentBannerNotification` with:

- `id: 9001`
- `account_id: 1`
- `category: 'new-content'` (the New Item switch, on by default)
- `is_unread: true`
- `title: 'E2E Banner'`
- `body: 'E2E banner body'`
- `link_path: '/notifications'`
- `payload: null` (a `new-episode` payload with ids would open the episode instead of this path)
- `created_at: '2026-01-01T00:00:00.000Z'`
- `expires_at: '2026-02-01T00:00:00.000Z'`

and with `getBannerNotificationEnabled()` and `{ appActive: true, inboxFocused:
isNotificationsInboxFocused() }`. The button is pressed on screen, so the app is active.

On `MoreE2ePlaybackScreen`, when `isMobileE2eFromEnv()` is true, render a full-width `Button`
after the intro note and before the play buttons. Label `t('e2e.show_banner_notification')`.
`testID="e2e-show-banner-notification"`. `onPress` calls `presentE2eBannerNotification`. The
screen is already behind the E2E menu flag. The extra check matches `E2ePlayVideoButton`.

## Maestro

New file `apps/mobile/e2e/banner-notification.yaml`. Do not add steps to
`notifications-inbox.yaml` (plan 52 owns the settings asserts there).

```yaml
appId: com.podverse.app.next
name: Banner Notification
---
# The playback screen's E2E button presents one banner. A swipe up dismisses it and stays on
# this screen. A later tap opens Notifications.
# Mark-read for this fixture id answers 404, which the read action ignores.

- runFlow: shared/launch-and-connect.yaml
- runFlow: shared/login-seeded-user.yaml
- runFlow: shared/open-e2e-playback.yaml

- tapOn:
    id: e2e-show-banner-notification
- extendedWaitUntil:
    visible:
      id: banner-notification
    timeout: ${TIMEOUT_FAST}
- assertVisible:
    id: banner-notification-title
    text: "E2E Banner"
- takeScreenshot: banner-notification-visible
- swipe:
    from:
      id: banner-notification
    direction: UP
- extendedWaitUntil:
    notVisible:
      id: banner-notification
    timeout: ${TIMEOUT_FASTEST}
- assertVisible:
    id: more-e2e-playback-screen
- assertNotVisible:
    id: notifications-inbox-screen
- takeScreenshot: banner-notification-swiped-away
- tapOn:
    id: e2e-show-banner-notification
- extendedWaitUntil:
    visible:
      id: banner-notification
    timeout: ${TIMEOUT_FAST}
- tapOn:
    id: banner-notification
- extendedWaitUntil:
    notVisible:
      id: banner-notification
    timeout: ${TIMEOUT_FAST}
- extendedWaitUntil:
    visible:
      id: notifications-inbox-screen
    timeout: ${TIMEOUT_SLOW}
- takeScreenshot: banner-notification-opened-inbox
```

`TIMEOUT_FAST` for the card appearing, because it is local. `TIMEOUT_FASTEST` for the swipe
dismiss, because the card is already on screen and the leave is local (180ms). If a run shows
the card still leaving when that wait ends, raise that one wait to `TIMEOUT_FASTER` and leave
the others. `TIMEOUT_SLOW` for the inbox because the tap goes through a deep link. No new
timeout numbers.

Maestro already swipes `direction: UP` from an element id (`player-screen.yaml`,
`show-notes.yaml`). Start this swipe on `banner-notification` so it hits the card. A swipe that
long travels well past the 48-point distance, so the flow does not depend on the velocity
threshold. Do not add a short-drag or spring-back step. Those decisions are the unit cases in
plan 51. Presenting id `9001` again after the swipe works: dismiss has removed it from the
queue, so the second tap of `e2e-show-banner-notification` enqueues it.

There is still no API that creates a notification during E2E. This flow proves the card mounts,
a swipe up dismisses it without opening the inbox, a tap dismisses it, and the link opens the
inbox. Kind filtering, the queue, the threshold numbers, and mark-read stay on the unit tests.
The signed-in tap calls mark-read with id 9001. Plan 41 treats 404 as already gone and does not
warn. The swipe does not call mark-read.

The flow signs in a seeded user, so it needs the E2E API. In `scripts/mobile/e2e-test.sh`, add
`banner-notification` to the `flow_needs_e2e_api` case list, in alphabetical position (after
`auto-queue-advance`, before `browse`). It does not need test assets, so leave
`flow_needs_test_assets` alone.

## Tests

Listed above: store test (including the case where an event received in the background shows
no banner and is not kept), inbox-focus cases on the stream store test, path test, and
`banner-notification.yaml` (a swipe up dismisses the card and stays on the E2E playback
screen; a tap opens the inbox). The swipe threshold cases live in plan 51. Maestro cannot deliver
a stream event while the app is in the background, so the background rule rests on the store
test.

No change to plan 50's policy tests.

## Release scratchpad

```markdown
## Mobile banner notifications

- Surfaces: mobile
- Change: while the app is open and the Notifications inbox is not on screen, a new notification
  whose kind is turned on slides down from the top. The card shows the title and one line of the
  body. A tap opens that notification's page and marks only that notification read, so the unread
  badge drops when it was the only unread one. Dismissing the card with its Dismiss control,
  swiping it up, or letting it hide, leaves the badge. A light haptic plays when the card
  appears. A notification that arrives while the app is in the background, including while the
  stream stays open for background audio, never shows a banner and is not saved to show on
  return. The OS push shows it, and the badge and inbox still update. Cards waiting when the app
  goes to the background are cleared and stay unread. The dev client has to be rebuilt before
  the haptic is in the binary (`npm run mobile:prebuild`, then reinstall).
- Who notices: signed-in mobile users with the app in the foreground
- Operator steps: rebuild and reinstall the mobile dev client so expo-haptics is included
```
