# 01 — Web: never swap a different item into the player

**Cursor model:** Opus 5.5 · **Reasoning:** high

## Summary

On web, playing an Add by RSS episode let the server queue head (Podcasting 2.0 episode 275)
replace it. Make this tab's identity come from what the player has loaded, never load a different
item automatically while one is loaded, and record Add by RSS plays on the server reliably. Runs
in parallel with 02. Web only; do not touch the API, mobile, or `packages/`.

## How the swap happens

1. Page load adopts the server head (episode 275, paused). `rememberQueueResourceAsLocalState`
   writes `{ itemIdText: <275>, ... }` through `writePlaybackHandoffLocalState`
   (`apps/web/src/hooks/playbackHandoffState.ts`).
2. The user plays an Add by RSS episode. `usePlayAddByRSS` sets `mpAddByRSS` but never updates the
   handoff record, so it still says 275.
3. The queue head effect in `useMediaPlayerControllerQueueHeadLoading.ts` (around line 635) re-runs
   on `mpIsPlaying`. `shouldLoadQueueResource` (around line 326) does:

```ts
const localItemIdText = localState?.itemIdText ?? mpItem?.id_text ?? null;
if (serverIdentity === null || localItemIdText === null) { return true; }
if (localItemIdText === serverIdentity.itemIdText) { return true; }
```

   The stale 275 equals the server head, so it returns true. The player is not empty, so
   `dispatchLoad` runs, and `handleLoadQueueItem` loads 275 because its guard
   (`isAlreadyLoadedThisItem`) requires `mpAddByRSS === null`.
4. `usePlayAddByRSS` posts now-playing only when `mediumId !== null`
   (`getQueueForMedium(queues, mediumId)`). Feeds without `podcast:medium` (Muse AI) never post, so
   the server head stays 275. The POST is not awaited and the active queue is never refreshed.

## Changes

### Loaded identity is the source of truth

In `useMediaPlayerControllerQueueHeadLoading.ts`:

- Add one function, `loadedPlaybackIdentity()`, that returns the identity of what the player holds:
  `mpAddByRSS` → the same Add by RSS identity `queueResourceIdentity` uses for a row, `mpItem` →
  `id_text`, `mpClip` → `clip.item.id_text`, `mpItemSoundbite` → `item.id_text`. Put the Add by RSS
  identity in one exported helper (`addByRSSPlaybackIdentity(resourceData)`) and use it in
  `queueResourceIdentity`, here, and in `usePlayAddByRSS`. 06 changes that one helper to the new
  hash; nothing else should need to change then.
- In `shouldLoadQueueResource`, `localItemIdText` is `loadedPlaybackIdentity()`. Use the handoff
  record only for `lastPlayedAt` and the title, and only when its `itemIdText` equals the loaded
  identity. A mismatched record is stale: clear it with `clearPlaybackHandoffLocalState`.
- Keep the early `return true` for an empty player (adoption still works).

### Hard invariant in the effect

In the `!playerEmpty` branch, call `dispatchLoad` only when the server head's identity equals the
loaded identity. When they differ, return. The prompt path in `shouldLoadQueueResource` already
covers "server is newer while paused". This holds even if a future change breaks the identity
lookup. Keep `isAlreadyPlayingThisAddByRSS` and `isAlreadyLoadedThisItem` as they are.

### Record Add by RSS plays

In `apps/web/src/hooks/usePlayAddByRSS.tsx`:

- Write the handoff record when the item loads: `writePlaybackHandoffLocalState({ itemIdText:
  addByRSSPlaybackIdentity(resourceData), itemTitle: resourceData.title ?? null, lastPlayedAt:
  new Date().toISOString() })`. Match the timestamp format the other writers use.
- Choose the queue with `getQueueForMedium(queues, mediumId ?? <podcast medium id>)`. Find the
  podcast medium constant in `@podverse/helpers` (the same value `getQueueForMedium` maps to the
  audio/video queue). Do not hardcode the number.
- Await `reqQueueResourceItemAddByRSSAddNowPlaying`, then refresh the active queue with the
  existing `useQueueResourcesLoadActive` loader for that queue's `id_text`, so
  `activeQueueUpcomingResources[0]` becomes the Add by RSS row. Keep playback starting
  immediately; only the server write and refresh are awaited, inside the existing async block.
- If the user started a different item before the POST returns, skip the refresh. Use the
  same load-generation pattern the queue head hook uses (`playbackLoadGenerationRef`), or an
  equivalent request id.
- A POST failure is logged once (`console.error`) and does not stop playback.

### Do not change

- `resolveHandoffDecision` in `@podverse/helpers`.
- The prompt UI and its copy.
- Clip, soundbite, and directory item load paths, except for reading the new identity function.

## Tests

`apps/web/src/hooks/__tests__/useMediaPlayerControllerQueueHeadLoading.test.tsx`:

- Add by RSS loaded and playing, handoff record still names the server head: no load, record
  cleared.
- Add by RSS loaded and paused, server head different and newer: prompt shown, no load.
- Same Add by RSS row as the server head: no reload.
- Empty player: server head still adopted, paused.

`usePlayAddByRSS` (new test file next to the hook, or the existing one if present):

- Writes the handoff record with the Add by RSS identity.
- `mediumId: null` posts to the podcast queue.
- Refreshes the active queue after the POST resolves; skips the refresh when another item started.

New E2E spec `apps/web/e2e/media-player-addbyrss-no-swap.spec.ts`. Reuse the login and seed
constants from `media-player-addbyrss-resume.spec.ts`. The seed user must have a directory item
as now-playing; check `tools/web/seed-e2e.mjs` and add one if the seed lacks it.

1. Sign in and load the home page. The mini player adopts the directory item.
2. Open a seeded Add by RSS episode and press play.
3. The mini player shows the Add by RSS title, stays on it after pause and play, and stays on it
   after waiting long enough for the queue refresh (poll, do not sleep).
4. Reload. The mini player shows the Add by RSS episode as now-playing.

Top-level `describe`: "Add by RSS playback keeps its item". Stay within the 10 s budget.

## Scratchpad entry

Append to `release-notes/scratchpad.md`:

```markdown
## Web keeps an Add by RSS episode in the player

- Surfaces: web
- Change: Playing an Add by RSS episode no longer gets replaced by the server's previous
  now-playing item. Add by RSS plays are written to the podcast queue even when the feed has no
  medium tag, and the queue refreshes after the write.
- Who notices: anyone playing an Add by RSS feed on web, especially after using another device
- Operator steps: none
```

## Done when

- [ ] Loaded identity drives `shouldLoadQueueResource`; stale records are cleared
- [ ] The automatic effect never loads a resource whose identity differs from the loaded one
- [ ] `usePlayAddByRSS` writes the handoff record, falls back to the podcast queue, awaits the
      POST, and refreshes the active queue
- [ ] Unit tests and the new E2E spec added
- [ ] Scratchpad entry appended

## Operator verification

**Root**

```bash
npm run build:packages
npm run test -w apps/web
make e2e_test_web_report_spec SPEC=e2e/media-player-addbyrss-no-swap.spec.ts,e2e/media-player-addbyrss-resume.spec.ts,e2e/media-player-foundation.spec.ts
open .artifacts/e2e-reports/latest/index.html
```
