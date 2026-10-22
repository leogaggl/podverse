**Cursor model:** Cursor Grok 4.7 · **Reasoning:** extra high

# 33 — Web: a push tap marks that notification read; no popup on the inbox

Clicking a web push popup marks only that notification read, whether the service worker showed it
(no focused tab) or the page did (focused tab). A focused tab on the Notifications page shows no
popup, since the new row appears there live (plan 32). The plan also fixes the service worker's
push handler, which extends the event's lifetime too late.

Other work is landing in the tree. Before editing, confirm these still exist and adjust anchors if
they moved: the `push` and `notificationclick` listeners in `apps/web/public/webpush-sw.js`;
`handleForegroundPush`, `toSameOriginPath`, and the push-registration `init` in
`apps/web/src/contexts/Notifications.tsx`; `navigator.serviceWorker.register('/webpush-sw.js')` in
`apps/web/src/lib/notifications/webpush/requestNotificationPermission.ts`; plan 21's
`reqNotificationsMarkReadByItem` on `ApiRequestService` and its route
`POST /account/notifications/mark-read-by-item`; plan 30's `getClientApiBaseUrl`; and plan 31's
`setUnreadCount` reach inside `NotificationsProvider` (the value returned by
`useNotificationsUnreadCount`).

## Rows

R30, R34 (the skipped popup; plan 32 covers the live row)

## Runs after

21, 30, 31

## Files

apps/web/public/webpush-sw.js
apps/web/src/lib/notifications/webpush/webPushServiceWorkerUrl.ts
apps/web/src/lib/notifications/webpush/webPushServiceWorkerUrl.test.ts
apps/web/src/lib/notifications/webpush/foregroundPush.ts
apps/web/src/lib/notifications/webpush/foregroundPush.test.ts
apps/web/src/lib/notifications/webpush/requestNotificationPermission.ts
apps/web/src/lib/notifications/webpush/requestNotificationPermission.test.ts
apps/web/src/contexts/Notifications.tsx
release-notes/scratchpad.md

## Facts this plan relies on

- The web push body is `{ title, body, image, link, data }`
  (`packages/notifications/src/services/webpush/webpushNotification.ts`), and `data` holds
  `itemIdText`, `channelIdText`, `type`, and `link_path`
  (`notificationOrchestrator.ts`). There is no notification id. Plan 21's by-item endpoint takes
  `{ item_id_text, type }` from exactly these keys.
- The API is on another host than the web app (`config.public.api.client`). Its auth cookie is
  `SameSite=Lax` on a shared parent domain in production, and its CORS allows credentials from the
  web origin, so a credentialed `fetch` from the service worker carries the session.

## Decisions this plan fixes

- **The service worker marks the notification read itself on click.** It is the only code that
  runs for every click, including one that opens a new window. The page cannot be relied on there:
  its message listener attaches after hydration, so a message sent at navigation can be lost.
- **The worker learns the API base from its own script URL.** The page registers
  `/webpush-sw.js?api_base=<encoded base>`. On every load with permission granted, the page
  re-registers when an existing registration's script URL differs, so users who enabled push
  earlier get the parameter. Re-registering the same scope keeps the push subscription. Without
  the parameter, the worker skips marking and still opens the link.
- **The worker uses `fetch`.** A static file in `public/` cannot import `@podverse/helpers-requests`.
  A one-line comment says so.
- **A page-shown popup marks read through the request helper** and sets the badge from the
  response's `unread_count`, so the badge updates even while the stream is down.
- **The focused tab decides whether to show the popup**, using `window.location.pathname`, which
  is current after client-side navigation. The worker keeps posting to the focused tab.
- **Chrome on Android fallback.** When the page-level `Notification` constructor throws, the page
  shows the popup through the service worker registration instead, with the data shape the
  worker's click handler reads. This keeps the operator's "web push stays the popup" true there.
- **Popups for the same item and type replace each other** (`tag` built from them) instead of
  stacking. Without both values, the tag stays unique per push, as today.

## Changes

### `webPushServiceWorkerUrl.ts`

```typescript
export const WEB_PUSH_SERVICE_WORKER_PATH = '/webpush-sw.js';
/** Read by `public/webpush-sw.js`; the two must match. */
export const WEB_PUSH_SERVICE_WORKER_API_BASE_PARAM = 'api_base';

export function buildWebPushServiceWorkerUrl(apiBaseUrl: string): string;
export async function ensureWebPushServiceWorkerScriptUrl(apiBaseUrl: string): Promise<void>;
```

