**Cursor model:** Cursor Grok 4.7 · **Reasoning:** high

# 41 — Mobile push tap marks that notification read

Tapping an OS push notification on mobile marks only that notification read, and the badge drops
by one at once. Push data carries no notification id, so the app sends the push's `itemIdText` and
`type` to plan 21's `POST /account/notifications/mark-read-by-item`. This plan also adds the shared
mark-one action that the inbox (plan 42) and the banner (area E) call with a notification id.

Before editing, confirm these exist and adjust anchors if they moved:

- `getInitialNotificationDeepLinkUrl`, `subscribeToNotificationOpen`, and `isPushRoutingEnabled`
  in `apps/mobile/src/push/notificationRouting.ts`.
- `asNonEmptyString` and `extractNotificationTargetPath` in
  `apps/mobile/src/push/notificationTarget.ts`.
- `notificationsRepository.markRead` in
  `apps/mobile/src/data/repositories/notificationsRepository.ts`.
- `NotificationsRuntime` in `apps/mobile/src/notifications/NotificationsRuntime.tsx`, and
  `setNotificationUnreadCount` in `notificationStreamStore.ts` (plan 40).
- `reqNotificationsMarkReadOne` and `reqNotificationsMarkReadByItem` on `ApiRequestService`
  (plan 21).
- `createInFlightGuard` in `apps/mobile/src/lib/rateLimit/createInFlightGuard.ts`.

## Rows

R31

## Runs after

21, 40

## Files

apps/mobile/src/push/notificationTarget.ts
apps/mobile/src/push/notificationTarget.test.ts
apps/mobile/src/push/notificationRouting.ts
apps/mobile/src/data/repositories/notificationsRepository.ts
apps/mobile/src/notifications/notificationReadActions.ts
apps/mobile/src/notifications/notificationReadActions.test.ts
apps/mobile/src/notifications/usePushTapMarksRead.ts
apps/mobile/src/notifications/NotificationsRuntime.tsx
apps/mobile/vitest.config.ts
release-notes/scratchpad.md

## Reuses

- The tap listener and cold-start lookup that already route pushes (`notificationRouting.ts`).
  Deep-link routing in `App.tsx` is unchanged. This plan adds a second consumer of the same
  responses.
- `requestWithMobileAuthRefresh` through the repository, so the refresh and offline rules apply.
- `createInFlightGuard` for the duplicate-tap guard (**input-rate-control**).
- Plan 40's store for the badge count.

## Payload read target (`notificationTarget.ts`)

```typescript
export type NotificationReadTarget = { itemIdText: string; type: string };

/** The push's item and type, used to mark its inbox row read. Null when either is missing. */
export const extractNotificationReadTarget = (
  data: Record<string, unknown> | null | undefined
): NotificationReadTarget | null;
```

Read `data.itemIdText` and `data.type` with the existing `asNonEmptyString`. Return null when the
data is null or undefined, or when either value is not a non-empty string.

## Routing (`notificationRouting.ts`)

- Add a module-level `Set<string>` of handled response identifiers
  (`response.notification.request.identifier`). Cap it at 50 by deleting the oldest entry.
- `claimNotificationResponse(response): boolean` is private. It returns false when the identifier
  is already in the set. Otherwise it records the identifier and returns true.

```typescript
/**
 * The read target of the notification that cold-launched the app, once per process. Later calls
 * resolve null so a remount does not mark it again.
 */
export const getInitialNotificationReadTarget = async (): Promise<NotificationReadTarget | null>;

/** Warm taps: emits each tapped push's read target once. Empty unsubscribe when push is off. */
export const subscribeToNotificationOpenReadTarget = (
  onTarget: (target: NotificationReadTarget) => void
): NotificationOpenUnsubscribe;
```

- Both return early, with null or an empty unsubscribe, when `isPushRoutingEnabled()` is false.
- `getInitialNotificationReadTarget`:
  - uses a module flag so only the first call reads `getLastNotificationResponseAsync()`;
  - returns null when the response is null or undefined, or when the claim fails;
  - otherwise returns `extractNotificationReadTarget(response.notification.request.content.data)`.
- `subscribeToNotificationOpenReadTarget`:
  - adds its own `addNotificationResponseReceivedListener`;
  - claims each response, extracts the target, and calls `onTarget` when the target is not null.
- Leave `getInitialNotificationDeepLinkUrl` and `subscribeToNotificationOpen` as they are.
- Export the `NotificationReadTarget` type through this file only if `usePushTapMarksRead`
  imports it from here. Otherwise import it from `notificationTarget.ts`. Do not re-export it
  under a new name.

## Repository (`notificationsRepository.ts`)

Add, after `markRead`:

