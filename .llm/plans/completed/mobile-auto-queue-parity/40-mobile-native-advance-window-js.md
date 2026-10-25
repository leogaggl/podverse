**Cursor model:** Opus 5.5 · **Reasoning:** high

# 40 — Mobile writes a native advance window of resolved next rows

JS writes one new native cache file, the **advance window**: the flat play order after the playing
item. That is the manual queue's upcoming rows for the playing medium, then up to 10 resolved
automatic rows: auto-queue rows (items, clips, and soundbites) for a regular target, or the next
Add by RSS episodes from the feed walk for an Add by RSS episode. Native code (plans 41 and 42)
walks it when JS is not running, so CarPlay, Android Auto, the lock screen, and `ended` keep
advancing with the app closed. JS refills the window whenever it runs. All choices about what comes
next stay in TypeScript; native only steps through the list.

Parity source: the in-app next rule as mobile implements it after plans 30–33. Manual queue for the
playing medium first, played the way `playQueueResource` plays each row; then the auto-queue rows
`useAutoQueueFill` resolved, played the way `playAutoQueueRow` plays them; or, for an Add by RSS
episode, the feed walk `useAddByRssFeedWalk` built. The window is a snapshot of that order; it adds
no rule of its own.

## Rows

R5, R9, R11, R19, R20, R21, R29, R30

## Runs after

33

## Files

apps/mobile/src/data/nativeCache/projection.ts
apps/mobile/src/data/nativeCache/projection.test.ts
apps/mobile/src/data/nativeCache/index.ts
apps/mobile/src/data/nativeCache/queueEntryMapping.ts (new)
apps/mobile/src/data/nativeCache/queueEntryMapping.test.ts (new)
apps/mobile/src/data/nativeCache/advanceWindow.ts (new)
apps/mobile/src/data/nativeCache/advanceWindow.test.ts (new)
apps/mobile/src/data/nativeCache/carCacheReproject.ts
apps/mobile/src/data/repositories/queueRepository.ts
apps/mobile/src/data/repositories/queueProjectionHelpers.ts
apps/mobile/src/lib/playback/mediaEngineSourceMeta.ts
apps/mobile/src/lib/playback/mediaEngineSourceMeta.test.ts
apps/mobile/src/lib/addByRss/playbackUrl.ts (new)
apps/mobile/src/lib/addByRss/playbackUrl.test.ts (new)
apps/mobile/src/playback/addByRssMediaAuth.ts
apps/mobile/src/bridge/nativePlaybackBridge.ts
apps/mobile/modules/podverse-media-engine/src/PodverseMediaEngineModule.ts
apps/mobile/modules/podverse-media-engine/src/NativePlaybackBridge.ts
apps/mobile/src/playback/useNativeAdvanceWindow.ts (new)
apps/mobile/src/playback/useAutoQueueFill.ts
apps/mobile/src/playback/useAddByRssFeedWalk.ts
apps/mobile/src/playback/PlaybackProvider.tsx
apps/mobile/vitest.config.ts
release-notes/scratchpad.md

## Answers to the question rows

- **R5 — does mobile need to differ for native and car clients?** Yes, in one place. Native code
  cannot run the TypeScript auto-queue walk, so mobile keeps a bounded list of already-resolved
  rows in a native file and refills it while JS runs. The order and the sources are the same as
  in-app; only the delivery differs. Web needs nothing like it.
- **R9 — car and other clients.** CarPlay, Android Auto, and the lock screen advance through the
  window with the app closed. Another TypeScript client reuses `fillAutoQueueAhead` with its own
  `AutoQueueSourceFetchers` (plan 10). A native client (a watch, a car head unit) reads the
  advance-window file; its contract is below and in the media-engine README (plan 43).
- **R29 — clips and soundbites.** Clip and soundbite rows join the window as entries with `kind`,
  `clipStartSeconds`, and `clipEndSeconds`; they no longer end it. Every row is identified by
  `kind` plus `idText` (the values the engine meta records), so a clip and its full episode are two
  distinct rows. Plans 41 and 42 pass the bounds into the load meta and advance at a clip's end.
