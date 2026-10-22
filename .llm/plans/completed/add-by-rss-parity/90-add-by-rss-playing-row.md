# 90 — A playing Add by RSS row shows pause and progress

**Cursor model:** Cursor Grok 4.7 · **Reasoning:** extra high

Row: R56. Mobile only. Paths are under `apps/mobile/` unless they start with `packages/` or `.llm/`.

Run after plans 21, 30, 31, 32, 33, 34, 41, and 51. This plan edits files they create or change
(`addByRssHomeDetailData.ts`, `ItemDetailHeader.tsx`, `AddByRssEpisodeHeader.tsx`,
`addByRssItemRows.ts`, `e2e/add-by-rss.yaml`). Read each file as it stands; do not re-apply their
work.

## Answer: why no Add by RSS row shows pause today

`MediaRowActions` (`src/components/player/MediaRowActions.tsx`, `MediaRowPlayButton` and the
`showPauseIcon = isActiveRow && isPlaying` block near line 556) marks a row active when
`playbackTargetRowMediaId(activeTarget)` equals `normalizeHomeFeedPlaybackMediaId(playbackMediaId)`.
The active row then shows the pause icon and `MediaRowActiveProgress` (when a duration is shown).

For an Add by RSS target, `playbackTargetRowMediaId` (`src/lib/playback/buildPlaybackTarget.ts`,
case `'add-by-rss'`) returns `resourceData.id_text`. `toAddByRssItemPlaybackResourceData`
(`src/lib/addByRss/domain.ts`) passes the feed record's `idText` to `toIndexItem` as
`existingIdText`, so `id_text` is the **feed's** id for every episode of that feed. Rows pass
`playbackMediaId={row.id}` (`${feed.idText}-${itemKey}`), which never equals it. A row can never
match, and if it did, every episode of the feed would match at once.

The same `id_text` also feeds `idTextFromTarget` (`src/lib/playback/mediaEngineSourceMeta.ts`),
which becomes the engine source `meta.idText`. The native playback journal records that id,
and `drainPlaybackJournal.ts` writes it as the outbox `resourceIdText` for `add_by_rss` rows. The
outbox matches server rows by `add_by_rss_hash_id` (`resolveRemoteResourceRef` in
`playbackOutboxRepository.ts`). So today Add by RSS journal entries carry an id the server never
uses. `nowPlayingResourceFromTarget` (`src/playback/playbackEventSource.ts`) already sends the
hash.

## Locked decisions

1. **The playback media id of an Add by RSS episode or track is its `add_by_rss_hash_id`**, the
   feed-form hash `getAddByRSSHashId(withCanonicalAddByRssFeedUrl(resourceData))`. It is stable
   across devices, distinct per item, already used by the playback event source, the queue
   screen (`queueResourceContentId` in `src/lib/queue/queueScreenResources.ts`), and the outbox.
   The resource data `id_text` is left as it is. It stays in payloads sent to the server, and
   plan 51 resolves the feed without it.
2. **One helper**, `addByRssPlaybackMediaId(resourceData)`, in `src/lib/addByRss/resourceData.ts`.
   `playbackTargetRowMediaId`, `idTextFromTarget`, and `nowPlayingResourceFromTarget` all call
   it. `playbackTargetRowMediaId` and `idTextFromTarget` must stay equal for every target:
   `PlaybackProvider` compares `engineSourceIdTextRef` (from `sourceChanged` `meta.idText`) with
   `playbackTargetRowMediaId(activeTarget)` in `isAdoptedSourceCurrent` and in the `ended` and
   `progress` handlers. Changing one without the other would stop Add by RSS auto-advance.
3. **Rows carry the id; render never hashes.** `HomeFeedRowData` gets an optional
   `playbackMediaId`. The Add by RSS data builder computes it once per load. `HomeFeedRow` passes
   `row.playbackMediaId ?? row.id`, so database rows are unchanged
   (**mobile-row-render-cost**).
