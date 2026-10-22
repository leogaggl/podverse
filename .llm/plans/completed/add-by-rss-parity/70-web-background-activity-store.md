# 70 — Web background activity store and Add by RSS tracking

**Cursor model:** Cursor Grok 4.7 · **Reasoning:** high

Rows: R31, R37, R38 (the extensible kind list), R39 (the visibility rule). Web only. Plan 71 renders
the overlay from this store. Nothing here renders.

Parity source: the mobile sync indicator. `apps/mobile/src/components/feedback/GlobalActivityBar.tsx`
reads `useSync().state` (`activeLabelKey`, `completedCount`, `totalCount`, `status`) and shows a
translated job label, a `{completed} of {total}` count, and a spinner while work runs. Its labels
come from `SYNC_JOB_LABEL_KEYS` in `apps/mobile/src/sync/syncJobKinds.ts`, where Add by RSS work
is `sync.job.rss_feeds` ("Updating Your RSS Feeds"). Web has no sync queue, so this plan adds a
small activity store that the Add by RSS code reports to.

## Answers

**What Add by RSS work runs on web, and where.** Every path goes through three shared functions:

- `syncAddByRSSFollowStubs` (`apps/web/src/utils/addByRSS/sync.ts`): one account request plus
  IndexedDB writes. Called by the background refresh (`utils/addByRSS/backgroundRefresh.ts`, at most
  once per 30 minutes per account, from `providers/AddByRSSBackgroundRefresh.tsx`), the library list
  (`components/AddByRSS/List/AddByRSSListClient.tsx`), the feed detail
  (`components/AddByRSS/Detail/AddByRSSDetailClient.tsx`), the player's metadata upgrade
  (`hooks/useAddByRSSMetadataUpgrade.ts`), and Subscribed after plan 65
  (`hooks/useReadyAddByRSSFeeds.ts`).
- `syncAddByRSSCacheWithServer` (same file): the same follow request, removal only. Called by the
  episode, episodes, track, tracks, livestream, and credentials pages under `app/add-by-rss/`.
- `pollAddByRSSParseStatus` (`apps/web/src/utils/addByRSS/actions.ts`): one per feed parse,
  polling every 3 s until a terminal status. Called by first parse (`firstParse.ts`), refresh-all
  (`parseAll.ts`, used by the background refresh and the list pages), the podcast and album detail
  pages, the add page, and the credentials page and settings section.

Tracking those three functions covers the background refresh, plan 65's Subscribed work, and the
user-started refreshes. The add and credentials pages keep their own spinners and also report here,
the same as the mobile rule that user-started work with a local spinner also reports to the bar
(**mobile-sync-orchestration**).

`runAddByRSSParseAll` and `enqueueAddByRSSFirstParses` send their enqueue requests before any poll
starts. Those requests are tracked too, so the overlay does not drop out between the request and the
first poll.

**What the count means.** One counted step per parse poll (one feed). Follow sync and enqueue
requests keep the entry visible but are not counted. The count resets when the kind goes idle, so
each burst reads `1 of 3`, `2 of 3`, and so on, as the mobile bar does per run.

## Locked decisions

1. **Kinds.** `BackgroundActivityKind = 'add_by_rss_refresh'`. Other kinds are added only after the
   operator picks them from the R38 list; each new kind adds a union member, a label key, and a case
   in `selectVisibleBackgroundActivity`.
1. **Snapshot.** An immutable array of `{ kind, completed, total }`, one per kind with at least one
   active step, in the order each kind became active. The array reference changes only when the
   store changes, so `useSyncExternalStore` does not loop.
1. **Ending is idempotent.** The function `beginBackgroundActivity` returns may be called more than
   once; only the first call counts.
1. **Visibility (R39).** `add_by_rss_refresh` is visible only when the signed-in account follows at
   least one Add by RSS feed (`loggedInAccount.account_following_add_by_rss_channels`), the same
   check plan 65 uses. The work itself is not skipped for accounts with no follows: a follow sync
   with zero follows still removes this browser's stubs for feeds unfollowed on another device.
1. **No work gating, no timers.** The store never delays, cancels, or retries work. Failures stay
   in `console.error` as they are today.

## Files

| File                                                                      | Change              |
| ------------------------------------------------------------------------- | ------------------- |
| `apps/web/src/utils/backgroundActivity/backgroundActivityStore.ts`        | New                 |
| `apps/web/src/utils/backgroundActivity/backgroundActivityStore.test.ts`   | New, Vitest         |
| `apps/web/src/utils/backgroundActivity/backgroundActivityDisplay.ts`      | New                 |
| `apps/web/src/utils/backgroundActivity/backgroundActivityDisplay.test.ts` | New, Vitest         |
| `apps/web/src/hooks/useBackgroundActivity.ts`                             | New                 |
| `apps/web/src/utils/addByRSS/sync.ts`                                     | Track both syncs    |
| `apps/web/src/utils/addByRSS/actions.ts`                                  | Track each poll     |
| `apps/web/src/utils/addByRSS/parseAll.ts`                                 | Track the enqueue   |
| `apps/web/src/utils/addByRSS/firstParse.ts`                               | Track the enqueues  |
| `apps/web/src/utils/addByRSS/actions.test.ts`                             | Poll tracking cases |