- **R30 — Add by RSS episodes.** For an Add by RSS episode, the automatic part is the next
  `NATIVE_ADVANCE_WINDOW_AUTO_ROWS` episodes from the shared feed walk, as plain media URLs. An
  entry whose remote URL would need the feed's credentials, or carries userinfo, has no
  `mediaUrl`; with no download either, it ends the window. Nothing credential-shaped is written.
  Livestreams stay manual-queue only. Native matches an Add by RSS entry by `kind: "add_by_rss"`
  and its media id, the same `idText` the engine meta records.

## Design

### Payload contract (`projection.ts`)

New file `advance-window.json`, written through bridge method `writeAdvanceWindow(payloadJson)`.
It uses the existing envelope at `NATIVE_CACHE_SCHEMA_VERSION` 2. A new file is additive, so the
version does not change; native builds without the file never read it.

```typescript
/** Engine meta `kind` values a queue entry can carry. Missing means `item`. */
export type NativeCacheQueueEntryKind = 'item' | 'clip' | 'item_soundbite' | 'add_by_rss';

/** Engine meta `kind` of the item a window continues from. */
export type AdvanceWindowAnchorKind = NativeCacheQueueEntryKind | 'livestream';

export type AdvanceWindowProjection = {
  /** Must equal the engine meta's `queueMedium` for native to use the window. */
  mediumBucket: NativeCacheMediumBucket;
  /** Engine `meta.idText` of the item the window continues from. Null: nothing playing. */
  anchorIdText: string | null;
  /** Engine `meta.kind` of that item. Null exactly when `anchorIdText` is null. */
  anchorKind: AdvanceWindowAnchorKind | null;
  /** Play order after the anchor. Never contains the anchor. */
  entries: NativeCacheQueueEntry[];
};
export type AdvanceWindowCachePayload = NativeCacheEnvelope & AdvanceWindowProjection;
```

`NativeCacheQueueEntry` changes:

- `kind?: NativeCacheQueueEntryKind | null` (was `string`). The account snapshot already writes
  `'item'`; the type now names the values native reads.
- Add `clipStartSeconds?: number | null` and `clipEndSeconds?: number | null`: the range a clip
  or soundbite plays, the same values `mediaEngineSourceMetaFromTarget` puts in the meta.
- Add `downloadFileName?: string | null`. Native already parses it on both platforms
  (`PodverseCarPlayCacheModel.parseQueueSnapshot`, `PodverseNativeCacheModel.parseQueueSnapshot`)
  and prefers the local file when present.

Also add `'writeAdvanceWindow'` to the `NativeCacheWriteMethod` union, `buildAdvanceWindowPayload`
(same shape as `buildQueueSnapshotPayload`: `withEnvelope`), and
`projectAdvanceWindowToNativeCache(window)` through `writeToNativeCache`, so an install whose
native build lacks the method soft-fails like the other writers. Re-export the new types, builder,
and projector from `nativeCache/index.ts`, next to the queue snapshot ones.

### Bridge

- `PodverseMediaEngineModule.ts` (native module type) and `NativePlaybackBridge.ts` (interface):
  add `writeAdvanceWindow(payloadJson: string): Promise<void>` after `writeQueueSnapshotMusic`,
  with the doc comment "Play order after the playing item, for native advance while JS is not
  running."
- `apps/mobile/src/bridge/nativePlaybackBridge.ts`: forwarder after `writeQueueSnapshotMusic`, same
  form.
- `NativePlaybackBridge.ts`, `setJsOwnsAdvance` doc comment: state that native also takes advance
  back when the module that installed the event sink goes away (plans 41 and 42 implement it).

### Engine identity and clip bounds (`mediaEngineSourceMeta.ts`)

The window must name items the way the engine meta does, because native compares the two.
`playbackTargetRowMediaId` is not that id for chapters (it returns the chapter id; the meta carries
the item id), so the window uses the meta's own helpers:

