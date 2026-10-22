# 93 — Now-playing chapters and transcript for Add by RSS items

**Cursor model:** Cursor Grok 4.7 · **Reasoning:** extra high

Rows: R64 (Add by RSS chapters and transcript in the mobile full player), the data half. Plan 94
draws the full player's chips and panes from what this plan loads. Mobile only.

Runs after `35-add-by-rss-chapters-transcript-data.md` (`getAddByRssChaptersAndTranscript`,
`addByRssItemSectionUrls`), `51-player-add-by-rss-episode-link.md` (`addByRssEpisodeItemKey` in
`localResourceData.ts`), and `90-add-by-rss-playing-row.md` (`addByRssPlaybackMediaId`). Plan 94
runs after this one.

Today `useNowPlayingChapters` and `useActiveNowPlayingChapter`
(`apps/mobile/src/playback/useNowPlayingChapters.ts`) return nothing for an Add by RSS target, so
neither player names chapters, shows chapter artwork, or marks the scrubber, and chapter prev/next
falls back to item skips (`resolveChaptersForTarget` in `PlaybackProvider.tsx` returns `[]`).

## Locked decisions

1. **Parity source** is the directory episode: chapters drive the segment band, chapter artwork
   (**mobile-chapter-artwork**), scrubber marks, and chapter prev/next, through the same
   components. No component gains an Add by RSS branch; they receive a chapter list.
2. **Data source** is this device's parsed copy of the feed, matched the way
   `resolveLocalAddByRssResourceData` matches (canonical feed URL, then guid or enclosure, confirmed
   by hash id). The request is plan 35's `getAddByRssChaptersAndTranscript` with the same
   `itemIdText` the episode page sends (`${record.idText}-${itemKey}`). An item from a feed this
   device has not parsed gets no chapters or transcript. Livestreams get neither.
3. **One now-playing store** holds the source and the loaded sections for the item now playing,
   keyed by `addByRssPlaybackMediaId`. A new item replaces it. Plan 94's panes read the same store,
   so the player loads once per item.
4. **When it loads.** Chapters load automatically when the item links a chapters file, the
   account is signed in, and Offline Mode is off. That is the directory behavior (chapters load on
   play). A transcript-only item loads when plan 94's Transcript chip is chosen. A failed load
   stays failed until a pane's Retry; nothing retries on its own.
5. **Account privacy.** The sections may come from a private feed fetched with this account's
   saved credentials. The store is cleared in the SyncProvider sign-out effect, and a session
   generation drops answers that arrive after a reset or a new item
   (**mobile-account-scoped-data**). Nothing is persisted. This replaces plan 35's "no module
   cache" concern for the player: the cache lives for one item and one session only.
6. **Chapter images on private feeds** load without credentials and fall back to the item artwork
   when the host refuses (R66, deferred to `add-by-rss-private-chapter-artwork-deferred/`).

## Files

All paths are under `apps/mobile/`.

| File                                                   | Change                                |
| ------------------------------------------------------ | ------------------------------------- |
| `src/lib/addByRss/localResourceData.ts`                | `findAddByRssLocalItem` and source    |
| `src/lib/addByRss/localResourceData.test.ts`           | Source cases                          |
| `src/playback/addByRssNowPlayingSectionsStore.ts`      | New store factory (pure)              |
| `src/playback/addByRssNowPlayingSectionsStore.test.ts` | New                                   |
| `src/playback/nowPlayingAddByRssSections.ts`           | New singleton, hook, transport helper |
| `src/playback/useNowPlayingChapters.ts`                | Add by RSS chapters                   |
| `src/playback/PlaybackProvider.tsx`                    | `resolveChaptersForTarget` branch     |
| `src/sync/SyncProvider.tsx`                            | Reset on sign-out                     |
| `vitest.config.ts`                                     | Include the store test                |

`PlaybackProvider.tsx` is large: Grep `const resolveChaptersForTarget` and read that window.
`SyncProvider.tsx`: Grep `Signing out drops queued account work`.

## Implementation

### `localResourceData.ts`

After plan 51 this file has the private `findLocalItemIndex` and `addByRssEpisodeItemKey`.

New export `findAddByRssLocalItem(mappedFeed: AddByRSSMappedFeed, resourceData:
AddByRSSResourceData): AddByRssLocalItem | null`, doc "The parsed item a resource points at, keyed
by guid or index; null for livestreams.", where `AddByRssLocalItem` is `{ itemBundle:
AddByRSSMappedFeed['items'][number]; itemIndex: number; itemKey: string }`.

```typescript
export type AddByRssNowPlayingItemSource = {
  feedUrl: string;
  itemBundle: AddByRSSMappedFeed['items'][number];
  itemIdText: string;
  sectionUrls: AddByRssItemSectionUrls | null;
};

