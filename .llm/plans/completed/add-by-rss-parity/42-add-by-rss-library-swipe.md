# 42 — Swipe to unsubscribe on Add by RSS library rows

**Cursor model:** Cursor Grok 4.7 · **Reasoning:** medium

Rows: R3. Mobile only.

Runs after plan 41 (which changes this screen's type import) and plan 34 (which edits the item
rows of the same screen). Never together with plan 34, 41, or 43.

Parity source: Home's channel rows — `HomeFeedListItem` wraps `HomeFeedRow` in `SwipeActionRow`,
and `handleUnsubscribe` in `src/screens/home/HomeScreen.tsx` runs the unsubscribe.

## Answer

**R3.** `LibraryFeedListItem` in `src/screens/rss/AddByRssRootScreen.tsx` renders a bare
`HomeFeedRow` with no `SwipeActionRow`, so a swipe does nothing. The only way to unsubscribe from
the library today is the channel page's remove control.

## Locked decisions

1. **Which rows.** Podcasts, Artists, and Albums chips in list view get the swipe, as on Home
   (`isAddByRssLibraryFilterMediaType`). Item chips and grid tiles do not (grid is plan 43). The
   "Needs username and password" rows stay as they are; they are a separate section with their
   own tap target.
2. **Action.** Label `t('features.unsubscribe')`. It calls `subscriptionsRepository.unsubscribe`
   with `source: 'addByRss'` and `idText: row.id` (the feed URL), with `accountSync` when signed in,
   exactly as Home does. A repeat swipe on a row already in flight does nothing.
3. **After success.** Remove the row from `feedRows`, then `homeFeedRefresh.notify()` so Home
   (which stays mounted under its tab) drops the follow too. A `serverError` result (local removal
   done, account unfollow failed) shows `errors.generic`. A thrown error shows `errors.generic`
   and rethrows so `SwipeActionRow` stops its spinner and leaves the row.
4. **Errors show in the existing notice.** Add `actionErrorKey`; the `rss-playback-notice` text
   shows `actionErrorKey ?? <plan 34's notice expression>`. A new swipe clears it first.
5. **Stale list after a Home unsubscribe.** The library reloads from local storage when it
   regains focus (`source: 'synced'`, no spinner, rows stay until the read lands), so a follow
   removed on Home or on the channel page is gone when the user comes back.

## Files

| File                                                 | Change                           |
| ---------------------------------------------------- | -------------------------------- |
| `apps/mobile/src/screens/rss/AddByRssRootScreen.tsx` | Swipe row, handler, focus reload |
| `apps/mobile/e2e/add-by-rss.yaml`                    | Swipe reveals Unsubscribe        |
| `release-notes/scratchpad.md`                        | Entry                            |

## Implementation

All edits are in `AddByRssRootScreen.tsx`. Anchors: `function LibraryFeedListItem`, `const
loadFeed = useCallback(`, the `renderItem` callback, and the `rss-playback-notice` text.

### Imports

- `useAuth` from `'../../auth/AuthProvider'`.
- `SwipeActionRow`, added to the existing `'../../components/primitives'` import.
- `subscriptionsRepository` from `'../../data/repositories'`.
- `homeFeedRefresh` from `'../../lib/home/homeFeedRefresh'`.

### `LibraryFeedListItem`

Add props `onUnsubscribe?: (row: HomeFeedRowData) => Promise<void>` and `unsubscribeLabel:
string`. Add, before the grid branch:

```typescript
const handleRemove = useCallback(() => onUnsubscribe?.(row), [onUnsubscribe, row]);
```