- Export `queueMediumFromTarget` unchanged (it fills `meta.queueMedium`).
- `export const engineSourceIdentityFromTarget = (target: PlaybackTarget): { kind:
  MediaEngineSourceMeta['kind']; idText: string } | null` — `idTextFromTarget` and
  `metaKindFromTarget`, null when the id is null or empty (the case where
  `mediaEngineSourceMetaFromTarget` returns null). `mediaEngineSourceMetaFromTarget` calls it, so
  there is one source for both values.
- `export const clipBoundsForClip = (clip: Pick<DTOClip, 'start_time' | 'end_time'>)` and
  `export const clipBoundsForSoundbite = (soundbite: Pick<DTOItemSoundbite, 'start_time' |
  'duration'>)`, each returning `{ start: number | null; end: number | null }` with the bodies of
  the clip and soundbite branches of `clipBoundsFromTarget`, which now calls them.

### One queue-entry mapper (`queueEntryMapping.ts`)

Today the account snapshot entry is built twice: `toNativeCacheEntry` in `queueRepository.ts`
(duration from `media_file_duration`, no `kind`) and `toQueueEntry` in `carCacheReproject.ts`
(duration from `item_about.duration`, `kind: 'item'`). Collapse them (**reuse-beyond-components**),
and add the window's row mappers next to them:

- `resolveNativeCacheMediaUrl(enclosures: DTOItemEnclosure[]): string | null` —
  `resolveItemEnclosureUrl({ labeledItemEnclosures: buildLabeledItemEnclosures(enclosures),
  selectedParams: DEFAULT_ENCLOSURE_SELECTED_PARAMS })`. Replaces `resolveMediaUrl` in
  `carCacheReproject.ts` (its other callers, `toChildItem` and the live index, switch to it).
- `nativeCacheDurationMs(item: { item_about?: DTOItemAbout | null }, mediaFileDuration?:
  number | string | null): number | null` — `mediaFileDuration` when finite and > 0, else
  `item_about.duration`, as milliseconds, rounded. Replaces `durationMsFromItem`.
- `nativeQueueEntryFromQueueResource(resource: DTOQueueResource, options?: { downloadFileName?:
  string | null }): NativeCacheQueueEntry | null` — the account snapshot entry, item-based as
  today: null without `resource.item`. Fields: `title ?? id_text`,
  `primaryListArtworkUrl(item.item_images, item.channel?.channel_images)`,
  `itemArtistNames(item)`, `podcastTitle`, `startPositionSeconds` from `playback_position` (> 0
  else null), `durationMs` from `nativeCacheDurationMs(item, resource.media_file_duration)`,
  `kind: 'item'`, and `downloadFileName` only when the option is given. The window does not use
  it.
- `nativeAdvanceIdentityKey(identity: { kind: string; idText: string }): string` —
  `` `${kind}:${idText}` ``. The window's dedupe key and, in plan 44, the saved-source key.
- `advanceIdentityFromAutoQueueRow(row: AutoQueueResourcesMapRow): { kind:
  NativeCacheQueueEntryKind; idText: string }` — in `playAutoQueueRow`'s branch order: a clip row
  is `{ kind: 'clip', idText: row.clip.id_text }`; a soundbite row whose soundbite has an item is
  `{ kind: 'item_soundbite', idText: row.item_soundbite.id_text }`; anything else is
  `{ kind: 'item', idText: row.item.id_text }`.
- `autoQueueRowFromQueueResource(resource: DTOQueueResource): AutoQueueResourcesMapRow` — a
  manual queue row in the auto-queue row shape, so both parts share one mapper: `item:
  resource.item`, `clip: resource.clip ?? null`, `item_soundbite: resource.item_soundbite ??
  null`, `channel: resource.item?.channel ?? resource.clip?.item?.channel ??
  resource.item_soundbite?.item?.channel ?? null`. Callers handle Add by RSS rows first.