Tier B: extensionless relative imports. `apps/web/vitest.config.ts` already includes
`src/**/*.test.ts` (jsdom); no config change.

## Implementation

### `backgroundActivityStore.ts`

```typescript
/** Each kind of background work the overlay can report. */
export type BackgroundActivityKind = 'add_by_rss_refresh';

export type BackgroundActivityEntry = {
  kind: BackgroundActivityKind;
  /** Counted steps finished since this kind last went idle. */
  completed: number;
  /** Counted steps started since this kind last went idle. */
  total: number;
};

export type BackgroundActivitySnapshot = readonly BackgroundActivityEntry[];

export type BackgroundActivityStepOptions = {
  /** Counted steps add to the entry's `completed of total`; uncounted steps only keep it visible. */
  counted: boolean;
};

export function beginBackgroundActivity(
  kind: BackgroundActivityKind,
  options: BackgroundActivityStepOptions
): () => void { … }

export async function trackBackgroundActivity<T>(
  kind: BackgroundActivityKind,
  options: BackgroundActivityStepOptions,
  work: () => Promise<T>
): Promise<T> { … }

export function subscribeBackgroundActivity(listener: () => void): () => void { … }

export function getBackgroundActivitySnapshot(): BackgroundActivitySnapshot { … }

export function getServerBackgroundActivitySnapshot(): BackgroundActivitySnapshot { … }
```

Module state:

```typescript
type KindState = { active: number; completed: number; total: number; order: number };

const EMPTY_SNAPSHOT: BackgroundActivitySnapshot = Object.freeze([]);
const states = new Map<BackgroundActivityKind, KindState>();
const listeners = new Set<() => void>();
let nextOrder = 0;
let snapshot: BackgroundActivitySnapshot = EMPTY_SNAPSHOT;
```

- `publish()` (private): rebuild `snapshot` from `states` sorted by `order`, as fresh
  `{ kind, completed, total }` objects; `EMPTY_SNAPSHOT` when `states` is empty. Then call every
  listener.
- `beginBackgroundActivity`: get or create the kind's state (`order: nextOrder++` on create),
  `active += 1`, `total += 1` when `counted`, `publish()`. Return a function guarded by a local
  `ended` flag: on its first call, `active -= 1`, `completed += 1` when `counted`, delete the kind
  from `states` when `active === 0`, `publish()`.
- `trackBackgroundActivity`: `const end = beginBackgroundActivity(kind, options)`, then
  `try { return await work(); } finally { end(); }`.
- `subscribeBackgroundActivity`: add to `listeners`; return a function that deletes it.
- `getServerBackgroundActivitySnapshot`: returns `EMPTY_SNAPSHOT`.

Doc comment above `beginBackgroundActivity` (keep to this):

```typescript
/**
 * Marks one step of background work as running and returns the function that ends it. The kind
 * stays in the snapshot while any of its steps run; its count starts over once it goes idle.
 */
```

### `backgroundActivityDisplay.ts`

```typescript
import type {
  BackgroundActivityKind,
  BackgroundActivitySnapshot,
} from './backgroundActivityStore';

/** Key under the `background_activity` catalog namespace for each kind's message. */
export const BACKGROUND_ACTIVITY_LABEL_KEYS: Record<BackgroundActivityKind, 'add_by_rss_refresh'> =
  {
    add_by_rss_refresh: 'add_by_rss_refresh',
  };

export type BackgroundActivityVisibilityContext = {
  /** How many Add by RSS feeds the signed-in account follows; 0 when signed out. */
  addByRSSFollowCount: number;
};

/** The entries the overlay may show for this account. */
export function selectVisibleBackgroundActivity(
  entries: BackgroundActivitySnapshot,
  context: BackgroundActivityVisibilityContext
): BackgroundActivitySnapshot { … }
```

`selectVisibleBackgroundActivity` filters with a private `isKindVisible(kind, context)` that is an
exhaustive `switch (kind)`: `case 'add_by_rss_refresh': return context.addByRSSFollowCount > 0;`.
No `default` branch, so a new kind fails type-checking until it gets a case. Return `entries`
unchanged (same reference) when every entry is visible.

When a later kind joins, widen the value type of `BACKGROUND_ACTIVITY_LABEL_KEYS` to the union of
its keys.

### `useBackgroundActivity.ts`

```typescript
'use client';

import { useSyncExternalStore } from 'react';

/** Running background work in this page, for the background activity overlay. */
export function useBackgroundActivity(): BackgroundActivitySnapshot {
  return useSyncExternalStore(
    subscribeBackgroundActivity,
    getBackgroundActivitySnapshot,
    getServerBackgroundActivitySnapshot
  );
}
```

