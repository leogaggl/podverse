**Cursor model:** Cursor Grok 4.7 · **Reasoning:** extra high

# 49 — Data the web remote view needs about the item another device plays

While another device or tab plays (role `remote`), this tab's MediaPlayer context is empty. The
shared state gives the item's ref, `medium`, title, show title, artwork, status, position, and
`duration_seconds`, and nothing else. The remote view (plan 42) and the item rows (plan 46) need
more:

- **Add to Playlist** needs the channel and item, clip, or official clip records, or for Add by
  RSS the item this browser can resolve (R74).
- **The channel title link** in the full-screen player needs the channel's id (R72). The item link
  comes from `medium` without a request (plan 42).
- **The segment strip and chapter rows** need the item's chapters and the playing device's
  estimated position, ticking once per second (R82).

This plan adds the data layer for those: one store that resolves the remote item's records once
per item, one shared position clock, and the hooks that read them. It renders nothing. Plans 42,
43, and 46 read it.

**Where this browser gets the remote item's chapters:** the same request the local player uses
for its loaded item, `reqItemParseAndGetChapters(itemIdText)` (`useMediaPlayerControllerQueueHeadLoading.ts`,
`fetchItemChapters`), for a non-live `item` ref. A clip or official clip ref fetches no chapters:
the strip names the clip itself, and the local player stops following chapters while a clip
plays (`NonLiveMediaOrchestrator` time update). An Add by RSS ref fetches no chapters: the local
web player never loads chapters for Add by RSS items (`usePlayAddByRSS` sets `mpItemChapters` to
null), so the remote view matches it.

Two fetch sequences already exist in area B's plans. This plan moves them into shared functions
and points both callers at them (**reuse-beyond-components**), with no behavior change for those
callers:

- Plan 23's `usePlaybackResourceLoader` fetches item → channel, clip → item → channel, and
  official clip → item → channel.
- Plan 24's `useCrossDevicePlaybackTransfer` finds Add by RSS resource data by hash in this
  account's queues' now-playing rows.

Before editing, confirm these exist; if any is missing, stop and report:

- `apps/web/src/lib/crossDevicePlayback/crossDevicePlaybackStore.ts` exports
  `crossDevicePlaybackStore` with `getSnapshot`, `subscribe`, and `getEstimatedPositionSeconds`
  (plan 21).
- `apps/web/src/contexts/CrossDevicePlayback.tsx` exports `useCrossDevicePlaybackSnapshot`
  (plan 22).
- `apps/web/src/hooks/usePlaybackResourceLoader.ts` (plan 23) and
  `apps/web/src/hooks/useCrossDevicePlaybackTransfer.ts` (plan 24), with the fetch sequences above.

## Rows

R72, R74, R82

## Runs after

24

## Files

apps/web/src/lib/crossDevicePlayback/fetchPlaybackResourceDtos.ts
apps/web/src/lib/crossDevicePlayback/addByRSSResourceDataForHash.ts
apps/web/src/lib/crossDevicePlayback/addByRSSResourceDataForHash.test.ts
apps/web/src/lib/crossDevicePlayback/remotePlayerResourceStore.ts
apps/web/src/lib/crossDevicePlayback/remotePlayerResourceStore.test.ts
apps/web/src/lib/crossDevicePlayback/remotePlaybackClock.ts
apps/web/src/lib/crossDevicePlayback/remotePlaybackClock.test.ts
apps/web/src/hooks/useRemotePlayerResource.ts
apps/web/src/hooks/useRemotePlaybackPositionSeconds.ts
apps/web/src/hooks/usePlaybackResourceLoader.ts
apps/web/src/hooks/useCrossDevicePlaybackTransfer.ts

## Decisions this plan fixes

- **Resolve once per item, for every view at once.** One module store keyed by the ref. Every hook
  instance (three player layouts, two strips, buttons, rows) reads the same state; the first one to
  see a new ref starts the load, later ones find it running.
- **Resolve as soon as the remote view shows,** not on the first click, so the channel link, the
  strip, and Add by RSS availability are ready without a wait. It costs the two or three requests
  the local player already makes for an item it loads.
- **A failed or empty load is `missing`** until the ref changes; no retry timer. Nothing is
  logged: a deleted item or a feed this browser never parsed is expected.
- **Add by RSS needs this browser's copy of the item.** The record is `ready` only when the
  now-playing row holds the hash and `resolveAddByRSSIndexItemFromResourceData` finds the item
  in this browser's stored feeds. Otherwise it is `missing`, which is the one case where plan 42
  disables Add to Playlist ("an Add by RSS item whose data this browser lacks").
