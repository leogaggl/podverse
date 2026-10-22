**Cursor model:** Cursor Grok 4.7 · **Reasoning:** high

# 42 — Mobile inbox shows new rows live

While the mobile Notifications inbox is focused, a new notification appears at the top of the
list as it arrives. It is marked read at once, because the open inbox already counts as reading.
The inbox registers its focus with plan 40's store, so the banner (area E) can skip the banner
while the inbox is on screen (R35). The inbox cache moves to its own module and resets at the end
of a session.

Before editing, confirm these exist in
`apps/mobile/src/screens/notifications/NotificationsInboxScreen.tsx` and adjust anchors if they
moved:

- `lastCachedInbox`, `loadFirstPageAndMarkRead`, `loadPage`, and the `useFocusEffect` that calls
  `loadFirstPageAndMarkRead`;
- `earlierSectionStartIndex` and `renderItem`.

Also confirm `subscribeNotificationStreamEvents` and `markNotificationsInboxFocused` in
`apps/mobile/src/notifications/notificationStreamStore.ts` (plan 40), and
`markNotificationReadById` in `apps/mobile/src/notifications/notificationReadActions.ts` (plan 41).

## Rows

R36

## Runs after

40, 41

## Files

apps/mobile/src/notifications/notificationsInboxCache.ts
apps/mobile/src/notifications/notificationsInboxCache.test.ts
apps/mobile/src/screens/notifications/NotificationsInboxScreen.tsx
apps/mobile/src/sync/SyncProvider.tsx
apps/mobile/vitest.config.ts
release-notes/scratchpad.md

## Reuses

- Plan 40's event channel and inbox focus count.
- Plan 41's `markNotificationReadById`, which applies the returned unread count itself.
- The screen's existing `loadFirstPageAndMarkRead` for a resync.
- The screen's existing row component and testIDs (`notifications-inbox-row-${id}`).

## Inbox cache (`src/notifications/notificationsInboxCache.ts`)

Move the `lastCachedInbox` module variable and its type out of the screen. Keep the existing doc
comment: the cache is the last successful page for Offline Mode, session-scoped, and lost when the
process dies.

```typescript
export type NotificationsInboxCache = {
  items: DTOAccountNotification[];
  page: number;
  totalPages: number;
  unreadCount: number;
};

export function getNotificationsInboxCache(): NotificationsInboxCache | null;
export function setNotificationsInboxCache(next: NotificationsInboxCache | null): void;
export function resetNotificationsInboxCache(): void;

/** New rows first. Returns `items` unchanged when the id is already listed. */
export function prependLiveNotification(
  items: readonly DTOAccountNotification[],
  notification: DTOAccountNotification
): DTOAccountNotification[];
```

Replace every read and write of `lastCachedInbox` in the screen with these functions. The
behavior stays the same.

## Screen changes (`NotificationsInboxScreen.tsx`)

1. **Focus registration.** Add a second `useFocusEffect` whose callback calls
   `markNotificationsInboxFocused()` and returns its release function. The screen is mounted on
   the Notifications stack and on the More stack (`MoreOverflowNotifications`), so the store's
   count handles both.
2. **Live rows.** Inside that same focus effect, subscribe with `subscribeNotificationStreamEvents`
   and unsubscribe on blur. Read the latest `status`, `offlineModeEnabled`, and `requestContext`
   from refs, so the subscription does not churn on token changes.
   - **`created` events**, while `status === 'authenticated'` and Offline Mode is off:
     - `setNotifications((items) => prependLiveNotification(items, event.notification))`.
     - Update the cache: when it is not null, set `items` to the prepended list; leave `page`,
       `totalPages`, and `unreadCount` as they are.
     - If a first-page load is running, also push the notification into
       `liveRowsDuringLoadRef`.
     - Call `void markNotificationReadById(requestContextRef.current, event.notification.id)`.
     - Do not change the screen's `unreadCount` state. The Unread and Earlier split shows what was
       unread when the inbox opened. After the mark-all on open that is zero, so the new row sits
       at the top under the existing Earlier heading, as every row does today.
   - **`resync` events:** call `void loadFirstPageAndMarkRead()`, unless `isFirstPageLoadingRef`
     (item 3) is true. It already marks all read and reloads the first page. The skip covers the
     cold start where the focus load and the stream's first open land together.
   - **`read` events:** ignore them. Rows show no per-row read styling.
3. **Rows that arrive during a load.** In `loadFirstPageAndMarkRead`:
   - set a ref flag `isFirstPageLoadingRef` true before `markRead` and clear
     `liveRowsDuringLoadRef`;
   - after the list returns, fold each held row in with `prependLiveNotification`, oldest first,
     so the newest ends at the top;
   - then set state and the cache, and clear the flag in `finally`.

   This keeps a row that arrived after the server built the page.
4. **No scroll anchoring.** Prepend into the list as it is. Do not add
   `maintainVisibleContentPosition`. A user scrolled down sees the new row when they scroll back
   to the top.
5. **Empty state.** A live row on an empty inbox replaces `ListEmpty` with the list, because
   `hasRows` becomes true. Nothing else is needed.

Keep the existing `emitNotificationsReadEvent` replacement from plan 40 (`setNotificationUnreadCount(0)`
after `markRead`).

## Session reset (`SyncProvider.tsx`)

In the `status === 'anonymous'` effect, call `resetNotificationsInboxCache()` beside plan 40's
`resetNotificationStreamStore()`. Without it, the next account's inbox opens on the last account's
cached rows in Offline Mode (**mobile-account-scoped-data**).

## Tests

- `apps/mobile/src/notifications/notificationsInboxCache.test.ts`:
  - `prependLiveNotification` puts a new id first and keeps the rest in order;
  - it returns the same contents when the id is already present;
  - get, set, and reset round-trip.

  Build `DTOAccountNotification` fixtures with every required field; no `as`.
- `apps/mobile/vitest.config.ts`: add the test to `include`, and name the module in the header
  comment's covered-modules list.
- No Maestro change. Nothing in E2E can create a notification while the inbox is open. Plan 40's
  marker step in `notifications-inbox.yaml` already proves the stream opens on this screen's
  flow, and the merge rule is unit-tested.

## Release scratchpad

```markdown
## Mobile inbox shows new notifications live

- Surfaces: mobile
- Change: while the Notifications inbox is open, a new notification appears at the top of the
  list as it arrives and is marked read at once, so the badge does not light while the inbox is
  on screen. After a reconnect that may have missed rows, the inbox reloads its first page. The
  cached inbox used in Offline Mode is cleared at sign-out.
- Who notices: signed-in mobile users with the inbox open
- Operator steps: none
```
