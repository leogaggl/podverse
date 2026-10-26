**Cursor model:** Cursor Grok 4.7 · **Reasoning:** high

# 34 — Mobile notifications inbox: load the next page near the bottom

## Rows

R4, R5

## Runs after

30

## Context

`apps/mobile/src/screens/notifications/NotificationsInboxScreen.tsx` pages through
`notificationsRepository.list(requestContext, { page })`, but only from a **Show more** button in
`listFooter` (`testID="notifications-inbox-load-more"`, shown when
`canLoadMore && errorKey === null && !offlineModeEnabled`). `canLoadMore` is `page < totalPages`.

Three problems around the append path (`loadPage(page + 1, 'append')`):

- A failed next page sets `errorKey`. With rows on screen, `listEmpty` is not drawn and the footer
  hides, so the failure is silent and the list can never page again until the screen refocuses.
- A live `created` event prepends a row (`prependLiveNotification`). That shifts the server's page
  offsets by one, so the next page can repeat the last row already shown, which is a duplicate key.
- A focus reload (`loadFirstPageAndMarkRead`) or a `resync` event can finish before an in-flight
  append, and the append then lands on top of the fresh page 1.

## Changes

All in `NotificationsInboxScreen.tsx`.

### 1. State and refs

- `const [loadMoreErrorKey, setLoadMoreErrorKey] = useState<string | null>(null);`
- `const inboxGenerationRef = useRef(0);`

### 2. Page-1 loads advance the generation

At the start of `loadFirstPageAndMarkRead`, and in `loadPage` when `mode === 'replace'`:
`inboxGenerationRef.current += 1` and `setLoadMoreErrorKey(null)`. Both already reset to the
signed-out and offline states on their early returns; add `setLoadMoreErrorKey(null)` there too.

### 3. `loadPage` append path

- Capture `const generation = inboxGenerationRef.current;` before the request.
- `setLoadMoreErrorKey(null)` instead of `setErrorKey(null)` when `mode === 'append'`.
- After the request: when `mode === 'append'` and `generation !== inboxGenerationRef.current`,
  return without setting rows, page, counts, or cache. The `finally` still clears
  `isLoadingMore`.
- Append with `appendUniqueBy(previous, nextData.items, inboxRowKeyExtractor)` (plan 30) instead
  of spreading, for both `setNotifications` and the cached `items`. `inboxRowKeyExtractor` is
  `String(item.id)`, the list's own key.
- In `catch`, when `mode === 'append'`, `setLoadMoreErrorKey('errors.generic')` and leave
  `errorKey` alone. The replace path keeps `setErrorKey('errors.generic')`.
- Keep the existing `console.warn` in `catch` unchanged.

### 4. End-reached wiring

```ts
const handleEndReached = useLoadMoreOnEndReached({
  canLoadMore:
    status === 'authenticated' &&
    !offlineModeEnabled &&
    canLoadNextPage({
      hasError: errorKey !== null || loadMoreErrorKey !== null,
      hasMore: canLoadMore,
      isLoading,
      isLoadingMore,
    }),
  loadMore: () => loadPage(page + 1, 'append'),
});
```

The hook reads `loadMore` from a ref each call, so the inline arrow sees the current `page`.

Replace `handleLoadMore` with `handleRetryNextPage` (`useCallback`): `void loadPage(page + 1, 'append')`.

### 5. Footer

Replace the `Pressable` in `listFooter` with, inside `<View style={styles.listFooter}>`:

- `isLoadingMore` → `<ListLoading testID="notifications-inbox-loading-more" />`
- else `loadMoreErrorKey !== null && hasRows && !offlineModeEnabled` →
  `<ListError messageKey={loadMoreErrorKey} onRetry={handleRetryNextPage} testID="notifications-inbox-load-more-error" />`
- else `null` (return `null` without the wrapper `View`).

Delete the `loadMoreButton` and `loadMoreLabel` styles. Keep the `Pressable` import;
`InboxNotificationRow` near the top of the file still uses it.

### 6. `FillList`

Add `onEndReached={handleEndReached}` and `onEndReachedThreshold={LIST_END_REACHED_THRESHOLD}`.

Imports (relative from `screens/notifications/`): `ListLoading` from
`'../../components/state/ListLoading'`, `ListError` from `'../../components/state/ListError'`
(the screen imports `RetryableError` for the blocking error today, not `ListError`), `appendUniqueBy`, `canLoadNextPage`, and `LIST_END_REACHED_THRESHOLD`
from `'../../lib/pagination/pagedList'`, `useLoadMoreOnEndReached` from
`'../../hooks/useLoadMoreOnEndReached'`.

## Files

apps/mobile/src/screens/notifications/NotificationsInboxScreen.tsx

## Tests

No new unit test: the append and gate rules are plan 30's tested helpers. The Maestro flow
`apps/mobile/e2e/notifications-inbox.yaml` must keep passing; it does not tap
`notifications-inbox-load-more` (`rg -n load-more apps/mobile/e2e` returns nothing).

## Release scratchpad

## Mobile notifications inbox loads more as you scroll

- Surfaces: mobile
- Change: the notifications inbox now loads older notifications when you scroll near the bottom,
  replacing the Show more button. A failed page shows Retry under the rows (before, it failed
  silently and the inbox stopped paging). A notification that arrives live while you scroll no
  longer shows up twice, and returning to the inbox while a page loads no longer mixes that page
  into the fresh list.
- Who notices: signed-in users with a long notification history on the mobile app
- Operator steps: none
