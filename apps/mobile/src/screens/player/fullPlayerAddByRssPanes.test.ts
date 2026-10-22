import { describe, expect, it } from 'vitest';

import type { AddByRSSResourceData } from '@podverse/helpers/dto';
import type { AddByRSSMappedFeed } from '@podverse/parser-mapping';
import { convertParsedRSSFeedToCompat } from '@podverse/parser-mapping';

import type { AddByRssNowPlayingItemSource } from '../../lib/addByRss/localResourceData';
import type { AddByRssNowPlayingSectionsSnapshot } from '../../playback/addByRssNowPlayingSectionsStore';
import type { FullPlayerAddByRssPaneInput } from './fullPlayerAddByRssPanes';
import {
  addByRssPaneSummary,
  addByRssResourceDataLinksChapters,
  resolveFullPlayerAddByRssPaneState,
  shouldLoadFullPlayerAddByRssSections,
} from './fullPlayerAddByRssPanes';

const mappedFeed = convertParsedRSSFeedToCompat({
  explicit: false,
  items: [
    {
      duration: 60,
      enclosure: { length: 100, type: 'audio/mpeg', url: 'https://cdn.example.com/episode.mp3' },
      explicit: false,
      guid: 'episode-guid',
      link: 'https://example.com/episode',
      pubDate: new Date('2026-01-02T00:00:00.000Z'),
      title: 'Episode',
    },
  ],
  link: 'https://example.com/feed.xml',
  title: 'Show',
});

const mappedItem = mappedFeed.items[0];
if (mappedItem === undefined) {
  throw new Error('mapped feed has no items');
}

const summaryItem = (
  description: AddByRSSMappedFeed['items'][number]['description'],
  websiteLinkUrl: string | null = null
): AddByRSSMappedFeed['items'][number] => ({
  ...mappedItem,
  about: { ...mappedItem.about, website_link_url: websiteLinkUrl },
  description,
});

const transcriptSource: AddByRssNowPlayingItemSource = {
  feedUrl: 'https://example.com/feed.xml',
  itemBundle: mappedItem,
  itemIdText: 'episode-guid',
  sectionUrls: {
    chaptersFeedUrl: undefined,
    transcriptUrl: 'https://example.com/transcript.txt',
  },
};

const readySnapshot = (
  overrides: Partial<AddByRssNowPlayingSectionsSnapshot> = {}
): AddByRssNowPlayingSectionsSnapshot => ({
  key: 'episode-guid',
  sections: null,
  sectionsStatus: 'idle',
  source: transcriptSource,
  sourceStatus: 'resolved',
  ...overrides,
});

const paneInput = (
  overrides: Partial<FullPlayerAddByRssPaneInput> = {}
): FullPlayerAddByRssPaneInput => ({
  activeTab: 'transcript',
  authStatus: 'authenticated',
  offlineModeEnabled: false,
  snapshot: readySnapshot(),
  ...overrides,
});

describe('addByRssResourceDataLinksChapters', () => {
  it('is true only when the stored bundle links a chapters URL', () => {
    const linked: AddByRSSResourceData = {
      bundle: { chaptersFeed: { url: 'https://example.com/chapters.json' } },
    };
    expect(addByRssResourceDataLinksChapters(linked)).toBe(true);
    expect(addByRssResourceDataLinksChapters({})).toBe(false);
    expect(addByRssResourceDataLinksChapters({ bundle: { chaptersFeed: null } })).toBe(false);
    expect(addByRssResourceDataLinksChapters({ bundle: { chaptersFeed: { url: '   ' } } })).toBe(
      false
    );
  });
});

describe('resolveFullPlayerAddByRssPaneState', () => {
  it.each([
    {
      expected: 'loading' as const,
      name: 'resolving source on Summary',
      input: paneInput({
        activeTab: 'summary',
        snapshot: readySnapshot({ sourceStatus: 'resolving' }),
      }),
    },
    {
      expected: 'content' as const,
      name: 'resolved Summary',
      input: paneInput({ activeTab: 'summary' }),
    },
    {
      expected: 'offline' as const,
      name: 'Chapters with Offline Mode and no sections',
      input: paneInput({ activeTab: 'chapters', offlineModeEnabled: true }),
    },
    {
      expected: 'content' as const,
      name: 'Offline Mode with loaded sections',
      input: paneInput({
        activeTab: 'chapters',
        offlineModeEnabled: true,
        snapshot: readySnapshot({
          sections: { chapters: [], transcriptText: 'Loaded' },
          sectionsStatus: 'loaded',
        }),
      }),
    },
    {
      expected: 'auth-required' as const,
      name: 'anonymous',
      input: paneInput({ activeTab: 'chapters', authStatus: 'anonymous' }),
    },
    {
      expected: 'error' as const,
      name: 'error',
      input: paneInput({
        snapshot: readySnapshot({ sectionsStatus: 'error' }),
      }),
    },
    {
      expected: 'loading' as const,
      name: 'unknown auth, nothing loaded',
      input: paneInput({ activeTab: 'chapters', authStatus: 'unknown' }),
    },
  ])('$name → $expected', ({ expected, input }) => {
    expect(resolveFullPlayerAddByRssPaneState(input)).toBe(expected);
  });
});

describe('shouldLoadFullPlayerAddByRssSections', () => {
  it('loads Transcript for a transcript-only item that is idle, signed in, and online', () => {
    expect(shouldLoadFullPlayerAddByRssSections(paneInput())).toBe(true);
  });

  it.each([
    {
      name: 'Summary',
      input: paneInput({ activeTab: 'summary' }),
    },
    {
      name: 'while loading',
      input: paneInput({ snapshot: readySnapshot({ sectionsStatus: 'loading' }) }),
    },
    {
      name: 'after an error',
      input: paneInput({ snapshot: readySnapshot({ sectionsStatus: 'error' }) }),
    },
    {
      name: 'Offline Mode',
      input: paneInput({ offlineModeEnabled: true }),
    },
  ])('stays false on $name', ({ input }) => {
    expect(shouldLoadFullPlayerAddByRssSections(input)).toBe(false);
  });
});

describe('addByRssPaneSummary', () => {
  it('prefers value, falls back to preview, and links a truncated item', () => {
    expect(
      addByRssPaneSummary(
        summaryItem({
          is_truncated: false,
          preview: 'Preview notes',
          source_length: 20,
          value: '<p>Full notes</p>',
        })
      )
    ).toEqual({ html: '<p>Full notes</p>', truncation: undefined });

    expect(
      addByRssPaneSummary(
        summaryItem({
          is_truncated: false,
          preview: 'From the preview',
          source_length: 16,
          value: '',
        })
      )
    ).toEqual({ html: 'From the preview', truncation: undefined });

    expect(
      addByRssPaneSummary(
        summaryItem(
          {
            is_truncated: true,
            preview: 'Cut',
            source_length: 500,
            value: '<p>Cut</p>',
          },
          'https://example.com/episode'
        )
      ).truncation
    ).toEqual({ kind: 'item', linkUrl: 'https://example.com/episode' });

    expect(addByRssPaneSummary(null)).toEqual({ html: null, truncation: undefined });
  });
});