- `nativeQueueEntryFromAutoQueueRow(row: AutoQueueResourcesMapRow, options: {
  downloadFileNameFor: (itemIdText: string) => string | null; startPositionSeconds: number | null;
  mediaFileDuration?: number | string | null }): NativeCacheQueueEntry | null`. The media item is
  `row.clip.item` for a clip row, `row.item_soundbite.item` for a soundbite row, and `row.item`
  otherwise (the `advanceIdentityFromAutoQueueRow` order). It returns null, ending the window,
  when:
  - the row is a clip whose `clip.item` is missing (`playAutoQueueRow` returns false there);
  - the media item or the row's item is missing;
  - the media item carries a non-null `live_item` (`DTOItemQueueItem` has no such field, so check
    with `'live_item' in mediaItem`; full `DTOItem`s from manual and clip rows do). Native loads
    entries with `isLive: false`, so a livestream stops the window there;
  - there is neither a media URL (`resolveNativeCacheMediaUrl(mediaItem.item_enclosures)`) nor
    `downloadFileNameFor(mediaItem.id_text)`.

  Otherwise `idText` and `kind` from `advanceIdentityFromAutoQueueRow`; channel = `row.channel ??
  mediaItem.channel ?? null`; artwork `primaryListArtworkUrl(mediaItem.item_images,
  channel?.channel_images)`; `podcastTitle` `channel?.title ?? null`; `artist`
  `verifiedArtistNames({ channel, item: mediaItem })`; `durationMs` from
  `nativeCacheDurationMs(mediaItem, options.mediaFileDuration)`; `downloadFileName` from
  `downloadFileNameFor(mediaItem.id_text)`.
  - Item rows: `title` `mediaItem.title ?? mediaItem.id_text`; `startPositionSeconds` from the
    option; no clip fields.
  - Clip rows: `title` `clip.title ?? mediaItem.title ?? clip.id_text`; bounds from
    `clipBoundsForClip(clip)`; `startPositionSeconds` and `clipStartSeconds` are the bound's
    start, `clipEndSeconds` its end. Saved progress is not used: a clip plays its range.
  - Soundbite rows: the same with `clipBoundsForSoundbite(soundbite)` and `soundbite.title`.
- `nativeQueueEntryFromAddByRss(media: AdvanceWindowAddByRssMedia): NativeCacheQueueEntry | null`
  (type below). Null when `isAddByRssLivestreamResourceData(media.resourceData)`, or when both
  `media.mediaUrl` and `media.downloadFileName` are null. Otherwise `idText:
  addByRssPlaybackMediaId(media.resourceData)`, `kind: 'add_by_rss'`, `title` the resource data's
  non-empty `title` else the id, `artworkUrl` `primaryListArtworkUrl(item_images ?? [],
  channel_images ?? []) ?? null` (as `artworkFromTarget` does), `podcastTitle` the non-empty
  `channel_title` else null, `durationMs: null` (the resource data has no typed duration; the
  engine reports it after the load), `mediaUrl`, `downloadFileName`, `startPositionSeconds`.

`queueRepository.toNativeCacheEntry` and `carCacheReproject.toQueueEntry` are deleted; their
callers use `nativeQueueEntryFromQueueResource(resource)`. The account snapshot output keeps every
field it has today; `durationMs` now falls back to `item_about.duration` in the repository path
and prefers `media_file_duration` in the reproject path, and `kind: 'item'` is now set on both.

Imports: `AutoQueueResourcesMapRow` as a type from `@podverse/playback-core/autoQueue` (plan 30's
path for auto-queue types); `buildLabeledItemEnclosures` from `@podverse/helpers/item/itemEnclosure`;
`primaryListArtworkUrl` from `@podverse/helpers`; `ItemPlaybackProgress` type from
`../repositories/queueProjectionHelpers`; `addByRssPlaybackMediaId` from
`../../lib/addByRss/resourceData`; the clip-bound helpers from
`../../lib/playback/mediaEngineSourceMeta`. The module imports no repository values, so neither
`queueRepository` nor `carCacheReproject` gains a cycle.

`queueProjectionHelpers.ts`:

- Widen `ItemProgressLookup` to `(item: Pick<DTOItem, 'id' | 'id_text'>) => ItemPlaybackProgress
  | null` (it reads only those two fields), so a `DTOItemQueueItem` can be looked up.