/**
 * This device's parsed copy of the Add by RSS item a resource points at, for the player's
 * chapters, transcript, Summary, and People. Null for livestreams, a feed this device has not
 * parsed, or an item the parsed feed no longer lists.
 */
export async function resolveAddByRssNowPlayingItemSource(
  resourceData: AddByRSSResourceData,
  lookup: LocalAddByRssFeedLookup
): Promise<AddByRssNowPlayingItemSource | null> { … }
```

- `findAddByRssLocalItem`: livestream (`isAddByRssLivestreamResourceData`) → `null`;
  `findLocalItemIndex(mappedFeed, toNonEmptyTrimmedString(resourceData.guid),
  toNonEmptyTrimmedString(resourceData.enclosure_url))`; `mappedFeed.items[itemIndex]` undefined →
  `null`; else `{ itemBundle, itemIndex, itemKey: toNonEmptyTrimmedString(itemBundle.item.guid) ??
  String(itemIndex) }`.
- `addByRssEpisodeItemKey` becomes `findAddByRssLocalItem(mappedFeed, resourceData)?.itemKey ??
  null`. Keep its doc comment.
- A private `loadLocalFeed(lookup, feedUrl): Promise<{ mappedFeed; record } | null>` holds the
  `Promise.all` plus `try`/`catch` and the null checks that `resolveLocalAddByRssResourceData`
  has today. That function uses it and `findAddByRssLocalItem`; its behavior does not change.
- `resolveAddByRssNowPlayingItemSource`: `rowData = withCanonicalAddByRssFeedUrl(resourceData)`;
  livestream → `null`; `toNonEmptyTrimmedString(rowData.feed_url)` null → `null`;
  `loadLocalFeed` null → `null`; `findAddByRssLocalItem(mappedFeed, rowData)` null → `null`;
  `getAddByRSSHashId(toAddByRssItemPlaybackResourceData(record, mappedFeed, local.itemBundle,
  local.itemIndex)) !== getAddByRSSHashId(rowData)` → `null`; else `{ feedUrl: record.feedUrl,
  itemBundle: local.itemBundle, itemIdText: `${record.idText}-${local.itemKey}`, sectionUrls:
  addByRssItemSectionUrls(local.itemBundle) }`.
- Imports: `addByRssItemSectionUrls` and type `AddByRssItemSectionUrls` from `./itemSections`
  (plan 35).

### `addByRssNowPlayingSectionsStore.ts`

No native imports, so vitest can load it.

```typescript
export type AddByRssNowPlayingSectionsStatus = 'error' | 'idle' | 'loaded' | 'loading';
export type AddByRssNowPlayingSourceStatus = 'idle' | 'resolved' | 'resolving' | 'unavailable';

export type AddByRssNowPlayingSectionsSnapshot = {
  key: string | null;
  sections: AddByRssItemSections | null;
  sectionsStatus: AddByRssNowPlayingSectionsStatus;
  source: AddByRssNowPlayingItemSource | null;
  sourceStatus: AddByRssNowPlayingSourceStatus;
};

export const IDLE_ADD_BY_RSS_NOW_PLAYING_SECTIONS: AddByRssNowPlayingSectionsSnapshot = {
  key: null,
  sections: null,
  sectionsStatus: 'idle',
  source: null,
  sourceStatus: 'idle',
};

