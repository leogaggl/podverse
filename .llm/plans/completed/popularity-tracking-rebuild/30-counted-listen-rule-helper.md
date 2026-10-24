**Cursor model:** Cursor Grok 4.7 · **Reasoning:** high

# 30 — Shared counted-listen rule and taste-score helper

One pure module in `@podverse/helpers` holds the rule every surface uses to decide that a listen
counts (60 seconds heard or 25% of the item, whichever comes first), the taste-score decay formula
and its constants, and the result types the listen and open write paths return. The server checks
the rule with it (plan 32 through plan 31), web and mobile call it before sending a listen (area H),
and later recommendation readers fade stored scores with the same function.

Mobile cannot import the `@podverse/helpers` barrel, so the module also gets a subpath export.

## Rows

R33, R25

## Runs after

none

## Files

- `packages/helpers/src/lib/popularityListen.ts` (new)
- `packages/helpers/src/lib/popularityListen.test.ts` (new)
- `packages/helpers/src/index.ts`
- `packages/helpers/package.json`

## Module — `packages/helpers/src/lib/popularityListen.ts`

Write it exactly in this shape. Doc comments describe the code as it stands
(**comments-future-forward**); the longer explanation lives in `docs/features/POPULARITY-TRACKING.md`,
which plan 31 fills.

```typescript
/** Media seconds heard after which a listen counts, whatever the item's length. */
export const POPULARITY_COUNTED_LISTEN_MIN_SECONDS = 60;

/** Share of the item heard after which a listen counts, when that comes before the seconds rule. */
export const POPULARITY_COUNTED_LISTEN_MIN_FRACTION = 0.25;

/**
 * Seconds of media a listener must hear before a listen counts: 60 seconds or 25% of the item,
 * whichever is smaller. An unknown, zero, negative, or non-finite duration uses the 60-second rule.
 */
export function getCountedListenThresholdSeconds(durationSeconds: number | null | undefined): number {
  if (
    durationSeconds === null ||
    durationSeconds === undefined ||
    !Number.isFinite(durationSeconds) ||
    durationSeconds <= 0
  ) {
    return POPULARITY_COUNTED_LISTEN_MIN_SECONDS;
  }
  return Math.min(
    POPULARITY_COUNTED_LISTEN_MIN_SECONDS,
    durationSeconds * POPULARITY_COUNTED_LISTEN_MIN_FRACTION
  );
}

/**
 * True when `secondsHeard` (media seconds actually played, not wall-clock time and not seek
 * distance) meets the counted-listen rule for an item or clip of `durationSeconds`.
 */
export function isCountedListen(input: {
  secondsHeard: number;
  durationSeconds: number | null | undefined;
}): boolean {
  if (!Number.isFinite(input.secondsHeard) || input.secondsHeard <= 0) {
    return false;
  }
  return input.secondsHeard >= getCountedListenThresholdSeconds(input.durationSeconds);
}

/** Half-lives, in days, of the two taste scores: what someone likes now, and long-term taste. */
export const POPULARITY_TASTE_HALF_LIFE_DAYS = {
  recent: 14,
  longTerm: 180,
} as const;

/** Score added for each counted listen of a show, and again when that listen finishes. */
export const POPULARITY_TASTE_LISTEN_WEIGHT = 1;
export const POPULARITY_TASTE_COMPLETION_WEIGHT = 1;

const MS_PER_DAY = 86_400_000;

/**
 * Fades a stored taste score from `from` to `to` with `score × 0.5^(days / halfLifeDays)`.
 * When `to` is not after `from`, the score is returned unchanged. Readers fade every stored score
 * to the same moment before comparing them; the write path applies the same formula in SQL.
 */
export function fadeTasteScore(input: {
  score: number;
  from: Date;
  to: Date;
  halfLifeDays: number;
}): number {
  const elapsedMs = input.to.getTime() - input.from.getTime();
  if (!Number.isFinite(elapsedMs) || elapsedMs <= 0) {
    return input.score;
  }
  return input.score * Math.pow(0.5, elapsedMs / MS_PER_DAY / input.halfLifeDays);
}

/** What the listen write path did with one report. */
export type PopularityListenResult =
  | 'counted'
  | 'updated'
  | 'unchanged'
  | 'daily_cap_reached'
  | 'below_threshold'
  | 'not_allowed'
  | 'not_found'
  | 'clip_source_removed';

/** What the open write path did with one profile or playlist open. */
export type PopularityOpenResult = 'counted' | 'unchanged' | 'own_content' | 'not_allowed' | 'not_found';
```

Do not add any other export. The daily cap and rate limit are server settings (plan 32), not
constants here.

## Exports

- `packages/helpers/src/index.ts`: add `export * from './lib/popularityListen.js';` on the line
  after the existing `export * from './lib/popularityTracking.js';` (search for that line; if the
  barrel orders exports differently, keep the file's ordering style and put it beside
  `popularityTracking`).
- `packages/helpers/package.json` `exports`: add a subpath beside `./playbackOutboxLimits`, in the
  same shape:

```json
    "./popularityListen": {
      "types": "./dist/lib/popularityListen.d.ts",
      "default": "./dist/lib/popularityListen.js"
    },
```

Mobile imports it as `@podverse/helpers/popularityListen`; web and server code may use the barrel.

## Tests — `packages/helpers/src/lib/popularityListen.test.ts`

Vitest, following the sibling `popularityTracking` tests' style (`describe` per export, behavior-
focused, **unit-test-design-no-overgranularity**):

- `getCountedListenThresholdSeconds`: `null`, `undefined`, `0`, `-5`, and `NaN` give 60; a
  3,600-second item gives 60; a 200-second item gives 50; a 20-second item gives 5.
- `isCountedListen`: a 3,600-second item counts at 60 seconds and not at 59; a 200-second item
  counts at 50 and not at 49; unknown duration counts at 60 and not at 59; `0` and `NaN` seconds
  never count.
- `fadeTasteScore`: one half-life halves the score (`toBeCloseTo`); two half-lives quarter it;
  `to` equal to or before `from` returns the score unchanged.
- `POPULARITY_TASTE_HALF_LIFE_DAYS.recent` is less than `longTerm`.

## Release scratchpad

none (no behavior change until the write path and clients call it)
