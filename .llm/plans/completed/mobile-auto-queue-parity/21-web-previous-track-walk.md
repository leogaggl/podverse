**Cursor model:** Cursor Grok 4.7 · **Reasoning:** high

# 21 — Web Previous calls `resolveAutoQueuePrevious`

`runCorePreviousTrack` in `useTrackPreviousButtonActions` stops fetching the previous playlist row or episode itself. It asks `resolveAutoQueuePrevious` (`@podverse/playback-core`, plan 10) and applies the same three outcomes it applies today: step back one auto-queue row, load the fetched row with the buffer cleared, or restart.

Chapters, the 3-second restart, long press, and Add by RSS stay in this file. Plan 22 moves the Add by RSS step.

## Rows

R23, R25

## Runs after

10, 20

## Files

apps/web/src/hooks/useTrackPreviousButtonActions.ts
apps/web/src/lib/playlist/playablePlaylistResource.ts

## Anchor (R25)

Cross-device plans 23 and 25 edit this same hook. They are not implemented on this branch. This plan edits the body of `runCorePreviousTrack` only.

Leave these as they stand when you open the file: `handleClick`, `handleLongPress`, `runPreviousTrack`, `runAddByRSSPreviousTrack`, the `useLongPress` call, and the returned fields (`hasEpisodeChaptersForTrackButtons`, `onClick`, `longPressProps`). The 3-second check and `seekToAdjacentChapter('previous')` stay in `handleClick`. Long press calls `runPreviousTrack`, which skips that 3-second check and still reaches `runCorePreviousTrack`. Do not move the helper call up into `handleClick`.

If the file already has `runLocalClick` or a remote-role branch (a later rebase of cross-device), leave those. Do not rename `handleClick`.

Do not edit `useTrackNextButtonActions.ts`. Do not edit anything under `.llm/plans/active/cross-device-playback/`.

## `runCorePreviousTrack`

Keep the early return when `mpChannel` or `mpItem` is missing. That path does not seek.

Build the seed `{ item: mpItem, channel: mpChannel, clip: mpClip, item_soundbite: mpItemSoundbite }`. Pass `autoQueueActiveRow` through. Call:

```typescript
resolveAutoQueuePrevious({
  config: { ...autoQueueConfig, disabled: false },
  seed,
  activeRow: autoQueueActiveRow,
  fetchers: createWebAutoQueueSourceFetchers(getApiRequestService()),
})
```

`disabled: false` matches plan 20. The helper treats a disabled config as restart and would skip the fetch. Previous today does not read `disabled`; a livestream or clip-edit config still walks backward. `createWebAutoQueueSourceFetchers` is the adapter from plan 20.

Apply the result:

| `decision.kind` | What to do |
| --- | --- |
| `step-back-row` | `setMPShouldPlay(mpIsPlaying)` and `setAutoQueueActiveRow(decision.row)`, then return. No load, no seek. |
| `restart` | `seekToStart()`, then return. |
| `load-previous` | `mediaPlayerResourceUpdate` as below. |

`load-previous` uses the row the helper already mapped (clip, else soundbite, else item). Pass it through `playbackTargetFromStandardLoad` with `musicIntent: 'explicit_play'`, `itemChapter: null`, and the row's `channel`, `clip`, and `item_soundbite`.

The row's `item` is `DTOItemQueueItem`. `playbackTargetFromStandardLoad` takes `DTOItem`. One assertion at that argument, with a comment that the queue row carries the queue item shape and this load takes the full item type. Do not add a second assertion, and do not refetch the item. (`handleLoadAutoQueueItem` refetches; Previous does not.)

`mediaPlayerResourceUpdate` fields, matching the object in `runCorePreviousTrack` today:

- `itemChapterShouldSeek: false`
- `shouldPlay: mpIsPlaying`
- `isPlaying: mpIsPlaying`
- `enclosureSelectedParams: 'use-active-item-or-default'`
- `skipMoveNowPlayingToHistory: false`
- `autoQueueShouldClear: true`
- `newAutoQueueConfig`: `playlist_id_text`, `random`, `repeat`, and `shuffleHash` copied from `autoQueueConfig`; `disabled: false`; `nextPage: autoQueueConfig.nextPage || 1`

Do not call `resolveAutoQueueConfigForExplicitPlay`. That mints a new shuffle hash and sets `nextPage` to 1. Previous keeps the hash and the current page.

Delete the playlist and channel fetch branches, the `MediumEnum` import, and the `isPlayablePlaylistResource` import. Keep the `'use client'` directive.

Then delete `apps/web/src/lib/playlist/playablePlaylistResource.ts`. After plan 20, this hook is its last importer. `isPlayablePlaylistResource` lives in `@podverse/playback-core`. Do not add a re-export file.

A rejecting fetcher still rejects `runCorePreviousTrack`. Do not catch it.

## Tests

No new test file and no Playwright spec. The backward walk's branches are plan 10's `autoQueueWalk.test.ts`. This hook's chapter, 3-second, and long-press branches are unchanged, and no web unit test renders them today.

The wiring exception: the decision logic now lives in playback-core, and this edit does not change a branch of it. Risk that remains is the `disabled: false` copy and the `load-previous` field list above; both are fixed in this plan. A follow-up would render the hook with a stub fetcher, which needs the media-player context harness and is out of scope.

## Release scratchpad

none