/** Chapters and transcript for the Add by RSS item now playing, one item and session at a time. */
export function createAddByRssNowPlayingSectionsStore<Context>(deps: {
  fetchSections: (
    context: Context,
    source: AddByRssNowPlayingItemSource
  ) => Promise<AddByRssItemSections>;
  resolveSource: (
    resourceData: AddByRSSResourceData
  ) => Promise<AddByRssNowPlayingItemSource | null>;
}) { … }
```

- `addByRssNowPlayingSectionsKey(resourceData: AddByRSSResourceData | null): string | null`, the
  store key: `null` or a livestream → `null`; else `addByRssPlaybackMediaId(resourceData)` (plan
  90, `../lib/addByRss/resourceData`).
- `shouldAutoLoadAddByRssNowPlayingChapters(input: { isAuthenticated: boolean;
  offlineModeEnabled: boolean; snapshot: AddByRssNowPlayingSectionsSnapshot }): boolean`:
  `isAuthenticated && !offlineModeEnabled &&
  snapshot.sourceStatus === 'resolved' && snapshot.sectionsStatus === 'idle' &&
  snapshot.source?.sectionUrls?.chaptersFeedUrl !== undefined`. With `source === null` the chain
  is `undefined`, so the result is `false`.
- Factory state: `let snapshot = IDLE_…`, `let generation = 0`, `let inFlight: { generation:
  number; promise: Promise<AddByRssItemSections | null> } | null = null`, and a listener `Set`.
  `setSnapshot(next)` assigns and calls every listener. Return an object with:
  - `getSnapshot()` and `subscribe(listener)` (returns the unsubscribe), for
    `useSyncExternalStore`.
  - `track(resourceData: AddByRSSResourceData | null): void`. `key =
    addByRssNowPlayingSectionsKey(resourceData)`. Same as `snapshot.key` → return. Otherwise
    `generation += 1`, `inFlight = null`. `key === null` (or `resourceData === null`) →
    `setSnapshot(IDLE_…)` and return. Else `const trackGeneration = generation`,
    `setSnapshot({ ...IDLE_…, key, sourceStatus: 'resolving' })`, then
    `deps.resolveSource(resourceData)`. On resolve, when `trackGeneration === generation`:
    `setSnapshot({ ...snapshot, source, sourceStatus: source === null ? 'unavailable' :
    'resolved' })`. On reject, when current: `setSnapshot({ ...snapshot, sourceStatus:
    'unavailable' })`.
  - `load(context: Context): Promise<AddByRssItemSections | null>`. `source === null` or
    `source.sectionUrls === null` → `Promise.resolve(null)`. `sectionsStatus === 'loaded'` →
    `Promise.resolve(snapshot.sections)`. `inFlight?.generation === generation` → that promise.
    Otherwise `const loadGeneration = generation`, `setSnapshot({ ...snapshot, sectionsStatus:
    'loading' })`, and build the promise from `deps.fetchSections(context, source)`. On resolve,
    when current: `setSnapshot({ ...snapshot, sections, sectionsStatus: 'loaded' })` and return
    `sections`. On reject, when current: `setSnapshot({ ...snapshot, sectionsStatus: 'error' })`.
    A result that is not current returns `null`. In `finally`, clear `inFlight` when its
    generation is `loadGeneration`. Assign `inFlight = { generation: loadGeneration, promise }`
    before returning it. `error` is a valid start state, so a Retry is just `load`.
  - `reset(): void`: `generation += 1`, `inFlight = null`, `setSnapshot(IDLE_…)`.
- No logging on a failed fetch; plan 94's pane shows the error.

### `nowPlayingAddByRssSections.ts`

```typescript
export const nowPlayingAddByRssSections =
  createAddByRssNowPlayingSectionsStore<MobileAuthRequestContext>({
    fetchSections: (context, source) =>
      segmentsRepository.getAddByRssChaptersAndTranscript(context, {
        feedUrl: source.feedUrl,
        itemBundle: source.itemBundle,
        itemIdText: source.itemIdText,
      }),
    resolveSource: (resourceData) =>
      resolveAddByRssNowPlayingItemSource(resourceData, {
        getFeedByUrl: (feedUrl) => addByRssRepository.getFeedByUrl(feedUrl),
        getMappedFeedByUrl: (feedUrl) => addByRssRepository.getMappedFeedByUrl(feedUrl),
      }),
  });
