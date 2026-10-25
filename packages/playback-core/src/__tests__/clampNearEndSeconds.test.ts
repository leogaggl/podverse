import { describe, expect, it } from 'vitest';

import {
  clampCommandStartToFileEnd,
  clampNearEndSeconds,
  COMMAND_START_FILE_END_BACKOFF_SECONDS,
} from '../clampNearEndSeconds.js';

describe('clampNearEndSeconds', () => {
  describe('clamp does not fire', () => {
    it('returns currentSeconds when far below duration - 5', () => {
      expect(clampNearEndSeconds({ currentSeconds: 10, durationSeconds: 100 })).toBe(10);
    });

    it('returns 0 when currentSeconds is 0 and duration is positive', () => {
      expect(clampNearEndSeconds({ currentSeconds: 0, durationSeconds: 100 })).toBe(0);
    });

    it('returns currentSeconds when one second below the threshold (94 vs 100)', () => {
      expect(clampNearEndSeconds({ currentSeconds: 94, durationSeconds: 100 })).toBe(94);
    });

    it('does not clamp when durationSeconds is 0', () => {
      expect(clampNearEndSeconds({ currentSeconds: 999, durationSeconds: 0 })).toBe(999);
    });

    it('does not clamp when durationSeconds is negative (defensive)', () => {
      expect(clampNearEndSeconds({ currentSeconds: 50, durationSeconds: -10 })).toBe(50);
    });
  });

  describe('clamp fires (returns 0)', () => {
    it('clamps when currentSeconds is exactly duration - 5', () => {
      expect(clampNearEndSeconds({ currentSeconds: 95, durationSeconds: 100 })).toBe(0);
    });

    it('clamps when currentSeconds is between duration - 5 and duration', () => {
      expect(clampNearEndSeconds({ currentSeconds: 97.5, durationSeconds: 100 })).toBe(0);
    });

    it('clamps when currentSeconds equals duration', () => {
      expect(clampNearEndSeconds({ currentSeconds: 100, durationSeconds: 100 })).toBe(0);
    });

    it('clamps when currentSeconds is past duration (already overran)', () => {
      expect(clampNearEndSeconds({ currentSeconds: 120, durationSeconds: 100 })).toBe(0);
    });

    it('clamps for very short durations (5s exactly: 0 >= 5 - 5)', () => {
      expect(clampNearEndSeconds({ currentSeconds: 0, durationSeconds: 5 })).toBe(0);
    });
  });
});

describe('clampCommandStartToFileEnd', () => {
  it('keeps a position below the file duration', () => {
    expect(clampCommandStartToFileEnd({ seconds: 100, fileDurationSeconds: 600 })).toBe(100);
  });

  it('keeps a position inside the last 5 seconds of the file', () => {
    expect(clampCommandStartToFileEnd({ seconds: 597, fileDurationSeconds: 600 })).toBe(597);
  });

  it('backs off 5 seconds when the position is exactly the file duration', () => {
    expect(clampCommandStartToFileEnd({ seconds: 600, fileDurationSeconds: 600 })).toBe(595);
  });

  it('backs off 5 seconds when the position is past the file duration', () => {
    expect(clampCommandStartToFileEnd({ seconds: 700, fileDurationSeconds: 600 })).toBe(595);
  });

  it('starts at 0 when backing off would pass the start of a short file', () => {
    expect(clampCommandStartToFileEnd({ seconds: 3, fileDurationSeconds: 3 })).toBe(0);
    expect(clampCommandStartToFileEnd({ seconds: 10, fileDurationSeconds: 4 })).toBe(0);
  });

  it('keeps the position when the file duration is unknown or not positive', () => {
    expect(clampCommandStartToFileEnd({ seconds: 700, fileDurationSeconds: undefined })).toBe(700);
    expect(clampCommandStartToFileEnd({ seconds: 700, fileDurationSeconds: null })).toBe(700);
    expect(clampCommandStartToFileEnd({ seconds: 700, fileDurationSeconds: Number.NaN })).toBe(700);
    expect(clampCommandStartToFileEnd({ seconds: 700, fileDurationSeconds: Infinity })).toBe(700);
    expect(clampCommandStartToFileEnd({ seconds: 700, fileDurationSeconds: 0 })).toBe(700);
    expect(clampCommandStartToFileEnd({ seconds: 700, fileDurationSeconds: -1 })).toBe(700);
  });

  it('starts at 0 for a negative or non-finite position', () => {
    expect(clampCommandStartToFileEnd({ seconds: -5, fileDurationSeconds: 600 })).toBe(0);
    expect(clampCommandStartToFileEnd({ seconds: Number.NaN, fileDurationSeconds: 600 })).toBe(0);
  });

  it('backs off 5 seconds from the end of the file', () => {
    expect(COMMAND_START_FILE_END_BACKOFF_SECONDS).toBe(5);
  });
});