- Add `readAddByRssProgressForProjection(accountIdText: string | null): Promise<(mediaId: string)
  => ItemPlaybackProgress | null>`: the `playbackLocalState` rows for the account with
  `resourceKind` `'add_by_rss'`, keyed by `resourceIdText` (the Add by RSS media id that
  `playbackEventSource` records), with `played` from `completed === 1`. Signed out it returns
  `() => null`, as `readItemProgressForProjection` does. Share the row query with
  `readItemProgressForProjection` through a private helper that takes the resource kind.

`carCacheReproject.ts`: export `completeDownloadMap` and `readProgressLookup` unchanged, for the
composer.

### Add by RSS media URL (`lib/addByRss/playbackUrl.ts`)

The window must write the URL the app itself would load. Move, unchanged, from
`PlaybackProvider.tsx` into this new module: `isAddByRssResourceData`,
`hasAddByRssLivestreamStartTime` (private), and `resolveAddByRssPlaybackUrl` (exported).
`PlaybackProvider` imports the two exported ones and keeps its calls as they are. Add:

- `hasUrlUserinfo(url: string): boolean` — true when the URL's authority holds `user@` or
  `user:pass@` (`/^[a-z][a-z0-9+.-]*:\/\/[^/?#]*@/i`).

### Plain-URL check (`playback/addByRssMediaAuth.ts`)

`export async function createAddByRssPlainUrlCheck(feedUrl: string | null): Promise<(mediaUrl:
string) => boolean>`:

- `feedUrl === null` returns `() => true` (`withAddByRssPlaybackAuth` attaches nothing then).
- Otherwise read the credentials once through the private `readCredentials(feedUrl)` and return
  `(mediaUrl) => decideAddByRssPlaybackAuth({ allowInsecure:
  isAddByRssInsecureCredentialsAllowedFromEnv(), credentials: isRemoteHttpUrl(mediaUrl) ?
  credentials : null, feedUrl: resolveE2eMediaUrl(feedUrl), mediaUrl }).basicAuth === null`.
- The doc comment states the contract: the closure answers whether a load of that URL would go
  out without the feed's credentials; it never returns or stores them. It does not touch
  `lastPlaybackCredentials`.

This is the same decision `withAddByRssPlaybackAuth` makes for a load, so an entry is written with
a remote URL exactly when the app would load that URL without credentials.

### Window composer (`advanceWindow.ts`)

```typescript
export const NATIVE_ADVANCE_WINDOW_AUTO_ROWS = 10;

export type AdvanceWindowAutoQueueState = {
  resources: AutoQueueResourcesMap;
  activeRow: number;
  disabled: boolean;
};

/** An Add by RSS episode the composer already resolved; `mediaUrl` is null when unsafe to write. */
export type AdvanceWindowAddByRssMedia = {
  resourceData: AddByRSSResourceData;
  mediaUrl: string | null;
  downloadFileName: string | null;
  startPositionSeconds: number | null;
};

export type AdvanceWindowManualRow =
  | { kind: 'resource'; resource: DTOQueueResource }
  | { kind: 'add-by-rss'; media: AdvanceWindowAddByRssMedia };

export function buildAdvanceWindow(input: {
  target: PlaybackTarget | null;
  manual: AdvanceWindowManualRow[];
  autoQueue: AdvanceWindowAutoQueueState;
  addByRssAhead: AdvanceWindowAddByRssMedia[];
  downloadFileNameFor: (itemIdText: string) => string | null;
  progressFor: ItemProgressLookup;
}): AdvanceWindowProjection;

export type AdvanceWindowComposition = {
  projection: AdvanceWindowProjection;
  /** Feed URL of each Add by RSS entry in the window, by its `idText`. Never written to native. */
  addByRssFeedUrls: ReadonlyMap<string, string>;
};

export async function composeAdvanceWindow(input: {
  target: PlaybackTarget | null;
  autoQueue: AdvanceWindowAutoQueueState;
  addByRssFeedWalk: AddByRssFeedWalkState | null;
}): Promise<AdvanceWindowComposition>;
```

`buildAdvanceWindow` (pure):