- `buildWebPushServiceWorkerUrl` returns
  `${WEB_PUSH_SERVICE_WORKER_PATH}?api_base=${encodeURIComponent(apiBaseUrl)}`.
- `ensureWebPushServiceWorkerScriptUrl`: return when `'serviceWorker' in navigator` is false. Get
  `navigator.serviceWorker.getRegistration(WEB_PUSH_SERVICE_WORKER_PATH)`; return when none. Take
  the script URL of `registration.active ?? registration.waiting ?? registration.installing`.
  When it equals `new URL(buildWebPushServiceWorkerUrl(apiBaseUrl), window.location.origin).href`,
  return. Otherwise `await navigator.serviceWorker.register(buildWebPushServiceWorkerUrl(apiBaseUrl))`.
  Catch any error and `console.warn` it with context; never throw.

### `requestNotificationPermission.ts`

Register with `buildWebPushServiceWorkerUrl(getClientApiBaseUrl())` instead of the literal path.
`getClientApiBaseUrl` comes from `'../../../factories/apiRequestService'`, already imported there.

### `foregroundPush.ts`

```typescript
export type PushMarkReadParams = { item_id_text: string; type: string };

export type ForegroundPushNotification = {
  title: string;
  body: string;
  icon: string | undefined;
  image: string | undefined;
  link: string;
  markRead: PushMarkReadParams | null;
};

/** Reads a `PUSH_NOTIFICATION` message posted by the service worker; null for anything else. */
export function readForegroundPushMessage(value: unknown): ForegroundPushNotification | null;

/** The focused tab skips the popup on the Notifications page, where the row appears live. */
export function shouldShowForegroundPushPopup(pathname: string): boolean;

/** Options for `registration.showNotification`, with the `data` shape the worker's click handler reads. */
export function buildForegroundPushNotificationOptions(
  notification: ForegroundPushNotification
): NotificationOptions;
```

- `readForegroundPushMessage`: narrow `unknown` with `typeof` / `in` checks, no `as`. Return null
  unless `value.type === 'PUSH_NOTIFICATION'` and `value.payload` is an object with a non-empty
  string `title`. `body` defaults to `''`, `link` to `'/'`, `icon` and `image` to undefined when
  not strings. `markRead` is set only when `payload.data.itemIdText` and `payload.data.type` are
  both non-empty strings.
- `shouldShowForegroundPushPopup` returns `pathname !== ROUTES.NOTIFICATIONS`
  (`'../../../constants/routes'`).
- `buildForegroundPushNotificationOptions` returns `body`, `icon`, `image` (only when set),
  `badge: '/favicon/favicon-96x96.png'`, `tag` (see the worker below), and
  `data: { url: link, itemIdText, type }` with null for the two ids when `markRead` is null.

### `Notifications.tsx`

- `handleForegroundPush(event: MessageEvent<unknown>)`:
  1. `const notification = readForegroundPushMessage(event.data);` return when null.
  2. Return when `!shouldShowForegroundPushPopup(window.location.pathname)`.
  3. Return when `Notification.permission !== 'granted'`.
  4. In `try`: `new Notification(title, { body, icon, data: { url: link } })`. Its `onclick` keeps
     today's navigation (`toSameOriginPath`, `router.push`, `window.location.assign`) and, first,
     calls `markPushNotificationRead(notification.markRead)` when it is not null.
  5. In `catch`: `navigator.serviceWorker.getRegistration(WEB_PUSH_SERVICE_WORKER_PATH)` then
     `registration?.showNotification(title, buildForegroundPushNotificationOptions(notification))`,
     with its own `.catch` that warns. Comment: Chrome on Android allows notifications only
     through the service worker registration.
- `markPushNotificationRead(params)`: a `useCallback` that calls
  `getApiRequestService().reqNotificationsMarkReadByItem(params)`, then
  `setUnreadCount(response.unread_count)`; ignore errors. Add it to `handleForegroundPush`'s deps.
- In the push-registration `init`, right after `setPermission(p)`: when `p === 'granted'`,
  `void ensureWebPushServiceWorkerScriptUrl(getClientApiBaseUrl());`.
- Replace the literal `'/webpush-sw.js'` in this file with `WEB_PUSH_SERVICE_WORKER_PATH`.
- Remove the hardcoded English `'Notification'` title fallback; a push with no title shows no
  popup from the page.

