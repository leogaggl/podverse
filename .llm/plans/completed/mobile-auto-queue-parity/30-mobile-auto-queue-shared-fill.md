**Cursor model:** Opus 5.5 · **Reasoning:** extra high

# 30 — Mobile auto-queue on the shared helper, with one guarded refill

Move the mobile auto-queue loader onto `@podverse/playback-core` (plan 10), and fill the buffer
right after each load the way web does, through one refill function with one in-flight guard.
This is the forward-fill fix: today mobile clears the buffer on an explicit play and nothing fills
it again until Next is pressed, so the full player counts zero rows ahead and Next stays disabled.

Parity source: web `useMediaPlayerControllerQueueHeadLoading.ts` (`fetchAutoQueueResources`, the
effect on the playing item), `ShuffleButton` / `RepeatButton`, and plan 10's `fillAutoQueueAhead`.

## Rows

R3, R6, R8, R10, R11, R13, R24, R25

## Runs after

10

## Files

apps/mobile/src/data/repositories/autoQueueRepository.ts
apps/mobile/src/lib/autoQueue/autoQueue.ts
apps/mobile/src/lib/autoQueue/autoQueue.test.ts
apps/mobile/src/contexts/AutoQueueProvider.tsx
apps/mobile/src/hooks/useAutoQueueLoadResources.ts (delete)
apps/mobile/src/playback/autoQueueFillGate.ts (new)
apps/mobile/src/playback/autoQueueFillGate.test.ts (new)
apps/mobile/src/playback/useAutoQueueFill.ts (new)
apps/mobile/src/playback/PlaybackProvider.tsx
apps/mobile/src/screens/player/FullPlayerScreen.tsx
apps/mobile/vitest.config.ts
release-notes/scratchpad.md

## R3 — does mobile match web?

Partly. Mobile has the same buffer, config, prefs (`aqc.rd` / `aqc.rp`), source choice, and
advance order, but these differ from web. Each line names the plan that fixes it.

| Gap | Web | Mobile today | Plan |
| --- | --- | --- | --- |
| Eager fill | Refills when the playing item changes and the active row is the highest key or the buffer is empty | Fills only lazily, on a Next press or `ended` | 30 |
| Next enable state | Never disabled | Counts loaded rows only, so it is off after every explicit play | 30 (rows now load), 33 (final rule) |
| Previous | Steps back auto-queue rows, then walks the source backward | Reads account queue history page 1; signed-out and Add by RSS get a restart only | 31 |
| Add by RSS next / previous | Walks the feed's items | `ended` clears now-playing unless the manual queue has rows; Previous restarts | 32 |
| Playlist play config | New shuffle hash | `seed-playlist` keeps the old hash | 30 |
| Repeat toggle | Clears the buffer, resets paging, reloads | Flips `repeat` only | 30 |
| Shuffle toggle | Clears and reloads with the new config | Clears, then reloads from a `setTimeout` that reads a ref | 30 |
| Playable playlist rows | `isPlayablePlaylistResource` | Looser inline removed-source check | 30 (via plan 10) |
| Concurrent fills | One effect per item change | The Next probe, `advanceAutoQueue`, and the toggles can fetch at once, and a late result can land on a newer item | 30 |
| Seed | n/a | Two copies (`currentAutoQueueSeed`, `autoQueueSeedFromTarget`) | 30 |
| Manual count for Next | n/a (never disabled) | Full player reads the active queue, not the queue for the playing medium | 33 |

## Design

### Repository fetchers

`autoQueueRepository`:

- Add a `direction: AutoQueueDirection` argument (type from `@podverse/playback-core/autoQueueWalk`)
  to `getPlaylistResourcesForQueueByListPosition`, `getItemsForQueueBySeason`, and
  `getItemsForQueueByPubDate`, passed through to the `req*` call in place of the hard-coded
  `'forward'`.