1. `target === null`: `{ mediumBucket: 'av', anchorIdText: null, anchorKind: null, entries: [] }`.
1. `anchor = engineSourceIdentityFromTarget(target)`; `mediumBucket =
   queueMediumFromTarget(target)`. A null anchor gives the bucket with a null anchor and no
   entries.
1. Manual part, in order. A `resource` row maps through
   `nativeQueueEntryFromAutoQueueRow(autoQueueRowFromQueueResource(resource), {
   downloadFileNameFor, startPositionSeconds: playback_position when finite and > 0 else null,
   mediaFileDuration: resource.media_file_duration })`; an `add-by-rss` row through
   `nativeQueueEntryFromAddByRss(media)`. The first null ends the window: no later manual row and
   no automatic row is added.
1. Automatic part, only when the manual part did not end the window:
   - `autoQueueSeedFromPlaybackTarget(target) !== null` and not `autoQueue.disabled`:
     `selectAutoQueueRowsAhead(resources, activeRow, NATIVE_ADVANCE_WINDOW_AUTO_ROWS)`, each
     through `nativeQueueEntryFromAutoQueueRow(row, { downloadFileNameFor, startPositionSeconds })`
     where the start is the saved position when `progressFor(row.item)` is not played and > 0,
     else null ("a played item starts over", the rule `toChildItem` uses). Stop at the first null.
   - An `add-by-rss` target that is not a livestream: `addByRssAhead`, each through
     `nativeQueueEntryFromAddByRss`. Stop at the first null.
   - Anything else (a livestream, a disabled auto-queue for a regular target): no automatic part.
1. Concatenate manual then automatic. Drop any entry whose `nativeAdvanceIdentityKey` is the
   anchor's or already present (first one wins), so a row in both parts plays once, at its manual
   position, and a clip never collides with its full episode.

`composeAdvanceWindow` reads the stores and calls the builder. Reads only; never the network.

- `readCachedQueueIds()`, then `readQueueCachesForProjection(queueId).upcoming` for the queue
  matching `queueMediumFromTarget(target)` (empty when that id is null or the target is null).
- `completeDownloadMap()` and `readProgressLookup()`; `readAddByRssProgressForProjection` with the
  account id read the way `readProgressLookup` reads it (a failure gives `() => null`).
- Plain-URL checks are created once per feed URL per run and kept in a local `Map`.
- An Add by RSS media value is built as `{ resourceData, mediaUrl, downloadFileName,
  startPositionSeconds }`, where `url = resolveAddByRssPlaybackUrl(resourceData)` and `mediaUrl =
  url` only when `url !== null`, `!hasUrlUserinfo(url)`, and the feed's plain-URL check passes;
  otherwise null. The feed URL is `addByRssFeedUrlForTarget({ kind: 'add-by-rss', resourceData })`;
  when it is non-null it goes into `addByRssFeedUrls` under the entry's media id.
- Manual rows: a resource with `isAddByRssResourceData(resource.add_by_rss_resource_data)` becomes
  an `add-by-rss` row from `resolveLocalAddByRssResourceData(data, addByRssRepository)` (what
  `playQueueResource` plays), with `downloadFileName: null` (`playQueueResource` passes no local
  download) and the start from `playback_position`. Every other resource is a `resource` row.
- `addByRssAhead`, only for an `add-by-rss` target that is not a livestream, when
  `addByRssFeedWalk?.mediaId === playbackTargetRowMediaId(target)` and its `walk.context` is not
  null: `selectAddByRSSAdjacentIdTexts(walk.context, 'next', NATIVE_ADVANCE_WINDOW_AUTO_ROWS)`,
  each id through `walk.entries.get(id)`, stopping at the first missing one. Each entry becomes a
  media value with `downloadFileName` from the download map under `entry.localDownloadItemIdText`
  (null when absent) and the start from the Add by RSS progress lookup under `entry.idText`, using
  the played/position rule above. The anchor's own feed URL also goes into `addByRssFeedUrls`.

### Writer hook (`useNativeAdvanceWindow.ts`)

`useNativeAdvanceWindow({ activeTarget, addByRssFeedWalk }: { activeTarget: PlaybackTarget | null;
addByRssFeedWalk: AddByRssFeedWalkState | null }): void`, called once in `PlaybackProvider`.

