**Cursor model:** Cursor Grok 4.7 · **Reasoning:** medium

# 27 — Playback core: a commanded start at or past the file's end backs off 5 s

When another device tells this device to start at a position (`take_over`, `play_item` with a
start, or `seek`), that position comes from the playing device's file. Dynamic ad insertion can
make this device's copy of the same item shorter, so the position can land at or past the end of
the file this device loaded. Seeking there would end the item at once and auto-advance. Instead,
the device starts at its own file's duration minus 5 s, never below 0 (R84).

This plan adds the one pure rule both runtimes apply. Web plan 23 applies it where the file's
duration becomes known; mobile plan 33 applies the same function on mobile.

The rule lives beside `clampNearEndSeconds` because that file is the single home for near-end
position rules. It is a different rule: `clampNearEndSeconds` treats a saved position within 5 s
of the end as finished and restarts at 0. A commanded position is a live position on another
device, so it is kept as is below the duration and backs off only when it reaches the end.

## Rows

R84

## Runs after

none

## Files

packages/playback-core/src/clampNearEndSeconds.ts
packages/playback-core/src/index.ts
packages/playback-core/src/__tests__/clampNearEndSeconds.test.ts

## `clampNearEndSeconds.ts`

Add below `clampPlaybackPositionForStorage`:

```typescript
/** Seconds a commanded start backs off from the end of this device's file. */
export const COMMAND_START_FILE_END_BACKOFF_SECONDS = 5;

/**
 * Where a position sent by another device starts in the file this device loaded.
 *
 * Below the file's duration the position is kept. At or past it, playback starts
 * `COMMAND_START_FILE_END_BACKOFF_SECONDS` before the end (never below 0), so the item plays its
 * last seconds instead of ending at once. With no known duration (`undefined`, `null`, not finite,
 * or not positive) the position is kept. Negative or non-finite positions start at 0.
 */
export function clampCommandStartToFileEnd({
  seconds,
  fileDurationSeconds,
}: {
  seconds: number;
  fileDurationSeconds: number | null | undefined;
}): number {
  const start = Number.isFinite(seconds) && seconds > 0 ? seconds : 0;
  if (
    fileDurationSeconds === null ||
    fileDurationSeconds === undefined ||
    !Number.isFinite(fileDurationSeconds) ||
    fileDurationSeconds <= 0
  ) {
    return start;
  }
  if (start >= fileDurationSeconds) {
    return Math.max(0, fileDurationSeconds - COMMAND_START_FILE_END_BACKOFF_SECONDS);
  }
  return start;
}
```

Leave the file's top doc block and `clampNearEndSeconds` unchanged.

## `index.ts`

Extend the first export line:

```typescript
export {
  clampCommandStartToFileEnd,
  clampNearEndSeconds,
  clampPlaybackPositionForStorage,
  COMMAND_START_FILE_END_BACKOFF_SECONDS,
} from './clampNearEndSeconds.js';
```

## Must stay true

- `clampNearEndSeconds`, `clampPlaybackPositionForStorage`, `resumeSeekFromAbridged`, and
  `resolvePlaybackLoadDecision` behave exactly as before. Nothing in this package calls the new
  function.
- The package stays free of DOM, React, and Node-only imports (mobile imports it).

## Tests

Vitest, add a `describe('clampCommandStartToFileEnd')` block to
`packages/playback-core/src/__tests__/clampNearEndSeconds.test.ts`:

- 100 in a 600 s file → 100.
- 597 in a 600 s file → 597 (inside the last 5 s is kept; this is not the restart rule).
- 600 in a 600 s file → 595; 700 in a 600 s file → 595.
- 3 in a 3 s file → 0 (never below 0); 10 in a 4 s file → 0.
- 700 with `fileDurationSeconds` `undefined`, `null`, `NaN`, `Infinity`, `0`, and `-1` → 700.
- `-5` and `NaN` seconds in a 600 s file → 0.
- `COMMAND_START_FILE_END_BACKOFF_SECONDS` is 5.

## Release scratchpad

none (no caller until plans 23 and 33)
