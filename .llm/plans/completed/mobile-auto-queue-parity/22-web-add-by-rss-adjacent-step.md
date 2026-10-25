**Cursor model:** Cursor Grok 4.7 · **Reasoning:** high

# 22 — Web Add by RSS next and previous call the shared step

Add by RSS items do not use the auto-queue buffer. Next and Previous walk a list of feed item ids. Plan 11 moved that step into `@podverse/playback-core` (`resolveAddByRSSAdjacentStep`, `orderAddByRSSEpisodeIdTexts`, `buildAddByRSSListContext`). This plan points the web hooks and the IndexedDB context builder at those functions. Lookup, playback, and livestream ordering stay on web.

The track-button hooks keep calling `useAddByRSSPlayNext` and `useAddByRSSPlayPrevious`. Their files are not edited here.

## Rows

R23

## Runs after

11

## Files

apps/web/src/hooks/useAddByRSSPlayNext.tsx
apps/web/src/hooks/useAddByRSSPlayPrevious.tsx
apps/web/src/utils/addByRSS/resolveListContextFromCurrentItem.ts
apps/web/src/contexts/AddByRSSListContext.tsx

## Do not edit

- `useTrackNextButtonActions.ts` and `useTrackPreviousButtonActions.ts`. They already pass a fallback context from `resolveAddByRSSListContextFromCurrentItem` and then call these hooks. Cross-device plans 23 and 25 edit both track-button files.
- `.llm/plans/active/cross-device-playback/`
- IndexedDB helpers (`getAddByRSSItemByIdText`, `getAddByRSSLivestreamByIdText`, `getAllAddByRSSItems`, `getAllAddByRSSLivestreamItems`) and `selectChannelOrderedLiveItems`
- `usePlayAddByRSS`

## Context type

`AddByRSSListContext.tsx` defines `AddByRSSListContextState` and `AddByRSSListSortOrder` locally. Replace those two aliases with:

`export type { AddByRSSListContextState, AddByRSSListSortOrder } from '@podverse/playback-core'`

The provider, `useAddByRSSListContext`, and the setter stay. Existing `import type` sites keep importing from this module.

## Play next and play previous

Both hooks keep `effectiveContext = listContext ?? fallbackContext ?? null` and then:

```typescript
const step = resolveAddByRSSAdjacentStep(effectiveContext, 'next'); // or 'previous'
```

- `step.kind === 'none'`: when `step.clearContext` is true, `setAddByRSSListContext(null)`. Return `false`. Do not look up an item.
- `step.kind === 'step'`: load `step.idText` with `getAddByRSSItemByIdText`, then `getAddByRSSLivestreamByIdText` when that returns null. When neither returns an item, return `false` and leave the context as it is.
- After `await playAddByRSS(indexItem)` resolves, `setAddByRSSListContext(step.nextContext)` and return `true`. `nextContext` is null on the last id in that direction, which clears the context. Apply it only after the item has loaded.

Direction `'next'` in `useAddByRSSPlayNext`, `'previous'` in `useAddByRSSPlayPrevious`. Delete the local index arithmetic in each hook. The doc comments at the top of each file stay accurate (next is the newer neighbor, previous is the older one, false means the caller seeks to the start). Leave them, or trim a sentence that names the old index math. Do not mention a plan.

Import `resolveAddByRSSAdjacentStep` as a value from `@podverse/playback-core`. The context type import stays `import type` from `../contexts/AddByRSSListContext`.

## Rebuild a missing list context

In `resolveAddByRSSListContextFromCurrentItem`, keep the IndexedDB lookup that finds `channelIdText` and `isLivestream`, including the `channel_id_text` read on `resourceData`. Do not restyle that block.

Replace the in-place `pubDateMs` sort, the empty-list return, the `indexOf` check, and the object return with:

- Livestream: `orderedIdTexts` is `selectChannelOrderedLiveItems(forChannel).map((item) => item.idText)`.
- Episode or track: `orderedIdTexts` is `orderAddByRSSEpisodeIdTexts(forChannel.map((item) => ({ idText: item.idText, pubDateMs: item.pubDateMs })), sortOrder)`.
- Return `buildAddByRSSListContext({ feedIdText: channelIdText, orderedIdTexts, currentIdText, sortOrder })`.

That helper returns null for an empty list and for a current id that is not in the list, which is what this function returns today. `orderAddByRSSEpisodeIdTexts` does not mutate its input. Newest-first for `'recent'` and oldest-first for `'oldest'` stay.

Import the two functions from `@podverse/playback-core` on a value import. Keep `AddByRSSListSortOrder` and `AddByRSSListContextState` as `import type` from the context module.

## Tests

No new test and no Playwright spec. Plan 11's `addByRSSListWalk.test.ts` covers ordering, the step in both sort orders, and the end-of-list clear. No web test renders these hooks or this resolver today. The hooks keep the same true/false results and the same "write context only after play" rule; the arithmetic moved into the helper.

## Release scratchpad

none
