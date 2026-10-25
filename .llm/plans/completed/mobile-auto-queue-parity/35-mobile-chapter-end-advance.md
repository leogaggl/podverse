**Cursor model:** Cursor Grok 4.7 · **Reasoning:** extra high

# 35 — A chapter that reaches its end advances like any other item

When the phone plays a chapter (`playChapter`, from the full player's segment list), both media
engines pause at the chapter's end, journal `completed`, and emit `ended`. The provider's `ended`
handler then compares `engineSourceIdTextRef.current` with `playbackTargetRowMediaId(activeTarget)`.
For a chapter target that is the chapter id, but the engine names the source by the item it loaded
(`idTextFromTarget` in `mediaEngineSourceMeta.ts` returns `target.item.id_text` for a chapter). The
ids never match, so the handler returns and `advance('complete')` never runs: playback sits paused
at the chapter's end. The `progress` handler makes the same comparison, so while a chapter plays it
also skips the listen session, the sleep timer stop, and local position writes.

Fix both comparisons with one predicate that compares the engine id with the target's **engine**
identity (plan 40's `engineSourceIdentityFromTarget`). An event for a different item still fails
the check and is ignored.

## Rows

R33

## Runs after

40, 44

No plan in this set edits the `ended` or `progress` handler, or `playbackTargetRowMediaId`. Plan 40
adds `engineSourceIdentityFromTarget` and edits `mediaEngineSourceMeta.ts`; plan 44 is the last
plan that edits `PlaybackProvider.tsx`. Running after both keeps this the final edit to those two
files.

## Files

apps/mobile/src/lib/playback/mediaEngineSourceMeta.ts
apps/mobile/src/lib/playback/mediaEngineSourceMeta.test.ts
apps/mobile/src/lib/playback/buildPlaybackTarget.ts
apps/mobile/src/playback/PlaybackProvider.tsx
release-notes/scratchpad.md

## What happens at a chapter's end after this change

`advance('complete')` runs, the same as at the end of an episode, clip, or soundbite:

- a `complete` playback event for the item (`playbackEventSource` maps a chapter to its item). The
  engine journal already records `completed` for the item at that moment and the journal drain
  sends it, so this records nothing new;
- the item moves to history as completed (`playbackTargetToHistoryTarget` maps a chapter to its
  item);
- the next manual queue row plays, else the next auto-queue row (the chapter's seed is its item,
  plan 10's `autoQueueSeedFromPlaybackTarget`), else `shouldClearNowPlayingAfterAdvance` clears the
  player;
- `getListenSession().recordCompleted()` runs first, as for every other `ended`.

**Agreed difference from web.** Web arms a pause one second after a chapter's `end_time` and stays
paused there; its `onEnded` fires only at the end of the media file. Mobile already treats the end
of a bounded range as the item ending for clips and soundbites, and the native advance window
(plans 41 and 42) advances at a range end while JS is not running. This change makes a chapter do
the same while JS runs. R33 settles it.

## Design

### `mediaEngineSourceMeta.ts`

Add, next to `engineSourceIdentityFromTarget` (plan 40):

```typescript
/**
 * Whether an engine event about `engineIdText` belongs to `target`. The engine names a source by
 * the media it loaded, so a chapter target matches its item's id and a clip target matches only
 * the clip's id. With no engine id, no target, or a target with no engine identity there is
 * nothing to tell them apart by, so it counts as a match.
 */
export const engineSourceMatchesTarget = (
  engineIdText: string | null,
  target: PlaybackTarget | null
): boolean => {
  if (engineIdText === null || target === null) {
    return true;
  }
  const identity = engineSourceIdentityFromTarget(target);
  return identity === null || identity.idText === engineIdText;
};
```

It compares `idText` only. `engineSourceIdTextRef` holds only the id (`sourceChanged` stores
`meta?.idText`), and a clip, soundbite, or Add by RSS id never equals an item id.

Rewrite the doc comment above `idTextFromTarget`. It currently says it must return what
`playbackTargetRowMediaId` returns. Replace it with: "Engine source id for this target: the id of
the media the engine loads. A chapter plays its item, so a chapter target has its item's id, not
the chapter id `playbackTargetRowMediaId` returns. Compare an engine id with a target through
`engineSourceMatchesTarget`."

### `buildPlaybackTarget.ts`

In the doc comment above `playbackTargetRowMediaId`, keep the existing sentences and add one at the
end: "For a chapter this is the chapter id, while the engine names the item it loaded, so compare
engine ids with `engineSourceMatchesTarget` instead." No code change.

### `PlaybackProvider.tsx` (by symbol)

Add `import { engineSourceMatchesTarget } from '../lib/playback/mediaEngineSourceMeta';` beside the
other `../lib/playback/*` value imports. The provider does not import that module today; if an
earlier plan added an import from it, add the name to that import instead.

In the `useNativePlaybackBridge({ … })` call:

- `ended`: replace the three locals (`engineId`, `activeTarget`, `activeId`) and the
  `engineId !== null && activeId !== null && engineId !== activeId` check with:

  ```typescript
  if (!engineSourceMatchesTarget(engineSourceIdTextRef.current, activeTargetRef.current)) {
    return;
  }
  ```

  `getListenSession().recordCompleted()` and `void advance('complete')` stay as they are.
- `progress`: replace the same three locals and the `identityMatches` expression with
  `const identityMatches = engineSourceMatchesTarget(engineSourceIdTextRef.current,
  activeTargetRef.current);`. The early return on `!identityMatches` and everything after it stay.

Leave `isAdoptedSourceCurrent` and the early return at the top of `adoptEngineSource` on
`playbackTargetRowMediaId`. Adopted targets are never chapters. When the car starts the same
episode while a chapter target plays, the engine is playing the whole item and adoption replaces the
chapter target with it, which is correct. Plan 44 owns `adoptEngineSource`. Other
`playbackTargetRowMediaId` callers compare list rows with the active target and stay.

If cross-device work has already added branches to these handlers, keep them; change only the
identity comparison.

## Constraints

- A stale `ended` or `progress` event from a different item is still ignored. Engine on item B,
  target A (an item, a chapter of A, or a clip): the ids differ.
- The one behavior change outside chapters: a target whose engine id would be an empty string now
  counts as a match. `mediaEngineSourceMetaFromTarget` omits meta for that target, so the engine
  has no id to compare with anyway.
- An `ended` left over from an earlier load of the **same** item (the episode ended, then the user
  starts one of its chapters) cannot be told apart by id. That is the same as replaying an item
  today, and `advancingRef` keeps one advance at a time.
- Comments describe the code as it stands; no plan numbers. `===` only; no `as`; named exports.

## Tests

- `mediaEngineSourceMeta.test.ts` (Vitest, already in `apps/mobile/vitest.config.ts`), add a
  `describe('engineSourceMatchesTarget')`:
  - a chapter target matches its item's id and does not match the chapter id or another item's id;
  - an item target matches its own id and not another item's id;
  - a clip target matches the clip id and not its item's id;
  - an Add by RSS target matches `addByRssPlaybackMediaId(resourceData)`;
  - a null engine id or a null target counts as a match.
- No provider test, as the `ended` and `progress` handlers have none. No Maestro flow: the check
  needs a chapter played to its end, and the predicate's unit tests hold the identity rule
  (**mobile-test-economics**).

## Release scratchpad

```markdown
## A chapter played to its end moves on to what's next

- Surfaces: mobile
- Change: when a chapter started from the full player's chapter list reaches its end, the phone now continues the way it does at the end of an episode or clip: the next manual queue row plays, else the next auto-queue row, else the player clears, and the episode moves to history as finished (the engine already recorded it as finished). Before, playback paused at the chapter's end and nothing followed. While a chapter plays, listening progress, the listen session, and the sleep timer now work as they do for a whole episode. Web still pauses at a chapter's end; this is a deliberate mobile difference that matches how mobile already ends clips and soundbites.
- Who notices: mobile listeners who play chapters from the full player
- Operator steps: none
```
