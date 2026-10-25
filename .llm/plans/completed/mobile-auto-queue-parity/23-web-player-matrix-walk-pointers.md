**Cursor model:** Cursor Grok 4.7 · **Reasoning:** medium

# 23 — Player matrix names where the walks live

`MEDIA-PLAYER-DECISION-MATRIX.md` is the player contract. After plans 20–22 the forward fill, Previous, and the Add by RSS step are called from web and decided in `@podverse/playback-core`. Add three short pointers so the next reader does not look only at the hooks. Do not change a row of the matrix. Behavior is unchanged.

## Rows

R23

## Runs after

20, 21, 22

## Files

apps/web/src/components/MediaPlayer/MEDIA-PLAYER-DECISION-MATRIX.md

## Edits

Anchor by the headings below. Insert prose. Do not rewrite the tables.

1. Under `### 4. AutoQueue transition (`autoQueueActiveRow` change)`, the paragraph that starts with `` `handleLoadAutoQueueItem` `` stays. After it, add one paragraph: the buffer's later rows come from `fillAutoQueueForward` in `@podverse/playback-core`, called by `useAutoQueueLoadResources`. `fetchAutoQueueResources` in `useMediaPlayerControllerQueueHeadLoading` makes that call when the active row is the highest key or the buffer is empty.

2. Under `### 5. Skip-next / Track-ended`, leave the skip-next list and the track-ended table. After the table, add one paragraph: Add by RSS next and previous choose the neighbor with `resolveAddByRSSAdjacentStep` in `@podverse/playback-core`. `useAddByRSSPlayNext` and `useAddByRSSPlayPrevious` load that id and play it.

3. In `## Music playback intents (Phase 2 type naming)`, the paragraph that starts with `**Playlists:**` stays. After it, add one paragraph: once chapters and the 3-second restart are handled in `useTrackPreviousButtonActions`, `runCorePreviousTrack` calls `resolveAutoQueuePrevious` in `@podverse/playback-core`.

Write those sentences in the file's present tense. Do not cite a plan, a step number, or a path under `.llm/plans/`. Do not mention another media player.

Do not edit `.llm/plans/active/cross-device-playback/`.

## Tests

none. Doc pointers only.

## Release scratchpad

none