In the list branch, when `onUnsubscribe !== undefined`, wrap the existing `HomeFeedRow` (with
plan 34's props) in:

```tsx
<SwipeActionRow
  actionTestID={`rss-feed-row-${row.id}-unsubscribe`}
  onRemove={handleRemove}
  removeLabel={unsubscribeLabel}
  testID={`rss-feed-row-${row.id}-swipe`}
>
  {feedRow}
</SwipeActionRow>
```

Build the row once as `const feedRow = <HomeFeedRow … />` and render either the wrapped or the
bare row inside the existing `<View style={cellStyle}>`. Returning the promise lets
`SwipeActionRow` show its spinner while the unsubscribe runs; Home's swipe discards it, which is
why Home closes at once.

### Screen state and handler

Beside the other state:

```typescript
const { accessToken, clearSession, refreshToken, setTokens, status } = useAuth();
const [actionErrorKey, setActionErrorKey] = useState<string | null>(null);
const unsubscribingIdsRef = useRef<Set<string>>(new Set());
```

After `handlePlayPress`:

```typescript
const handleUnsubscribe = useCallback(
  async (row: HomeFeedRowData) => {
    if (unsubscribingIdsRef.current.has(row.id)) {
      return;
    }
    unsubscribingIdsRef.current.add(row.id);
    setActionErrorKey(null);
    try {
      const result = await subscriptionsRepository.unsubscribe({
        accountSync:
          status === 'authenticated'
            ? { accessToken, clearSession, refreshToken, setTokens }
            : undefined,
        idText: row.id,
        source: 'addByRss',
      });
      setFeedRows((prev) => prev.filter((item) => item.id !== row.id));
      // Home stays mounted under its tab, so it will not reload on its own.
      homeFeedRefresh.notify();
      if (result.serverError) {
        setActionErrorKey('errors.generic');
      }
    } catch {
      setActionErrorKey('errors.generic');
      throw new Error('Unsubscribe failed');
    } finally {
      unsubscribingIdsRef.current.delete(row.id);
    }
  },
  [accessToken, clearSession, refreshToken, setTokens, status]
);
```

`handleMediaTypeChange` also calls `setActionErrorKey(null)`.

### `renderItem`

Pass `onUnsubscribe={isAddByRssLibraryFilterMediaType(selectedMediaType) ? handleUnsubscribe :
undefined}` and `unsubscribeLabel={unsubscribeLabel}`, with `const unsubscribeLabel =
t('features.unsubscribe');` above the callback. Add `handleUnsubscribe` and `unsubscribeLabel` to
its dependency list.

### Notice

The `rss-playback-notice` condition and text use `actionErrorKey ?? …` ahead of the notice keys
plan 34 left there. Add `actionErrorKey` to the `listHeader` dependency list.

### Focus reload

After the sync-finished effect:

```typescript
// Another tab or the channel page may have changed the follows while this screen was hidden.
useEffect(() => {
  if (!arePrefsHydrated) {
    return;
  }
  return navigation.addListener('focus', () => {
    void loadFeed('synced');
  });
}, [arePrefsHydrated, loadFeed, navigation]);
```

A focus that lands during the first read is harmless: `feedRequestIdRef` keeps only the newest.

## Tests

- No unit test: the handler is screen wiring around `subscriptionsRepository.unsubscribe`, which
  Home's swipe already exercises in `e2e/subscriptions-anonymous.yaml`.
- Maestro `e2e/add-by-rss.yaml`: append at the end of the flow, after the final
  `extendedWaitUntil` that waits for "E2E Add-by-RSS Channel" to leave `rss-feed-list`. The
  seeded account's own Add by RSS follow is still listed, so reveal the action and close it
  without tapping (tapping would unfollow a seeded row other flows rely on):

```yaml
# Swiping a library row left reveals Unsubscribe, as on Home. Swiping back closes it.
- assertVisible:
    id: "rss-feed-row-.*-swipe"
- swipe:
    from:
      id: "rss-feed-row-.*-swipe"
    direction: LEFT
- extendedWaitUntil:
    visible:
      id: "rss-feed-row-.*-unsubscribe"
    timeout: ${TIMEOUT_FASTEST}
- takeScreenshot: add-by-rss-library-swipe-unsubscribe
- swipe:
    from:
      id: "rss-feed-row-.*-swipe"
    direction: RIGHT
- extendedWaitUntil:
    notVisible:
      id: "rss-feed-row-.*-unsubscribe"
    timeout: ${TIMEOUT_FASTER}
```

## Release scratchpad

Append to `release-notes/scratchpad.md`:

```markdown
## Mobile Add by RSS library rows swipe to unsubscribe

- Surfaces: mobile
- Change: In My Library → Add by RSS, swiping a podcast, artist, or album row left reveals
  Unsubscribe, as on Home. It removes the feed from the device and unfollows it on the account
  when signed in; Home drops it too. The library also rereads its list when it comes back into
  view, so a follow removed elsewhere is gone.
- Who notices: anyone who follows feeds by RSS URL
- Operator steps: none
```
