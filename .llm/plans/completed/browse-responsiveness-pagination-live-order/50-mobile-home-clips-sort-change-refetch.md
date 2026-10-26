**Cursor model:** Opus 5.5 · **Reasoning:** high

# 50 — Mobile Home Clips: a sort change refetches page 1 now

## Rows

R17

## Runs after

38, 40

Plan 38 gives `homeClipsCacheRepository` its stored window, the session-generation guard, the
write generation, `extendFromAccount`, and the Home extend state (`feedHasMore`,
`isFeedExtending`, `feedExtendErrorKey`). Plan 40 adds `homeClipSortToApiSort`,
`resolveHomeSort`, the Clips-only sort options, and rewrites `createHomeClipsJob`. This plan edits
the same files after both: `homeClipsCacheRepository.ts` and its test, `homeListPrefs.ts` and its
test, `syncJobs.ts`, `HomeScreen.tsx`, and `apps/mobile/e2e/home.yaml`.

## What happens today

`handleSortChange` and `handleRangeChange` in `apps/mobile/src/screens/home/HomeScreen.tsx` update
`listPrefs` and write the preference. The `loadFeed` effect then re-reads the Clips snapshot under
kv key `home.clips.subscribed`, which still holds the page the last `home-clips` sync job fetched
under the old order. After plan 40 the clips branch shows the stored order as-is, so the list does
not change at all until the next sync runs `createHomeClipsJob` with the new preference.

## Settled behavior

- **R17:** changing Home Clips between Recent and Popularity fetches page 1 in the new order right
  away and replaces the saved list. Home re-reads the saved list (D8): the screen never puts a
  network page into React state.
- **Interactive, not a sync job.** The user is watching the result of their own tap, so the request
  runs immediately from the screen through the repository, outside the serial queue
  (**mobile-sync-orchestration**, interactive lane). No new `SyncJobKind`, no queue registration.
  Plan 38's extend works the same way.
- **D10 stays.** `createHomeClipsJob` keeps replacing the saved list with page 1 of the stored
  preference on every background sync.
