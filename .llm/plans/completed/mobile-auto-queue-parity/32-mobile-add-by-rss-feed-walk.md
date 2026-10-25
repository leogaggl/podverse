**Cursor model:** Opus 5.5 · **Reasoning:** high

# 32 — Mobile Add by RSS next and previous through the feed

An Add by RSS episode that ends or is skipped plays the next newer item in its feed; Previous
plays the next older one. Today mobile clears now-playing at the end of an Add by RSS item unless
the manual queue has rows, and Previous only restarts.

Parity source: web `useAddByRSSPlayNext.tsx`, `useAddByRSSPlayPrevious.tsx`,
`resolveListContextFromCurrentItem.ts` (episodes by publish date, newest first; livestreams in
channel order), and plan 11's `@podverse/playback-core/addByRSSListWalk`. Next is always the newer
neighbor and Previous the older one.

## Rows

R18, R25

## Runs after

11, 31

## Files

apps/mobile/src/lib/addByRss/feedWalk.ts (new)
apps/mobile/src/lib/addByRss/feedWalk.test.ts (new)
apps/mobile/src/lib/addByRss/localResourceData.ts
apps/mobile/src/hooks/useAddByRssPlayback.ts
apps/mobile/src/playback/useAddByRssFeedWalk.ts (new)
apps/mobile/src/playback/PlaybackProvider.tsx
apps/mobile/vitest.config.ts
release-notes/scratchpad.md

## Design

### Pure feed walk (`lib/addByRss/feedWalk.ts`)

```typescript
export type AddByRssFeedPlayEntry = {
  idText: string;
  resourceData: AddByRSSResourceData;
  localDownloadItemIdText?: string;
};

export type AddByRssFeedWalk = {
  entries: ReadonlyMap<string, AddByRssFeedPlayEntry>;
  context: AddByRSSListContextState | null;
};

export function addByRssEpisodePlayEntry(
  feed: MobileAddByRSSFeedRecord,
  mappedFeed: AddByRSSMappedFeed,
  itemBundle: AddByRSSMappedFeed['items'][number],
  itemIndex: number
): AddByRssFeedPlayEntry | null;

export function buildAddByRssFeedWalk(
  feed: MobileAddByRSSFeedRecord,
  mappedFeed: AddByRSSMappedFeed,
  current: AddByRSSResourceData,
  now?: Date
): AddByRssFeedWalk;
```

- `addByRssEpisodePlayEntry`: null when the item has no enclosure URL (the same check
  `useAddByRssPlayback.playItem` makes). Otherwise `resourceData` from
  `toAddByRssItemPlaybackResourceData`, `localDownloadItemIdText` from `addByRssDownloadItemIdText`,
  and `idText = addByRssPlaybackMediaId(resourceData)`. `useAddByRssPlayback.playItem` uses it, so
  a row tap and a feed step build the same request.
- `buildAddByRssFeedWalk`, when `current` is a livestream (`isAddByRssLivestreamResourceData`):
  entries from `toAddByRssFeedLiveRows(feed, mappedFeed, now)` (the feed page's channel order),
  each through `toAddByRssLiveItemPlaybackResourceData`, skipping rows without an enclosure URL.
  The ordered ids are that order.
- Otherwise episodes: entries from `addByRssEpisodePlayEntry` for every item, with
  `pubDateMs = new Date(pub_date).getTime()` (missing or invalid reads 0, sorting oldest), ordered
  with `orderAddByRSSEpisodeIdTexts(…, 'recent')`.
- `context = buildAddByRSSListContext({ feedIdText: feed.feedUrl, orderedIdTexts, currentIdText:
  addByRssPlaybackMediaId(current), sortOrder: 'recent' })`. Null when the playing item is not in
  this device's copy of the feed (for example a server queue row from a feed this device has not
  parsed); that item then has no feed next or previous.

### Feed walk hook (`playback/useAddByRssFeedWalk.ts`)

`useAddByRssFeedWalk({ activeTargetRef })`, called once in `PlaybackProvider`. It holds
`addByRssFeedWalkRef: { mediaId: string; walk: AddByRssFeedWalk } | null` and React state
`hasAddByRssNext`. Returns, with stable identities:

- `ensureAddByRssFeedWalk(): Promise<AddByRssFeedWalk | null>` — for an `add-by-rss` target, when
  the ref's `mediaId` is not the playing target's `playbackTargetRowMediaId`, load the feed with
  `loadLocalFeed(addByRssRepository, resourceData.feed_url)` (now exported from
  `localResourceData.ts`, unchanged otherwise), build the walk, and store it only if the same
  target is still playing. Sets `hasAddByRssNext` from
  `resolveAddByRSSAdjacentStep(context, 'next').kind === 'step'`. A non-Add-by-RSS target, a
  missing `feed_url`, or a failed read clears the ref and returns null. Concurrent calls for the
  same media id share one promise.
- `resolveAddByRssAdjacentEntry(direction): Promise<AddByRssFeedPlayEntry | null>` — ensure the
  walk, `resolveAddByRSSAdjacentStep(walk.context, direction)`, and return the entry for a `step`.
  The context is rebuilt from the playing item after each load, so `nextContext` and
  `clearContext` need no separate handling: the rebuilt context is what web's would be.
- `clearAddByRssFeedWalk()`.

### PlaybackProvider (by symbol)

- `startAddByRssPlayback`: after a successful load, `void ensureAddByRssFeedWalk()`.
- `playTarget`: a successful load of any non-Add-by-RSS target calls `clearAddByRssFeedWalk()`, as
  web clears its list context when the player moves off Add by RSS. `clearNowPlaying` clears it too.
- New `playAddByRssFeedEntry(entry)`: `startAddByRssPlayback(entry.resourceData, { autoQueue:
  { mode: 'clear' }, localDownloadItemIdText: entry.localDownloadItemIdText })`; returns whether
  the playing target changed.
- `computeHasAutoQueueNext`: for an `add-by-rss` target, the walk's `next` step exists.
- `advance`: keep the order (history, then the manual queue for the playing medium, then the
  automatic next). In the `advance-auto-queue` branch, an `add-by-rss` target uses
  `resolveAddByRssAdjacentEntry('next')` and `playAddByRssFeedEntry` instead of
  `advanceAutoQueue`. Before computing `hasAutoQueueNext` for an Add by RSS target, await
  `ensureAddByRssFeedWalk()` so an item that ends right after it starts still advances.
- `resolveHasAutoQueueRow` (used by `probeHasQueueAhead`): for an `add-by-rss` target, ensure the
  walk and return whether a `next` step exists.
- `runPreviousTrack` (plan 31): for an `add-by-rss` target, `resolveAddByRssAdjacentEntry('previous')`
  and `playAddByRssFeedEntry`; none seeks to 0. The chapter and 3-second rules in `skipToPrevious`
  apply first, as on web.
- Keep the names and `() => Promise<void>` signatures of `skipToNext`, `skipToPrevious`,
  `skipToNextTrack`, `skipToPreviousTrack`, and `advance`.

### Where the walk lives (for area D)

`useAddByRssFeedWalk`'s `addByRssFeedWalkRef` holds the context and the play entries by id. It is
rebuilt after every Add by RSS load. Area D reads ahead with
`selectAddByRSSAdjacentIdTexts(walk.context, 'next', n)` and maps ids through `walk.entries`.

## Constraints

- Feed reads go through `addByRssRepository` (via `loadLocalFeed`), never SQLite directly.
- Comments describe the code as it stands; no plan numbers.

## Tests

- `feedWalk.test.ts` (Vitest, fixture `AddByRSSMappedFeed` like `localResourceData.test.ts` uses):
  episodes order newest first whatever the feed order; Next from the middle gives the newer item
  and Previous the older; the newest item has no Next and the oldest no Previous; items without an
  enclosure are left out; a missing pub date sorts oldest; a livestream walks the channel live
  order; a resource that is not in the feed gives a null context.
- The existing `add-by-rss.yaml` / `add-by-rss-track.yaml` flows keep passing; plan 33 adds the
  device assertion for the Next button.

## Release scratchpad

```markdown
## Mobile Add by RSS plays through the feed

- Surfaces: mobile
- Change: when an Add by RSS episode ends or you press Next, mobile plays the next newer episode in that feed (after anything in your queue), and Previous plays the next older one, as on web. Livestreams step through the feed's live list. Before, the player stopped at the end of an Add by RSS episode.
- Who notices: mobile listeners who play feeds added by RSS
- Operator steps: none
```