- **One position clock per tab.** A single 250 ms interval runs while any view listens and the
  shared status is `playing`; views read whole seconds and re-render only when the second (or the
  chapter they care about) changes. This replaces a per-component interval, so a chapter list of
  any length costs one timer.
- **Display only** (**playback-meaningful-events**): nothing here writes the MediaPlayer context,
  the current-time context, history, a queue, or a saved position. It never reads this tab's
  media element duration; plan 42 and plan 43 read `duration_seconds` from the shared state.

## `fetchPlaybackResourceDtos.ts`

```typescript
import type { DTOChannel, DTOClip, DTOItem, DTOItemSoundbite } from '@podverse/helpers';
import type { DTOPlaybackResourceRef } from '@podverse/helpers';

export type PlaybackResourceDtos = {
  channel: DTOChannel;
  item: DTOItem;
  clip: DTOClip | null;
  itemSoundbite: DTOItemSoundbite | null;
};

/**
 * Channel and item records (plus the clip or official clip) for a database ref; null for an Add
 * by RSS ref or when any request returns nothing. Request errors propagate.
 */
export async function fetchPlaybackResourceDtos(
  ref: DTOPlaybackResourceRef
): Promise<PlaybackResourceDtos | null>;
```

Move the request sequence from `usePlaybackResourceLoader.ts` steps `item`, `clip`, and
`soundbite` here unchanged (the same `getApiRequestService()` calls, in the same order, with the
same field reads). `add_by_rss` → null.

In `usePlaybackResourceLoader.ts`, replace those three steps with one call:
`const dtos = await fetchPlaybackResourceDtos(resource);` then build the same target from
`dtos` as before (`playbackTargetLivestream` or `playbackTargetFromStandardLoad` with the clip or
official clip). A null result keeps the existing "missing fetch result" path
(`clearCommandStartSeek()`, resolve false); a thrown request keeps the existing catch. The loader's
other steps, staging, and options stay exactly as they are.

## `addByRSSResourceDataForHash.ts`

```typescript
import type { AddByRSSResourceData, DTOQueueResource } from '@podverse/helpers';

/** The first row whose Add by RSS identity equals `hash`, or null. */
export function pickAddByRSSResourceDataForHash(
  rows: readonly (DTOQueueResource | null)[],
  hash: string
): AddByRSSResourceData | null;

/**
 * Looks in each queue's now-playing row, in the order given, for the Add by RSS item with
 * `hash`. The device that played it wrote that row.
 */
export async function findAddByRSSResourceDataForHash(params: {
  queueIdTexts: readonly string[];
  hash: string;
}): Promise<AddByRSSResourceData | null>;
```

- `pick…`: for each non-null row with a non-null `add_by_rss_resource_data`, compare
  `addByRSSPlaybackIdentity(row.add_by_rss_resource_data)` (from
  `../../hooks/playbackHandoffState`) with `hash`; first match wins.
- `find…`: the request loop plan 24 wrote inline (`reqQueueResourcesGetNowPlayingByQueueIdText`
  per queue id, in order), collecting each response's row, then `pick…`. Stop at the first match.
  A queue whose request throws is skipped. If the implemented response wraps the row differently
  from `DTOQueueResource | null`, adapt `find…` and keep `pick…`'s signature.

In `useCrossDevicePlaybackTransfer.ts`, replace the inline lookup with
`findAddByRSSResourceDataForHash({ queueIdTexts: queues.map((q) => q.id_text), hash })`, keeping
the same "no match → report `load_failed`" path. Nothing else in that hook changes.

## `remotePlayerResourceStore.ts`

```typescript
import type { DTOItemChapter, DTOPlaybackResourceRef } from '@podverse/helpers';
import type { AddByRSSResourceDataPayload } from '@podverse/parser-mapping';

import type { PlaybackResourceDtos } from './fetchPlaybackResourceDtos';

export type RemotePlayerResource =
  | ({ kind: 'database'; itemChapters: DTOItemChapter[] | null } & PlaybackResourceDtos)
  | {
      kind: 'add_by_rss';
      /** The index item's id text, for the Add by RSS item page. */
      idText: string;
      /**
       * `buildAddByRSSResourceData(indexItem)`: the shape rows pass to the playlist modal and
       * `usePlayAddByRSS` stores as `mpAddByRSS.resourceData`.
       */
      resourceData: AddByRSSResourceDataPayload;
      /** `getAddByRSSHashId(indexItem)`. */
      hashId: string | null;
    };

export type RemotePlayerResourceState =
  | { status: 'none'; key: null }
  | { status: 'loading'; key: string }
  | { status: 'ready'; key: string; resource: RemotePlayerResource }
  | { status: 'missing'; key: string };

export type RemotePlayerResourceRequest = {
  ref: DTOPlaybackResourceRef | null;
  isLive: boolean;
  queueIdTexts: readonly string[];
};

export function playbackResourceRefKey(ref: DTOPlaybackResourceRef): string;

export function loadRemotePlayerResource(
  request: RemotePlayerResourceRequest & { ref: DTOPlaybackResourceRef }
): Promise<RemotePlayerResource | null>;

export function createRemotePlayerResourceStore(deps: {
  load: (
    request: RemotePlayerResourceRequest & { ref: DTOPlaybackResourceRef }
  ) => Promise<RemotePlayerResource | null>;
}): {
  getState(): RemotePlayerResourceState;
  subscribe(listener: () => void): () => void;
  /** Starts a load when the ref's key differs from the current one; same key does nothing. */
  ensure(request: RemotePlayerResourceRequest): void;
  /** Resolves with the state once it is not `loading` (at once when it already is not). */
  whenSettled(): Promise<RemotePlayerResourceState>;
};

export const remotePlayerResourceStore: ReturnType<typeof createRemotePlayerResourceStore>;
```

