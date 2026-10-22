import { describe, expect, it } from 'vitest';

import { addByRssDownloadItemIdText } from './downloadIdText';

const feedUrl = 'https://example.com/feed.xml';

describe('addByRssDownloadItemIdText', () => {
  it('uses the guid, then the enclosure guid, then the index', () => {
    expect(
      addByRssDownloadItemIdText(feedUrl, { guid: 'abc', guid_enclosure_url: 'https://enc' }, 2)
    ).toBe(`${feedUrl}::abc`);
    expect(
      addByRssDownloadItemIdText(feedUrl, { guid: null, guid_enclosure_url: 'https://enc' }, 2)
    ).toBe(`${feedUrl}::https://enc`);
    expect(addByRssDownloadItemIdText(feedUrl, { guid: null, guid_enclosure_url: null }, 2)).toBe(
      `${feedUrl}::2`
    );
  });
});
