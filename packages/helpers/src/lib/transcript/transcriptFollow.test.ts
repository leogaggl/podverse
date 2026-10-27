import { describe, expect, it } from 'vitest';

import type { TranscriptRow } from '../../dtos/item/itemTranscript.js';
import {
  filterTranscriptRowsByBody,
  findActiveTranscriptRowIndex,
  resolveTranscriptScrollAlign,
} from './transcriptFollow.js';

const row = (
  startTime: number,
  endTime: number,
  body: string,
  speaker?: string
): TranscriptRow => ({
  body,
  endTime,
  endTimeFormatted: null,
  speaker,
  startTime,
  startTimeFormatted: null,
});

describe('filterTranscriptRowsByBody', () => {
  const rows = [row(0, 5, 'Hello there'), row(5, 10, 'Goodbye world'), row(10, 15, 'HELLO again')];

  it('returns all rows when the term is empty or whitespace', () => {
    expect(filterTranscriptRowsByBody(rows, '')).toEqual(rows);
    expect(filterTranscriptRowsByBody(rows, '   ')).toEqual(rows);
  });

  it('filters case-insensitively by body substring', () => {
    expect(filterTranscriptRowsByBody(rows, 'hello')).toEqual([rows[0], rows[2]]);
    expect(filterTranscriptRowsByBody(rows, 'WORLD')).toEqual([rows[1]]);
  });
});

describe('findActiveTranscriptRowIndex', () => {
  const sorted = [row(0, 5, 'a'), row(5, 10, 'b'), row(12, 20, 'c')];

  it('returns -1 for an empty list', () => {
    expect(findActiveTranscriptRowIndex([], 3)).toBe(-1);
  });

  it('returns the cue that contains the playhead', () => {
    expect(findActiveTranscriptRowIndex(sorted, 0)).toBe(0);
    expect(findActiveTranscriptRowIndex(sorted, 4.9)).toBe(0);
    expect(findActiveTranscriptRowIndex(sorted, 5)).toBe(1);
    expect(findActiveTranscriptRowIndex(sorted, 12)).toBe(2);
  });

  it('returns -1 in a gap, before the first cue, and at or after the last end', () => {
    expect(findActiveTranscriptRowIndex(sorted, -1)).toBe(-1);
    expect(findActiveTranscriptRowIndex(sorted, 10)).toBe(-1);
    expect(findActiveTranscriptRowIndex(sorted, 11)).toBe(-1);
    expect(findActiveTranscriptRowIndex(sorted, 20)).toBe(-1);
  });

  it('uses a linear scan when start times decrease', () => {
    const unsorted = [row(10, 15, 'later'), row(0, 5, 'earlier'), row(5, 10, 'middle')];
    expect(findActiveTranscriptRowIndex(unsorted, 2)).toBe(1);
    expect(findActiveTranscriptRowIndex(unsorted, 12)).toBe(0);
  });

  it('returns the first match when ranges overlap', () => {
    const overlapping = [row(0, 10, 'first'), row(5, 15, 'second')];
    expect(findActiveTranscriptRowIndex(overlapping, 7)).toBe(0);
  });
});

describe('resolveTranscriptScrollAlign', () => {
  it('returns null when there is no active cue', () => {
    expect(
      resolveTranscriptScrollAlign({
        activeIndex: -1,
        visibleEndIndex: 5,
        visibleStartIndex: 0,
      })
    ).toBeNull();
  });

  it('returns null when the active cue is in the visible range', () => {
    expect(
      resolveTranscriptScrollAlign({
        activeIndex: 3,
        visibleEndIndex: 5,
        visibleStartIndex: 0,
      })
    ).toBeNull();
    expect(
      resolveTranscriptScrollAlign({
        activeIndex: 0,
        visibleEndIndex: 0,
        visibleStartIndex: 0,
      })
    ).toBeNull();
  });

  it('returns start when the active cue is above the visible range', () => {
    expect(
      resolveTranscriptScrollAlign({
        activeIndex: 1,
        visibleEndIndex: 10,
        visibleStartIndex: 5,
      })
    ).toBe('start');
  });

  it('returns end when the active cue is below the visible range', () => {
    expect(
      resolveTranscriptScrollAlign({
        activeIndex: 12,
        visibleEndIndex: 10,
        visibleStartIndex: 5,
      })
    ).toBe('end');
  });
});
