import { describe, expect, it } from 'vitest';

import { resolveAddByRssEpisodeTabs } from './addByRssEpisodeTabs';

describe('resolveAddByRssEpisodeTabs', () => {
  it('offers Summary when the item has none of the optional sections', () => {
    expect(
      resolveAddByRssEpisodeTabs({ hasChapters: false, hasPeople: false, hasTranscript: false })
    ).toEqual(['summary']);
  });

  it('offers every Add by RSS chip in episode order', () => {
    expect(
      resolveAddByRssEpisodeTabs({ hasChapters: true, hasPeople: true, hasTranscript: true })
    ).toEqual(['summary', 'chapters', 'transcript', 'people']);
  });

  it('keeps transcript before people when chapters are absent', () => {
    expect(
      resolveAddByRssEpisodeTabs({ hasChapters: false, hasPeople: true, hasTranscript: true })
    ).toEqual(['summary', 'transcript', 'people']);
  });
});
