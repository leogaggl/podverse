**Cursor model:** Cursor Grok 4.7 · **Reasoning:** extra high

# 71 — Web: the stream's session-ended event signs the page out at once

Plan 70 makes the account event stream send a last `session.ended` event, `{ notice }`, when the
browser's session is ended elsewhere. This plan makes the web stream client act on it. Every open
tab of that browser signs out and shows the same "You've Been Signed Out" dialog that plans 31 and
33 show. That happens right away, with no navigation, and does not wait for the page's next API
request.

Plan numbers 70 and above are this set; lower numbers name plans of the `auth-sessions` set, now
in `.llm/plans/completed/auth-sessions/`. "Realtime plan N" names plans of the
`realtime-banner-notifications` set.

Web holds one stream per browser profile, shared across tabs (realtime plan 30). The leader tab
relays every raw event to the other tabs, so all of them receive `session.ended`.

## Rows

R34

## Runs after

70, and the `auth-sessions` set (its plan 33 is the one this plan builds on).

This plan also needs realtime plans 30 and 31 (the web stream client and its wiring in the
Notifications context). If
`apps/web/src/lib/notifications/stream/notificationStreamCoordinator.ts` does not exist, stop and
report.

## Files

- apps/web/src/lib/notifications/stream/notificationStreamConnection.ts
- apps/web/src/lib/notifications/stream/notificationStreamConnection.test.ts
- apps/web/src/lib/notifications/stream/notificationStreamCoordinator.ts
- apps/web/src/lib/notifications/stream/notificationStreamCoordinator.test.ts
- apps/web/src/contexts/Notifications.tsx
- apps/web/src/lib/auth/sessionEndedNotice.ts
- apps/web/src/lib/auth/sessionEndedNotice.test.ts
- apps/web/e2e/web-session-ended-notice.spec.ts

## Before you start

Confirm these exist. Each file has been edited by earlier prompts, so re-read the parts named
here before editing:

- `@podverse/helpers` exports `ACCOUNT_SESSION_STREAM_EVENT`, `parseAccountSessionStreamEvent`,
  and `AuthSessionEndedNotice` (plans 70 and 20).
- `notificationStreamConnection.ts` has `openNotificationStreamConnection`, the listener loop over
  `ACCOUNT_NOTIFICATION_STREAM_EVENT`, and `close()`.
- `notificationStreamCoordinator.ts` has `startNotificationStreamCoordinator`,
  `NotificationStreamCoordinatorOptions`, and the function that delivers an event locally (it
  calls `parseAccountNotificationStreamEvent`).
- `apps/web/src/contexts/Notifications.tsx` has the effect keyed on `accountId` that calls
  `startNotificationStreamCoordinator`.
- `apps/web/src/lib/auth/sessionEndedNotice.ts` has `reportSessionEndedError`,
  `setSessionEndedHandler`, `isHandlingSessionEnded`, and `defaultSessionEndedHandler` (plan 33).
- `apps/web/e2e/helpers/accountSessions.ts` has `loginSessionsUser`, `endOtherSessions`,
  `newOtherDeviceRequest`, and `FIREFOX_WINDOWS_USER_AGENT` (plans 30 and 31).

## Decisions (transcribe, do not revisit)

- **A notice stops the stream; a null notice does not.** When `session.ended` carries a notice,
  the connection closes its `EventSource` so the browser does not reconnect into a 401, and every
  tab signs out with that notice. A null notice means this browser signed itself out or replaced
  its own session with a new login. The connection then does nothing extra: the server ends the
  response, `EventSource` reconnects after the server's `retry: 5000`, and that reconnect succeeds
  with the new cookie or fails into the existing `down` handling.
- **Signing out reuses plan 33's path.** The stream calls a new `reportSessionEnded(notice)`. It
  shares the once-per-page flag and the registered handler with `reportSessionEndedError`. So the
  stream event and a refused request that arrive together sign the page out once.
- **Every tab acts, not only the leader.** Each tab's coordinator parses the relayed raw event and
  calls its own `onSessionEnded`. Each tab saves the notice in its own `sessionStorage`, signs out,
  and reloads. Logout always returns 200, so several tabs calling it is harmless.
- **The leader keeps the lock after closing the connection.** The page is about to reload, and a
  follower taking over would open a stream that is refused.

## `notificationStreamConnection.ts`

- Import `ACCOUNT_SESSION_STREAM_EVENT` and `parseAccountSessionStreamEvent` from
  `@podverse/helpers`.
- After the loop that adds one listener per `ACCOUNT_NOTIFICATION_STREAM_EVENT` value, add one
  listener for `ACCOUNT_SESSION_STREAM_EVENT.ended`. It:
  1. forwards `{ eventName, rawData: event.data, lastEventId: null }` through `onRawEvent`,
     exactly as the other listeners forward;
  1. then runs `const parsed = parseAccountSessionStreamEvent(eventName, event.data)`, and when
     `parsed !== null && parsed.data.notice !== null`, calls the connection's own `close()`. That
     clears any retry timer, closes the `EventSource`, removes the handlers, and reports `off`.
