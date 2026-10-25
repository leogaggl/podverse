**Cursor model:** Cursor Grok 4.7 · **Reasoning:** high

# 20 — Web auto-queue loader calls `fillAutoQueueForward`

`useAutoQueueLoadResources` stops choosing a source, mapping rows, and deduping. It builds a seed from the playing item, calls `fillAutoQueueForward` from `@podverse/playback-core`, and writes the buffer back. Web request functions stay in a small adapter. Shuffle and Repeat pass the toggled config into that call.

Visible playback stays as it is. The five sources, the repeat wrap, shuffle paging, and dedupe move into the helper from plan 10; this plan only wires them.

## Rows

R23

## Runs after

10

## Files

apps/web/src/hooks/useAutoQueueLoadResources.tsx
apps/web/src/lib/autoQueue/webAutoQueueSourceFetchers.ts
apps/web/src/lib/autoQueue/webAutoQueueSourceFetchers.test.ts
apps/web/src/contexts/AutoQueue.tsx
apps/web/src/components/MediaPlayer/Buttons/ShuffleButton.tsx
apps/web/src/components/MediaPlayer/Buttons/RepeatButton.tsx

## Behavior that must stay

- The eager reload trigger stays in `fetchAutoQueueResources` inside `useMediaPlayerControllerQueueHeadLoading`. Do not edit that file. It still calls `autoQueueLoadResources()` with no arguments when `checkIsActiveRowHighestKey` is true or the buffer has no keys.
- The helper walks forward from the highest-key row. On this trigger that row is the item playing, or the buffer is empty and the helper seeds key 0 from the playing item. Do not pass the playing item in as a cursor.
- No in-flight guard. Overlapping fills still let the last one to finish write the buffer.
- Errors from a request still reject the load callback. Do not add a try/catch.
- `apps/web/src/lib/playlist/playablePlaylistResource.ts` stays. Plan 21 deletes it after Previous stops importing it. This plan only drops the import from the loader.
- Do not edit `.llm/plans/active/cross-device-playback/`. Do not edit `useTrackNextButtonActions.ts` or `useTrackPreviousButtonActions.ts`.

### `disabled` is still ignored on the walk

`fillAutoQueueForward` treats `config.disabled === true` as "no source" and fetches nothing. The web loader never read `disabled`. These plays store `disabled: true` and still get a forward fill today:

- `LivestreamHeaderPlaySection` and `ListLiveItemRow`
- `useDescriptionClockPlayback` when `source.livestream === true`
- `ClipEditPageContext` (also keeps `playlist_id_text`)

The embed stores `disabled: true` too, and `useMediaPlayerResourceUpdate` does not apply that config (`skipAutoQueueMutations`). Leave the embed path alone.

Call the helper with a copy of the config whose `disabled` is `false`. When writing config back, put the stored `disabled` value on the object. Livestream and clip-edit fills keep appending, and the flag stored on the context stays `true`.

## Context types (`AutoQueue.tsx`)

The type bodies and the two pure functions move to `@podverse/playback-core` (plan 10). This file keeps the provider and re-exports what callers already import from it:

- `export type { AutoQueueConfig, AutoQueueResourcesMap, AutoQueueResourcesMapRow } from '@podverse/playback-core'`
- `export { autoQueueIncrementActiveRow, checkIsActiveRowHighestKey } from '@podverse/playback-core'`

Separate `export type` and value `export`. Delete the local type aliases and the local function bodies.

`defaultAutoQueueConfig` becomes `createDefaultAutoQueueConfig(getShuffleHash)` from `@podverse/playback-core`. `getShuffleHash` is `() => string` (`packages/helpers-requests/src/api/queryParams.ts`). Call it once at module scope, as the current object does. The provider's cookie override of `random` and `repeat` stays.

Do not re-export `createDefaultAutoQueueConfig`. Do not change `EMBED_DISABLED_AUTO_QUEUE_CONFIG` or any `newAutoQueueConfig` object at a play-button call site. Those objects already match an explicit play; sweeping them is out of this plan. `useMediaPlayerResourceUpdate.tsx` stays as it is (cross-device plan 25 edits it).

## Fetcher adapter

New file `apps/web/src/lib/autoQueue/webAutoQueueSourceFetchers.ts`. Named export `createWebAutoQueueSourceFetchers`. It takes a narrow object of the eight methods below and returns `AutoQueueSourceFetchers`. The real `getApiRequestService()` result is assignable to that object. `apiRequest` already returns the HTTP body (`packages/helpers-requests/src/api/_request.ts`), so the unwrap is one `.data` on list bodies and none on the queue endpoints.

