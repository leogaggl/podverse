import { describe, expect, it } from 'vitest';

import { convertParsedRSSFeedToCompat } from '@podverse/parser-mapping';

import { safeJsonParse } from '../../data/db/serialization';
import { addByRssDownloadItemIdText } from './downloadIdText';
import { addByRssDownloadItem } from './downloadItem';

const feedUrl = 'https://example.com/feed.xml';
const enclosureUrl = 'https://example.com/one.mp3';
const pubDate = new Date('2026-03-01T00:00:00.000Z');

const mapped = convertParsedRSSFeedToCompat({
  explicit: false,
  items: [
    {
      duration: 60,
      enclosure: { length: 100, type: 'audio/mpeg', url: enclosureUrl },
      explicit: false,
      guid: 'ep-guid',
      pubDate,
      title: 'Guided',
    },
  ],
  link: feedUrl,
  title: 'Example',
});

describe('addByRssDownloadItem', () => {
  it('names the download by the feed-scoped id and keeps the enclosure source', () => {
    const bundle = mapped.items[0];
    expect(bundle).toBeDefined();
    if (bundle === undefined) {
      return;
    }

    const downloaded = addByRssDownloadItem(feedUrl, bundle, 0);

    expect(downloaded?.id_text).toBe(addByRssDownloadItemIdText(feedUrl, bundle.item, 0));
    expect(downloaded?.channel?.id_text).toBe(feedUrl);
    expect(downloaded?.item_enclosures[0]?.item_enclosure_sources[0]?.uri).toBe(enclosureUrl);
  });

  it('returns null when the item has no enclosures', () => {
    const bundle = mapped.items[0];
    expect(bundle).toBeDefined();
    if (bundle === undefined) {
      return;
    }

    expect(addByRssDownloadItem(feedUrl, { ...bundle, enclosures: [] }, 0)).toBeNull();
  });

  it('stores a Date and an ISO string publication time as the same ISO string', () => {
    const bundle = mapped.items[0];
    expect(bundle).toBeDefined();
    if (bundle === undefined) {
      return;
    }

    expect(addByRssDownloadItem(feedUrl, bundle, 0)?.pub_date).toBe(pubDate.toISOString());

    const reloaded = safeJsonParse<typeof mapped>(JSON.stringify(mapped));
    expect(reloaded).not.toBeNull();
    if (reloaded === null) {
      return;
    }
    const stringBundle = reloaded.items[0];
    expect(stringBundle).toBeDefined();
    if (stringBundle === undefined) {
      return;
    }

    expect(addByRssDownloadItem(feedUrl, stringBundle, 0)?.pub_date).toBe(pubDate.toISOString());
  });
});