- **R14 stays.** A saved Clips A-Z reads as Recent (plan 40's `resolveHomeSort`), and the query
  mapping sends `recent` for it.
- **A Popularity window change refetches too.** Choosing a different listen-count window (Day,
  Week, Month, All Time) under Popularity changes the request the same way, so it takes the same
  path. Choosing a window from Recent is itself a switch to Popularity (`writeHomeRange` stores
  `sort: 'popularity'`).
- **The old rows leave with the tap.** The list clears in the same commit as the sort chip, and
  the existing list spinner (`home-feed-loading`) shows until the new page is read back. The saved
  rows are in the order the user just turned away from, so they are not left under the new label
  (same habit as web Browse's chip change, and **mobile-row-render-cost** § clear in the same
  commit).
- **A failed refetch shows the list error with Retry.** `home-list-error` with the existing
  `errors.generic` copy. Retry (`loadFeed('retry')`) runs the refetch again. The saved list in the
  old order is not shown under the new sort. The failure is recorded in the error log through
  `appendHomeFeedReadFailure`.
- **No sync bar entry.** The list spinner is the feedback, as with plan 38's extend. The sync bar
  stays the indicator for queued work only.
- **Only when it can work.** The refetch runs only while signed in and with Offline Mode off. With
  Offline Mode on, Clips already shows the offline-unavailable message and nothing is requested.
  Signed out, Clips keeps reading the device as today.

## Changes

### 1. `apps/mobile/src/prefs/homeListPrefs.ts`

Below `homeClipSortToApiSort` (plan 40), add:

```ts
/** The request that fills the saved Home clips list for a sort and window. */
export type HomeClipsQuery = {
  range: QueryParamsStatsRange | null;
  sort: 'recent' | 'top';
};

export const homeClipsQueryFromPrefs = (
  prefs: Pick<HomeListPrefs, 'range' | 'sort'>
): HomeClipsQuery => {
  return {
    range: homeSortToApiRange(prefs.sort, prefs.range),
    sort: homeClipSortToApiSort(prefs.sort),
  };
};

/**
 * Whether a Home sort or window change has to fetch the saved clips list again. Only the Clips
 * chip, only signed in with Offline Mode off, and only when the request itself changes.
 */
export const homeClipsPrefsChangeRefetches = (input: {
  isAuthenticated: boolean;
  mediaType: HomeMediaType;
  next: Pick<HomeListPrefs, 'range' | 'sort'>;
  offlineModeEnabled: boolean;
  previous: Pick<HomeListPrefs, 'range' | 'sort'>;
}): boolean => {
  if (input.mediaType !== 'clips' || !input.isAuthenticated || input.offlineModeEnabled) {
    return false;
  }
  const previous = homeClipsQueryFromPrefs(input.previous);
  const next = homeClipsQueryFromPrefs(input.next);
  return previous.sort !== next.sort || previous.range !== next.range;
};
```

`HomeListPrefs` is declared further down the file; move these below its declaration if the
compiler or lint (`no-use-before-define`) requires it.

### 2. `apps/mobile/src/sync/syncJobs.ts`

`createHomeClipsJob` passes `homeClipsQueryFromPrefs(clipsPrefs)` as the options argument of
`homeClipsCacheRepository.refreshFromAccount`, replacing the inline `{ range, sort }` object plan 40
wrote. Swap the `homeClipSortToApiSort` import for `homeClipsQueryFromPrefs`; keep
`homeSortToApiRange` only if the popularity-ranks job still uses it (it does). The job ignores the
refresh outcome.

### 3. `apps/mobile/src/data/repositories/homeClipsCacheRepository.ts`

The screen and the sync job can now have refreshes in flight at once, and a sort flip can start
two in a row. The newest refresh must win.

- Module-level `let homeClipsRefreshGeneration = 0;` beside plan 38's write generation.
- `refreshFromAccount` returns `Promise<'replaced' | 'stale'>`:
  1. `const refreshAtStart = ++homeClipsRefreshGeneration;` and capture
     `getAuthSessionGeneration()` (plan 38 already captures it).
  2. The request as today, with `options.range` and `options.sort`.
  3. When the session generation changed **or** `refreshAtStart !== homeClipsRefreshGeneration`,
     return `'stale'` without writing.
  4. Otherwise write through `replacePayload(items, window)` (plan 38's signature, which advances
     the write generation so an extend in flight is dropped) and return `'replaced'`.
  Errors propagate.
- Its doc comment states: the sync job and a Home Clips sort change both call it; a refresh that
  finishes after a later one started does not write, so the saved list always matches the newest
  request; the stored window records the query it was fetched with.

### 4. `apps/mobile/src/screens/home/HomeScreen.tsx` (large file; edit only these anchors)

Imports: add `homeClipsCacheRepository` to the existing `'../../data/repositories'` import, and
`homeClipsPrefsChangeRefetches`, `homeClipsQueryFromPrefs` to the `'../../prefs/homeListPrefs'`
import. Add `import type { HomeClipsQuery } from '../../prefs/homeListPrefs';` on its own line.

**Pending refetch ref**, beside `feedRequestIdRef`:

```ts
// Set when a Clips sort or window change leaves the saved list in an order the user turned away
// from. Every Clips read fetches page 1 first while it is set, so Retry and returning to the chip
// both finish the job.
const pendingClipsRefetchRef = useRef<{
  prefsWritten: Promise<void>;
  query: HomeClipsQuery;
} | null>(null);
```

**`startClipsRefetchIfNeeded`** (`useCallback`, declared above `handleSortChange`), taking
`next: Pick<HomeListPrefs, 'range' | 'sort'>` and `prefsWritten: Promise<void>`:

1. Return unless `homeClipsPrefsChangeRefetches({ isAuthenticated: status === 'authenticated', mediaType: selectedMediaType, next, offlineModeEnabled, previous: resolvedPrefs })`.
2. `feedRequestIdRef.current += 1;` so a read already in flight cannot paint the old rows.
3. `pendingClipsRefetchRef.current = { prefsWritten: prefsWritten.catch(() => undefined), query: homeClipsQueryFromPrefs(next) };`
   A failed preference write costs only the remembered choice on relaunch, as the `void` write
   does today; the refetch uses the query in hand.
4. In this same commit: `setFeedRows([])`, `setFeedErrorKey(null)`, `setHasCompletedFeedRead(false)`,
   and plan 38's `setFeedHasMore(false)`, `setIsFeedExtending(false)`, `setFeedExtendErrorKey(null)`.

Dependencies: `offlineModeEnabled`, `resolvedPrefs.range`, `resolvedPrefs.sort`,
`selectedMediaType`, `status`. Import the `HomeListPrefs` type if it is not already imported.

**`handleSortChange`**: keep the `setListPrefs` line. Replace `void writeHomeSort(selectedMediaType, sort);` with:

```ts
const prefsWritten = writeHomeSort(selectedMediaType, sort);
startClipsRefetchIfNeeded({ range: resolvedPrefs.range, sort }, prefsWritten);
```

**`handleRangeChange`**: same shape with `writeHomeRange(selectedMediaType, range)` and
`{ range, sort: 'popularity' }`. Update both callbacks' dependencies.

The handlers do not call `loadFeed`. The `setListPrefs` change moves `resolvedPrefs.sort` or
`resolvedPrefs.range`, and the existing `loadFeedRef.current('initial')` effect runs the read. When
prefs had not hydrated yet, the `subscribeHomeListPrefs` read that follows the write hydrates them
and the same effect runs.

**`loadFeed`**: in the `else` branch (after the offline-unavailable branch), before
`const read = await withHomeFeedReadBudget(...)`, add the refetch step:

```ts
const pendingClipsRefetch = pendingClipsRefetchRef.current;
if (selectedMediaType === 'clips' && pendingClipsRefetch !== null) {
  if (status !== 'authenticated') {
    pendingClipsRefetchRef.current = null;
  } else {
    let outcome: 'replaced' | 'stale';
    try {
      await pendingClipsRefetch.prefsWritten;
      outcome = await homeClipsCacheRepository.refreshFromAccount(
        { accessToken, clearSession, refreshToken, setTokens },
        pendingClipsRefetch.query
      );
    } catch (error) {
      if (requestId !== feedRequestIdRef.current) {
        return;
      }
      appendHomeFeedReadFailure({
        error,
        mediaType: selectedMediaType,
        source: `${source}-clips-refetch`,
      });
      setFeedRows([]);
      setAddByRssItemsById(EMPTY_HOME_ADD_BY_RSS_ITEMS);
      setAddByRssLiveItemsById(EMPTY_HOME_ADD_BY_RSS_LIVE_ITEMS);
      setDirectoryItemsById(EMPTY_HOME_DIRECTORY_ITEMS);
      setHasCompletedFeedRead(true);
      setFeedErrorKey('errors.generic');
      return;
    }
    if (outcome === 'replaced' && pendingClipsRefetchRef.current === pendingClipsRefetch) {
      pendingClipsRefetchRef.current = null;
    }
    if (requestId !== feedRequestIdRef.current) {
      return;
    }
  }
}
```

Rules this step holds, which the implementer keeps whatever the final shape:

- The network request is not wrapped in `withHomeFeedReadBudget`; that budget is for local reads.
  The request helper's own timeout applies.
- The error branch sets `feedErrorKey` for every source, including `'synced'` and `'refresh'`.
  `homeFeedKeepsVisibleRowsOnError` does not apply here: the rows were cleared on the tap, and an
  empty list without the error would read as "no clips".
- `'stale'` keeps the pending entry. A newer refresh started (another sort change, or the sync
  job), and the next Clips read fetches again if this query is still the one waiting. That is what
  makes a refresh from the sync job that read the old preference self-correct: the queue's
  `'synced'` re-read finds the entry still set.
- Pull-to-refresh, Retry, the post-sync re-read, and returning to the Clips chip all pass through
  this step, so any of them finishes a refetch that was abandoned or failed.

Add `accessToken`, `clearSession`, `refreshToken`, `setTokens`, and `status` to `loadFeed`'s
dependency list. The initial-load effect calls `loadFeedRef.current`, so a token rotation does not
start a read; the effects that list `loadFeed` (the `homeFeedRefresh` subscription, the sync-status
transition) only re-subscribe or re-compare.

`commitMediaTypeChange` does not touch `pendingClipsRefetchRef`; leaving Clips mid-refetch and
coming back fetches again if the first did not finish.

### 5. `apps/mobile/e2e/home.yaml`

In plan 40's Clips sort block, after `- tapOn: id: home-sort-menu-cancel` and before its
`shared/restore-chip-row-start.yaml` runFlow, insert:

```yaml
# Changing the Clips order fetches the first page again right away. The old rows leave on the tap
# and the list reads back the new page.
- tapOn:
    id: home-sort-button
- tapOn:
    id: home-sort-popularity
- extendedWaitUntil:
    visible:
      id: home-sort-range-menu
    timeout: ${TIMEOUT_FAST}
- tapOn:
    id: home-sort-range-week
- assertVisible: "Sort: Week"
- extendedWaitUntil:
    notVisible:
      id: home-feed-loading
    timeout: ${TIMEOUT_SLOW}
- assertNotVisible:
    id: home-list-error
- takeScreenshot: home-clips-sort-popularity
- tapOn:
    id: home-sort-button
- tapOn:
    id: home-sort-recent
- assertVisible: "Sort: Recent"
- extendedWaitUntil:
    visible:
      id: home-feed-row-e2eClip00000001
    timeout: ${TIMEOUT_SLOW}
- assertNotVisible:
    id: home-list-error
- takeScreenshot: home-clips-sort-recent
```

The seed may hold no subscribed clips with listens in the last week, so the Popularity step asserts
only that the list settled without an error; the Recent step proves the refetched page is read
back. `TIMEOUT_FAST` and `TIMEOUT_SLOW` are the shared ladder names (**mobile-maestro-timeouts**).

## Files

apps/mobile/src/prefs/homeListPrefs.ts
apps/mobile/src/prefs/homeListPrefs.test.ts
apps/mobile/src/sync/syncJobs.ts
apps/mobile/src/data/repositories/homeClipsCacheRepository.ts
apps/mobile/src/data/repositories/homeClipsCacheRepository.test.ts
apps/mobile/src/screens/home/HomeScreen.tsx
apps/mobile/e2e/home.yaml

## Tests

`apps/mobile/src/prefs/homeListPrefs.test.ts`:

- `homeClipsQueryFromPrefs`: `recent` → `{ range: null, sort: 'recent' }`; `popularity` with
  `month` → `{ range: 'month', sort: 'top' }`; `alphabetical` → `{ range: null, sort: 'recent' }`.
- `homeClipsPrefsChangeRefetches`:
  - Recent → Popularity on Clips, signed in, Offline Mode off → `true`.
  - Popularity Week → Popularity Month on Clips → `true`.
  - Recent with range `week` → Recent with range `month` → `false` (Recent sends no window).
  - The same change on `podcasts` → `false`; signed out → `false`; Offline Mode on → `false`.

`apps/mobile/src/data/repositories/homeClipsCacheRepository.test.ts` (plan 38 creates it; extend
its mocks of `../db` and `../../auth/authRequestWithRefresh` so `requestWithMobileAuthRefresh`
returns deferred promises, and `vi.spyOn(homeClipsCacheRepository, 'replacePayload')`):

- Two overlapping `refreshFromAccount` calls where the first resolves last: the first returns
  `'stale'`, the second `'replaced'`, and `replacePayload` runs once with the second response's
  items and a window recording the second query.
- A session generation change during the request returns `'stale'` and writes nothing.
- A lone refresh returns `'replaced'` and writes.

`apps/mobile/e2e/home.yaml`: the block above.

## Release scratchpad

## Mobile Home Clips reloads when its sort changes

- Surfaces: mobile
- Change: switching Home's Clips chip between Recent and Popularity, or picking a different
  Popularity window, fetches the first page in the new order right away and saves it on the
  device in place of the old list. Before, the list kept the old order until the next background
  sync. The old rows clear on the tap and a spinner shows until the new page arrives; a failed
  fetch shows the list error with Retry. Background sync still starts the saved list over from
  page 1. Offline Mode and signed-out Home Clips are unchanged.
- Who notices: signed-in users who change the Home Clips sort
- Operator steps: none
