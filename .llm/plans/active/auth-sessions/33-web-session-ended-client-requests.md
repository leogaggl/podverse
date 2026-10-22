**Cursor model:** Cursor Grok 4.7 · **Reasoning:** extra high

# 33 — Web: an open page notices its session was ended

Plan 31 shows the signed-out reason on the next page load. A web page can stay open for hours
(the media player keeps it alive), and the root layout does not run again on in-app navigation,
so an open page would keep showing the signed-in UI after its session was ended. With this plan,
the first request the browser makes that answers 401 with a signed-out notice signs the page out
and shows the same dialog (R44).

The hook is a small, optional listener on `ApiRequestService` in `@podverse/helpers-requests`. The
web browser instance uses it; the server-side instance and mobile do not.

## Rows

R44

## Runs after

22, 32

## Files

- packages/helpers-requests/src/api/_request.ts
- packages/helpers-requests/src/api/apiRequestServiceOnRequestError.test.ts
- apps/web/src/factories/apiRequestService.ts
- apps/web/src/lib/auth/sessionEndedNotice.ts
- apps/web/src/lib/auth/sessionEndedNotice.test.ts
- apps/web/src/components/Auth/SessionEndedNotice.tsx
- apps/web/e2e/web-session-ended-notice.spec.ts

## Before you start

Confirm: `parseAuthSessionEndedError` is exported from `@podverse/helpers-requests` and
`apps/web/src/lib/auth/sessionEndedNotice.ts` has `storePendingSessionEndedNotice` (plan 31);
`apps/web/src/lib/auth/signOutThisBrowser.ts` exists (plan 32). `_request.ts` is about 1,600 lines:
find `export class ApiRequestService`, `async apiRequest<T>(`, and `async
apiRequestWithHeaders<T>(` with Grep and read windows around them (**large-file-reading**).

## `ApiRequestService` listener (`packages/helpers-requests/src/api/_request.ts`)

- Constructor params gain:

  ```typescript
  /**
   * Called with every error a request from this service throws, before it reaches the caller.
   * The caller still receives the original error; a listener that throws is ignored.
   */
  onRequestError?: (error: unknown) => void;
  ```

  Store it in a `private onRequestError?: (error: unknown) => void;` field.
- Add a private method `reportRequestError(error: unknown): void` that calls the listener inside
  `try { … } catch { … }` and ignores what it throws.
- `apiRequest`: call `this.reportRequestError(error)` directly before its `throw error;`.
- `apiRequestWithHeaders` returns the `requestWithHeaders` promise without awaiting it, so its
  `catch` block never sees a rejected request. Keep that (so its logging stays as it is today) and
  attach the listener to the promise:

  ```typescript
  return requestWithHeaders<T>(`${this.apiBase}${path}`, options, abort).catch((error: unknown) => {
    this.reportRequestError(error);
    throw error;
  });
  ```

  Also call `this.reportRequestError(error)` before the `throw error;` at the end of its existing
  `catch`, for errors thrown while building the request.

No other method changes. Every existing constructor call keeps working (the option is optional).

## `apps/web/src/lib/auth/sessionEndedNotice.ts`

Add:

```typescript
export type SessionEndedHandler = (notice: AuthSessionEndedNotice) => Promise<void>;

/** The mounted app registers how to sign out; null restores the default (save notice, reload). */
export function setSessionEndedHandler(handler: SessionEndedHandler | null): void;

/**
 * `onRequestError` for the browser's ApiRequestService. Acts once per page: the first refused
 * request with a signed-out notice signs the page out; later ones are ignored.
 */
export function reportSessionEndedError(error: unknown): void;
```

- Module state: `let sessionEndedHandler: SessionEndedHandler | null = null;` and `let
  isHandlingSessionEnded = false;`.
- `reportSessionEndedError`: return when `typeof window === 'undefined'`. `const notice =
  parseAuthSessionEndedError(error)`; return when null or when already handling. Set the flag,
  then `void (sessionEndedHandler ?? defaultSessionEndedHandler)(notice)`.
- `defaultSessionEndedHandler` (module-private): `storePendingSessionEndedNotice(notice)` then
  `window.location.reload()`. It runs when no app chrome is mounted (the terms or popularity gate).

The flag never resets: every path ends in a reload.

## `apps/web/src/factories/apiRequestService.ts`

In `getApiRequestService` only, pass `onRequestError: reportSessionEndedError` to the constructor.
`getSSRApiRequestService` stays as it is: on the server, the root layout already reads the notice
(plan 31).

## `apps/web/src/components/Auth/SessionEndedNotice.tsx`

Add `useAccount()` and a second effect that registers the handler for the mounted app:

```typescript
const accountIdText = loggedInAccount?.id_text ?? null;

useEffect(() => {
  setSessionEndedHandler(async (endedNotice) => {
    storePendingSessionEndedNotice(endedNotice);
    await signOutThisBrowser(accountIdText);
  });
  return () => {
    setSessionEndedHandler(null);
  };
}, [accountIdText]);
```

`signOutThisBrowser` clears this browser's Add by RSS credentials for the account, calls logout
(which clears the cookie whether or not the 401 already did), and reloads. After the reload the
existing mount effect shows the dialog.

## Tests

**Unit:**

- `packages/helpers-requests/src/api/apiRequestServiceOnRequestError.test.ts`:
  `vi.mock('../_request.js')` so `request` and `requestWithHeaders` are `vi.fn`. Construct
  `ApiRequestService` with `onRequestError` as a spy. Cases, for both `apiRequest` and
  `apiRequestWithHeaders`: a rejected request rejects with the same error object and calls the
  spy once with it; a listener that throws still rejects with the original error; a resolved
  request does not call the spy; a service built without the option rejects normally.
- `apps/web/src/lib/auth/sessionEndedNotice.test.ts` (extend). The module holds state, so each
  case calls `vi.resetModules()` and imports the module fresh:
  - a 401 error with notice `security` calls the registered handler once with `security`; a
    second such error does not call it again;
  - a 401 without a notice, and a 500, call nothing;
  - with no handler registered, the notice is stored in `sessionStorage` and
    `window.location.reload` is called (replace `window.location` with an object whose `reload`
    is a `vi.fn`, through `Object.defineProperty`, and restore it after).

**E2E** — add a case to `apps/web/e2e/web-session-ended-notice.spec.ts`:

**An open page signs out and says why when its next request from the browser is refused.**

1. `loginSessionsUser(page.request)`, `endOtherSessions(page.request)`,
   `page.goto('/settings?tab=account')`; the "Signed-In Devices" heading is visible.
1. Open the other device (`newOtherDeviceRequest` with `FIREFOX_WINDOWS_USER_AGENT`) and call
   `endOtherSessions` on it.
1. Start `page.waitForResponse` for a response whose URL ends with `/auth/sessions` and whose
   status is 401, click the "General" tab, then the "Account" tab (in-app navigation; the list
   loads again from the browser), and await the response.
1. A dialog named "You've Been Signed Out" with "You were signed out from another device."
   appears (capture it as the verified element); the navbar shows Login.
1. Dispose the other device's request context.

## Release scratchpad

```markdown
## Web notices an ended session without a reload

- Surfaces: web, helpers-requests
- Change: an open web page whose session was ended elsewhere signs out on its next request to the
  API that is refused with a signed-out notice, then shows the same "You've Been Signed Out"
  dialog as a fresh page load. `ApiRequestService` in `@podverse/helpers-requests` accepts an
  optional `onRequestError` listener, called with every error a request throws before the caller
  gets it.
- Who notices: web users who leave a tab open while signed out from another device or by an
  administrator
- Operator steps: none
```
