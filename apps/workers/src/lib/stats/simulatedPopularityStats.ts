export const SIMULATED_STATS_ITEMS_PER_CHANNEL = 30;
export const SIMULATED_STATS_WINDOW_DAYS = 31;
export const SIMULATED_STATS_HISTORY_DAY_OFFSET = 200;

/**
 * `window[i]` is the listener total `i` UTC days before today; `history` is one older total
 * that carries the rest of the all-time count.
 */
export type SimulatedDailyCounts = { window: number[]; history: number };

export type SimulatedStatsCohort = 'fading' | 'headliner' | 'rising' | 'tail';

type Rng = () => number;

function hash32(n: number): number {
  let x = n | 0;
  x = Math.imul(x ^ (x >>> 16), 0x45d9f3b);
  x = Math.imul(x ^ (x >>> 16), 0x45d9f3b);
  return (x ^ (x >>> 16)) >>> 0;
}

function mulberry32(seed: number): Rng {
  let t = seed >>> 0;
  return () => {
    t += 0x6d2b79f5;
    let x = t;
    x = Math.imul(x ^ (x >>> 15), x | 1);
    x ^= x + Math.imul(x ^ (x >>> 7), x | 61);
    return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
  };
}

function intIn(rng: Rng, min: number, max: number): number {
  if (max <= min) {
    return min;
  }
  return min + Math.floor(rng() * (max - min + 1));
}

function zipfWeight(rank: number): number {
  return 1 / (rank + 1) ** 1.2;
}

export function assignSimulatedStatsCohort(
  rank: number,
  total: number,
  entityId: number
): SimulatedStatsCohort {
  const rng = mulberry32(hash32(entityId * 31 + 7));
  const position = total <= 1 ? 0 : rank / (total - 1);
  const jitter = (rng() - 0.5) * 0.08;
  const t = Math.min(1, Math.max(0, position + jitter));

  if (t < 0.15) {
    return 'headliner';
  }
  if (t < 0.3) {
    return 'rising';
  }
  if (t < 0.45) {
    return 'fading';
  }
  return 'tail';
}

function cohortAllTimeRange(cohort: SimulatedStatsCohort): { max: number; min: number } {
  switch (cohort) {
    case 'headliner':
      return { max: 45000, min: 8000 };
    case 'rising':
      return { max: 900, min: 80 };
    case 'fading':
      return { max: 30000, min: 5000 };
    case 'tail':
      return { max: 400, min: 20 };
  }
}

function cohortDayPeakRange(cohort: SimulatedStatsCohort): { max: number; min: number } {
  switch (cohort) {
    case 'headliner':
      return { max: 220, min: 40 };
    case 'rising':
      return { max: 180, min: 30 };
    case 'fading':
      return { max: 25, min: 0 };
    case 'tail':
      return { max: 12, min: 0 };
  }
}

function dailyWindow(cohort: SimulatedStatsCohort, peak: number, rng: Rng): number[] {
  const peakDay =
    cohort === 'rising'
      ? intIn(rng, 0, 1)
      : cohort === 'fading'
        ? intIn(rng, 12, 25)
        : intIn(rng, 1, 6);
  const weekdayBump = intIn(rng, 1, 3);

  return Array.from({ length: SIMULATED_STATS_WINDOW_DAYS }, (_, day) => {
    const distance = Math.abs(day - peakDay);
    const decay = 1 / (1 + distance * 0.55);
    const weekday = day % 7 < 5 ? 1 + weekdayBump * 0.08 : 0.72;
    const noise = 0.85 + rng() * 0.3;
    if (cohort === 'tail' && rng() < 0.45) {
      return 0;
    }
    return Math.max(0, Math.round(peak * decay * weekday * noise));
  });
}

function sum(values: number[]): number {
  return values.reduce((total, value) => total + value, 0);
}

export function buildSimulatedChannelDailyCounts(input: {
  entityId: number;
  rank: number;
  total: number;
}): SimulatedDailyCounts {
  const rng = mulberry32(hash32(input.entityId * 17 + input.rank * 13 + 101));
  const cohort = assignSimulatedStatsCohort(input.rank, input.total, input.entityId);
  const allTimeRange = cohortAllTimeRange(cohort);
  const dayRange = cohortDayPeakRange(cohort);
  const zipf = zipfWeight(input.rank);
  const allTimeTarget = Math.max(
    1,
    Math.round(intIn(rng, allTimeRange.min, allTimeRange.max) * (0.55 + zipf))
  );
  const dayPeak = intIn(rng, dayRange.min, dayRange.max);
  const window = dailyWindow(cohort, dayPeak, rng);
  return { history: Math.max(0, allTimeTarget - sum(window)), window };
}

export function buildSimulatedItemDailyCounts(input: {
  channelCounts: SimulatedDailyCounts;
  entityId: number;
  itemCount: number;
  itemIndex: number;
}): SimulatedDailyCounts {
  const rng = mulberry32(hash32(input.entityId * 41 + input.itemIndex * 19 + 3));
  const newestShare =
    input.itemIndex === 0 ? 0.38 : input.itemIndex === 1 ? 0.22 : input.itemIndex === 2 ? 0.12 : 0;
  const longTailShare = newestShare === 0 ? 0.28 / Math.max(input.itemCount - 3, 1) : newestShare;
  const viral =
    input.itemCount > 4 &&
    hash32(input.entityId) % Math.max(input.itemCount, 1) === input.itemIndex;
  const allTimeShare = viral
    ? 0.22
    : newestShare === 0
      ? 0.08 + (input.itemIndex / Math.max(input.itemCount, 1)) * 0.12
      : 0.04;
  const dayShare = viral ? 0.18 : longTailShare;
  const jitter = 0.9 + rng() * 0.2;
  const historyShare = Math.min(0.35, allTimeShare);

  const window = Array.from({ length: SIMULATED_STATS_WINDOW_DAYS }, (_, day) => {
    const channelDay = input.channelCounts.window[day] ?? 0;
    return Math.min(channelDay, Math.round(channelDay * dayShare * jitter));
  });
  const history = Math.min(
    input.channelCounts.history,
    Math.round(input.channelCounts.history * historyShare * jitter)
  );
  return { history, window };
}

/** Finishers for one day: between 30% and 70% of `listenerCount`, never more than it. */
export function simulatedCompletionCount(
  listenerCount: number,
  entityId: number,
  dayOffset: number
): number {
  if (listenerCount <= 0) {
    return 0;
  }
  const rng = mulberry32(hash32(entityId * 53 + dayOffset * 7 + 11));
  const ratio = 0.3 + 0.4 * rng();
  return Math.min(listenerCount, Math.round(listenerCount * ratio));
}