Imports the three functions and the type (own line) from `../utils/backgroundActivity/backgroundActivityStore`.

### `sync.ts`

Wrap the whole body of both `syncAddByRSSCacheWithServer` and `syncAddByRSSFollowStubs` the same
way (signatures, return types, and doc comments stay):

```typescript
export async function syncAddByRSSFollowStubs(accountIdText: string): Promise<void> {
  await trackBackgroundActivity('add_by_rss_refresh', { counted: false }, async () => {
    // … the existing body, unchanged …
  });
}
```

Neither body has an early `return`. Import `trackBackgroundActivity` from
`../backgroundActivity/backgroundActivityStore` (also in `actions.ts`, `parseAll.ts`, and
`firstParse.ts`).

### `actions.ts`

In `pollAddByRSSParseStatus`, wrap the existing `for` loop and the trailing `throw`:

```typescript
return trackBackgroundActivity('add_by_rss_refresh', { counted: true }, async () => {
  for (…) { … unchanged … }
  throw new Error(`Parse status timed out. Request ID: ${requestId}`);
});
```

The return type stays `Promise<AddByRSSParseStatusResponse['status']>`.

### `parseAll.ts`

In `runAddByRSSParseAll`, wrap only these two existing statements, so the entry is visible while the
credentials read and the refresh-all request run:

```typescript
const response = await trackBackgroundActivity('add_by_rss_refresh', { counted: false }, async () => {
  const credentialsByUrl = await buildCredentialsByUrl(accountId, feeds);
  return enqueueAddByRSSParseAll({ … unchanged … });
});
```

`buildCacheMaps(feeds)` stays above the wrapper; it is synchronous. The polls that follow
are counted by `pollAddByRSSParseStatus`. The `onQueued` loop runs after the wrapper and before the
polls; that gap is IndexedDB writes only and is not tracked.

### `firstParse.ts`

In `enqueueAddByRSSFirstParses`, after `pending` is built: when `pending.length === 0`, return `[]`
as today without tracking. Otherwise wrap the existing `for (const { feed, feedKey } of pending)`
loop in `trackBackgroundActivity('add_by_rss_refresh', { counted: false }, async () => { … })`
and keep `return started;` after it. Each `void pollAddByRSSParseStatus(…)` inside the loop starts
its counted step synchronously, before the wrapper ends, so the entry never drops out between them.
A browser with nothing to first-parse therefore shows nothing for the IndexedDB reads.

## Tests

**`backgroundActivityStore.test.ts`** (Vitest). Load a fresh module per test with
`vi.resetModules()` and `await import('./backgroundActivityStore')`, the pattern
`firstParse.test.ts` uses (`loadFirstParse`), so no test-only export is needed.

- The snapshot starts empty and `getServerBackgroundActivitySnapshot()` is empty.
- One counted step: the snapshot holds `{ kind: 'add_by_rss_refresh', completed: 0, total: 1 }`;
  after `end()` the snapshot is empty.
- Two counted steps and one uncounted: `total` is 2; ending one counted step reads `1 of 2`; ending
  the uncounted step keeps the entry; ending the last one empties the snapshot.
- Calling the same `end` twice changes the count once.
- After the kind goes idle, a new counted step reads `0 of 1` (the count started over).
- A listener is called on begin and on end, and not after it unsubscribes.
- Two reads with no change in between return the same array reference.
- `trackBackgroundActivity` ends the step when `work` rejects, and rethrows the error.

**`backgroundActivityDisplay.test.ts`** (Vitest):

- An `add_by_rss_refresh` entry is dropped when `addByRSSFollowCount` is 0 and kept when it is 1.
- An empty snapshot stays empty.
- When every entry is visible, the same array reference is returned.

**`actions.test.ts`**: add `vi.mock('./api', …)` providing `getAddByRSSParseStatus` (a
`vi.hoisted` mock) plus `enqueueAddByRSSParse`, `followAddByRSSChannel`, and
`unfollowAddByRSSChannel` as `vi.fn()`. The existing `applyAddByRSSParseStatus` cases do not call
these. Add `describe('pollAddByRSSParseStatus')`, real timers (call `vi.useRealTimers()` in its
`beforeEach`, since the existing describe installs fake timers in its own hooks). Call it with
`{ requestId: 'req-1', onStatusUpdate: vi.fn() }`; the first request runs before any sleep:

- While the first status request is pending (a deferred promise), `getBackgroundActivitySnapshot()`
  holds one `add_by_rss_refresh` entry with `total: 1`; after it resolves with `status: 'parsed'`
  the poll returns `'parsed'` and the snapshot is empty.
- When the status request rejects, the poll rejects and the snapshot is empty.

No Playwright spec in this plan; plan 71's spec exercises the tracking end to end.
**Release scratchpad:** none here. Nothing is visible until plan 71, which writes the entry.
