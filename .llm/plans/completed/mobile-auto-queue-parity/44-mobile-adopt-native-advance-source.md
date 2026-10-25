**Cursor model:** Opus 5.5 · **Reasoning:** high

# 44 — Mobile continues the saved advance source when it adopts a native-started item

When the app's JS runs again and adopts an item the engine is already playing (one native advanced
to with the app closed, or one the car started), JS now continues the auto-queue source the window
was built from, if the playing item belongs to it. An item in the account queue (the manual queue)
keeps that source behind it, unchanged, the same as a manual-queue load in the app. Otherwise JS
refills from the item's own podcast or album, as plan 40 wired. To know the source after an app
restart, the window hook saves it on the device each time it writes the window. Adoption also
learns the window's other kinds: a clip or soundbite is adopted as that clip or soundbite, and an
Add by RSS episode as that episode, instead of a whole item built from the engine's metadata.

Parity source: in-app playback of the same rows. A clip row plays as `startClipPlayback` builds it,
a soundbite row as `startSoundbitePlayback`, an Add by RSS episode as `startAddByRssPlayback`, a
manual queue row as `playQueueResource` plays it (`{ mode: 'preserve' }`: the auto-queue buffer and
its active row stay as they are), and the auto-queue buffer continues as `useAutoQueueFill` would
have continued it had JS stayed alive.

## Rows

R29, R30, R31, R32

## Runs after

40

## Files

apps/mobile/src/lib/playback/nativeAdvanceSource.ts (new)
apps/mobile/src/lib/playback/nativeAdvanceSource.test.ts (new)
apps/mobile/src/data/repositories/nativeAdvanceSourceRepository.ts (new)
apps/mobile/src/data/repositories/queueRepository.ts
apps/mobile/src/playback/useNativeAdvanceWindow.ts
apps/mobile/src/lib/playback/engineSourceAdoption.ts
apps/mobile/src/lib/playback/engineSourceAdoption.test.ts
apps/mobile/src/lib/addByRss/feedWalk.ts
apps/mobile/src/lib/addByRss/feedWalk.test.ts
apps/mobile/src/playback/PlaybackProvider.tsx
apps/mobile/vitest.config.ts
release-notes/scratchpad.md

## Answers to the question rows

- **R31 — which source continues when JS returns.** The app-closed fallback is plan 40's: an item
  the car starts that is not in the window walks the account queue snapshot. When JS adopts the
  playing item, it reads the saved advance source. If the item is in the account queue (R32 below),
  the whole saved buffer is restored as it was. Otherwise, if the item's `kind` plus `idText` is
  one of the saved auto-queue rows, the buffer is restored from that row on with the saved config
  (playlist, shuffle, repeat, paging), and the fill continues it. If it is one of the saved Add by
  RSS episodes, the episode is adopted from the device's copy of its feed and the feed walk is
  rebuilt from it. Otherwise the buffer is cleared and refilled from the item's own podcast or
  album.