| Helper method | Request | What to return |
| --- | --- | --- |
| `fetchPlaylistResourcesByListPosition(id, cursor, direction)` | `reqPlaylistResourceGetManyForQueueByListPosition(id, cursor, direction)` | `body.data` |
| `fetchPlaylistResourcesByShuffle(id, { page, shuffleHash })` | `reqPlaylistResourceGetManyByShuffle(id, shuffleHash, page)` | `body.data` |
| `fetchPlaylistResourcesFirstPage(id)` | `reqPlaylistResourceGetManyByPlaylistIdText(id, { page: 1 })` | `body.data` |
| `fetchChannelItemsByShuffle(id, { page, shuffleHash })` | `reqItemGetManyByChannelShuffle(id, { page, shuffleHash })` | `body.data` |
| `fetchItemsBySeason(itemId, direction)` | `reqItemGetManyForQueueBySeason(itemId, direction)` | the body array |
| `fetchChannelItemsBySeasonFirstPage(channelId)` | `reqItemGetManyByChannelBySeason({ idOrIdText: channelId, page: 1, sort: 'forward', range: null })` | `body.data` |
| `fetchItemsByPubDate(itemId, direction)` | `reqItemGetManyForQueueByPubDate(itemId, direction)` | the body array |
| `fetchChannelItemsRecentFirstPage(channelId)` | `reqItemGetManyByChannel({ idOrIdText: channelId, page: 1, sort: 'recent', range: null })` | `body.data` |

`direction` is `'forward' | 'backward'` and is forwarded as-is. The list-position cursor is the object the helper passes; do not add the playing item's ids here. `DTOItem` from the channel-list bodies is assignable to `DTOItemQueueItem`. If the compiler rejects that, stop and report. Do not add `as`.

Import `AutoQueueSourceFetchers` as a type from `@podverse/playback-core` on its own `import type` line. Relative imports in this app stay extensionless.

## Loader (`useAutoQueueLoadResources`)

Keep the player, buffer, and config refs, and the `useCallback` with an empty dependency list, so `fetchAutoQueueResources` and the buttons keep a stable function.

The callback accepts an optional argument:

```typescript
options?: {
  config?: AutoQueueConfig;
  resources?: AutoQueueResourcesMap;
}
```

Do not export that type.

1. `stored` is `options.config` when present, otherwise `autoQueueConfigRef.current`. `resources` is `options.resources` when present, otherwise `autoQueueResourcesRef.current`.
2. Seed from the player refs: when `mpItemRef.current` or `mpChannelRef.current` is null, `setAutoQueueResources({})` and return. Do not write config. Otherwise the seed is `{ item, channel, clip: mpClipRef.current, item_soundbite: mpItemSoundbiteRef.current }`. `DTOItem` from the player is assignable to the seed's `DTOItemQueueItem`. No assertion.
3. `configForWalk` is `{ ...stored, disabled: false }`.
4. `await fillAutoQueueForward({ config: configForWalk, seed, resources, fetchers: createWebAutoQueueSourceFetchers(getApiRequestService()) })`.
5. `setAutoQueueResources(result.resources)`.
6. `nextConfig` is `{ ...result.config, disabled: stored.disabled }`. Call `setAutoQueueConfig(nextConfig)` only when `nextConfig.nextPage !== stored.nextPage` or `nextConfig.shuffleHash !== stored.shuffleHash`. Shuffle fills advance `nextPage`. The other sources leave it, and those fills do not write config today.

Delete the source branches, the playable filter, the row mapping, and the dedupe loop. Drop the `@podverse/helpers` value import when nothing in the file uses it. Keep `import type` for whatever the seed still needs. The file has no `'use client'` directive; do not add one.

## Shuffle and Repeat

`ShuffleButton`: `const nextConfig = toggleAutoQueueShuffle(autoQueueConfig, getShuffleHash)`. Then `setAutoQueueActiveRow(0)`, `setAutoQueueResources({})`, `setAutoQueueConfig(nextConfig)`, and `void autoQueueLoadResources({ config: nextConfig, resources: {} })`. Remove the `setTimeout`.

`RepeatButton`: the same with `toggleAutoQueueRepeat(autoQueueConfig)`. It takes no hash function. Remove the `setTimeout`.

Both still set context state themselves so the pressed state updates before the fetch returns. Keep each file's scss import as the last import.

Passing `resources: {}` matters: the button's `setAutoQueueResources({})` updates the ref in an effect, which has not run yet at the call. The helper must see an empty map so it seeds key 0 from the item playing.

## Tests

Add `apps/web/src/lib/autoQueue/webAutoQueueSourceFetchers.test.ts` (Vitest, beside the adapter). A stub records calls. Assert each of the eight methods:

- calls the matching request with the id, cursor or page, `shuffleHash`, and `direction` from the table above
- returns the row array (`body.data` for the six list responses, the array itself for `queue/season` and `queue/pub-date`)

No Playwright spec. The source walks are covered by plan 10's playback-core tests, and `apps/web/e2e/media-player-music-playback.spec.ts` stays the player guard. Do not edit `useMediaPlayerControllerQueueHeadLoading.test.tsx`; it mocks `../useAutoQueueLoadResources` and `checkIsActiveRowHighestKey` from the context module, and both of those stay.

## Release scratchpad

none
