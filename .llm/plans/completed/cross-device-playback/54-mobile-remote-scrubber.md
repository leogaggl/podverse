**Cursor model:** Cursor Grok 4.7 · **Reasoning:** extra high

# 54 — Full player scrubber with a remote source

The full player's scrubber reads this phone's progress stores. The remote full player (plan 55)
needs the same scrubber over another device's position, with seeking sent as remote commands. This
plan moves the scrubber's body into a component that takes its numbers from a source object, keeps
`FullPlayerScrubber` as the local wrapper with unchanged behavior, and adds a remote wrapper.

Before editing, confirm plan 50's `useRemotePlaybackPositionSeconds` and plan 30's
`getCrossDevicePlaybackPositionSeconds`, `subscribeCrossDevicePlaybackPositionClock`, and
`getCrossDevicePlaybackView` exist, and that plan 34 routes the session context's `seekTo`
(`routedSeekTo`). If not, stop and report.

## Rows

R5

## Runs after

50

## Files

apps/mobile/src/components/player/FullPlayerScrubber.tsx

## Decisions this plan fixes

- **Remote scrubbing is allowed.** Dragging or tapping the remote bar sends one absolute seek on
  release; plan 34 coalesces seeks in flight. Live items never reach this scrubber (plan 55 shows a
  Live label instead).
- **The released position holds until the other device answers.** After a remote seek, the bar and
  clock stay at the chosen position until a newer shared state arrives or
  `PLAYBACK_COMMAND_TTL_MS` passes, so the thumb does not jump back while the command travels.
- **Remote duration is the shared state's.** The bar, the duration label, and the ratio read
  `durationSeconds`, which plan 55 passes from `display.durationSeconds`, and plan 50 sets that from
  `state.duration_seconds` (plan 11: a remote view reads duration only from the shared state). This
  phone's own duration store is never read on the remote path.
- **No chapter markers or clip range on the remote bar.** The phone loads the remote item's
  chapters for the segment band (plans 51 and 55), but the remote bar stays plain, as web's remote
  progress bar does. The summary carries no clip range.
- **The local scrubber does not change.** Same hooks, same subscriptions, same test ids. The remote
  wrapper never mounts in local mode, so the local path never starts the remote clock.

## `FullPlayerScrubber.tsx`

Anchor: `export function FullPlayerScrubber({ chapters }: FullPlayerScrubberProps)`.

1. Add a source type at the top of the file (not exported unless plan 55 needs it; it does not):

   ```typescript
   type FullPlayerScrubberSource = {
     durationSeconds: number;
     /** Whole-second playhead for the clock labels. */
     clockSeconds: number;
     getRatio: () => number;
     subscribeRatio: (listener: () => void) => () => void;
     seekTo: (seconds: number) => void;
     clip: … | null;       // the type `activeTarget.clip` has today
     soundbite: … | null;  // the type `activeTarget.soundbite` has today
   };
   ```

2. Rename the current body to `function FullPlayerScrubberTrack({ chapters, source }: { chapters:
   DTOItemChapter[]; source: FullPlayerScrubberSource })`. Inside it, replace each read with the
   source:
   - `usePlaybackDuration()` → `source.durationSeconds`
   - `usePlaybackPositionClock()` → `source.clockSeconds`
   - `getPlaybackProgressRatio()` (the `liveRatioShared` initial value and the subscription
     callback) → `source.getRatio()`
   - `subscribePlaybackProgress(…)` in the effect → `source.subscribeRatio(…)`, with
     `source.subscribeRatio` and `source.getRatio` in that effect's dependency list. At the start
     of that effect, when `!isScrubbing.value`, set `liveRatioShared.value = source.getRatio()`
     once before subscribing, so a new source applies without waiting for the next tick
   - `seekTo` from `usePlaybackSession()` → `source.seekTo`
   - `clip` and `soundbite` derived from `activeTarget` → `source.clip` and `source.soundbite`
   Everything else (gestures, scrub preview store, chapter math, styles, test ids) stays as it is.
   The remote track writes the same scrub preview store while held, so the remote segment band
   (plan 55) names the chapter under the thumb, as the local band does.

3. `export function FullPlayerScrubber({ chapters }: FullPlayerScrubberProps)` becomes the local
   wrapper: it calls the same hooks the body called before (`usePlaybackSession()` for
   `activeTarget` and `seekTo`, `usePlaybackDuration()`, `usePlaybackPositionClock()`), builds the
   source with `getRatio: getPlaybackProgressRatio` and `subscribeRatio: subscribePlaybackProgress`
   (both module functions, so stable), memoizes it, and renders
   `<FullPlayerScrubberTrack chapters={chapters} source={source} />`.

4. Add `export function FullPlayerRemoteScrubber({ durationSeconds }: { durationSeconds: number |
   null })`:
   - `const duration = durationSeconds !== null && durationSeconds > 0 ? durationSeconds : 0;`
   - `const { seekTo } = usePlaybackSession();` (plan 34 sends it to the other device).
   - `const remoteClock = useRemotePlaybackPositionSeconds();`
   - `const [pendingSeek, setPendingSeek] = useState<{ seconds: number; baseRevision: number | null;
     atMs: number } | null>(null);`
   - Read `revision = useCrossDevicePlaybackView().state?.revision ?? null`. In an effect on
     `[revision, pendingSeek]`: when `pendingSeek !== null` and `revision !==
     pendingSeek.baseRevision`, clear it. A second effect arms a `setTimeout` for
     `PLAYBACK_COMMAND_TTL_MS` (`@podverse/helpers/accountPlaybackStream`) whenever `pendingSeek`
     is set, clears it on fire, and cancels on cleanup.
   - `seek = useCallback((seconds) => { setPendingSeek({ seconds, baseRevision: revision, atMs:
     Date.now() }); seekTo(seconds); }, [revision, seekTo])`.
   - `getRatio = useCallback(() => { const position = pendingSeek?.seconds ??
     getCrossDevicePlaybackPositionSeconds(Date.now()); return duration > 0 && position !== null ?
     clampRatio(position / duration) : 0; }, [duration, pendingSeek])`.
   - `subscribeRatio = subscribeCrossDevicePlaybackPositionClock`.
   - `clockSeconds = Math.floor(pendingSeek?.seconds ?? remoteClock ?? 0)`.
   - `clip: null`, `soundbite: null`; render `<FullPlayerScrubberTrack chapters={EMPTY_CHAPTERS}
     source={source} />` with a module-level `const EMPTY_CHAPTERS: DTOItemChapter[] = [];`.

   A changed `getRatio` identity re-runs the subscription effect, which sets `liveRatioShared`
   from it at once (step 2); that is how the held position reaches the fill.

5. Update the file's doc comment: the track takes its numbers from a source; `FullPlayerScrubber`
   is this phone's playback, and `FullPlayerRemoteScrubber` is another device's.

## Tests

No new unit test. The local scrubber keeps its behavior and test ids, so the existing
`player-screen` Maestro flow still covers it; plan 57's flow renders the remote scrubber in the
remote full player.

## Release scratchpad

none
