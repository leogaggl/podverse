**Cursor model:** Cursor Grok 4.7 · **Reasoning:** extra high

# 31 — Web: live bell badge, cross-tab read sync, poll only while the stream is down

The Notifications context starts plan 30's stream coordinator for the logged-in account, owns the
unread count, and exposes stream events to screens. The NavBar bell reads the count from the
context, so a new notification or a read on any device or tab changes the badge within about a
second. The 60-second poll runs only while the stream is not open.

Other work is landing in the tree. Before editing, confirm these still exist and adjust anchors if
they moved: `NotificationsProvider`, `NotificationsContextType`, and `handleForegroundPush` in
`apps/web/src/contexts/Notifications.tsx`; `useNotificationsUnreadCount` and
`emitNotificationsReadEvent` in `apps/web/src/hooks/useNotificationsUnreadCount.ts`;
`NotificationBellButton` in `apps/web/src/components/NavBar/NotificationBellButton.tsx`; the two
tests in `apps/web/e2e/notifications-inbox.spec.ts`; and plan 30's
`startNotificationStreamCoordinator`, `NotificationStreamStatus`, and `getClientApiBaseUrl`.

## Rows

R1, R3, R4, R5, R26, R37, R39

## Runs after

30

## Files

apps/web/src/contexts/Notifications.tsx
apps/web/src/hooks/useNotificationsUnreadCount.ts
apps/web/src/hooks/__tests__/useNotificationsUnreadCount.test.tsx
apps/web/src/lib/notifications/stream/notificationStreamEventUnreadCount.ts
apps/web/src/lib/notifications/stream/notificationStreamEventUnreadCount.test.ts
apps/web/src/components/NavBar/NotificationBellButton.tsx
apps/web/e2e/notifications-inbox.spec.ts
release-notes/scratchpad.md

## Answers to the request's questions (web)

- **R1, what happens today when a notification arrives while the web app is open?** The service
  worker (`apps/web/public/webpush-sw.js`) checks for a focused tab. With one, it posts
  `PUSH_NOTIFICATION` to that tab, and `handleForegroundPush` shows a page-level
  `new Notification(...)` popup when permission is granted; a click soft-navigates to the link.
  Chrome on Android does not allow the page-level `Notification` constructor, so a focused tab
  there shows nothing (plan 33 adds a fallback). With no focused tab, the worker shows the popup
  itself. The bell badge changes only on the 60-second poll, on window focus, or after the inbox
  runs Mark All as Read, so it can lag by up to a minute. The inbox list loads once and never
  changes while open. A user who never enabled web push sees nothing until the next poll.
- **R3, a toast on web?** Settled by the operator: web push stays the popup and web adds no
  in-page toast. Nothing in this set adds one.
- **R5, is there a bell on the page?** Yes. `NotificationBellButton` sits in the NavBar's
  `trailingActions` for logged-in users, with a `CountBadge` whose accessible name is
  "{count} unread notifications" and which hides at zero. It links to `/notifications`. This plan
  keeps its placement and makes its count live.

## Decisions this plan fixes

- **The unread count moves into the Notifications context.** Today only the bell calls
  `useNotificationsUnreadCount`. The provider calls it once and the bell reads
  `useNotifications().unreadCount`, so every consumer agrees and the stream has one place to write.
- **Every stream event that carries `unread_count` sets the badge.** `notification.state`,
  `notification.created`, and `notification.read` all do; `notification.resync` does not.
- **Return to foreground means the tab becoming visible.** The hook refetches once on
  `visibilitychange` to `visible` and stops listening to window `focus` (R37). Reconnects need no
  extra request: plan 12 sends `notification.state` first on every connection.
- **Polling is the fallback only (R39).** The 60-second interval runs while the stream status is
  anything but `open`, and stops the moment it is `open`.
- **`emitNotificationsReadEvent` stays.** The inbox (plan 32) still calls it after Mark All as
  Read; the hook refetches on it, which matters while the stream is down.

## Changes

### `notificationStreamEventUnreadCount.ts`

```typescript
import type { AccountNotificationStreamEvent } from '@podverse/helpers';

/** The badge count an event carries, or null for events that carry none. */
export function getNotificationStreamEventUnreadCount(
  event: AccountNotificationStreamEvent
): number | null;
```

