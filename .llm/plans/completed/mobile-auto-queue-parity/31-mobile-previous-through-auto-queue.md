**Cursor model:** Opus 5.5 · **Reasoning:** high

# 31 — Mobile Previous through the auto-queue

Replace mobile's account-history Previous with web's: chapters first, restart past 3 seconds,
step back through auto-queue rows already played, then walk the source backward. With shuffle on,
Previous only restarts. Account queue history is no longer read.

Parity source: web `useTrackPreviousButtonActions.ts` (`runCorePreviousTrack`, the 3-second rule
on click, no 3-second rule on long press) and plan 10's `resolveAutoQueuePrevious`. Chapter and
3-second rules stay in mobile's `previousAction.ts`, unchanged.

## Rows

R15, R16, R17, R25

## Runs after

30

## Files

apps/mobile/src/lib/autoQueue/autoQueue.ts
apps/mobile/src/lib/autoQueue/autoQueue.test.ts
apps/mobile/src/playback/useAutoQueueFill.ts
apps/mobile/src/playback/PlaybackProvider.tsx
release-notes/scratchpad.md

## Design

### `clear-buffer` directive

Add `{ mode: 'clear-buffer' }` to `AutoQueueDirective`: empty the rows, active row 0, config
unchanged, `gate.bump()`. This is web's "load with `autoQueueShouldClear: true` and the same
config" for a Previous that loads the item before row 0, so a playlist stays the source.
`resolveAutoQueueConfigAfterDirective` returns `current` for it. `applyAutoQueueDirective` in
`useAutoQueueFill` handles it.

### `resolvePreviousTrackStep` in the fill hook

`useAutoQueueFill` adds
`resolvePreviousTrackStep(): Promise<AutoQueuePreviousDecision | null>`:

1. `seed = autoQueueSeedFromPlaybackTarget(activeTargetRef.current)`; null returns null (Add by
   RSS and livestreams; plan 32 handles Add by RSS).
1. `resolveAutoQueuePrevious({ config, seed, activeRow, fetchers })` with the refs and
   `autoQueueRepository.createSourceFetchers(buildContext())`. It does not go through the fill
   gate (it is not a fill), but its result is dropped (return null) when the playing target's
   `playbackTargetRowMediaId` or the gate generation changed while it was in flight.
1. A rejected walk returns `{ kind: 'restart' }`.

### PlaybackProvider (by symbol)

- Delete `resolvePreviousQueueResource`. Drop `queueRepository.getHistoryPage` from this path and
  any import that becomes unused.
- `playAutoQueueRow(row, options?)`: add an optional `{ autoQueue: AutoQueueDirective; intent:
  'fresh_transition' | 'explicit_play' }`, defaulting to `preserve` and `'fresh_transition'` as
  today. Clip and soundbite rows pass the directive through (`startClipPlayback` /
  `startSoundbitePlayback` options); item rows pass both to `playItemByIdWithIntent`.
- New `runPreviousTrack(target): Promise<void>` (not on the session):
  1. `resolvePreviousTrackStep()`.
  1. `step-back-row`: `writeAutoQueueState({ activeRow: row })`, then
     `playAutoQueueRow(rows[row])` with `preserve` and `'fresh_transition'` (web loads a stepped-back
     row the way it loads any auto-queue row). A missing row or a `false` result seeks to 0.
  1. `load-previous`: `playAutoQueueRow(resource, { autoQueue: { mode: 'clear-buffer' }, intent:
     'explicit_play' })`. The refill in `playTarget` then seeds the loaded item at row 0 and fills
     forward, so the item just left becomes the next row.
  1. `restart`, or null: `seekTo(0)`.
- `skipToPrevious`: keep the chapter path and `resolvePreviousAction({ chapters,
  hasPreviousQueueItem: true, positionSeconds })` as they are. On `previous-queue-item`, call
  `runPreviousTrack(target)`. Rewrite the comment above the chapter read so it no longer mentions
  queue history.
- `skipToPreviousTrack` (the hold gesture and the remote `previous` command while JS owns
  advance): `runPreviousTrack(target)` directly, with no 3-second rule, matching web's long press.
  The native engine on both platforms (`handleRemoteTrackCommand`) already restarts past 3 seconds
  before it hands the remote command to JS.
- Keep both names and their `() => Promise<void>` signatures; the cross-device set wraps them.
- Previous does not move the item being left to history. Web does not either; the new item's
  `play` event updates now-playing, as an explicit play does on mobile today.

Signed-out listeners now get the full Previous; it reads only public auto-queue sources, plus the
playlist the listener played.

## Constraints

- Comments describe the code as it stands; no plan numbers.
- No change to `previousAction.ts` or `previousAction.test.ts`.

## Tests

- `autoQueue.test.ts`: `resolveAutoQueueConfigAfterDirective` returns the same config for
  `clear-buffer`.
- The step-back, shuffle, and backward-walk decisions are covered by plan 10's
  `autoQueueWalk.test.ts`; the chapter and 3-second rules by `previousAction.test.ts`. No new
  Maestro flow: Previous has no device-only behavior beyond the existing `player-screen` flow's
  transport assertions.

## Release scratchpad

```markdown
## Mobile Previous steps back through what auto-queue played

- Surfaces: mobile
- Change: without chapters, Previous restarts the item past 3 seconds, as before. Otherwise it now steps back through the items auto-queue already played, and before the first one it plays the previous playlist row, album track (season order), or episode (publish date). With shuffle on it only restarts. Holding Previous, and the lock screen or car Previous command while the app is running, skip the 3-second restart. Previous no longer reads the account queue history, and it now works signed out.
- Who notices: mobile listeners using Previous on the full player, lock screen, CarPlay, or Android Auto
- Operator steps: none
```