```typescript
export type NotificationsMarkReadResult = { markedIds: number[]; unreadCount: number };

markReadOne: async (
  context: MobileAuthRequestContext,
  notificationId: number
): Promise<NotificationsMarkReadResult>
markReadByItem: async (
  context: MobileAuthRequestContext,
  target: { itemIdText: string; type: string }
): Promise<NotificationsMarkReadResult>
```

- Each goes through `requestWithMobileAuthRefresh`, calling
  `apiRequestService.reqNotificationsMarkReadOne(notificationId)` or
  `apiRequestService.reqNotificationsMarkReadByItem({ item_id_text: target.itemIdText, type:
  target.type })`.
- Each maps `{ marked_ids, unread_count }` to camelCase.

## Read actions (`src/notifications/notificationReadActions.ts`)

```typescript
/** Marks one notification read and applies the returned unread count. Never throws. */
export const markNotificationReadById = (
  context: MobileAuthRequestContext,
  notificationId: number
): Promise<void>;

/** Marks the notification behind a tapped push read and applies the count. Never throws. */
export const markPushNotificationRead = (
  context: MobileAuthRequestContext,
  target: NotificationReadTarget
): Promise<void>;
```

- **Guard:** one module-level `createInFlightGuard()`. Keys are `id:${notificationId}` and
  `item:${itemIdText}:${type}`. A repeat call while the first is running resolves without a
  request.
- **Success:** call `setNotificationUnreadCount(result.unreadCount)`. The stream's
  `notification.read` event then repeats the same count, which is harmless.
- **Failure:** swallow and do not warn when the error is an `OfflineModeEnabledError` or when
  `getErrorResponseStatus(error) === 404`. Plan 21 answers 404 for a deleted or unknown
  notification; for an already-read one it answers 200 with empty `markedIds`. For any other
  error, `console.warn('[notifications] mark one read failed', { error })` and resolve.
- These actions do not check auth status. Callers only call them while signed in. A 401 path ends
  in the auth wrapper's refresh or `clearSession`, as for every other request.

## Hook (`src/notifications/usePushTapMarksRead.ts`)

```typescript
export const usePushTapMarksRead = (
  status: AuthStatus,
  authDepsRef: { readonly current: MobileAuthRequestContext }
): void;
```

Use the `status` type `useAuth()` already exposes. Match the ref's type to what
`NotificationsRuntime` holds; it can be React's `RefObject` type.

- **Effect keyed on `status`:** when `status === 'authenticated'`:
  - subscribe with `subscribeToNotificationOpenReadTarget((target) => void
    markPushNotificationRead(authDepsRef.current, target))`;
  - call `getInitialNotificationReadTarget()` once and mark its target when it is not null;
  - unsubscribe in the cleanup.
- **Signed out:** subscribe to nothing. A tap that arrives while signed out does not mark later.
  Because the cold-start lookup is once per process, a user who signs in after a cold-start tap
  does mark that notification read. This is intended: the inbox row belongs to that account, and
  the server answers 404 for another account's item.

Call `usePushTapMarksRead(status, authDepsRef)` in `NotificationsRuntime.tsx`, using the auth ref
from plan 40.

## Tests

- `apps/mobile/src/push/notificationTarget.test.ts`:
  - `extractNotificationReadTarget` returns the pair for `{ itemIdText: 'abcdefghi1', type:
    'livestream-started' }` and trims surrounding spaces;
  - it returns null for a missing `type`, a numeric `itemIdText`, an empty string, and null data.
- `apps/mobile/src/notifications/notificationReadActions.test.ts`: `vi.mock` the repository
  module, the same way `statsRepository.test.ts` mocks its imports.
  - Success sets the store's unread count from the response.
  - A 404 error and an `OfflineModeEnabledError` resolve without changing the count and without
    `console.warn`.
  - Another error resolves and warns once.
  - Two concurrent calls with the same id make one repository call.
  - Calls with different ids make two.

  If importing `OfflineModeEnabledError` from `src/prefs/offlineMode.ts` pulls AsyncStorage into
  node, mock that module too, or construct the error through the mock.
- `apps/mobile/vitest.config.ts`: add `src/notifications/notificationReadActions.test.ts` to
  `include`, and name it in the header comment's covered-modules list.
- No Maestro change. Maestro cannot post an OS push with a payload on both platforms, and nothing
  in E2E creates the inbox row the push would point to. The pair extraction and the action are
  the claim, and both are unit-tested.

## Release scratchpad

```markdown
## Mobile push tap marks that notification read

- Surfaces: mobile
- Change: tapping an OS push notification marks only that notification read (through
  `POST /account/notifications/mark-read-by-item` with the push's item and type), and the
  Notifications badge drops by one at once. Opening the inbox still marks every notification read.
- Who notices: signed-in mobile users who open the app from a push notification
- Operator steps: none beyond deploying the API with the mark-one endpoints
```