- Reads `autoQueueResources`, `autoQueueActiveRow`, and `autoQueueConfig` from `useAutoQueue()`,
  and `useQueueDataRevision()`. Those auto-queue values change only through `useAutoQueueFill`'s
  `writeAutoQueueState`, so every applied refill and every active-row step rewrites the window.
- One effect on `[activeTarget, addByRssFeedWalk, autoQueueResources, autoQueueActiveRow,
  autoQueueConfig, revision]` stores the inputs in a ref and requests a write.
- Nothing is written until `activeTarget` has been non-null once in this JS run (a ref). At
  launch the target is null until restore or adoption settles; writing then would empty the
  window the engine may still be walking, and the saved source plan 44 reads during adoption.
  After that, a null target (the player was cleared) writes the empty window.
- Writes are single-flight and latest-wins: while a write runs, further requests set a pending
  flag; when it finishes and the flag is set, it runs once more with the latest inputs. No timers,
  no debounce. Each run is `projectAdvanceWindowToNativeCache((await
  composeAdvanceWindow(...)).projection)`. A failure logs under `__DEV__` the way
  `carCacheReproject`'s `soft` does and is otherwise dropped; the next change writes again.

### `useAddByRssFeedWalk.ts`

Add React state `addByRssFeedWalk: AddByRssFeedWalkState | null`, set in the same places
`addByRssFeedWalkRef.current` is set or cleared, and return it. Export `type AddByRssFeedWalkState
= { mediaId: string; walk: AddByRssFeedWalk }` and use it for the ref's type. Nothing else in the
hook changes. The state lets the window hook rewrite once the walk for a new episode is built.

### `useAutoQueueFill.ts`

`AUTO_QUEUE_MIN_ROWS_AHEAD = NATIVE_ADVANCE_WINDOW_AUTO_ROWS` (10), imported from
`../data/nativeCache/advanceWindow`, with a one-line comment that the fill keeps as many rows ahead
as the native advance window carries. `fillAutoQueueAhead` then fetches while fewer than 10 rows
are ahead (bounded by its `maxFetches` of 3 per call). Nothing else in the hook changes.

### `PlaybackProvider.tsx` (by symbol)

- Import `isAddByRssResourceData` and `resolveAddByRssPlaybackUrl` from
  `../lib/addByRss/playbackUrl` and delete the local copies (and `hasAddByRssLivestreamStartTime`).
- Call `useNativeAdvanceWindow({ activeTarget, addByRssFeedWalk })` once, after the `activeTarget`
  state, the `useAutoQueueFill` call, and the `useAddByRssFeedWalk` call are all declared.
- `adoptEngineSource`: after `writeLastPlaybackSnapshotForTarget(target, positionSeconds)`, call
  `void refillAutoQueueAhead()` when `channel.id_text !== ''`. A channel built from engine meta
  has an empty id, and the seed's channel id picks the source. Add `refillAutoQueueAhead` to the
  callback's dependency list.
- `enrichAdoptedSource`: after `setNowPlaying(summaryFromItem(item, channel))`, call
  `void refillAutoQueueAhead()`. Add it to the dependency list.

These two calls are how JS refills from the adopted item's own podcast or album. Plan 44 adds the
saved-source continuation in front of them and the clip, soundbite, and Add by RSS adoption.

### `queueRepository.clearAll`

After emptying both queue snapshots, also call `projectAdvanceWindowToNativeCache({ mediumBucket:
'av', anchorIdText: null, anchorKind: null, entries: [] })` (loaded through the same dynamic
`import` of `../nativeCache/projection`). The window holds manual queue rows, which are account
data (**mobile-account-scoped-data**).

## Constraints

- Native code receives a list and an anchor only. No source choice, no paging, no shuffle, no
  repeat in native.
- No credential reaches the native cache: no `basicAuth`, no `Authorization` header, no URL with
  userinfo, and no remote URL the app would load with the feed's credentials
  (**add-by-rss-client-held-credentials**). Feed URLs stay in JS (`addByRssFeedUrls`).