Exhaustive `switch (event.type)`: `notification.state`, `notification.created`, and
`notification.read` return `event.data.unread_count`; `notification.resync` returns null. No
default branch, so a new event type fails to compile here.

### `useNotificationsUnreadCount.ts`

New signature:

```typescript
type UseNotificationsUnreadCountOptions = {
  enabled: boolean;
  /** True while the notification stream is open; the poll runs only when false. */
  streamOpen: boolean;
};

export function useNotificationsUnreadCount(options: UseNotificationsUnreadCountOptions): {
  unreadCount: number;
  setUnreadCount: (count: number) => void;
};
```

- When `enabled` turns true: fetch once (`reqNotificationsUnreadCount`, as today, 0 on error).
- When `enabled` is false: count 0, no listeners.
- A separate effect keyed on `enabled` and `streamOpen` sets the 60-second interval only when
  `enabled && !streamOpen`, and clears it in cleanup.
- Listeners while enabled: `document` `visibilitychange` (refetch when
  `document.visibilityState === 'visible'`) and the existing `READ_EVENT_NAME` window event.
  Remove the window `focus` listener.
- Keep `POLL_INTERVAL_MS`, `READ_EVENT_NAME`, and `emitNotificationsReadEvent` as they are.
- Guard against a slow response overwriting a newer stream value: keep a `countVersionRef`
  incremented by `setUnreadCount`; a fetch applies its result only if the version did not change
  while it was in flight (**input-rate-control** § Concurrent async reads).

### `Notifications.tsx`

Add to `NotificationsContextType` and the default context value:

```typescript
unreadCount: number; // default 0
notificationStreamStatus: NotificationStreamStatus; // default 'off'
/** Subscribe to parsed stream events in this tab. Returns the unsubscribe function. */
subscribeToNotificationStream: (
  listener: (event: AccountNotificationStreamEvent) => void
) => () => void; // default () => () => {}
```

In `NotificationsProvider`:

- `const accountId = loggedInAccount?.id ?? null;`
- `const [notificationStreamStatus, setNotificationStreamStatus] = useState<NotificationStreamStatus>('off');`
- `const { unreadCount, setUnreadCount } = useNotificationsUnreadCount({ enabled: accountId !== null, streamOpen: notificationStreamStatus === 'open' });`
- `const streamListenersRef = useRef(new Set<(event: AccountNotificationStreamEvent) => void>());`
- `subscribeToNotificationStream` is a `useCallback` that adds the listener to the set and returns
  a function that deletes it.
- A new effect keyed on `accountId` (separate from the existing push-registration effect): when
  null, set status `off` and return. Otherwise call `startNotificationStreamCoordinator` with
  `accountId`, `apiBaseUrl: getClientApiBaseUrl()`, `onStatus: setNotificationStreamStatus`, and
  `onEvent` that sets the count when `getNotificationStreamEventUnreadCount(event)` is not null,
  then calls every listener in the set. Cleanup calls `stop()`.
- Pass the three new values in the provider `value`.

Leave `handleForegroundPush` and the push-registration effect as they are; plan 33 edits them.

### `NotificationBellButton.tsx`

Replace the `useNotificationsUnreadCount({ enabled: true })` call with
`const { unreadCount } = useNotifications();` imported from `'../../contexts/Notifications'`.
Nothing else changes; the bell already renders only for logged-in users.

## Must stay true

- Logged-out pages open no stream and make no unread-count request.
- With the stream open, no 60-second interval is running.
- The badge in every tab of the account reflects a read on any device or tab within one stream
  event.

## Tests

### Unit

- `notificationStreamEventUnreadCount.test.ts`: each of the four event types; resync returns null.
- `apps/web/src/hooks/__tests__/useNotificationsUnreadCount.test.tsx` (`renderHook` from
  `@testing-library/react`, fake timers, `getApiRequestService` mocked like the hook tests beside
  it):
  - Enabled with `streamOpen: false`: one fetch on mount and another after 60 s.
  - Rerender with `streamOpen: true`: advancing 120 s makes no further fetch.
  - `visibilitychange` with `visibilityState` visible refetches once; hidden does not.
  - `emitNotificationsReadEvent()` refetches.
  - `setUnreadCount(5)` while a fetch is pending keeps 5 when the fetch resolves with 2.
  - Disabled: count 0 and no fetch.

### Playwright — `apps/web/e2e/notifications-inbox.spec.ts`

