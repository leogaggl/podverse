/** Media seconds heard after which a listen counts, whatever the item's length. */
export const POPULARITY_COUNTED_LISTEN_MIN_SECONDS = 60;

/** Share of the item heard after which a listen counts, when that comes before the seconds rule. */
export const POPULARITY_COUNTED_LISTEN_MIN_FRACTION = 0.25;

/**
 * Seconds of media a listener must hear before a listen counts: 60 seconds or 25% of the item,
 * whichever is smaller. An unknown, zero, negative, or non-finite duration uses the 60-second rule.
 */
export function getCountedListenThresholdSeconds(
  durationSeconds: number | null | undefined
): number {
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
export type PopularityOpenResult =
  'counted' | 'unchanged' | 'own_content' | 'not_allowed' | 'not_found';
