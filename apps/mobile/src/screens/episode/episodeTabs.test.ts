import { describe, expect, it } from 'vitest';

import { resolveEpisodeTabForItem, resolveEpisodeTabs } from './episodeTabs';

const ALWAYS_ON = ['summary', 'clips'] as const;

describe('resolveEpisodeTabs', () => {
  it('offers Summary and Clips before any evidence tabs', () => {
    expect(resolveEpisodeTabs({ episode: null, previewFlags: null })).toEqual([...ALWAYS_ON]);
  });

  it('seeds evidence tabs from cache and keeps them last', () => {
    expect(
      resolveEpisodeTabs({
        episode: null,
        previewFlags: {
          hasChapters: true,
          hasFunding: false,
          hasPeople: true,
          hasSoundbites: true,
          hasTranscript: true,
        },
      })
    ).toEqual(['summary', 'clips', 'chapters', 'soundbites', 'transcript', 'people']);
  });

  it('keeps Funding last when the item has funding rows', () => {
    expect(
      resolveEpisodeTabs({
        episode: {
          item_fundings: [{ id: 1 }],
        },
        previewFlags: null,
      })
    ).toEqual(['summary', 'clips', 'funding']);
  });

  it('lets the item DTO override cached evidence', () => {
    expect(
      resolveEpisodeTabs({
        episode: {
          item_soundbites: [],
          item_transcripts: [{ url: 'https://example.com/t' }],
        },
        previewFlags: {
          hasChapters: true,
          hasFunding: false,
          hasPeople: false,
          hasSoundbites: true,
          hasTranscript: false,
        },
      })
    ).toEqual(['summary', 'clips', 'transcript']);
  });

  it('keeps People after Funding when the item has both', () => {
    expect(
      resolveEpisodeTabs({
        episode: {
          item_fundings: [{ id: 1 }],
          item_persons: [{ id: 2 }],
        },
        previewFlags: null,
      })
    ).toEqual(['summary', 'clips', 'funding', 'people']);
  });
});

describe('resolveEpisodeTabForItem', () => {
  it('keeps the selected tab when this item supports it', () => {
    expect(
      resolveEpisodeTabForItem({
        selectedTab: 'chapters',
        supportedTabs: ['summary', 'clips', 'chapters'],
      })
    ).toBe('chapters');
  });

  it('falls back to Summary when the selected tab is not available', () => {
    expect(
      resolveEpisodeTabForItem({
        selectedTab: 'transcript',
        supportedTabs: ['summary', 'clips'],
      })
    ).toBe('summary');
  });
});
