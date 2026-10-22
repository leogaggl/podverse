import { describe, expect, it } from 'vitest';

import { resolveAddByRssTrackTabs } from './addByRssTrackTabs';

describe('resolveAddByRssTrackTabs', () => {
  it('offers Summary when the track has no people and no transcript', () => {
    expect(resolveAddByRssTrackTabs({ hasPeople: false, hasTranscript: false })).toEqual([
      'summary',
    ]);
  });

  it('offers Summary, Lyrics, and People in track order', () => {
    expect(resolveAddByRssTrackTabs({ hasPeople: true, hasTranscript: true })).toEqual([
      'summary',
      'transcript',
      'people',
    ]);
  });

  it('offers Summary and People when the track has no transcript', () => {
    expect(resolveAddByRssTrackTabs({ hasPeople: true, hasTranscript: false })).toEqual([
      'summary',
      'people',
    ]);
  });
});