- `playbackResourceRefKey`: `` `${ref.kind}:${id}` `` with the kind's one id field (narrow on
  `ref.kind`, no `as`).
- `loadRemotePlayerResource`, by `ref.kind`:
  - `item`, `clip`, `soundbite`: `const dtos = await fetchPlaybackResourceDtos(ref)`; null → null.
    Chapters: when `ref.kind === 'item'` and `!isLive`,
    `(await getApiRequestService().reqItemParseAndGetChapters(dtos.item.id_text)).data`; an empty
    array becomes null; a thrown chapters request becomes null without failing the whole load.
    Other kinds and live items: `itemChapters: null`. Return `{ kind: 'database', ...dtos, itemChapters }`.
  - `add_by_rss`: `findAddByRSSResourceDataForHash({ queueIdTexts, hash: ref.add_by_rss_hash_id })`;
    null → null. Then `resolveAddByRSSIndexItemFromResourceData(data)` (from
    `../../utils/addByRSS/playFromQueueResource`); null, or an index item whose `idText` is empty
    or missing → null. Otherwise
    `{ kind: 'add_by_rss', idText, resourceData: buildAddByRSSResourceData(indexItem), hashId: getAddByRSSHashId(indexItem) }`
    (both builders from `@podverse/parser-mapping`, as `AddByRSSEpisodeRow.tsx` imports them).
- `createRemotePlayerResourceStore`:
  - State starts `{ status: 'none', key: null }`. Listeners in a `Set`; notify on every state
    change.
  - `ensure`: `ref === null` → state `none` (bump the generation so an in-flight load is
    dropped). Key equal to the current state's key → return. Otherwise bump a generation counter,
    set `{ status: 'loading', key }`, call `deps.load(request)`. On settle, apply only when the
    generation is unchanged (**input-rate-control**, concurrent reads): a value → `ready`; null or
    a thrown error → `missing`.
  - `whenSettled`: when not `loading`, `Promise.resolve(getState())`; otherwise a promise that
    resolves on the next state change whose status is not `loading`.
- `remotePlayerResourceStore = createRemotePlayerResourceStore({ load: loadRemotePlayerResource })`.

## `remotePlaybackClock.ts`

```typescript
/** Whole seconds of the playing device's estimated position; null when unknown or live. */
export function getRemotePlaybackWholeSeconds(): number | null;

/**
 * Notifies when the whole-second estimate changes. While anyone listens and the shared status
 * is `playing`, one 250 ms interval runs for the whole tab.
 */
export function subscribeRemotePlaybackClock(listener: () => void): () => void;
```

- `read()`: `const v = crossDevicePlaybackStore.getEstimatedPositionSeconds(); return v === null ? null : Math.floor(v);`
- Module state: `listeners`, `cached: number | null`, `intervalId`, `unsubscribeStore`.
- `sync()`: `const next = read(); if (next !== cached) { cached = next; notify(); }`, then start
  the interval when `crossDevicePlaybackStore.getSnapshot().displayState?.status === 'playing'` and
  none runs, or clear it when the status is anything else.
- First subscriber: `unsubscribeStore = crossDevicePlaybackStore.subscribe(sync)`, then `sync()`.
  Last unsubscribe: clear the interval and call `unsubscribeStore`.
- The interval callback is `sync`.
- `getRemotePlaybackWholeSeconds`: `listeners.size === 0 ? read() : cached`, so a read with no
  subscriber is still current and a subscribed read is stable between notifications
  (`useSyncExternalStore` requires that).
- `REMOTE_POSITION_TICK_MS = 250` is file-local.

## `useRemotePlaybackPositionSeconds.ts`