- Update the type comment on `RawNotificationStreamEvent` to say that it carries every
  `notification.*` and `session.*` event the stream sends.

## `notificationStreamCoordinator.ts`

- Add to `NotificationStreamCoordinatorOptions`:

  ```typescript
  /** Called in this tab when the stream reports that this browser's session was ended elsewhere. */
  onSessionEnded?: (notice: AuthSessionEndedNotice) => void;
  ```

  Use `import type { AuthSessionEndedNotice } from '@podverse/helpers'`.
- In the function that delivers an event locally, which both the leader and followers use, keep
  the notification parse as it is, then add:

  ```typescript
  const sessionEvent = parseAccountSessionStreamEvent(eventName, rawData);
  if (sessionEvent !== null && sessionEvent.data.notice !== null) {
    options.onSessionEnded?.(sessionEvent.data.notice);
  }
  ```

- The leader's relay is unchanged. It already posts every raw event the connection forwards, and
  followers deliver it through the same function. A follower ignores messages tagged with another
  `accountId`, as it does today.

## `apps/web/src/contexts/Notifications.tsx`

In the effect that calls `startNotificationStreamCoordinator`, add
`onSessionEnded: reportSessionEnded` to its options. Import `reportSessionEnded` from
`'../lib/auth/sessionEndedNotice'`, using the same relative style as the file's other imports. No
other change in this file.

## `apps/web/src/lib/auth/sessionEndedNotice.ts`

Split `reportSessionEndedError`:

```typescript
/**
 * Signs the page out with this notice. Acts once per page, shared with `reportSessionEndedError`.
 */
export function reportSessionEnded(notice: AuthSessionEndedNotice): void {
  if (typeof window === 'undefined' || isHandlingSessionEnded) {
    return;
  }
  isHandlingSessionEnded = true;
  void (sessionEndedHandler ?? defaultSessionEndedHandler)(notice);
}

export function reportSessionEndedError(error: unknown): void {
  const notice = parseAuthSessionEndedError(error);
  if (notice === null) {
    return;
  }
  reportSessionEnded(notice);
}
```

Keep the existing doc comment on `reportSessionEndedError`. Behavior for plan 33's callers does not
change.

## Tests

**Unit**, extending the existing files:

- `notificationStreamConnection.test.ts`, with the fake `EventSourceLike` and fake timers:
  - a `session.ended` message with data `{"notice":"signed_out_elsewhere"}` forwards the raw event,
    closes the source, reports `off`, and creates no new source after 5 minutes of fake time;
  - a `session.ended` message with data `{"notice":null}` forwards the raw event and leaves the
    source open (status stays `open`).
- `notificationStreamCoordinator.test.ts`, with the in-memory lock manager and channel hub:
  - Two coordinators for account 1, each with an `onSessionEnded` spy. A `session.ended` raw event
    with notice `admin_force_logout` from the leader's fake connection calls both spies once with
    `admin_force_logout`. Neither `onEvent` is called for it.
  - The same event with `notice: null` calls neither spy.
  - A coordinator for account 2 on the same channel does not call its spy for account 1's event.
- `sessionEndedNotice.test.ts` (each case calls `vi.resetModules()` and imports fresh, as the file
  already does):
  - `reportSessionEnded('security')` calls the registered handler once with `security`. A later
    `reportSessionEndedError` with a `password_changed` 401 calls nothing.
  - A `reportSessionEndedError` first, then `reportSessionEnded`, calls the handler once.

**E2E**: add a case to `apps/web/e2e/web-session-ended-notice.spec.ts`. Write it in complete
sentences (**e2e-readability**):

**An open page signs out and says why as soon as another device ends its session.**

1. `loginSessionsUser(page.request)` and `endOtherSessions(page.request)`.
1. Start `const streamOpened = page.waitForResponse((response) =>
   response.url().includes('/account/events') && response.status() === 200)`, then
   `page.goto('/settings?tab=account')`, then `await streamOpened`. The "Signed-In Devices"
   heading is visible.
1. Open the other device with `newOtherDeviceRequest(playwright, FIREFOX_WINDOWS_USER_AGENT)` and
   call `endOtherSessions` on it. Do not click, navigate, or reload the page after this.
1. A dialog named "You've Been Signed Out" with the text "You were signed out from another
   device." is visible within `{ timeout: 15_000 }`. Capture it as the verified element
   (**e2e-screenshot-verified-element**), the way the spec's other cases do. The navbar shows
   Login.
1. Dispose the other device's request context.

Put this comment above the timeout, since the number alone does not say why:
`// Shorter than the 60-second unread-count poll, so only the stream event can pass this.`

The spec is already in `makefiles/local/e2e-spec-order-web.txt`. Do not change the order file.

## Release scratchpad

```markdown
## Web signs out at once when a session is ended elsewhere

- Surfaces: web
- Change: an open web page whose session is ended from another device, by an administrator, by a
  password change, or as suspected theft now signs out and shows the "You've Been Signed Out"
  dialog with the reason within a second or two, in every open tab of that browser. It no longer
  waits for the page's next request. The live account event stream delivers it.
- Who notices: web users who keep a tab open while signed out from elsewhere
- Operator steps: none
```