```

- `useNowPlayingAddByRssSections(resourceData: AddByRSSResourceData | null):
  AddByRssNowPlayingSectionsSnapshot`: `useSyncExternalStore` on the singleton's `subscribe` and
  `getSnapshot` (closures, stable across renders); `key = useMemo(() =>
  addByRssNowPlayingSectionsKey(resourceData), [resourceData])`; `useEffect(() => {
  nowPlayingAddByRssSections.track(resourceData); }, [resourceData, snapshot.key])` (the
  `snapshot.key` dependency re-tracks after a reset); return `snapshot.key === key ? snapshot :
  IDLE_ADD_BY_RSS_NOW_PLAYING_SECTIONS`, so a render never shows the previous item's sections.
- `resolveNowPlayingAddByRssChapters(context, resourceData): Promise<DTOItemChapter[]>`, for
  transport: key mismatch or `null` → `[]`; `sectionsStatus === 'loading'` → `(await
  nowPlayingAddByRssSections.load(context))?.chapters ?? []` (joins the request in flight); else
  `snapshot.sections?.chapters ?? []`. It never starts a request.
- Imports `MobileAuthRequestContext`, `addByRssRepository`, and `segmentsRepository` from
  `../data`, as `useNowPlayingChapters.ts` does.

### `useNowPlayingChapters.ts`

- `useNowPlayingChapters`: also read `status` from `useAuth()` and `const { enabled:
  offlineModeEnabled } = useOfflineMode()` (`../prefs/offlineMode`). `const
  addByRssResourceData = activeTarget?.kind === 'add-by-rss' ? activeTarget.resourceData :
  null;` and `const addByRssSections = useNowPlayingAddByRssSections(addByRssResourceData);`.
- New effect: when `shouldAutoLoadAddByRssNowPlayingChapters({ isAuthenticated: status ===
  'authenticated', offlineModeEnabled, snapshot: addByRssSections })`, `void
  nowPlayingAddByRssSections.load({ accessToken, clearSession, refreshToken, setTokens })`.
  Depend on those values and `addByRssSections`.
- Return: `activeTarget?.kind === 'add-by-rss'` → `{ chapters: addByRssSections.sections?.chapters
  ?? EMPTY_CHAPTERS }` (module constant `const EMPTY_CHAPTERS: DTOItemChapter[] = [];`); else the
  existing return. Keep the directory effects as they are.
- Doc comment: chapters load once per now-playing item. Directory episodes use the process-wide
  cache; Add by RSS items use the now-playing Add by RSS store, which needs a signed-in account
  and Offline Mode off.
- `useActiveNowPlayingChapter`: remove `activeTarget.kind === 'add-by-rss' ||` from the null list.
  Livestreams stay excluded; an Add by RSS livestream has no chapters anyway.

### `PlaybackProvider.tsx`

At the top of `resolveChaptersForTarget` (import from `./nowPlayingAddByRssSections`):

```typescript
if (target.kind === 'add-by-rss') {
  return resolveNowPlayingAddByRssChapters(buildContext(), target.resourceData);
}
```

`hasEpisodeChaptersForTrackButtons` (`previousAction.ts`) already accepts an Add by RSS target with
chapters, so the transport row's chapter buttons follow with no change.

### `SyncProvider.tsx`

In the `status === 'anonymous'` effect, after `syncQueue.reset();`, call
`nowPlayingAddByRssSections.reset();`. Extend the comment above the effect: signing out also drops
the now-playing Add by RSS chapters and transcript, which this account's saved feed credentials
may have fetched.

### `vitest.config.ts`

Add `'src/playback/addByRssNowPlayingSectionsStore.test.ts'` beside the other `src/playback/`
entries, in the list's order.

## Tests

- `localResourceData.test.ts`. Give the fixture's Episode Two `podcastChapters: { type:
  'application/json+chapters', url: 'https://example.com/chapters.json' }` (the existing cases
  compare data built from that same fixture, so they still pass). New
  `describe('resolveAddByRssNowPlayingItemSource')`:
  - this device's copy of Episode Two → `itemIdText` `'phone-channel-7-episode-guid-2'`, `feedUrl`
    `FEED_URL`, `sectionUrls.chaptersFeedUrl` the chapters URL;
  - a feed this device has not parsed (`lookup(null, null)`) → `null`;
  - a livestream row (`liveItem: {}`) → `null`;
  - a guid the feed does not list and no enclosure match → `null`.
- `addByRssNowPlayingSectionsStore.test.ts` (new), with fake deps and hand-resolved promises:
  - `track` resolves the source; tracking the same item twice calls `resolveSource` once;
  - `load` twice while in flight calls `fetchSections` once, and the snapshot ends `loaded`;
  - a fetch that rejects leaves `error`; a second `load` fetches again;
  - an answer that arrives after `reset()` or after tracking another item is dropped (the
    snapshot stays idle, or on the new item);
  - `shouldAutoLoadAddByRssNowPlayingChapters`: true only for a resolved source with a chapters
    URL, idle sections, signed in, and Offline Mode off; false for a transcript-only source.
- No hook test: the hooks and `PlaybackProvider` are outside the vitest suite. Plan 94's Maestro
  steps prove chapters reach the full player.

## Release scratchpad

```markdown
## Mobile Add by RSS episodes show their chapters while playing

- Surfaces: mobile
- Change: When an Add by RSS episode or track links a chapters file, the player loads its
  chapters through the account API as it plays, the same way it does for other episodes. The
  current chapter names the full player's segment band and the mini player's bar, chapter images
  replace the artwork, the scrubber marks chapters, and the chapter skip buttons step through
  them. It needs a signed-in account, it does not load in Offline Mode, and signing out clears
  it. Only feeds this device has parsed are covered. Chapter images on feeds that need a username
  and password load without them and fall back to the episode artwork.
- Who notices: anyone who plays podcasts added by RSS on the phone
- Operator steps: none
```
