**Cursor model:** Cursor Grok 4.7 · **Reasoning:** high

# 32 — Web: live Notifications inbox

While the Notifications page is open, a new notification appears at the top of the list without a
reload, under the Unread heading. The page also starts showing which rows were unread when it
opened, which it never did: it ran Mark All as Read before loading the list, so every row arrived
already read.

Other work is landing in the tree. Before editing, confirm these still exist and adjust anchors if
they moved: `NotificationsPageClient`, `loadPage`, `partitionedRows`, and `NotificationRow` in
`apps/web/src/app/notifications/NotificationsPageClient.tsx`; plan 31's
`subscribeToNotificationStream` on `useNotifications()`; plan 21's `reqNotificationsMarkReadOne`
on `ApiRequestService`; and plan 31's `mockNotificationStream` / `sseEvent` helpers in
`apps/web/e2e/notifications-inbox.spec.ts`.

## Rows

R33, R34 (the live row; plan 33 covers the skipped popup)

## Runs after

31, 21

## Files

apps/web/src/app/notifications/NotificationsPageClient.tsx
apps/web/src/app/notifications/notificationsInboxRows.ts
apps/web/src/app/notifications/notificationsInboxRows.test.ts
apps/web/e2e/notifications-inbox.spec.ts
release-notes/scratchpad.md

## Decisions this plan fixes

- **Load the list first, then Mark All as Read.** Rows unread at open keep `is_unread: true` and
  show under Unread for this visit. The badge still clears on open, as today.
- **Sections are fixed for the visit.** A row stays in the section it arrived in. The page does
  not apply `notification.read` events to its rows, so its own Mark All as Read (and reads on
  other devices) do not shuffle rows from Unread to Earlier while the user is reading. The badge
  is what reflects read state live (plan 31).
- **A live row on a visible inbox is marked read on its own.** The user is looking at it, which is
  the same reason opening the page marks everything read. The page calls
  `reqNotificationsMarkReadOne(id)`, so the badge on every device clears for that row only. In a
  hidden tab (inbox open in the background), the ids wait and are marked when the tab becomes
  visible, so a notification nobody has seen does not clear the badge in the tab the user is in.
- **Live rows go only onto page 1.** On a later page, a created event changes nothing in the list;
  the row is there when the user returns to page 1. The badge still updates.
- **No trimming.** Page 1 may hold more than 20 rows after live inserts until the next load.

## Changes

### `notificationsInboxRows.ts`

```typescript
import type { DTOAccountNotification } from '@podverse/helpers';

/**
 * Adds a row received live, keeping newest first (created_at descending, then id descending).
 * Returns the same array when a row with that id is already present.
 */
export function insertLiveNotificationRow(
  items: DTOAccountNotification[],
  row: DTOAccountNotification
): DTOAccountNotification[];
```

Compare `created_at` with `Date.parse`; fall back to id order when either parse is `NaN`.

### `NotificationsPageClient.tsx`

- Read `subscribeToNotificationStream` from `useNotifications()` (`'../../contexts/Notifications'`).
- Refs: `liveRowsRef` (rows received this visit, `DTOAccountNotification[]`),
  `pendingMarkIdsRef` (`Set<number>`), `markingIdsRef` (`Set<number>`, the in-flight guard per
  **input-rate-control**), and `pageRef` mirroring `state.page`.
- `markLiveRowsRead()`: when `document.visibilityState === 'visible'`, for each id in
  `pendingMarkIdsRef` not in `markingIdsRef`, move it to `markingIdsRef`, call
  `getApiRequestService().reqNotificationsMarkReadOne(id)`, and remove it from `markingIdsRef`
  when settled. Ignore errors: a 404 means the row is gone, and a failed call leaves the badge to
  the next stream event or poll. Do not retry.
- `loadFirstPageAndMarkRead()` replaces the body of the initial `load`: `await loadPage(1)`, then
  merge `liveRowsRef.current` into the loaded items with `insertLiveNotificationRow` (a row that
  arrived during the fetch is not lost when `setState` replaces the list), then
  `await reqNotificationsMarkRead()` and `emitNotificationsReadEvent()`. Keep the `cancelled`
  guard and the loading flag as today. A Mark All as Read failure must not hide the loaded list:
  wrap it in its own `try` and ignore the error.
- Subscribe in an effect (empty deps besides the stable subscribe function); unsubscribe in
  cleanup:
  - `notification.created`: push `event.data.notification` into `liveRowsRef`; when
    `pageRef.current === 1`, `setState` with `insertLiveNotificationRow`; add the id to
    `pendingMarkIdsRef` and call `markLiveRowsRead()`.
  - `notification.resync`: when `pageRef.current === 1`, run `loadFirstPageAndMarkRead()` again.
  - `notification.state` and `notification.read`: nothing (the badge handles them).
- A `visibilitychange` listener calls `markLiveRowsRead()` when the tab becomes visible.
- `onPageChange` keeps calling `loadPage(page)` only. Returning to page 1 reloads it, which
  includes any rows that arrived meanwhile.
- `partitionedRows` keeps partitioning by `row.is_unread`. Rows are never mutated by read events,
  so a row stays where it arrived. Put that constraint in a short comment above the memo.

## Must stay true

- Opening the page still clears the badge (Mark All as Read still runs on open).
- A row never appears twice, including when replay resends it after a reconnect.
- A hidden inbox tab never marks a live row read.

## Tests

### Unit — `notificationsInboxRows.test.ts`

- A newer row goes first; an older row goes after newer ones; equal `created_at` orders by id
  descending.
- A duplicate id returns the same array reference.

### Playwright — `apps/web/e2e/notifications-inbox.spec.ts`

Use plan 31's `mockNotificationStream` and `sseEvent`.

- Update the first existing test: the page now loads the list before Mark All as Read. Make the
  list mock return `mockNotification` with `is_unread: true`, and expect
  `getByRole('heading', { level: 2, name: 'Unread' })` visible and the row under it. Keep the
  badge-clears assertion.
- New test in the "Live notification stream" describe: "When a new notification arrives while the
  inbox is open, it appears at the top under Unread and is marked read." List mock returns
  `mockNotification` (read). Stream bodies: first `retry: 100` + `notification.state` (count 0);
  second waits on a gate opened after the existing row is visible, then `retry: 600000` +
  `notification.created` (`id: 960`, title `'New episode just dropped'`, `is_unread: true`,
  `unread_count: 1`). Route `**/api/v2/account/notifications/960/mark-read` and record the call,
  fulfilling `{ data: { marked_ids: [960], unread_count: 0 } }`. Expect the level-3 heading
  `'New episode just dropped'` visible and before `mockNotification.title` in the DOM, the Unread
  heading visible, and the mark-read route called once (`expect.poll`). Register the per-id route
  so the spec's catch-all does not take it (it does not, since `*` stops at `/`; register it
  anyway for clarity).

## Release scratchpad

```markdown
## Web Notifications inbox updates live

- Surfaces: web
- Change: on the Notifications page, a new notification appears at the top under Unread as soon
  as it is created, without a reload. While the page is visible, that notification is marked read
  on its own (`POST /account/notifications/:id/mark-read`), so the bell clears on every device; in
  a background tab it is marked when the tab becomes visible. The page now loads the list before
  marking everything read, so notifications that were unread when the page opened show under
  Unread for that visit instead of always appearing under Earlier.
- Who notices: logged-in web users with the inbox open.
- Operator steps: none.
```