- Add `createSourceFetchers(context: MobileAuthRequestContext): AutoQueueSourceFetchers`, mapping
  each fetcher to the existing method. Every fetcher returns the plain array the methods already
  return. No caching (these stay live, as the file's doc comment says).

### Mobile auto-queue module

`apps/mobile/src/lib/autoQueue/autoQueue.ts` keeps only what is mobile-specific:

- `AutoQueueDirective` (unchanged).
- `resolveAutoQueueConfigAfterDirective(current, directive, nextShuffleHash)`: `clear` returns
  `resolveAutoQueueConfigForExplicitPlay(current, null, nextShuffleHash)`, `seed-playlist` returns
  `resolveAutoQueueConfigForExplicitPlay(current, directive.playlistIdText, nextShuffleHash)`.
  Playlist play now mints a new shuffle hash, as web does.

Delete the local types, `checkIsActiveRowHighestKey`, `autoQueueIncrementActiveRow`,
`createDefaultAutoQueueConfig`, and `toggleAutoQueueShuffle`. Callers import them from
`@podverse/playback-core/autoQueue` (subpath value imports; mobile never imports the
`@podverse/helpers` barrel for new code). Rewrite the module doc comment so it describes what the
file holds now. `AutoQueueProvider` calls `createDefaultAutoQueueConfig(getShuffleHash)` and
imports its types from playback-core.

Delete `apps/mobile/src/hooks/useAutoQueueLoadResources.ts`. `AutoQueueSeed` comes from
playback-core.

### Fill gate (pure)

`apps/mobile/src/playback/autoQueueFillGate.ts` exports `createAutoQueueFillGate()`, framework-free
so it is unit-tested:

- `generation(): number` and `bump(): void`. A bump means "the buffer now belongs to a different
  play": an explicit play or playlist play (`clear`, `seed-playlist`), a Shuffle or Repeat toggle,
  and `clearNowPlaying`.
- `run<T>(key: string, task: () => Promise<T>): Promise<{ stale: boolean; value: T }>`. The key is
  the playing target's `playbackTargetRowMediaId`. While a task with the same key and generation
  is in flight, a second `run` joins it instead of starting another. A `run` with a different key,
  or after a bump, starts a new task, and the older one resolves with `stale: true` when it
  settles. A rejected task rejects every joined caller and frees the slot. So a fill started for
  the item before a manual-queue advance (which loads with `preserve` and does not bump) never
  answers for the item after it.

### Fill hook

`apps/mobile/src/playback/useAutoQueueFill.ts` exports `useAutoQueueFill(params)`, called once in
`PlaybackProvider`. It owns the auto-queue refs that `PlaybackProvider` holds today
(`autoQueueActiveRowRef`, `autoQueueConfigRef`, `autoQueueResourcesRef`), mirrored from
`useAutoQueue()`, plus one gate. Params: the provider's `activeTargetRef` and a
`buildContext: () => MobileAuthRequestContext` (read through the provider's `buildContextRef`, so
the hook's callbacks stay stable).

It returns, with stable identities:

- `autoQueueRefs` — the three refs, for the provider's synchronous reads.
- `writeAutoQueueState({ resources?, config?, activeRow? })` — the only writer. Sets each given ref
  and the matching `AutoQueueProvider` setter in the same call.
- `applyAutoQueueDirective(directive)` — moved from the provider unchanged in behavior, plus
  `gate.bump()` for any mode other than `preserve`, and a reset of `isAutoQueueExhausted`.
- `refillAutoQueueAhead(): Promise<AutoQueueRefillOutcome>` where
  `AutoQueueRefillOutcome = { hasRowAhead: boolean; exhausted: boolean; failed: boolean }`:
  1. `seed = autoQueueSeedFromPlaybackTarget(activeTargetRef.current)`. Null (Add by RSS,
     livestream, empty player): no fetch, `{ hasRowAhead: false, exhausted: true, failed: false }`.
  1. `gate.run(playbackTargetRowMediaId(target), () => fillAutoQueueAhead({ config, seed, resources,
     activeRow, minRowsAhead: AUTO_QUEUE_MIN_ROWS_AHEAD, fetchers:
     autoQueueRepository.createSourceFetchers(buildContext()) }))`, reading the refs at task start.
     `AUTO_QUEUE_MIN_ROWS_AHEAD = 1`, exported from the hook file. `fillAutoQueueAhead` returns
     without fetching when a row is already ahead, which is web's "active row is the highest key or
     the buffer is empty" trigger.
  1. Not stale: `writeAutoQueueState({ resources, config })` and set `isAutoQueueExhausted` to
     `result.exhausted && !hasAutoQueueRowAfter(resources, activeRow)`. Stale: write nothing.
  1. A rejected fill logs in development the way `PlaybackProvider` logs its other non-fatal
     playback failures, writes nothing, and returns `failed: true`. The next trigger tries again.
  1. Returns `hasRowAhead` from `hasAutoQueueRowAfter` on whatever the refs hold afterward.
- `isAutoQueueExhausted: boolean` — React state, for plan 33's Next rule, with a ref copy.
- `toggleShuffle()` and `toggleRepeat()` — `gate.bump()`, then `writeAutoQueueState({ resources: {},
  activeRow: 0, config: toggleAutoQueueShuffle(config, getShuffleHash) })` (or
  `toggleAutoQueueRepeat(config)`), then `void refillAutoQueueAhead()`. The fill seeds key 0 with the
  playing item. No `setTimeout`. Repeat now clears and reloads like web's `RepeatButton`.

### PlaybackProvider wiring (by symbol)

- Replace the `useAutoQueue()` + `useAutoQueueLoadResources()` block and the three ref
  declarations with `useAutoQueueFill`. Keep `activeTargetRef`'s declaration above the call.
- `applyAutoQueueDirective`: use the hook's version. Remove the provider's copy.
- `playTarget`: right after `applyAutoQueueDirective(params.autoQueue)` on a successful load (the
  same place it runs now), `void refillAutoQueueAhead()`. This covers every load that has a seed:
  explicit play, playlist play, auto-queue advance, manual queue advance, cold-start restore, and
  queue-head adoption. Never awaited, so it adds nothing to load latency or first paint.
- `currentAutoQueueSeed`: delete; callers use `autoQueueSeedFromPlaybackTarget(activeTargetRef.current)`.
- `computeHasAutoQueueNext`: true when `hasAutoQueueRowAfter(resources, activeRow)`; otherwise
  false when the config is disabled, the seed is null, or `isAutoQueueExhausted`; otherwise true.
  It stays a hint for `resolveQueueAdvance`; `advanceAutoQueue` still confirms.
- `advanceAutoQueue`: when the next row is missing, `await refillAutoQueueAhead()` (joining an
  in-flight fill) and read the ref again. Then `writeAutoQueueState({ activeRow: nextRow })` and
  `playAutoQueueRow(row)` as now. The refill in `playTarget` keeps one row ahead after each step.
- `resolveHasAutoQueueRow`: same pattern; a failed refill returns false, as the catch does today.
- `clearNowPlaying`: `gate.bump()` through the hook (expose `invalidateAutoQueueFill()` for this),
  so a fill in flight for the cleared item is dropped.
- Session API: add `toggleShuffle: () => void` and `toggleRepeat: () => void` to the context type
  and the session value. Do not change the names or the `() => Promise<void>` signatures of
  `skipToNext`, `skipToPrevious`, `skipToNextTrack`, `skipToPreviousTrack`, or `advance`; the
  cross-device set wraps them.

### FullPlayerScreen (by symbol)

- Delete `autoQueueSeedFromTarget` and the `useAutoQueueLoadResources` call.
- `handleToggleShuffle` and `handleToggleRepeat` call the session's `toggleShuffle` and
  `toggleRepeat`. Keep reading `autoQueueConfig.random` / `.repeat` from `useAutoQueue()` for the
  utility row.
- Leave `autoUpcomingCount` and `canSkipToNext` as they are; plan 33 replaces them. With the
  eager fill, `autoUpcomingCount` is non-zero once the next row is found, so Next turns on
  mid-series after this plan alone.

### Where the rows live (for area D)

Resolved rows live in `AutoQueueProvider` state (`autoQueueResources`, `autoQueueActiveRow`,
`autoQueueConfig`), with synchronous copies in `useAutoQueueFill`'s refs. `writeAutoQueueState` is
the only writer. Refills happen in `refillAutoQueueAhead`: after every successful load in
`playTarget`, on a Next press or `ended` with no row loaded, and after Shuffle or Repeat. Area D's
native window raises the rows-ahead target and writes the snapshot after each applied refill and
each active-row change; both go through this hook.

## Constraints

- Comments describe the code as it stands; no plan numbers, no "ported from", no "mirrors web".
- `import type` on its own line; subpath imports for playback-core values; extensionless relative
  imports; no `as`; `===` only.
- Screens and hooks reach the network only through `autoQueueRepository`.

## Tests

- `autoQueueFillGate.test.ts` (Vitest): a second `run` with the same key joins the in-flight task;
  a `run` with a different key starts a new task and the older resolves `stale`; `bump` makes the
  in-flight result `stale` and lets a new `run` start; a rejection reaches every joined caller and
  frees the slot.
- `autoQueue.test.ts`: drop the cases for removed helpers (covered in playback-core); keep and
  update `resolveAutoQueueConfigAfterDirective` cases: `clear` and `seed-playlist` both mint a new
  hash, keep `random` and `repeat`, reset `nextPage`, and set `disabled: false`.
- No new Maestro flow. Plan 33 adds the device assertion for Next.

## Release scratchpad

```markdown
## Mobile auto-queue fills right after Play

- Surfaces: mobile
- Change: playing an episode, track, clip, or playlist row now fetches the next auto-queue rows right away (and after a resume on launch), so Next is available mid-series without pressing it first. The fill uses the same shared source rules as web. Shuffle and Repeat both clear and reload the up-next rows; playlist plays start a new shuffle order; playlist clip rows whose episode is gone are skipped, as on web. A slow fill can no longer land on an item you have since moved past.
- Who notices: mobile listeners who start in the middle of a series or album
- Operator steps: none
```