4. **The data builder derives the id from the play path's own resource data.** It calls
   `addByRssPlaybackMediaId(toAddByRssItemPlaybackResourceData(feed, mappedFeed, itemBundle,
   itemIndex))`, the same call `useAddByRssPlayback.playItem` makes. The two cannot drift. This
   runs once per item per load, the same cost as plan 30's per-row `downloadItem`.
5. **Pressing play on the playing row pauses; pressing it on the paused active row resumes.**
   `useAddByRssPlayback.playItem` copies the toggle from `useHomeRowPlayback.runPlayAction`
   (`src/screens/home/useHomeRowPlayback.ts`), the parity source. Today a second press runs
   `playAddByRssResourceData` again, which loads the episode into the engine a second time.
6. **Track rows get no active chrome.** `HomeFeedRow` renders tracks without a play button
   (`showInlineTrackMore`), the same as database track rows. The compact variant of
   `toAddByRssItemHomeRow` (Home's track rows) does not carry `playbackMediaId`.
7. **No device-data migration.** Journal entries written before this change carry the feed id and
   still match nothing, as today. New entries carry the hash. Nothing stored on the device is
   rewritten (**dto-changes-are-device-data-migrations**: no DTO or stored shape changes).
8. **Livestreams.** An Add by RSS livestream target gets the same hash id. No row shows it as
   active: no Add by RSS livestream row exists yet. `nowPlayingResourceFromTarget` keeps
   returning `null` for livestream resource data before it calls the helper.

## Files

| File                                                   | Change                                  |
| ------------------------------------------------------ | --------------------------------------- |
| `src/lib/addByRss/resourceData.ts`                     | New `addByRssPlaybackMediaId`           |
| `src/lib/addByRss/resourceData.test.ts`                | New, Vitest                             |
| `src/lib/playback/buildPlaybackTarget.ts`              | `'add-by-rss'` case uses the helper     |
| `src/lib/playback/mediaEngineSourceMeta.ts`            | `'add-by-rss'` case uses the helper     |
| `src/lib/playback/addByRssPlaybackIdentity.test.ts`    | New, Vitest                             |
| `src/playback/playbackEventSource.ts`                  | Use the helper                          |
| `src/screens/home/homeFeedData.ts`                     | Optional `playbackMediaId` on the row   |
| `src/screens/home/HomeFeedRow.tsx`                     | Pass it to `MediaRowActions`            |
| `src/screens/home/addByRssHomeDetailData.ts`           | Fill `playbackMediaId`                  |
| `src/screens/home/addByRssHomeDetailData.test.ts`      | New cases                               |
| `src/screens/home/addByRssItemRows.ts`                 | Carry it in the full row                |
| `src/components/content/ItemDetailHeader.tsx`          | Optional `playbackMediaId` prop         |
| `src/screens/home/addByRss/AddByRssEpisodeHeader.tsx`  | Pass `episode.playbackMediaId`          |
| `src/hooks/useAddByRssPlayback.ts`                     | Pause / resume toggle                   |
| `vitest.config.ts`                                     | Include the two new test files          |
| `e2e/add-by-rss.yaml`                                  | Assert pause and progress after play    |

## Implementation

### `resourceData.ts`

Add `import { getAddByRSSHashId } from '@podverse/helpers';` (the barrel import
`localResourceData.ts` and `playbackEventSource.ts` already use). Below
`withCanonicalAddByRssFeedUrl`:

```typescript
/**
 * The id playback uses for an Add by RSS episode or track: its `add_by_rss_hash_id`, the same on
 * every device. Rows, the engine source, the journal, and the queue all match on it.
 */
export function addByRssPlaybackMediaId(resourceData: AddByRSSResourceData): string {
  return getAddByRSSHashId(withCanonicalAddByRssFeedUrl(resourceData));
}
```

### `buildPlaybackTarget.ts`

In `playbackTargetRowMediaId`, case `'add-by-rss'`: return
`addByRssPlaybackMediaId(target.resourceData)` in place of `resourceData.id_text`. Import it from
`../addByRss/resourceData` (the file already imports `isAddByRssLivestreamResourceData` from
there). Update the function's doc comment if it says Add by RSS uses `id_text`.

### `mediaEngineSourceMeta.ts`

In `idTextFromTarget`, case `'add-by-rss'`: return `addByRssPlaybackMediaId(target.resourceData)`.
Add one sentence to the function's doc comment: it must return what `playbackTargetRowMediaId`
returns, because the provider compares the engine's `meta.idText` with it.

### `playbackEventSource.ts`

In `nowPlayingResourceFromTarget`, case `'add-by-rss'`, replace
`getAddByRSSHashId(withCanonicalAddByRssFeedUrl(target.resourceData))` with
`addByRssPlaybackMediaId(target.resourceData)`. Drop the `getAddByRSSHashId` import if nothing
else in the file uses it. Keep `withCanonicalAddByRssFeedUrl` if `playbackEventPayloadForTarget`
still uses it.

### `homeFeedData.ts`

In `HomeFeedRowData`, after `id`:

```typescript
/** The id playback reports for this row when it differs from `id` (Add by RSS: the item hash). */
playbackMediaId?: string;
```

### `HomeFeedRow.tsx`

In the default action band (`MediaRowActions` with `playTestID`, near line 641), change
`playbackMediaId={row.id}` to `playbackMediaId={row.playbackMediaId ?? row.id}`. TestIDs keep
`row.id`. Leave `explicitSelectedParams` (near line 372) unchanged.

### `addByRssHomeDetailData.ts`

In the `mappedFeed.items.map((itemBundle, itemIndex) => …)` row literal, add
`playbackMediaId: addByRssPlaybackMediaId(toAddByRssItemPlaybackResourceData(feed, mappedFeed,
itemBundle, itemIndex))`. Import `toAddByRssItemPlaybackResourceData` from
`../../lib/addByRss/domain` and `addByRssPlaybackMediaId` from `../../lib/addByRss/resourceData`.
`AddByRssHomeEpisode` extends `HomeFeedRowData`, so the field is already typed. Make it required
on this type by adding `playbackMediaId: string;` to the `AddByRssHomeEpisode` intersection. Every
Add by RSS episode has one.

### `addByRssItemRows.ts`

`toAddByRssItemHomeRow` (plan 41): the full mapping adds `playbackMediaId: item.playbackMediaId`.
The `compact: true` mapping stays as plan 41 wrote it (decision 6).
`addByRssLibraryFeedData.ts` maps through this function, so the Library Episodes chip gets the
field with no edit there.

### `ItemDetailHeader.tsx`

Add to `ItemDetailHeaderProps`, after `mediaIdText`:

```typescript
/** Playback match when it differs from `mediaIdText` (Add by RSS: the item hash). */
playbackMediaId?: string;
```

In the `MediaRowActions` props, change `playbackMediaId={mediaIdText}` to
`playbackMediaId={playbackMediaId ?? mediaIdText}`. TestIDs keep `mediaIdText`. The podcast
episode page (`EpisodePlayChrome`) passes nothing and is unchanged.

### `AddByRssEpisodeHeader.tsx`

Pass `playbackMediaId={episode.playbackMediaId}` to `ItemDetailHeader`.

### `useAddByRssPlayback.ts`

Read `activeTarget`, `pause`, `resume`, and `playAddByRssResourceData` from `usePlaybackSession()`,
and `const isPlaying = usePlaybackIsPlaying();` (both in `src/playback/PlaybackProvider.tsx`, as
`useHomeRowPlayback` reads them). Import `playbackTargetRowMediaId` from
`../lib/playback/buildPlaybackTarget` and `addByRssPlaybackMediaId` from
`../lib/addByRss/resourceData`. In `playItem`, after the `enclosureUrl === null` notice branch:

```typescript
const resourceData = toAddByRssItemPlaybackResourceData(feed, mappedFeed, itemBundle, itemIndex);
const activeMediaId = activeTarget !== null ? playbackTargetRowMediaId(activeTarget) : null;
if (activeMediaId !== null && activeMediaId === addByRssPlaybackMediaId(resourceData)) {
  if (isPlaying) {
    pause();
  } else {
    await resume();
  }
  return;
}
onNotice(null);
await playAddByRssResourceData(resourceData);
```

Add the new values to the `useCallback` deps. Extend the doc comment: pressing play on the item
that is already loaded pauses or resumes it, as other rows do.

### `vitest.config.ts`

Add `'src/lib/addByRss/resourceData.test.ts'` beside the other `src/lib/addByRss/` entries and
`'src/lib/playback/addByRssPlaybackIdentity.test.ts'` beside the other `src/lib/playback/`
entries.

## Tests

**`resourceData.test.ts`** (new). Build resource data literals:

- With `feed_url` and a real `guid`: `addByRssPlaybackMediaId` equals
  `getAddByRSSHashId({ feed_url, guid })`.
- With a device-local guid (`${channel_id_text}-3`) and an `enclosure_url`: it equals
  `getAddByRSSHashId({ feed_url, enclosure_url })`.
- A `feed_url` with userinfo (`https://user:pass@example.com/feed.xml`) gives the same id as the
  same URL without userinfo.
- Two items of one feed with different guids give different ids.

**`addByRssPlaybackIdentity.test.ts`** (new). Build one `{ kind: 'add-by-rss', resourceData }`
target. Use `resourceData` with `id_text: 'feed-id'`, a `feed_url`, a `guid`, and an
`enclosure_url`. Then:

- `playbackTargetRowMediaId(target)` equals `addByRssPlaybackMediaId(resourceData)` and is not
  `'feed-id'`.
- `mediaEngineSourceMetaFromTarget(target, 'js')?.idText` equals
  `playbackTargetRowMediaId(target)`.
- `nowPlayingResourceFromTarget(target)?.resourceIdText` equals the same id.

`buildPlaybackTarget.ts`, `mediaEngineSourceMeta.ts`, and `engineAudioProfile.ts` import the
native module as types only, so the test runs in Node with no mocks.

**`addByRssHomeDetailData.test.ts`** (existing). Add:

- Each episode's `playbackMediaId` equals
  `addByRssPlaybackMediaId(toAddByRssItemPlaybackResourceData(feed, mappedFeed,
  episode.itemBundle, episode.itemIndex))`.
- Two episodes of one feed have different `playbackMediaId` values.
- A guidless item (add one to a local `mappedFeed` built with `convertParsedRSSFeedToCompat`, no
  `guid`) still gets the hash of its enclosure URL: equal to
  `getAddByRSSHashId({ feed_url: feed.feedUrl, enclosure_url })`.

**Maestro `e2e/add-by-rss.yaml`.** After the existing `playback-active-e2e` / `playing` wait and
before `- takeScreenshot: add-by-rss-playback-active`, insert:

```yaml
# The playing row shows pause and its progress bar, as a podcast episode row does.
- assertVisible:
    id: add-by-rss-home-play-first
    text: "Pause"
- assertVisible:
    id: "home-feed-row-duration-.*-progress"
```

The fixture episode has a duration (`itemDurationSeconds` in
`apps/api/src/controllers/account/accountAddByRSSParse.ts`), so the progress bar renders.
`make-clip.yaml` uses the same `id` plus `text: "Pause"` match on the play button's label.

No unit test for the pause toggle: it is handler wiring copied from `useHomeRowPlayback`, and the
Maestro step covers the active state.

## Release scratchpad

```markdown
## Mobile Add by RSS rows show when they are playing

- Surfaces: mobile
- Change: The Add by RSS episode that is playing now shows the pause button and the progress
  bar on its row: on the feed page, the Add by RSS library's Episodes chip, Home, and the Add by
  RSS episode page. Pressing play on that row pauses it, and pressing again resumes, instead of
  loading the episode again. Playback now reports Add by RSS items by their item hash instead of the
  feed's id, so playback history written from the device matches the item on the server.
- Who notices: anyone who plays feeds added by RSS on the phone
- Operator steps: none
```