Every logged-in page now opens `GET /api/v2/account/events`. The spec's catch-all
`**/api/v2/account/notifications*` does not match it, so the real E2E API would answer with the
real unread count. Mock the stream in every test.

Add file-local helpers:

```typescript
function sseEvent(name: string, data: unknown, id?: number): string {
  return `${id !== undefined ? `id: ${id}\n` : ''}event: ${name}\ndata: ${JSON.stringify(data)}\n\n`;
}

/** Serves `bodies[i]` to the i-th stream request; requests past the end get an idle body. */
async function mockNotificationStream(
  page: Page,
  bodies: Array<string | (() => Promise<string>)>
): Promise<{ requests: Request[] }>;
```

`mockNotificationStream` routes `**/api/v2/account/events*` and fulfills with
`status: 200`, `contentType: 'text/event-stream'`, headers `cache-control: no-cache`,
`access-control-allow-origin` set to the request's `origin` header, and
`access-control-allow-credentials: 'true'` (the stream is a credentialed cross-origin request to
the E2E API on port 4030). A function body is awaited first, so a test can hold a reconnect open
until it is ready. The idle body is `'retry: 600000\n\n'`. Each body starts with a `retry:` line:
`retry: 100` when the test wants a quick reconnect, `retry: 600000` when it wants none. The
helper records each request so tests can count them and read the `last-event-id` header. Use the
`Page` and `Request` types from `@playwright/test` with `import type`.

Existing tests: add `mockNotificationStream(page, ['retry: 600000\n\n' + sseEvent('notification.state', { unread_count: <the test's mocked count>, last_read_at: null })])`
before `loginE2eUser`, so the stream agrees with the mocked unread count.

New nested `test.describe('Live notification stream', …)` with verbose sentence titles
(**e2e-readability**, **e2e-suite-title**), each capturing a step screenshot on the verified
element (**e2e-screenshot-verified-element**):

1. "When a new notification arrives on the stream, the bell badge shows it without a reload."
   Unread-count mock returns 0. Stream bodies: first `retry: 100` + `notification.state`
   (count 0); second waits on a gate the test opens after asserting no badge on `/`, then returns
   `retry: 600000` + `notification.created` with `id: 950`, a full notification object (reuse the
   `mockNotification` shape with `id: 950`, `is_unread: true`), and `unread_count: 1`. Expect
   `getByRole('status', { name: '1 unread notifications' })` visible.
2. "When the notification is read on another device, the bell badge clears in every open tab."
   Unread-count mock returns 1. Open `/` in `page`, then a second page from `page.context()` at
   `/`. Stream bodies: first `retry: 100` + `notification.state` (count 1); second waits on a
   gate, then `retry: 600000` + `notification.read` `{ scope: 'one', notification_id: 950,
   unread_count: 0 }`. Expect the badge "1 unread notifications" in both pages, open the gate,
   expect it gone (`toHaveCount(0)`) in both. Expect exactly 2 stream requests in total: the
   second tab shared the first tab's stream instead of opening its own.
3. "When the stream reconnects after a new notification, it asks the server to replay from that
   notification." Stream bodies: first `retry: 100` + `notification.created` with `id: 951`
   (`unread_count: 1`); second `retry: 600000` + `notification.state` (count 1). Expect the
   second request's `last-event-id` header to be `'951'` (wait for 2 requests with
   `expect.poll`).

No new spec file, so `makefiles/local/e2e-spec-order-web.txt` needs no change.

## Release scratchpad

```markdown
## Web bell badge updates live

- Surfaces: web
- Change: the NavBar notification bell's unread badge now updates within about a second of a new
  notification, and clears in every open tab and on every device when a notification is read
  anywhere, using the account event stream (`GET /account/events`). All tabs
  of one account in a browser share a single stream: one tab holds it (Web Locks) and relays to
  the others (`BroadcastChannel`); browsers without those APIs open one stream per tab. The
  60-second unread-count poll now runs only while the stream is down, and the count is refetched
  once when a tab becomes visible again. When the stream fails with an HTTP error it is retried
  after 30 seconds, backing off to 5 minutes.
- Who notices: logged-in web users; the bell no longer lags behind new notifications.
- Operator steps: none beyond deploying the API stream. A proxy in front of the API must not
  buffer `text/event-stream`.
```
