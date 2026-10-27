import { describe, expect, it } from 'vitest';

import { parseTranscriptRows, parseTranscriptRowsOrEmpty } from './parseTranscriptRows.js';

describe('parseTranscriptRows', () => {
  it('parses Podcast Namespace JSON segments with speakers and times', () => {
    const data = JSON.stringify({
      version: '1.0.0',
      segments: [
        {
          speaker: 'Chris',
          startTime: 11,
          endTime: 15,
          body: 'Hello there.',
        },
        {
          speaker: 'Wes',
          startTime: 15,
          endTime: 20,
          body: 'Hi Chris.',
        },
      ],
    });

    const rows = parseTranscriptRows(data);

    expect(rows).toHaveLength(2);
    expect(rows[0]?.speaker).toBe('Chris');
    expect(rows[0]?.body).toBe('Hello there.');
    expect(rows[0]?.startTime).toBe(11);
    expect(rows[1]?.speaker).toBe('Wes');
    expect(rows[1]?.startTime).toBe(15);
  });

  it('clears a repeated speaker on consecutive lines', () => {
    const data = JSON.stringify({
      version: '1.0.0',
      segments: [
        {
          speaker: 'Chris',
          startTime: 0,
          endTime: 5,
          body: 'First.',
        },
        {
          speaker: 'Chris',
          startTime: 5,
          endTime: 10,
          body: 'Second.',
        },
        {
          speaker: 'Wes',
          startTime: 10,
          endTime: 15,
          body: 'Third.',
        },
      ],
    });

    const rows = parseTranscriptRows(data);

    expect(rows[0]?.speaker).toBe('Chris');
    expect(rows[1]?.speaker).toBe('');
    expect(rows[2]?.speaker).toBe('Wes');
  });

  it('returns an empty list for empty input', () => {
    expect(() => parseTranscriptRows('')).toThrow();
    expect(() => parseTranscriptRows('   ')).toThrow();
  });

  it('parseTranscriptRowsOrEmpty returns [] for empty or bad input', () => {
    expect(parseTranscriptRowsOrEmpty(null)).toEqual([]);
    expect(parseTranscriptRowsOrEmpty('')).toEqual([]);
    expect(parseTranscriptRowsOrEmpty('not-a-transcript')).toEqual([]);
  });

  it('parseTranscriptRowsOrEmpty returns rows for valid JSON', () => {
    const data = JSON.stringify({
      version: '1.0.0',
      segments: [{ speaker: 'A', startTime: 0, endTime: 1, body: 'Hi' }],
    });
    expect(parseTranscriptRowsOrEmpty(data)).toHaveLength(1);
  });
});