```typescript
import type { DTOItemChapter } from '@podverse/helpers';

/** Whole-second estimate of the remote position, advancing while it plays; null when disabled, live, or unknown. */
export function useRemotePlaybackPositionSeconds(enabled: boolean): number | null;

/**
 * `id_text` of the chapter the playing device is in, by the same rule the local player uses to
 * follow chapters (`selectItemChapterForTime`); null when disabled, without chapters, or between
 * chapters. Re-renders only when that id changes.
 */
export function useRemoteActiveChapterIdText(
  chapters: DTOItemChapter[] | null,
  enabled: boolean
): string | null;
```

- Both use `useSyncExternalStore` with server snapshot `() => null`.
- Position: `subscribe = enabled ? subscribeRemotePlaybackClock : subscribeNothing` (a file-local
  `() => () => {}`), `getSnapshot = enabled ? getRemotePlaybackWholeSeconds : getNull`.
- Chapter: same subscribe; `getSnapshot` returns
  `!enabled || chapters === null ? null : (() => { const t = getRemotePlaybackWholeSeconds(); return t === null ? null : selectItemChapterForTime(chapters, t)?.id_text ?? null; })()`,
  wrapped in `useCallback` on `[enabled, chapters]`. `selectItemChapterForTime` from
  `../lib/playback`. The snapshot is a string or null, so a tick that stays in the same chapter does
  not re-render.

## `useRemotePlayerResource.ts`

```typescript
import type { RemotePlayerResourceState } from '../lib/crossDevicePlayback/remotePlayerResourceStore';

/** The remote item's records; `none` when this tab is not showing another device's item. */
export function useRemotePlayerResource(): RemotePlayerResourceState;
```

- `role = useCrossDevicePlaybackSnapshot((s) => s.role)`,
  `resource = useCrossDevicePlaybackSnapshot((s) => s.displayState?.resource ?? null)`,
  `isLive = useCrossDevicePlaybackSnapshot((s) => s.displayState?.is_live ?? false)`.
- `ref = role === 'remote' ? (resource?.ref ?? null) : null`;
  `key = ref === null ? null : playbackResourceRefKey(ref)`.
- `const { queues } = useQueues();` kept in a ref updated each render.
- `useEffect(() => { remotePlayerResourceStore.ensure({ ref, isLive, queueIdTexts: queuesRef.current.map((q) => q.id_text) }); }, [key, isLive])`
  (read `ref` through a ref too, so the effect runs only when the key or live flag changes).
- `state = useSyncExternalStore(remotePlayerResourceStore.subscribe, remotePlayerResourceStore.getState, getServerState)`.
- Return `state` when `state.key === key`; otherwise a memoized `{ status: 'none', key: null }`
  when `key === null`, else a memoized `{ status: 'loading', key }`. That covers the render
  before the effect starts the new load.

Outside `CrossDevicePlaybackProvider` the snapshot hook reads the singleton (role `idle`), so the
hook returns `none` and starts nothing. If `useQueues()` throws outside its provider, every caller
is inside it already (the player and the content pages); do not add a guard.

## Must stay true

- `usePlaybackResourceLoader` and `useCrossDevicePlaybackTransfer` behave exactly as before.
- One load per ref change in a tab, however many views read it; a stale load never overwrites a
  newer ref's state.
- At most one position interval per tab, and none while paused, loading, live, or unwatched.
- No write to the MediaPlayer context, history, queue, or saved position.

## Tests

Vitest:

- `addByRSSResourceDataForHash.test.ts`: `pickAddByRSSResourceDataForHash` returns the first
  matching row's data, skips null rows and rows without Add by RSS data, and returns null when no
  identity matches.
- `remotePlayerResourceStore.test.ts` (inject `load`): `ensure` with a new ref goes `loading` then
  `ready`; the same key again does not call `load` a second time; a newer ref while the first
  load is pending ends `ready` with the newer value even when the first resolves last; a null
  result and a rejected load both give `missing`; `ensure({ ref: null })` gives `none` and drops
  the pending load; `whenSettled` resolves at once when settled and after the load otherwise.
  `playbackResourceRefKey` gives distinct keys for an item and a clip with the same id text.
- `remotePlaybackClock.test.ts` (fake timers; `vi.mock` the store module with a controllable
  snapshot, `subscribe`, and estimate): a subscriber is notified when the estimate crosses a whole
  second and not within it (10.2 then 10.9 → no notify; 11.1 → notify); no interval while the
  status is `paused` (advancing timers does not read the estimate again); a store notification
  with a new status starts or stops the interval; the last unsubscribe clears the interval and
  the store subscription; with no subscriber `getRemotePlaybackWholeSeconds` reads the estimate
  directly.

Plan 47's Playwright spec covers the views that read this data.

## Release scratchpad

none (no visible change on its own; plans 42 and 46 describe what users see)
