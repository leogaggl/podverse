import { describe, expect, it } from 'vitest';

import { splitDescriptionClocks } from './descriptionClocks.js';

const clocks = (text: string): Array<{ text: string; seconds: number }> =>
  splitDescriptionClocks(text)
    .filter((part) => part.kind === 'clock')
    .map((part) => ({ text: part.text, seconds: part.seconds }));

describe('splitDescriptionClocks', () => {
  it('reads h:mm:ss, m:ss, and a start clock', () => {
    expect(clocks('jump to 1:02:03')).toEqual([{ text: '1:02:03', seconds: 3723 }]);
    expect(clocks('at 1:23')).toEqual([{ text: '1:23', seconds: 83 }]);
    expect(clocks('from 0:00')).toEqual([{ text: '0:00', seconds: 0 }]);
    expect(clocks('long note 90:15 and 100:05')).toEqual([
      { text: '90:15', seconds: 5415 },
      { text: '100:05', seconds: 6005 },
    ]);
  });

  it('treats a written range as two clocks', () => {
    expect(clocks('12:34 - 18:02')).toEqual([
      { text: '12:34', seconds: 754 },
      { text: '18:02', seconds: 1082 },
    ]);
  });

  it('skips ratios, dates, meridians, and clocks inside a URL', () => {
    expect(clocks('aspect 16:9')).toEqual([]);
    expect(clocks('2024-01-02 and 1:60:00')).toEqual([]);
    expect(clocks('3:00 PM then 4:15')).toEqual([{ text: '4:15', seconds: 255 }]);
    expect(clocks('3:00pm')).toEqual([]);
    expect(clocks('see https://example.com/ep/12:34/file later')).toEqual([]);
    expect(clocks('www.example.com/12:34')).toEqual([]);
  });

  it('keeps the surrounding prose in order', () => {
    expect(splitDescriptionClocks('Intro 1:05. Outro.')).toEqual([
      { kind: 'text', text: 'Intro ' },
      { kind: 'clock', text: '1:05', seconds: 65 },
      { kind: 'text', text: '. Outro.' },
    ]);
  });
});
