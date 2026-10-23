import { describe, expect, it } from 'vitest';

import {
  fadeTasteScore,
  getCountedListenThresholdSeconds,
  isCountedListen,
  POPULARITY_COUNTED_LISTEN_MIN_SECONDS,
  POPULARITY_TASTE_HALF_LIFE_DAYS,
} from './popularityListen.js';

const MS_PER_DAY = 86_400_000;

describe('getCountedListenThresholdSeconds', () => {
  it('uses 60 seconds when the duration is unknown, zero, negative, or non-finite', () => {
    expect(getCountedListenThresholdSeconds(null)).toBe(POPULARITY_COUNTED_LISTEN_MIN_SECONDS);
    expect(getCountedListenThresholdSeconds(undefined)).toBe(POPULARITY_COUNTED_LISTEN_MIN_SECONDS);
    expect(getCountedListenThresholdSeconds(0)).toBe(POPULARITY_COUNTED_LISTEN_MIN_SECONDS);
    expect(getCountedListenThresholdSeconds(-5)).toBe(POPULARITY_COUNTED_LISTEN_MIN_SECONDS);
    expect(getCountedListenThresholdSeconds(Number.NaN)).toBe(
      POPULARITY_COUNTED_LISTEN_MIN_SECONDS
    );
  });

  it('is 60 seconds or 25% of the item, whichever is smaller', () => {
    expect(getCountedListenThresholdSeconds(3_600)).toBe(60);
    expect(getCountedListenThresholdSeconds(200)).toBe(50);
    expect(getCountedListenThresholdSeconds(20)).toBe(5);
  });
});

describe('isCountedListen', () => {
  it('counts a 3,600-second item at 60 seconds and not at 59', () => {
    expect(isCountedListen({ secondsHeard: 60, durationSeconds: 3_600 })).toBe(true);
    expect(isCountedListen({ secondsHeard: 59, durationSeconds: 3_600 })).toBe(false);
  });

  it('counts a 200-second item at 50 seconds and not at 49', () => {
    expect(isCountedListen({ secondsHeard: 50, durationSeconds: 200 })).toBe(true);
    expect(isCountedListen({ secondsHeard: 49, durationSeconds: 200 })).toBe(false);
  });

  it('counts an unknown duration at 60 seconds and not at 59', () => {
    expect(isCountedListen({ secondsHeard: 60, durationSeconds: null })).toBe(true);
    expect(isCountedListen({ secondsHeard: 59, durationSeconds: undefined })).toBe(false);
  });

  it('never counts zero or non-finite seconds heard', () => {
    expect(isCountedListen({ secondsHeard: 0, durationSeconds: 3_600 })).toBe(false);
    expect(isCountedListen({ secondsHeard: Number.NaN, durationSeconds: 20 })).toBe(false);
  });
});

describe('fadeTasteScore', () => {
  const from = new Date('2026-01-01T00:00:00.000Z');
  const halfLifeDays = POPULARITY_TASTE_HALF_LIFE_DAYS.recent;

  it('halves the score after one half-life and quarters it after two', () => {
    const oneHalfLife = new Date(from.getTime() + halfLifeDays * MS_PER_DAY);
    const twoHalfLives = new Date(from.getTime() + halfLifeDays * 2 * MS_PER_DAY);

    expect(fadeTasteScore({ score: 8, from, to: oneHalfLife, halfLifeDays })).toBeCloseTo(4);
    expect(fadeTasteScore({ score: 8, from, to: twoHalfLives, halfLifeDays })).toBeCloseTo(2);
  });

  it('returns the score unchanged when the end is not after the start', () => {
    const before = new Date(from.getTime() - MS_PER_DAY);

    expect(fadeTasteScore({ score: 8, from, to: from, halfLifeDays })).toBe(8);
    expect(fadeTasteScore({ score: 8, from, to: before, halfLifeDays })).toBe(8);
  });
});

describe('POPULARITY_TASTE_HALF_LIFE_DAYS', () => {
  it('keeps recent taste shorter than long-term taste', () => {
    expect(POPULARITY_TASTE_HALF_LIFE_DAYS.recent).toBeLessThan(
      POPULARITY_TASTE_HALF_LIFE_DAYS.longTerm
    );
  });
});