### `apps/web/public/webpush-sw.js`

Plain JavaScript, no imports. Keep the file's existing style.

- At the top, read the API base once:
  `const API_BASE_URL = readApiBaseUrl();`, where `readApiBaseUrl()` takes
  `new URL(self.location.href).searchParams.get('api_base')`, returns null when missing, parses it
  with `new URL` inside `try`, and returns it without a trailing slash only when the protocol is
  `https:` or `http:`. Comment that the page sets this parameter when it registers the worker.
- `push`: register a synchronous listener that calls `event.waitUntil(handlePush(event))`. Move
  today's body into `async function handlePush(event)`. Parse `event.data.json()` inside its own
  `try`, defaulting to `{}`. Post to focused clients and return, as today. Otherwise build the
  options with `data: { url: data.link || '/', itemIdText, type }`, where `itemIdText` and `type`
  are read from `data.data` when they are non-empty strings and are null otherwise, and
  `tag: itemIdText && type ? 'podverse-notification-' + type + '-' + itemIdText : 'podverse-notification-' + Date.now()`.
  `await self.registration.showNotification(...)`. Keep the outer `try` / `console.error`.
- Add `function markNotificationRead(notificationData)`: resolve immediately when `API_BASE_URL`
  is null or either id is not a non-empty string; otherwise `fetch` `POST
  ${API_BASE_URL}/account/notifications/mark-read-by-item` with `credentials: 'include'`,
  `Content-Type: application/json`, and body `{ item_id_text, type }`, ending in
  `.catch(() => undefined)`.
- `notificationclick`: keep the window logic, and wrap it so the event waits for both:
  `event.waitUntil(Promise.all([openTarget, markNotificationRead(event.notification.data)]))`.
- `activate` is unchanged.

## Must stay true

- A click opens the same page it opens today.
- A click marks only the notification the push was about, and never fails the navigation.
- The focused tab on `/notifications` shows no popup; every other focused tab still does.
- Users who enabled push before this change keep their subscription.

## Tests

Unit (Vitest, jsdom). The service worker file has no unit test; its logic is small and its
contract is pinned by the helper tests and plan 21's endpoint tests.

- `webPushServiceWorkerUrl.test.ts` (stub `navigator.serviceWorker` the way
  `requestNotificationPermission.test.ts` does):
  - The built URL encodes the base (`/webpush-sw.js?api_base=http%3A%2F%2Flocalhost%3A4030%2Fapi%2Fv2`).
  - No registration: `register` is not called.
  - Active script URL already equal: `register` is not called.
  - Different script URL (`/webpush-sw.js`): `register` is called once with the built URL.
  - `register` rejects: resolves and warns.
- `foregroundPush.test.ts`:
  - A full message reads into the expected object with `markRead` set.
  - A non-`PUSH_NOTIFICATION` type, a missing payload, or an empty title returns null.
  - Missing `type` in `data` gives `markRead: null`.
  - `shouldShowForegroundPushPopup('/notifications')` is false; `'/'` and `'/episode/abc'` are
    true.
  - The options' `data` carries `url`, `itemIdText`, and `type`; the tag is stable for the same
    item and type.
- `requestNotificationPermission.test.ts`: add `getClientApiBaseUrl: vi.fn(() => 'http://localhost:4030/api/v2')`
  to the `'../../../factories/apiRequestService'` mock factory, and assert in the success test that
  `register` was called with the built URL.

## Release scratchpad

```markdown
## Web push click marks that notification read

- Surfaces: web
- Change: clicking a web push popup marks only that notification read
  (`POST /account/notifications/mark-read-by-item` with the push's item id and type), so the bell
  clears for it on every device without visiting the Notifications page. This works for popups
  shown by the service worker and by a focused tab. A focused tab on the Notifications page no
  longer shows a popup, because the new row appears there live. Repeated pushes for the same item
  and type replace each other instead of stacking. The service worker is now registered as
  `/webpush-sw.js?api_base=<API base URL>`; existing registrations are updated on the next visit
  with notifications allowed, and keep their subscription. The worker's push handler now extends
  the event lifetime correctly. On Chrome for Android, a focused tab now shows the popup through
  the service worker instead of failing silently.
- Who notices: web users with push enabled.
- Operator steps: none. The API's CORS must keep allowing credentialed requests from the web
  origin, which it already does.
```