- **R32 — a manual-queue item the car started.** When the adopted item is in the device's copy of
  the account queue (now playing or upcoming, podcast or Music queue) and the saved source has an
  auto-queue buffer, every saved row is restored with the saved config and active row 0, which is
  the row that was active when the source was saved. That is what `playQueueResource` does in the
  app: a manual-queue load passes `{ mode: 'preserve' }`, so the buffer and its active row stay,
  and the saved playlist, album, or podcast resumes after the queue empties. This holds when the
  item is not one of the saved rows. An episode that is neither a saved row nor in the account
  queue, even from the same podcast, still refills from its own podcast or album. The app-closed
  fallback does not change: an item outside the window walks the account queue snapshot.
  - **How membership is known.** Adoption reads the account queue from SQLite (`queue_cache`),
    which native never writes, so it still holds what the phone last synced: the rows native
    advanced through and the rows the car's Queue tab lists. Neither the saved source nor the
    advance window records the manual rows.
  - **Which ids count.** A queue row matches when the engine names it either way it can: by the
    window's identity (`advanceIdentityFromAutoQueueRow`, so a clip row is `clip` plus the clip id)
    or by the account snapshot's identity (`item` plus `resource.item.id_text`; the car's Queue tab
    plays the whole item). An Add by RSS row matches by `add_by_rss` plus its media id.
  - **Order.** The manual check comes before the saved-row check. Native puts a row that is both
    manual and automatic at its manual position (plan 40's dedupe), so the engine reached it as a
    manual-queue item.
- **Where the source lives.** In SQLite (`kv_meta`), because the process that wrote it is gone
  after the app closes. It holds auto-queue rows (account-visible playlist content), so sign-out
  deletes it with the window.
- **R29 and R30 in adoption.** Clip, soundbite, and Add by RSS meta are no longer looked up as
  items. A saved row or saved feed gives the whole target with no network. Without one, a clip or
  soundbite is shown from the engine's metadata and then fetched by its own kind; an Add by RSS
  episode with no saved feed is shown from the metadata and gets no refill. An Add by RSS episode
  in the account queue is adopted from that queue row, as `playQueueResource` would play it.

## Design

### Saved source (`lib/playback/nativeAdvanceSource.ts`, pure)

```typescript
export const NATIVE_ADVANCE_SOURCE_VERSION = 1 as const;

export type NativeAdvanceSourceRow = {
  kind: NativeCacheQueueEntryKind;
  idText: string;
  row: AutoQueueResourcesMapRow;
};

export type NativeAdvanceSourceV1 = {
  v: typeof NATIVE_ADVANCE_SOURCE_VERSION;
  anchor: { kind: AdvanceWindowAnchorKind; idText: string };
  /** The auto-queue buffer from the active row through the highest key, with its config. */
  autoQueue: { config: AutoQueueConfig; rows: NativeAdvanceSourceRow[] } | null;
  /** Add by RSS entries in the window (the anchor too, when it is one), with their feed URL. */
  addByRss: { idText: string; feedUrl: string }[];
  updatedAtMs: number;
};

export type AdoptedQueueCaches = {
  nowPlaying: DTOQueueResource | null;
  upcoming: DTOQueueResource[];
};

export type AdoptedContinuation = {
  /** Saved auto-queue buffer to restore at active row 0. Null: refill from the item's own source. */
  autoQueue: { resources: AutoQueueResourcesMap; config: AutoQueueConfig } | null;
  /** The saved auto-queue row or account queue row the adopted item plays as. */
  row: AutoQueueResourcesMapRow | null;
  /** Feed URL of an adopted Add by RSS episode that the saved source lists. */
  addByRssFeedUrl: string | null;
};
```

- `buildNativeAdvanceSource(input: { target: PlaybackTarget | null; resources:
  AutoQueueResourcesMap; activeRow: number; config: AutoQueueConfig; addByRssFeedUrls:
  ReadonlyMap<string, string>; nowMs: number }): NativeAdvanceSourceV1 | null`:
  - `anchor = engineSourceIdentityFromTarget(target)`; null target or null anchor gives null.
  - `autoQueue`: when `autoQueueSeedFromPlaybackTarget(target) !== null` and not
    `config.disabled`, the rows of `resources` whose numeric key is `>= activeRow`, in ascending
    key order, each `{ ...advanceIdentityFromAutoQueueRow(row), row }`. The whole tail is kept,
    not only the rows in the window, because `config` pages from the buffer's highest key; a
    shorter list would skip rows when the fill resumes. No rows gives null.
  - `addByRss`: every `[idText, feedUrl]` of `addByRssFeedUrls` (plan 40's composer output),
    skipping a feed URL where `hasUrlUserinfo(feedUrl)`.
  - Null when `autoQueue` is null and `addByRss` is empty: nothing could continue.
- `nativeAdvanceSourceWriteKey(source: NativeAdvanceSourceV1 | null): string` — `''` for null;
  otherwise the anchor's `nativeAdvanceIdentityKey`, `JSON.stringify(config)`, every row's
  identity key, and every Add by RSS pair, joined with `|`. `updatedAtMs` is not part of it.
- `parseNativeAdvanceSource(raw: string | null): NativeAdvanceSourceV1 | null` —
  `safeJsonParse<NativeAdvanceSourceV1>` (from `../../data/db/serialization`), then checks: `v`
  is 1; `anchor.kind` and `anchor.idText` are non-empty strings; `autoQueue` is null or has a
  plain-object `config` and an array `rows` whose items have string `kind` and `idText` and a
  plain-object `row`; `addByRss` is an array of string pairs; `updatedAtMs` is a finite number.
  Any failure gives null. Use `isPlainObject` from `@podverse/helpers/guards`, as
  `parseLastPlaybackSnapshot` does; no `as`.
- `manualQueueResourceIdentityKeys(resource: DTOQueueResource): string[]` (exported for the test)
  — the `nativeAdvanceIdentityKey`s the engine can report for this queue row:
  - `isAddByRssResourceData(resource.add_by_rss_resource_data)` (from `../addByRss/playbackUrl`,
    where plan 40 moves it): one key, `{ kind: 'add_by_rss', idText:
    addByRssPlaybackMediaId(data) }` (from `../addByRss/resourceData`).
  - Otherwise the window key, `advanceIdentityFromAutoQueueRow(autoQueueRowFromQueueResource(
    resource))`, when `resource.clip`, `resource.item_soundbite?.item`, or `resource.item` is
    present (the identity falls back to `row.item.id_text`, so a row with none of them has no
    key). Then the account snapshot key, `{ kind: 'item', idText: resource.item.id_text }`, when
    `resource.item` is present. Check `resource.item !== null && resource.item !== undefined` the
    way `nativeQueueEntryFromQueueResource` does: the DTO types `item` as required, but clip and
    soundbite rows can arrive without it. Drop a duplicate key (an item row's two keys are equal).
- `findManualQueueResource(queues: readonly AdoptedQueueCaches[], identity: { kind: string;
  idText: string }): DTOQueueResource | null` — for each queue in order, `nowPlaying` then
  `upcoming` in order, the first resource whose keys include the identity's
  `nativeAdvanceIdentityKey`. None gives null.
- `decideAdoptedContinuation(source: NativeAdvanceSourceV1 | null, identity: { kind: string;
  idText: string }, manualResource: DTOQueueResource | null): AdoptedContinuation | null`:
  1. Null source: null.
  1. `key = nativeAdvanceIdentityKey(identity)`; `savedIndex` = the first index in
     `source.autoQueue?.rows` whose identity key is `key`, else -1.
  1. `addByRssFeedUrl` = when `identity.kind === 'add_by_rss'`, the `feedUrl` of the `addByRss`
     pair with that `idText`, else null.
  1. `manualRow` = `autoQueueRowFromQueueResource(manualResource)` when `manualResource` is
     non-null, is not an Add by RSS row, and its window key (the first key above) is `key`; else
     null. A clip row the car played as its whole item matched by the snapshot key, so it has no
     `manualRow` and is adopted as that whole item.
  1. `autoQueue`:
     - `manualResource !== null` and `source.autoQueue !== null`: every saved row, in order,
       renumbered from key 0, with the saved config. Key 0 is the row that was active when the
       source was saved, so the active row does not move (`preserve`).
     - otherwise `savedIndex >= 0`: `rows[savedIndex]` and every row after it, renumbered from key
       0, with the saved config.
     - otherwise null.
  1. `row = manualRow ?? (savedIndex >= 0 ? rows[savedIndex].row : null)`.
  1. Null when `autoQueue`, `row`, and `addByRssFeedUrl` are all null; otherwise the three
     values.
  - An episode from the same podcast or playlist that is neither a saved row nor in the account
    queue gets null, so it refills from its own source.
  - A manual-queue item with a saved Add by RSS source and no saved auto-queue gets no buffer:
    in the app, nothing continues an Add by RSS feed walk once another item plays.

### Storage (`data/repositories/nativeAdvanceSourceRepository.ts`)

`kv_meta` row under key `playback.native_advance_source`, read and written the way
`syncMetadata.ts` reads and writes `playback.clock_offset_ms` (`initializeDatabase`, `getDb`,
upsert on `schema.kvMeta.key`). Exports `nativeAdvanceSourceRepository`:

- `read(): Promise<NativeAdvanceSourceV1 | null>` — `parseNativeAdvanceSource` of the stored value;
  a read failure gives null.
- `write(source: NativeAdvanceSourceV1 | null): Promise<void>` — skips when
  `nativeAdvanceSourceWriteKey(source)` equals the last key this module wrote; otherwise upserts the
  JSON (or deletes the row for null) and remembers the key. The module starts with no remembered
  key, so the first write of a run always lands.
- `clear(): Promise<void>` — deletes the row and remembers the key `''`.
- `readManualQueueResource(identity: { kind: string; idText: string }): Promise<DTOQueueResource |
  null>` — `readCachedQueueIds()` and, for each non-null id (`avQueueIdText`, then
  `musicQueueIdText`), `readQueueCachesForProjection(id)` (both from `./queueProjectionHelpers`,
  which imports only `../db`); then `findManualQueueResource(queues, identity)`. Any read failure gives null.
  Signed out, or after `queueRepository.clearAll`, both ids are null and it returns null. Both
  queues are read because an in-app manual-queue load keeps the buffer whatever the medium.

### Window hook (`useNativeAdvanceWindow.ts`)

In each write run, after `projectAdvanceWindowToNativeCache(composition.projection)`:
`await nativeAdvanceSourceRepository.write(buildNativeAdvanceSource({ target, resources,
activeRow, config, addByRssFeedUrls: composition.addByRssFeedUrls, nowMs: Date.now() }))` with the
same run's inputs. A failure is handled the way the window write's is. A null target (the player
was cleared) writes null, which deletes the saved source. The startup rule from plan 40 (nothing
written until a target has been seen) protects the saved source too.

### `queueRepository.clearAll`

After the advance window is emptied, `await nativeAdvanceSourceRepository.clear()` (static import;
the repository imports nothing from `queueRepository`, so there is no cycle).

### Adoption helpers

- `engineSourceAdoption.ts`:
  - `export const engineKindPlaysWholeItem = (kind: MediaEngineSourceMeta['kind']): boolean =>
    kind === 'item' || kind === 'livestream'`.
  - `buildAdoptedPlaybackTarget` doc comment: "The phone target for an adopted whole item. A
    clip, soundbite, or Add by RSS source gets it only until its own target is known."
- `feedWalk.ts`: `findAddByRssEpisodePlayEntry(feed: MobileAddByRSSFeedRecord, mappedFeed:
  AddByRSSMappedFeed, mediaId: string): AddByRssFeedPlayEntry | null` — runs
  `addByRssEpisodePlayEntry(feed, mappedFeed, itemBundle, index)` over `mappedFeed.items` and
  returns the first entry whose `idText` is `mediaId`.

### `PlaybackProvider.tsx` (by symbol)

`adoptEngineSource`:

1. The early return when the current target already has `meta.idText` stays.
1. In the try block that reads the stored item, before the `engineSourceIdTextRef.current !==
   meta.idText` check:
   - `identity = { kind: meta.kind, idText: meta.idText }`;
     `saved = await nativeAdvanceSourceRepository.read()`;
     `manualResource = await nativeAdvanceSourceRepository.readManualQueueResource(identity)`
     (local reads only; with no saved source it still lets a queued Add by RSS episode adopt as
     itself);
     `continuation = decideAdoptedContinuation(saved, identity, manualResource)`.
   - The stored-item lookup (`getStoredItemByIdText`, `getLocalChannelForItem`) runs only when
     `engineKindPlaysWholeItem(meta.kind)`. A clip, soundbite, or Add by RSS id is not an item id.
   - `row = continuation?.row ?? null`. A clip row (the row has `clip.item`): channel =
     `row.channel ?? await ensureChannel(row.clip.item)`; non-null gives `rowTarget = { target:
     buildClipPlaybackTarget(row.clip, row.clip.item, channel), item: row.clip.item, channel }`
     (item and channel kept beside the target so no narrowing is needed). A soundbite row with
     `item_soundbite.item`: the same with `buildSoundbitePlaybackTarget`. This is what
     `playAutoQueueRow` and `playQueueResource` do, without the load. The row's identity equals the
     engine's by construction, so a clip row only arises for a `clip` engine kind.
   - `continuation?.addByRssFeedUrl` non-null: `loaded = await loadLocalFeed(addByRssRepository,
     continuation.addByRssFeedUrl)`; `addByRssEntry = loaded === null ? null :
     findAddByRssEpisodePlayEntry(loaded.record, loaded.mappedFeed, meta.idText)`.
   - `adoptedAddByRssData = addByRssEntry?.resourceData ?? null`. When that is null and
     `manualResource` is an Add by RSS row (`isAddByRssResourceData(
     manualResource.add_by_rss_resource_data)`), `adoptedAddByRssData = await
     resolveLocalAddByRssResourceData(manualResource.add_by_rss_resource_data,
     addByRssRepository)`: the resource data `playQueueResource` plays. Its media id is the
     engine's, because `resolveLocalAddByRssResourceData` returns the local copy only when the
     hash id matches.
   - A failure in any of these leaves that value null, as the stored lookup's catch does today.
1. After the check, the target, summary, and item:
   - `adoptedAddByRssData` non-null: `target = { kind: 'add-by-rss', resourceData:
     adoptedAddByRssData }`, summary `summaryFromAddByRssResourceData(adoptedAddByRssData)`, no
     item.
   - `rowTarget` non-null: `rowTarget.target`; summary `summaryFromItem(rowTarget.item,
     rowTarget.channel)`; item `rowTarget.item`.
   - Otherwise as today: `item = stored ?? buildItemFromEngineMeta(...)`, `channel =
     storedChannel ?? row?.channel ?? buildChannelFromEngineMeta(meta)`, `target =
     buildAdoptedPlaybackTarget(item, channel, meta)`. The saved or queue row's channel gives a real
     channel id when no store holds the item.
   - `isInterim = !engineKindPlaysWholeItem(meta.kind) && adoptedAddByRssData === null &&
     rowTarget === null`: a clip, soundbite, or Add by RSS source shown as a whole item from
     metadata. With no saved source `continuation` is null, so a queued clip or soundbite is
     adopted as today (interim, then enriched by kind).
1. Auto-queue: `applyAutoQueueDirective({ mode: 'clear' })` stays. When `continuation?.autoQueue`
   is non-null, follow it with `writeAutoQueueState({ resources:
   continuation.autoQueue.resources, activeRow: 0, config: continuation.autoQueue.config })`, in
   the same synchronous block before `setActiveTarget`. For a manual-queue item this restores the
   buffer `preserve` would have kept; the clear and rewrite are not split across renders.
1. The rest of the body stays, with these changes:
   - `getListenSession().load(...)` and `writeLastPlaybackSnapshotForTarget(...)` are skipped when
     `isInterim`: the meta-built target would record a clip's listening under an item kind. The
     engine's journal records it meanwhile; enrichment starts both once the real target is known.
   - `void resolvePlaybackSelectionForItem(item)` runs only when there is an item.
   - Refill: an Add by RSS target calls `void ensureAddByRssFeedWalk()` (the walk the window then
     reads), plus `void refillAutoQueueAhead()` when `continuation?.autoQueue` is non-null (an Add
     by RSS episode in the manual queue, with the saved buffer behind it). Any other target calls
     `void refillAutoQueueAhead()` when `continuation?.autoQueue` is non-null or the adopted
     channel's `id_text !== ''` (plan 40's call, widened). An interim Add by RSS source does
     neither.
   - Enrichment: `isInterim` with a clip or soundbite kind calls `void enrichAdoptedSource(meta)`.
     A `rowTarget` uses `adoptedItemNeedsEnrichment({ builtFromMeta: false, channel:
     rowTarget.channel, item: rowTarget.item })`. An Add by RSS source never enriches and clears
     `pendingAdoptionEnrichmentRef`. Whole items keep today's rule.
1. Add the new dependencies (`writeAutoQueueState`, `ensureAddByRssFeedWalk`) to the callback's
   list.

`enrichAdoptedSource(meta)`, by `meta.kind` (the offline and pending-ref handling stays):

- `'clip'`: `clip = await playbackContentRepository.getClipByIdText(buildContext(),
  meta.idText)`; `item = clip.item` (missing: clear the pending ref and return); channel =
  `ensureChannel(item)` (null: keep the pending ref, as today); `target =
  buildClipPlaybackTarget(clip, item, channel)`.
- `'item_soundbite'`: the same with `getSoundbiteByIdText` and `buildSoundbitePlaybackTarget`.
- `'add_by_rss'`: clear the pending ref and return; there is nothing to fetch by id.
- Otherwise: today's item path.
- After the current-source check, set the target and now-playing as today. For a clip or soundbite
  whose active target was the interim whole item (the active target's kind is not `clip` or
  `soundbite`), also start the listen session with the same `getListenSession().load` call
  `adoptEngineSource` makes (duration from `durationRef.current` when > 0) and call
  `writeLastPlaybackSnapshotForTarget(target, positionRef.current)`.
- Plan 40's `void refillAutoQueueAhead()` stays at the end; it does nothing when a continuation
  already left rows ahead.

## Constraints

- No credential is saved: the saved source holds rows, a config, ids, and feed URLs without
  userinfo (**add-by-rss-client-held-credentials**).
- Sign-out deletes the saved source (**mobile-account-scoped-data**).
- Adoption never waits on the network before the mini player shows the item; the saved-source
  read, the account queue read, and the feed read are local.
- Adoption never writes the account queue: restoring the saved buffer behind a manual-queue item
  changes the auto-queue only.
- The app-closed path is unchanged: native never reads the saved source.
- Comments describe the code as it stands; no plan numbers. `import type` on its own line; no
  `as`; `===` only; named exports.

## Tests

- `nativeAdvanceSource.test.ts` (Vitest):
  - `buildNativeAdvanceSource` keeps the buffer from the active row through the highest key in key
    order, gives null `autoQueue` when disabled or for an Add by RSS target, keeps Add by RSS
    pairs, drops a feed URL with userinfo, and returns null when nothing could continue;
  - `decideAdoptedContinuation` with no manual resource finds a clip row by `clip` + id and not
    by its item's id, renumbers the rows from the match to key 0, keeps the config, returns the
    feed URL for a saved Add by RSS id, and returns null for an identity not saved (a same-podcast
    episode outside the saved rows);
  - `decideAdoptedContinuation` with a manual resource: restores every saved row from key 0 with
    the saved config when the item is not a saved row, and also when it is a saved row past the
    first; takes `row` from the manual resource only when its window key equals the identity (a
    clip row matched by its item's id gives `row: null`); gives `autoQueue: null` when the saved
    source has no auto-queue, and null overall when there is also no row and no feed URL; returns
    both the buffer and the feed URL for a manual Add by RSS episode the saved source lists; and
    returns null for a null source;
  - `findManualQueueResource` matches the now-playing resource and an upcoming one, checks the
    podcast queue before the Music queue, matches a clip row by `clip` + clip id and by `item` +
    its item id, matches an Add by RSS row by `add_by_rss` + media id, matches a clip row without
    `item` by its clip id only, and returns null for an identity in neither queue;
  - `parseNativeAdvanceSource` round-trips a built source and returns null for a wrong version, a
    missing anchor, or a row without `row`;
  - `nativeAdvanceSourceWriteKey` ignores `updatedAtMs` and changes when the config or a row
    changes.
- `engineSourceAdoption.test.ts`: `engineKindPlaysWholeItem` is true for `item` and `livestream`
  only.
- `feedWalk.test.ts`: `findAddByRssEpisodePlayEntry` returns the entry for a media id in the feed
  and null for one that is not.
- The provider wiring and `readManualQueueResource` have no unit test, as the existing adoption
  and the queue projection reads have none; plan 43's checklist rows cover adoption after an
  app-closed advance and a manual-queue item the car started.

## Release scratchpad

```markdown
## Reopening the app continues what the car was playing through

- Surfaces: mobile
- Change: when the app opens (or the car starts an item while it runs) and picks up an item the engine is already playing, it now continues the source the advance list came from if that item belongs to it: the same playlist, album, or podcast, with the same shuffle and repeat settings and the rows it already had. An item from the listener's queue keeps that playlist, album, or podcast waiting behind the queue, as a queue item played in the app does, even when the item is not part of it. An item that is in neither, even an episode of the same podcast, refills from its own podcast or album, as before. Clips and soundbites are picked up as clips and soundbites (their range, title, and progress), and Add by RSS episodes (from the advance list or the queue) as Add by RSS episodes with their feed's next episodes, instead of as a bare episode built from what the engine knew. The app keeps the source on the device so this works after the app was closed; sign-out deletes it.
- Who notices: CarPlay and Android Auto listeners who open the phone app after the car advanced on its own
- Operator steps: none
```
