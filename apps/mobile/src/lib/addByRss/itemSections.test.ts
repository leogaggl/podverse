import { describe, expect, it } from 'vitest';

import type { AddByRSSChapterResponse } from '@podverse/helpers-requests';
import { convertParsedRSSFeedToCompat } from '@podverse/parser-mapping';

import {
  addByRssItemSectionUrls,
  buildAddByRssItemSectionsRequest,
  toAddByRssItemSections,
} from './itemSections';

const mappedItem = (
  extras: {
    podcastChapters?: { type: string; url: string };
    podcastTranscripts?: Array<{ type: string; url: string }>;
  } = {}
) => {
  const feed = convertParsedRSSFeedToCompat({
    explicit: false,
    items: [
      {
        duration: 60,
        enclosure: {
          length: 100,
          type: 'audio/mpeg',
          url: 'https://cdn.example.com/episode-1.mp3',
        },
        explicit: false,
        guid: 'episode-guid-1',
        pubDate: new Date('2026-01-01T00:00:00.000Z'),
        title: 'Episode One',
        ...extras,
      },
    ],
    link: 'https://example.com/feed.xml',
    title: 'Show Name',
  });
  const item = feed.items[0];
  if (item === undefined) {
    throw new Error('mapped feed has no items');
  }
  return item;
};

const chapter = (idText: string, tableOfContents: boolean): AddByRSSChapterResponse => ({
  data_hash: idText,
  end_time: null,
  id_text: idText,
  img: null,
  start_time: '0',
  table_of_contents: tableOfContents,
  title: idText,
  web_url: null,
});

describe('addByRssItemSectionUrls', () => {
  it('returns null when the item links neither chapters nor a transcript', () => {
    expect(addByRssItemSectionUrls(mappedItem())).toBeNull();
  });

  it('returns a transcript URL and leaves chapters unset when only a transcript is linked', () => {
    expect(
      addByRssItemSectionUrls(
        mappedItem({
          podcastTranscripts: [{ type: 'text/vtt', url: 'https://example.com/episode.vtt' }],
        })
      )
    ).toEqual({
      chaptersFeedUrl: undefined,
      transcriptUrl: 'https://example.com/episode.vtt',
    });
  });
});

describe('buildAddByRssItemSectionsRequest', () => {
  const feedUrl = 'https://example.com/feed.xml';
  const itemIdText = 'feed-1-item-1';

  it('includes both basic auth fields when credentials are given', () => {
    expect(
      buildAddByRssItemSectionsRequest({
        credentials: { password: 'hunter2', username: 'listener' },
        feedUrl,
        itemIdText,
        urls: {
          chaptersFeedUrl: 'https://example.com/chapters.json',
          transcriptUrl: 'https://example.com/episode.vtt',
        },
      })
    ).toEqual({
      basic_auth_password: 'hunter2',
      basic_auth_username: 'listener',
      chaptersFeedUrl: 'https://example.com/chapters.json',
      feedUrl,
      itemIdText,
      transcriptUrl: 'https://example.com/episode.vtt',
    });
  });

  it('omits credentials and an undefined URL', () => {
    const request = buildAddByRssItemSectionsRequest({
      credentials: null,
      feedUrl,
      itemIdText,
      urls: {
        chaptersFeedUrl: undefined,
        transcriptUrl: 'https://example.com/episode.vtt',
      },
    });

    expect(request).not.toHaveProperty('basic_auth_username');
    expect(request).not.toHaveProperty('basic_auth_password');
    expect(request).not.toHaveProperty('chaptersFeedUrl');
    expect(request).toEqual({
      feedUrl,
      itemIdText,
      transcriptUrl: 'https://example.com/episode.vtt',
    });
  });
});

describe('toAddByRssItemSections', () => {
  it('drops table-of-contents-suppressed chapters and keeps the rest in order', () => {
    const sections = toAddByRssItemSections({
      chapters: [chapter('intro', true), chapter('ads', false), chapter('topic', true)],
      transcriptText: 'Spoken words.',
    });

    expect(sections.chapters.map((row) => row.id_text)).toEqual(['intro', 'topic']);
    expect(sections.transcriptText).toBe('Spoken words.');
  });

  it('uses an empty transcript when the response omits one', () => {
    expect(toAddByRssItemSections({ chapters: [] }).transcriptText).toBe('');
  });
});