- The window is a prefix of the in-app play order: a row native cannot play as given ends it;
  nothing is skipped.
- Livestream targets get the manual part only; a livestream row ends the window.
- Nothing in the hook blocks first paint or awaits the network.
- Comments describe the code as it stands; no plan numbers. `import type` on its own line; no
  `as`; `===` only; named exports.

## Tests

- `advanceWindow.test.ts` (Vitest), `buildAdvanceWindow`:
  - null target gives an empty window with null anchor id and kind;
  - manual rows come before automatic rows, and the anchor never appears;
  - an identity in both parts appears once, at its manual position; a clip row and an item row
    for the same episode both appear;
  - a chapter target anchors on its item id with kind `item`; a clip target anchors on the clip id
    with kind `clip`;
  - a clip row and a soundbite row carry their kind, range, and a start equal to the range start;
    auto rows never exceed `NATIVE_ADVANCE_WINDOW_AUTO_ROWS`;
  - a manual row that maps to null ends the window, with no automatic rows after it;
  - `disabled` and a livestream target give the manual part only;
  - an Add by RSS episode target takes `addByRssAhead` in order, stops at an entry with neither a
    URL nor a download, and stops at a livestream entry;
  - `mediumBucket` is `music` for a music item target and `av` for a podcast item;
  - a downloaded row carries `downloadFileName`.
- `queueEntryMapping.test.ts`:
  - the row mapper returns null for a clip without `clip.item`, for an item with `live_item`, and
    for a row with no URL and no download;
  - a played item row has a null start, an unfinished one carries its position; a clip ignores
    progress;
  - a soundbite without an item maps as its row's item;
  - `nativeQueueEntryFromAddByRss` keeps an entry with a download and a null `mediaUrl`, and
    returns null for a livestream;
  - `nativeCacheDurationMs` prefers `media_file_duration` and falls back to `item_about.duration`.
- `playbackUrl.test.ts`: `hasUrlUserinfo` is true for `https://u:p@host/a.mp3` and
  `https://u@host/a.mp3`, false for `https://host/a.mp3?u=a@b`; `resolveAddByRssPlaybackUrl`
  prefers the bundle enclosure and falls back to `enclosure_url`.
- `mediaEngineSourceMeta.test.ts`: `engineSourceIdentityFromTarget` returns the meta's `kind` and
  `idText` for item, chapter, clip, soundbite, and Add by RSS targets; the soundbite end is start
  plus duration only when the duration is > 0.
- `projection.test.ts`: add `writeAdvanceWindow` to the bridge mock;
  `projectAdvanceWindowToNativeCache` calls it once with `schemaVersion: 2`, `mediumBucket`,
  `anchorIdText`, `anchorKind`, and `entries`.
- The plain-URL check has no unit test: it is a closure over `decideAddByRssPlaybackAuth`, which
  `mediaAuth.test.ts` already covers.
- No Maestro flow: the behavior needs the JS runtime gone, which Maestro cannot hold. Plan 43 adds
  the CarPlay and Android Auto checklist steps.

## Release scratchpad

```markdown
## Car and lock screen keep advancing through the auto-queue with the app closed

- Surfaces: mobile
- Change: the app writes a new native cache file, `advance-window.json`, holding what plays after the current item: the manual queue for that medium, then up to 10 automatic rows the app already resolved. For a regular item those are auto-queue rows (next episode by publish date, next album track by season order, or the next playlist row), including clips and soundbites, which play their own start-to-end range. For an Add by RSS episode they are the next episodes of that feed. When the app is not running, CarPlay, Android Auto, the lock screen Next button (music), and the end of an episode move through that list instead of stopping once the manual queue runs out. The app refills the list whenever it runs. The in-app auto-queue now keeps 10 rows resolved ahead instead of 1. The list stops at a livestream, and at an Add by RSS episode whose media needs the feed's password and is not downloaded; feed passwords and auth headers are never written to the file. Sign-out empties it.
- Who notices: listeners using CarPlay, Android Auto, or the lock screen with the phone app closed
- Operator steps: none; needs a native build that includes the advance-window reader
```
